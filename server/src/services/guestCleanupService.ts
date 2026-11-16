/**
 * ============================================================
 * FILE PURPOSE:
 *   Service for purging ephemeral guest user accounts, their
 *   contacts, active pair PINs, and transfer audit metadata
 *   from MongoDB Atlas / memory storage.
 *
 * ARCHITECTURAL LAYER:
 *   Backend Service / Cleanup Manager
 *
 * RULES:
 *   - Instantly called on POST /api/auth/logout if user is a guest.
 *   - Called on server bootstrap to clean any historical guest records.
 *   - Only affects users where isGuest === true OR handle starts with "guest_".
 *   - Permanent operator accounts (e.g., registered email/pass) are NEVER touched.
 * ============================================================
 */

import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import { User } from '../models/User';
import { Contact } from '../models/Contact';
import { PairPin } from '../models/PairPin';
import { Transfer } from '../models/Transfer';

/**
 * purgeSingleGuest — Deletes a single guest user and all associated documents immediately.
 *
 * @param userId - MongoDB ObjectId or hex string of the user logging out
 * @param io - Optional Socket.IO server to notify connected peers
 */
export async function purgeSingleGuest(
  userId: string | mongoose.Types.ObjectId,
  io?: SocketIOServer
): Promise<{ purged: boolean; handle?: string }> {
  const user = await User.findById(userId);

  if (!user) {
    return { purged: false };
  }

  // Safety check: only purge if marked isGuest or handle begins with "guest_"
  const isGuestAccount = user.isGuest || /^guest_/i.test(user.handle);
  if (!isGuestAccount) {
    return { purged: false, handle: user.handle };
  }

  const uId = user._id;

  // 1. Notify connected peers over Socket.IO before deleting contact links
  if (io) {
    try {
      const contacts = await Contact.find({
        $or: [{ requester: uId }, { recipient: uId }],
      });

      contacts.forEach((contact) => {
        const peerId = contact.requester.toString() === uId.toString()
          ? contact.recipient.toString()
          : contact.requester.toString();

        io.to(`user:${peerId}`).emit('contact:updated', {
          contactId: contact._id.toString(),
          status: 'REMOVED',
        });
        io.to(`user:${peerId}`).emit('peer:presence_update', {
          userId: uId.toString(),
          status: 'OFFLINE',
        });
      });
    } catch (err) {
      console.warn('[GuestCleanup] Non-fatal error notifying peers:', err);
    }
  }

  // 2. Delete all contacts involving this guest
  const contactResult = await Contact.deleteMany({
    $or: [{ requester: uId }, { recipient: uId }],
  });

  // 3. Delete any active pair pins created by this guest
  const pinResult = await PairPin.deleteMany({ creator: uId });

  // 4. Delete transfers involving this guest
  const transferResult = await Transfer.deleteMany({
    $or: [{ sender: uId }, { recipient: uId }],
  });

  // 5. Delete the guest user record itself
  await User.findByIdAndDelete(uId);

  console.log(
    `[GuestCleanup] 🗑️ Instantly purged guest node @${user.handle} ` +
    `(${contactResult.deletedCount} contacts, ${pinResult.deletedCount} pins, ${transferResult.deletedCount} transfers removed)`
  );

  return { purged: true, handle: user.handle };
}

/**
 * purgeAllGuestAccounts — Sweeps and deletes ALL guest accounts and their relations.
 *
 * CALLED BY:
 *   - Server bootstrap on startup (server/src/index.ts)
 *   - Standalone maintenance script (server/src/scripts/cleanGuests.ts)
 */
export async function purgeAllGuestAccounts(
  io?: SocketIOServer
): Promise<{
  purgedUsers: number;
  deletedContacts: number;
  deletedPairPins: number;
  deletedTransfers: number;
}> {
  // Find all guest users
  const guestUsers = await User.find({
    $or: [{ isGuest: true }, { handle: /^guest_/i }],
  }).select('_id handle');

  if (guestUsers.length === 0) {
    console.log('[GuestCleanup] ✨ Database clean: 0 guest accounts found.');
    return {
      purgedUsers: 0,
      deletedContacts: 0,
      deletedPairPins: 0,
      deletedTransfers: 0,
    };
  }

  const guestIds = guestUsers.map((u) => u._id);

  // Notify any active sockets if io is provided
  if (io) {
    guestIds.forEach((id) => {
      io.emit('peer:presence_update', {
        userId: id.toString(),
        status: 'OFFLINE',
      });
    });
  }

  // Delete all contacts involving any of these guests
  const contactRes = await Contact.deleteMany({
    $or: [
      { requester: { $in: guestIds } },
      { recipient: { $in: guestIds } },
    ],
  });

  // Delete all pairing PINs created by guests
  const pinRes = await PairPin.deleteMany({
    creator: { $in: guestIds },
  });

  // Delete all transfers involving guests
  const transferRes = await Transfer.deleteMany({
    $or: [
      { sender: { $in: guestIds } },
      { recipient: { $in: guestIds } },
    ],
  });

  // Delete the guest users
  const userRes = await User.deleteMany({
    _id: { $in: guestIds },
  });

  console.log(
    `[GuestCleanup] 🧹 Purged all historical guests: ` +
    `${userRes.deletedCount} users, ${contactRes.deletedCount} contacts, ` +
    `${pinRes.deletedCount} pins, ${transferRes.deletedCount} transfers deleted.`
  );

  return {
    purgedUsers: userRes.deletedCount,
    deletedContacts: contactRes.deletedCount,
    deletedPairPins: pinRes.deletedCount,
    deletedTransfers: transferRes.deletedCount,
  };
}
