/**
 * ============================================================
 * FILE PURPOSE:
 *   Centralized Express error handling middleware.
 *   Catches any errors thrown by route handlers (via next(err))
 *   and formats them into consistent JSON error responses.
 *
 * ARCHITECTURAL LAYER:
 *   Express Middleware (Error Handling Layer)
 *   Must be registered LAST in the Express middleware chain.
 *
 * CONNECTED MODULES:
 *   - Applied by: server/src/index.ts (registered after all routes)
 *   - Receives errors from: all route handlers that call next(err)
 * ============================================================
 */

import { Request, Response, NextFunction } from 'express';

/**
 * AppError — Custom error class that carries an HTTP status code.
 * Route handlers throw `new AppError('message', 400)` instead of
 * generic `new Error()` to control the HTTP response status.
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Distinguishes from unexpected crashes

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * errorHandler — Global Express error middleware.
 *
 * WHAT IT DOES:
 *   1. Checks if the error is an AppError (operational, known error) or
 *      an unexpected crash (programmer error / library bug).
 *   2. Logs the error details to the console for server monitoring.
 *   3. Returns a uniform JSON error body: { error: "...", code: 400 }.
 *   4. In production, hides internal details from unexpected errors
 *      (returns a generic 500 message instead of raw stack traces).
 *
 * CALLED BY:
 *   Express automatically passes errors to this middleware when any
 *   route handler calls `next(err)` or throws inside an async handler.
 *
 * WHY THIS MATTERS:
 *   Without centralized error handling, each route needs its own try/catch
 *   and error formatting. Centralizing it ensures consistent error shape
 *   across all endpoints, which the frontend can rely on predictably.
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Always log the full error on the server for debugging
  if (!isAppError || statusCode >= 500) {
    console.error('[ERROR]', req.method, req.path, err);
  }

  // Build the response body
  const responseBody: {
    error: string;
    code: number;
    details?: string;
  } = {
    error: isAppError ? err.message : 'INTERNAL SERVER ERROR',
    code: statusCode,
  };

  // In development, include the stack trace for easier debugging
  if (!isProduction && !isAppError) {
    responseBody.details = err.stack ?? err.message;
  }

  res.status(statusCode).json(responseBody);
}

/**
 * asyncHandler — Wraps an async Express route handler to automatically
 * catch Promise rejections and forward them to next() (and thus errorHandler).
 *
 * WHAT IT DOES:
 *   Without this wrapper, an unhandled rejection inside an async route
 *   handler would crash the Node.js process. This wrapper catches all
 *   rejections and passes them to Express's error chain.
 *
 * USAGE:
 *   router.get('/route', asyncHandler(async (req, res) => {
 *     // await anything — errors automatically go to errorHandler
 *   }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
