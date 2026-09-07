// ─── AUTO-FIT (LETTER) ──────────────────────────────────────────────────────
// Binary search the largest font size in [MIN, MAX] such that the letter
// content fits inside the A4 frame without overflow.
//
// Bug fix (B2): old code used Math.round(lo * 5) / 5 which could round UP
// past the binary-search upper bound, causing overflow. We use Math.floor
// + final invariant check (best <= maxFont and content fits).

import { LETTER_FIT, A4 } from '../core/constants.js';
import { AppState } from '../core/state.js';
import { EventBus, EVT } from '../core/events.js';
import { debounce } from '../core/utils.js';

const ptToPx = pt => (pt * 96) / 72;

function setFont(pt) {
  document.documentElement.style.setProperty('--base-font-size', ptToPx(pt) + 'px');
}

function measure(frame, content) {
  // Read A4 height from CSS variable, fall back to constant
  const cssH = getComputedStyle(document.documentElement).getPropertyValue('--a4-h');
  const tH = parseInt(cssH, 10) || A4.heightPx;
  return { frameH: tH, contentH: content.scrollHeight };
}

function updateFitUI(pt, contentH, frameH) {
  const pct  = Math.min(100, Math.round((contentH / frameH) * 100));
  const over = contentH > frameH;
  const bar  = document.getElementById('fit-bar');
  if (bar) {
    bar.style.width      = pct + '%';
    bar.style.background = over ? '#ef4444' : (pt >= LETTER_FIT.maxFontPt ? '#facc15' : '#22c55e');
  }
  const lbl = document.getElementById('fit-label');
  if (lbl) lbl.textContent = pct + '%';
  const fsd = document.getElementById('font-size-display');
  if (fsd) fsd.textContent = pt.toFixed(1).replace(/\.0$/, '') + 'pt';
  const frame = document.getElementById('paperFrame');
  if (frame) frame.classList.toggle('overflow', over);
}

export const AutoFit = {
  timer: null,
  ro: null,

  init() {
    // Listen for relevant events to schedule a re-fit
    EventBus.on(EVT.STATE_CHANGED, ({ scope }) => {
      if (scope === 'letter.field' || scope === 'letter.attachments' || scope === 'reset.letter') {
        this.schedule();
      }
    });
    EventBus.on(EVT.VIEWPORT_RESIZE, () => this.schedule());
    EventBus.on(EVT.ORIENTATION_CHANGE, () => this.schedule());

    // ResizeObserver with debounce (cautious on mobile — can cause runaway loops)
    const paper = document.getElementById('paperFrame');
    if (paper && typeof ResizeObserver !== 'undefined') {
      let lastW = paper.clientWidth;
      this.ro = new ResizeObserver(debounce(entries => {
        for (const e of entries) {
          const w = e.contentRect.width;
          if (Math.abs(w - lastW) > 4) { lastW = w; this.schedule(); }
        }
      }, 200));
      this.ro.observe(paper);
    }
  },

  schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fit(), LETTER_FIT.debounceMs);
  },

  fit() {
    const frame = document.getElementById('paperFrame');
    const content = document.getElementById('letterContent');
    if (!frame || !content) return;

    const { frameH } = measure(frame, content);

    // Edge case: frame not measurable yet (e.g. modal open)
    if (!frameH || frameH < 100) {
      // Defer
      requestAnimationFrame(() => this.fit());
      return;
    }

    // 1) Try min first — if overflow at min, stay at min and flag overflow
    setFont(LETTER_FIT.minFontPt);
    if (content.scrollHeight > frameH) {
      updateFitUI(LETTER_FIT.minFontPt, content.scrollHeight, frameH);
      AppState.setLetterFontSize(LETTER_FIT.minFontPt);
      return;
    }

    // 2) Try max first — if fits, use max
    setFont(LETTER_FIT.maxFontPt);
    if (content.scrollHeight <= frameH) {
      // Invariant: best <= max — directly use max
      updateFitUI(LETTER_FIT.maxFontPt, content.scrollHeight, frameH);
      AppState.setLetterFontSize(LETTER_FIT.maxFontPt);
      return;
    }

    // 3) Binary search — lo is guaranteed to fit, hi is guaranteed to overflow
    let lo = LETTER_FIT.minFontPt;
    let hi = LETTER_FIT.maxFontPt;
    while (hi - lo > LETTER_FIT.step) {
      const mid = (lo + hi) / 2;
      setFont(mid);
      if (content.scrollHeight <= frameH) lo = mid;
      else hi = mid;
    }

    // Bug B2 fix: use Math.floor, NOT Math.round, to guarantee we never exceed lo
    const step5 = 1 / 5;
    let best = Math.floor(lo / step5) * step5;

    // Clamp to [min, max] for safety
    best = Math.max(LETTER_FIT.minFontPt, Math.min(LETTER_FIT.maxFontPt, best));

    // Final invariant check: ensure best actually fits; if not, step down one notch
    setFont(best);
    let safety = 3;
    while (content.scrollHeight > frameH && safety-- > 0 && best > LETTER_FIT.minFontPt) {
      best = Math.max(LETTER_FIT.minFontPt, best - step5);
      setFont(best);
    }

    updateFitUI(best, content.scrollHeight, frameH);
    AppState.setLetterFontSize(best);
  },

  destroy() {
    if (this.timer) clearTimeout(this.timer);
    if (this.ro) this.ro.disconnect();
  },
};
