# LGenerator

Generator surat lamaran kerja + CV berbasis **HTML/CSS/JavaScript murni**. 100% client-side, tanpa backend, dapat di-deploy ke GitHub Pages.

## Apa itu LGenerator?

LGenerator adalah aplikasi web statis untuk membuat surat lamaran kerja dan CV dalam format PDF. Semua pemrosesan terjadi di browser pengguna — tidak ada data yang dikirim ke server. Cocok untuk pengguna Indonesia yang ingin membuat dokumen lamaran kerja dengan cepat, rapi, dan dapat diandalkan pada perangkat mobile maupun desktop.

## Fitur Utama

- **Editor Surat Lamaran**: Field editable langsung di kertas A4 dengan auto-fit font otomatis.
- **Editor CV**: Layout 2-kolom (sidebar gelap + konten putih), foto, pendidikan, pengalaman.
- **Auto-fit**: Algoritma binary search mencari ukuran font terbesar yang muat di A4.
- **Auto-save**: Otomatis menyimpan ke localStorage + IndexedDB setiap perubahan.
- **Isi Cepat**: Form tunggal untuk mengisi semua field surat + CV sekaligus.
- **Lampiran**: Upload PDF/JPG/PNG/WEBP, preview, rotasi, persist setelah refresh (IndexedDB).
- **Tanda Tangan**: Gambar di canvas (pointer events, mendukung stylus) atau upload gambar.
- **Export PDF**: Tiga mode — Surat saja, CV saja, atau Lengkap (Surat + CV + Lampiran).
- **Multi-page CV**: CV dipotong otomatis menjadi beberapa halaman A4 jika konten panjang.
- **Mobile Penuh**: Bekerja pada layar 320px ke atas, mendukung portrait + landscape, safe-area.
- **Accessibility**: Focus trap, Escape to close, ARIA labels, kontras WCAG AA.
- **Print A4**: `@page A4 margin: 0`, backgrounds printed, page-break antar dokumen.

## Struktur Folder

