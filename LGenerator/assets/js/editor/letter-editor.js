// ─── LETTER EDITOR ──────────────────────────────────────────────────────────
// Owns the surat (letter) DOM: binds contenteditable fields, renders
// attachment list, routes user input through state + sanitizer.

import { AppState } from '../core/state.js';
import { EventBus, EVT } from '../core/events.js';
import { Storage } from '../core/storage.js';
import { Sanitizer } from './content-sanitizer.js';
import { uuid, debounce, escapeHtml, formatTanggalID } from '../core/utils.js';
import { DEFAULT_LETTER, DEFAULT_ATTACHMENTS } from '../core/constants.js';

const STORAGE_KEY = 'state'; // main state JSON

export const LetterEditor = {
  els: {},
  bound: false,

  init() {
    if (this.bound) return;
    this.bound = true;

    this.els = {
      frame:      document.getElementById('paperFrame'),
      content:    document.getElementById('letterContent'),
      autoDate:   document.getElementById('autoDate'),
      sigZone:    document.getElementById('signatureZone'),
      sigPreview: document.getElementById('sigPreview'),
      attachmentGrid: document.getElementById('attachmentGrid'),
    };

    // Bind every .editable[data-key] field
    document.querySelectorAll('.editable[data-key]').forEach(el => {
      const key = el.dataset.key;
      el.addEventListener('input', debounce(() => {
        // Use innerText for display content; sanitize for safe storage
        const raw = el.innerText;
        AppState.setLetterField(key, raw);
        AppState.setDirty(true);
        scheduleAutoSave();
      }, 250));
      // Paste handler — sanitize pasted HTML
      el.addEventListener('paste', e => this.handlePaste(e, el));
    });

    // Subscribe to state changes for re-render
    EventBus.on(EVT.SIG_CHANGED, dataUrl => this.renderSignature(dataUrl));
    EventBus.on(EVT.LETTER_ATTACHMENTS_CHANGED, items => this.renderAttachments(items));
  },

  /**
   * Load saved state into DOM. Called once after migration finishes.
   */
  hydrate(state) {
    if (!state?.letter) return;
    const { fields, attachments } = state.letter;

    // Render fields — sanitizer strips any persisted HTML we wouldn't allow
    document.querySelectorAll('.editable[data-key]').forEach(el => {
      const key = el.dataset.key;
      const val = fields[key];
      if (val == null) return;
      // Use textContent by default; for keys known to contain formatting, sanitize.
      if (key === 'paragraf_niat') {
        el.innerHTML = Sanitizer.sanitizeWithFormatting(val);
      } else {
        el.textContent = val;
      }
    });

    // Auto-date
    if (this.els.autoDate) {
      this.els.autoDate.textContent = formatTanggalID(new Date());
    }

    // Render attachments
    this.renderAttachments(attachments);
  },

  handlePaste(e, el) {
    e.preventDefault();
    const items = e.clipboardData?.items || [];
    let text = '';
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'string' && items[i].type === 'text/plain') {
        text = items[i].getAsString?.(text => {
          // Insert as plain text — browser handles cursor position
          document.execCommand('insertText', false, text);
        });
        return;
      }
    }
    // Fallback — get HTML and sanitize
    let html = '';
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'string' && items[i].type === 'text/html') {
        items[i].getAsString(s => {
          const safe = Sanitizer.sanitizeWithFormatting(s);
          document.execCommand('insertHTML', false, safe);
        });
        return;
      }
    }
  },

  // ── Attachment list ────────────────────────────────────────────────────
  renderAttachments(items) {
    if (!this.els.attachmentGrid) return;
    this.els.attachmentGrid.innerHTML = '';

    if (!items || items.length === 0) {
      items = DEFAULT_ATTACHMENTS.map(text => ({ id: uuid(), text, attachmentId: null }));
    }

    items.forEach(item => {
      const li = document.createElement('li');
      li.dataset.lid = item.id;
      li.className = 'lamp-item';

      // Number span
      const num = document.createElement('span');
      num.className = 'lamp-num';

      // Editable text — sanitize on input
      const text = document.createElement('span');
      text.className = 'lamp-editable editable';
      text.setAttribute('contenteditable', 'true');
      text.setAttribute('role', 'textbox');
      text.setAttribute('aria-label', 'Nama lampiran, dapat diedit');
      text.textContent = item.text || '';
      text.addEventListener('input', debounce(() => {
        item.text = text.textContent;
        AppState.setLetterAttachments(AppState.get().letter.attachments.slice());
        scheduleAutoSave();
      }, 300));

      // Upload button — aria-label, accessible
      const upload = document.createElement('button');
      upload.type = 'button';
      upload.className = 'btn-lamp-upload';
      upload.setAttribute('aria-label', 'Upload dokumen lampiran');
      upload.title = 'Upload dokumen';
      upload.innerHTML = '<i class="fas fa-cloud-upload-alt" aria-hidden="true"></i>';
      upload.addEventListener('click', () => {
        EventBus.emit('attachment:open-modal', { lampId: item.id, triggerBtn: upload });
      });

      // Remove button
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn-remove';
      remove.setAttribute('aria-label', 'Hapus lampiran ini');
      remove.title = 'Hapus';
      remove.innerHTML = '<i class="fas fa-times-circle" aria-hidden="true"></i>';
      remove.addEventListener('click', () => {
        if (item.attachmentId) {
          // Detach from binary store but keep the text row
          EventBus.emit('attachment:detach', { lampId: item.id });
        } else {
          // Just remove the row
          const next = AppState.get().letter.attachments.filter(a => a.id !== item.id);
          AppState.setLetterAttachments(next);
        }
      });

      li.appendChild(num);
      li.appendChild(text);
      li.appendChild(upload);
      li.appendChild(remove);
      this.els.attachmentGrid.appendChild(li);
    });

    this.renumberAttachments();
  },

  renumberAttachments() {
    const items = this.els.attachmentGrid.querySelectorAll('li');
    items.forEach((li, i) => {
      const num = li.querySelector('.lamp-num');
      if (num) num.textContent = (i + 1) + '.';
    });
  },

  addAttachment(text = 'Dokumen baru.') {
    const next = AppState.get().letter.attachments.slice();
    next.push({ id: uuid(), text, attachmentId: null });
    AppState.setLetterAttachments(next);
  },

  // ── Signature ──────────────────────────────────────────────────────────
  renderSignature(dataUrl) {
    if (!this.els.sigPreview) return;
    if (dataUrl) {
      this.els.sigPreview.src = dataUrl;
      this.els.sigPreview.style.display = 'block';
      this.els.sigZone?.classList.add('has-sig');
    } else {
      this.els.sigPreview.src = '';
      this.els.sigPreview.style.display = '';
      this.els.sigZone?.classList.remove('has-sig');
    }
  },

  // ── Reset ───────────────────────────────────────────────────────────────
  reset() {
    AppState.resetLetter();
    this.hydrate(AppState.snapshot());
    this.renderSignature(null);
  },

  /** Called by responsive / orientation change */
  reflow() {
    if (this.els.attachmentGrid) this.renumberAttachments();
  },
};

