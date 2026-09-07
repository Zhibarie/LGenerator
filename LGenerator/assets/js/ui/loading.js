// ─── LOADING / EXPORT PROGRESS ──────────────────────────────────────────────
// Full-screen loading overlay with progress %, message, and Cancel button.
// Listens to EVT.EXPORT_PROGRESS + EVT.EXPORT_DONE/ERROR/CANCEL.

import { EventBus, EVT } from '../core/events.js';
import { AppState } from '../core/state.js';
import { PdfExporter } from '../export/pdf-exporter.js';

export const Loading = {
  els: {},
  cancelBtn: null,

  init() {
    this.els = {
      overlay: document.getElementById('pdf-loading'),
      spinner: document.querySelector('#pdf-loading .spinner'),
      message: document.querySelector('#pdf-loading > span:nth-of-type(2)'),
      progress: document.getElementById('pdf-progress'),
    };

    if (!this.els.overlay) {
      // Build overlay dynamically if missing
      this._buildOverlay();
    }

    // Add a progress bar + cancel button
    this._augment();

    // Listen to export events
    EventBus.on(EVT.EXPORT_START, () => this.show());
    EventBus.on(EVT.EXPORT_PROGRESS, ({ pct, msg }) => this.update(pct, msg));
    EventBus.on(EVT.EXPORT_DONE, () => this.hide());
    EventBus.on(EVT.EXPORT_ERROR, msg => this.error(msg));
    EventBus.on(EVT.EXPORT_CANCEL, () => this.hide());

    // Cancel button
    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', () => PdfExporter.cancel());
    }
  },

  _buildOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'pdf-loading';
    overlay.setAttribute('role', 'alert');
    overlay.setAttribute('aria-live', 'assertive');
    overlay.innerHTML = `
      <div class="spinner" aria-hidden="true"></div>
      <span class="loading-msg">Memproses...</span>
      <span class="loading-progress" id="pdf-progress"></span>
    `;
    document.body.appendChild(overlay);
    this.els = {
      overlay,
      spinner: overlay.querySelector('.spinner'),
      message: overlay.querySelector('.loading-msg'),
      progress: overlay.querySelector('#pdf-progress'),
    };
  },

  _augment() {
    // Add a progress bar + cancel button (only once)
    if (this.els.overlay.querySelector('.loading-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'loading-bar';
    bar.innerHTML = '<div class="loading-bar-fill" id="loading-bar-fill"></div>';
    this.els.overlay.appendChild(bar);

    this.cancelBtn = document.createElement('button');
    this.cancelBtn.type = 'button';
    this.cancelBtn.className = 'loading-cancel-btn';
    this.cancelBtn.textContent = 'Batalkan';
    this.cancelBtn.setAttribute('aria-label', 'Batalkan proses export');
    this.els.overlay.appendChild(this.cancelBtn);
  },

  show() {
    this.els.overlay?.classList.add('active');
    this.els.overlay?.setAttribute('aria-hidden', 'false');
    if (this.cancelBtn) this.cancelBtn.style.display = 'inline-block';
    this.update(0, 'Memulai...');
  },

  update(pct, msg) {
    if (this.els.message && msg) this.els.message.textContent = msg;
    if (this.els.progress) {
      this.els.progress.textContent = pct != null ? `${pct}%` : '';
    }
    const fill = document.getElementById('loading-bar-fill');
    if (fill) {
      fill.style.width = (pct || 0) + '%';
    }
  },

  error(msg) {
    if (this.els.message) {
      this.els.message.textContent = 'Gagal: ' + (msg || 'Error tidak diketahui');
      this.els.message.style.color = '#ef4444';
    }
    if (this.cancelBtn) {
      this.cancelBtn.textContent = 'Tutup';
      this.cancelBtn.style.display = 'inline-block';
      // Detach old listeners
      const newBtn = this.cancelBtn.cloneNode(true);
      this.cancelBtn.replaceWith(newBtn);
      this.cancelBtn = newBtn;
      this.cancelBtn.addEventListener('click', () => this.hide());
    }
  },

  hide() {
    setTimeout(() => {
      this.els.overlay?.classList.remove('active');
      this.els.overlay?.setAttribute('aria-hidden', 'true');
      if (this.els.message) this.els.message.style.color = '';
      if (this.cancelBtn) this.cancelBtn.textContent = 'Batalkan';
      // Reset bar
      const fill = document.getElementById('loading-bar-fill');
      if (fill) fill.style.width = '0%';
    }, 300);
  },
};
