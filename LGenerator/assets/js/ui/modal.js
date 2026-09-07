// ─── MODAL CONTROLLER ───────────────────────────────────────────────────────
// Accessible modal manager: focus trap, Escape to close, click-outside-to-close
// is DISABLED (per spec — prevent accidental data loss on mobile taps).
// Touch targets ≥ 44×44, full keyboard nav, ARIA attributes.

import { AppState } from '../core/state.js';
import { EventBus, EVT } from '../core/events.js';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export const Modal = {
  openModals: new Set(),
  previousFocus: null,

  init() {
    // Escape closes topmost modal
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.openModals.size > 0) {
        const top = [...this.openModals].pop();
        this.close(top);
      }
    });

    // Listen for modal open events from feature modules
    EventBus.on(EVT.MODAL_OPEN, name => this.open(name));
    EventBus.on(EVT.MODAL_CLOSE, () => {
      if (this.openModals.size > 0) {
        const top = [...this.openModals].pop();
        this.close(top);
      }
    });

    // Bind all [data-modal-close] buttons
    document.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalEl = btn.closest('.modal');
        if (modalEl) this.close(modalEl.id);
      });
    });

    // Bind all [data-modal-open] buttons
    document.querySelectorAll('[data-modal-open]').forEach(btn => {
      btn.addEventListener('click', () => this.open(btn.dataset.modalOpen));
    });
  },

  open(name) {
    const el = document.getElementById(name) || document.getElementById(name + 'Modal');
    if (!el) return;

    this.previousFocus = document.activeElement;
    el.classList.add('active');
    el.setAttribute('aria-hidden', 'false');
    AppState.setModal(name);
    this.openModals.add(name);

    // Lock body scroll (but allow inner modal scroll)
    document.body.style.overflow = 'hidden';

    // Focus first focusable inside modal
    setTimeout(() => {
      const first = el.querySelector(FOCUSABLE);
      if (first) first.focus();
    }, 50);

    // Trap focus
    this._trapFocus(el);
  },

  close(name) {
    const el = document.getElementById(name) || document.getElementById(name + 'Modal');
    if (!el) return;

    el.classList.remove('active');
    el.setAttribute('aria-hidden', 'true');
    this.openModals.delete(name);
    if (this.openModals.size === 0) {
      document.body.style.overflow = '';
      AppState.setModal(null);
    } else {
      AppState.setModal([...this.openModals].pop());
    }

    // Restore focus
    if (this.previousFocus && typeof this.previousFocus.focus === 'function') {
      setTimeout(() => this.previousFocus.focus(), 50);
    }
  },

  _trapFocus(el) {
    if (el._focusTrapBound) return;
    el._focusTrapBound = true;
    el.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const focusables = [...el.querySelectorAll(FOCUSABLE)].filter(f => !f.disabled && f.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last  = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  },
};
