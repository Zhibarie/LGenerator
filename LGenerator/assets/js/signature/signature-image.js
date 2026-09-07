// ─── SIGNATURE IMAGE (UPLOAD) ──────────────────────────────────────────────
// Handles user-uploaded signature images. Auto-trims whitespace + preserves
// transparency. Validates size + type.

import { Storage } from '../core/storage.js';
import { FILE_LIMITS, SIGNATURE } from '../core/constants.js';
import { loadImage, fileToDataUrl } from '../core/utils.js';

/**
 * Validate an uploaded signature file.
 */
export function validateSignatureFile(file) {
  if (!file) return { ok: false, reason: 'File tidak ditemukan.' };
  if (file.size > FILE_LIMITS.maxSignatureBytes) {
    return { ok: false, reason: `Ukuran maksimum ${Math.round(FILE_LIMITS.maxSignatureBytes / 1024 / 1024)}MB.` };
  }
  if (!/^image\//.test(file.type)) {
    return { ok: false, reason: 'File harus berupa gambar (PNG/JPG).' };
  }
  return { ok: true };
}

/**
 * Process an uploaded signature image:
 *   1. Load Image
 *   2. Trim surrounding white/transparent pixels (bbox crop)
 *   3. Normalize to PNG with transparent background
 *   4. Cap resolution (max width 600px) for memory safety
 *
 * Returns data URL on success, throws Error otherwise.
 */
export async function processSignatureImage(file) {
  const validation = validateSignatureFile(file);
  if (!validation.ok) throw new Error(validation.reason);

  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  // Cap to max 600px wide (enough for print on A4)
  const maxW = 600;
  const scale = Math.min(1, maxW / img.naturalWidth);

  // Render to canvas
  const w = Math.floor(img.naturalWidth * scale);
  const h = Math.floor(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  // Trim: scan for non-white pixels, find bbox
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  let foundPixel = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
      // Consider non-white OR non-transparent pixel as "ink"
      const isBlank = a === 0 || (r > 235 && g > 235 && b > 235);
      if (!isBlank) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        foundPixel = true;
      }
    }
  }

  if (!foundPixel) {
    throw new Error('Gambar terlihat kosong. Pilih gambar tanda tangan yang jelas.');
  }

  // Add small padding
  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);

  const trimmedW = maxX - minX + 1;
  const trimmedH = maxY - minY + 1;

  // Create trimmed canvas
  const trimmed = document.createElement('canvas');
  trimmed.width = trimmedW;
  trimmed.height = trimmedH;
  const tctx = trimmed.getContext('2d');

  // Copy the original image's pixels (preserves transparency)
  tctx.drawImage(canvas, minX, minY, trimmedW, trimmedH, 0, 0, trimmedW, trimmedH);

  // Make white pixels transparent
  const tData = tctx.getImageData(0, 0, trimmedW, trimmedH);
  const td = tData.data;
  for (let i = 0; i < td.length; i += 4) {
    const r = td[i], g = td[i + 1], b = td[i + 2];
    const isWhite = r > 235 && g > 235 && b > 235;
    if (isWhite) td[i + 3] = 0;
  }
  tctx.putImageData(tData, 0, 0);

  return trimmed.toDataURL('image/png');
}
