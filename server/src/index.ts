/**
 * ============================================================
 * FILE PURPOSE:
 *   Main entry point for the PeerLink Express + Socket.IO server.
 *   Bootstraps the HTTP server, registers all middleware, mounts
 *   route handlers, initializes Socket.IO signalling, connects
 *   to MongoDB, and starts listening on the configured port.
 *
 * ARCHITECTURAL LAYER:
 *   Server Entry Point / Bootstrapper
 *
 * CONNECTED MODULES:
 *   - Calls: config/db.ts (MongoDB connection)
 *   - Mounts: routes/authRoutes.ts, contactRoutes.ts, transferRoutes.ts
 *   - Initializes: socket/socketManager.ts
 *   - Registers: middleware/errorHandler.ts
 *   - In production: serves client/dist static files
 * ============================================================
 */

import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';

import { connectDB } from './config/db';
import authRoutes from './routes/authRoutes';
import contactRoutes from './routes/contactRoutes';
import transferRoutes from './routes/transferRoutes';
import { initSocketManager } from './socket/socketManager';
import { errorHandler } from './middleware/errorHandler';

// Load environment variables from server/.env
dotenv.config();

// ================================================================
// 1. Create Express app and HTTP server
// ================================================================
const app = express();
const httpServer = http.createServer(app);

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ================================================================
// 2. CORS Configuration
// ================================================================
/**
 * In development: Vite runs on :5173 and proxies /api + /socket.io to :4000.
 * In production: Express serves the built client/dist files directly,
 *   so the client and API share the same origin.
 *
 * Setting `origin: true` in production reflects the incoming Origin header,
 * ensuring Socket.IO WebSockets and API requests work seamlessly across
 * Render subdomains (*.onrender.com), custom domains, and Cloudflare tunnels.
 * Users can also override this via the CORS_ORIGIN environment variable.
 */
const corsOriginMatcher = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : IS_PRODUCTION
  ? true
  : [
      'http://localhost:5173',
      'http://localhost:4000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4000',
      /^http:\/\/192\.168\./,
      /^http:\/\/10\./,
      /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /\.trycloudflare\.com$/,
      /\.ts\.net$/,
      /\.ngrok-free\.app$/,
      /\.ngrok\.io$/,
    ];

app.use(cors({
  origin: corsOriginMatcher,
  credentials: true,
}));

// ================================================================
// 3. Body Parsing Middleware
// ================================================================
app.use(express.json({ limit: '1mb' }));     // Parse JSON request bodies
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ================================================================
// 4. Rate Limiting (Auth endpoints only)
// ================================================================
/**
 * Protects the registration and login endpoints against brute-force attacks.
 * Limits each IP to 20 auth requests per 15-minute window.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO MANY REQUESTS — SLOW DOWN', code: 429 },
});

// ================================================================
// 5. API Routes
// ================================================================
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/transfers', transferRoutes);

// ================================================================
// 6. Health Check Endpoint
// ================================================================
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    service: 'PeerLink API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ================================================================
// 7. Production Static File Serving
// ================================================================
/**
 * In production, Express serves the compiled React app.
 * This creates a single-origin deployment: everything runs on PORT 4000.
 * Mobile phones and laptops connect to the same server and origin —
 * no CORS issues, no mixed-content warnings.
 *
 * Vite output is at client/dist (from npm run build --prefix client).
 */
if (IS_PRODUCTION) {
  const rawDistPath = process.env.CLIENT_DIST_PATH ?? path.join(__dirname, '../../client/dist');
  const clientDistPath = path.isAbsolute(rawDistPath)
    ? rawDistPath
    : path.resolve(process.cwd(), rawDistPath);

  app.use(express.static(clientDistPath));

  // SPA fallback: return index.html for all non-API routes so React Router works
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// ================================================================
// 8. Centralized Error Handler (must be LAST middleware)
// ================================================================
app.use(errorHandler);

// ================================================================
// 9. Socket.IO Server Setup
// ================================================================
/**
 * Socket.IO is attached to the same HTTP server as Express.
 * This means both REST API and WebSocket connections share PORT 4000.
 * Vite's proxy (/socket.io → localhost:4000) handles the development setup.
 */
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: corsOriginMatcher,
    credentials: true,
  },
  // 100 MB max buffer prevents Engine.IO from aborting WebSocket connections on large bursts
  maxHttpBufferSize: 1e8,
  // Enable WebSocket transport with Long-Polling fallback for compatibility
  transports: ['websocket', 'polling'],
});

// Make `io` accessible to route handlers via `req.app.get('io')`
// This allows routes to emit events (e.g., notify recipient of incoming offer)
app.set('io', io);

// Initialize all Socket.IO event handlers
initSocketManager(io);

// ================================================================
// 10. Start the Server
// ================================================================
async function startServer(): Promise<void> {
  // Connect to MongoDB first (blocks until connection is established)
  await connectDB();

  // Start listening on PORT
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║           PEERLINK SERVER ONLINE             ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  API:      http://localhost:${PORT}/api/health  `);
    console.log(`║  Socket:   ws://localhost:${PORT}               `);
    console.log(`║  Mode:     ${IS_PRODUCTION ? 'PRODUCTION     ' : 'DEVELOPMENT    '}`);
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
    console.log('[Server] ✅ Ready — waiting for peer connections...');
  });
}

// Launch (and handle startup errors)
startServer().catch((err) => {
  console.error('[Server] ❌ Fatal startup error:', err);
  process.exit(1);
});
