/**
 * ============================================================
 * FILE PURPOSE:
 *   Mongoose model for file transfer sessions. Tracks the full
 *   lifecycle of every PeerLink transfer from PENDING offer through
 *   COMPLETED verification. The backend stores only metadata —
 *   actual file bytes NEVER touch the server.
 *
 * ARCHITECTURAL LAYER:
 *   Database Model (Mongoose ODM)
 *
 * CONNECTED MODULES:
 *   - Called by: transferRoutes.ts (all CRUD and status operations)
 *   - Called by: socketManager.ts (status validation before signalling)
 *   - Called by: stateMachine.ts (validates state transitions)
 * ============================================================
 */

import mongoose, { Document, Schema } from 'mongoose';

/**
 * TransferStatus — 8-state transfer lifecycle enum.
 *
 * STATE TRANSITIONS (enforced by stateMachine.ts):
 *   PENDING → ACCEPTED (receiver accepts the offer)
 *   PENDING → REJECTED (receiver rejects the offer)
 *   PENDING → EXPIRED  (5-minute TTL passes, automated)
 *   ACCEPTED → TRANSFERRING (WebRTC DataChannel opens, first chunk sent)
 *   TRANSFERRING → COMPLETED (EOF + SHA-256 match confirmed by receiver)
 *   TRANSFERRING → CANCELLED (either party calls cancel)
 *   TRANSFERRING → FAILED    (network error / connection lost)
 */
export type TransferStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'TRANSFERRING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED'
  | 'EXPIRED';

/**
 * ITransfer — TypeScript interface for a Transfer metadata document.
 *
 * IMPORTANT: sizeBytes and totalChunks refer to the actual file size
 * and the number of 64KB chunks. The UI displays "512KB slices" cosmetically
 * but the actual SCTP frames are 64KB for cross-browser compatibility.
 */
export interface ITransfer extends Document {
  _id: mongoose.Types.ObjectId;
  sessionCode: string;              // e.g. "TR-9014" — human-readable session ID
  sender: mongoose.Types.ObjectId;  // User who is sending the file
  recipient: mongoose.Types.ObjectId; // User who will receive the file
  filename: string;                 // Original filename (e.g. "PROJECT_STEMS.ZIP")
  sizeBytes: number;                // File size in bytes
  mimeType: string;                 // MIME type (e.g. "application/zip")
  totalChunks: number;              // Number of 64KB chunks (ceil(sizeBytes / 65536))
  senderSha256: string;             // SHA-256 hex computed by sender before transfer
  receiverSha256: string | null;    // SHA-256 hex computed by receiver after reassembly
  integrityVerified: boolean;       // true if senderSha256 === receiverSha256
  averageSpeedMBps: number;         // Reported average transfer speed
  conduitType: 'DIRECT_SCTP' | 'TURN_RELAY' | 'UNKNOWN';
  status: TransferStatus;
  failureReason: string | null;     // Error message if status is FAILED or CANCELLED
  expiresAt: Date;                  // PENDING offers auto-expire after 5 minutes
  completedAt: Date | null;         // When the transfer finished (any terminal state)
  createdAt: Date;
  updatedAt: Date;
}

const TransferSchema = new Schema<ITransfer>(
  {
    sessionCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // Format: TR-XXXX where XXXX is a 4-digit number
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
    },
    mimeType: {
      type: String,
      default: 'application/octet-stream',
    },
    totalChunks: {
      type: Number,
      required: true,
      min: 1,
    },
    senderSha256: {
      type: String,
      required: true,
      // SHA-256 is always exactly 64 hex characters
      match: [/^[a-f0-9]{64}$/i, 'Must be a valid 64-character SHA-256 hexadecimal string'],
    },
    receiverSha256: {
      type: String,
      default: null,
    },
    integrityVerified: {
      type: Boolean,
      default: false,
    },
    averageSpeedMBps: {
      type: Number,
      default: 0,
    },
    conduitType: {
      type: String,
      enum: ['DIRECT_SCTP', 'TURN_RELAY', 'UNKNOWN'],
      default: 'DIRECT_SCTP',
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'TRANSFERRING', 'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED', 'EXPIRED'],
      default: 'PENDING',
    },
    failureReason: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * generateSessionCode — Creates a unique "TR-XXXX" session identifier.
 *
 * WHAT IT DOES:
 *   Generates a 4-digit random number between 1000 and 9999, prefixed
 *   with "TR-". In production, should check for collisions in DB.
 *
 * CALLED BY: transferRoutes.ts POST /api/transfers/request
 */
export function generateSessionCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `TR-${num}`;
}

export const Transfer = mongoose.model<ITransfer>('Transfer', TransferSchema);
