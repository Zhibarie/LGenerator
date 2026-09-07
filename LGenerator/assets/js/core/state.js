// ─── CENTRALIZED APPLICATION STATE ────────────────────────────────────────────
// One source of truth. Modules subscribe via EventBus and mutate via methods.
// NEVER edit appState directly from feature modules — go through AppState.* APIs.

import { EventBus, EVT } from './events.js';
import { STORAGE, DEFAULT_LETTER, DEFAULT_ATTACHMENTS } from './constants.js';
import { uuid } from './utils.js';

function createInitialState() {
  return {
    version: STORAGE.version,

    letter: {
      fields: { ...DEFAULT_LETTER },
      formatting: { fontSizePt: 12 },
      attachments: [], // [{id, text, attachmentId|null}] — attachmentId points to attachments[].id
    },

    cv: {
      profile: {
        nama: '', posisi: '', telepon: '', email: '', alamat: '',
        ttl: '', jk: 'Laki-laki', agama: 'Islam', status: 'Belum Kawin',
        tentang: '',
      },
      photo: null,           // blob key in IDB or null
      education: [],         // [{id, sekolah, jurusan, tahun}]
      experience: [],        // [{id, posisi, perusahaan, periode, desc}]
    },

    attachments: [],         // [{id, name, type, size, rotation, pages}]
                             // Binary data lives in IndexedDB keyed by id.

    signature: null,         // data URL or null (drawn / uploaded)

    ui: {
      isDirty: false,
      isMobile: false,
      orientation: 'portrait',
      activeTab: 'surat',     // 'surat' | 'cv'
      activeModal: null,
      isExporting: false,
    },
  };
}

const state = createInitialState();
const subscribers = new Set();

function notify(scope) {
  subscribers.forEach(fn => {
    try { fn(state, scope); }
    catch (e) { console.error('[AppState] subscriber error:', e); }
  });
  EventBus.emit(EVT.STATE_CHANGED, { scope, state });
}