```
LGenerator/
├── index.html                  # Markup UI + paper A4 + CV + 3 modal
│
├── assets/
│   ├── css/
│   │   ├── base.css            # CSS reset, :root vars, safe-area-inset
│   │   ├── layout.css          # App shell, toolbar, paper wrapper
│   │   ├── components.css      # Buttons, tabs, toasts, loading overlay
│   │   ├── editor.css          # Surat paper, contenteditable, signature zone
│   │   ├── modal.css           # Modal box, inputs, quick-fill grid
│   │   ├── cv.css              # CV 2-column layout, photo, education
│   │   ├── attachments.css     # Lampiran list + modal + preview
│   │   ├── print.css           # @page A4, hide UI on print
│   │   ├── responsive.css      # Tablet + desktop breakpoints
│   │   └── mobile.css          # Mobile 320–767px + touch device tweaks
│   │
│   └── js/
│       ├── app.js              # Entrypoint (DOMContentLoaded → boot())
│       │
│       ├── core/
│       │   ├── constants.js    # A4, fonts, limits, breakpoints, defaults
│       │   ├── state.js        # AppState (centralized) + mutations
│       │   ├── storage.js      # localStorage + IndexedDB wrapper, validation
│       │   ├── migration.js    # v1 → v2 schema migration (idempotent)
│       │   ├── events.js       # EventBus pub/sub + EVT constants
│       │   └── utils.js        # Pure utilities (escape, uuid, debounce, etc.)
│       │
│       ├── editor/
│       │   ├── letter-editor.js    # Bind contenteditable, render attachments
│       │   ├── auto-fit.js          # Binary search font size (Math.floor fix)
│       │   └── content-sanitizer.js # XSS whitelist sanitizer
│       │
│       ├── quick-fill/
│       │   └── quick-fill.js        # Isi Cepat modal logic (no attachment wipe)
│       │
│       ├── signature/
│       │   ├── signature.js         # Signature controller (modal, tabs, apply)
│       │   ├── signature-canvas.js  # High-DPI canvas with pointer events
│       │   └── signature-image.js   # Uploaded sig with whitespace trim
│       │
│       ├── attachments/
│       │   ├── attachment-manager.js   # Orchestrator + EventBus wiring
│       │   ├── attachment-storage.js   # IndexedDB persistence + PDF.js loader
│       │   ├── attachment-preview.js   # Modal preview (loading/success/error)
│       │   ├── attachment-image.js     # Image rotation + aspect-ratio-safe A4 fit
│       │   └── attachment-pdf.js      # PDF streaming renderer (page-by-page)
│       │
│       ├── cv/
│       │   ├── cv-editor.js       # CV sections + add/remove rows
│       │   ├── cv-storage.js      # Photo persistence in IDB
│       │   ├── cv-photo.js        # Photo upload + preview + object URL cleanup
│       │   └── cv-auto-fit.js     # CV-specific binary search (px units)
│       │
│       ├── export/
│       │   ├── pdf-exporter.js     # Main export controller (letter/cv/unified)
│       │   ├── pdf-renderer.js    # html2canvas + jsPDF lazy loaders
│       │   ├── pdf-pagination.js  # CV multi-page splitting with break-inside:avoid
│       │   ├── pdf-images.js      # Image attachment → A4 page (contain fit)
│       │   └── pdf-metadata.js    # PDF properties + filename builder
│       │
│       └── ui/
│           ├── modal.js          # Focus trap, Escape, ARIA, bottom-sheet on mobile
│           ├── notifications.js  # Toast system (success/error/info/saved)
│           ├── loading.js        # Export progress overlay + cancel button
│           └── responsive.js      # Viewport tracking + safe-area injection
│
├── tests/
│   ├── runner.html              # Browser-based test runner UI
│   ├── storage.test.js          # localStorage + IndexedDB + validation
│   ├── sanitizer.test.js        # XSS payloads + whitelist
│   ├── attachment.test.js       # Upload + rotate + aspect ratio
│   ├── auto-fit.test.js         # Binary search invariants
│   └── pdf.test.js              # Filename + metadata + A4 aspect ratio
│
├── .github/workflows/
│   ├── quality-check.yml        # PR + push: syntax + import + a11y checks
│   └── deploy-pages.yml         # main: deploy to GitHub Pages
│
├── README.md
├── CHANGELOG.md
├── LICENSE
└── .gitignore
```

## Cara Menjalankan

### Opsi 1: Buka langsung di browser

1. Download / clone repository ini.
2. Buka `index.html` di browser modern (Chrome, Firefox, Safari, Edge).
3. Selesai.

> **Catatan**: Beberapa fitur (IndexedDB untuk lampiran) memerlukan konteks `http://` atau `https://`. Untuk pengujian penuh, gunakan Opsi 2 atau deploy ke GitHub Pages.

### Opsi 2: Local server (rekomendasi untuk pengembangan)

```bash
# Python 3
python3 -m http.server 8000

# Atau Node.js
npx serve .
```

Buka `http://localhost:8000` di browser.

## Cara Deploy ke GitHub Pages

1. Push repository ke GitHub (branch `main`).
2. Buka **Settings → Pages**.
3. Pada **Source**, pilih **GitHub Actions**.
4. Workflow `.github/workflows/deploy-pages.yml` akan otomatis berjalan pada setiap push ke `main`.
5. Setelah selesai, URL GitHub Pages akan muncul di tab **Actions**.

URL hasil: `https://<username>.github.io/LGenerator/`

## Cara Menambah Fitur

### Tambah field baru di surat

1. Tambahkan elemen `<span class="editable" contenteditable="true" data-key="nama_field">` di `index.html`.
2. Tambahkan default value di `assets/js/core/constants.js` → `DEFAULT_LETTER`.
3. Field otomatis disimpan + di-load oleh `letter-editor.js`.

