// ─── QUICK-FILL (Isi Cepat) ─────────────────────────────────────────────────
// Pre-fills letter + CV fields from one form. Critical fix (A3, B6):
//   - Does NOT replace letter.attachments[] blindly.
//   - If user already has custom attachments, prompts before replacing.
//   - If user has linked binary attachments, never wipes them.

import { AppState } from '../core/state.js';
import { EventBus, EVT } from '../core/events.js';
import { IC_LAMP_DEFAULTS } from '../core/constants.js';
import { Sanitizer } from '../editor/content-sanitizer.js';
import { uuid, formatTanggalID, debounce } from '../core/utils.js';

export const QuickFill = {
  els: {},
  icLampItems: [],
  icDateMode: 'today',
  bound: false,

  init() {
    if (this.bound) return;
    this.bound = true;

    this.els = {
      modal: document.getElementById('isiCepatModal'),
    };

    // Bind sumber-info dropdown (hide date field conditionally)
    const sumber = document.getElementById('ic_sumber');
    if (sumber) sumber.addEventListener('change', () => this.toggleTanggalInfo());

    // Add custom lampiran
    const addLampBtn = document.getElementById('ic-lamp-add');
    if (addLampBtn) addLampBtn.addEventListener('click', () => this.addCustomLamp());
    const customInput = document.getElementById('ic_lamp_custom');
    if (customInput) {
      customInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); this.addCustomLamp(); }
      });
    }

    // Add edu / exp rows
    const addEduBtn = document.getElementById('ic-edu-add');
    if (addEduBtn) addEduBtn.addEventListener('click', () => this.addEduRow());
    const addExpBtn = document.getElementById('ic-exp-add');
    if (addExpBtn) addExpBtn.addEventListener('click', () => this.addExpRow());

    // Date mode buttons
    ['today', 'tomorrow', 'custom'].forEach(m => {
      const b = document.getElementById('ic_date_' + m);
      if (b) b.addEventListener('click', () => this.setDateMode(m));
    });
  },

  open() {
    this._preloadFields();
    this._initLampiran();
    this._preloadCvSections();
    this.toggleTanggalInfo();

    this.els.modal?.classList.add('active');
    this.els.modal?.setAttribute('aria-hidden', 'false');
    EventBus.emit(EVT.MODAL_OPEN, 'isicepat');
    setTimeout(() => {
      const first = this.els.modal.querySelector('input, select, button');
      if (first) first.focus();
    }, 50);
  },

  close() {
    this.els.modal?.classList.remove('active');
    this.els.modal?.setAttribute('aria-hidden', 'true');
    EventBus.emit(EVT.MODAL_CLOSE);
  },

  _preloadFields() {
    const get = key => {
      const el = document.querySelector(`.editable[data-key="${key}"]`);
      return el?.innerText.trim() || '';
    };
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

    setVal('ic_nama', get('nama'));
    setVal('ic_ttl', get('ttl'));
    setVal('ic_alamat', get('alamat'));
    setVal('ic_pendidikan', get('pendidikan'));
    setVal('ic_telepon', get('telepon'));
    setVal('ic_email', get('email'));
    setVal('ic_kota', get('kota'));
    setVal('ic_pt', get('tujuan_nama').replace(/^HRD\s+/i, '').trim());

    const today = new Date();
    const isoToday = today.toISOString().slice(0, 10);
    setVal('ic_tgl_info', isoToday);
    setVal('ic_date_custom_val', isoToday);

    this.setDateMode('today');
  },

  _initLampiran() {
    const current = AppState.get().letter.attachments.map(a => ({
      text: a.text, id: a.id, attachmentId: a.attachmentId,
    }));
    const defaultTexts = IC_LAMP_DEFAULTS.map(d => d.text);

    this.icLampItems = IC_LAMP_DEFAULTS.map(d => ({
      text: d.text,
      checked: current.length > 0 ? current.some(c => c.text === d.text) : d.checked,
      custom: false,
    }));

    // Add any custom items from current letter that aren't in defaults
    current.forEach(c => {
      if (!defaultTexts.includes(c.text)) {
        this.icLampItems.push({ text: c.text, checked: true, custom: true, attachmentId: c.attachmentId });
      }
    });

    this._renderLampiran();
  },

  _renderLampiran() {
    const container = document.getElementById('ic_lamp_list');
    if (!container) return;
    container.innerHTML = '';

    this.icLampItems.forEach((item, i) => {
      const div = document.createElement('div');
      div.className = 'ic-lamp-item' + (item.custom ? ' custom-item' : '');

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = `ic_lamp_${i}`;
      cb.checked = item.checked;
      cb.setAttribute('aria-label', `Lampiran: ${item.text}`);
      cb.addEventListener('change', e => { this.icLampItems[i].checked = e.target.checked; });

      const lbl = document.createElement('label');
      lbl.htmlFor = `ic_lamp_${i}`;
      lbl.textContent = item.text;

      div.appendChild(cb);
      div.appendChild(lbl);

      if (item.custom) {
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'ic-lamp-remove';
        rm.setAttribute('aria-label', 'Hapus lampiran kustom');
        rm.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
        rm.addEventListener('click', () => {
          this.icLampItems.splice(i, 1);
          this._renderLampiran();
        });
        div.appendChild(rm);
      }

      container.appendChild(div);
    });
  },

  addCustomLamp() {
    const input = document.getElementById('ic_lamp_custom');
    const text = (input?.value || '').trim();
    if (!text) return;
    const finalText = text.endsWith('.') ? text : text + '.';
    this.icLampItems.push({ text: finalText, checked: true, custom: true });
    input.value = '';
    this._renderLampiran();
  },

  setDateMode(mode) {
    this.icDateMode = mode;
    ['today', 'tomorrow', 'custom'].forEach(m => {
      const b = document.getElementById('ic_date_' + m);
      if (b) b.classList.toggle('active', m === mode);
    });
    const customVal = document.getElementById('ic_date_custom_val');
    if (customVal) customVal.style.display = mode === 'custom' ? 'block' : 'none';
  },

  toggleTanggalInfo() {
    const sumber = document.getElementById('ic_sumber')?.value || '';
    const hide   = ['rekomendasi dari kenalan', 'portal lowongan kerja online', 'iklan di media sosial'];
    const wrap = document.getElementById('ic_tgl_wrap');
    if (!wrap) return;
    const tglInput = document.getElementById('ic_tgl_info');
    if (hide.includes(sumber)) {
      // DISABLED (fix B14) — not just faded opacity
      wrap.style.opacity = '0.4';
      if (tglInput) tglInput.disabled = true;
    } else {
      wrap.style.opacity = '1';
      if (tglInput) tglInput.disabled = false;
    }
  },

  _preloadCvSections() {
    // Load Tentang Saya
    const tentangEl = document.querySelector('.cv-editable[data-cvkey="cv_tentang"]');
    const tentangInput = document.getElementById('ic_cv_tentang');
    if (tentangEl && tentangInput) tentangInput.value = tentangEl.innerText.trim();

    // Pendidikan
    const eduList = document.getElementById('ic_edu_list');
    if (eduList) {
      eduList.innerHTML = '';
      const items = AppState.get().cv.education;
      items.forEach(item => this.addEduRow(item));
      if (eduList.children.length === 0) this.addEduRow();
    }

    // Pengalaman
    const expList = document.getElementById('ic_exp_list');
    if (expList) {
      expList.innerHTML = '';
      const items = AppState.get().cv.experience;
      items.forEach(item => this.addExpRow(item));
      if (expList.children.length === 0) this.addExpRow();
    }
  },

  addEduRow(data = {}) {
    const list = document.getElementById('ic_edu_list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'ic-edu-row';
    row.innerHTML = `
      <button type="button" class="ic-row-remove" aria-label="Hapus baris pendidikan">
        <i class="fas fa-times-circle" aria-hidden="true"></i>
      </button>
      <div class="ic-row-grid">
        <div class="full">
          <label class="ic-label">Nama Sekolah / Institusi</label>
          <input class="ic-input ic-edu-sekolah" type="text" placeholder="Contoh: SMK N1 Semarang" value="${escapeAttr(data.sekolah || '')}">
        </div>
        <div>
          <label class="ic-label">Jurusan / Program Studi</label>
          <input class="ic-input ic-edu-jurusan" type="text" placeholder="Contoh: Teknik Mesin" value="${escapeAttr(data.jurusan || '')}">
        </div>
        <div>
          <label class="ic-label">Tahun</label>
          <input class="ic-input ic-edu-tahun" type="text" placeholder="Contoh: 2015 – 2018" value="${escapeAttr(data.tahun || '')}">
        </div>
      </div>
    `;
    row.querySelector('.ic-row-remove').addEventListener('click', () => row.remove());
    list.appendChild(row);
  },

  addExpRow(data = {}) {
    const list = document.getElementById('ic_exp_list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'ic-exp-row';
    row.innerHTML = `
      <button type="button" class="ic-row-remove" aria-label="Hapus baris pengalaman">
        <i class="fas fa-times-circle" aria-hidden="true"></i>
      </button>
      <div class="ic-row-grid">
        <div>
          <label class="ic-label">Posisi / Jabatan</label>
          <input class="ic-input ic-exp-posisi" type="text" placeholder="Contoh: Quality Control" value="${escapeAttr(data.posisi || '')}">
        </div>
        <div>
          <label class="ic-label">Nama Perusahaan</label>
          <input class="ic-input ic-exp-perusahaan" type="text" placeholder="Contoh: PT. Kayu Kapur" value="${escapeAttr(data.perusahaan || '')}">
        </div>
        <div>
          <label class="ic-label">Periode</label>
          <input class="ic-input ic-exp-periode" type="text" placeholder="Jan 2020 – Des 2022" value="${escapeAttr(data.periode || '')}">
        </div>
        <div class="full">
          <label class="ic-label">Deskripsi Singkat</label>
          <input class="ic-input ic-exp-desc" type="text" placeholder="Contoh: Mengontrol kualitas produk sebelum pengiriman." value="${escapeAttr(data.desc || '')}">
        </div>
      </div>
    `;
    row.querySelector('.ic-row-remove').addEventListener('click', () => row.remove());
    list.appendChild(row);
  },

  async apply() {
    const val = id => (document.getElementById(id)?.value || '').trim();

    const nama       = val('ic_nama');
    const ttl        = val('ic_ttl');
    const jk         = document.getElementById('ic_jk')?.value || 'Laki-laki';
    const alamat     = val('ic_alamat');
    const pendidikan = val('ic_pendidikan');
    const agama      = document.getElementById('ic_agama')?.value || 'Islam';
    const status     = document.getElementById('ic_status')?.value || 'Belum Kawin';
    const telepon    = val('ic_telepon');
    const email      = val('ic_email');
    const pt         = val('ic_pt');
    const lokasi     = val('ic_lokasi') || 'Di Tempat';
    const posisi     = val('ic_posisi');
    const kota       = val('ic_kota');
    const sumber     = document.getElementById('ic_sumber')?.value || 'brosur yang ditempel di depan PT';

    // ── ATTACHMENT HANDLING (fix A3 + B6) ───────────────────────────────────
    // We do NOT blindly replace attachments. We merge: keep existing items that
    // have linked binary files; toggle checkboxes for defaults.
    const existing = AppState.get().letter.attachments.slice();
    const hasLinkedBinary = existing.some(a => a.attachmentId);

    const selectedLamp = this.icLampItems.filter(i => i.checked).map(i => i.text);

    // Build new attachments list: preserve existing items that are NOT in defaults
    // (custom items), then replace default-typed items with the checked-defaults.
    const defaultTexts = IC_LAMP_DEFAULTS.map(d => d.text);
    const customItems = existing.filter(a => !defaultTexts.includes(a.text));

    // If user has custom items + user is changing default selection, prompt
    const willLoseCustom = customItems.length > 0 && existing.length > selectedLamp.length;
    if (willLoseCustom || (hasLinkedBinary && existing.length !== selectedLamp.length)) {
      const ok = await this._confirmAttachmentChange();
      if (!ok) {
        // Skip attachment replacement, keep current
        // Continue with the rest of the apply logic
      } else {
        // Replace default items only, keep custom items + their attachmentIds
        const newItems = [
          ...customItems,
          ...selectedLamp
            .filter(t => !customItems.some(c => c.text === t))
            .map(text => ({ id: uuid(), text, attachmentId: null })),
        ];
        AppState.setLetterAttachments(newItems);
      }
    } else {
      // Safe to replace
      const newItems = selectedLamp.map(text => ({
        id: uuid(),
        text,
        // Preserve attachmentId if the same text existed before
        attachmentId: existing.find(e => e.text === text)?.attachmentId || null,
      }));
      // Plus any custom items not in the checked selection
      customItems.forEach(c => {
        if (!newItems.some(n => n.text === c.text)) newItems.push(c);
      });
      AppState.setLetterAttachments(newItems);
    }

    // ── LETTER FIELDS ───────────────────────────────────────────────────────
    let suratDate = new Date();
    if (this.icDateMode === 'tomorrow') suratDate.setDate(suratDate.getDate() + 1);
    else if (this.icDateMode === 'custom') {
      const cv = val('ic_date_custom_val');
      if (cv) suratDate = new Date(cv + 'T00:00:00');
    }

    const tglInfoVal = val('ic_tgl_info');
    const tglInfo    = tglInfoVal ? new Date(tglInfoVal + 'T00:00:00') : new Date();
    const tglInfoStr = formatTanggalID(tglInfo);

    const hidesDate = ['rekomendasi dari kenalan', 'portal lowongan kerja online', 'iklan di media sosial'];
    let paraOpen;
    if (sumber === 'rekomendasi dari kenalan') {
      paraOpen = `Berdasarkan informasi yang saya dapatkan dari kenalan, bahwa ${pt} sedang membutuhkan pekerja tambahan pada bagian ${posisi}.`;
    } else if (hidesDate.includes(sumber)) {
      paraOpen = `Berdasarkan informasi yang saya dapatkan melalui ${sumber}, bahwa ${pt} sedang membutuhkan pekerja tambahan pada bagian ${posisi}.`;
    } else {
      paraOpen = `Berdasarkan informasi yang saya dapatkan dari ${sumber} pada tanggal ${tglInfoStr}, bahwa ${pt} sedang membutuhkan pekerja tambahan pada bagian ${posisi}.`;
    }

    const paraNiat = `Sehubungan dengan itu, melalui surat ini saya bermaksud melamar pekerjaan di perusahaan yang Bapak/Ibu pimpin sebagai <strong>${Sanitizer.sanitizeText(posisi)}</strong>.`;

    const fields = {};
    if (nama)       fields.nama = nama;
    if (ttl)        fields.ttl = ttl;
    fields.jk = jk;
    if (alamat)     fields.alamat = alamat;
    if (pendidikan) fields.pendidikan = pendidikan;
    fields.agama = agama;
    fields.status = status;
    if (telepon)    fields.telepon = telepon;
    if (email)      fields.email = email;
    if (kota)       fields.kota = kota;
    if (pt)         fields.tujuan_nama = 'HRD ' + pt;
    if (lokasi)     fields.tujuan_lokasi = lokasi;
    if (paraOpen)   fields.paragraf_buka = paraOpen;
    if (posisi && pt) fields.paragraf_niat = paraNiat;
    if (nama)       fields.ttd_nama = nama;
    AppState.setLetterFields(fields);

    // Auto-date element
    const dateEl = document.getElementById('autoDate');
    if (dateEl) dateEl.textContent = formatTanggalID(suratDate);

    // ── CV ───────────────────────────────────────────────────────────────────
    if (nama)       AppState.setCvField('cv_nama', nama);
    if (posisi)     AppState.setCvField('cv_posisi', posisi);
    if (telepon)    AppState.setCvField('cv_telepon', telepon);
    if (email)      AppState.setCvField('cv_email', email);
    if (alamat)     AppState.setCvField('cv_alamat', alamat);
    if (ttl)        AppState.setCvField('cv_ttl', ttl);
    AppState.setCvField('cv_jk', jk);
    AppState.setCvField('cv_agama', agama);
    AppState.setCvField('cv_status', status);

    const tentang = val('ic_cv_tentang');
    if (tentang) AppState.setCvField('cv_tentang', tentang);

    // Pendidikan
    const eduRows = [...document.querySelectorAll('#ic_edu_list .ic-edu-row')];
    if (eduRows.length > 0) {
      const eduList = eduRows.map(row => ({
        id: uuid(),
        sekolah: row.querySelector('.ic-edu-sekolah')?.value || '',
        jurusan: row.querySelector('.ic-edu-jurusan')?.value || '',
        tahun:   row.querySelector('.ic-edu-tahun')?.value || '',
      })).filter(e => e.sekolah || e.jurusan || e.tahun);
      AppState.setCvEducation(eduList);
    }

    // Pengalaman
    const expRows = [...document.querySelectorAll('#ic_exp_list .ic-exp-row')];
    if (expRows.length > 0) {
      const expList = expRows.map(row => ({
        id: uuid(),
        posisi:      row.querySelector('.ic-exp-posisi')?.value || '',
        perusahaan:  row.querySelector('.ic-exp-perusahaan')?.value || '',
        periode:     row.querySelector('.ic-exp-periode')?.value || '',
        desc:        row.querySelector('.ic-exp-desc')?.value || '',
      })).filter(e => e.posisi || e.perusahaan || e.periode || e.desc);
      AppState.setCvExperience(expList);
    }

    this.close();
    EventBus.emit(EVT.NOTIFY, { type: 'success', msg: 'Data diterapkan ke surat & CV.' });
  },

  _confirmAttachmentChange() {
    // Accessible confirm dialog (not native browser confirm)
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal';
      overlay.style.cssText = `
        display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.7);
        z-index:8000; align-items:center; justify-content:center; padding:16px;
      `;
      overlay.innerHTML = `
        <div role="alertdialog" aria-modal="true" aria-labelledby="conf-title" aria-describedby="conf-desc"
             style="background:#1e1e1e; color:white; border-radius:14px; padding:22px;
                    width:min(420px, 95vw); box-shadow:0 20px 60px rgba(0,0,0,0.7);">
          <h5 id="conf-title" style="font-family:sans-serif; font-weight:700; font-size:1rem; margin:0 0 8px;">
            <i class="fas fa-exclamation-triangle me-2" style="color:#facc15" aria-hidden="true"></i>
            Ganti Lampiran?
          </h5>
          <p id="conf-desc" style="font-size:13px; color:#aaa; font-family:sans-serif; margin:0 0 18px;">
            Anda sudah memiliki lampiran kustom. Mengubah pilihan akan mengganti daftar lampiran (file yang sudah diupload tetap aman dan dapat dipasang ulang). Lanjutkan?
          </p>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" data-action="cancel" style="flex:1; min-height:44px; padding:10px; background:#2a2a2a; color:#ccc; border:1px solid #444; border-radius:8px; cursor:pointer; font-family:sans-serif; font-weight:600;">
              Batal
            </button>
            <button type="button" data-action="ok" style="flex:1; min-height:44px; padding:10px; background:#c0392b; color:white; border:none; border-radius:8px; cursor:pointer; font-family:sans-serif; font-weight:600;">
              Ganti
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      const cleanup = (result) => {
        overlay.remove();
        resolve(result);
      };
      overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => cleanup(false));
      overlay.querySelector('[data-action="ok"]').addEventListener('click', () => cleanup(true));
      // Focus the cancel button (safe default)
      setTimeout(() => overlay.querySelector('[data-action="cancel"]').focus(), 50);
      // Escape = cancel
      overlay.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
      });
    });
  },
};

function escapeAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
