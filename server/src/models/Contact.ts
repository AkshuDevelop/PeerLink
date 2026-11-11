/**
 * ============================================================
 * FILE PURPOSE:
 *   Mongoose model for contact relationships between PeerLink users.
 *   A Contact document represents a directional consent link:
 *   User A (requester) asked to connect with User B (recipient).
 *   The status field drives the entire peer discovery UX.
 *
 * ARCHITECTURAL LAYER:
 *   Database Model (Mongoose ODM)
 *
 * CONNECTED MODULES:
 *   - Called by: contactRoutes.ts (request, respond, block, lookup)
 *   - Called by: socketManager.ts (broadcastPresenceToContacts)
 *   - Called by: transferRoutes.ts (validate sender/recipient are contacts)
 * ============================================================
 */

import mongoose, { Document, Schema } from 'mongoose';

/**
 * IContact — TypeScript interface for a Contact document.
 *
 * STATUS MEANINGS:
 *   PENDING  — requester sent a contact request, awaiting recipient's response
 *   ACCEPTED — both parties consent; they appear in each other's PEERS list
 *   REJECTED — recipient declined; requester cannot re-request (UI enforced)
 *   BLOCKED  — one party blocked the other; transfers are forbidden
 */
export interface IContact extends Document {
  _id: mongoose.Types.ObjectId;
  requester: mongoose.Types.ObjectId;   // User who initiated the contact request
  recipient: mongoose.Types.ObjectId;   // User who receives the request
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';
  blockedBy: mongoose.Types.ObjectId | null; // Which user issued the block
  blockReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<IContact>(
  {
    requester: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED'],
      default: 'PENDING',
    },
    blockedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    blockReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Compound unique index on (requester, recipient).
 *
 * WHY THIS MATTERS:
 *   Prevents duplicate contact requests between the same pair of users.
 *   The database enforces this at the storage layer, not just in application
 *   code, so even concurrent requests cannot create duplicates.
 */
ContactSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Also index by recipient for efficient "incoming requests" queries
ContactSchema.index({ recipient: 1, status: 1 });
// Index by requester for efficient "outgoing requests" queries
ContactSchema.index({ requester: 1, status: 1 });

export const Contact = mongoose.model<IContact>('Contact', ContactSchema);
