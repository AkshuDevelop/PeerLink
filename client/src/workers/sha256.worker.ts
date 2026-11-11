/**
 * ============================================================
 * FILE PURPOSE:
 *   Incremental SHA-256 Web Worker using the hash-wasm library.
 *   Runs in a separate thread to hash files without freezing the UI.
 *   Supports two modes:
 *     1. HASH_FILE: Hash an entire File object in 1MB chunks (for sender)
 *     2. UPDATE + DIGEST: Incremental update per 64KB chunk (for receiver)
 *
 * ARCHITECTURAL LAYER:
 *   Frontend — Web Worker (Off-Main-Thread Computing)
 *
 * CONNECTED MODULES:
 *   - Instantiated by: fileTransferService.ts (sender hashing)
 *   - Instantiated by: fileTransferService.ts (receiver incremental hashing)
 *   - Uses: hash-wasm createSHA256()
 *
 * WHY A WEB WORKER:
 *   SHA-256 hashing a 2GB file in the main thread would block the UI
 *   for several seconds, causing the browser to show "Page Unresponsive".
 *   Running it in a Worker thread means the UI stays perfectly responsive
 *   while hashing progress is reported back via postMessage.
 * ============================================================
 */

import { createSHA256, type IHasher } from 'hash-wasm';
import { sha256 } from 'js-sha256';

// ── Hasher state (persisted between incremental UPDATE messages) ──
let hasher: IHasher | any = null;
let isJsHasher = false;

async function getNewHasher() {
  try {
    const h = await createSHA256();
    h.init();
    isJsHasher = false;
    return h;
  } catch (err) {
    console.warn('[sha256.worker] WASM init failed in worker, falling back to pure-JS sha256:', err);
    isJsHasher = true;
    return sha256.create();
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { type, chunk, file } = event.data;

  try {
    if (type === 'HASH_FILE') {
      // ── Mode 1: Full file hashing (Sender, before sending offer) ──
      await hashFullFile(file as File);

    } else if (type === 'RESET') {
      // ── Mode 2a: Initialize incremental hasher ──
      hasher = await getNewHasher();
      self.postMessage({ type: 'READY' });

    } else if (type === 'UPDATE') {
      // ── Mode 2b: Feed one chunk to the hasher ──
      if (!hasher) {
        hasher = await getNewHasher();
      }
      const data = new Uint8Array(chunk as ArrayBuffer);
      hasher.update(data);

    } else if (type === 'DIGEST') {
      // ── Mode 2c: Finalize and return the hash ──
      if (!hasher) {
        self.postMessage({ type: 'ERROR', error: 'Hasher not initialized — call RESET first' });
        return;
      }
      const hash = isJsHasher ? hasher.hex() : hasher.digest('hex');
      hasher = null;
      self.postMessage({ type: 'RESULT', hash: String(hash).toLowerCase() });
    }
  } catch (err) {
    self.postMessage({
      type: 'ERROR',
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

async function hashFullFile(file: File): Promise<void> {
  const SHA256_CHUNK_SIZE = 1024 * 1024; // 1 MB per read slice
  const totalSlices = Math.ceil(file.size / SHA256_CHUNK_SIZE);

  let h: any;
  let useJs = false;
  try {
    h = await createSHA256();
    h.init();
  } catch {
    h = sha256.create();
    useJs = true;
  }

  // Process the file in 1MB slices
  for (let i = 0; i < totalSlices; i++) {
    const start = i * SHA256_CHUNK_SIZE;
    const end = Math.min(start + SHA256_CHUNK_SIZE, file.size);

    const sliceBuffer = await file.slice(start, end).arrayBuffer();
    h.update(new Uint8Array(sliceBuffer));

    const percent = Math.round(((i + 1) / totalSlices) * 100);
    self.postMessage({ type: 'PROGRESS', percent });
  }

  const hash = useJs ? h.hex() : h.digest('hex');
  self.postMessage({ type: 'RESULT', hash: String(hash).toLowerCase() });
}
