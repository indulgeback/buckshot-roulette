/**
 * multiplayer.js — PeerJS WebRTC P2P connection manager
 *
 * Host creates a room (6-char code = PeerJS ID).
 * Client joins by entering the room code.
 * All game data flows over WebRTC DataChannel.
 */

const PEER_PREFIX = 'buckshot-roulette-';

const ICE_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
    ]
};

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

/** Set up data connection event handlers */
function setupConnection(connection) {
    console.log('[MP] setupConnection, open:', connection.open);

    if (connection.open) {
        // Already open (rare but possible)
        connected = true;
        if (connectionChangeHandler) connectionChangeHandler('connected');
    }

    connection.on('open', () => {
        console.log('[MP] DataChannel OPEN');
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
        console.log('[MP] DataChannel closed');
        connected = false;
        if (connectionChangeHandler) connectionChangeHandler('disconnected');
    });

    connection.on('error', (err) => {
        console.error('[MP] DataChannel error:', err);
        connected = false;
        if (connectionChangeHandler) connectionChangeHandler('error');
    });
}

/** Create a room — returns the room code */
export function createRoom() {
    return new Promise((resolve, reject) => {
        const code = generateRoomCode();
        const peerId = PEER_PREFIX + code;
        hostRole = true;
        connected = false;

        peer = new Peer(peerId, { config: ICE_CONFIG });

        peer.on('open', () => {
            console.log('[MP] Host peer OPEN, id:', peerId);
            resolve(code);
        });

        peer.on('connection', (connection) => {
            console.log('[MP] Host received connection, open:', connection.open);
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
            connected = false;
            if (connectionChangeHandler) connectionChangeHandler('disconnected');
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

        peer = new Peer({ config: ICE_CONFIG });

        peer.on('open', (myId) => {
            console.log('[MP] Client peer OPEN, id:', myId, '→ connecting to:', targetId);
            conn = peer.connect(targetId);
            setupConnection(conn);

            // Resolve when the connection opens
            // setupConnection already handles the 'open' event,
            // but we need to resolve this promise
            const origHandler = connectionChangeHandler;
            connectionChangeHandler = (state) => {
                if (state === 'connected') {
                    resolve();
                }
                if (origHandler) origHandler(state);
            };

            // Timeout after 15s
            setTimeout(() => {
                if (!connected) {
                    reject(new Error('Connection timeout'));
                }
            }, 15000);
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
            console.log('[MP] Client peer disconnected');
            connected = false;
            if (connectionChangeHandler) connectionChangeHandler('disconnected');
        });
    });
}

/** Send a message to the other peer */
export function send(data) {
    if (conn && connected) {
        conn.send(JSON.stringify(data));
    } else {
        console.warn('[MP] send() called but not connected');
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
