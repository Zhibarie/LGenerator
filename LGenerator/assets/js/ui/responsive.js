// ─── RESPONSIVE / VIEWPORT TRACKER ─────────────────────────────────────────
// Tracks viewport size, orientation, and emits events on change.
// Updates AppState.ui.isMobile + AppState.ui.orientation.
// Computes --safe-area-inset-* CSS vars for notch devices.
// Debounced to avoid runaway reflow on mobile address-bar show/hide.

import { AppState } from '../core/state.js';
import { EventBus, EVT } from '../core/events.js';
import { BREAKPOINTS } from '../core/constants.js';
import { debounce } from '../core/utils.js';

export const Responsive = {
  init() {
    this._update();
    const debounced = debounce(() => this._update(), 150);
    window.addEventListener('resize', debounced);
    window.addEventListener('orientationchange', () => {
      // immediate update on orientation change
      this._update();
      // and one more after layout settles
      setTimeout(() => this._update(), 400);
    });

    // Visual viewport API (handles mobile keyboard virtual)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', debounce(() => this._update(), 100));
    }

    // Inject safe-area CSS vars if missing
    this._injectSafeAreaVars();
  },

  _update() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isMobile = w < BREAKPOINTS.md;
    const orientation = w > h ? 'landscape' : 'portrait';

    AppState.setMobile(isMobile);
    AppState.setOrientation(orientation);

    EventBus.emit(EVT.VIEWPORT_RESIZE, { width: w, height: h, isMobile, orientation });

    // Update CSS var for viewport-aware components
    document.documentElement.style.setProperty('--viewport-h', h + 'px');
    document.documentElement.style.setProperty('--viewport-w', w + 'px');
    if (window.visualViewport) {
      document.documentElement.style.setProperty('--vvh', window.visualViewport.height + 'px');
    }
  },

  _injectSafeAreaVars() {
    if (document.getElementById('lgen-safe-area-style')) return;
    const s = document.createElement('style');
    s.id = 'lgen-safe-area-style';
    s.textContent = `
      :root {
        --safe-top: env(safe-area-inset-top, 0px);
        --safe-right: env(safe-area-inset-right, 0px);
        --safe-bottom: env(safe-area-inset-bottom, 0px);
        --safe-left: env(safe-area-inset-left, 0px);
      }
    `;
    document.head.appendChild(s);
  },
};
