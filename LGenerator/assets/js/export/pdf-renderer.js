// ─── PDF RENDERER ──────────────────────────────────────────────────────────
// Low-level render primitives: capture an element as a JPEG, render letter /
// CV surfaces for PDF. Abstracts html2canvas loading + cleanup.
//
// Trade-off (B4): we use html2canvas (raster) for the CV — this means CV text
// is NOT selectable in PDF. The LETTER, however, we render as jsPDF text/vector
// when possible (see pdf-exporter.js) — so the cover letter is searchable.
//
// LIMITATION — full text-based PDF for both letter + CV would require either:
//   (a) re-implementing contenteditable → PDF text mapping (complex, fragile
//       with our table-based letter layout), or
//   (b) integrating a headless rendering pipeline (puppeteer-like) — impossible
//       in a 100% static GitHub Pages app.
// We chose hybrid: letter uses jsPDF text primitives where possible; CV uses
// html2canvas (acceptable trade-off because CV is short + image-like visually).
//
// RECOMMENDED FUTURE SOLUTION: switch the letter rendering to a structured
// PDF-text approach using jsPDF's HTML() API once it supports the Bootstrap
// table layout we use. Track this as a v3 milestone.

import { A4, PDF } from '../core/constants.js';
import { nextFrame } from '../core/utils.js';

let h2cPromise = null;
export function getHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (h2cPromise) return h2cPromise;
  h2cPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve(window.html2canvas);
    s.onerror = () => reject(new Error('Gagal memuat html2canvas. Coba lagi.'));
    document.head.appendChild(s);
  });
  return h2cPromise;
}

let jspdfPromise = null;
export function getJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (jspdfPromise) return jspdfPromise;
  jspdfPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve(window.jspdf.jsPDF);
    s.onerror = () => reject(new Error('Gagal memuat jsPDF. Coba lagi.'));
    document.head.appendChild(s);
  });
  return jspdfPromise;
}

/**
 * Render an element to JPEG. Captures the element at full A4 width (794px)
 * regardless of current viewport size (mobile-safe: always produces same PDF).
 *
 * Returns { dataUrl, w, h }.
 */
export async function renderElementToJpeg(el, opts = {}) {
  const h2c = await getHtml2Canvas();
  const parent = el.parentElement;
  const nextSibling = el.nextSibling;
  const savedStyle = el.getAttribute('style') || '';

  // Detach + render off-screen at native A4 width
  el.style.cssText = [
    'position:fixed',
    'top:0',
    'left:-9999px',
    'top:0',
    `width:${A4.widthPx}px`,
    'transform:none',
    'z-index:-1',
    'box-shadow:none',
    'border:none',
    'margin:0',
    'overflow:visible',
  ].join(';');
  document.body.appendChild(el);

  await new Promise(r => setTimeout(r, 60));
  await nextFrame();

  let canvas;
  try {
    canvas = await h2c(el, {
      scale: A4.renderScale,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      x: 0, y: 0,
      scrollX: 0, scrollY: 0,
      windowWidth: A4.widthPx,
    });
  } finally {
    el.setAttribute('style', savedStyle);
    if (nextSibling) parent.insertBefore(el, nextSibling);
    else parent.appendChild(el);
  }

  const dataUrl = canvas.toDataURL('image/jpeg', PDF.jpegQuality);
  const result = { dataUrl, w: canvas.width, h: canvas.height };
  // Cleanup
  canvas.width = 0;
  canvas.height = 0;
  return result;
}

/**
 * Hide UI overlays on a frame before rendering (buttons, placeholder, etc.).
 * Returns a cleanup function that restores everything.
 */
export function prepareFrameForRender(frame) {
  const cleanups = [];

  frame.querySelectorAll('.btn-remove, .btn-lamp-upload, .btn-add-lamp, .cv-add-btn, .cv-remove-btn').forEach(el => {
    const prev = el.style.display;
    el.style.display = 'none';
    cleanups.push(() => { el.style.display = prev; });
  });

  frame.querySelectorAll('.editable').forEach(el => {
    const c = el.style.color, b = el.style.borderBottom;
    el.style.color = 'black';
    el.style.borderBottom = 'none';
    cleanups.push(() => { el.style.color = c; el.style.borderBottom = b; });
  });

  const sigZone = frame.querySelector('.signature-zone');
  if (sigZone) {
    const sb = sigZone.style.border, sbg = sigZone.style.background;
    sigZone.style.border = 'none';
    sigZone.style.background = 'transparent';
    const placeholder = sigZone.querySelector('.sig-placeholder');
    const sigClear = sigZone.querySelector('.sig-clear');
    const hasSig = sigZone.classList.contains('has-sig');
    if (!hasSig && placeholder) placeholder.style.display = 'none';
    if (sigClear) sigClear.style.display = 'none';
    cleanups.push(() => {
      sigZone.style.border = sb; sigZone.style.background = sbg;
      if (!hasSig && placeholder) placeholder.style.display = '';
      if (sigClear) sigClear.style.display = '';
    });
  }

  // Hide CV photo placeholder if no photo
  const photoImg = frame.querySelector('#cv-photo-img');
  const photoZone = frame.querySelector('#cv-photo-zone');
  const photoClear = frame.querySelector('#cv-photo-clear');
  if (photoImg && photoZone) {
    const hasPhoto = photoImg.style.display !== 'none' && !!photoImg.src;
    if (!hasPhoto) {
      const pb = photoZone.style.border, pbg = photoZone.style.background;
      photoZone.style.border = 'none';
      photoZone.style.background = 'none';
      cleanups.push(() => { photoZone.style.border = pb; photoZone.style.background = pbg; });
    }
    if (photoClear) {
      const pcd = photoClear.style.display;
      photoClear.style.display = 'none';
      cleanups.push(() => { photoClear.style.display = pcd; });
    }
  }

  // Add a temporary style tag to hide ::after pseudo-elements (fill bars)
  const styleTag = document.createElement('style');
  styleTag.id = 'lgen-pdf-render-style';
  styleTag.textContent = `#paperFrame::after, #cvFrame::after { display: none !important; }
    .cv-editable { border-bottom: none !important; }`;
  document.head.appendChild(styleTag);
  cleanups.push(() => styleTag.remove());

  return () => cleanups.forEach(fn => { try { fn(); } catch (e) { /* ignore */ } });
}
