/**
 * ============================================================
 * FILE PURPOSE:
 *   Authenticated Socket.IO server for PeerLink's real-time layer.
 *   Handles: JWT authentication at connection time, user presence
 *   management (ONLINE / BUSY / OFFLINE), WebRTC SDP/ICE signalling
 *   relay, transfer cancel events, and peer RTT ping/pong.
 *
 *   CRITICAL: The backend NEVER receives or forwards file bytes.
 *   It only relays small JSON signalling messages (SDP offers/answers
 *   and ICE candidates) to bootstrap the WebRTC connection. Once the
 *   RTCPeerConnection is established, all data flows directly
 *   peer-to-peer via DTLS-encrypted SCTP DataChannels.
 *
 * ARCHITECTURAL LAYER:
 *   WebSocket / Real-time Signalling Layer (Socket.IO server-side)
 *
 * CONNECTED MODULES:
 *   - Called by: server/src/index.ts (passes `io` instance here)
 *   - Calls out to: Contact model (presence broadcasting)
 *   - Calls out to: Transfer model (cancel validation)
 * ============================================================
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Contact } from '../models/Contact';
import { Transfer } from '../models/Transfer';
import { validateTransition } from '../utils/stateMachine';
import { AuthPayload } from '../middleware/authMiddleware';

/**
 * onlineUsers — Maps userId → Set of active socketIds.
 * A user may be connected from multiple browser tabs/devices simultaneously.
 * We track all socket IDs per user so presence broadcasts reach all tabs.
 */
const onlineUsers = new Map<string, Set<string>>();

/**
 * busyUsers — Set of userIds currently in an active file transfer (TRANSFERRING).
 * Used to broadcast BUSY status to contacts instead of ONLINE.
 */
const busyUsers = new Set<string>();

/**
 * initSocketManager — Configures all Socket.IO middleware and event handlers.
 *
 * WHAT IT DOES:
 *   1. Installs JWT authentication middleware (`io.use`).
 *   2. Handles `connection` event: joins user room, updates presence, registers events.
 *   3. Handles `disconnect`: removes from presence maps, broadcasts OFFLINE.
 *   4. Relays WebRTC signalling events (SDP offer/answer, ICE candidates).
 *   5. Handles transfer cancel requests.
 *   6. Handles peer RTT ping/pong for latency measurement.
 *
 * CALLED BY: server/src/index.ts (called once at server startup with the io instance).
 *
 * @param io — The Socket.IO Server instance
 */
