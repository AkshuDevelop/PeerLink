/**
 * ============================================================
 * FILE PURPOSE:
 *   Express router for contact/peer management endpoints.
 *   Handles looking up users by handle, sending contact requests,
 *   accepting/rejecting requests, blocking/unblocking peers,
 *   and the 6-digit instant PIN pairing feature.
 *
 * ARCHITECTURAL LAYER:
 *   Express Route Controller (REST API Layer)
 *
 * ENDPOINTS:
 *   GET    /api/contacts/lookup?handle=X     — Find user by exact handle
 *   GET    /api/contacts                     — List all contacts (by status)
 *   POST   /api/contacts/request             — Send contact request
 *   PATCH  /api/contacts/:id/respond         — Accept or reject request
 *   POST   /api/contacts/:id/block           — Block a contact
 *   DELETE /api/contacts/:id/block           — Unblock a contact
 *   POST   /api/contacts/pair-pin/generate   — Generate 6-digit PIN
 *   POST   /api/contacts/pair-pin/redeem     — Redeem a PIN to pair instantly
 *
 * CONNECTED MODULES:
 *   - Uses: Contact model, User model, PairPin model
 *   - Uses: authMiddleware (all routes protected)
 *   - Calls socketManager via global io (for contact:updated events)
 * ============================================================
 */

import { Router, Request, Response } from 'express';
import { Contact } from '../models/Contact';
import { User } from '../models/User';
import { PairPin, generatePairPin } from '../models/PairPin';
import { authMiddleware } from '../middleware/authMiddleware';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import mongoose from 'mongoose';

const router = Router();

// All contact routes require authentication
router.use(authMiddleware);

/**
 * GET /api/contacts/lookup?handle=X — Find a user by their exact handle.
 *
 * WHAT IT DOES:
 *   Searches the User collection for the exact handle (case-insensitive).
 *   Returns the user's public profile (nodeId, handle, avatar) if found.
 *   This is NOT a search/autocomplete — it requires the exact handle.
 *   The caller must NOT be the user themselves.
 *
 * CALLED BY: client/src/pages/AddPeerPage.tsx RESOLVE button.
 */
router.get('/lookup', asyncHandler(async (req: Request, res: Response) => {
  const { handle } = req.query;

  if (!handle || typeof handle !== 'string') {
    throw new AppError('HANDLE QUERY PARAMETER REQUIRED', 400);
  }

  const normalized = handle.toLowerCase().trim();

  // Cannot look yourself up
  const callerUser = await User.findById(req.user!.userId);
  if (callerUser && callerUser.handle === normalized) {
    throw new AppError('CANNOT ADD YOURSELF AS A PEER', 400);
  }

  const targetUser = await User.findOne({ handle: normalized });

  if (!targetUser) {
    throw new AppError(`HANDLE @${normalized} NOT FOUND`, 404);
  }

  // Check existing contact status between caller and target
  const myId = new mongoose.Types.ObjectId(req.user!.userId);
  const targetId = targetUser._id;

  const existingContact = await Contact.findOne({
    $or: [
      { requester: myId, recipient: targetId },
      { requester: targetId, recipient: myId },
    ],
  });

  res.json({
    user: {
      id: targetUser._id.toString(),
      nodeId: targetUser.nodeId,
      handle: targetUser.handle,
      avatar: targetUser.avatar,
    },
    contactStatus: existingContact?.status ?? null,
    contactId: existingContact?._id.toString() ?? null,
  });
}));

/**
 * GET /api/contacts — List the authenticated user's contacts filtered by status.
 *
 * WHAT IT DOES:
 *   Returns all Contact documents where the current user is either the
 *   requester or recipient, optionally filtered by status query param.
 *   Populates user details for both requester and recipient.
 *
 * CALLED BY: client/src/pages/PeersPage.tsx (all 4 tabs) and DashboardPage.tsx.
 *
 * Query params:
 *   ?status=ACCEPTED|PENDING|BLOCKED|REJECTED (optional, defaults to all)
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const myId = new mongoose.Types.ObjectId(req.user!.userId);
  const { status } = req.query;

  // Build the query: find contacts where I am requester or recipient
  const query: mongoose.FilterQuery<typeof Contact> = {
    $or: [{ requester: myId }, { recipient: myId }],
  };

  if (status && typeof status === 'string') {
    query.status = status.toUpperCase();
  }

  const contacts = await Contact.find(query)
    .populate('requester', 'nodeId handle avatar email')
    .populate('recipient', 'nodeId handle avatar email')
    .sort({ updatedAt: -1 });

  res.json({ contacts });
}));

/**
 * POST /api/contacts/request — Send a contact request to another user.
 *
 * WHAT IT DOES:
 *   1. Validates that the target user exists (by userId in body).
 *   2. Checks for existing contact relationships to prevent duplicates.
 *   3. Creates a new Contact document with status PENDING.
 *   4. Emits a socket event to notify the target user in real time.
 *
 * CALLED BY: client/src/pages/AddPeerPage.tsx SEND REQUEST button.
 */