### Tambah section di CV

1. Tambahkan struktur HTML di `index.html` dalam `#cv-right`.
2. Tambahkan state field di `assets/js/core/state.js` → `cv.profile`.
3. Bind di `assets/js/cv/cv-editor.js` → `hydrate()`.

### Ubah UI styling

- Perubahan warna / spacing: edit `assets/css/base.css` (CSS variables).
- Perubahan layout paper: edit `assets/css/editor.css` atau `assets/css/cv.css`.
- Perubahan modal: edit `assets/css/modal.css`.

### Ubah PDF exporter

- Logika export utama: `assets/js/export/pdf-exporter.js`.
- Paginasi CV: `assets/js/export/pdf-pagination.js`.
- Penempatan gambar lampiran: `assets/js/export/pdf-images.js`.

### Cara kerja storage

```
User Action
    ↓
Feature Module (e.g., LetterEditor)
    ↓
AppState mutation (state.js)
    ↓
EventBus emit (events.js)
    ↓
Auto-save (debounced 700ms)
    ↓
Storage.setJSON()  → localStorage  (text snapshot)
Storage.putBlob()  → IndexedDB     (binary: photo, sig, attachments)
```

Versi schema disimpan di `localStorage.lgen_meta.version`. Jika struktur berubah, bump `STORAGE.version` di `constants.js` dan tambahkan case di `migration.js`.

### Cara debugging

1. Buka DevTools (F12).
2. Lihat **Console** untuk log aplikasi (`[LGenerator] ...`).
3. Lihat **Application → IndexedDB → lgenerator-db** untuk inspect attachment blobs.
4. Lihat **Application → Local Storage** untuk inspect state snapshot.
5. Jalankan tests di `tests/runner.html` untuk verifikasi regression.

## Browser Compatibility

| Browser | Minimum | Catatan |
|---------|---------|---------|
| Chrome | 90+ | Full support |
| Firefox | 88+ | Full support |
| Safari (desktop) | 14+ | Full support |
| Safari (iOS) | 14+ | IndexedDB di Private Mode mungkin terbatas |
| Edge | 90+ | Full support |
| Samsung Internet | 14+ | Full support |
| Opera Mini | ❌ | Tidak didukung (tidak mendukung ES Modules) |

## Known Limitations

1. **PDF teks tidak sepenuhnya selectable**: Surat lamaran menggunakan jsPDF text primitives (selectable), namun CV dirender sebagai canvas (raster) karena kompleksitas layout 2-kolom. Lihat `pdf-renderer.js` LIMITATION note.
2. **PDF.js lazy-load**: Saat pertama upload PDF lampiran, ada delay ~500ms untuk memuat PDF.js dari CDN.
3. **html2canvas lazy-load**: Saat pertama export PDF, ada delay ~300ms untuk memuat html2canvas.
4. **localStorage quota**: 5–10 MB per origin. State JSON + signature data URL bisa penuh — gunakan IndexedDB untuk binary (sudah diimplementasi).
5. **Migrasi tidak menghapus data lama**: `ls_*` keys dari `backend.js` lama tetap ada sampai user menjalankan `Migration.cleanLegacy()` manual. Ini untuk safety.
6. **Mobile memory**: Export PDF dengan banyak lampiran PDF besar (>50 halaman total) bisa lambat di HP low-end. Lihat `pdfToImages` di `attachment-pdf.js` — streaming render dengan cleanup canvas setiap halaman.

## Dukungan Mobile

### Ukuran layar yang didukung

- **320px** (iPhone SE 1st gen): Full support, 1-kolom, modal bottom-sheet.
- **375px** (iPhone standar): Full support.
- **414px** (iPhone Plus): Full support.
- **768px** (iPad portrait): 2-kolom dimungkinkan.
- **1024px+** (iPad landscape / desktop): Layout desktop.

### Cara menguji pada 320px

