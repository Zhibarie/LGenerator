// ─── CV STORAGE ─────────────────────────────────────────────────────────────
// CV-specific persistence. CV state is part of AppState (in localStorage snapshot),
// but photo is a Blob in IndexedDB.

import { AppState } from '../core/state.js';
import { Storage } from '../core/storage.js';
import { FILE_LIMITS } from '../core/constants.js';
import { fileToDataUrl } from '../core/utils.js';

const PHOTO_KEY = 'cv:photo';

export const CvStorage = {
  /** Save a photo file to IDB. Validates + caps size. */
  async savePhoto(file) {
    if (!file) return { ok: false, reason: 'File tidak ditemukan.' };
    if (file.size > FILE_LIMITS.maxPhotoBytes) {
      return { ok: false, reason: `Ukuran foto maks ${Math.round(FILE_LIMITS.maxPhotoBytes / 1024 / 1024)}MB.` };
    }
    if (!/^image\//.test(file.type)) {
      return { ok: false, reason: 'Foto harus berupa gambar.' };
    }
    try {
      const r = await Storage.putBlob(PHOTO_KEY, file, { type: file.type });
      if (!r.ok) return r;
      // Set key in state — actual blob is in IDB
      AppState.setCvPhoto(PHOTO_KEY);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e?.message || 'unknown' };
    }
  },

  async getPhotoUrl() {
    const blob = await Storage.getBlob(PHOTO_KEY);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  },

  async clearPhoto() {
    await Storage.deleteBlob(PHOTO_KEY);
    AppState.setCvPhoto(null);
  },

  PHOTO_KEY,
};
