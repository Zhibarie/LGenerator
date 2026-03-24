// UI bootstrap layer
// Memisahkan inisialisasi antarmuka dari logic backend.
document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.__LGenInit === 'function') {
    window.__LGenInit();
  }
});
