// ─── ATTACHMENT IMAGE HELPERS ───────────────────────────────────────────────
// Image rotation + preview with aspect ratio PRESERVED (fixes B3, B9).
// Old code stretched images to fill A4 — distorted KTP photos. We use 'contain'.

import { loadImage } from '../core/utils.js';
import { A4 } from '../core/constants.js';

/**
 * Rotate a Blob (image) by N degrees, return a new JPEG Blob.
 * Aspect ratio is preserved — never stretched.
 */
export async function rotateImageBlob(blob, degrees) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const swapped = degrees === 90 || degrees === 270;
    const cw = swapped ? img.naturalHeight : img.naturalWidth;
    const ch = swapped ? img.naturalWidth  : img.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        b => b ? resolve(b) : reject(new Error('Gagal membuat gambar hasil rotasi.')),
        'image/jpeg', 0.92
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Draw an image onto an A4 canvas using 'contain' fit (no distortion).
 * Returns { canvas, widthPx, heightMm, heightMm } for PDF placement.
 */
export async function imageToA4Canvas(blob, rotation = 0) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const deg = ((rotation % 360) + 360) % 360;
    const swapped = deg === 90 || deg === 270;

    // Original dimensions (post-rotation)
    const srcW = swapped ? img.naturalHeight : img.naturalWidth;
    const srcH = swapped ? img.naturalWidth  : img.naturalHeight;

    // A4 portrait canvas — capped resolution for memory safety
    const A4_W = A4.widthPx * A4.renderScale;   // ~1588
    const A4_H = A4.heightPx * A4.renderScale;  // ~2246

    const canvas = document.createElement('canvas');
    canvas.width = A4_W;
    canvas.height = A4_H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, A4_W, A4_H);

    // Contain: scale so image fits ENTIRELY within A4, preserve aspect ratio
    const scale = Math.min(A4_W / srcW, A4_H / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const dx = (A4_W - drawW) / 2;
    const dy = (A4_H - drawH) / 2;

    ctx.save();
    ctx.translate(A4_W / 2, A4_H / 2);
    ctx.rotate((deg * Math.PI) / 180);
    // After rotation, draw image so that visually srcW × srcH occupies drawW × drawH centered at origin
    const innerW = swapped ? drawH : drawW;
    const innerH = swapped ? drawW : drawH;
    ctx.drawImage(img, -innerW / 2, -innerH / 2, innerW, innerH);
    ctx.restore();

    return {
      canvas,
      widthPx: A4_W,
      heightPx: A4_H,
      // For PDF: place at 0,0 with full A4 mm dimensions; canvas is already A4 portrait
      widthMm: A4.widthMm,
      heightMm: A4.heightMm,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Detect if image is landscape (after applying user rotation).
 */
export async function isImageLandscape(blob, rotation = 0) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const swapped = rotation === 90 || rotation === 270;
    const w = swapped ? img.naturalHeight : img.naturalWidth;
    const h = swapped ? img.naturalWidth  : img.naturalHeight;
    return w > h;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Render a small preview of an image attachment onto a canvas element.
 * Returns a Promise<canvas> — caller is responsible for inserting into DOM.
 */
export async function renderImagePreview(blob, targetCanvas, rotation = 0, maxW = 360, maxH = 180) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const swapped = rotation === 90 || rotation === 270;
    const rw = swapped ? img.naturalHeight : img.naturalWidth;
    const rh = swapped ? img.naturalWidth  : img.naturalHeight;
    const scale = Math.min(maxW / rw, maxH / rh);
    targetCanvas.width  = Math.max(1, Math.round(rw * scale));
    targetCanvas.height = Math.max(1, Math.round(rh * scale));
    const ctx = targetCanvas.getContext('2d');
    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx.save();
    ctx.translate(targetCanvas.width / 2, targetCanvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    const dw = swapped ? Math.round(rh * scale) : Math.round(rw * scale);
    const dh = swapped ? Math.round(rw * scale) : Math.round(rh * scale);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    return targetCanvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
