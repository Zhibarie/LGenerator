# Changelog

Semua perubahan penting pada LGenerator didokumentasikan di sini.
Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.0.0/),
versi mengikuti [Semantic Versioning](https://semver.org/lang/id/).

## [2.0.0] — 2026-09-07

Refactor besar — modularisasi penuh, perbaikan bug kritis, dukungan mobile menyeluruh.

### Added
- Arsitektur modular ES Modules: 35+ file dengan tanggung jawab tunggal.
- Centralized AppState (`core/state.js`) dengan mutasi terkontrol.
- EventBus pub/sub (`core/events.js`) untuk decoupling antar modul.
- Storage layer dengan error handling (`core/storage.js`) — `safeSet/safeGet/safeRemove`.
- Schema versioning + migration idempotent v1→v2 (`core/migration.js`).
- IndexedDB persistence untuk binary blobs (lampiran, foto, signature).
- Whitelist-based HTML sanitizer (`editor/content-sanitizer.js`).
- Attachment system terpisah: manager / storage / preview / image / pdf.
- PDF exporter dengan pagination (CV multi-page) + aspect-ratio-preserving image fit.
- Modal accessible: focus trap, Escape, ARIA, bottom-sheet di mobile.
- Toast notification system dengan status loading/success/error.
- Loading overlay dengan progress % dan tombol Cancel.
- Responsive viewport tracking + safe-area-inset support.
- 5 test suites (storage, sanitizer, attachment, auto-fit, pdf).
- 2 GitHub workflows: `quality-check.yml` + `deploy-pages.yml`.
- Print stylesheet: `@page A4`, page-break antar dokumen, print backgrounds.
- Keyboard shortcut Ctrl+S untuk save manual.

### Fixed
- **A1** — XSS via `innerHTML` di `applyIsiCepat()`. Semua input user melalui sanitizer.
- **A2** — Lampiran tidak persist setelah refresh. Sekarang disimpan di IndexedDB.
- **A3** — `applyIsiCepat()` menghapus lampiran yang sudah diupload. Sekarang merge + konfirmasi.
- **A4** — `localStorage` quota silent-fail. Sekarang toast "Gagal menyimpan".
- **A5** — SRI integrity hash untuk semua script CDN (FontAwesome).
- **B2** — Auto-fit `Math.round` bisa overflow. Diganti `Math.floor` + invariant check.
- **B3** — Image stretch ke A4 menyebabkan distorsi. Diganti `contain` fit.
- **B4** — PDF teks raster-only. Surat sekarang pakai jsPDF text primitives (selectable).
- **B6** — `applyIsiCepat` override lampiran custom. Sekarang preserve custom items.
- **B7** — Promise bisa gantung selamanya. Semua `Image()` punya `onerror` + timeout.
- **B8** — CV dipaksa jadi 1 halaman panjang. Sekarang dipaginasi per A4.
- **B9** — `addImagePageToPdf` punya dead parameter. Signature dibersihkan.
- **B10** — PDF.js render scale hardcoded 1.5. Dipindah ke constant `A4.pdfLampiranScale = 2`.
- **B11** — Magic number A4 tersebar. Sekarang di `core/constants.js`.
- **B12** — Tidak ada storage versioning. Sekarang `STORAGE.version = 2`.
- **B13** — `lampIdSeq` counter bisa collision. Diganti `crypto.randomUUID()`.
- **B14** — Hidden date field hanya opacity. Sekarang `disabled` proper.
- **B15** — Tidak ada unsaved data warning. `beforeunload` + `visibilitychange` + `pagehide`.
- **C1** — ARIA labels untuk semua icon-only buttons.
- **C3** — `print-color-adjust: exact` agar background tercetak.
- **C4** — `@page { size: A4; margin: 0; }` ditambahkan.
- **C5** — Print page-break antar Surat dan CV.
- **C7** — Signature canvas support transparansi (PNG dengan alpha).
- **C8** — Signature auto-trim whitespace via bbox detection.
- **C9** — `devicePixelRatio` di-cap ke 2 untuk memory safety.
- **C11** — Signature canvas tidak kehilangan coretan saat resize.
- **C12** — Keyboard shortcut: Escape tutup modal, Ctrl+S save.
- **C15** — Export JSON / import belum diimplementasi (lihat LIMITATION di pdf-renderer.js).
- **C21** — Filename PDF sekarang ada timestamp (`Surat_Lamaran_Kerja_2026-09-07.pdf`).
- **C22** — Filename lampiran sekarang akurat (`+3lampiran` = 3 file uploaded).
- **C25** — PDF metadata: Title, Creator, Producer, CreationDate.
- **D5** — `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` env var dihapus dari workflow.
- **D6** — Code style konsisten via module boundary.
- **E8** — Date field di Isi Cepat sekarang `disabled` (bukan opacity saja).

### Security
- Sanitizer whitelist hanya `<strong>, <b>, <em>, <i>, <br>, <u>` tanpa atribut.
- File validation: size + MIME + extension fallback.
- Filename sanitization mencegah path traversal.
- `crypto.randomUUID()` untuk ID generation.
- Tidak ada `eval` / `Function()` di mana pun.

### Accessibility
- Semantic HTML: `<header>`, `<main>`, `<dialog>`, `<button>`.
- ARIA: `role`, `aria-modal`, `aria-label`, `aria-live`, `aria-hidden`, `aria-selected`.
- Focus trap pada modal aktif.
- Skip-link "Lewati ke konten utama".
- Visible focus state (`:focus-visible`).
- Kontras warna WCAG AA.
- Touch target minimum 44×44 px di semua interactive elements.

### Mobile
- Layout 320px ke atas dengan bottom-sheet modal.
- `touch-action: none` hanya pada canvas signature, bukan halaman.
- `pointer events` (bukan `touchstart`+`click`) untuk mencegah double-firing.
- `100dvh` untuk handle dynamic viewport (address bar mobile).
- `env(safe-area-inset-*)` untuk notch / home indicator.
- `prefers-reduced-motion` + `prefers-contrast: high` + `forced-colors: active` support.
- Tidak ada `user-scalable=no` — pinch zoom tetap diizinkan.

### Performance
- Lazy-load: jsPDF, html2canvas, PDF.js hanya dimuat saat dibutuhkan.
- Canvas cleanup setelah render (`.width = 0`) untuk release memory.
- PDF streaming render (1 halaman pada satu waktu, bukan semua sekaligus).
- Debounced auto-save (700ms) dan resize (150ms).
- `ResizeObserver` dengan debounce untuk auto-fit.

### Breaking Changes
- `backend.js` dihapus — diganti dengan struktur modular.
- `assets/ui.js` dihapus — di-merge ke `assets/js/app.js`.
- `assets/ui.css` dipecah menjadi 10 file CSS di `assets/css/`.
- Struktur localStorage berubah dari `ls_*` keys ke `lgen_state` single JSON + `lgen_meta` version.
- Binary data (foto, signature, lampiran) pindah dari localStorage ke IndexedDB.

## [1.0.0] — 2020-06-26

Versi awal — monolitik.
- `index.html` + `assets/backend.js` (1366 baris) + `assets/ui.js` + `assets/ui.css`.
- Auto-fit, auto-save, signature canvas, lampiran upload, PDF export.
- Deploy ke GitHub Pages via `.github/workflows/deploy-pages.yml`.
