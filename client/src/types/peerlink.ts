/**
 * ============================================================
 * FILE PURPOSE:
 *   Central TypeScript type definitions shared across the entire
 *   PeerLink frontend. Defines interfaces for User, Contact, Transfer,
 *   WebRTC signalling, and telemetry data structures.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend — Shared Types (imported throughout all components/services)
 *
 * CONNECTED MODULES:
 *   - Imported by: virtually every .tsx/.ts file in the client
 * ============================================================
 */

// ================================================================
// User Types
// ================================================================

/** Public user profile (returned by API — never includes passwordHash) */
export interface User {
  _id?: string;
  id: string;
  nodeId: string;      // e.g. "NODE-77-DELTA"
  handle: string;      // e.g. "kofi_station"
  email?: string;
  avatar: string;      // e.g. "KF" (2 uppercase chars)
  allowLanHost?: boolean;
  stunServer?: string;
  isGuest?: boolean;
}

/** Peer presence state for real-time online/busy/offline indicators */
export type PeerPresence = 'ONLINE' | 'BUSY' | 'OFFLINE';

/** An accepted peer/contact with presence and latency data */
export interface PeerContact {
  contactId: string;
  user: User;
  presence: PeerPresence;
  latencyMs: number | null;
}

// ================================================================
// Contact Types
// ================================================================

export type ContactStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';

/** A Contact relationship document (from /api/contacts) */
export interface Contact {
  _id: string;
  requester: User;
  recipient: User;
  status: ContactStatus;
  blockedBy?: string | null;
  blockReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ================================================================
// Transfer Types
// ================================================================

export type TransferStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'TRANSFERRING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED'
  | 'EXPIRED';

export type ConduitType = 'DIRECT_SCTP' | 'TURN_RELAY' | 'UNKNOWN';

/** Transfer metadata document (from /api/transfers) */
export interface Transfer {
  _id: string;
  sessionCode: string;      // e.g. "TR-9014"
  sender: User;
  recipient: User;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  totalChunks: number;
  senderSha256: string;
  receiverSha256: string | null;
  integrityVerified: boolean;
  averageSpeedMBps: number;
  conduitType: ConduitType;
  status: TransferStatus;
  failureReason: string | null;
  expiresAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ================================================================
// Incoming Offer (received via Socket.IO transfer:incoming_offer)
// ================================================================

/** Data for an incoming file transfer offer (shown in IncomingRequestModal) */
export interface IncomingOffer {
  transferId: string;
  sessionCode: string;
  sender: {
    id: string;
    handle: string;
    avatar: string;
    nodeId: string;
  };
  filename: string;
  sizeBytes: number;
  mimeType: string;
  totalChunks: number;
  senderSha256: string;
}

// ================================================================
// WebRTC Signalling Types
// ================================================================

/** Type of WebRTC signal being relayed via Socket.IO */
export type SignalType = 'SDP_OFFER' | 'SDP_ANSWER' | 'ICE_CANDIDATE';

/** WebRTC signal payload relayed via Socket.IO webrtc:signal event */
export interface WebRTCSignal {
  transferId: string;
  fromUserId: string;
  type: SignalType;
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

// ================================================================
// Telemetry Types (for the Active Transfer page)
// ================================================================

/** Real-time transfer telemetry displayed on the active transfer page */
export interface TransferTelemetry {
  transferId: string;
  sessionCode: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  totalChunks: number;
  senderSha256: string;

  // Live counters updated from DataChannel byte events
  transferredBytes: number;
  percent: number;
  speedMBps: number;
  etaSeconds: number;

  // State
  status: TransferStatus;
  conduitType: ConduitType;
  role: 'SENDER' | 'RECEIVER';

  // Completed state
  receiverSha256?: string;
  integrityVerified?: boolean;
  averageSpeedMBps?: number;

  // For receiver: the reconstructed Blob URL for download
  downloadBlobUrl?: string;
  downloadFilename?: string;
  downloadBlob?: Blob;
}

// ================================================================
// SHA-256 Worker Message Types
// ================================================================

/** Message sent TO the sha256 Web Worker */
export interface WorkerInputMessage {
  type: 'HASH_FILE' | 'UPDATE' | 'DIGEST' | 'RESET';
  chunk?: ArrayBuffer;    // For 'UPDATE' messages
  file?: File;            // For 'HASH_FILE' messages (full file hash)
}

/** Message received FROM the sha256 Web Worker */
export interface WorkerOutputMessage {
  type: 'PROGRESS' | 'RESULT' | 'ERROR';
  percent?: number;        // For 'PROGRESS' messages (0–100)
  hash?: string;           // For 'RESULT' messages (64-char hex)
  error?: string;          // For 'ERROR' messages
}

// ================================================================
// STUN Probe Types
// ================================================================

/** Result of a real STUN probe measurement */
export interface StunProbeResult {
  success: boolean;
  reflexiveIp?: string;   // Public IP:port discovered via STUN (e.g. "185.12.14.99:3478")
  rttMs?: number;         // Round-trip time to STUN server in milliseconds
  error?: string;
}

// ================================================================
// Pair PIN Types
// ================================================================

/** Response from POST /api/contacts/pair-pin/generate */
export interface PairPinResponse {
  pin: string;
  expiresAt: string;
  expiresInSeconds: number;
}
