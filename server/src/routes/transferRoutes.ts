/**
 * ============================================================
 * FILE PURPOSE:
 *   Express router for file transfer session endpoints.
 *   Creates transfer offers, manages status lifecycle, records
 *   completion/integrity data, and provides history/logs.
 *   IMPORTANT: The backend stores ONLY metadata. File bytes
 *   NEVER pass through the server — they go directly peer-to-peer
 *   via WebRTC DataChannel.
 *
 * ARCHITECTURAL LAYER:
 *   Express Route Controller (REST API Layer)
 *
 * ENDPOINTS:
 *   POST   /api/transfers/request     — Create a transfer offer
 *   PATCH  /api/transfers/:id/respond — Accept or reject an offer
 *   PATCH  /api/transfers/:id/status  — Update transfer status (e.g. TRANSFERRING)
 *   POST   /api/transfers/:id/complete — Mark complete, record SHA-256 + speed
 *   GET    /api/transfers/history     — Paginated transfer history
 *   GET    /api/transfers/:id         — Get single transfer details
 *   DELETE /api/transfers/:id         — Delete a single transfer record
 *   DELETE /api/transfers/purge/all   — Delete all transfers for this user
 *
 * CONNECTED MODULES:
 *   - Uses: Transfer model, Contact model
 *   - Uses: stateMachine.ts (validateTransition)
 *   - Uses: authMiddleware
 *   - Calls socketManager via global io (for transfer:incoming_offer events)
 * ============================================================
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Transfer, generateSessionCode } from '../models/Transfer';
import { Contact } from '../models/Contact';
import { User } from '../models/User';
import { authMiddleware } from '../middleware/authMiddleware';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { validateTransition } from '../utils/stateMachine';

const router = Router();

// All transfer routes require authentication
router.use(authMiddleware);

/**
 * POST /api/transfers/request — Create a new file transfer offer.
 *
 * WHAT IT DOES:
 *   1. Validates that sender and recipient are ACCEPTED contacts.
 *   2. Validates file metadata (filename, sizeBytes, mimeType, senderSha256).
 *   3. Creates a Transfer document with status PENDING and 5-minute expiry.
 *   4. Emits transfer:incoming_offer to the recipient via Socket.IO so the
 *      incoming request modal pops up on their device immediately.
 *
 * CALLED BY: client/src/pages/SendFilePage.tsx TRANSMIT REQUEST button.
 *
 * WHY THIS MATTERS:
 *   The sender pre-computes the SHA-256 hash BEFORE sending the offer.
 *   This means when the receiver accepts and the transfer completes,
 *   they can verify bit-for-bit integrity without any server involvement.
 */
router.post('/request', asyncHandler(async (req: Request, res: Response) => {
  const {
    recipientId,
    filename,
    sizeBytes,
    mimeType,
    totalChunks,
    senderSha256,
  } = req.body;

  // --- Input validation ---
  if (!recipientId || !filename || !sizeBytes || !totalChunks || !senderSha256) {
    throw new AppError('MISSING REQUIRED FIELDS: recipientId, filename, sizeBytes, totalChunks, senderSha256', 400);
  }

  if (!/^[a-f0-9]{64}$/i.test(senderSha256)) {
    throw new AppError('INVALID senderSha256: Must be a valid 64-character SHA-256 hexadecimal string', 400);
  }

  const senderId = new mongoose.Types.ObjectId(req.user!.userId);
  const targetId = new mongoose.Types.ObjectId(recipientId);

  // --- Verify sender and recipient are ACCEPTED contacts ---
  const contact = await Contact.findOne({
    $or: [
      { requester: senderId, recipient: targetId },
      { requester: targetId, recipient: senderId },
    ],
    status: 'ACCEPTED',
  });

  if (!contact) {
    throw new AppError('TRANSFER FORBIDDEN: NOT ACCEPTED CONTACTS', 403);
  }

  // --- Generate a unique session code (retry if collision) ---
  let sessionCode = '';
  for (let i = 0; i < 10; i++) {
    sessionCode = generateSessionCode();
    const existing = await Transfer.findOne({ sessionCode });
    if (!existing) break;
  }

  // --- Create the Transfer document ---
  const transfer = await Transfer.create({
    sessionCode,
    sender: senderId,
    recipient: targetId,
    filename: String(filename).trim(),
    sizeBytes: Number(sizeBytes),
    mimeType: mimeType ?? 'application/octet-stream',
    totalChunks: Number(totalChunks),
    senderSha256: String(senderSha256).toLowerCase(),
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5-minute offer window
  });

  // --- Notify the recipient in real time via Socket.IO ---
  const io = req.app.get('io');
  if (io) {
    const senderUser = await User.findById(senderId);
    io.to(`user:${targetId.toString()}`).emit('transfer:incoming_offer', {
      transferId: transfer._id.toString(),
      sessionCode: transfer.sessionCode,
      sender: {
        id: senderId.toString(),
        handle: senderUser?.handle,
        avatar: senderUser?.avatar,
        nodeId: senderUser?.nodeId,
      },
      filename: transfer.filename,
      sizeBytes: transfer.sizeBytes,
      mimeType: transfer.mimeType,
      totalChunks: transfer.totalChunks,
      senderSha256: transfer.senderSha256,
    });
  }

  res.status(201).json({
    transfer: {
      id: transfer._id.toString(),
      sessionCode: transfer.sessionCode,
      status: transfer.status,
      expiresAt: transfer.expiresAt,
    },
  });
}));

