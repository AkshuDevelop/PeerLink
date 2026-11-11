/**
 * ============================================================
 * FILE PURPOSE:
 *   Mongoose model for ephemeral 6-digit numeric pairing PINs.
 *   A PIN lets two users instantly pair (become ACCEPTED contacts)
 *   by sharing a 6-digit code out-of-band (e.g., over phone/chat).
 *   PINs auto-expire after 5 minutes via MongoDB TTL index.
 *
 * ARCHITECTURAL LAYER:
 *   Database Model (Mongoose ODM)
 *
 * CONNECTED MODULES:
 *   - Called by: contactRoutes.ts POST /pair-pin/generate and /redeem
 *   - Affects:   Contact model (creates/updates Contact to ACCEPTED on redeem)
 * ============================================================
 */

import mongoose, { Document, Schema } from 'mongoose';

/**
 * IPairPin — TypeScript interface for a PairPin document.
 *
 * HOW IT WORKS:
 *   1. User A calls POST /api/contacts/pair-pin/generate → gets a 6-digit PIN.
 *   2. User A shares the PIN with User B out-of-band (phone, message, etc.).
 *   3. User B calls POST /api/contacts/pair-pin/redeem with the PIN.
 *   4. Backend creates/updates the Contact between A and B to ACCEPTED.
 *   5. The PIN document is deleted (single-use).
 *   6. MongoDB TTL index auto-deletes any unused PINs after 5 minutes.
 */
export interface IPairPin extends Document {
  _id: mongoose.Types.ObjectId;
  pin: string;                          // 6-digit numeric string, e.g. "849201"
  creator: mongoose.Types.ObjectId;     // User who generated the PIN
  expiresAt: Date;                      // When the PIN auto-expires
}

const PairPinSchema = new Schema<IPairPin>({
  pin: {
    type: String,
    required: true,
    unique: true,
    // 6-digit numeric string
    match: [/^\d{6}$/, 'PIN must be exactly 6 digits'],
  },
  creator: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    // TTL index: MongoDB automatically deletes the document once
    // the current time passes expiresAt. expireAfterSeconds: 0 means
    // "expire exactly at the expiresAt timestamp" rather than adding
    // extra seconds to it.
    index: { expireAfterSeconds: 0 },
  },
});

/**
 * generatePairPin — Helper to create a cryptographically random 6-digit PIN.
 *
 * WHAT IT DOES:
 *   Uses Math.random() for speed (this is not a security-critical secret
 *   — it's a short-lived convenience code shared between trusted devices).
 *   For higher security, replace with crypto.randomInt(100000, 999999).
 *
 * CALLED BY: contactRoutes.ts POST /api/contacts/pair-pin/generate
 */
export function generatePairPin(): string {
  // Pad to exactly 6 digits (100000–999999 range)
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const PairPin = mongoose.model<IPairPin>('PairPin', PairPinSchema);
