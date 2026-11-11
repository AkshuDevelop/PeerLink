/**
 * ============================================================
 * FILE PURPOSE:
 *   JWT authentication middleware for Express routes.
 *   Verifies the Bearer token in the Authorization header,
 *   attaches decoded userId and handle to req for downstream use.
 *
 * ARCHITECTURAL LAYER:
 *   Express Middleware (Security Layer)
 *   Sits between the Express router and route controllers.
 *
 * CONNECTED MODULES:
 *   - Applied by: authRoutes.ts (GET /me, PATCH /me)
 *   - Applied by: contactRoutes.ts (all routes)
 *   - Applied by: transferRoutes.ts (all routes)
 *   - Calls out to: jsonwebtoken.verify()
 * ============================================================
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * AuthPayload — Shape of the decoded JWT payload.
 * We embed userId and handle in every token so downstream handlers
 * don't need an extra database query just to get the user's handle.
 */
export interface AuthPayload {
  userId: string;
  handle: string;
}

/**
 * Augment Express's Request type to include our decoded auth payload.
 * This allows TypeScript to know that req.user is available after
 * authMiddleware runs, without casting to `any`.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * authMiddleware — Validates the JWT and attaches user info to the request.
 *
 * WHAT IT DOES:
 *   1. Reads the Authorization header (expects "Bearer <token>").
 *   2. Calls jwt.verify() with the JWT_SECRET from environment.
 *   3. If valid, attaches the decoded payload to req.user.
 *   4. If missing or invalid, responds with 401 Unauthorized.
 *
 * CALLED BY:
 *   Applied as a middleware to all protected Express routes.
 *
 * WHY THIS MATTERS:
 *   Every protected endpoint needs to know WHICH user is making the request.
 *   The JWT approach means the server stays stateless — no session store needed.
 *   The token is validated cryptographically, so no database lookup is required
 *   for authentication (only for authorization checks like contact status).
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Extract the Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED: Missing or malformed Authorization header' });
    return;
  }

  // Extract just the token part (after "Bearer ")
  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured in environment');
    }

    // jwt.verify() throws if the token is expired, malformed, or has wrong signature
    const decoded = jwt.verify(token, secret) as AuthPayload;

    // Attach decoded user data to the request for use in route handlers
    req.user = decoded;

    // Proceed to the next middleware or route handler
    next();
  } catch (err) {
    // Token is invalid, expired, or JWT_SECRET mismatch
    res.status(401).json({ error: 'UNAUTHORIZED: Invalid or expired token' });
  }
}
