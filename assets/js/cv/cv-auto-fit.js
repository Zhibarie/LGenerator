// ─── CV AUTO-FIT ──────────────────────────────────────────────────────────
// Same binary-search approach as letter auto-fit, with Math.floor fix.
// Independent because CV uses px (not pt) for font-size.

import { CV_FIT, A4 } from '../core/constants.js';
import { AppState } from '../core/state.js';
import { EventBus, EVT } from '../core/events.js';
import { debounce } from '../core/utils.js';

function setCvFont(px) {
  document.documentElement.style.setProperty('--cv-font-size', px + 'px');
}

function updateCvFitUI(px, contentH, maxH) {
  const pt   = Math.round((px * 72 / 96) * 10) / 10;
  const pct  = Math.min(100, Math.round((contentH / maxH) * 100));
  const over = contentH > maxH;

  const bar = document.getElementById('cv-fit-bar');
  if (bar) {
    bar.style.width = pct + '%';
    bar.style.background = over ? '#ef4444' : (px >= CV_FIT.maxFontPx ? '#facc15' : '#22c55e');
  }
  const lbl = document.getElementById('cv-fit-label');
  if (lbl) lbl.textContent = pct + '%';
  const fsd = document.getElementById('cv-font-size-display');
  if (fsd) fsd.textContent = pt.toFixed(1).replace(/\.0$/, '') + 'pt';
}

export const CvAutoFit = {
  timer: null,

  init() {
    EventBus.on(EVT.STATE_CHANGED, ({ scope }) => {
      if (scope && (scope.startsWith('cv.') || scope === 'reset.cv')) {
        this.schedule();
      }
    });
    EventBus.on(EVT.VIEWPORT_RESIZE, () => this.schedule());
    EventBus.on(EVT.ORIENTATION_CHANGE, () => this.schedule());
  },

  schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fit(), CV_FIT.debounceMs);
  },

  fit() {
    const cvEl = document.getElementById('cvFrame');
    if (!cvEl) return;

    const A4_H = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--a4-h'), 10) || A4.heightPx;

    // Hide add/remove buttons during measurement so they don't inflate height
    const addBtns = cvEl.querySelectorAll('.cv-add-btn, .cv-remove-btn');
    addBtns.forEach(b => b.style.visibility = 'hidden');

    // 1) Try min
    setCvFont(CV_FIT.minFontPx);
    if (cvEl.scrollHeight > A4_H) {
      updateCvFitUI(CV_FIT.minFontPx, cvEl.scrollHeight, A4_H);
      addBtns.forEach(b => b.style.visibility = '');
      return;
    }

    // 2) Try max
    setCvFont(CV_FIT.maxFontPx);
    if (cvEl.scrollHeight <= A4_H) {
      updateCvFitUI(CV_FIT.maxFontPx, cvEl.scrollHeight, A4_H);
      addBtns.forEach(b => b.style.visibility = '');
      return;
    }

    // 3) Binary search
    let lo = CV_FIT.minFontPx;
    let hi = CV_FIT.maxFontPx;
    while (hi - lo > CV_FIT.step) {
      const mid = (lo + hi) / 2;
      setCvFont(mid);
      if (cvEl.scrollHeight <= A4_H) lo = mid;
      else hi = mid;
    }

    // Fix B2: use Math.floor to never exceed lo
    const step5 = 1 / 5;
    let best = Math.floor(lo / step5) * step5;
    best = Math.max(CV_FIT.minFontPx, Math.min(CV_FIT.maxFontPx, best));

    // Invariant check
    setCvFont(best);
    let safety = 3;
    while (cvEl.scrollHeight > A4_H && safety-- > 0 && best > CV_FIT.minFontPx) {
      best = Math.max(CV_FIT.minFontPx, best - step5);
      setCvFont(best);
    }

    updateCvFitUI(best, cvEl.scrollHeight, A4_H);
    addBtns.forEach(b => b.style.visibility = '');
  },
};