router.post('/request', asyncHandler(async (req: Request, res: Response) => {
  const { recipientId } = req.body;

  if (!recipientId) {
    throw new AppError('RECIPIENT_ID REQUIRED', 400);
  }

  const myId = new mongoose.Types.ObjectId(req.user!.userId);
  const targetId = new mongoose.Types.ObjectId(recipientId);

  // Cannot send request to yourself
  if (myId.equals(targetId)) {
    throw new AppError('CANNOT SEND CONTACT REQUEST TO YOURSELF', 400);
  }

  // Verify target user exists
  const targetUser = await User.findById(targetId);
  if (!targetUser) {
    throw new AppError('TARGET USER NOT FOUND', 404);
  }

  // Check for existing contact (in either direction)
  const existing = await Contact.findOne({
    $or: [
      { requester: myId, recipient: targetId },
      { requester: targetId, recipient: myId },
    ],
  });

  if (existing) {
    if (existing.status === 'BLOCKED') {
      throw new AppError('CONTACT BLOCKED — CANNOT SEND REQUEST', 403);
    }
    if (existing.status === 'ACCEPTED') {
      throw new AppError('ALREADY CONNECTED WITH THIS PEER', 409);
    }
    if (existing.status === 'PENDING') {
      throw new AppError('CONTACT REQUEST ALREADY PENDING', 409);
    }
  }

  // Create the contact request
  const contact = await Contact.create({
    requester: myId,
    recipient: targetId,
    status: 'PENDING',
  });

  // Notify the target user via Socket.IO if they are online
  // We access the global io instance attached to the Express app
  const io = req.app.get('io');
  if (io) {
    const myUser = await User.findById(myId);
    io.to(`user:${targetId.toString()}`).emit('contact:request', {
      contactId: contact._id.toString(),
      from: {
        id: myId.toString(),
        handle: myUser?.handle,
        avatar: myUser?.avatar,
        nodeId: myUser?.nodeId,
      },
    });
  }

  res.status(201).json({
    contact: {
      id: contact._id.toString(),
      status: contact.status,
      recipientId: targetId.toString(),
      recipientHandle: targetUser.handle,
    },
  });
}));

/**
 * PATCH /api/contacts/:id/respond — Accept or reject an incoming contact request.
 *
 * WHAT IT DOES:
 *   1. Finds the Contact by ID, verifies the current user is the RECIPIENT.
 *   2. Validates the action is "ACCEPTED" or "REJECTED".
 *   3. Updates the contact status.
 *   4. Notifies both parties via Socket.IO.
 *
 * CALLED BY: client/src/pages/PeersPage.tsx ACCEPT/REJECT buttons.
 */
router.patch('/:id/respond', asyncHandler(async (req: Request, res: Response) => {
  const { action } = req.body; // 'ACCEPTED' or 'REJECTED'
  const myId = new mongoose.Types.ObjectId(req.user!.userId);

  if (!['ACCEPTED', 'REJECTED'].includes(action)) {
    throw new AppError('ACTION MUST BE ACCEPTED OR REJECTED', 400);
  }

  const contact = await Contact.findById(req.params.id);

  if (!contact) {
    throw new AppError('CONTACT REQUEST NOT FOUND', 404);
  }

  // Only the recipient can respond to a request
  if (!contact.recipient.equals(myId)) {
    throw new AppError('FORBIDDEN: YOU ARE NOT THE RECIPIENT OF THIS REQUEST', 403);
  }

  if (contact.status !== 'PENDING') {
    throw new AppError(`CANNOT RESPOND: REQUEST IS ALREADY ${contact.status}`, 400);
  }

  contact.status = action;
  await contact.save();

  // Notify both parties via Socket.IO
  const io = req.app.get('io');
  if (io) {
    const payload = {
      contactId: contact._id.toString(),
      status: contact.status,
      requesterId: contact.requester.toString(),
      recipientId: contact.recipient.toString(),
    };
    io.to(`user:${contact.requester.toString()}`).emit('contact:updated', payload);
    io.to(`user:${contact.recipient.toString()}`).emit('contact:updated', payload);
  }

  res.json({ contact: { id: contact._id.toString(), status: contact.status } });
}));

