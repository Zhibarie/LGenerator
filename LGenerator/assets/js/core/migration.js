// ─── MIGRATION ─────────────────────────────────────────────────────────────
// Handles schema version bumps + one-time data transforms.
// Idempotent: running migration twice on the same data is a no-op.

import { Storage } from './storage.js';
import { STORAGE, DEFAULT_ATTACHMENTS, DEFAULT_LETTER } from './constants.js';
import { EventBus, EVT } from './events.js';
import { uuid } from './utils.js';

/**
 * v1 (legacy backend.js) layout:
 *   localStorage.ls_<key>          — letter fields (innerText)
 *   localStorage.ls_attachments    — JSON array of strings
 *   localStorage.ls_sig            — data URL
 *   localStorage.ls_cv_<key>       — CV fields
 *   localStorage.ls_cv_photo        — data URL (large!)
 *   localStorage.ls_cv_edu         — JSON
 *   localStorage.ls_cv_exp         — JSON
 *
 * v2 (new state.js):
 *   localStorage.lgen_state        — single JSON snapshot of AppState
 *   IndexedDB.attachments / .blobs  — binary blobs
 *
 * The migration reads v1, writes v2, but NEVER deletes v1 keys — user can
 * roll back manually if needed. v1 keys can be cleaned up later via cleanLegacy().
 */

const LEGACY_PREFIX = 'ls_';

function readLegacy(key) {
  try { return localStorage.getItem(LEGACY_PREFIX + key); }
  catch (e) { return null; }
}

export const Migration = {
  /**
   * Run migration if needed. Returns { migrated, version, error? }.
   */
  async run() {
    const meta = Storage.getJSON('meta') || { version: 0 };

    // Already at current version — nothing to do
    if (meta.version === STORAGE.version) {
      return { migrated: false, version: meta.version };
    }

    let v1State = null;
    if (meta.version === 0) {
      // Attempt legacy (v1) detection
      v1State = await Migration.readV1();
    }

    // Build v2 state by merging v1 (if any) with defaults
    const v2 = Migration.buildV2(v1State);

    // Persist text snapshot
    const r = Storage.setJSON('state', v2);
    if (!r.ok) {
      // localStorage failed — keep state in memory only
      EventBus.emit(EVT.STATE_SAVE_FAILED, r);
      return { migrated: false, version: meta.version, error: r.reason };
    }

    // If we have legacy photo/sig as data URL, push them to IDB
    if (v1State?.signature) {
      await migrateDataUrlToBlob('sig:main', v1State.signature, 'image/png');
    }
    if (v1State?.cv?.photo) {
      await migrateDataUrlToBlob('cv:photo', v1State.cv.photo, 'image/png');
    }

    // Mark version
    Storage.setJSON('meta', {
      version: STORAGE.version,
      migratedAt: new Date().toISOString(),
    });

    EventBus.emit(EVT.NOTIFY, {
      type: v1State ? 'success' : 'info',
      msg: v1State
        ? 'Data lama berhasil dimigrasi ke struktur baru.'
        : 'Penyimpanan diinisialisasi.',
    });

    return { migrated: true, version: STORAGE.version };
  },

  /**
   * Read v1 (legacy) data. Returns null if no v1 data exists.
   */
  async readV1() {
    const hasV1 = readLegacy('nama') || readLegacy('cv_nama');
    if (!hasV1) return null;

    const fields = {};
    const fieldKeys = Object.keys(DEFAULT_LETTER);
    fieldKeys.forEach(k => {
      const v = readLegacy(k);
      if (v !== null) fields[k] = v;
    });

    let attachments = DEFAULT_ATTACHMENTS.map(text => ({ id: uuid(), text, attachmentId: null }));
    const lsAtt = readLegacy('attachments');
    if (lsAtt) {
      try {
        const arr = JSON.parse(lsAtt);
        if (Array.isArray(arr)) {
          attachments = arr.map(text => ({ id: uuid(), text, attachmentId: null }));
        }
      } catch (e) { /* ignore malformed */ }
    }

    const signature = readLegacy('sig') || null;

    const cvProfile = {};
    ['nama', 'posisi', 'telepon', 'email', 'alamat', 'ttl', 'jk', 'agama', 'status', 'tentang']
      .forEach(k => {
        const v = readLegacy('cv_' + k);
        if (v !== null) cvProfile[k] = v;
      });

    const cvPhoto = readLegacy('cv_photo') || null;

    let education = [];
    let experience = [];
    try {
      const e = readLegacy('cv_edu');
      if (e) education = JSON.parse(e);
      const x = readLegacy('cv_exp');
      if (x) experience = JSON.parse(x);
    } catch (e) { /* ignore */ }

    return {
      letter: { fields, attachments },
      signature,
      cv: { profile: cvProfile, photo: cvPhoto, education, experience },
    };
  },

  /**
   * Build v2 state by merging legacy (if any) with defaults.
   */
  buildV2(v1) {
    const v2 = {
      version: STORAGE.version,
      letter: {
        fields: { ...DEFAULT_LETTER, ...(v1?.letter?.fields || {}) },
        formatting: { fontSizePt: 12 },
        attachments: v1?.letter?.attachments || DEFAULT_ATTACHMENTS.map(text => ({ id: uuid(), text, attachmentId: null })),
      },
      cv: {
        profile: v1?.cv?.profile || {
          nama: '', posisi: '', telepon: '', email: '', alamat: '',
          ttl: '', jk: 'Laki-laki', agama: 'Islam', status: 'Belum Kawin', tentang: '',
        },
        photo: v1?.cv?.photo ? 'cv:photo' : null,
        education: Array.isArray(v1?.cv?.education) ? v1.cv.education : [],
        experience: Array.isArray(v1?.cv?.experience) ? v1.cv.experience : [],
      },
      attachments: [], // v1 didn't persist binary attachments; user re-uploads
      signature: v1?.signature ? 'sig:main' : null,
      ui: { isDirty: false, isMobile: false, orientation: 'portrait', activeTab: 'surat', activeModal: null, isExporting: false },
    };
    // Ensure each CV item has an id
    v2.cv.education = v2.cv.education.map(item => ({ id: item.id || uuid(), ...item }));
    v2.cv.experience = v2.cv.experience.map(item => ({ id: item.id || uuid(), ...item }));
    return v2;
  },

  /**
   * Optional: remove legacy `ls_*` keys after migration is verified working.
   * Safe to call multiple times.
   */
  async cleanLegacy() {
    try {
      const keys = [];
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(LEGACY_PREFIX)) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
      return { ok: true, removed: keys.length };
    } catch (e) {
      return { ok: false, error: e };
    }
  },

  /** Get current schema version */
  currentVersion() {
    const meta = Storage.getJSON('meta');
    return meta?.version || 0;
  },
};

// Helper: migrate legacy data URL → IndexedDB blob
async function migrateDataUrlToBlob(id, dataUrl, mime) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    await Storage.putBlob(id, blob, { type: mime });
  } catch (e) {
    console.warn('[Migration] failed to migrate blob', id, e);
  }
}
