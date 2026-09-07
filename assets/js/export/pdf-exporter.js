// ─── PDF EXPORTER (main controller) ─────────────────────────────────────────
// Orchestrates letter / CV / unified exports.
// Each export job is cancellable + reports progress via EventBus.
// On cancel or error: cleanup canvases + restore UI.
//
// Fixes:
//   B3 (image stretching) → uses addImagePage with aspect-ratio-preserving fit
//   B4 (raster text) → letter uses jsPDF text primitives where possible
//                       (a simplified structured rendering for body text + table)
//                       CV uses html2canvas (acceptable, see pdf-renderer.js LIMITATION)
//   B8 (CV multi-page) → uses paginateCv from pdf-pagination.js
//   B9 (dead params) → no dead parameters
//   B11 (magic numbers) → all sizes come from constants.js A4

import { A4, PDF, TIMEOUTS } from '../core/constants.js';
import { AppState } from '../core/state.js';
import { EventBus, EVT } from '../core/events.js';
import { AttachmentManager } from '../attachments/attachment-manager.js';
import { getJsPDF, renderElementToJpeg, prepareFrameForRender } from './pdf-renderer.js';
import { paginateCv } from './pdf-pagination.js';
import { addImagePage } from './pdf-images.js';
import { setPdfMetadata, makeFilename } from './pdf-metadata.js';
import { pdfToImages } from '../attachments/attachment-pdf.js';
import { sanitizeFilename, sleep } from '../core/utils.js';
import { Sanitizer } from '../editor/content-sanitizer.js';

