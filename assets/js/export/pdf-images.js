// ─── PDF IMAGE PLACEMENT ─────────────────────────────────────────────────────
// Places attachment images onto PDF pages with aspect ratio PRESERVED.
// Fixes B3 (stretch distortion) and B9 (dead params + 210×297 stretch).

import { A4, PDF } from '../core/constants.js';
import { imageToA4Canvas } from '../attachments/attachment-image.js';

/**
 * Add an image attachment as a new PDF page. Aspect ratio is preserved via
 * 'contain' fit on a white A4 background — image is never stretched.
 *
 * @param {jsPDF} pdf
 * @param {Blob} blob - image blob
 * @param {number} rotation - 0/90/180/270 (user-applied)
 */
export async function addImagePage(pdf, blob, rotation = 0) {
  try {
    const { canvas, widthPx, heightPx } = await imageToA4Canvas(blob, rotation);
    const dataUrl = canvas.toDataURL('image/jpeg', PDF.jpegQuality);
    pdf.addPage();
    // Canvas is already A4 portrait (with white background fill) — full-bleed placement
    pdf.addImage(dataUrl, 'JPEG', 0, 0, A4.widthMm, A4.heightMm);

    // Cleanup canvas to release memory
    canvas.width = 0;
    canvas.height = 0;
  } catch (e) {
    console.error('[pdf-images] addImagePage failed:', e);
    throw new Error('Gagal menambahkan halaman gambar: ' + (e?.message || ''));
  }
}
