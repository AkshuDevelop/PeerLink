/**
 * ============================================================
 * FILE PURPOSE:
 *   Singleton Socket.IO client for PeerLink's frontend.
 *   Creates and manages the WebSocket connection to the Express
 *   + Socket.IO server, authenticated via JWT.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend — Real-time Communication Service (Singleton)
 *
 * CONNECTED MODULES:
 *   - Called by: TransferContext.tsx (subscribes to socket events)
 *   - Called by: AuthContext.tsx (creates socket on login, destroys on logout)
 *   - Talks to: server/src/socket/socketManager.ts
 *
 * WHY A SINGLETON:
 *   There should be exactly ONE Socket.IO connection per browser session.
 *   Multiple connections would multiply presence broadcasts and confuse
 *   the server's onlineUsers tracking. The singleton pattern ensures
 *   the same socket instance is shared across all React components.
 * ============================================================
 */

import { io, Socket } from 'socket.io-client';

/** The single global Socket.IO client instance */
let socket: Socket | null = null;

/**
 * getSocket — Returns the existing socket instance, or creates a new one.
 *
 * WHAT IT DOES:
 *   1. If a socket already exists and is connected, returns it immediately.
 *   2. If no socket exists, creates a new Socket.IO client with the JWT token
 *      in the handshake auth payload (required by socketManager.ts auth middleware).
 *   3. Configures transports to prefer WebSocket with polling fallback.
 *
 * CALLED BY: TransferContext.tsx on mount (after user is authenticated).
 *
 * WHY auth.token IN HANDSHAKE:
 *   Socket.IO's HTTP Authorization header support is unreliable across proxies.
 *   The handshake auth object is sent in the initial Socket.IO handshake request
 *   body, which is universally supported. The server reads it in io.use() middleware.
 *
 * @param token - The user's JWT (from AuthContext / localStorage)
 * @returns The Socket.IO client instance
 */
export function getSocket(token: string): Socket {
  // If socket exists and is connected, reuse it
  if (socket && socket.connected) {
    return socket;
  }

  // Disconnect any stale socket before creating a new one
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  // Create a new Socket.IO connection
  // The empty string '' means "connect to the same origin" —
  // in development this hits Vite's proxy, in production it hits Express directly.
  socket = io('', {
    auth: {
      token, // ← JWT sent in handshake auth object (read by socketManager.ts io.use())
    },
    transports: ['websocket', 'polling'], // Prefer WebSocket, fall back to long-polling
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('[Socket] ✅ Connected:', socket?.id);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] ❌ Connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] 🔌 Disconnected:', reason);
  });

  return socket;
}

/**
 * disconnectSocket — Cleanly disconnects the Socket.IO client.
 *
 * CALLED BY: AuthContext.tsx logout(), footer DISCONNECT ALL button.
 *
 * WHY THIS MATTERS:
 *   Calling disconnect() sends a disconnect packet to the server,
 *   which immediately triggers the server's disconnect handler to
 *   update presence maps and broadcast OFFLINE to contacts.
 *   Without this, the server must wait for a socket timeout.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('[Socket] 🛑 Manually disconnected');
  }
}

/**
 * emitSignal — Send a WebRTC signalling message to the target user.
 *
 * WHAT IT DOES:
 *   Emits a webrtc:signal event to the server, which validates and
 *   relays it to the target user's room.
 *
 * CALLED BY: webrtcService.ts (when sending SDP offer/answer or ICE candidates).
 */
export function emitSignal(payload: {
  transferId: string;
  targetUserId: string;
  type: 'SDP_OFFER' | 'SDP_ANSWER' | 'ICE_CANDIDATE';
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
}): void {
  if (!socket || !socket.connected) {
    console.error('[Socket] Cannot send signal — not connected');
    return;
  }
  socket.emit('webrtc:signal', payload);
}
