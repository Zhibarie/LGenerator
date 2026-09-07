// ─── NOTIFICATIONS (Toast) ─────────────────────────────────────────────────
// Lightweight toast system. Types: success, error, info, saved.
// Auto-dismiss after 3s (configurable). Sticky toasts require explicit dismiss.

import { EventBus, EVT } from '../core/events.js';

const CONTAINER_ID = 'lgen-toasts';

function ensureContainer() {
  let c = document.getElementById(CONTAINER_ID);
  if (!c) {
    c = document.createElement('div');
    c.id = CONTAINER_ID;
    c.setAttribute('role', 'status');
    c.setAttribute('aria-live', 'polite');
    c.setAttribute('aria-atomic', 'true');
    document.body.appendChild(c);
  }
  return c;
}

const ICONS = {
  success: '<i class="fas fa-check-circle" aria-hidden="true"></i>',
  error:   '<i class="fas fa-exclamation-triangle" aria-hidden="true"></i>',
  info:    '<i class="fas fa-info-circle" aria-hidden="true"></i>',
  saved:   '<i class="fas fa-check-circle" aria-hidden="true"></i>',
};

const COLORS = {
  success: '#22c55e',
  error:   '#ef4444',
  info:    '#3b82f6',
  saved:   '#6ee7a0',
};

export const Notifications = {
  init() {
    EventBus.on(EVT.NOTIFY, ({ type, msg, sticky }) => this.show(type, msg, sticky));
    EventBus.on(EVT.STATE_SAVE_FAILED, r => {
      this.show('error',
        r.reason === 'quota'
          ? 'Penyimpanan penuh. Hapus lampiran lama atau perkecil file.'
          : 'Gagal menyimpan. Perubahan tetap di memori.',
        true);
    });
    EventBus.on(EVT.STATE_SAVED, () => {
      // Tiny saved indicator — don't be noisy
      this.show('saved', 'Tersimpan', false, 1500);
    });
  },

  show(type, msg, sticky = false, duration = 3000) {
    const c = ensureContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type || 'info'}`;
    toast.style.cssText = `
      background: ${COLORS[type] || COLORS.info};
      color: white;
      padding: 10px 14px;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.3);
      margin-bottom: 8px;
      font-family: sans-serif;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 44px;
      max-width: 92vw;
      animation: lgen-toast-in 0.2s ease-out;
    `;
    toast.innerHTML = `${ICONS[type] || ICONS.info}<span>${escapeHtml(msg)}</span>`;

    if (!sticky) {
      setTimeout(() => this.dismiss(toast), duration);
    } else {
      const dismissBtn = document.createElement('button');
      dismissBtn.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
      dismissBtn.setAttribute('aria-label', 'Tutup pesan');
      dismissBtn.style.cssText = `
        background: rgba(255,255,255,0.2);
        border: none; color: white; cursor: pointer;
        padding: 4px 8px; border-radius: 6px; margin-left: auto;
        min-width: 32px; min-height: 32px;
      `;
      dismissBtn.addEventListener('click', () => this.dismiss(toast));
      toast.appendChild(dismissBtn);
    }

    c.appendChild(toast);
    return toast;
  },

  dismiss(toast) {
    if (!toast || !toast.parentElement) return;
    toast.style.transition = 'opacity 0.2s, transform 0.2s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px)';
    setTimeout(() => toast.remove(), 220);
  },
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
