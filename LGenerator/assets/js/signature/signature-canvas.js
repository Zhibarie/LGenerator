// ─── SIGNATURE CANVAS ───────────────────────────────────────────────────────
// High-DPI canvas drawing with pointer events (mouse + touch + stylus).
// Caps devicePixelRatio to 2 for memory safety (retina phones at DPR=3).
// Uses Pointer Events (not separate mouse + touch) so no double-firing.
// 'touch-action: none' applied ONLY to canvas, not page.

import { SIGNATURE } from '../core/constants.js';

export const SignatureCanvas = {
  canvas: null,
  ctx: null,
  drawing: false,
  lastX: 0,
  lastY: 0,
  penColor: SIGNATURE.defaultColor,
  penSize: SIGNATURE.defaultSize,
  isEmpty: true,
  dpr: 1,

  init(canvas) {
    this.canvas = canvas;
    if (!canvas) return;
    this.ctx = canvas.getContext('2d');
    // Cap DPR to SIGNATURE.maxDpr (memory safety)
    this.dpr = Math.min(window.devicePixelRatio || 1, SIGNATURE.maxDpr);

    this.resize();
    this.bindEvents();

    // Re-resize on orientation change (mobile) — preserve content if possible
    window.addEventListener('orientationchange', () => {
      // Defer until layout settles
      setTimeout(() => this.resize(true), 300);
    });
  },

  resize(preserveContent = false) {
    if (!this.canvas) return;
    // Read CSS dimensions
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) {
      // Canvas not visible (modal still animating). Defer.
      requestAnimationFrame(() => this.resize(preserveContent));
      return;
    }

    // Capture current image if we want to preserve
    let snapshot = null;
    if (preserveContent && !this.isEmpty) {
      try { snapshot = this.canvas.toDataURL('image/png'); } catch (e) { /* ignore */ }
    }

    this.canvas.width = Math.floor(rect.width * this.dpr);
    this.canvas.height = Math.floor(rect.height * this.dpr);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(this.dpr, this.dpr);
    this.clear();

    // Restore snapshot if any
    if (snapshot) {
      const img = new Image();
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
        this.isEmpty = false;
      };
      img.src = snapshot;
    }
  },

  bindEvents() {
    if (!this.canvas) return;
    // Use Pointer Events — single API for mouse/touch/stylus
    this.canvas.addEventListener('pointerdown', e => this.onDown(e));
    this.canvas.addEventListener('pointermove', e => this.onMove(e));
    this.canvas.addEventListener('pointerup',   e => this.onUp(e));
    this.canvas.addEventListener('pointerleave', e => this.onUp(e));
    this.canvas.addEventListener('pointercancel', e => this.onUp(e));
  },

  getPos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  },

  onDown(e) {
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    this.drawing = true;
    const p = this.getPos(e);
    this.lastX = p.x;
    this.lastY = p.y;
    // Dot for tap (so user can dot an i, etc.)
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, this.penSize / 2, 0, Math.PI * 2);
    this.ctx.fillStyle = this.penColor;
    this.ctx.fill();
    this.isEmpty = false;
  },

  onMove(e) {
    if (!this.drawing) return;
    e.preventDefault();
    const p = this.getPos(e);
    this.ctx.strokeStyle = this.penColor;
    this.ctx.lineWidth = this.penSize;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(p.x, p.y);
    this.ctx.stroke();
    this.lastX = p.x;
    this.lastY = p.y;
    this.isEmpty = false;
  },

  onUp(e) {
    if (!this.drawing) return;
    this.drawing = false;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  },

  setColor(c) { this.penColor = c; },
  setSize(s) { this.penSize = parseFloat(s); },

  clear() {
    if (!this.ctx) return;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.isEmpty = true;
  },

  /** Check if canvas is blank (no visible strokes). */
  checkBlank() {
    if (!this.ctx) return true;
    const data = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    // Sample every Nth pixel for performance
    for (let i = 0; i < data.length; i += 16) {
      if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) return false;
    }
    return true;
  },

  /** Export as a PNG data URL with transparent background (not white). */
  toTransparentPng() {
    if (!this.ctx || this.checkBlank()) return null;
    // Extract alpha channel: any pixel that's not pure white → opaque; white → transparent
    const w = this.canvas.width, h = this.canvas.height;
    const imgData = this.ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const isWhite = r > 240 && g > 240 && b > 240;
      data[i + 3] = isWhite ? 0 : 255; // alpha
    }
    this.ctx.putImageData(imgData, 0, 0);
    return this.canvas.toDataURL('image/png');
  },
};