/**
 * PATCH /api/transfers/:id/respond — Accept or reject a transfer offer.
 *
 * WHAT IT DOES:
 *   1. Finds the Transfer by MongoDB _id or sessionCode.
 *   2. Verifies the current user is the RECIPIENT.
 *   3. Validates state transition (PENDING → ACCEPTED or REJECTED).
 *   4. Notifies the SENDER via Socket.IO so their UI transitions to
 *      the WebRTC negotiation phase.
 *
 * CALLED BY: client/src/components/IncomingRequestModal.tsx
 *            ACCEPT & STREAM / REJECT buttons.
 */
router.patch('/:id/respond', asyncHandler(async (req: Request, res: Response) => {
  let rawAction = req.body.action || req.body.decision;
  if (rawAction === 'ACCEPT') rawAction = 'ACCEPTED';
  if (rawAction === 'REJECT') rawAction = 'REJECTED';
  const action = rawAction;
  const myId = new mongoose.Types.ObjectId(req.user!.userId);

  if (!['ACCEPTED', 'REJECTED'].includes(action)) {
    throw new AppError('ACTION MUST BE ACCEPTED OR REJECTED', 400);
  }

  // Find by MongoDB _id OR sessionCode (UI may use either)
  const transfer = await Transfer.findOne({
    $or: [
      { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null },
      { sessionCode: req.params.id },
    ],
  });

  if (!transfer) {
    throw new AppError('TRANSFER NOT FOUND', 404);
  }

  // Only the recipient can respond
  if (!transfer.recipient.equals(myId)) {
    throw new AppError('FORBIDDEN: YOU ARE NOT THE RECIPIENT', 403);
  }

  // Validate state machine transition
  if (!validateTransition(transfer.status, action as 'ACCEPTED' | 'REJECTED')) {
    throw new AppError(`INVALID TRANSITION: ${transfer.status} → ${action}`, 400);
  }

  transfer.status = action as 'ACCEPTED' | 'REJECTED';
  if (action === 'REJECTED') {
    transfer.completedAt = new Date();
    transfer.failureReason = 'RECIPIENT REJECTED THE OFFER';
  }
  await transfer.save();

  // Notify the sender via Socket.IO
  const io = req.app.get('io');
  if (io) {
    const payload = {
      transferId: transfer._id.toString(),
      sessionCode: transfer.sessionCode,
      status: transfer.status,
    };
    io.to(`user:${transfer.sender.toString()}`).emit('transfer:response', payload);
  }

  res.json({
    transfer: {
      id: transfer._id.toString(),
      sessionCode: transfer.sessionCode,
      status: transfer.status,
    },
  });
}));

/**
 * PATCH /api/transfers/:id/status — Update transfer status (e.g., to TRANSFERRING).
 *
 * WHAT IT DOES:
 *   Updates the transfer status after the WebRTC DataChannel opens.
 *   The sender calls this when the first data chunk is sent.
 *   Also accepts conduitType update (DIRECT_SCTP or TURN_RELAY) which
 *   is determined by inspecting RTCIceCandidatePair stats after connection.
 *
 * CALLED BY: client/src/services/fileTransferService.ts when dc.onopen fires.
 */