export function initSocketManager(io: SocketIOServer): void {

  // ================================================================
  // 1. JWT Authentication Middleware
  // ================================================================
  /**
   * This middleware runs before every connection is established.
   * It reads the JWT from socket.handshake.auth.token (sent by the client's
   * socketService.ts when creating the socket connection).
   *
   * WHY io.use() AND NOT A ROUTE MIDDLEWARE:
   *   Socket.IO connections are not HTTP requests — they're WebSocket upgrades.
   *   The standard Express authMiddleware doesn't apply here. We must use
   *   Socket.IO's own middleware system.
   */
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('UNAUTHORIZED: Missing JWT token in socket handshake auth'));
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return next(new Error('SERVER ERROR: JWT_SECRET not configured'));
    }

    try {
      const decoded = jwt.verify(token, secret) as AuthPayload;
      // Attach user data to socket for use in event handlers
      socket.data.userId = decoded.userId;
      socket.data.handle = decoded.handle;
      next();
    } catch {
      next(new Error('UNAUTHORIZED: Invalid or expired JWT'));
    }
  });

  // ================================================================
  // 2. Connection Handler
  // ================================================================
  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId as string;
    const handle = socket.data.handle as string;

    console.log(`[Socket] CONNECT: @${handle} (${userId}) [${socket.id}]`);

    // ── Join the user's private room ──────────────────────────────
    // All targeted events are emitted to `user:${userId}` room.
    // This allows emitting to all tabs of the same user at once.
    await socket.join(`user:${userId}`);

    // ── Update presence map ───────────────────────────────────────
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // ── Broadcast ONLINE to accepted contacts ─────────────────────
    await broadcastPresenceToContacts(io, userId, handle, 'ONLINE');

    // ================================================================
    // 3. Disconnect Handler
    // ================================================================
    socket.on('disconnect', async (reason) => {
      console.log(`[Socket] DISCONNECT: @${handle} (${userId}) [${socket.id}] — ${reason}`);

      // Remove this specific socket from the user's set
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        // Only broadcast OFFLINE if ALL sockets for this user are gone
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          busyUsers.delete(userId);
          await broadcastPresenceToContacts(io, userId, handle, 'OFFLINE');
        }
      }
    });

    // ================================================================
    // 4. WebRTC Signalling Relay — webrtc:signal & webrtc:receiver_ready
    // ================================================================
    /**
     * webrtc:receiver_ready — Receiver notifies sender that its RTCPeerConnection
     * is created and ondatachannel is hooked up.
     * Prevents timing race where sender creates DataChannel & SDP_OFFER before
     * receiver's page has mounted and set up listeners!
     */
    socket.on('webrtc:receiver_ready', async (payload: { transferId: string; senderId: string }) => {
      try {
        const { transferId, senderId } = payload;
        io.to(`user:${senderId}`).emit('webrtc:receiver_ready', {
          transferId,
          receiverId: userId,
        });
      } catch (err) {
        console.error('[Socket] webrtc:receiver_ready error:', err);
      }
    });

    /**
     * webrtc:signal — Relays SDP offers, SDP answers, and ICE candidates
     * between sender and receiver. The backend acts as a "post office":
     * it validates the participants and routes the message to the target.
     *
     * WHAT IT DOES:
     *   1. Validates that the Transfer exists and is in ACCEPTED or TRANSFERRING state.
     *   2. Verifies the socket's userId is one of the transfer participants.
     *   3. Emits the signal to the target user's room.
     *
     * CALLED BY: client/src/services/webrtcService.ts (sendSignal function).
     *
     * WHY WE VALIDATE THE TRANSFER STATUS:
     *   Without this check, any authenticated user could relay arbitrary WebRTC
     *   data to any other user by guessing a transferId. The check ensures
     *   signalling only flows for active, consented transfers.
     */
    socket.on('webrtc:signal', async (payload: {
      transferId: string;
      targetUserId: string;
      type: 'SDP_OFFER' | 'SDP_ANSWER' | 'ICE_CANDIDATE';
      data: unknown;
    }) => {
      try {
        const { transferId, targetUserId, type, data } = payload;

        // Validate the transfer exists and is active
        const transfer = await Transfer.findOne({
          $or: [
            { _id: mongoose.isValidObjectId(transferId) ? transferId : null },
            { sessionCode: transferId },
          ],
        });

        if (!transfer) {
          socket.emit('error', { message: 'SIGNAL REJECTED: Transfer not found' });
          return;
        }

        // Verify the socket user is a participant (sender or recipient)
        const isParticipant =
          transfer.sender.toString() === userId ||
          transfer.recipient.toString() === userId;

        if (!isParticipant) {
          socket.emit('error', { message: 'SIGNAL REJECTED: Not a participant' });
          return;
        }

        // Relay the signal to the target user's room
        io.to(`user:${targetUserId}`).emit('webrtc:signal', {
          transferId,
          fromUserId: userId,
          type,
          data,
        });

      } catch (err) {
        console.error('[Socket] webrtc:signal error:', err);
      }
    });

    // ================================================================
    // 5. Transfer Progress Sync (optional telemetry)
    // ================================================================
    /**
     * transfer:progress_sync — Optional lightweight telemetry sync.
     * The sender throttles this to once per 500ms so both devices show
     * synchronized progress. The receiver's side can also compute
     * progress from DataChannel byte counts directly.
     */
    socket.on('transfer:progress_sync', (payload: {
      transferId: string;
      targetUserId: string;
      percent: number;
      transferredBytes: number;
      speedMBps: number;
    }) => {
      const { targetUserId, ...rest } = payload;
      io.to(`user:${targetUserId}`).emit('transfer:progress_sync', {
        ...rest,
        fromUserId: userId,
      });
    });

    // ================================================================
    // 5b. Transfer Chunk & Control Relay Fallback (100% Reliable Delivery)
    // ================================================================
    /**
     * transfer:chunk — Relays 64 KB binary frames when direct WebRTC DataChannel
     * cannot connect (e.g. mobile carrier NAT, AP isolation on Wi-Fi, symmetric NAT).
     */
    socket.on('transfer:chunk', (payload: {
      transferId: string;
      targetUserId: string;
      frame: unknown;
    }) => {
      try {
        io.to(`user:${payload.targetUserId}`).emit('transfer:chunk', {
          transferId: payload.transferId,
          fromUserId: userId,
          frame: payload.frame,
        });
      } catch (err) {
        console.error('[Socket] transfer:chunk error:', err);
      }
    });

    /**
     * transfer:chunk_ack — Relays slice acknowledgment back to sender for
     * backpressure flow control (prevents buffer bloat and connection freezing).
     */
    socket.on('transfer:chunk_ack', (payload: {
      transferId: string;
      targetUserId: string;
      seq: number;
    }) => {
      try {
        io.to(`user:${payload.targetUserId}`).emit('transfer:chunk_ack', {
          transferId: payload.transferId,
          fromUserId: userId,
          seq: payload.seq,
        });
      } catch (err) {
        console.error('[Socket] transfer:chunk_ack error:', err);
      }
    });

    /**
     * transfer:control — Relays control messages (FILE_HEADER, EOF, RECEIVER_ACK_COMPLETE)
     * between sender and receiver.
     */
    socket.on('transfer:control', (payload: {
      transferId: string;
      targetUserId: string;
      message: unknown;
    }) => {
      try {
        io.to(`user:${payload.targetUserId}`).emit('transfer:control', {
          transferId: payload.transferId,
          fromUserId: userId,
          message: payload.message,
        });
      } catch (err) {
        console.error('[Socket] transfer:control error:', err);
      }
    });

    // ================================================================
    // 6. Transfer Cancel
    // ================================================================
    /**
     * transfer:cancel — Either participant can cancel an active transfer.
     *
     * WHAT IT DOES:
     *   1. Finds the transfer and validates participant.
     *   2. Transitions status to CANCELLED (via state machine validation).
     *   3. Saves to MongoDB.
     *   4. Emits transfer:cancelled to both participant rooms.
     *
     * CALLED BY: client/src/pages/ActiveTransferPage.tsx CANCEL button,
     *            and client/src/services/fileTransferService.ts on network error.
     */
    socket.on('transfer:cancel', async (payload: { transferId: string; reason?: string }) => {
      try {
        const { transferId, reason } = payload;

        const transfer = await Transfer.findOne({
          $or: [
            { _id: mongoose.isValidObjectId(transferId) ? transferId : null },
            { sessionCode: transferId },
          ],
        });

        if (!transfer) return;

        const isParticipant =
          transfer.sender.toString() === userId ||
          transfer.recipient.toString() === userId;

        if (!isParticipant) return;

        // Validate transition (can cancel from ACCEPTED or TRANSFERRING)
        if (!validateTransition(transfer.status, 'CANCELLED')) return;

        transfer.status = 'CANCELLED';
        transfer.completedAt = new Date();
        transfer.failureReason = reason ?? `CANCELLED BY @${handle}`;
        await transfer.save();

        // Notify both participants
        const cancelPayload = {
          transferId: transfer._id.toString(),
          sessionCode: transfer.sessionCode,
          status: 'CANCELLED',
          cancelledBy: handle,
          reason: transfer.failureReason,
        };
        io.to(`user:${transfer.sender.toString()}`).emit('transfer:cancelled', cancelPayload);
        io.to(`user:${transfer.recipient.toString()}`).emit('transfer:cancelled', cancelPayload);

      } catch (err) {
        console.error('[Socket] transfer:cancel error:', err);
      }
    });

    // ================================================================
    // 7. Peer RTT Ping / Pong (live latency measurement)
    // ================================================================
    /**
     * peer:ping_request — The caller sends a ping to measure RTT to a peer.
     * The server relays it to the target, who replies with peer:ping_response.
     * The original caller measures the elapsed time for real latency display.
     *
     * CALLED BY: client/src/pages/PeersPage.tsx (contact cards latency display).
     */
    socket.on('peer:ping_request', (payload: { targetUserId: string; timestamp: number }) => {
      io.to(`user:${payload.targetUserId}`).emit('peer:ping_request', {
        fromUserId: userId,
        timestamp: payload.timestamp,
      });
    });

    socket.on('peer:ping_response', (payload: { targetUserId: string; timestamp: number }) => {
      io.to(`user:${payload.targetUserId}`).emit('peer:ping_response', {
        fromUserId: userId,
        timestamp: payload.timestamp,
      });
    });

    // ================================================================
    // 8. Busy Status Update (called by client during active transfer)
    // ================================================================
    /**
     * transfer:busy_update — Client sets their busy state when TRANSFERRING begins.
     * Server updates busyUsers set and re-broadcasts presence to contacts.
     */
    socket.on('transfer:busy_update', async (payload: { busy: boolean }) => {
      if (payload.busy) {
        busyUsers.add(userId);
      } else {
        busyUsers.delete(userId);
      }
      const status = payload.busy ? 'BUSY' : 'ONLINE';
      await broadcastPresenceToContacts(io, userId, handle, status);
    });
  });
}

