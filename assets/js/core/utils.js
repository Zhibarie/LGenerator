// ─── CORE UTILS ─────────────────────────────────────────────────────────────
// Pure functions. No side effects. Safe to import anywhere.

/**
 * Escape HTML special chars for safe insertion into textContent / innerText.
 * Use this when assigning user input as plain text.
 */
export function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate a UUID. Falls back to timestamp+random if crypto.randomUUID missing.
 */
export function uuid() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (e) { /* fallthrough */ }
  // RFC4122 v4-ish fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Debounce — call fn at most once per wait window.
 */
export function debounce(fn, wait = 300) {
  let t = null;
  const wrapped = (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => { if (t) clearTimeout(t); };
  wrapped.flush = (...args) => { if (t) clearTimeout(t); fn(...args); };
  return wrapped;
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(b) {
  if (!b || b < 0) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Promise wrapper around Image() with timeout + onerror reject.
 * Prevents infinite hanging promises.
 */
export function loadImage(src, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let timer = null;
    const cleanup = () => { if (timer) clearTimeout(timer); };
    img.onload = () => { cleanup(); resolve(img); };
    img.onerror = () => { cleanup(); reject(new Error('Gagal memuat gambar.')); };
    timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout memuat gambar.'));
    }, timeoutMs);
    img.src = src;
  });
}

/**
 * Promise wrapper around FileReader.readAsDataURL with onerror reject.
 */
export function fileToDataUrl(file, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    let timer = null;
    const cleanup = () => { if (timer) clearTimeout(timer); };
    r.onload = e => { cleanup(); resolve(e.target.result); };
    r.onerror = () => { cleanup(); reject(new Error('Gagal membaca file.')); };
    timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout membaca file.'));
    }, timeoutMs);
    r.readAsDataURL(file);
  });
}

/**
 * Convert ArrayBuffer to data URL via Blob.
 */
export function bufferToDataUrl(buffer, type) {
  return new Promise((resolve, reject) => {
    try {
      const blob = new Blob([buffer], { type });
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.onerror = () => reject(new Error('Gagal mengkonversi buffer.'));
      r.readAsDataURL(blob);
    } catch (e) { reject(e); }
  });
}

/**
 * Sanitize filename — strip illegal chars, collapse dots, cap length.
 */
export function sanitizeFilename(name, fallback = 'file') {
  if (!name) return fallback;
  let s = String(name).trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '');
  if (s.length > 100) s = s.slice(0, 100);
  return s || fallback;
}

/**
 * Build a timestamped filename for export.
 */
export function buildFilename(prefix, ext = 'pdf') {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return sanitizeFilename(`${prefix}_${ts}`, prefix) + '.' + ext;
}

/**
 * Format date in Indonesian.
 */
export function formatTanggalID(date) {
  if (!(date instanceof Date) || isNaN(date)) date = new Date();
  return date.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/**
 * Detect mobile by pointer + viewport.
 */
export function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/**
 * Detect if device primarily uses touch.
 */
export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

/**
 * Promise-based sleep.
 */
export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Promise-based next animation frame.
 */
export function nextFrame() {
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

/**
 * Clamp value.
 */
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Detect file MIME from extension fallback (when browser returns generic).
 */
export function guessMime(filename) {
  const ext = (filename || '').toLowerCase().split('.').pop();
  const map = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Validate that a MIME type is allowed for attachments.
 */
export function isAllowedAttachmentType(type, filename) {
  const t = (type || '').toLowerCase();
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(t)) return true;
  // cross-check with extension
  const guessed = guessMime(filename);
  return allowed.includes(guessed);
}
