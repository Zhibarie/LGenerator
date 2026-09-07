// ─── PDF METADATA + FILENAME ────────────────────────────────────────────────
// Sets PDF document properties (Title, Author, etc.) and generates clean
// filenames with timestamp.

import { PDF as PDF_CFG } from '../core/constants.js';
import { sanitizeFilename } from '../core/utils.js';

/**
 * Apply metadata to a jsPDF instance.
 * Note: we intentionally do NOT store user PII in metadata (no name/email).
 */
export function setPdfMetadata(pdf, { title, subject } = {}) {
  if (!pdf || typeof pdf.setProperties !== 'function') return;
  try {
    pdf.setProperties({
      title: title || 'Surat Lamaran Kerja',
      subject: subject || 'Dokumen lamaran kerja',
      creator: PDF_CFG.metadata.creator,
      producer: PDF_CFG.metadata.producer,
      creationDate: new Date(),
    });
  } catch (e) {
    console.warn('[PDF Metadata] setProperties failed:', e);
  }
}

/**
 * Build a timestamped, sanitized filename.
 */
export function makeFilename(prefix, ext = 'pdf') {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const safe = sanitizeFilename(prefix, 'document');
  return `${safe}_${ts}.${ext}`;
}