router.patch('/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const { status, conduitType } = req.body;
  const myId = new mongoose.Types.ObjectId(req.user!.userId);

  const transfer = await Transfer.findOne({
    $or: [
      { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null },
      { sessionCode: req.params.id },
    ],
  });

  if (!transfer) {
    throw new AppError('TRANSFER NOT FOUND', 404);
  }

  // Both sender and recipient can update status (e.g., cancel from either side)
  if (!transfer.sender.equals(myId) && !transfer.recipient.equals(myId)) {
    throw new AppError('FORBIDDEN: NOT A PARTICIPANT IN THIS TRANSFER', 403);
  }

  // Validate state transition
  if (!validateTransition(transfer.status, status)) {
    throw new AppError(`INVALID TRANSITION: ${transfer.status} → ${status}`, 400);
  }

  transfer.status = status;
  if (conduitType) {
    transfer.conduitType = conduitType;
  }
  await transfer.save();

  res.json({
    transfer: {
      id: transfer._id.toString(),
      sessionCode: transfer.sessionCode,
      status: transfer.status,
      conduitType: transfer.conduitType,
    },
  });
}));

/**
 * POST /api/transfers/:id/complete — Record transfer completion with integrity data.
 *
 * WHAT IT DOES:
 *   1. Transitions status TRANSFERRING → COMPLETED.
 *   2. Records the receiver's SHA-256 hash.
 *   3. Verifies integrity: sets integrityVerified = (senderSha256 === receiverSha256).
 *   4. Records average speed and completedAt timestamp.
 *   5. Notifies both parties via Socket.IO.
 *
 * CALLED BY: client/src/services/fileTransferService.ts after RECEIVER_VERIFIED
 *            DataChannel message is received by the sender.
 */
router.post('/:id/complete', asyncHandler(async (req: Request, res: Response) => {
  const { receiverSha256, averageSpeedMBps, conduitType } = req.body;
  const myId = new mongoose.Types.ObjectId(req.user!.userId);

  const transfer = await Transfer.findOne({
    $or: [
      { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null },
      { sessionCode: req.params.id },
    ],
  });

  if (!transfer) {
    throw new AppError('TRANSFER NOT FOUND', 404);
  }

  // Both sender and recipient can call this (receiver reports SHA-256)
  if (!transfer.sender.equals(myId) && !transfer.recipient.equals(myId)) {
    throw new AppError('FORBIDDEN: NOT A PARTICIPANT IN THIS TRANSFER', 403);
  }

  if (!validateTransition(transfer.status, 'COMPLETED')) {
    throw new AppError(`INVALID TRANSITION: ${transfer.status} → COMPLETED`, 400);
  }

  // Record integrity verification
  if (receiverSha256) {
    transfer.receiverSha256 = String(receiverSha256).toLowerCase();
    transfer.integrityVerified = (transfer.senderSha256 === transfer.receiverSha256);
  }

  transfer.status = 'COMPLETED';
  transfer.completedAt = new Date();
  transfer.averageSpeedMBps = averageSpeedMBps ? Number(averageSpeedMBps) : 0;
  if (conduitType) {
    transfer.conduitType = conduitType;
  }

  await transfer.save();

  // Notify both parties
  const io = req.app.get('io');
  if (io) {
    const payload = {
      transferId: transfer._id.toString(),
      sessionCode: transfer.sessionCode,
      status: 'COMPLETED',
      integrityVerified: transfer.integrityVerified,
      receiverSha256: transfer.receiverSha256,
      senderSha256: transfer.senderSha256,
    };
    io.to(`user:${transfer.sender.toString()}`).emit('transfer:completed', payload);
    io.to(`user:${transfer.recipient.toString()}`).emit('transfer:completed', payload);
  }

  res.json({
    transfer: {
      id: transfer._id.toString(),
      sessionCode: transfer.sessionCode,
      status: transfer.status,
      integrityVerified: transfer.integrityVerified,
      senderSha256: transfer.senderSha256,
      receiverSha256: transfer.receiverSha256,
      averageSpeedMBps: transfer.averageSpeedMBps,
    },
  });
}));

