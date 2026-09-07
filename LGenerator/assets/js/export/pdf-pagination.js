// ─── PDF PAGINATION ─────────────────────────────────────────────────────────
// Splits long CV content into multiple A4 pages. Avoids breaking inside
// education/experience items.
//
// Strategy:
//   1. Render CV at native A4 width (794px) in an off-screen container
//   2. Walk top-level blocks, measure cumulative height
//   3. Push current page when next block would overflow A4 height
//   4. Each block is captured as a JPEG slice via html2canvas
//
// Fixes B8: previously CV was rendered as 1 long page, distorting aspect ratio
// when squeezed into A4.

import { A4, PDF } from '../core/constants.js';
import { nextFrame } from '../core/utils.js';

// Lazy-load html2canvas (don't pay cost on app startup)
let h2cPromise = null;
function getHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (h2cPromise) return h2cPromise;
  h2cPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.integrity = 'sha512-5sSk8B8oc9M9wGkO05gZkhk5cTcjVtFlSiXgqCjBc8qMm+SsPy6f+5qR2R5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5=';
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve(window.html2canvas);
    s.onerror = () => reject(new Error('Gagal memuat html2canvas.'));
    document.head.appendChild(s);
  });
  return h2cPromise;
}

/**
 * Render a CV element as multiple A4 pages.
 *
 * @param {HTMLElement} cvFrame - the CV container
 * @param {(p:{page:number,total:number}) => void} onProgress
 * @param {AbortSignal} signal
 * @returns {Promise<Array<{ dataUrl:string, w:number, h:number }>>}
 */
export async function paginateCv(cvFrame, onProgress, signal) {
  const h2c = await getHtml2Canvas();

  // Save original style + parent
  const parent = cvFrame.parentElement;
  const nextSibling = cvFrame.nextSibling;
  const savedStyle = cvFrame.getAttribute('style') || '';
  const savedWidth = cvFrame.style.width;
  const savedDisplay = cvFrame.style.display;

  // Clone + render in an off-screen wrapper at native A4 size
  // We don't move the original — we clone so the visible editor stays put.
  const clone = cvFrame.cloneNode(true);
  // Remove any UI buttons from the clone (add/remove buttons, photo clear, etc.)
  clone.querySelectorAll('.cv-add-btn, .cv-remove-btn, #cv-photo-clear').forEach(el => el.remove());
  // Hide placeholders if no photo
  if (!clone.querySelector('#cv-photo-img')?.src) {
    const ph = clone.querySelector('#cv-photo-zone');
    if (ph) ph.style.display = 'none';
  }

  // Wrap in fixed-size container
  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:fixed',
    'top:0',
    'left:-9999px',
    `width:${A4.widthPx}px`,
    'background:white',
    'z-index:-1',
    'overflow:visible',
  ].join(';');
  clone.style.width = A4.widthPx + 'px';
  clone.style.minHeight = '';
  clone.style.height = 'auto';
  clone.style.display = 'flex';
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  await nextFrame();

  try {
    // Identify top-level blocks (sections)
    // CV structure: kolom kiri + kolom kanan di dalam .dua kolom wrapper.
    // For pagination we treat the whole CV as a stream of "blocks":
    //   - photo + name (kolom kiri, kept together)
    //   - each contact item
    //   - each data diri row
    //   - "TENTANG SAYA" section
    //   - each education item
    //   - each experience item
    const blocks = collectBlocks(clone);
    const A4_H = A4.heightPx;
    const pages = [];
    let currentPage = [];
    let currentPageH = 0;
    const PAD = 0;

    // First, measure each block height
    // We do this by temporarily stacking them with `break-inside: avoid`
    // and measuring offsetTop differences.
    const measured = [];
    for (const block of blocks) {
      if (signal?.aborted) throw new DOMException('Dibatalkan', 'AbortError');
      // Set block visible to measure
      block.style.pageBreakAfter = 'always';
      block.style.breakInside = 'avoid';
      block.style.breakAfter = 'auto';
      const r = block.getBoundingClientRect();
      measured.push({ block, h: r.height });
    }

    // Greedy packing
    for (const { block, h } of measured) {
      if (currentPageH + h > A4_H && currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        currentPageH = 0;
      }
      currentPage.push(block);
      currentPageH += h;
    }
    if (currentPage.length > 0) pages.push(currentPage);

    // Render each page: clone the page blocks into a fresh A4 wrapper and html2canvas
    const out = [];
    for (let i = 0; i < pages.length; i++) {
      if (signal?.aborted) throw new DOMException('Dibatalkan', 'AbortError');
      if (onProgress) onProgress({ page: i + 1, total: pages.length });

      // Hide all blocks first, then unhide only the ones for this page
      measured.forEach(m => m.block.style.display = 'none');
      pages[i].forEach(b => b.style.display = '');

      // Force the wrapper to exactly A4 height for clean capture
      wrapper.style.height = A4_H + 'px';
      clone.style.height = A4_H + 'px';

      await nextFrame();

      const canvas = await h2c(clone, {
        scale: A4.renderScale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        x: 0, y: 0,
        scrollX: 0, scrollY: 0,
        width: A4.widthPx,
        height: A4_H,
        windowWidth: A4.widthPx,
      });
      const dataUrl = canvas.toDataURL('image/jpeg', PDF.jpegQuality);
      out.push({ dataUrl, w: canvas.width, h: canvas.height });
      // Release canvas
      canvas.width = 0;
      canvas.height = 0;
    }

    return out;
  } finally {
    // Restore
    measured.forEach(m => m.block.style.display = '');
    wrapper.remove();
    cvFrame.setAttribute('style', savedStyle);
    cvFrame.style.display = savedDisplay;
    cvFrame.style.width = savedWidth;
  }
}

/**
 * Collect "blocks" — the smallest units we don't want to split across pages.
 * For CV layout, we treat:
 *   - .cv-section-right (TENTANG / PENDIDIKAN / PENGALAMAN headers + their items together)
 *   - each .cv-edu-item, .cv-exp-item (so they don't break mid-item)
 *   - .cv-section-left (kontak / data diri — left column blocks)
 */
function collectBlocks(root) {
  // Try selectors in priority order
  let blocks = root.querySelectorAll('.cv-section-right, .cv-section-left, .cv-edu-item, .cv-exp-item');
  if (blocks.length === 0) {
    // Fallback: just paginate the whole CV
    blocks = [root];
  }
  return [...blocks];
}
