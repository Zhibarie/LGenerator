// ─── ATTACHMENT PREVIEW ─────────────────────────────────────────────────────
// Renders preview UI in the lampiran modal. Has 3 states:
//   loading → success → error
// Never hangs (all Promises have onerror + timeout).
// Mobile-friendly: preview canvas sized to viewport, lazy PDF preview.

import { EventBus, EVT } from '../core/events.js';
import { AppState } from '../core/state.js';
import { AttachmentStorage } from './attachment-storage.js';
import { renderImagePreview, isImageLandscape } from './attachment-image.js';
import { renderPdfPreview } from './attachment-pdf.js';
import { formatBytes, loadImage } from '../core/utils.js';

function getLetterAttachment(lampId) {
  return AppState.get().letter.attachments.find(a => a.id === lampId) || null;
}

export const AttachmentPreview = {
  els: {},
  currentLid: null,
  pendingMeta: null, // the AttachmentStorage record currently being previewed
  pendingRotation: 0,

  init() {
    this.els = {
      modal: document.getElementById('lampModal'),
      dropZone: document.getElementById('lampDropZone'),
      fileInput: document.getElementById('lampFileInput'),
      previewArea: document.getElementById('lamp-preview-area'),
      imgPreviewWrap: document.getElementById('lamp-img-preview-wrap'),
      imgCanvas: document.getElementById('lamp-img-canvas'),
      orientationBadge: document.getElementById('lamp-orientation-badge'),
      orientText: document.getElementById('lamp-orient-text'),
      rotateHint: document.getElementById('lamp-rotate-hint'),
      rotateBtn: document.getElementById('lamp-rotate-btn'),
      btnApply: document.getElementById('lamp-btn-apply'),
      btnRemove: document.getElementById('lamp-btn-remove'),
      prevName: document.getElementById('lamp-prev-name'),
      prevSize: document.getElementById('lamp-prev-size'),
      prevPages: document.getElementById('lamp-prev-pages'),
      subtitle: document.getElementById('lamp-modal-subtitle'),
    };

    // Bind file input + drop zone
    if (this.els.fileInput) {
      this.els.fileInput.addEventListener('change', e => {
        const f = e.target.files[0];
        if (f) this.processFile(f);
        e.target.value = ''; // allow re-selecting same file
      });
    }
    if (this.els.dropZone) {
      // Click → open picker
      this.els.dropZone.addEventListener('click', () => this.els.fileInput?.click());
      // Drag-drop is a progressive enhancement on desktop
      ['dragenter', 'dragover'].forEach(ev =>
        this.els.dropZone.addEventListener(ev, e => {
          e.preventDefault();
          this.els.dropZone.classList.add('drag');
        })
      );
      ['dragleave', 'drop'].forEach(ev =>
        this.els.dropZone.addEventListener(ev, e => {
          e.preventDefault();
          this.els.dropZone.classList.remove('drag');
        })
      );
      this.els.dropZone.addEventListener('drop', e => {
        const f = e.dataTransfer?.files?.[0];
        if (f) this.processFile(f);
      });
    }

    // Rotate button
    if (this.els.rotateBtn) {
      this.els.rotateBtn.addEventListener('click', () => this.rotate90());
    }

    // Listen for "open modal" events from LetterEditor
    EventBus.on('attachment:open-modal', ({ lampId, triggerBtn }) => {
      this.open(lampId, triggerBtn);
    });
    EventBus.on('attachment:detach', ({ lampId }) => {
      this.detachFromLetter(lampId);
    });
  },

  /**
   * Open modal for a specific lampiran row.
   * Loads existing attachment (if any) from IndexedDB.
   */
  async open(lampId, triggerBtn) {
    this.currentLid = lampId;
    this.pendingMeta = null;
    this.pendingRotation = 0;

    // Reset UI to loading state
    this.showLoading();

    // Look up letter.attachments to find linked attachmentId
    const letterItem = getLetterAttachment(lampId);
    let existing = null;
    if (letterItem?.attachmentId) {
      existing = await AttachmentStorage.getRecord(letterItem.attachmentId);
    }

    if (existing) {
      this.pendingMeta = {
        id: letterItem.attachmentId,
        name: existing.name,
        type: existing.type,
        size: existing.size,
        blob: existing.blob,
        pages: existing.pages || 1,
        rotation: existing.rotation || 0,
      };
      this.pendingRotation = existing.rotation || 0;
      this.showPreview(this.pendingMeta);
      this.els.btnRemove.style.display = '';
      this.enableApply();
    } else {
      this.showEmpty();
      this.els.btnRemove.style.display = 'none';
    }

    EventBus.emit(EVT.MODAL_OPEN, 'lampiran');
    if (this.els.modal) {
      this.els.modal.classList.add('active');
      this.els.modal.setAttribute('aria-hidden', 'false');
      // Focus trap is handled by ui/modal.js
      setTimeout(() => this.els.dropZone?.focus(), 50);
    }
  },

  close() {
    if (this.els.modal) {
      this.els.modal.classList.remove('active');
      this.els.modal.setAttribute('aria-hidden', 'true');
    }
    this.pendingMeta = null;
    this.currentLid = null;
    EventBus.emit(EVT.MODAL_CLOSE);
  },

  showLoading() {
    if (this.els.previewArea) this.els.previewArea.style.display = 'none';
    if (this.els.imgPreviewWrap) this.els.imgPreviewWrap.style.display = 'none';
    if (this.els.btnApply) {
      this.els.btnApply.disabled = true;
      this.els.btnApply.style.opacity = '.4';
      this.els.btnApply.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Memproses...';
    }
  },

  showEmpty() {
    if (this.els.previewArea) this.els.previewArea.style.display = 'none';
    if (this.els.imgPreviewWrap) this.els.imgPreviewWrap.style.display = 'none';
    if (this.els.btnApply) {
      this.els.btnApply.disabled = true;
      this.els.btnApply.style.opacity = '.4';
      this.els.btnApply.innerHTML = '<i class="fas fa-check me-1"></i>Terapkan';
    }
  },

  showPreview(meta) {
    if (this.els.previewArea) this.els.previewArea.style.display = 'block';
    if (this.els.prevName) this.els.prevName.textContent = meta.name;
    if (this.els.prevSize) this.els.prevSize.textContent = formatBytes(meta.size);
    if (this.els.prevPages) {
      this.els.prevPages.textContent = meta.pages > 1 ? meta.pages + ' halaman' : '';
    }
    // For images, show canvas preview
    if (meta.type && meta.type !== 'application/pdf') {
      this.renderImagePreview(meta.blob, meta.rotation || 0);
    } else {
      if (this.els.imgPreviewWrap) this.els.imgPreviewWrap.style.display = 'none';
      this.renderPdfPreview(meta.blob);
    }
  },

  enableApply() {
    if (this.els.btnApply) {
      this.els.btnApply.disabled = false;
      this.els.btnApply.style.opacity = '1';
      this.els.btnApply.innerHTML = '<i class="fas fa-check me-1"></i>Terapkan';
    }
  },

  showError(msg) {
    if (this.els.previewArea) this.els.previewArea.style.display = 'block';
    if (this.els.prevName) this.els.prevName.textContent = 'Error';
    if (this.els.prevSize) this.els.prevSize.textContent = '';
    if (this.els.prevPages) {
      this.els.prevPages.innerHTML = `<span style="color:#ef4444">${msg}</span>`;
    }
    if (this.els.imgPreviewWrap) this.els.imgPreviewWrap.style.display = 'none';
    if (this.els.btnApply) {
      this.els.btnApply.disabled = true;
      this.els.btnApply.style.opacity = '.4';
    }
    EventBus.emit(EVT.NOTIFY, { type: 'error', msg });
  },

  async processFile(file) {
    this.showLoading();
    const r = await AttachmentStorage.save(file);
    if (!r.ok) {
      this.showError(r.reason || 'Gagal memproses file.');
      return;
    }
    // r.attachment is the meta — fetch the full record for preview
    const rec = await AttachmentStorage.getRecord(r.attachment.id);
    if (!rec) {
      this.showError('File tersimpan tetapi gagal dimuat untuk preview.');
      return;
    }
    this.pendingMeta = {
      id: r.attachment.id,
      name: rec.name,
      type: rec.type,
      size: rec.size,
      blob: rec.blob,
      pages: rec.pages || 1,
      rotation: 0,
    };
    this.pendingRotation = 0;
    this.showPreview(this.pendingMeta);
    this.els.btnRemove.style.display = 'none';
    this.enableApply();
  },

  async renderImagePreview(blob, rotation) {
    if (!this.els.imgCanvas) return;
    try {
      // Cap preview size for mobile viewport
      const maxW = Math.min(360, window.innerWidth - 80);
      const maxH = 180;
      await renderImagePreview(blob, this.els.imgCanvas, rotation, maxW, maxH);
      this.els.imgPreviewWrap.style.display = 'block';
      // Orientation badge
      const landscape = await isImageLandscape(blob, rotation);
      if (this.els.orientationBadge) this.els.orientationBadge.style.display = 'inline-block';
      if (this.els.orientText) {
        if (landscape) {
          this.els.orientationBadge.style.background = '#ef4444';
          this.els.orientText.innerHTML = '<i class="fas fa-exclamation-triangle me-1" aria-hidden="true"></i>Landscape — disarankan diputar agar tidak terpotong';
          this.els.rotateHint.textContent = 'Klik "Putar 90°" untuk orientasi portrait.';
        } else {
          this.els.orientationBadge.style.background = '#22c55e';
          this.els.orientText.innerHTML = '<i class="fas fa-check me-1" aria-hidden="true"></i>Portrait — sudah siap';
          this.els.rotateHint.textContent = 'Orientasi sudah sesuai.';
        }
      }
    } catch (e) {
      this.showError('Gagal memuat preview gambar: ' + (e?.message || ''));
    }
  },

  async renderPdfPreview(blob) {
    if (!this.els.imgPreviewWrap) return;
    try {
      const buf = blob instanceof ArrayBuffer ? blob : await blob.arrayBuffer();
      const canvas = await renderPdfPreview(buf, 360, 200);
      // Replace img canvas with PDF first page
      this.els.imgPreviewWrap.style.display = 'block';
      const wrap = this.els.imgCanvas.parentElement;
      if (wrap) {
        // Remove old canvas, insert new
        wrap.querySelectorAll('canvas.pdf-preview').forEach(c => c.remove());
        canvas.classList.add('pdf-preview');
        canvas.style.maxWidth = '100%';
        canvas.style.borderRadius = '8px';
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        canvas.setAttribute('aria-label', 'Preview halaman pertama PDF');
        wrap.appendChild(canvas);
      }
      if (this.els.orientationBadge) this.els.orientationBadge.style.display = 'none';
      if (this.els.rotateBtn) this.els.rotateBtn.style.display = 'none';
    } catch (e) {
      this.showError('Gagal memuat preview PDF: ' + (e?.message || ''));
    }
  },

  rotate90() {
    if (!this.pendingMeta) return;
    if (this.pendingMeta.type === 'application/pdf') return;
    this.pendingRotation = (this.pendingRotation + 90) % 360;
    this.renderImagePreview(this.pendingMeta.blob, this.pendingRotation);
  },

  async apply() {
    if (!this.pendingMeta || !this.currentLid) return;
    // Save rotation to IDB
    if (this.pendingMeta.type !== 'application/pdf') {
      await AttachmentStorage.setRotation(this.pendingMeta.id, this.pendingRotation);
    }
    // Link attachment to the letter row
    EventBus.emit('attachment:link', {
      lampId: this.currentLid,
      attachmentId: this.pendingMeta.id,
      meta: {
        name: this.pendingMeta.name,
        type: this.pendingMeta.type,
        size: this.pendingMeta.size,
        rotation: this.pendingRotation,
        pages: this.pendingMeta.pages,
      },
    });
    this.close();
  },

  async remove() {
    if (!this.currentLid) return;
    const letterItem = AppState_getLetterAttachment(this.currentLid);
    if (letterItem?.attachmentId) {
      await AttachmentStorage.remove(letterItem.attachmentId);
    }
    EventBus.emit('attachment:link', {
      lampId: this.currentLid,
      attachmentId: null,
      meta: null,
    });
    this.close();
  },

  detachFromLetter(lampId) {
    EventBus.emit('attachment:link', { lampId, attachmentId: null, meta: null });
  },
};