export const AppState = {
  /** Read-only snapshot of current state */
  get() {
    // Shallow clone top-level to discourage mutation; nested refs are live.
    return state;
  },

  /** Deep snapshot for serialization (save). */
  snapshot() {
    return JSON.parse(JSON.stringify(state));
  },

  subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },

  // ── LETTER ───────────────────────────────────────────────────────────────
  setLetterField(key, value) {
    state.letter.fields[key] = value;
    state.ui.isDirty = true;
    notify('letter.field');
  },

  setLetterFields(fields) {
    state.letter.fields = { ...state.letter.fields, ...fields };
    state.ui.isDirty = true;
    notify('letter.field');
  },

  setLetterFontSize(pt) {
    state.letter.formatting.fontSizePt = pt;
    notify('letter.format');
  },

  setLetterAttachments(items) {
    // items: [{id, text, attachmentId|null}]
    state.letter.attachments = items;
    state.ui.isDirty = true;
    notify('letter.attachments');
    EventBus.emit(EVT.LETTER_ATTACHMENTS_CHANGED, items);
  },

  // ── CV ──────────────────────────────────────────────────────────────────
  setCvField(key, value) {
    state.cv.profile[key] = value;
    state.ui.isDirty = true;
    notify('cv');
    EventBus.emit(EVT.CV_CHANGED, state.cv);
  },

  setCvPhoto(photoKey) {
    state.cv.photo = photoKey;
    state.ui.isDirty = true;
    notify('cv.photo');
    EventBus.emit(EVT.CV_PHOTO_CHANGED, photoKey);
  },

  setCvEducation(list) {
    state.cv.education = list;
    state.ui.isDirty = true;
    notify('cv.education');
    EventBus.emit(EVT.CV_CHANGED, state.cv);
  },

  addCvEducation(item = {}) {
    state.cv.education.push({
      id: uuid(),
      sekolah: item.sekolah || '',
      jurusan: item.jurusan || '',
      tahun: item.tahun || '',
    });
    state.ui.isDirty = true;
    notify('cv.education');
    EventBus.emit(EVT.CV_CHANGED, state.cv);
  },

  removeCvEducation(id) {
    state.cv.education = state.cv.education.filter(e => e.id !== id);
    state.ui.isDirty = true;
    notify('cv.education');
    EventBus.emit(EVT.CV_CHANGED, state.cv);
  },

  setCvExperience(list) {
    state.cv.experience = list;
    state.ui.isDirty = true;
    notify('cv.experience');
    EventBus.emit(EVT.CV_CHANGED, state.cv);
  },

  addCvExperience(item = {}) {
    state.cv.experience.push({
      id: uuid(),
      posisi: item.posisi || '',
      perusahaan: item.perusahaan || '',
      periode: item.periode || '',
      desc: item.desc || '',
    });
    state.ui.isDirty = true;
    notify('cv.experience');
    EventBus.emit(EVT.CV_CHANGED, state.cv);
  },

  removeCvExperience(id) {
    state.cv.experience = state.cv.experience.filter(e => e.id !== id);
    state.ui.isDirty = true;
    notify('cv.experience');
    EventBus.emit(EVT.CV_CHANGED, state.cv);
  },

  // ── ATTACHMENTS ─────────────────────────────────────────────────────────
  addAttachment(meta) {
    // meta: {id, name, type, size, rotation, pages}
    state.attachments.push(meta);
    state.ui.isDirty = true;
    notify('attachments');
    EventBus.emit(EVT.ATTACHMENT_ADDED, meta);
  },

  updateAttachment(id, patch) {
    const idx = state.attachments.findIndex(a => a.id === id);
    if (idx === -1) return;
    state.attachments[idx] = { ...state.attachments[idx], ...patch };
    state.ui.isDirty = true;
    notify('attachments');
    EventBus.emit(EVT.ATTACHMENT_ROTATED, state.attachments[idx]);
  },

  removeAttachment(id) {
    state.attachments = state.attachments.filter(a => a.id !== id);
    // Also detach from letter attachments
    state.letter.attachments = state.letter.attachments.map(la =>
      la.attachmentId === id ? { ...la, attachmentId: null } : la
    );
    state.ui.isDirty = true;
    notify('attachments');
    EventBus.emit(EVT.ATTACHMENT_REMOVED, id);
  },

  getAttachment(id) {
    return state.attachments.find(a => a.id === id) || null;
  },

  // ── SIGNATURE ───────────────────────────────────────────────────────────
  setSignature(dataUrl) {
    state.signature = dataUrl;
    state.ui.isDirty = true;
    notify('signature');
    EventBus.emit(EVT.SIG_CHANGED, dataUrl);
  },

  clearSignature() {
    state.signature = null;
    state.ui.isDirty = true;
    notify('signature');
    EventBus.emit(EVT.SIG_CHANGED, null);
  },

  // ── UI ──────────────────────────────────────────────────────────────────
  setDirty(v) { state.ui.isDirty = !!v; notify('ui.dirty'); },
  markSaved() {
    state.ui.isDirty = false;
    notify('ui.saved');
    EventBus.emit(EVT.STATE_SAVED);
  },
  setMobile(v) { state.ui.isMobile = !!v; notify('ui.mobile'); },
  setOrientation(o) { state.ui.orientation = o; notify('ui.orientation'); EventBus.emit(EVT.ORIENTATION_CHANGE, o); },
  setTab(tab) { state.ui.activeTab = tab; notify('ui.tab'); EventBus.emit(EVT.TAB_CHANGED, tab); },
  setModal(name) {
    state.ui.activeModal = name;
    notify('ui.modal');
    if (name) EventBus.emit(EVT.MODAL_OPEN, name);
    else EventBus.emit(EVT.MODAL_CLOSE);
  },
  setExporting(v) {
    state.ui.isExporting = !!v;
    notify('ui.exporting');
    EventBus.emit(v ? EVT.EXPORT_START : EVT.EXPORT_DONE, null);
  },

  // ── HYDRATION (called after migration / load) ──────────────────────────
  hydrate(loaded) {
    if (!loaded || typeof loaded !== 'object') return;
    // Merge defensively — never blindly overwrite structure
    if (loaded.letter) {
      if (loaded.letter.fields) state.letter.fields = { ...DEFAULT_LETTER, ...loaded.letter.fields };
      if (loaded.letter.formatting) state.letter.formatting = { ...state.letter.formatting, ...loaded.letter.formatting };
      if (Array.isArray(loaded.letter.attachments)) state.letter.attachments = loaded.letter.attachments;
    }
    if (loaded.cv) {
      if (loaded.cv.profile) state.cv.profile = { ...state.cv.profile, ...loaded.cv.profile };
      if (Array.isArray(loaded.cv.education)) state.cv.education = loaded.cv.education;
      if (Array.isArray(loaded.cv.experience)) state.cv.experience = loaded.cv.experience;
      state.cv.photo = loaded.cv.photo || null;
    }
    if (Array.isArray(loaded.attachments)) state.attachments = loaded.attachments;
    if (loaded.signature !== undefined) state.signature = loaded.signature;
    if (loaded.ui) {
      state.ui.isMobile = loaded.ui.isMobile ?? state.ui.isMobile;
      state.ui.activeTab = loaded.ui.activeTab || state.ui.activeTab;
    }
    state.ui.isDirty = false;
    notify('hydrate');
  },

  // ── RESET (partial / full) ──────────────────────────────────────────────
  resetLetter() {
    state.letter.fields = { ...DEFAULT_LETTER };
    state.letter.attachments = DEFAULT_ATTACHMENTS.map(text => ({
      id: uuid(), text, attachmentId: null,
    }));
    state.ui.isDirty = true;
    notify('reset.letter');
  },
  resetCv() {
    state.cv = {
      profile: {
        nama: '', posisi: '', telepon: '', email: '', alamat: '',
        ttl: '', jk: 'Laki-laki', agama: 'Islam', status: 'Belum Kawin', tentang: '',
      },
      photo: null,
      education: [],
      experience: [],
    };
    state.ui.isDirty = true;
    notify('reset.cv');
  },
  resetSignature() {
    state.signature = null;
    state.ui.isDirty = true;
    notify('reset.signature');
  },
  resetAll() {
    Object.assign(state, createInitialState());
    state.letter.attachments = DEFAULT_ATTACHMENTS.map(text => ({
      id: uuid(), text, attachmentId: null,
    }));
    notify('reset.all');
  },
};
