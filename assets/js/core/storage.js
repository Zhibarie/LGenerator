// ─── SAFE STORAGE LAYER ─────────────────────────────────────────────────────
// Wraps localStorage AND IndexedDB with proper error handling.
// - localStorage  → lightweight text (state snapshot, small metadata)
// - IndexedDB     → binary blobs (PDF/JPG/PNG attachments, signature, CV photo)
//
// All public methods are async + never throw silently. Errors propagate as
// typed results so UI can show "Gagal menyimpan" instead of fake "Tersimpan".

import { STORAGE, FILE_LIMITS } from './constants.js';
import { uuid } from './utils.js';

// ── Internal: localStorage wrapper ─────────────────────────────────────────
function lsAvailable() {
  try {
    const t = '__lgen_test__';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    return true;
  } catch (e) {
    return false;
  }
}

const LS_OK = lsAvailable();

const LS = {
  get(key) {
    if (!LS_OK) return null;
    try { return localStorage.getItem(key); }
    catch (e) { console.warn('[Storage] localStorage.getItem failed:', e); return null; }
  },
  set(key, value) {
    if (!LS_OK) return { ok: false, reason: 'unavailable' };
    try {
      localStorage.setItem(key, value);
      return { ok: true };
    } catch (e) {
      const quota = e && (e.name === 'QuotaExceededError' || e.code === 22);
      return {
        ok: false,
        reason: quota ? 'quota' : 'unknown',
        error: e,
      };
    }
  },
  remove(key) {
    if (!LS_OK) return;
    try { localStorage.removeItem(key); }
    catch (e) { console.warn('[Storage] localStorage.removeItem failed:', e); }
  },
  keys(prefix) {
    if (!LS_OK) return [];
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) out.push(k);
    }
    return out;
  },
};

// ── Internal: IndexedDB wrapper ────────────────────────────────────────────
let idbPromise = null;

function idbAvailable() {
  return typeof indexedDB !== 'undefined';
}

function openIdb() {
  if (!idbAvailable()) return Promise.reject(new Error('IndexedDB tidak tersedia.'));
  if (idbPromise) return idbPromise;

  idbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(STORAGE.idbName, STORAGE.idbVersion);
    req.onupgradeneeded = e => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORAGE.idbStoreAttachments)) {
        db.createObjectStore(STORAGE.idbStoreAttachments, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORAGE.idbStoreBlobs)) {
        db.createObjectStore(STORAGE.idbStoreBlobs, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open error'));
    req.onblocked = () => reject(new Error('IndexedDB blocked. Tutut tab lain yang menggunakan storage ini.'));
  });

  // If IDB fails once, don't cache the failure
  idbPromise.catch(() => { idbPromise = null; });

  return idbPromise;
}

function idbTx(store, mode = 'readonly') {
  return openIdb().then(db => db.transaction(store, mode).objectStore(store));
}

function idbReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB error'));
  });
}