/**
 * POST /api/contacts/:id/block — Block a contact.
 *
 * WHAT IT DOES:
 *   Sets contact status to BLOCKED and records which user initiated the block.
 *   Either party can block the other (requester or recipient).
 *
 * CALLED BY: client/src/pages/PeersPage.tsx BLOCK button.
 */
router.post('/:id/block', asyncHandler(async (req: Request, res: Response) => {
  const myId = new mongoose.Types.ObjectId(req.user!.userId);
  const { reason } = req.body;

  const contact = await Contact.findById(req.params.id);

  if (!contact) {
    throw new AppError('CONTACT NOT FOUND', 404);
  }

  // Verify caller is part of this contact relationship
  if (!contact.requester.equals(myId) && !contact.recipient.equals(myId)) {
    throw new AppError('FORBIDDEN: NOT A PARTICIPANT IN THIS CONTACT', 403);
  }

  contact.status = 'BLOCKED';
  contact.blockedBy = myId;
  contact.blockReason = reason ?? 'Manual block action';
  await contact.save();

  // Notify both parties
  const io = req.app.get('io');
  if (io) {
    const payload = {
      contactId: contact._id.toString(),
      status: 'BLOCKED',
      blockedBy: myId.toString(),
    };
    io.to(`user:${contact.requester.toString()}`).emit('contact:updated', payload);
    io.to(`user:${contact.recipient.toString()}`).emit('contact:updated', payload);
  }

  res.json({ success: true });
}));

/**
 * DELETE /api/contacts/:id/block — Unblock a contact.
 *
 * WHAT IT DOES:
 *   Resets contact status from BLOCKED back to ACCEPTED.
 *   Only the user who performed the block can unblock.
 *
 * CALLED BY: client/src/pages/PeersPage.tsx UNBLOCK button,
 *            client/src/pages/SettingsPage.tsx UNBLOCK button.
 */
router.delete('/:id/block', asyncHandler(async (req: Request, res: Response) => {
  const myId = new mongoose.Types.ObjectId(req.user!.userId);

  const contact = await Contact.findById(req.params.id);

  if (!contact) {
    throw new AppError('CONTACT NOT FOUND', 404);
  }

  if (contact.status !== 'BLOCKED') {
    throw new AppError('CONTACT IS NOT BLOCKED', 400);
  }

  // Only the person who blocked can unblock
  if (!contact.blockedBy?.equals(myId)) {
    throw new AppError('FORBIDDEN: ONLY THE BLOCKER CAN UNBLOCK', 403);
  }

  contact.status = 'ACCEPTED';
  contact.blockedBy = null;
  contact.blockReason = null;
  await contact.save();

  // Notify both parties
  const io = req.app.get('io');
  if (io) {
    const payload = {
      contactId: contact._id.toString(),
      status: 'ACCEPTED',
    };
    io.to(`user:${contact.requester.toString()}`).emit('contact:updated', payload);
    io.to(`user:${contact.recipient.toString()}`).emit('contact:updated', payload);
  }

  res.json({ success: true });
}));

/**
 * POST /api/contacts/pair-pin/generate — Generate a one-time 6-digit pairing PIN.
 *
 * WHAT IT DOES:
 *   1. Generates a random 6-digit PIN.
 *   2. Stores it in MongoDB with a 5-minute TTL.
 *   3. Returns the PIN to the calling user so they can share it
 *      out-of-band with the peer they want to pair with.
 *
 * CALLED BY: client/src/components/PairPinModal.tsx generate PIN flow.
 *
 * WHY THIS MATTERS:
 *   The PIN is a convenient alternative to handle-based requests when
 *   users are physically near each other (e.g., Laptop + Phone in same room).
 *   It avoids the need to know the exact handle in advance.
 */