1. Buka aplikasi di Chrome desktop.
2. Buka DevTools → Toggle device toolbar (Ctrl+Shift+M).
3. Pilih **Responsive** → set width ke **320px**.
4. Verifikasi: tidak ada scroll horizontal, semua tombol ≥44px, modal jadi bottom-sheet.

### Cara menguji orientasi landscape

1. Di DevTools device toolbar, klik icon rotate.
2. Atau: buka di HP fisik, putar ke landscape.
3. Verifikasi: toolbar tidak overlap, modal bisa discroll, kertas A4 tetap terlihat.

### Cara menguji keyboard virtual

1. Buka di HP / emulator.
2. Klik input (mis. "Nama Lengkap" di Isi Cepat).
3. Verifikasi: keyboard muncul, modal dapat di-scroll, field aktif terlihat.

### Cara menguji upload dari kamera

1. Buka di HP.
2. Klik tombol upload lampiran / foto CV.
3. Pilih "Kamera" atau "Take Photo" (iOS) / "Camera" (Android).
4. Verifikasi: foto tersimpan, persist setelah refresh.

### Cara menguji IndexedDB setelah refresh

1. Upload lampiran PDF (mis. KTP.pdf).
2. Tutup tab, buka ulang.
3. Verifikasi: lampiran masih ada di surat, dapat di-preview, dapat di-export.

### Cara menguji export PDF pada mobile

1. Buat surat + CV + upload 1-2 lampiran.
2. Klik **PDF → PDF Lengkap**.
3. Verifikasi: progress bar muncul, dapat dibatalkan, file ter-download.
4. Buka PDF di app Files / Google Drive — verifikasi tidak ada distorsi gambar.

### Cara menguji memory usage

1. Buka DevTools → Performance → Memory.
2. Upload 5 PDF lampiran @5MB.
3. Export PDF Lengkap.
4. Verifikasi: memory tidak meledak, browser tidak crash.

### Cara menguji screen reader dan keyboard

1. Aktifkan NVDA / VoiceOver.
2. Navigasi dengan Tab / Shift+Tab.
3. Verifikasi: setiap tombol memiliki label yang jelas, modal dapat ditutup dengan Escape, focus trap bekerja.

### Cara menguji safe-area pada perangkat dengan notch

1. Buka di iPhone dengan notch (X atau lebih baru).
2. Verifikasi: toolbar tidak tertutup notch, modal tidak tertutup home indicator.
3. CSS var `--safe-top` dan `--safe-bottom` di-respect.

## Batas Ukuran File

- **Lampiran**: maks 15 MB per file, maks 20 lampiran.
- **Foto CV**: maks 5 MB.
- **Tanda tangan**: maks 3 MB.
- **PDF halaman**: warning di 30 halaman, hard limit di 100 halaman.

## Cara Menangani Storage Error

Jika muncul toast "Penyimpanan penuh":
1. Hapus lampiran lama yang tidak diperlukan.
2. Kurangi ukuran file (kompres gambar, optimasi PDF).
3. Refresh halaman — data terakhir yang tersimpan akan dimuat.
4. Jika perlu, klik **Reset** → **Reset Semua** untuk wipe total.

## Cara Menangani Export Error

Jika muncul toast "Gagal membuat PDF":
1. Tutup tab lain yang berat.
2. Refresh halaman, coba export lagi.
3. Jika lampiran terlalu besar, kurangi dulu.
4. Lihat Console (F12) untuk detail error.
5. Sebagai fallback, gunakan **Cetak** (window.print) — print ke PDF via dialog browser.

## License

MIT License — bebas digunakan, dimodifikasi, distribusi. Lihat `LICENSE`.

## Contributing

Pull request diterima. Pastikan:
1. `node --check` lulus untuk semua file JS.
2. Semua import ES module resolve.
3. `tests/runner.html` lulus semua test.
4. Tidak ada fixed-width modal yang menyebabkan horizontal overflow di 320px.