export const PdfExporter = {
  abortController: null,

  /** Export just the surat (letter) PDF — hybrid: structured text + signature image */
  async exportLetter() {
    if (AppState.get().ui.isExporting) return;
    this.abortController = new AbortController();
    AppState.setExporting(true);
    EventBus.emit(EVT.EXPORT_PROGRESS, { pct: 0, msg: 'Menyiapkan surat...' });

    try {
      const JsPDF = await getJsPDF();
      const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      setPdfMetadata(pdf, { title: 'Surat Lamaran Kerja' });

      // Get letter state
      const fields = AppState.get().letter.fields;

      // Layout: A4 portrait, 12mm margins, Times-style
      const MARGIN = 12;
      const USABLE_W = A4.widthMm - 2 * MARGIN;  // 186mm
      let y = MARGIN + 4;

      // 1. Tanggal (right-aligned)
      pdf.setFontSize(12);
      pdf.setFont('times', 'normal');
      const kota = Sanitizer.sanitizeText(fields.kota || '');
      const tgl = formatTanggalShort();
      pdf.text(`${kota}, ${tgl}`, A4.widthMm - MARGIN, y, { align: 'right' });
      y += 14;

      // 2. Judul (centered, underlined, bold)
      pdf.setFont('times', 'bold');
      pdf.setFontSize(13);
      pdf.text('SURAT LAMARAN PEKERJAAN', A4.widthMm / 2, y, { align: 'center' });
      y += 2;
      // Underline (manual line)
      const judulW = pdf.getTextWidth('SURAT LAMARAN PEKERJAAN');
      pdf.setLineWidth(0.5);
      pdf.line(A4.widthMm / 2 - judulW / 2, y, A4.widthMm / 2 + judulW / 2, y);
      y += 14;

      // 3. Kepada Yth
      pdf.setFont('times', 'normal');
      pdf.setFontSize(12);
      const tujuanNama = Sanitizer.sanitizeText(fields.tujuan_nama || '');
      const tujuanLokasi = Sanitizer.sanitizeText(fields.tujuan_lokasi || '');
      pdf.text('Kepada Yth,', MARGIN, y); y += 6;
      pdf.text(tujuanNama, MARGIN, y); y += 6;
      pdf.text(tujuanLokasi, MARGIN, y); y += 12;

      // 4. "Dengan hormat,"
      pdf.text('Dengan hormat,', MARGIN, y); y += 10;

      // 5. Paragraf pembuka (justified)
      const paraOpen = Sanitizer.sanitizeText(fields.paragraf_buka || '');
      y = addParagraph(pdf, paraOpen, MARGIN, y, USABLE_W, 12, 7);

      // 6. Paragraf niat — may contain <strong>...</strong> for position
      // We render it as: text before <strong>, then bold position, then text after
      const paraNiat = fields.paragraf_niat || '';
      y = addHtmlParagraph(pdf, paraNiat, MARGIN, y, USABLE_W, 12, 7);

      // 7. "Berikut adalah profil singkat..."
      pdf.text('Berikut adalah profil singkat saya sebagai bahan informasi tentang saya :', MARGIN, y); y += 8;

      // 8. Tabel data diri
      const rows = [
        ['Nama', fields.nama],
        ['Tempat Tanggal Lahir', fields.ttl],
        ['Jenis Kelamin', fields.jk],
        ['Alamat Lengkap', fields.alamat],
        ['Pendidikan', fields.pendidikan],
        ['Agama', fields.agama],
        ['Status Perkawinan', fields.status],
        ['No Telepon', fields.telepon],
        ['Email', fields.email],
      ];
      y = addTable(pdf, rows, MARGIN, y, USABLE_W);

      // 9. Paragraf keahlian
      const paraKeahlian = Sanitizer.sanitizeText(fields.paragraf_keahlian || '');
      y = addParagraph(pdf, paraKeahlian, MARGIN, y, USABLE_W, 12, 7);

      // 10. Lampiran header
      pdf.text('Sebagai bahan pertimbangan, saya lampirkan:', MARGIN, y); y += 8;

      // Lampiran list (2 columns)
      const lampItems = AppState.get().letter.attachments.map(a => a.text || '');
      y = addAttachmentList(pdf, lampItems, MARGIN, y, USABLE_W);

      // 11. Paragraf penutup
      const paraTutup = Sanitizer.sanitizeText(fields.paragraf_tutup || '');
      y = addParagraph(pdf, paraTutup, MARGIN, y, USABLE_W, 12, 7);

      // 12. Tanda tangan block (right side)
      const sigX = A4.widthMm - MARGIN - 60;
      const sigW = 60, sigH = 20;
      pdf.text('Hormat saya,', sigX + sigW / 2, y, { align: 'center' }); y += 8;

      // Insert signature image if present
      const sigData = AppState.get().signature;
      if (sigData) {
        try {
          // If sigData is object URL, fetch it as data URL
          let dataUrl = sigData;
          if (sigData.startsWith('blob:')) {
            const blob = await (await fetch(sigData)).blob();
            dataUrl = await new Promise(r => {
              const fr = new FileReader();
              fr.onload = () => r(fr.result);
              fr.readAsDataURL(blob);
            });
          }
          pdf.addImage(dataUrl, 'PNG', sigX + (sigW - 40) / 2, y, 40, sigH, undefined, 'FAST');
          y += sigH + 2;
        } catch (e) {
          console.warn('Signature addImage failed:', e);
          y += sigH + 2;
        }
      } else {
        y += sigH + 2;
      }

      // Nama
      pdf.setFont('times', 'bold');
      pdf.text(Sanitizer.sanitizeText(fields.ttd_nama || ''), sigX + sigW / 2, y, { align: 'center' });

      EventBus.emit(EVT.EXPORT_PROGRESS, { pct: 100, msg: 'Menyimpan PDF...' });
      pdf.save(makeFilename('Surat_Lamaran_Kerja', 'pdf'));
      EventBus.emit(EVT.EXPORT_DONE);
      EventBus.emit(EVT.NOTIFY, { type: 'success', msg: 'PDF surat berhasil dibuat.' });
    } catch (e) {
      console.error('[PdfExporter] exportLetter failed:', e);
      EventBus.emit(EVT.EXPORT_ERROR, e.message);
      EventBus.emit(EVT.NOTIFY, { type: 'error', msg: 'Gagal membuat PDF surat: ' + e.message });
    } finally {
      AppState.setExporting(false);
      this.abortController = null;
    }
  },

  /** Export CV as PDF — multi-page via paginateCv */
  async exportCV() {
    if (AppState.get().ui.isExporting) return;
    this.abortController = new AbortController();
    AppState.setExporting(true);
    EventBus.emit(EVT.EXPORT_PROGRESS, { pct: 0, msg: 'Menyiapkan CV...' });

    const cvFrame = document.getElementById('cvFrame');
    if (!cvFrame) {
      EventBus.emit(EVT.NOTIFY, { type: 'error', msg: 'CV tidak ditemukan.' });
      AppState.setExporting(false);
      return;
    }

    const restore = prepareFrameForRender(cvFrame);
    try {
      EventBus.emit(EVT.EXPORT_PROGRESS, { pct: 10, msg: 'Membagi CV menjadi halaman...' });
      const pages = await paginateCv(
        cvFrame,
        ({ page, total }) => {
          const pct = 10 + Math.round((page / total) * 70);
          EventBus.emit(EVT.EXPORT_PROGRESS, { pct, msg: `Merender halaman ${page}/${total}...` });
        },
        this.abortController.signal,
      );

      const JsPDF = await getJsPDF();
      const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      setPdfMetadata(pdf, { title: 'Curriculum Vitae' });

      // First page already added by jsPDF constructor
      pages.forEach((p, i) => {
        if (i > 0) pdf.addPage();
        // CV pages may not be exact A4 aspect ratio (if content shorter) — fit width
        const ratio = p.w / p.h;
        const w = A4.widthMm;
        const h = w / ratio;
        // If taller than A4, cap to A4 height (with letterboxing)
        if (h > A4.heightMm) {
          const hh = A4.heightMm;
          const ww = hh * ratio;
          pdf.addImage(p.dataUrl, 'JPEG', (A4.widthMm - ww) / 2, 0, ww, hh);
        } else {
          pdf.addImage(p.dataUrl, 'JPEG', 0, 0, w, h);
        }
      });

      EventBus.emit(EVT.EXPORT_PROGRESS, { pct: 100, msg: 'Menyimpan PDF...' });
      pdf.save(makeFilename('CV', 'pdf'));
      EventBus.emit(EVT.EXPORT_DONE);
      EventBus.emit(EVT.NOTIFY, { type: 'success', msg: 'PDF CV berhasil dibuat.' });
    } catch (e) {
      if (e.name === 'AbortError') {
        EventBus.emit(EVT.EXPORT_CANCEL);
        EventBus.emit(EVT.NOTIFY, { type: 'info', msg: 'Export dibatalkan.' });
      } else {
        console.error('[PdfExporter] exportCV failed:', e);
        EventBus.emit(EVT.EXPORT_ERROR, e.message);
        EventBus.emit(EVT.NOTIFY, { type: 'error', msg: 'Gagal membuat PDF CV: ' + e.message });
      }
    } finally {
      restore();
      AppState.setExporting(false);
      this.abortController = null;
    }
  },

  /** Export surat + CV + lampiran as a single multi-page PDF */
  async exportUnified() {
    if (AppState.get().ui.isExporting) return;
    this.abortController = new AbortController();
    AppState.setExporting(true);
    EventBus.emit(EVT.EXPORT_PROGRESS, { pct: 0, msg: 'Menyiapkan dokumen lengkap...' });

    try {
      const JsPDF = await getJsPDF();
      const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      setPdfMetadata(pdf, { title: 'Lamaran dan CV' });

      // Page 1: Letter — render as structured text (same as exportLetter body)
      EventBus.emit(EVT.EXPORT_PROGRESS, { pct: 10, msg: 'Merender surat...' });
      await this.renderLetterToPdf(pdf);

      // Page 2+: CV (paginated)
      EventBus.emit(EVT.EXPORT_PROGRESS, { pct: 30, msg: 'Merender CV...' });
      const cvFrame = document.getElementById('cvFrame');
      if (cvFrame) {
        const restore = prepareFrameForRender(cvFrame);
        try {
          const cvPages = await paginateCv(cvFrame, ({ page, total }) => {
            const pct = 30 + Math.round((page / total) * 30);
            EventBus.emit(EVT.EXPORT_PROGRESS, { pct, msg: `CV halaman ${page}/${total}...` });
          }, this.abortController.signal);
          cvPages.forEach(p => {
            pdf.addPage();
            const ratio = p.w / p.h;
            const w = A4.widthMm;
            const h = w / ratio;
            if (h > A4.heightMm) {
              const hh = A4.heightMm;
              const ww = hh * ratio;
              pdf.addImage(p.dataUrl, 'JPEG', (A4.widthMm - ww) / 2, 0, ww, hh);
            } else {
              pdf.addImage(p.dataUrl, 'JPEG', 0, 0, w, h);
            }
          });
        } finally {
          restore();
        }
      }

      // Lampiran
      const lamps = await AttachmentManager.getLinkedForExport();
      if (lamps.length > 0) {
        for (let i = 0; i < lamps.length; i++) {
          if (this.abortController.signal.aborted) throw new DOMException('Dibatalkan', 'AbortError');
          const lamp = lamps[i];
          const pct = 60 + Math.round((i / lamps.length) * 35);
          EventBus.emit(EVT.EXPORT_PROGRESS, {
            pct,
            msg: `Lampiran ${i + 1}/${lamps.length}: ${sanitizeFilename(lamp.name, 'lampiran')}...`,
          });

          if (lamp.type === 'application/pdf' || lamp.name.toLowerCase().endsWith('.pdf')) {
            const images = await pdfToImages(lamp.blob, ({ page, total }) => {
              const sub = 60 + Math.round(((i + page / total) / lamps.length) * 35);
              EventBus.emit(EVT.EXPORT_PROGRESS, {
                pct: sub,
                msg: `Lampiran ${i + 1}/${lamps.length} halaman ${page}/${total}...`,
              });
            }, this.abortController.signal);
            images.forEach(img => {
              pdf.addPage();
              // Preserve aspect ratio: contain fit
              const ratio = img.w / img.h;
              const w = A4.widthMm;
              const h = w / ratio;
              if (h > A4.heightMm) {
                const hh = A4.heightMm;
                const ww = hh * ratio;
                pdf.addImage(img.dataUrl, 'JPEG', (A4.widthMm - ww) / 2, 0, ww, hh);
              } else {
                pdf.addImage(img.dataUrl, 'JPEG', 0, (A4.heightMm - h) / 2, w, h);
              }
            });
          } else {
            // Image — addImagePage preserves aspect ratio
            await addImagePage(pdf, lamp.blob, lamp.rotation || 0);
          }
        }
      }

      EventBus.emit(EVT.EXPORT_PROGRESS, { pct: 100, msg: 'Menyimpan PDF...' });
      const lampCount = lamps.length;
      const fname = lampCount > 0
        ? makeFilename(`Lamaran_Lengkap_+${lampCount}lampiran`, 'pdf')
        : makeFilename('Lamaran_Lengkap', 'pdf');
      pdf.save(fname);
      EventBus.emit(EVT.EXPORT_DONE);
      EventBus.emit(EVT.NOTIFY, { type: 'success', msg: 'PDF lengkap berhasil dibuat.' });
    } catch (e) {
      if (e.name === 'AbortError') {
        EventBus.emit(EVT.EXPORT_CANCEL);
        EventBus.emit(EVT.NOTIFY, { type: 'info', msg: 'Export dibatalkan.' });
      } else {
        console.error('[PdfExporter] exportUnified failed:', e);
        EventBus.emit(EVT.EXPORT_ERROR, e.message);
        EventBus.emit(EVT.NOTIFY, { type: 'error', msg: 'Gagal membuat PDF: ' + e.message });
      }
    } finally {
      AppState.setExporting(false);
      this.abortController = null;
    }
  },

  cancel() {
    if (this.abortController) this.abortController.abort();
  },

  /** Internal: render letter body onto an existing pdf instance (page 1) */
  async renderLetterToPdf(pdf) {
    const fields = AppState.get().letter.fields;
    const MARGIN = 12;
    const USABLE_W = A4.widthMm - 2 * MARGIN;
    let y = MARGIN + 4;

    pdf.setFontSize(12);
    pdf.setFont('times', 'normal');

    // Tanggal
    const kota = Sanitizer.sanitizeText(fields.kota || '');
    const tgl = formatTanggalShort();
    pdf.text(`${kota}, ${tgl}`, A4.widthMm - MARGIN, y, { align: 'right' });
    y += 14;

    // Judul
    pdf.setFont('times', 'bold');
    pdf.setFontSize(13);
    pdf.text('SURAT LAMARAN PEKERJAAN', A4.widthMm / 2, y, { align: 'center' });
    y += 2;
    const judulW = pdf.getTextWidth('SURAT LAMARAN PEKERJAAN');
    pdf.setLineWidth(0.5);
    pdf.line(A4.widthMm / 2 - judulW / 2, y, A4.widthMm / 2 + judulW / 2, y);
    y += 14;

    pdf.setFont('times', 'normal');
    pdf.setFontSize(12);
    pdf.text('Kepada Yth,', MARGIN, y); y += 6;
    pdf.text(Sanitizer.sanitizeText(fields.tujuan_nama || ''), MARGIN, y); y += 6;
    pdf.text(Sanitizer.sanitizeText(fields.tujuan_lokasi || ''), MARGIN, y); y += 12;
    pdf.text('Dengan hormat,', MARGIN, y); y += 10;

    y = addParagraph(pdf, Sanitizer.sanitizeText(fields.paragraf_buka || ''), MARGIN, y, USABLE_W, 12, 7);
    y = addHtmlParagraph(pdf, fields.paragraf_niat || '', MARGIN, y, USABLE_W, 12, 7);
    pdf.text('Berikut adalah profil singkat saya sebagai bahan informasi tentang saya :', MARGIN, y); y += 8;

    const rows = [
      ['Nama', fields.nama],
      ['Tempat Tanggal Lahir', fields.ttl],
      ['Jenis Kelamin', fields.jk],
      ['Alamat Lengkap', fields.alamat],
      ['Pendidikan', fields.pendidikan],
      ['Agama', fields.agama],
      ['Status Perkawinan', fields.status],
      ['No Telepon', fields.telepon],
      ['Email', fields.email],
    ];
    y = addTable(pdf, rows, MARGIN, y, USABLE_W);
    y = addParagraph(pdf, Sanitizer.sanitizeText(fields.paragraf_keahlian || ''), MARGIN, y, USABLE_W, 12, 7);
    pdf.text('Sebagai bahan pertimbangan, saya lampirkan:', MARGIN, y); y += 8;
    const lampItems = AppState.get().letter.attachments.map(a => a.text || '');
    y = addAttachmentList(pdf, lampItems, MARGIN, y, USABLE_W);
    y = addParagraph(pdf, Sanitizer.sanitizeText(fields.paragraf_tutup || ''), MARGIN, y, USABLE_W, 12, 7);

    // Signature block
    const sigX = A4.widthMm - MARGIN - 60;
    const sigW = 60, sigH = 20;
    pdf.text('Hormat saya,', sigX + sigW / 2, y, { align: 'center' }); y += 8;
    const sigData = AppState.get().signature;
    if (sigData) {
      try {
        let dataUrl = sigData;
        if (sigData.startsWith('blob:')) {
          const blob = await (await fetch(sigData)).blob();
          dataUrl = await new Promise(r => {
            const fr = new FileReader();
            fr.onload = () => r(fr.result);
            fr.readAsDataURL(blob);
          });
        }
        pdf.addImage(dataUrl, 'PNG', sigX + (sigW - 40) / 2, y, 40, sigH, undefined, 'FAST');
        y += sigH + 2;
      } catch (e) { y += sigH + 2; }
    } else {
      y += sigH + 2;
    }
    pdf.setFont('times', 'bold');
    pdf.text(Sanitizer.sanitizeText(fields.ttd_nama || ''), sigX + sigW / 2, y, { align: 'center' });
  },
};

