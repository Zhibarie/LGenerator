// ─── CV EDITOR ─────────────────────────────────────────────────────────────
// Renders CV sections (education, experience) from AppState, binds
// contenteditable fields, manages add/remove rows.

import { AppState } from '../core/state.js';
import { EventBus, EVT } from '../core/events.js';
import { CvStorage } from './cv-storage.js';
import { CvPhoto } from './cv-photo.js';
import { CvAutoFit } from './cv-auto-fit.js';
import { Sanitizer } from '../editor/content-sanitizer.js';
import { uuid, debounce } from '../core/utils.js';

export const CvEditor = {
  bound: false,

  init() {
    if (this.bound) return;
    this.bound = true;

    CvPhoto.init();
    CvAutoFit.init();

    // Bind static cv-editable fields (nama, posisi, kontak, ttl, jk, agama, status, tentang)
    document.querySelectorAll('.cv-editable[data-cvkey]').forEach(el => {
      el.addEventListener('input', debounce(() => {
        const key = el.dataset.cvkey;
        const val = el.textContent;
        AppState.setCvField(key, val);
      }, 250));
      el.addEventListener('paste', e => {
        e.preventDefault();
        const text = e.clipboardData?.getData('text/plain') || '';
        document.execCommand('insertText', false, text);
      });
    });

    // Add-education / add-experience buttons
    document.querySelectorAll('.cv-add-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'add-edu') AppState.addCvEducation();
        else if (action === 'add-exp') AppState.addCvExperience();
      });
    });

    // Subscribe to CV state changes for re-render of edu/exp lists
    EventBus.on(EVT.CV_CHANGED, () => this.renderLists());
    EventBus.on(EVT.STATE_CHANGED, ({ scope }) => {
      if (scope === 'reset.cv') this.hydrate(AppState.snapshot());
    });
  },

  hydrate(state) {
    if (!state?.cv) return;
    const { profile } = state.cv;

    // Render profile fields
    document.querySelectorAll('.cv-editable[data-cvkey]').forEach(el => {
      const key = el.dataset.cvkey;
      const val = profile[key];
      if (val == null) return;
      el.textContent = val;
    });

    // Render lists
    this.renderLists();
  },

  renderLists() {
    this.renderEducation();
    this.renderExperience();
  },

  renderEducation() {
    const list = document.getElementById('cv-edu-list');
    if (!list) return;
    list.innerHTML = '';

    const items = AppState.get().cv.education;
    if (items.length === 0) {
      AppState.addCvEducation({ sekolah: 'Nama Sekolah / Institusi', jurusan: 'Jurusan', tahun: 'Tahun' });
      return;
    }

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'cv-edu-item';
      div.dataset.id = item.id;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'cv-remove-btn';
      remove.setAttribute('aria-label', 'Hapus pendidikan ini');
      remove.innerHTML = '<i class="fas fa-times-circle" aria-hidden="true"></i>';
      remove.addEventListener('click', () => AppState.removeCvEducation(item.id));

      const title = document.createElement('div');
      title.className = 'cv-item-title';
      const titleSpan = document.createElement('span');
      titleSpan.className = 'cv-editable';
      titleSpan.setAttribute('contenteditable', 'true');
      titleSpan.textContent = item.sekolah || 'Nama Sekolah / Institusi';
      titleSpan.addEventListener('input', debounce(() => {
        item.sekolah = titleSpan.textContent;
        EventBus.emit(EVT.STATE_DIRTY);
      }, 250));
      title.appendChild(titleSpan);

      const sub = document.createElement('div');
      sub.className = 'cv-item-sub';
      const jurSpan = document.createElement('span');
      jurSpan.className = 'cv-editable';
      jurSpan.setAttribute('contenteditable', 'true');
      jurSpan.textContent = item.jurusan || 'Jurusan';
      jurSpan.addEventListener('input', debounce(() => { item.jurusan = jurSpan.textContent; EventBus.emit(EVT.STATE_DIRTY); }, 250));
      sub.appendChild(jurSpan);
      sub.appendChild(document.createTextNode(' · '));
      const tahunSpan = document.createElement('span');
      tahunSpan.className = 'cv-editable';
      tahunSpan.setAttribute('contenteditable', 'true');
      tahunSpan.textContent = item.tahun || 'Tahun';
      tahunSpan.addEventListener('input', debounce(() => { item.tahun = tahunSpan.textContent; EventBus.emit(EVT.STATE_DIRTY); }, 250));
      sub.appendChild(tahunSpan);

      div.appendChild(remove);
      div.appendChild(title);
      div.appendChild(sub);
      list.appendChild(div);
    });
  },

  renderExperience() {
    const list = document.getElementById('cv-exp-list');
    if (!list) return;
    list.innerHTML = '';

    const items = AppState.get().cv.experience;
    if (items.length === 0) {
      AppState.addCvExperience({ posisi: 'Nama Posisi', perusahaan: 'Nama Perusahaan', periode: 'Periode', desc: 'Deskripsi' });
      return;
    }

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'cv-exp-item';
      div.dataset.id = item.id;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'cv-remove-btn';
      remove.setAttribute('aria-label', 'Hapus pengalaman ini');
      remove.innerHTML = '<i class="fas fa-times-circle" aria-hidden="true"></i>';
      remove.addEventListener('click', () => AppState.removeCvExperience(item.id));

      const title = document.createElement('div');
      title.className = 'cv-item-title';
      const titleSpan = document.createElement('span');
      titleSpan.className = 'cv-editable';
      titleSpan.setAttribute('contenteditable', 'true');
      titleSpan.textContent = item.posisi || 'Nama Posisi';
      titleSpan.addEventListener('input', debounce(() => { item.posisi = titleSpan.textContent; EventBus.emit(EVT.STATE_DIRTY); }, 250));
      title.appendChild(titleSpan);

      const sub = document.createElement('div');
      sub.className = 'cv-item-sub';
      const perSpan = document.createElement('span');
      perSpan.className = 'cv-editable';
      perSpan.setAttribute('contenteditable', 'true');
      perSpan.textContent = item.perusahaan || 'Nama Perusahaan';
      perSpan.addEventListener('input', debounce(() => { item.perusahaan = perSpan.textContent; EventBus.emit(EVT.STATE_DIRTY); }, 250));
      sub.appendChild(perSpan);
      sub.appendChild(document.createTextNode(' · '));
      const perTxt = document.createElement('span');
      perTxt.className = 'cv-editable';
      perTxt.setAttribute('contenteditable', 'true');
      perTxt.textContent = item.periode || 'Periode';
      perTxt.addEventListener('input', debounce(() => { item.periode = perTxt.textContent; EventBus.emit(EVT.STATE_DIRTY); }, 250));
      sub.appendChild(perTxt);

      const desc = document.createElement('div');
      desc.className = 'cv-item-desc';
      const descSpan = document.createElement('span');
      descSpan.className = 'cv-editable';
      descSpan.setAttribute('contenteditable', 'true');
      descSpan.textContent = item.desc || 'Deskripsi';
      descSpan.addEventListener('input', debounce(() => { item.desc = descSpan.textContent; EventBus.emit(EVT.STATE_DIRTY); }, 250));
      desc.appendChild(descSpan);

      div.appendChild(remove);
      div.appendChild(title);
      div.appendChild(sub);
      div.appendChild(desc);
      list.appendChild(div);
    });
  },

  reset() {
    AppState.resetCv();
    this.hydrate(AppState.snapshot());
    CvPhoto.render();
  },
};