/**
 * GET /api/transfers/history — Paginated list of the user's transfers.
 *
 * WHAT IT DOES:
 *   Returns transfers where the current user is sender or recipient,
 *   sorted by most recent, with populated user details.
 *
 * CALLED BY: client/src/pages/DashboardPage.tsx (recent transfers table)
 *            client/src/pages/LogsPage.tsx (full history table).
 *
 * Query params: ?page=1&limit=20&status=COMPLETED&dir=OUTGOING
 */
router.get('/history', asyncHandler(async (req: Request, res: Response) => {
  const myId = new mongoose.Types.ObjectId(req.user!.userId);
  const page = Math.max(1, parseInt(String(req.query.page ?? '1')));
  const limit = Math.min(100, parseInt(String(req.query.limit ?? '20')));
  const skip = (page - 1) * limit;

  const { status, dir } = req.query;

  // Build filter
  const baseQuery: mongoose.FilterQuery<typeof Transfer> = {
    $or: [{ sender: myId }, { recipient: myId }],
  };

  if (status) {
    baseQuery.status = String(status).toUpperCase();
  }

  // Filter by direction: OUTGOING = I am sender, INCOMING = I am recipient
  if (dir === 'OUTGOING') {
    delete baseQuery.$or;
    baseQuery.sender = myId;
  } else if (dir === 'INCOMING') {
    delete baseQuery.$or;
    baseQuery.recipient = myId;
  }

  const [transfers, total] = await Promise.all([
    Transfer.find(baseQuery)
      .populate('sender', 'handle avatar nodeId')
      .populate('recipient', 'handle avatar nodeId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Transfer.countDocuments(baseQuery),
  ]);

  res.json({
    transfers,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}));

/**
 * GET /api/transfers/:id — Get a single transfer by _id or sessionCode.
 *
 * CALLED BY: client/src/pages/TransferDetailsPage.tsx,
 *            client/src/pages/ActiveTransferPage.tsx
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const myId = new mongoose.Types.ObjectId(req.user!.userId);

  const transfer = await Transfer.findOne({
    $or: [
      { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null },
      { sessionCode: req.params.id },
    ],
  })
    .populate('sender', 'handle avatar nodeId')
    .populate('recipient', 'handle avatar nodeId');

  if (!transfer) {
    throw new AppError('TRANSFER NOT FOUND', 404);
  }

  // Only participants can view transfer details
  if (!transfer.sender._id.equals(myId) && !transfer.recipient._id.equals(myId)) {
    throw new AppError('FORBIDDEN: NOT A PARTICIPANT IN THIS TRANSFER', 403);
  }

  res.json({ transfer });
}));

/**
 * DELETE /api/transfers/:id — Delete a single transfer record.
 *
 * CALLED BY: client/src/pages/LogsPage.tsx ✕ (PURGE) button per row.
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  // Must NOT match /purge/all — Express handles route order correctly
  if (req.params.id === 'purge') {
    return; // Handled by the route below
  }

  const myId = new mongoose.Types.ObjectId(req.user!.userId);

  const transfer = await Transfer.findOne({
    $or: [
      { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null },
      { sessionCode: req.params.id },
    ],
  });

  if (!transfer) {
    throw new AppError('TRANSFER NOT FOUND', 404);
  }

  if (!transfer.sender.equals(myId) && !transfer.recipient.equals(myId)) {
    throw new AppError('FORBIDDEN: NOT A PARTICIPANT IN THIS TRANSFER', 403);
  }

  await transfer.deleteOne();
  res.json({ success: true, deleted: req.params.id });
}));

/**
 * DELETE /api/transfers/purge/all — Delete ALL transfers for the current user.
 *
 * WHAT IT DOES:
 *   Removes all Transfer documents where the current user is sender or recipient.
 *
 * CALLED BY: client/src/pages/SettingsPage.tsx PURGE EVERYTHING button.
 *
 * WHY THE ROUTE IS /purge/all (not /purge-all):
 *   Express router registers routes in order. The /:id route would catch
 *   "/purge-all" as id="purge-all". Placing this BEFORE /:id or using
 *   a distinct path segment avoids the collision.
 */
router.delete('/purge/all', asyncHandler(async (req: Request, res: Response) => {
  const myId = new mongoose.Types.ObjectId(req.user!.userId);

  const result = await Transfer.deleteMany({
    $or: [{ sender: myId }, { recipient: myId }],
  });

  res.json({ success: true, deleted: result.deletedCount });
}));

export default router;
