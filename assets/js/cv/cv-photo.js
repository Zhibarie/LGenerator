// ─── CV PHOTO ──────────────────────────────────────────────────────────────
// Photo upload + preview. Object URLs are released on replace/clear.

import { AppState } from '../core/state.js';
import { EventBus, EVT } from '../core/events.js';
import { CvStorage } from './cv-storage.js';

let currentObjectUrl = null;

export const CvPhoto = {
  els: {},

  init() {
    this.els = {
      zone: document.getElementById('cv-photo-zone'),
      img: document.getElementById('cv-photo-img'),
      placeholder: document.getElementById('cv-photo-placeholder'),
      clearBtn: document.getElementById('cv-photo-clear'),
      input: document.getElementById('cv-photo-input'),
    };

    if (this.els.zone) {
      this.els.zone.addEventListener('click', () => this.els.input?.click());
      this.els.zone.setAttribute('role', 'button');
      this.els.zone.setAttribute('tabindex', '0');
      this.els.zone.setAttribute('aria-label', 'Upload foto CV');
      this.els.zone.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.els.input?.click(); }
      });
    }

    if (this.els.input) {
      this.els.input.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (file) {
          EventBus.emit(EVT.NOTIFY, { type: 'info', msg: 'Memproses foto...' });
          const r = await CvStorage.savePhoto(file);
          if (r.ok) {
            await this.render();
            EventBus.emit(EVT.NOTIFY, { type: 'success', msg: 'Foto diterapkan.' });
          } else {
            EventBus.emit(EVT.NOTIFY, { type: 'error', msg: r.reason });
          }
          e.target.value = '';
        }
      });
    }

    if (this.els.clearBtn) {
      this.els.clearBtn.addEventListener('click', async e => {
        e.stopPropagation();
        await CvStorage.clearPhoto();
        await this.render();
        EventBus.emit(EVT.NOTIFY, { type: 'info', msg: 'Foto dihapus.' });
      });
      this.els.clearBtn.setAttribute('aria-label', 'Hapus foto');
    }

    EventBus.on(EVT.CV_PHOTO_CHANGED, () => this.render());
  },

  async render() {
    // Release previous object URL
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }

    const photoKey = AppState.get().cv.photo;
    if (!photoKey || !this.els.img) {
      this.els.img.style.display = 'none';
      this.els.placeholder.style.display = 'flex';
      this.els.clearBtn.style.display = 'none';
      return;
    }

    try {
      const url = await CvStorage.getPhotoUrl();
      if (url) {
        currentObjectUrl = url;
        this.els.img.src = url;
        this.els.img.style.display = 'block';
        this.els.placeholder.style.display = 'none';
        this.els.clearBtn.style.display = 'block';
      }
    } catch (e) {
      console.warn('[CvPhoto] failed to render:', e);
    }
  },

  /** Release object URL on unload */
  destroy() {
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  },
};
