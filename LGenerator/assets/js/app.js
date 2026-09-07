// ─── APP ENTRYPOINT ─────────────────────────────────────────────────────────
// Wires up all modules in dependency order. Single bootstrap function.
// Loaded as ES module from index.html.

import { AppState } from './core/state.js';
import { EventBus, EVT } from './core/events.js';
import { Storage } from './core/storage.js';
import { Migration } from './core/migration.js';
import { A4, BREAKPOINTS } from './core/constants.js';
import { debounce, formatTanggalID, isMobileViewport } from './core/utils.js';

import { LetterEditor } from './editor/letter-editor.js';
import { AutoFit } from './editor/auto-fit.js';

import { AttachmentManager } from './attachments/attachment-manager.js';
import { AttachmentPreview } from './attachments/attachment-preview.js';

import { Signature } from './signature/signature.js';

import { CvEditor } from './cv/cv-editor.js';
import { CvPhoto } from './cv/cv-photo.js';

import { PdfExporter } from './export/pdf-exporter.js';

import { Modal } from './ui/modal.js';
import { Notifications } from './ui/notifications.js';
import { Loading } from './ui/loading.js';
import { Responsive } from './ui/responsive.js';

import { QuickFill } from './quick-fill/quick-fill.js';

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function boot() {
  console.log('[LGenerator] booting...');

  // 1. Initialize UI infrastructure (no DOM dependency yet)
  Responsive.init();
  Modal.init();
  Notifications.init();
  Loading.init();

  // 2. Run migration (may take ~100ms for legacy data conversion)
  const mig = await Migration.run();
  console.log('[LGenerator] migration:', mig);

  // 3. Hydrate AppState from persisted state
  const persisted = Storage.getJSON('state');
  if (persisted) {
    AppState.hydrate(persisted);
  } else {
    // First-time use — populate defaults
    AppState.resetLetter();
    AppState.resetCv();
  }

  // 4. Initialize feature modules (now DOM is ready, state is loaded)
  LetterEditor.init();
  AutoFit.init();
  AttachmentManager.init();
  Signature.init();
  CvEditor.init();

  // 5. Hydrate DOM from AppState
  LetterEditor.hydrate(AppState.snapshot());
  CvEditor.hydrate(AppState.snapshot());

  // Load persisted signature (it's a Blob in IDB)
  await Signature.loadPersisted();
  await CvPhoto.render();

  // 6. Quick-fill module
  QuickFill.init();

  // 7. Bind global UI controls
  bindToolbarControls();
  bindTabSwitcher();
  bindPdfMenu();
  bindSignatureControls();
  bindLampiranModalControls();
  bindQuickFillControls();
  bindResetButton();
  bindKeyboardShortcuts();

  // 8. Trigger initial layout
  AutoFit.fit();
  schedulePaperScale();
  window.addEventListener('resize', debounce(schedulePaperScale, 150));
  window.addEventListener('orientationchange', () => setTimeout(schedulePaperScale, 300));

  // 9. Listen for state changes to re-fit + auto-save
  EventBus.on(EVT.STATE_CHANGED, () => {
    AutoFit.schedule();
  });

  console.log('[LGenerator] ready.');
  EventBus.emit(EVT.NOTIFY, { type: 'info', msg: 'Aplikasi siap digunakan.' });
}

// ── Toolbar controls ─────────────────────────────────────────────────────────
function bindToolbarControls() {
  const btnIsiCepat = document.getElementById('btn-isi-cepat');
  if (btnIsiCepat) btnIsiCepat.addEventListener('click', () => QuickFill.open());

  const btnAddLamp = document.getElementById('btn-add-lamp');
  if (btnAddLamp) btnAddLamp.addEventListener('click', () => LetterEditor.addAttachment());
}