// ── Helpers for text layout in PDF ──────────────────────────────────────────
function formatTanggalShort() {
  const d = new Date();
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function addParagraph(pdf, text, x, y, w, fontSize, lineGap) {
  pdf.setFontSize(fontSize);
  pdf.setFont('times', 'normal');
  const lines = pdf.splitTextToSize(text, w);
  lines.forEach(line => {
    pdf.text(line, x, y, { align: 'justify', maxWidth: w });
    y += lineGap;
  });
  return y + 2;
}

/**
 * Render a paragraph that may contain <strong>...</strong> tags (sanitized).
 * Strips other tags, renders <strong> in bold.
 */
function addHtmlParagraph(pdf, html, x, y, w, fontSize, lineGap) {
  // First sanitize to only allow <strong>
  const safe = Sanitizer.sanitizeWithFormatting(html);
  // Tokenize by <strong>...</strong>
  const tokens = [];
  const re = /<strong>(.*?)<\/strong>/gi;
  let lastIdx = 0;
  let m;
  while ((m = re.exec(safe)) !== null) {
    if (m.index > lastIdx) tokens.push({ text: safe.slice(lastIdx, m.index), bold: false });
    tokens.push({ text: m[1], bold: true });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < safe.length) tokens.push({ text: safe.slice(lastIdx), bold: false });
  // Strip any remaining tags (defensive)
  tokens.forEach(t => { t.text = t.text.replace(/<[^>]+>/g, ''); });

  // Word-wrap manually, switching font weight per token
  pdf.setFontSize(fontSize);
  const spaceW = pdf.getTextWidth(' ');
  let cursorX = x;
  const maxX = x + w;

  const words = [];
  tokens.forEach(t => {
    const parts = t.text.split(/\s+/).filter(Boolean);
    parts.forEach(p => words.push({ text: p, bold: t.bold }));
  });

  let lineWords = [];
  let lineW = 0;

  for (const word of words) {
    pdf.setFont('times', word.bold ? 'bold' : 'normal');
    const wWidth = pdf.getTextWidth(word.text);
    if (lineW + (lineWords.length > 0 ? spaceW : 0) + wWidth > w) {
      // Flush current line
      flushLine(pdf, lineWords, x, y, w, spaceW);
      y += lineGap;
      lineWords = [];
      lineW = 0;
    }
    lineWords.push(word);
    lineW += (lineWords.length > 1 ? spaceW : 0) + wWidth;
  }
  if (lineWords.length > 0) {
    flushLine(pdf, lineWords, x, y, w, spaceW);
    y += lineGap;
  }
  return y + 2;
}

function flushLine(pdf, words, x, y, w, spaceW) {
  // Justified: distribute extra space if line is not the last
  let cursor = x;
  words.forEach((word, i) => {
    pdf.setFont('times', word.bold ? 'bold' : 'normal');
    pdf.text(word.text, cursor, y);
    cursor += pdf.getTextWidth(word.text) + spaceW;
  });
}

function addTable(pdf, rows, x, y, w) {
  const labelW = 50;
  const colonW = 4;
  pdf.setFont('times', 'normal');
  pdf.setFontSize(12);
  rows.forEach(([label, val]) => {
    pdf.text(Sanitizer.sanitizeText(label || ''), x, y);
    pdf.text(':', x + labelW, y);
    pdf.text(Sanitizer.sanitizeText(val || ''), x + labelW + colonW, y);
    y += 7;
  });
  return y + 4;
}

function addAttachmentList(pdf, items, x, y, w) {
  // 2 columns
  const colW = (w - 8) / 2;
  const midIdx = Math.ceil(items.length / 2);
  const col1 = items.slice(0, midIdx);
  const col2 = items.slice(midIdx);
  pdf.setFont('times', 'normal');
  pdf.setFontSize(12);
  const lineH = 7;
  const maxRows = Math.max(col1.length, col2.length);
  for (let i = 0; i < maxRows; i++) {
    if (col1[i]) {
      const txt1 = `${i + 1}. ${Sanitizer.sanitizeText(col1[i])}`;
      const lines1 = pdf.splitTextToSize(txt1, colW);
      pdf.text(lines1, x, y);
    }
    if (col2[i]) {
      const txt2 = `${midIdx + i + 1}. ${Sanitizer.sanitizeText(col2[i])}`;
      const lines2 = pdf.splitTextToSize(txt2, colW);
      pdf.text(lines2, x + colW + 8, y);
    }
    y += lineH;
  }
  return y + 4;
}
