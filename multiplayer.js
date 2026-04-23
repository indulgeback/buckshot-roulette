/**
 * multiplayer.js — PeerJS WebRTC P2P connection manager
 *
 * Host creates a room (6-char code = PeerJS ID).
 * Client joins by entering the room code.
 * All game data flows over WebRTC DataChannel.
 */

const PEER_PREFIX = 'buckshot-roulette-';

let peer = null;
let conn = null;
let hostRole = false;
let connected = false;

let messageHandler = null;
let connectionChangeHandler = null;

/** Generate a 6-char alphanumeric room code */
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

/** Create a room — returns the room code */
export function createRoom() {
    return new Promise((resolve, reject) => {
        const code = generateRoomCode();
        const peerId = PEER_PREFIX + code;
        hostRole = true;
        connected = false;

        peer = new Peer(peerId, {
            debug: 0
        });

        peer.on('open', () => {
            console.log('[MP] Host peer open, id:', peerId);
            resolve(code);
        });

        peer.on('connection', (connection) => {
            console.log('[MP] Host received connection, open:', connection.open, 'peer:', connection.peer);
            conn = connection;
            setupConnection(conn);
        });

        peer.on('error', (err) => {
            console.error('[MP] Host peer error:', err.type, err);
            if (err.type === 'unavailable-id') {
                reject(new Error('Room code collision, try again'));
            } else {
                reject(err);
            }
        });

        peer.on('disconnected', () => {
            console.log('[MP] Host peer disconnected');
            handleDisconnect();
        });
    });
}

/** Join an existing room by code */
export function joinRoom(code) {
    return new Promise((resolve, reject) => {
        const cleanCode = code.trim().toUpperCase();
        if (!/^[A-HJ-NP-Z2-9]{6}$/.test(cleanCode)) {
            reject(new Error('Invalid room code'));
            return;
        }

        const targetId = PEER_PREFIX + cleanCode;
        hostRole = false;
        connected = false;

        peer = new Peer({
            debug: 0
        });

        peer.on('open', () => {
            console.log('[MP] Client peer open, connecting to:', targetId);
            conn = peer.connect(targetId, { reliable: true });

            conn.on('open', () => {
                console.log('[MP] Client connection open!');
                connected = true;
                if (connectionChangeHandler) connectionChangeHandler('connected');
                resolve();
            });

            conn.on('data', (data) => {
                if (messageHandler) {
                    try {
                        const msg = typeof data === 'string' ? JSON.parse(data) : data;
                        messageHandler(msg);
                    } catch (e) {
                        console.error('[MP] Failed to parse message:', e);
                    }
                }
            });

            conn.on('close', () => {
                connected = false;
                if (connectionChangeHandler) connectionChangeHandler('disconnected');
            });

            conn.on('error', (err) => {
                console.error('[MP] Connection error:', err);
                connected = false;
                if (connectionChangeHandler) connectionChangeHandler('error');
                reject(err);
            });
        });

        peer.on('error', (err) => {
            console.error('[MP] Client peer error:', err.type, err);
            if (err.type === 'peer-unavailable') {
                reject(new Error('Room not found'));
            } else {
                reject(err);
            }
        });

        peer.on('disconnected', () => {
            handleDisconnect();
        });
    });
}

/** Set up data connection event handlers */
function setupConnection(connection) {
    connection.on('open', () => {
        console.log('[MP] setupConnection: open');
        connected = true;
        if (connectionChangeHandler) connectionChangeHandler('connected');
    });

    connection.on('data', (data) => {
        if (messageHandler) {
            try {
                const msg = typeof data === 'string' ? JSON.parse(data) : data;
                messageHandler(msg);
            } catch (e) {
                console.error('[MP] Failed to parse message:', e);
            }
        }
    });

    connection.on('close', () => {
        connected = false;
        if (connectionChangeHandler) connectionChangeHandler('disconnected');
    });

    connection.on('error', (err) => {
        console.error('[MP] DataConnection error:', err);
        connected = false;
        if (connectionChangeHandler) connectionChangeHandler('error');
    });
}

/** Handle peer-level disconnect */
function handleDisconnect() {
    connected = false;
    if (connectionChangeHandler) connectionChangeHandler('disconnected');
}

/** Send a message to the other peer */
export function send(data) {
    if (conn && connected) {
        conn.send(JSON.stringify(data));
    }
}

/** Register a handler for incoming messages */
export function onMessage(handler) {
    messageHandler = handler;
}

/** Register a handler for connection state changes */
export function onConnectionChange(cb) {
    connectionChangeHandler = cb;
}

/** Are we connected? */
export function isConnected() {
    return connected;
}

/** Are we the host? */
export function isHost() {
    return hostRole;
}

/** Disconnect and clean up */
export function disconnect() {
    if (conn) {
        conn.close();
        conn = null;
    }
    if (peer) {
        peer.destroy();
        peer = null;
    }
    connected = false;
    hostRole = false;
    messageHandler = null;
    connectionChangeHandler = null;
}
