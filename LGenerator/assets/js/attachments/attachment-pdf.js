// ─── ATTACHMENT PDF RENDERER ────────────────────────────────────────────────
// Stream-renders a PDF page-by-page. Fixes B10 (hardcoded scale 1.5 → constant)
// and B8 (multi-page rendering with proper cleanup, no memory explosion).

import { A4, FILE_LIMITS, TIMEOUTS } from '../core/constants.js';
import { loadImage } from '../core/utils.js';

const SCALE = A4.pdfLampiranScale; // 2 — ~150 DPI, print-quality but memory-safe

/**
 * Render each page of a PDF Blob to a JPEG data URL.
 * Uses streaming approach: renders one page at a time, releases canvas between pages.
 *
 * @param {Blob|ArrayBuffer} input — PDF blob or buffer
 * @param {(progress: {page:number,total:number}) => void} onProgress — optional progress
 * @param {AbortSignal} signal — optional cancellation
 * @returns {Promise<Array<{ dataUrl:string, w:number, h:number }>>}
 */
export async function pdfToImages(input, onProgress, signal) {
  const pdfjs = await AttachmentStorage_getPdfjs();

  let arrayBuffer;
  if (input instanceof Blob) {
    arrayBuffer = await input.arrayBuffer();
  } else if (input instanceof ArrayBuffer) {
    arrayBuffer = input;
  } else {
    throw new Error('Input harus Blob atau ArrayBuffer.');
  }

  // Use .slice(0) so PDF.js can transfer the buffer without detaching our copy
  const pdf = await pdfjs.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const total = pdf.numPages;

  if (total > FILE_LIMITS.maxPdfPagesHard) {
    throw new Error(`PDF memiliki ${total} halaman, melebihi batas ${FILE_LIMITS.maxPdfPagesHard}.`);
  }

  const images = [];
  for (let i = 1; i <= total; i++) {
    if (signal?.aborted) {
      throw new DOMException('Dibatalkan', 'AbortError');
    }

    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: SCALE });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(vp.width));
    canvas.height = Math.max(1, Math.floor(vp.height));
    const ctx = canvas.getContext('2d');

    // Render with timeout
    await Promise.race([
      page.render({ canvasContext: ctx, viewport: vp }).promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout merender halaman ${i}.`)), TIMEOUTS.pdfRender)
      ),
    ]);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    images.push({ dataUrl, w: canvas.width, h: canvas.height });

    // Cleanup canvas to free memory
    canvas.width = 0;
    canvas.height = 0;

    if (onProgress) onProgress({ page: i, total });
  }

  // Close the PDF document to free memory
  try { pdf.cleanup(); pdf.destroy(); } catch (e) { /* ignore */ }

  return images;
}

/**
 * Render the FIRST page of a PDF as a preview image (for the modal preview).
 * Smaller scale than export for fast preview.
 */
export async function renderPdfPreview(arrayBuffer, maxW = 360, maxH = 360) {
  const pdfjs = await AttachmentStorage_getPdfjs();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const page = await pdf.getPage(1);
  // Find a scale that fits within maxW × maxH
  const baseVp = page.getViewport({ scale: 1 });
  const scale = Math.min(maxW / baseVp.width, maxH / baseVp.height);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  try { pdf.cleanup(); pdf.destroy(); } catch (e) { /* ignore */ }
  return canvas;
}

// Avoid circular import — get PDF.js lazily through a global helper
async function AttachmentStorage_getPdfjs() {
  // Dynamic import to break cycle
  const mod = await import('./attachment-storage.js');
  return mod.AttachmentStorage.getPdfjs();
}
