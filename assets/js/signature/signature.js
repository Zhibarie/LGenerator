// ─── SIGNATURE CONTROLLER ───────────────────────────────────────────────────
// Wires signature modal: tabs (draw/upload), color/size controls, apply/clear.
// Persists signature as a Blob in IndexedDB (not localStorage — too big).

import { AppState } from '../core/state.js';
import { EventBus, EVT } from '../core/events.js';
import { Storage } from '../core/storage.js';
import { SignatureCanvas } from './signature-canvas.js';
import { processSignatureImage, validateSignatureFile } from './signature-image.js';
import { SIGNATURE } from '../core/constants.js';

const BLOB_KEY = 'sig:main';

export const Signature = {
  els: {},
  currentTab: 'draw',
  uploadedDataUrl: null,
  bound: false,

  init() {
    if (this.bound) return;
    this.bound = true;

    this.els = {
      modal: document.getElementById('sigModal'),
      tabs: document.querySelectorAll('.sig-tab'),
      panelDraw: document.getElementById('sigPanel-draw'),
      panelUpload: document.getElementById('sigPanel-upload'),
      canvas: document.getElementById('sigCanvas'),
      penSize: document.getElementById('penSize'),
      penSizeVal: document.getElementById('penSizeVal'),
      colorDots: document.querySelectorAll('.color-dot'),
      sigFile: document.getElementById('sigFile'),
      sigUploadArea: document.querySelector('.sig-upload-area'),
      sigZone: document.getElementById('signatureZone'),
    };

    // Tab switching
    this.els.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.tab;
        this.switchTab(mode);
      });
    });

    // Color dots
    this.els.colorDots.forEach(dot => {
      dot.addEventListener('click', () => {
        this.els.colorDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        SignatureCanvas.setColor(dot.dataset.color);
      });
      dot.setAttribute('role', 'button');
      dot.setAttribute('tabindex', '0');
      dot.setAttribute('aria-label', `Pilih warna ${dot.dataset.color}`);
      dot.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dot.click(); }
      });
    });

    // Pen size
    if (this.els.penSize) {
      this.els.penSize.addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        SignatureCanvas.setSize(v);
        if (this.els.penSizeVal) this.els.penSizeVal.textContent = v + 'px';
      });
    }

    // File upload
    if (this.els.sigFile) {
      this.els.sigFile.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (file) {
          try {
            this.setUploadLoading(true);
            const dataUrl = await processSignatureImage(file);
            this.uploadedDataUrl = dataUrl;
            this.showUploadPreview(dataUrl);
          } catch (err) {
            EventBus.emit(EVT.NOTIFY, { type: 'error', msg: err.message });
            this.uploadedDataUrl = null;
            this.showUploadPreview(null);
          } finally {
            this.setUploadLoading(false);
            e.target.value = '';
          }
        }
      });
    }

    // Click on upload area
    if (this.els.sigUploadArea) {
      this.els.sigUploadArea.addEventListener('click', () => this.els.sigFile?.click());
      this.els.sigUploadArea.setAttribute('role', 'button');
      this.els.sigUploadArea.setAttribute('tabindex', '0');
      this.els.sigUploadArea.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.els.sigUploadArea.click(); }
      });
    }

    // Click on signature zone opens modal
    if (this.els.sigZone) {
      this.els.sigZone.addEventListener('click', () => this.open());
      this.els.sigZone.setAttribute('role', 'button');
      this.els.sigZone.setAttribute('tabindex', '0');
      this.els.sigZone.setAttribute('aria-label', 'Buka modal tanda tangan');
      this.els.sigZone.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.open(); }
      });
    }

    // Bind apply / clear / cancel buttons via global handlers (delegation)
    // (See app.js for button bindings to avoid duplicate handler issues)

    // Listen to global events
    EventBus.on('sig:apply', () => this.apply());
    EventBus.on('sig:clear', () => this.clearCanvas());
    EventBus.on('sig:close', () => this.close());
    EventBus.on('sig:clear-final', () => this.clearSignature());
  },

  open() {
    if (!this.els.modal) return;
    this.els.modal.classList.add('active');
    this.els.modal.setAttribute('aria-hidden', 'false');
    EventBus.emit(EVT.MODAL_OPEN, 'signature');
    // Init canvas after modal is visible
    requestAnimationFrame(() => {
      SignatureCanvas.init(this.els.canvas);
      this.switchTab(this.currentTab);
    });
    // Focus first interactive element
    setTimeout(() => {
      const first = this.els.modal.querySelector('button, [tabindex], input');
      if (first) first.focus();
    }, 100);
  },

  close() {
    if (!this.els.modal) return;
    this.els.modal.classList.remove('active');
    this.els.modal.setAttribute('aria-hidden', 'true');
    this.uploadedDataUrl = null;
    EventBus.emit(EVT.MODAL_CLOSE);
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.els.tabs.forEach(t => {
      const mode = t.dataset.tab;
      t.classList.toggle('active', mode === tab);
      t.setAttribute('aria-selected', mode === tab ? 'true' : 'false');
    });
    if (this.els.panelDraw) this.els.panelDraw.style.display = tab === 'draw' ? 'block' : 'none';
    if (this.els.panelUpload) this.els.panelUpload.style.display = tab === 'upload' ? 'block' : 'none';
    if (tab === 'draw' && this.els.canvas) {
      requestAnimationFrame(() => SignatureCanvas.resize(false));
    }
  },

  clearCanvas() {
    SignatureCanvas.clear();
  },

  setUploadLoading(loading) {
    if (!this.els.sigUploadArea) return;
    if (loading) {
      this.els.sigUploadArea.innerHTML =
        '<i class="fas fa-spinner fa-spin" style="font-size:2rem"></i><span>Memproses...</span>';
    } else {
      this.els.sigUploadArea.innerHTML =
        '<i class="fas fa-cloud-upload-alt" style="font-size:2rem" aria-hidden="true"></i>' +
        '<span>Klik untuk pilih gambar tanda tangan</span>' +
        '<span style="font-size:11px;color:#555">PNG / JPG (maks 3MB)</span>';
    }
  },

  showUploadPreview(dataUrl) {
    if (!this.els.sigUploadArea) return;
    if (dataUrl) {
      this.els.sigUploadArea.innerHTML =
        `<img src="${dataUrl}" style="max-height:170px;max-width:100%;object-fit:contain;border-radius:6px" alt="Preview tanda tangan">`;
    } else {
      this.setUploadLoading(false);
    }
  },

  async apply() {
    let dataUrl = null;
    if (this.currentTab === 'upload') {
      if (!this.uploadedDataUrl) {
        EventBus.emit(EVT.NOTIFY, { type: 'error', msg: 'Pilih file tanda tangan terlebih dahulu.' });
        return;
      }
      dataUrl = this.uploadedDataUrl;
    } else {
      // Drawn — check not blank
      if (SignatureCanvas.checkBlank()) {
        EventBus.emit(EVT.NOTIFY, { type: 'error', msg: 'Gambar tanda tangan terlebih dahulu.' });
        return;
      }
      dataUrl = SignatureCanvas.toTransparentPng();
    }

    // Persist to IndexedDB (so it survives refresh + doesn't bloat localStorage)
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const r = await Storage.putBlob(BLOB_KEY, blob, { type: 'image/png' });
      if (!r.ok) {
        EventBus.emit(EVT.NOTIFY, { type: 'error', msg: 'Gagal menyimpan tanda tangan: ' + r.reason });
        return;
      }
    } catch (e) {
      EventBus.emit(EVT.NOTIFY, { type: 'error', msg: 'Gagal menyimpan tanda tangan.' });
      return;
    }

    AppState.setSignature(dataUrl);
    EventBus.emit(EVT.NOTIFY, { type: 'success', msg: 'Tanda tangan diterapkan.' });
    this.close();
  },

  async clearSignature() {
    AppState.clearSignature();
    await Storage.deleteBlob(BLOB_KEY);
    EventBus.emit(EVT.NOTIFY, { type: 'info', msg: 'Tanda tangan dihapus.' });
  },

  /** Load persisted signature on startup. */
  async loadPersisted() {
    const blob = await Storage.getBlob(BLOB_KEY);
    if (!blob) return;
    try {
      const url = URL.createObjectURL(blob);
      AppState.setSignature(url);
      // Note: URL will be revoked on page unload; safe to keep alive for app lifetime
    } catch (e) {
      console.warn('[Signature] failed to load persisted:', e);
    }
  },
};
