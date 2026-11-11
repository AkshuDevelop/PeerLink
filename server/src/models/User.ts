/**
 * ============================================================
 * FILE PURPOSE:
 *   Mongoose model for PeerLink users. Each user has a unique
 *   nodeId (e.g. "NODE-77-DELTA"), a unique handle (e.g. "kofi_station"),
 *   a hashed password, and network transport preferences.
 *
 * ARCHITECTURAL LAYER:
 *   Database Model (Mongoose ODM)
 *   Sits in the Data Layer — called by auth routes and socket manager.
 *
 * CONNECTED MODULES:
 *   - Called by: authRoutes.ts (register, login, /me, PATCH /me)
 *   - Called by: socketManager.ts (presence lookups)
 *   - Called by: contactRoutes.ts (lookup by handle)
 * ============================================================
 */

import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * IUser — TypeScript interface describing a PeerLink user document.
 * All fields are stored in MongoDB. `passwordHash` is excluded from
 * normal query results (select: false) to prevent accidental leakage.
 */
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  nodeId: string;         // e.g. "NODE-77-DELTA" — deterministic from handle
  handle: string;         // e.g. "kofi_station" — 3-20 chars, lowercase
  email: string;          // e.g. "kofi@example.com"
  passwordHash: string;   // bcrypt hash — never sent to client
  avatar: string;         // e.g. "KF" — first 2 uppercase chars of handle
  allowLanHost: boolean;  // ICE transport policy: 'all' (true) vs 'relay' (false)
  stunServer: string;     // STUN server URL for this user
  isGuest: boolean;       // Instant 1-click ephemeral guest node flag
  createdAt: Date;
  updatedAt: Date;

  // Instance method for password verification
  comparePassword(plaintext: string): Promise<boolean>;
}

/**
 * UserSchema — Mongoose Schema definition for the User model.
 *
 * WHY THESE CONSTRAINTS:
 *   - handle regex: must be lowercase alphanumeric + dot/underscore, 3-20 chars.
 *     This is the unique public identifier users share with each other.
 *   - passwordHash select:false: prevents the hash from appearing in any
 *     query result unless explicitly re-added with .select('+passwordHash').
 *   - nodeId: generated deterministically on registration (NODE-<2digit>-<WORD>)
 *     so users can display their "node identity" in the UI without random noise.
 */
const UserSchema = new Schema<IUser>(
  {
    nodeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    handle: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      // Exactly the handle regex from the spec: letters, numbers, dot, underscore
      match: [/^[a-z0-9._]{3,20}$/, 'Handle must be 3-20 chars: letters, numbers, dot, underscore'],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      // ⚠️ IMPORTANT: select:false means this field is NEVER returned in
      // normal .find() queries. Must use .select('+passwordHash') explicitly.
      select: false,
    },
    avatar: {
      type: String,
      required: true,
      // 2 uppercase characters derived from the handle
    },
    allowLanHost: {
      type: Boolean,
      default: true,
    },
    stunServer: {
      type: String,
      default: 'stun:stun.l.google.com:19302',
    },
    isGuest: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

/**
 * comparePassword — Instance method to verify a plaintext password
 * against the stored bcrypt hash.
 *
 * WHAT IT DOES:
 *   Uses bcrypt.compare() which safely handles timing-attack prevention.
 *   Returns true if the password matches, false otherwise.
 *
 * CALLED BY: authRoutes.ts POST /api/auth/login handler.
 *
 * WHY THIS MATTERS:
 *   bcrypt.compare() is constant-time, preventing attackers from
 *   learning the hash length or structure via timing differences.
 */
UserSchema.methods.comparePassword = async function (plaintext: string): Promise<boolean> {
  return bcrypt.compare(plaintext, this.passwordHash);
};

/**
 * generateNodeId — Deterministically generates a "NODE-XX-WORD" ID.
 *
 * WHAT IT DOES:
 *   Creates a visually distinct node identifier like "NODE-77-DELTA"
 *   from the user's handle using a simple hash. This is NOT a
 *   cryptographic identifier — it's purely cosmetic for the UI.
 *
 * CALLED BY: authRoutes.ts POST /api/auth/register handler.
 */
export function generateNodeId(handle: string): string {
  // NATO phonetic alphabet words for node naming
  const words = [
    'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT',
    'GOLF', 'HOTEL', 'INDIA', 'JULIET', 'KILO', 'LIMA',
    'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA', 'QUEBEC', 'ROMEO',
    'SIERRA', 'TANGO', 'UNIFORM', 'VICTOR', 'WHISKEY', 'XRAY',
    'YANKEE', 'ZULU'
  ];

  // Compute a simple hash of the handle to pick a number and word
  let hash = 0;
  for (let i = 0; i < handle.length; i++) {
    hash = (hash * 31 + handle.charCodeAt(i)) >>> 0;
  }

  const num = (hash % 90) + 10;         // 10–99
  const word = words[hash % words.length]; // deterministic NATO word
  return `NODE-${num}-${word}`;
}

export const User = mongoose.model<IUser>('User', UserSchema);
