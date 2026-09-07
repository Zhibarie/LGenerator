// ─── CORE CONSTANTS ─────────────────────────────────────────────────────────
// Single source of truth for all magic numbers used across the app.
// Do NOT duplicate A4 dimensions, breakpoints, or limits in other files.

// ── A4 paper (used by both CSS via :root vars AND JS renderers) ──────────────
export const A4 = {
  widthPx: 794,      // 210mm @ 96 DPI
  heightPx: 1123,    // 297mm @ 96 DPI
  widthMm: 210,
  heightMm: 297,
  // Render scale for raster export (kept modest for mobile memory safety)
  renderScale: 2,
  // PDF.js viewport scale for lampiran pages — print-grade but capped
  pdfLampiranScale: 2,
};

// ── Auto-fit (letter) ───────────────────────────────────────────────────────
export const LETTER_FIT = {
  minFontPt: 7,
  maxFontPt: 13,
  step: 0.2,
  debounceMs: 220,
};

// ── Auto-fit (CV) ───────────────────────────────────────────────────────────
export const CV_FIT = {
  minFontPx: 6,
  maxFontPx: 11.5,
  step: 0.2,
  debounceMs: 220,
};

// ── Storage / persistence ───────────────────────────────────────────────────
export const STORAGE = {
  version: 2,
  // localStorage key prefix — bump version to trigger migration
  keyPrefix: 'lgen_',
  metaKey: 'lgen_meta',
  // IndexedDB
  idbName: 'lgenerator-db',
  idbVersion: 1,
  idbStoreAttachments: 'attachments',
  idbStoreBlobs: 'blobs', // signature, cv photo
};

// ── File upload limits ──────────────────────────────────────────────────────
export const FILE_LIMITS = {
  maxAttachmentBytes: 15 * 1024 * 1024,    // 15 MB
  maxPhotoBytes: 5 * 1024 * 1024,            // 5 MB
  maxSignatureBytes: 3 * 1024 * 1024,        // 3 MB
  maxAttachments: 20,
  maxPdfPagesWarn: 30,      // soft warning threshold
  maxPdfPagesHard: 100,    // refuse beyond this
  allowedAttachmentTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ],
  allowedAttachmentExt: ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
};

// ── Async timeouts ──────────────────────────────────────────────────────────
export const TIMEOUTS = {
  imageLoad: 15000,        // 15s for any Image() load
  pdfRender: 45000,        // 45s per PDF page
  exportTotal: 240000,     // 4 min hard cap for any export job
  autoSaveDebounce: 700,
};

// ── Mobile / responsive ─────────────────────────────────────────────────────
export const BREAKPOINTS = {
  xs: 320,
  sm: 375,
  md: 768,
  lg: 1024,
  xl: 1440,
};

export const TOUCH = {
  minTargetPx: 44,         // iOS HIG / WCAG recommendation
  minSpacingPx: 8,
};

// ── PDF export ──────────────────────────────────────────────────────────────
export const PDF = {
  jpegQuality: 0.85,
  metadata: {
    creator: 'LGenerator',
    producer: 'LGenerator (jsPDF)',
  },
};

// ── Signature canvas ─────────────────────────────────────────────────────────
export const SIGNATURE = {
  maxDpr: 2,             // cap devicePixelRatio for memory safety on retina
  defaultColor: '#000000',
  defaultSize: 2,
  maxWidth: 466,
  maxHeight: 185,
};

// ── Default letter content ──────────────────────────────────────────────────
export const DEFAULT_LETTER = {
  kota: 'Semarang',
  tujuan_nama: 'HRD PT. Kayu Kapur',
  tujuan_lokasi: 'Di Tempat',
  paragraf_buka:
    'Berdasarkan informasi yang saya dapatkan dari brosur yang ditempel di depan PT pada tanggal 25 Juni 2020, bahwa PT. Kayu Kapur sedang membutuhkan pekerja tambahan pada bagian Quality Control.',
  paragraf_niat:
    'Sehubungan dengan itu, melalui surat ini saya bermaksud melamar pekerjaan di perusahaan yang Bapak/Ibu pimpin sebagai <strong>Quality Control</strong>.',
  nama: 'Dani Hamdani',
  ttl: 'Semarang, 07 Agustus 1999',
  jk: 'Laki – laki',
  alamat: 'Ungaran Semarang',
  pendidikan: 'SMK N1 Semarang',
  agama: 'Islam',
  status: 'Belum Kawin',
  telepon: '0823 2224 0471',
  email: 'danihamdani@gmail.com',
  paragraf_keahlian:
    'Saya memiliki kondisi kesehatan yang baik, ketelitian yang tinggi, dan mampu bekerja secara personal maupun tim.',
  paragraf_tutup:
    'Demikian surat permohonan pekerjaan ini saya buat dengan sebenar – benarnya. Saya sangat berharap Bapak/Ibu bersedia untuk memberikan kesempatan tes dan wawancara kepada saya, sehingga saya dapat menjelaskan secara lebih rinci tentang potensi yang saya miliki. Atas perhatian Bapak/Ibu saya ucapkan terima kasih.',
  ttd_nama: 'Dani Hamdani',
};

export const DEFAULT_ATTACHMENTS = [
  'Curriculum Vitae (CV) / Daftar Riwayat Hidup.',
  'Scan ijazah SMK.',
  'Scan transkip nilai.',
  'Scan KTP.',
  'Pas foto berwarna terbaru.',
  'Scan sertifikat pelatihan tentang kewirausahaan.',
  'Scan surat keterangan sehat dari dokter.',
];

// Quick-fill default lampiran checklist
export const IC_LAMP_DEFAULTS = [
  { text: 'Curriculum Vitae (CV) / Daftar Riwayat Hidup.', checked: true },
  { text: 'Scan ijazah terakhir.', checked: true },
  { text: 'Scan transkip nilai.', checked: false },
  { text: 'Scan KTP.', checked: true },
  { text: 'Pas foto berwarna terbaru.', checked: true },
  { text: 'Scan SKCK.', checked: false },
  { text: 'Scan KK.', checked: false },
  { text: 'Scan sertifikat pelatihan.', checked: false },
  { text: 'Scan surat keterangan sehat dari dokter.', checked: false },
  { text: 'Surat Referensi Kerja.', checked: false },
];

// Allowed HTML tags in user content (whitelist for sanitizer)
export const SANITIZE_WHITELIST = {
  tags: ['STRONG', 'B', 'EM', 'I', 'BR', 'U'],
  // No attributes allowed at all — defense in depth
  attrs: {},
};
