/**
 * ============================================================
 * FILE PURPOSE:
 *   Vite build configuration for PeerLink's React client.
 *   Sets up the development proxy (/api and /socket.io → Express backend),
 *   enables `--host` for LAN access from mobile phones, and configures
 *   the Web Worker build for the sha256.worker.ts.
 *
 * ARCHITECTURAL LAYER:
 *   Build Tool Configuration
 *
 * PROXY RATIONALE (Critical for Laptop-to-Phone compatibility):
 *   In development, Vite runs on :5173 and Express on :4000.
 *   The proxy makes /api and /socket.io requests from the browser
 *   appear to come from the same origin as the Vite dev server.
 *   This eliminates CORS issues and allows mobile phones to test
 *   via a single URL (e.g., http://192.168.1.X:5173).
 * ============================================================
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    // host: true allows the Vite dev server to bind to 0.0.0.0
    // so it's accessible from mobile phones on the same Wi-Fi network.
    // Mobile users navigate to http://<laptop-lan-ip>:5173
    host: true,
    port: 5173,

    // Vite 5.4.16+ rejects requests whose Host header isn't allowed (DNS-rebinding
    // protection). Tailscale Funnel reaches Vite with the public tailnet hostname,
    // so allow that suffix here. Add any other tunnel domains you use.
    allowedHosts: ['.ts.net', '.trycloudflare.com', '.ngrok-free.app'],

    proxy: {
      // Proxy all /api requests to the Express backend
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        // No rewrite needed — Express expects /api prefix
      },
      // Proxy Socket.IO WebSocket connections to Express/Socket.IO server
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxy (critical for Socket.IO)
      },
    },
  },

  // Web Worker configuration — the sha256.worker.ts uses hash-wasm (WASM module)
  // Vite handles Worker imports when using new URL('./workers/sha256.worker.ts', import.meta.url)
  worker: {
    format: 'es',
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    // Increase chunk size limit warning (hash-wasm WASM is ~300KB)
    chunkSizeWarningLimit: 1000,
  },
});