// ── Public API ─────────────────────────────────────────────────────────────
export const Storage = {
  // ── Lightweight text (localStorage) ────────────────────────────────────
  getText(key) {
    return LS.get(STORAGE.keyPrefix + key);
  },
  setText(key, value) {
    const r = LS.set(STORAGE.keyPrefix + key, value);
    if (!r.ok && r.reason === 'quota') {
      console.warn('[Storage] localStorage quota exceeded for', key);
    }
    return r;
  },
  removeText(key) {
    LS.remove(STORAGE.keyPrefix + key);
  },
  /** Save JSON state. Returns {ok, reason?} */
  setJSON(key, obj) {
    try {
      const json = JSON.stringify(obj);
      return LS.set(STORAGE.keyPrefix + key, json);
    } catch (e) {
      return { ok: false, reason: 'serialize', error: e };
    }
  },
  getJSON(key) {
    const raw = LS.get(STORAGE.keyPrefix + key);
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch (e) {
      console.warn('[Storage] JSON parse failed for', key, e);
      return null;
    }
  },

  // ── Binary blobs (IndexedDB) ──────────────────────────────────────────
  /** Save an attachment blob. Returns {id} on success. */
  async putAttachmentBlob({ id, name, type, size, blob, rotation, pages }) {
    if (!idbAvailable()) {
      return { ok: false, reason: 'IndexedDB tidak tersedia di browser ini.' };
    }
    try {
      const store = await idbTx(STORAGE.idbStoreAttachments, 'readwrite');
      await idbReq(store.put({
        id, name, type, size, blob, rotation: rotation || 0, pages: pages || 1,
        createdAt: Date.now(),
      }));
      return { ok: true, id };
    } catch (e) {
      console.error('[Storage] putAttachmentBlob failed:', e);
      return { ok: false, reason: e?.message || 'IndexedDB error', error: e };
    }
  },

  async getAttachmentBlob(id) {
    if (!idbAvailable()) return null;
    try {
      const store = await idbTx(STORAGE.idbStoreAttachments);
      return await idbReq(store.get(id));
    } catch (e) {
      console.error('[Storage] getAttachmentBlob failed:', e);
      return null;
    }
  },

  async deleteAttachmentBlob(id) {
    if (!idbAvailable()) return { ok: false, reason: 'unavailable' };
    try {
      const store = await idbTx(STORAGE.idbStoreAttachments, 'readwrite');
      await idbReq(store.delete(id));
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e?.message };
    }
  },

  /** Save a misc blob (signature / cv photo). `id` is caller-provided key. */
  async putBlob(id, blob, meta = {}) {
    if (!idbAvailable()) return { ok: false, reason: 'IndexedDB tidak tersedia.' };
    try {
      const store = await idbTx(STORAGE.idbStoreBlobs, 'readwrite');
      await idbReq(store.put({ id, blob, ...meta, createdAt: Date.now() }));
      return { ok: true, id };
    } catch (e) {
      return { ok: false, reason: e?.message };
    }
  },

  async getBlob(id) {
    if (!idbAvailable()) return null;
    try {
      const store = await idbTx(STORAGE.idbStoreBlobs);
      const rec = await idbReq(store.get(id));
      return rec ? rec.blob : null;
    } catch (e) {
      console.error('[Storage] getBlob failed:', e);
      return null;
    }
  },

  async deleteBlob(id) {
    if (!idbAvailable()) return;
    try {
      const store = await idbTx(STORAGE.idbStoreBlobs, 'readwrite');
      await idbReq(store.delete(id));
    } catch (e) { /* ignore */ }
  },

  // ── Cleanup helpers ────────────────────────────────────────────────────
  /** Wipe everything (used by Reset All) */
  async wipeAll() {
    // localStorage
    LS.keys(STORAGE.keyPrefix).forEach(k => LS.remove(k));
    // IndexedDB
    if (!idbAvailable()) return;
    try {
      const db = await openIdb();
      db.close();
      idbPromise = null;
      await new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase(STORAGE.idbName);
        req.onsuccess = resolve;
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve(); // best-effort
      });
    } catch (e) {
      console.warn('[Storage] IDB delete failed:', e);
    }
  },

  /** List orphaned blobs (debug). */
  async listBlobKeys() {
    if (!idbAvailable()) return [];
    try {
      const store = await idbTx(STORAGE.idbStoreBlobs);
      return await idbReq(store.getAllKeys());
    } catch (e) { return []; }
  },

  // ── Capability checks ──────────────────────────────────────────────────
  isLsAvailable() { return LS_OK; },
  isIdbAvailable() { return idbAvailable(); },

  // ── File validation ────────────────────────────────────────────────────
  validateAttachment(file) {
    if (!file) return { ok: false, reason: 'File tidak ditemukan.' };
    if (file.size > FILE_LIMITS.maxAttachmentBytes) {
      return {
        ok: false,
        reason: `File terlalu besar (maks ${Math.round(FILE_LIMITS.maxAttachmentBytes / 1024 / 1024)}MB).`,
      };
    }
    const okType = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      || /\.(pdf|jpe?g|png|webp)$/i.test(file.name);
    if (!okType) {
      return { ok: false, reason: 'Tipe file tidak diizinkan. Gunakan PDF, JPG, PNG, atau WEBP.' };
    }
    return { ok: true };
  },
};
