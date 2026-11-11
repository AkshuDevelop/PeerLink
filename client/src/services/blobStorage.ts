/**
 * ============================================================
 * FILE PURPOSE:
 *   Persistent IndexedDB storage for received file Blobs.
 *   Ensures that even if the user refreshes /transfer/:id/result
 *   or navigates away and comes back, the received file Blob
 *   persists in the browser's local database and can still be
 *   downloaded with 100% reliability.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend — Client Persistence Service (IndexedDB)
 * ============================================================
 */

const DB_NAME = 'peerlink_blobs_db';
const DB_VERSION = 1;
const STORE_NAME = 'received_files';

interface StoredBlobRecord {
  key: string;       // sessionCode or transferId
  filename: string;
  blob: Blob;
  mimeType: string;
  savedAt: number;
}

function openBlobDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Save a received file Blob to IndexedDB.
 */
export async function saveReceivedBlob(
  key: string,
  blob: Blob,
  filename: string,
  mimeType = 'application/octet-stream'
): Promise<void> {
  try {
    const db = await openBlobDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record: StoredBlobRecord = {
      key,
      filename,
      blob,
      mimeType,
      savedAt: Date.now(),
    };

    store.put(record);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[blobStorage] Could not persist blob to IndexedDB:', err);
  }
}

/**
 * Retrieve a received file Blob from IndexedDB by sessionCode or transferId.
 */
export async function getReceivedBlob(
  key: string
): Promise<{ blob: Blob; filename: string; mimeType: string } | null> {
  try {
    const db = await openBlobDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);

    const record = await new Promise<StoredBlobRecord | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as StoredBlobRecord | undefined);
      req.onerror = () => reject(req.error);
    });

    if (record && record.blob) {
      return {
        blob: record.blob,
        filename: record.filename,
        mimeType: record.mimeType,
      };
    }
  } catch (err) {
    console.warn('[blobStorage] Could not read blob from IndexedDB:', err);
  }
  return null;
}
