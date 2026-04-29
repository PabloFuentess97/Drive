/**
 * Tiny IndexedDB wrapper used by the offline cache. We persist file blobs and
 * their metadata so the user can browse/preview while offline and can replay
 * upload operations once connectivity is back.
 */

const DB_NAME = "personal-drive";
const DB_VERSION = 1;

const STORE_FILES = "files";
const STORE_QUEUE = "uploadQueue";

export interface CachedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  cachedAt: number;
}

export interface QueuedUpload {
  id: string;
  folderId: string | null;
  name: string;
  blob: Blob;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: "id" });
      }
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const offlineDb = {
  saveFile(file: CachedFile) {
    return tx(STORE_FILES, "readwrite", (s) => s.put(file));
  },
  getFile(id: string): Promise<CachedFile | undefined> {
    return tx(STORE_FILES, "readonly", (s) => s.get(id) as IDBRequest<CachedFile | undefined>);
  },
  listFiles(): Promise<CachedFile[]> {
    return tx(STORE_FILES, "readonly", (s) => s.getAll() as IDBRequest<CachedFile[]>);
  },
  deleteFile(id: string) {
    return tx(STORE_FILES, "readwrite", (s) => s.delete(id));
  },
  queueUpload(item: QueuedUpload) {
    return tx(STORE_QUEUE, "readwrite", (s) => s.put(item));
  },
  listQueued(): Promise<QueuedUpload[]> {
    return tx(STORE_QUEUE, "readonly", (s) => s.getAll() as IDBRequest<QueuedUpload[]>);
  },
  removeQueued(id: string) {
    return tx(STORE_QUEUE, "readwrite", (s) => s.delete(id));
  },
};

/**
 * Replays queued uploads when the connection is restored. Returns the number
 * of items successfully synced.
 */
export async function syncQueuedUploads(): Promise<number> {
  const items = await offlineDb.listQueued();
  let synced = 0;
  for (const item of items) {
    const form = new FormData();
    form.append("file", new File([item.blob], item.name, { type: item.blob.type }));
    if (item.folderId) form.append("folderId", item.folderId);
    try {
      const res = await fetch("/api/files", { method: "POST", body: form });
      if (res.ok) {
        await offlineDb.removeQueued(item.id);
        synced++;
      }
    } catch {
      // remain queued
    }
  }
  return synced;
}