// ── Auto-save: debounced, safe against quota errors ────────────────────────
let saveTimer = null;
function scheduleAutoSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const r = Storage.setJSON(STORAGE_KEY, AppState.snapshot());
    if (r.ok) {
      AppState.markSaved();
      EventBus.emit(EVT.NOTIFY, { type: 'saved', msg: 'Tersimpan' });
    } else {
      EventBus.emit(EVT.STATE_SAVE_FAILED, r);
      EventBus.emit(EVT.NOTIFY, {
        type: 'error',
        msg: r.reason === 'quota'
          ? 'Penyimpanan penuh. Hapus lampiran lama atau gunakan file lebih kecil.'
          : 'Gagal menyimpan. Perubahan tetap ada di memori.',
        sticky: true,
      });
    }
  }, 700);
}

// Hook STATE_CHANGED into auto-save
EventBus.on(EVT.STATE_DIRTY, () => scheduleAutoSave());
EventBus.on(EVT.STATE_CHANGED, ({ scope }) => {
  if (scope && scope !== 'ui.tab' && scope !== 'ui.modal' && scope !== 'ui.mobile' && scope !== 'ui.orientation') {
    scheduleAutoSave();
  }
});

// Save on tab hide / visibility change (mobile browsers may not fire beforeunload reliably)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && AppState.get().ui.isDirty) {
    const r = Storage.setJSON(STORAGE_KEY, AppState.snapshot());
    if (r.ok) AppState.markSaved();
  }
});
window.addEventListener('pagehide', () => {
  if (AppState.get().ui.isDirty) {
    Storage.setJSON(STORAGE_KEY, AppState.snapshot());
  }
});

// Warn on unload if dirty (desktop only — mobile ignores this)
window.addEventListener('beforeunload', e => {
  if (AppState.get().ui.isDirty) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});
