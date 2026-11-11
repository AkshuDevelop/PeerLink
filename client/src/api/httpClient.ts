/**
 * ============================================================
 * FILE PURPOSE:
 *   Typed HTTP fetch wrapper for PeerLink's REST API calls.
 *   Automatically attaches the JWT Authorization header from
 *   localStorage, handles JSON serialization/deserialization,
 *   and throws structured errors on non-2xx responses.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend — API Client Service
 *
 * CONNECTED MODULES:
 *   - Called by: AuthContext.tsx (register, login, getMe, updateMe)
 *   - Called by: All page components making API requests
 *   - Reads from: localStorage.getItem('peerlink_token')
 * ============================================================
 */

/** Base URL for all API calls. Empty string means same-origin
 *  (which works in both dev with Vite proxy AND in production). */
const API_BASE = '';

/**
 * ApiError — Thrown when the API returns a non-2xx response.
 * Carries the HTTP status code and the server's error message.
 */
export class ApiError extends Error {
  public status: number;
  public code?: number;

  constructor(message: string, status: number, code?: number) {
    super(message);
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * httpClient — Core typed fetch wrapper.
 *
 * WHAT IT DOES:
 *   1. Builds the full URL by prepending API_BASE.
 *   2. Retrieves the JWT token from localStorage.
 *   3. Sets Authorization header if a token exists.
 *   4. Serializes the body as JSON if provided.
 *   5. Parses the JSON response.
 *   6. Throws ApiError on non-2xx status codes.
 *   7. Returns typed response data T.
 *
 * CALLED BY: All page components and context providers that need API data.
 *
 * WHY THIS APPROACH:
 *   Centralizing all API calls through one wrapper means:
 *   - Auth header is ALWAYS added automatically — no per-call boilerplate.
 *   - Error handling is consistent — components catch ApiError instances.
 *   - Easy to add global interceptors (e.g., 401 auto-logout) in one place.
 *
 * @template T - The expected response body type
 * @param path    - API path (e.g., '/api/auth/login')
 * @param options - Standard RequestInit options (method, body, etc.)
 * @returns Parsed JSON response typed as T
 */
export async function httpClient<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // Retrieve the stored JWT token
  const token = localStorage.getItem('peerlink_token');

  // Build headers — always include JSON content type for POST/PATCH
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  // Attach Authorization header if we have a token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Execute the fetch request
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    // Serialize body as JSON if it's an object
    body: options.body
      ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
      : undefined,
  });

  // Parse the response body (always JSON for our API)
  let data: { error?: string; code?: number } & Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    // If response body isn't JSON (e.g., 204 No Content), return empty
    if (response.ok) return {} as T;
    throw new ApiError(`HTTP ${response.status}: Non-JSON error response`, response.status);
  }

  // Check for HTTP errors (non-2xx status codes)
  if (!response.ok) {
    const message = typeof data.error === 'string'
      ? data.error
      : `HTTP ${response.status} Error`;
    throw new ApiError(message, response.status, data.code);
  }

  return data as T;
}

// ── Convenience method shortcuts ───────────────────────────────

/** GET /api/... */
export const api = {
  get: <T>(path: string) =>
    httpClient<T>(path, { method: 'GET' }),

  post: <T>(path: string, body: unknown) =>
    httpClient<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  patch: <T>(path: string, body: unknown) =>
    httpClient<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: <T>(path: string) =>
    httpClient<T>(path, { method: 'DELETE' }),
};
