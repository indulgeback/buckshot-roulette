/**
 * multiplayer.js — PeerJS WebRTC P2P connection manager
 */

const PEER_PREFIX = 'br-'; // short prefix to avoid PeerJS ID issues

const PEER_OPTIONS = {
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
        ]
    }
};

let peer = null;
let conn = null;
let hostRole = false;
let connected = false;
let destroyed = false;

let messageHandler = null;
let connectionChangeHandler = null;

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

function cleanup() {
    conn = null;
    peer = null;
    connected = false;
}

function setupConnection(connection) {
    console.log('[MP] setupConnection, open:', connection.open);

    if (connection.open) {
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
                console.error('[MP] Parse error:', e);
            }
        }
    });

    connection.on('close', () => {
        console.log('[MP] DataChannel closed');
        connected = false;
        if (connectionChangeHandler && !destroyed) connectionChangeHandler('disconnected');
    });

    connection.on('error', (err) => {
        console.error('[MP] DataChannel error:', err);
        connected = false;
    });
}

/** Create a room with retry on ID collision */
export function createRoom() {
    destroyed = false;
    hostRole = true;
    connected = false;

    return tryCreateRoom(0);
}

function tryCreateRoom(attempt) {
    return new Promise((resolve, reject) => {
        if (attempt >= 3) {
            reject(new Error('Failed to create room after 3 attempts'));
            return;
        }

        const code = generateRoomCode();
        const peerId = PEER_PREFIX + code;

        // Clean up previous peer if retrying
        if (peer) { try { peer.destroy(); } catch (e) { /* ignore */ } }

        peer = new Peer(peerId, PEER_OPTIONS);
        let settled = false;

        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                console.log('[MP] Host peer timeout, attempt', attempt);
                try { peer.destroy(); } catch (e) { /* ignore */ }
                cleanup();
                tryCreateRoom(attempt + 1).then(resolve).catch(reject);
            }
        }, 10000);

        peer.on('open', () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            console.log('[MP] Host peer OPEN, id:', peerId);
            resolve(code);
        });

        peer.on('connection', (connection) => {
            console.log('[MP] Host received connection');
            conn = connection;
            setupConnection(conn);
        });

        peer.on('error', (err) => {
            console.error('[MP] Host peer error:', err.type, err);
            if (settled) return;
            clearTimeout(timeout);
            if (err.type === 'unavailable-id') {
                // ID collision — retry with new code
                cleanup();
                tryCreateRoom(attempt + 1).then(resolve).catch(reject);
            } else {
                settled = true;
                cleanup();
                reject(err);
            }
        });

        peer.on('disconnected', () => {
            console.log('[MP] Host peer disconnected');
            connected = false;
            if (connectionChangeHandler && !destroyed) connectionChangeHandler('disconnected');
            // Try to reconnect
            if (peer && !destroyed) {
                try { peer.reconnect(); } catch (e) { /* ignore */ }
            }
        });
    });
}

/** Join an existing room by code */
export function joinRoom(code) {
    return new Promise((resolve, reject) => {
        destroyed = false;
        const cleanCode = code.trim().toUpperCase();
        if (!/^[A-HJ-NP-Z2-9]{6}$/.test(cleanCode)) {
            reject(new Error('Invalid room code'));
            return;
        }

        const targetId = PEER_PREFIX + cleanCode;
        hostRole = false;
        connected = false;

        // Clean up previous peer
        if (peer) { try { peer.destroy(); } catch (e) { /* ignore */ } }

        peer = new Peer(PEER_OPTIONS);
        let settled = false;

        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                console.log('[MP] Client connection timeout');
                try { peer.destroy(); } catch (e) { /* ignore */ }
                cleanup();
                reject(new Error('Connection timeout'));
            }
        }, 15000);

        peer.on('open', (myId) => {
            console.log('[MP] Client peer OPEN, id:', myId, '→ target:', targetId);
            conn = peer.connect(targetId, { serialization: 'json' });
            setupConnection(conn);

            // Wrap connectionChangeHandler to resolve promise
            const origHandler = connectionChangeHandler;
            connectionChangeHandler = (state) => {
                if (state === 'connected' && !settled) {
                    settled = true;
                    clearTimeout(timeout);
                    resolve();
                }
                if (origHandler) origHandler(state);
            };
        });

        peer.on('error', (err) => {
            console.error('[MP] Client peer error:', err.type, err);
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            cleanup();
            if (err.type === 'peer-unavailable') {
                reject(new Error('Room not found'));
            } else {
                reject(err);
            }
        });

        peer.on('disconnected', () => {
            console.log('[MP] Client peer disconnected');
            connected = false;
            if (connectionChangeHandler && !destroyed) connectionChangeHandler('disconnected');
            if (peer && !destroyed) {
                try { peer.reconnect(); } catch (e) { /* ignore */ }
            }
        });
    });
}

export function send(data) {
    if (conn && connected) {
        try {
            conn.send(data); // send as object (serialization: 'json')
        } catch (e) {
            console.error('[MP] Send error:', e);
        }
    }
}

export function onMessage(handler) {
    messageHandler = handler;
}

export function onConnectionChange(cb) {
    connectionChangeHandler = cb;
}

export function isConnected() {
    return connected;
}

export function isHost() {
    return hostRole;
}

export function disconnect() {
    destroyed = true;
    if (conn) { try { conn.close(); } catch (e) { /* ignore */ } }
    if (peer) { try { peer.destroy(); } catch (e) { /* ignore */ } }
    cleanup();
    hostRole = false;
    messageHandler = null;
    connectionChangeHandler = null;
}