/**
 * broadcastPresenceToContacts — Emits a peer:presence_update event to all
 * ACCEPTED contacts of the given userId.
 *
 * WHAT IT DOES:
 *   1. Queries all ACCEPTED Contact documents where userId is requester or recipient.
 *   2. For each contact, finds the other participant's userId.
 *   3. Emits peer:presence_update to that user's Socket.IO room.
 *
 * CALLED BY: connection and disconnect handlers in this file.
 *
 * WHY THIS MATTERS:
 *   Real-time presence (online/offline dots on peer cards) requires the server
 *   to push updates. We can't poll from the client efficiently for dozens of peers.
 *   This fan-out approach pushes to all contacts simultaneously.
 *
 * @param io     — The Socket.IO Server instance
 * @param userId — The user whose presence changed
 * @param handle — Their display handle
 * @param status — 'ONLINE', 'BUSY', or 'OFFLINE'
 */
async function broadcastPresenceToContacts(
  io: SocketIOServer,
  userId: string,
  handle: string,
  status: 'ONLINE' | 'BUSY' | 'OFFLINE'
): Promise<void> {
  try {
    const myId = new mongoose.Types.ObjectId(userId);

    // Find all ACCEPTED contacts of this user
    const contacts = await Contact.find({
      $or: [{ requester: myId }, { recipient: myId }],
      status: 'ACCEPTED',
    });

    // For each contact, determine the OTHER person's userId and notify them
    for (const contact of contacts) {
      const otherUserId = contact.requester.equals(myId)
        ? contact.recipient.toString()
        : contact.requester.toString();

      io.to(`user:${otherUserId}`).emit('peer:presence_update', {
        userId,
        handle,
        status,
      });
    }
  } catch (err) {
    console.error('[Socket] broadcastPresenceToContacts error:', err);
  }
}