// ── Tab switcher (Surat / CV) ─────────────────────────────────────────────────
function bindTabSwitcher() {
  const tabSurat = document.getElementById('tab-surat');
  const tabCv = document.getElementById('tab-cv');
  const suratContainer = document.getElementById('editor-container-surat');
  const cvContainer = document.getElementById('cv-container');
  const fitStatus = document.getElementById('fit-status');
  const cvFitStatus = document.getElementById('cv-fit-status');

  function switchTab(tab) {
    AppState.setTab(tab);
    const isSurat = tab === 'surat';
    suratContainer.style.display = isSurat ? 'flex' : 'none';
    cvContainer.style.display = isSurat ? 'none' : 'flex';
    fitStatus.style.display = isSurat ? 'flex' : 'none';
    cvFitStatus.style.display = isSurat ? 'none' : 'flex';

    tabSurat.classList.toggle('active', isSurat);
    tabSurat.classList.toggle('surat', isSurat);
    tabSurat.setAttribute('aria-selected', isSurat ? 'true' : 'false');
    tabCv.classList.toggle('active', !isSurat);
    tabCv.classList.toggle('cv', !isSurat);
    tabCv.setAttribute('aria-selected', !isSurat ? 'true' : 'false');

    setTimeout(() => {
      if (isSurat) AutoFit.fit();
      else import('./cv/cv-auto-fit.js').then(m => m.CvAutoFit.fit());
      schedulePaperScale();
    }, 100);
  }

  tabSurat?.addEventListener('click', () => switchTab('surat'));
  tabCv?.addEventListener('click', () => switchTab('cv'));
}

// ── PDF dropdown menu ────────────────────────────────────────────────────────
function bindPdfMenu() {
  const btn = document.getElementById('btn-pdf-menu');
  const menu = document.getElementById('pdfMenuDrop');
  if (!btn || !menu) return;

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#btn-pdf-menu') && !e.target.closest('#pdfMenuDrop')) {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  document.getElementById('btn-export-surat')?.addEventListener('click', () => {
    menu.classList.remove('open');
    PdfExporter.exportLetter();
  });
  document.getElementById('btn-export-cv')?.addEventListener('click', () => {
    menu.classList.remove('open');
    PdfExporter.exportCV();
  });
  document.getElementById('btn-export-all')?.addEventListener('click', () => {
    menu.classList.remove('open');
    PdfExporter.exportUnified();
  });
  document.getElementById('btn-print')?.addEventListener('click', () => {
    menu.classList.remove('open');
    window.print();
  });
}

// ── Signature modal control buttons ──────────────────────────────────────────
function bindSignatureControls() {
  document.getElementById('sig-apply-btn')?.addEventListener('click', () => Signature.apply());
  document.getElementById('sig-clear-btn')?.addEventListener('click', () => Signature.clearCanvas());
  document.getElementById('sig-clear-final')?.addEventListener('click', e => {
    e.stopPropagation();
    Signature.clearSignature();
  });
}

// ── Lampiran modal control buttons ───────────────────────────────────────────
function bindLampiranModalControls() {
  document.getElementById('lamp-btn-apply')?.addEventListener('click', async () => {
    try {
      await AttachmentPreview.apply();
    } catch (e) {
      console.error(e);
      EventBus.emit(EVT.NOTIFY, { type: 'error', msg: 'Gagal memproses gambar.' });
    }
  });
  document.getElementById('lamp-btn-remove')?.addEventListener('click', () => AttachmentPreview.remove());
}

// ── Quick-fill modal control buttons ─────────────────────────────────────────
function bindQuickFillControls() {
  document.getElementById('ic-apply-btn')?.addEventListener('click', () => QuickFill.apply());
}

// ── Reset button (with confirmation) ─────────────────────────────────────────
function bindResetButton() {
  document.getElementById('btn-reset')?.addEventListener('click', async () => {
    const ok = await confirmReset();
    if (!ok) return;

    // Reset all
    await AttachmentManager.wipeAll();
    AppState.resetAll();
    await Storage.wipeAll();

    LetterEditor.hydrate(AppState.snapshot());
    CvEditor.hydrate(AppState.snapshot());
    await CvPhoto.render();
    LetterEditor.renderSignature(null);
    AutoFit.fit();
    EventBus.emit(EVT.NOTIFY, { type: 'info', msg: 'Semua data direset.' });
  });
}

