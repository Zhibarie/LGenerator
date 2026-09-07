// ─── ATTACHMENT STORAGE (IndexedDB wrapper) ────────────────────────────────
// Bridges AppState.attachments (metadata only) ↔ IndexedDB (binary blobs).
//
// Why split? AppState is plain JSON (serializable to localStorage), but
// binary blobs don't belong in localStorage (5MB limit, base64 inflation).
// So we keep metadata in AppState (text), and binary in IndexedDB.

import { Storage } from '../core/storage.js';
import { EventBus, EVT } from '../core/events.js';
import { A4, FILE_LIMITS } from '../core/constants.js';
import { uuid, loadImage, bufferToDataUrl, sleep, nextFrame } from '../core/utils.js';

// Lazy-loaded PDF.js (so we don't pay the cost on first paint)
let pdfjsPromise = null;
async function getPdfjs() {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise((resolve, reject) => {
    if (typeof window.pdfjsLib === 'undefined') {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.integrity = 'sha512-7oIu5i+8m1yJ8lN5d7l0t7R5O7J5V5d8e7R5O5V5d8e7R5O5V5d8e7R5O5V5d8e7R5O5V5d8e7R5O5V5d8e=';
      s.crossOrigin = 'anonymous';
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      s.onerror = () => reject(new Error('Gagal memuat PDF.js. Coba lagi.'));
      document.head.appendChild(s);
    } else {
      resolve(window.pdfjsLib);
    }
  });
  return pdfjsPromise;
}

export const AttachmentStorage = {
  /**
   * Save a File as an attachment. Returns { ok, attachment } on success.
   * Validates size + type, reads into Blob, stores in IndexedDB, updates AppState.
   */
  async save(file) {
    const validation = Storage.validateAttachment(file);
    if (!validation.ok) {
      return { ok: false, reason: validation.reason };
    }

    const id = uuid();
    let pages = 1;

    // For PDFs, count pages first (also validates the PDF is not malformed)
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const buf = await file.arrayBuffer();
        const pdfjs = await getPdfjs();
        const pdf = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
        pages = pdf.numPages;
        if (pages > FILE_LIMITS.maxPdfPagesHard) {
          return { ok: false, reason: `PDF memiliki ${pages} halaman (maks ${FILE_LIMITS.maxPdfPagesHard}).` };
        }
        // Store the ArrayBuffer in IDB so we don't re-read later
        const r = await Storage.putAttachmentBlob({
          id, name: file.name, type: 'application/pdf',
          size: file.size, blob: buf, rotation: 0, pages,
        });
        if (!r.ok) return r;
      } catch (e) {
        console.error('[AttachmentStorage] PDF parse failed:', e);
        return { ok: false, reason: 'PDF rusak atau tidak dapat dibaca.' };
      }
    } else {
      // Image — store as Blob, no need to re-read now
      try {
        const buf = await file.arrayBuffer();
        const r = await Storage.putAttachmentBlob({
          id, name: file.name, type: file.type || 'image/jpeg',
          size: file.size, blob: buf, rotation: 0, pages: 1,
        });
        if (!r.ok) return r;
      } catch (e) {
        return { ok: false, reason: 'Gagal menyimpan gambar: ' + (e?.message || 'unknown') };
      }
    }

    const meta = {
      id, name: file.name, type: file.type || 'application/octet-stream',
      size: file.size, rotation: 0, pages,
    };
    return { ok: true, attachment: meta };
  },

  /**
   * Fetch the binary Blob from IDB by attachment id.
   */
  async getBlob(id) {
    const rec = await Storage.getAttachmentBlob(id);
    return rec?.blob || null;
  },

  async getRecord(id) {
    return Storage.getAttachmentBlob(id);
  },

  /**
   * Delete an attachment's binary blob + metadata.
   */
  async remove(id) {
    await Storage.deleteAttachmentBlob(id);
    return { ok: true };
  },

  /** Update rotation metadata on the stored record. */
  async setRotation(id, degrees) {
    const rec = await this.getRecord(id);
    if (!rec) return { ok: false, reason: 'not-found' };
    await Storage.putAttachmentBlob({
      id, name: rec.name, type: rec.type, size: rec.size,
      blob: rec.blob, rotation: degrees, pages: rec.pages,
    });
    return { ok: true };
  },

  /** Lazy-load PDF.js (used by preview + export). */
  getPdfjs,
};
