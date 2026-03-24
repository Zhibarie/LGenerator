# LGenerator

Template generator surat lamaran + CV berbasis HTML/CSS/JavaScript murni.

## Jalan di GitHub Pages
Bisa. Project ini **100% static** (tanpa server backend), jadi cocok untuk GitHub Pages.

### Langkah deploy
1. Push branch ke GitHub repo.
2. Buka **Settings → Pages**.
3. Pada **Build and deployment**, pilih:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` (atau branch yang dipakai), folder `/ (root)`
4. Simpan, lalu tunggu URL GitHub Pages dibuat.

## Struktur
- `index.html` → markup UI utama
- `assets/ui.css` → styling UI
- `assets/ui.js` → bootstrap UI saat DOM siap
- `assets/backend.js` → business logic aplikasi (autosave, export PDF, lampiran, CV autofit, dll.)

## Catatan
- Semua path aset menggunakan path relatif, jadi tetap aman saat di-host dari subpath GitHub Pages (`https://<user>.github.io/<repo>/`).

## Auto Deploy (GitHub Actions)
Workflow auto deploy sudah disiapkan di `.github/workflows/deploy-pages.yml`.

Trigger:
- push ke branch `main`
- manual dari tab **Actions** (`workflow_dispatch`)

Agar aktif:
1. Pastikan repo punya branch `main`.
2. Buka **Settings → Pages**.
3. Pada **Source**, pilih **GitHub Actions**.

Setelah itu setiap push ke `main` akan otomatis deploy ke GitHub Pages.