function confirmReset() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.style.cssText = `
      display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.7);
      z-index:8000; align-items:center; justify-content:center; padding:16px;`;
    overlay.innerHTML = `
      <div role="alertdialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-desc"
           style="background:#1e1e1e; color:white; border-radius:14px; padding:22px;
                  width:min(420px, 95vw); box-shadow:0 20px 60px rgba(0,0,0,0.7);">
        <h5 id="reset-title" style="font-family:sans-serif; font-weight:700; font-size:1rem; margin:0 0 8px;">
          <i class="fas fa-exclamation-triangle me-2" style="color:#facc15" aria-hidden="true"></i>
          Reset Semua Data?
        </h5>
        <p id="reset-desc" style="font-size:13px; color:#aaa; font-family:sans-serif; margin:0 0 18px;">
          Semua data surat, CV, foto, tanda tangan, dan lampiran akan dihapus. Tindakan ini tidak dapat dibatalkan.
        </p>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" data-action="cancel" style="flex:1; min-height:44px; padding:10px; background:#2a2a2a; color:#ccc; border:1px solid #444; border-radius:8px; cursor:pointer; font-family:sans-serif; font-weight:600;">
            Batal
          </button>
          <button type="button" data-action="ok" style="flex:1; min-height:44px; padding:10px; background:#c0392b; color:white; border:none; border-radius:8px; cursor:pointer; font-family:sans-serif; font-weight:600;">
            Reset Semua
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const cleanup = (result) => { overlay.remove(); resolve(result); };
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => cleanup(false));
    overlay.querySelector('[data-action="ok"]').addEventListener('click', () => cleanup(true));
    setTimeout(() => overlay.querySelector('[data-action="cancel"]').focus(), 50);
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
    });
  });
}

// ── Keyboard shortcuts ───────────────────────────────────────────────────────
function bindKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    // Ctrl+S → manual save (no default browser save dialog)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      const r = Storage.setJSON('state', AppState.snapshot());
      if (r.ok) {
        AppState.markSaved();
        EventBus.emit(EVT.NOTIFY, { type: 'success', msg: 'Tersimpan manual.' });
      } else {
        EventBus.emit(EVT.NOTIFY, { type: 'error', msg: 'Gagal menyimpan: ' + r.reason, sticky: true });
      }
    }
    // Ctrl+P → use our PDF menu (but allow default print too)
    // We don't intercept Ctrl+P — let user choose print or PDF menu.
  });
}

// ── Paper scaling for mobile (kept simple — no transform move) ───────────────
function schedulePaperScale() {
  const A4_W = A4.widthPx;
  const avail = window.innerWidth - 16;
  const scale = Math.min(1, avail / A4_W);

  document.querySelectorAll('.editor-container').forEach(el => {
    el.style.justifyContent = 'flex-start';
    el.style.alignItems = 'flex-start';
    el.style.overflow = 'hidden';
  });

  ['suratWrapper', 'cvWrapper'].forEach(id => {
    const wrapper = document.getElementById(id);
    if (!wrapper) return;
    const paper = wrapper.querySelector('.paper-a4');
    if (!paper) return;

    wrapper.style.transform = `scale(${scale})`;
    wrapper.style.transformOrigin = 'top left';
    wrapper.style.width = A4_W + 'px';

    requestAnimationFrame(() => {
      const naturalH = paper.scrollHeight || paper.offsetHeight;
      wrapper.style.height = naturalH + 'px';
      const container = wrapper.parentElement;
      if (container) {
        container.style.height = Math.ceil(naturalH * scale + 16) + 'px';
        container.style.minHeight = 'unset';
      }
    });
  });
}

// ── Start when DOM ready ─────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