router.post('/pair-pin/generate', asyncHandler(async (req: Request, res: Response) => {
  const myId = new mongoose.Types.ObjectId(req.user!.userId);

  // Delete any existing PIN from this user (one active PIN at a time)
  await PairPin.deleteMany({ creator: myId });

  // Generate a unique PIN (retry up to 5 times if collision)
  let pin = '';
  let attempts = 0;
  while (attempts < 5) {
    pin = generatePairPin();
    const existing = await PairPin.findOne({ pin });
    if (!existing) break;
    attempts++;
  }

  if (!pin) {
    throw new AppError('FAILED TO GENERATE UNIQUE PIN — PLEASE RETRY', 503);
  }

  // Set expiry to exactly 5 minutes from now
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const pairPin = await PairPin.create({
    pin,
    creator: myId,
    expiresAt,
  });

  res.json({
    pin: pairPin.pin,
    expiresAt: pairPin.expiresAt,
    expiresInSeconds: 300,
  });
}));

/**
 * POST /api/contacts/pair-pin/redeem — Redeem a 6-digit PIN to pair instantly.
 *
 * WHAT IT DOES:
 *   1. Finds the PairPin document by the submitted 6-digit PIN.
 *   2. Verifies the PIN hasn't expired (MongoDB TTL handles this, but
 *      we double-check the expiresAt timestamp in application code too).
 *   3. Gets the PIN creator's userId (User A).
 *   4. Creates or updates a Contact between User A and the redeemer (User B)
 *      with status ACCEPTED — bypassing the normal request/respond flow.
 *   5. Deletes the used PIN (single-use).
 *   6. Notifies both users via Socket.IO so their PEERS lists update instantly.
 *
 * CALLED BY: client/src/components/PairPinModal.tsx CONNECT PIN button.
 */
router.post('/pair-pin/redeem', asyncHandler(async (req: Request, res: Response) => {
  const { pin } = req.body;
  const redeemerId = new mongoose.Types.ObjectId(req.user!.userId);

  if (!pin || !/^\d{6}$/.test(String(pin))) {
    throw new AppError('ENTER A VALID 6-DIGIT PIN', 400);
  }

  // Find the PIN document
  const pairPin = await PairPin.findOne({ pin: String(pin) });

  if (!pairPin) {
    throw new AppError('INVALID OR EXPIRED PIN', 404);
  }

  // Double-check expiry (redundant with TTL, but safe)
  if (pairPin.expiresAt < new Date()) {
    await pairPin.deleteOne();
    throw new AppError('PIN HAS EXPIRED', 410);
  }

  const creatorId = pairPin.creator;

  // Cannot redeem your own PIN
  if (creatorId.equals(redeemerId)) {
    throw new AppError('CANNOT REDEEM YOUR OWN PIN', 400);
  }

  // Create or update Contact between creator and redeemer to ACCEPTED
  const contact = await Contact.findOneAndUpdate(
    {
      $or: [
        { requester: creatorId, recipient: redeemerId },
        { requester: redeemerId, recipient: creatorId },
      ],
    },
    {
      $set: {
        requester: creatorId,
        recipient: redeemerId,
        status: 'ACCEPTED',
        blockedBy: null,
        blockReason: null,
      },
    },
    {
      upsert: true,    // Create if doesn't exist
      new: true,       // Return the updated/created document
      setDefaultsOnInsert: true,
    }
  );

  // Consume the PIN (single-use)
  await pairPin.deleteOne();

  // Notify BOTH users via Socket.IO so their peers lists update instantly
  const io = req.app.get('io');
  if (io && contact) {
    const payload = {
      contactId: contact._id.toString(),
      status: 'ACCEPTED',
      requesterId: creatorId.toString(),
      recipientId: redeemerId.toString(),
    };
    io.to(`user:${creatorId.toString()}`).emit('contact:updated', payload);
    io.to(`user:${redeemerId.toString()}`).emit('contact:updated', payload);
  }

  res.json({
    success: true,
    contactId: contact?._id.toString(),
    message: 'NODES PAIRED SUCCESSFULLY',
  });
}));

export default router;
