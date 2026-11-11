/**
 * ============================================================
 * FILE PURPOSE:
 *   MongoDB connection manager for PeerLink's Express backend.
 *   Establishes a Mongoose connection to MongoDB Atlas (if
 *   MONGODB_URI is set in .env) OR automatically falls back to
 *   an in-memory MongoMemoryServer instance so the app works
 *   100% out-of-the-box with zero local MongoDB installation.
 *
 * ARCHITECTURAL LAYER:
 *   Infrastructure / Database Configuration
 *   (called once at server startup from server/src/index.ts)
 *
 * CONNECTED MODULES:
 *   - Called by: server/src/index.ts (connectDB import)
 *   - Calls out to: mongoose.connect(), MongoMemoryServer.create()
 * ============================================================
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables from server/.env
dotenv.config();

/**
 * connectDB — Establishes Mongoose connection with automatic fallback.
 *
 * WHAT IT DOES:
 *   1. Checks process.env.MONGODB_URI. If set, connects Mongoose to it.
 *   2. If MONGODB_URI is not set, dynamically imports mongodb-memory-server,
 *      starts an in-memory MongoDB instance, and connects Mongoose to it.
 *   3. Logs clearly whether we are using Atlas or the in-memory server.
 *
 * CALLED BY: server/src/index.ts at startup.
 *
 * WHY THIS MATTERS:
 *   Developers should be able to clone and run with zero config. Using
 *   mongodb-memory-server means the full Mongoose schema validation,
 *   indexes, and state transitions work identically to production Atlas,
 *   just without persistence across restarts.
 */
export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  // Register connection lifecycle listeners for observability in production
  mongoose.connection.on('error', (err) => {
    console.error('[DB] ❌ MongoDB connection error:', err);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] ⚠️  MongoDB disconnected. Reconnecting automatically...');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('[DB] 🔄 MongoDB reconnected successfully.');
  });

  if (uri) {
    // ✅ Atlas / external MongoDB URI provided — connect directly.
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000, // Timeout fast (10s) if credentials/IP whitelist fails
      });
      // Mask credentials in logs for security
      const safeUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
      console.log('[DB] ✅ Connected to MongoDB:', safeUri);

      // Handle graceful shutdown on Render / Cloud container restarts (SIGTERM)
      const shutdown = async () => {
        await mongoose.connection.close();
        console.log('[DB] 🛑 MongoDB connection closed cleanly.');
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } catch (err) {
      console.error('[DB] ❌ Failed to connect to MongoDB Atlas:', err);
      console.error('[DB] 💡 TIP: Ensure your IP is whitelisted (0.0.0.0/0) in MongoDB Atlas Network Access and password is correct.');
      process.exit(1);
    }
  } else {
    // 🔄 No URI provided — start an in-memory MongoDB server.
    // We use dynamic import so the heavy mongodb-memory-server package
    // is only loaded in development / no-config scenarios.
    console.log('[DB] ⚠️  MONGODB_URI not set. Starting in-memory MongoDB server...');

    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      // MongoMemoryServer.create() downloads and starts a real mongod binary
      // but keeps its data only in memory — perfect for zero-setup development.
      const memServer = await MongoMemoryServer.create();
      const memUri = memServer.getUri();

      await mongoose.connect(memUri);
      console.log('[DB] ✅ In-memory MongoDB running at:', memUri);
      console.log('[DB] ℹ️  Data will be lost on restart. Set MONGODB_URI for persistence.');

      // Graceful shutdown: stop the in-memory server when Node exits
      const shutdown = async () => {
        await mongoose.connection.close();
        await memServer.stop();
        console.log('[DB] 🛑 In-memory MongoDB stopped.');
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } catch (err) {
      console.error('[DB] ❌ Failed to start in-memory MongoDB:', err);
      process.exit(1);
    }
  }
}
