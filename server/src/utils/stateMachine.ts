/**
 * ============================================================
 * FILE PURPOSE:
 *   Deterministic 8-state Transfer status transition validator.
 *   Enforces legal state transitions for the Transfer state machine,
 *   preventing invalid status updates (e.g., going from COMPLETED
 *   back to TRANSFERRING, or jumping from PENDING to COMPLETED).
 *
 * ARCHITECTURAL LAYER:
 *   Business Logic / Domain Utility
 *
 * CONNECTED MODULES:
 *   - Called by: transferRoutes.ts (PATCH /:id/respond, PATCH /:id/status,
 *     POST /:id/complete) before saving any status update to MongoDB.
 * ============================================================
 */

import { TransferStatus } from '../models/Transfer';

/**
 * LEGAL_TRANSITIONS — Map of which target statuses are reachable
 * from each source status.
 *
 * WHY THIS MATTERS:
 *   Without enforced state transitions, a client could send a malicious
 *   PATCH request to mark a REJECTED transfer as COMPLETED, or reactivate
 *   an EXPIRED offer. This map is the single source of truth for all
 *   valid status changes.
 *
 * STATE MACHINE DIAGRAM:
 *
 *   PENDING ─────────────────────── EXPIRED (automated, 5-min TTL)
 *      │
 *      ├──→ ACCEPTED ──→ TRANSFERRING ──→ COMPLETED
 *      │                     │
 *      │                     ├──→ CANCELLED
 *      │                     └──→ FAILED
 *      └──→ REJECTED
 */
const LEGAL_TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  PENDING: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
  ACCEPTED: ['TRANSFERRING', 'CANCELLED'],
  TRANSFERRING: ['COMPLETED', 'CANCELLED', 'FAILED'],
  COMPLETED: [],     // Terminal state — no further transitions allowed
  REJECTED: [],      // Terminal state
  CANCELLED: [],     // Terminal state
  FAILED: [],        // Terminal state
  EXPIRED: [],       // Terminal state
};

/**
 * validateTransition — Checks whether a status change is legal.
 *
 * WHAT IT DOES:
 *   Looks up the current status in LEGAL_TRANSITIONS and checks whether
 *   the requested next status is in the allowed set.
 *
 * CALLED BY:
 *   - transferRoutes.ts PATCH /:id/respond (PENDING → ACCEPTED or REJECTED)
 *   - transferRoutes.ts PATCH /:id/status  (ACCEPTED → TRANSFERRING, etc.)
 *   - transferRoutes.ts POST /:id/complete (TRANSFERRING → COMPLETED)
 *   - transferRoutes.ts transfer:cancel handler (→ CANCELLED)
 *
 * @param current - The transfer's current status in the database
 * @param next    - The status the caller wants to transition to
 * @returns true if the transition is allowed, false otherwise
 */
export function validateTransition(current: TransferStatus, next: TransferStatus): boolean {
  const allowed = LEGAL_TRANSITIONS[current] ?? [];
  return allowed.includes(next);
}

/**
 * isTerminalStatus — Returns true if the status cannot change further.
 *
 * CALLED BY: socketManager.ts (to skip signalling for finished transfers)
 *
 * @param status - The transfer status to check
 */
export function isTerminalStatus(status: TransferStatus): boolean {
  return LEGAL_TRANSITIONS[status]?.length === 0;
}
