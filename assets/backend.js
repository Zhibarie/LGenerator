// ─── CONFIG ──────────────────────────────────────────────────────────────────
const MIN_FONT = 7, MAX_FONT = 13, STEP = 0.2;
const DEFAULT_ATTACHMENTS = [
    'Curriculum Vitae (CV) / Daftar Riwayat Hidup.',
    'Scan ijazah SMK.',
    'Scan transkip nilai.',
    'Scan KTP.',
    'Pas foto berwarna terbaru.',
    'Scan sertifikat pelatihan tentang kewirausahaan.',
    'Scan surat keterangan sehat dari dokter.',
];
const DEFAULTS = {
    kota: 'Semarang',
    tujuan_nama: 'HRD PT. Kayu Kapur',
    tujuan_lokasi: 'Di Tempat',
    paragraf_buka: 'Berdasarkan informasi yang saya dapatkan dari brosur yang ditempel di depan PT pada tanggal 25 Juni 2020, bahwa PT. Kayu Kapur sedang membutuhkan pekerja tambahan pada bagian Quality Control.',
    paragraf_niat: 'Sehubungan dengan itu, melalui surat ini saya bermaksud melamar pekerjaan di perusahaan yang Bapak/Ibu pimpin sebagai Quality Control.',
    nama: 'Dani Hamdani',
    ttl: 'Semarang, 07 Agustus 1999',
    jk: 'Laki – laki',
    alamat: 'Ungaran Semarang',
    pendidikan: 'SMK N1 Semarang',
    agama: 'Islam',
    status: 'Belum Kawin',
    telepon: '0823 2224 0471',
    email: 'danihamdani@gmail.com',
    paragraf_keahlian: 'Saya memiliki kondisi kesehatan yang baik, ketelitian yang tinggi, dan mampu bekerja secara personal maupun tim.',
    paragraf_tutup: 'Demikian surat permohonan pekerjaan ini saya buat dengan sebenar – benarnya. Saya sangat berharap Bapak/Ibu bersedia untuk memberikan kesempatan tes dan wawancara kepada saya, sehingga saya dapat menjelaskan secara lebih rinci tentang potensi yang saya miliki. Atas perhatian Bapak/Ibu saya ucapkan terima kasih.',
    ttd_nama: 'Dani Hamdani',
};

const frame   = document.getElementById('paperFrame');
const content = document.getElementById('letterContent');
let autoFitTimer = null, saveTimer = null;

// ─── AUTO-FIT ────────────────────────────────────────────────────────────────
function ptToPx(pt) { return (pt * 96) / 72; }
function setFont(pt) { document.documentElement.style.setProperty('--base-font-size', ptToPx(pt) + 'px'); }

function autoFit() {
    const tH = frame.clientHeight;
    setFont(MIN_FONT);
    if (content.scrollHeight > tH) { updateFitUI(MIN_FONT, tH); return; }
    setFont(MAX_FONT);
    if (content.scrollHeight <= tH) { updateFitUI(MAX_FONT, tH); return; }
    let lo = MIN_FONT, hi = MAX_FONT;
    while (hi - lo > STEP) {
        const mid = (lo + hi) / 2;
        setFont(mid);
        content.scrollHeight <= tH ? (lo = mid) : (hi = mid);
    }
    setFont(Math.round(lo * 5) / 5);
    updateFitUI(Math.round(lo * 5) / 5, tH);
}
function updateFitUI(pt, tH) {
    const pct  = Math.min(100, Math.round((content.scrollHeight / tH) * 100));
    const over = content.scrollHeight > tH;
    const bar  = document.getElementById('fit-bar');
    bar.style.width      = pct + '%';
    bar.style.background = over ? '#ef4444' : pt >= MAX_FONT ? '#facc15' : '#22c55e';
    document.getElementById('fit-label').textContent        = pct + '%';
    document.getElementById('font-size-display').textContent = pt.toFixed(1).replace(/\.0$/,'') + 'pt';
    frame.classList.toggle('overflow', over);
    frame.style.setProperty('--fill-pct', pct + '%');
    // Re-scale setelah font berubah
    requestAnimationFrame(scalePaper);
}
function scheduleAutoFit() { clearTimeout(autoFitTimer); autoFitTimer = setTimeout(autoFit, 280); }

// ─── TANGGAL OTOMATIS ────────────────────────────────────────────────────────
function updateDate() {
    const opts = { day: 'numeric', month: 'long', year: 'numeric' };
    const el = document.getElementById('autoDate');
    if (el) el.textContent = new Date().toLocaleDateString('id-ID', opts);
}

// ─── AUTO-SAVE ───────────────────────────────────────────────────────────────
function triggerAutoSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        document.querySelectorAll('.editable[data-key]').forEach(el =>
            localStorage.setItem('ls_' + el.dataset.key, el.innerText));
        const items = [...document.querySelectorAll('#attachmentGrid .lamp-editable')]
            .map(el => el.innerText);
        localStorage.setItem('ls_attachments', JSON.stringify(items));
        const sig = document.getElementById('sigPreview').src;
        if (sig && sig !== location.href) localStorage.setItem('ls_sig', sig);
        const ind = document.getElementById('save-indicator');
        ind.classList.add('show');
        setTimeout(() => ind.classList.remove('show'), 2000);
    }, 700);
}

// ─── LOAD DATA ───────────────────────────────────────────────────────────────
function loadSavedData() {
    document.querySelectorAll('.editable[data-key]').forEach(el => {
        const s = localStorage.getItem('ls_' + el.dataset.key);
        if (s !== null) el.innerText = s;
    });
    const savedAtt = localStorage.getItem('ls_attachments');
    renderAttachments(savedAtt ? JSON.parse(savedAtt) : DEFAULT_ATTACHMENTS);
    const sig = localStorage.getItem('ls_sig');
    if (sig) applySigData(sig);
}

// ─── LAMPIRAN ────────────────────────────────────────────────────────────────
let lampDocs  = {};   // { lid: { name, type, dataUrl, pages } }
let lampIdSeq = 0;

function renderAttachments(list) {
    document.getElementById('attachmentGrid').innerHTML = '';
    lampDocs = {};
    list.forEach(t => addAttachment(t));
}
function addAttachment(text = 'Dokumen baru.') {
    const grid = document.getElementById('attachmentGrid');
    const li   = document.createElement('li');
    const lid  = 'lamp_' + (++lampIdSeq);
    li.dataset.lid = lid;
    li.innerHTML = `<span class="lamp-num"></span><span class="lamp-editable editable" contenteditable="true">${esc(text)}</span><i class="fas fa-cloud-upload-alt btn-lamp-upload" onclick="openLampModal('${lid}',this)" title="Upload dokumen"></i><i class="fas fa-times-circle btn-remove" onclick="removeAttachment(this)" title="Hapus"></i>`;
    li.querySelector('.lamp-editable').addEventListener('input', () => { scheduleAutoFit(); triggerAutoSave(); });
    grid.appendChild(li);
    renumberAttachments();
    scheduleAutoFit();
}
function removeAttachment(btn) {
    btn.parentElement.remove();
    renumberAttachments();
    scheduleAutoFit(); triggerAutoSave();
}
function renumberAttachments() {
    // Hitung total item lalu tentukan berapa baris per kolom
    const items = document.querySelectorAll('#attachmentGrid li');
    const total = items.length;
    const col1  = Math.ceil(total / 2); // kolom kiri: 1..col1
    // Nomor urut lurus 1,2,3,...
    items.forEach((li, i) => {
        li.querySelector('.lamp-num').textContent = (i + 1) + '.';
    });
    // Set ukuran kolom CSS agar kolom kiri = col1 item, kolom kanan = sisanya
    // dengan column-count:2 browser sudah handle secara otomatis
}
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ─── RESET ───────────────────────────────────────────────────────────────────
function resetData() {
    if (!confirm('Reset semua data ke template awal?')) return;
    Object.keys(localStorage).filter(k => k.startsWith('ls_')).forEach(k => localStorage.removeItem(k));
    document.querySelectorAll('.editable[data-key]').forEach(el => {
        el.innerHTML = DEFAULTS[el.dataset.key] || '';
    });
    clearSig();
    renderAttachments(DEFAULT_ATTACHMENTS);
    updateDate(); autoFit();
}

// ─── EXPORT PDF ──────────────────────────────────────────────────────────────
async function exportPDF() {
    const editables  = document.querySelectorAll('.editable');
    const btnRemoves = document.querySelectorAll('.btn-remove');
    const btnAdd     = document.querySelector('.btn-add-lamp');
    const loader     = document.getElementById('pdf-loading');
    const sigZone    = document.getElementById('signatureZone');

    loader.classList.add('active');
    document.getElementById('btnExport').disabled = true;
    // Sembunyikan semua elemen UI yang tidak perlu di PDF
    btnRemoves.forEach(b => b.style.display = 'none');
    document.querySelectorAll('.btn-lamp-upload').forEach(b => b.style.display = 'none');
    if (btnAdd) btnAdd.style.display = 'none';
    editables.forEach(e => { e.style.color = 'black'; e.style.borderBottom = 'none'; });
    sigZone.style.border = 'none'; sigZone.style.background = 'transparent';
    // Sembunyikan placeholder TTD jika belum diisi
    const sigPlaceholder = sigZone.querySelector('.sig-placeholder');
    const sigClear = sigZone.querySelector('.sig-clear');
    const hasSig = sigZone.classList.contains('has-sig');
    if (!hasSig && sigPlaceholder) sigPlaceholder.style.display = 'none';
    if (sigClear) sigClear.style.display = 'none';
    frame.style.border = 'none';
    // Sembunyikan bar indikator kiri
    frame.style.setProperty('--fill-pct', '0%');
    const origAfter = document.createElement('style');
    origAfter.id = 'pdf-hide-after';
    origAfter.textContent = '#paperFrame::after { display: none !important; }';
    document.head.appendChild(origAfter);

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
        setProgress('Merender surat...');
        const { dataUrl } = await elementToJpeg(frame, { windowWidth: 794 });
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297);
        pdf.save('Surat_Lamaran_Kerja.pdf');
    } catch(e) {
        console.error(e); alert('Gagal membuat PDF. Coba gunakan tombol Cetak.');
    } finally {
        btnRemoves.forEach(b => b.style.display = '');
        document.querySelectorAll('.btn-lamp-upload').forEach(b => b.style.display = '');
        if (btnAdd) btnAdd.style.display = '';
        editables.forEach(e => { e.style.color = ''; e.style.borderBottom = ''; });
        sigZone.style.border = ''; sigZone.style.background = '';
        if (!hasSig && sigPlaceholder) sigPlaceholder.style.display = '';
        if (sigClear) sigClear.style.display = '';
        frame.style.border = '';
        const hideStyle = document.getElementById('pdf-hide-after');
        if (hideStyle) hideStyle.remove();
        setProgress('');
        loader.classList.remove('active');
        document.getElementById('btnExport').disabled = false;
        setTimeout(() => { autoFit(); scalePaper(); }, 50);
    }
}

// ─── TANDA TANGAN ────────────────────────────────────────────────────────────
let sigDrawing=false, sigLastX=0, sigLastY=0;
let penColor='#000000', penSize=2, currentSigTab='draw', uploadedSigData=null;

function openSigModal() { document.getElementById('sigModal').classList.add('active'); requestAnimationFrame(initCanvas); }
function closeSigModal() { document.getElementById('sigModal').classList.remove('active'); uploadedSigData=null; }

function switchSigTab(tab) {
    currentSigTab=tab;
    document.querySelectorAll('.sig-tab').forEach((el,i)=>
        el.classList.toggle('active',(i===0&&tab==='draw')||(i===1&&tab==='upload')));
    document.getElementById('sigPanel-draw').style.display   = tab==='draw'  ?'block':'none';
    document.getElementById('sigPanel-upload').style.display = tab==='upload'?'block':'none';
    if(tab==='draw') requestAnimationFrame(initCanvas);
}
function initCanvas() {
    const c=document.getElementById('sigCanvas'), rect=c.getBoundingClientRect();
    c.width=rect.width*devicePixelRatio; c.height=rect.height*devicePixelRatio;
    const ctx=c.getContext('2d'); ctx.scale(devicePixelRatio,devicePixelRatio);
    ctx.fillStyle='white'; ctx.fillRect(0,0,c.width,c.height); bindCanvasEvents();
}
function bindCanvasEvents() {
    const old=document.getElementById('sigCanvas'), c=old.cloneNode(true); old.replaceWith(c);
    const ctx=c.getContext('2d'); ctx.scale(devicePixelRatio,devicePixelRatio);
    ctx.fillStyle='white'; ctx.fillRect(0,0,c.width,c.height);
    const pos=e=>{ const r=c.getBoundingClientRect(),src=e.touches?e.touches[0]:e; return{x:src.clientX-r.left,y:src.clientY-r.top}; };
    c.addEventListener('mousedown', e=>{ sigDrawing=true; const p=pos(e); sigLastX=p.x; sigLastY=p.y; });
    c.addEventListener('mousemove', e=>{ if(!sigDrawing)return; const p=pos(e); drawLine(ctx,p); });
    c.addEventListener('mouseup',   ()=>sigDrawing=false);
    c.addEventListener('mouseleave',()=>sigDrawing=false);
    c.addEventListener('touchstart',e=>{ e.preventDefault(); sigDrawing=true; const p=pos(e); sigLastX=p.x; sigLastY=p.y; },{passive:false});
    c.addEventListener('touchmove', e=>{ e.preventDefault(); if(!sigDrawing)return; const p=pos(e); drawLine(ctx,p); },{passive:false});
    c.addEventListener('touchend',  ()=>sigDrawing=false);
}
function drawLine(ctx,p) {
    ctx.strokeStyle=penColor; ctx.lineWidth=penSize; ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.beginPath(); ctx.moveTo(sigLastX,sigLastY); ctx.lineTo(p.x,p.y); ctx.stroke();
    sigLastX=p.x; sigLastY=p.y;
}
function clearCanvas() { const c=document.getElementById('sigCanvas'),ctx=c.getContext('2d'); ctx.fillStyle='white'; ctx.fillRect(0,0,c.width,c.height); }
function setPenColor(dot) { penColor=dot.dataset.color; document.querySelectorAll('.color-dot').forEach(d=>d.classList.remove('active')); dot.classList.add('active'); }
function handleSigUpload(e) {
    const file=e.target.files[0]; if(!file)return;
    const r=new FileReader();
    r.onload=ev=>{ uploadedSigData=ev.target.result;
        document.querySelector('.sig-upload-area').innerHTML=`<img src="${uploadedSigData}" style="max-height:170px;max-width:100%;object-fit:contain;border-radius:6px">`;
    };
    r.readAsDataURL(file);
}
function applySig() {
    let data;
    if(currentSigTab==='upload'){ if(!uploadedSigData){alert('Pilih file terlebih dahulu.');return;} data=uploadedSigData; }
    else {
        const c=document.getElementById('sigCanvas'),ctx=c.getContext('2d');
        const d=ctx.getImageData(0,0,c.width,c.height).data;
        if(d.every((v,i)=>(i%4===3)?true:v===255)){alert('Gambar tanda tangan Anda terlebih dahulu.');return;}
        data=c.toDataURL('image/png');
    }
    applySigData(data); triggerAutoSave(); closeSigModal();
}
function applySigData(data) { document.getElementById('sigPreview').src=data; document.getElementById('signatureZone').classList.add('has-sig'); }
function clearSig(e) {
    if(e) e.stopPropagation();
    document.getElementById('sigPreview').src='';
    document.getElementById('signatureZone').classList.remove('has-sig');
    localStorage.removeItem('ls_sig');
}

const IC_LAMP_DEFAULTS = [
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
let icLampItems = [];

function icInitLampiran() {
    // Ambil lampiran yang sedang ada di surat
    const current = [...document.querySelectorAll('#attachmentGrid .lamp-editable')].map(e => e.innerText.trim());
    // Gabungkan: defaults + item custom yang belum ada di defaults
    const defaultTexts = IC_LAMP_DEFAULTS.map(d => d.text);
    icLampItems = IC_LAMP_DEFAULTS.map(d => ({
        text: d.text,
        checked: current.length > 0 ? current.includes(d.text) : d.checked,
        custom: false
    }));
    // Tambahkan item custom dari surat yang tidak ada di defaults
    current.forEach(t => {
        if (!defaultTexts.includes(t)) icLampItems.push({ text: t, checked: true, custom: true });
    });
    icRenderLampiran();
}

function icRenderLampiran() {
    const container = document.getElementById('ic_lamp_list');
    container.innerHTML = '';
    icLampItems.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = 'ic-lamp-item' + (item.custom ? ' custom-item' : '');
        div.innerHTML = `
            <input type="checkbox" id="ic_lamp_${i}" ${item.checked ? 'checked' : ''} onchange="icLampItems[${i}].checked=this.checked">
            <label for="ic_lamp_${i}" style="cursor:pointer;flex:1">${item.text}</label>
            ${item.custom ? `<span class="ic-lamp-remove" onclick="icRemoveLamp(${i})"><i class="fas fa-times"></i></span>` : ''}
        `;
        container.appendChild(div);
    });
}

function icAddCustomLamp() {
    const input = document.getElementById('ic_lamp_custom');
    const text = input.value.trim();
    if (!text) return;
    icLampItems.push({ text: text.endsWith('.') ? text : text + '.', checked: true, custom: true });
    input.value = '';
    icRenderLampiran();
}

function icRemoveLamp(i) {
    icLampItems.splice(i, 1);
    icRenderLampiran();
}

// ─── ISI CEPAT ───────────────────────────────────────────────────────────────
let icDateMode = 'today';

function openIsiCepat() {
    // Pre-fill dengan data yang sudah ada di surat
    const get = key => document.querySelector(`.editable[data-key="${key}"]`)?.innerText.trim() || '';
    document.getElementById('ic_nama').value        = get('nama');
    document.getElementById('ic_ttl').value         = get('ttl');
    document.getElementById('ic_alamat').value      = get('alamat');
    document.getElementById('ic_pendidikan').value  = get('pendidikan');
    document.getElementById('ic_telepon').value     = get('telepon');
    document.getElementById('ic_email').value       = get('email');
    document.getElementById('ic_kota').value        = get('kota');
    // Set tanggal default hari ini
    const today = new Date();
    document.getElementById('ic_tgl_info').value = today.toISOString().slice(0,10);
    document.getElementById('ic_date_custom_val').value = today.toISOString().slice(0,10);
    setDateMode('today');
    icInitLampiran();
    icPreloadCvSections();
    document.getElementById('isiCepatModal').classList.add('active');
}
function closeIsiCepat() { document.getElementById('isiCepatModal').classList.remove('active'); }

function setDateMode(mode) {
    icDateMode = mode;
    ['today','tomorrow','custom'].forEach(m => document.getElementById('ic_date_'+m).classList.toggle('active', m===mode));
    document.getElementById('ic_date_custom_val').style.display = mode==='custom' ? 'block' : 'none';
}

function toggleTanggalInfo() {
    const sumber = document.getElementById('ic_sumber').value;
    const hide   = ['rekomendasi dari kenalan','portal lowongan kerja online','iklan di media sosial'];
    document.getElementById('ic_tgl_wrap').style.opacity = hide.includes(sumber) ? '0.35' : '1';
}

function icFormatTanggal(date) {
    return date.toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
}

function applyIsiCepat() {
    const val = id => document.getElementById(id).value.trim();

    const nama       = val('ic_nama');
    const ttl        = val('ic_ttl');
    const jk         = document.getElementById('ic_jk').value;
    const alamat     = val('ic_alamat');
    const pendidikan = val('ic_pendidikan');
    const agama      = document.getElementById('ic_agama').value;
    const status     = document.getElementById('ic_status').value;
    const telepon    = val('ic_telepon');
    const email      = val('ic_email');
    const pt         = val('ic_pt');
    const lokasi     = val('ic_lokasi') || 'Di Tempat';
    const posisi     = val('ic_posisi');
    const kota       = val('ic_kota');
    const sumber     = document.getElementById('ic_sumber').value;

    // Tanggal surat
    let suratDate = new Date();
    if (icDateMode === 'tomorrow') suratDate.setDate(suratDate.getDate() + 1);
    else if (icDateMode === 'custom') {
        const cv = val('ic_date_custom_val');
        if (cv) suratDate = new Date(cv + 'T00:00:00');
    }

    // Tanggal info lowongan
    const tglInfoVal = val('ic_tgl_info');
    const tglInfo    = tglInfoVal ? new Date(tglInfoVal + 'T00:00:00') : new Date();
    const tglInfoStr = icFormatTanggal(tglInfo);

    // Paragraf pembuka berdasarkan sumber
    const hidesDate = ['rekomendasi dari kenalan','portal lowongan kerja online','iklan di media sosial'];
    let paraOpen;
    if (sumber === 'rekomendasi dari kenalan') {
        paraOpen = `Berdasarkan informasi yang saya dapatkan dari kenalan, bahwa ${pt} sedang membutuhkan pekerja tambahan pada bagian ${posisi}.`;
    } else if (hidesDate.includes(sumber)) {
        paraOpen = `Berdasarkan informasi yang saya dapatkan melalui ${sumber}, bahwa ${pt} sedang membutuhkan pekerja tambahan pada bagian ${posisi}.`;
    } else {
        paraOpen = `Berdasarkan informasi yang saya dapatkan dari ${sumber} pada tanggal ${tglInfoStr}, bahwa ${pt} sedang membutuhkan pekerja tambahan pada bagian ${posisi}.`;
    }

    const paraNiat = `Sehubungan dengan itu, melalui surat ini saya bermaksud melamar pekerjaan di perusahaan yang Bapak/Ibu pimpin sebagai <strong>${posisi}</strong>.`;

    // Set semua field editable
    const set = (key, val) => {
        const el = document.querySelector(`.editable[data-key="${key}"]`);
        if (el) { el.innerHTML = val; localStorage.setItem('ls_'+key, el.innerText); }
    };
    if (nama)       set('nama', nama);
    if (ttl)        set('ttl', ttl);
    set('jk', jk);
    if (alamat)     set('alamat', alamat);
    if (pendidikan) set('pendidikan', pendidikan);
    set('agama', agama);
    set('status', status);
    if (telepon)    set('telepon', telepon);
    if (email)      set('email', email);
    if (kota)       set('kota', kota);
    if (pt)         set('tujuan_nama', 'HRD ' + pt);
    if (lokasi)     set('tujuan_lokasi', lokasi);
    if (paraOpen)   set('paragraf_buka', paraOpen);
    if (posisi && pt) set('paragraf_niat', paraNiat);
    if (nama)       set('ttd_nama', nama);

    // Tanggal surat
    const dateEl = document.getElementById('autoDate');
    if (dateEl) dateEl.textContent = icFormatTanggal(suratDate);

    // Terapkan lampiran
    const selectedLamp = icLampItems.filter(i => i.checked).map(i => i.text);
    if (selectedLamp.length > 0) renderAttachments(selectedLamp);

    // Sinkronisasi ke CV
    const cvSet = (key, val) => {
        const el = document.querySelector(`.cv-editable[data-cvkey="${key}"]`);
        if (el && val) { el.innerText = val; localStorage.setItem('ls_' + key, val); }
    };
    if (nama)       cvSet('cv_nama', nama);
    if (posisi)     cvSet('cv_posisi', posisi);
    if (telepon)    cvSet('cv_telepon', telepon);
    if (email)      cvSet('cv_email', email);
    if (alamat)     cvSet('cv_alamat', alamat);
    if (ttl)        cvSet('cv_ttl', ttl);
    cvSet('cv_jk', jk);
    cvSet('cv_agama', agama);
    cvSet('cv_status', status);

    // Tentang Saya CV
    const tentang = document.getElementById('ic_cv_tentang').value.trim();
    if (tentang) {
        const tentangEl = document.querySelector('.cv-editable[data-cvkey="cv_tentang"]');
        if (tentangEl) { tentangEl.innerText = tentang; localStorage.setItem('ls_cv_tentang', tentang); }
    }

    // Pendidikan dari Isi Cepat
    const eduRows = document.querySelectorAll('#ic_edu_list .ic-edu-row');
    if (eduRows.length > 0) {
        document.getElementById('cv-edu-list').innerHTML = '';
        eduRows.forEach(row => {
            cvAddEdu({
                sekolah: row.querySelector('.ic-edu-sekolah')?.value || '',
                jurusan: row.querySelector('.ic-edu-jurusan')?.value || '',
                tahun:   row.querySelector('.ic-edu-tahun')?.value   || ''
            });
        });
    }

    // Pengalaman dari Isi Cepat
    const expRows = document.querySelectorAll('#ic_exp_list .ic-exp-row');
    if (expRows.length > 0) {
        document.getElementById('cv-exp-list').innerHTML = '';
        expRows.forEach(row => {
            cvAddExp({
                posisi:      row.querySelector('.ic-exp-posisi')?.value     || '',
                perusahaan:  row.querySelector('.ic-exp-perusahaan')?.value || '',
                periode:     row.querySelector('.ic-exp-periode')?.value    || '',
                desc:        row.querySelector('.ic-exp-desc')?.value       || ''
            });
        });
    }

    closeIsiCepat();
    scheduleAutoFit();
    triggerAutoSave();
}

// ─── ISI CEPAT — INIT EDU/EXP dari CV yang sudah ada ────────────────────────
function icPreloadCvSections() {
    // Tentang
    const tentangEl = document.querySelector('.cv-editable[data-cvkey="cv_tentang"]');
    if (tentangEl) document.getElementById('ic_cv_tentang').value = tentangEl.innerText.trim();

    // Pendidikan
    const eduList = document.getElementById('ic_edu_list');
    eduList.innerHTML = '';
    document.querySelectorAll('#cv-edu-list .cv-edu-item').forEach(item => {
        const spans = item.querySelectorAll('.cv-editable');
        icAddEduRow({ sekolah: spans[0]?.innerText, jurusan: spans[1]?.innerText, tahun: spans[2]?.innerText });
    });
    if (eduList.children.length === 0) icAddEduRow();

    // Pengalaman
    const expList = document.getElementById('ic_exp_list');
    expList.innerHTML = '';
    document.querySelectorAll('#cv-exp-list .cv-exp-item').forEach(item => {
        const spans = item.querySelectorAll('.cv-editable');
        icAddExpRow({ posisi: spans[0]?.innerText, perusahaan: spans[1]?.innerText, periode: spans[2]?.innerText, desc: spans[3]?.innerText });
    });
    if (expList.children.length === 0) icAddExpRow();
}


// ─── ISI CEPAT — TAMBAH BARIS EDU & EXP ─────────────────────────────────────
function icAddEduRow(data = {}) {
    const list = document.getElementById('ic_edu_list');
    const row  = document.createElement('div');
    row.className = 'ic-edu-row';
    row.innerHTML = `
        <span class="ic-row-remove" onclick="this.parentElement.remove()"><i class="fas fa-times-circle"></i></span>
        <div class="ic-row-grid">
            <div class="full">
                <label class="ic-label">Nama Sekolah / Institusi</label>
                <input class="ic-input ic-edu-sekolah" type="text" placeholder="Contoh: SMK N1 Semarang" value="${(data.sekolah||'').replace(/"/g,'&quot;')}">
            </div>
            <div>
                <label class="ic-label">Jurusan / Program Studi</label>
                <input class="ic-input ic-edu-jurusan" type="text" placeholder="Contoh: Teknik Mesin" value="${(data.jurusan||'').replace(/"/g,'&quot;')}">
            </div>
            <div>
                <label class="ic-label">Tahun</label>
                <input class="ic-input ic-edu-tahun" type="text" placeholder="Contoh: 2015 – 2018" value="${(data.tahun||'').replace(/"/g,'&quot;')}">
            </div>
        </div>
    `;
    list.appendChild(row);
}

function icAddExpRow(data = {}) {
    const list = document.getElementById('ic_exp_list');
    const row  = document.createElement('div');
    row.className = 'ic-exp-row';
    row.innerHTML = `
        <span class="ic-row-remove" onclick="this.parentElement.remove()"><i class="fas fa-times-circle"></i></span>
        <div class="ic-row-grid">
            <div>
                <label class="ic-label">Posisi / Jabatan</label>
                <input class="ic-input ic-exp-posisi" type="text" placeholder="Contoh: Quality Control" value="${(data.posisi||'').replace(/"/g,'&quot;')}">
            </div>
            <div>
                <label class="ic-label">Nama Perusahaan</label>
                <input class="ic-input ic-exp-perusahaan" type="text" placeholder="Contoh: PT. Kayu Kapur" value="${(data.perusahaan||'').replace(/"/g,'&quot;')}">
            </div>
            <div>
                <label class="ic-label">Periode</label>
                <input class="ic-input ic-exp-periode" type="text" placeholder="Jan 2020 – Des 2022" value="${(data.periode||'').replace(/"/g,'&quot;')}">
            </div>
            <div class="full">
                <label class="ic-label">Deskripsi Singkat</label>
                <input class="ic-input ic-exp-desc" type="text" placeholder="Contoh: Mengontrol kualitas produk sebelum pengiriman." value="${(data.desc||'').replace(/"/g,'&quot;')}">
            </div>
        </div>
    `;
    list.appendChild(row);
}

// ─── UNIFIED PDF ──────────────────────────────────────────────────────────────
async function exportUnifiedPDF() {
    const loader = document.getElementById('pdf-loading');
    loader.classList.add('active');
    document.getElementById('btnExportAll').disabled = true;

    const suratContainer = document.getElementById('editor-container-surat');
    const cvContainer    = document.getElementById('cv-container');
    const wasSurat       = currentTab === 'surat';

    // Sembunyikan semua UI
    document.querySelectorAll('.btn-remove').forEach(b => b.style.display = 'none');
    document.querySelectorAll('.btn-lamp-upload').forEach(b => b.style.display = 'none');
    const btnAdd = document.querySelector('.btn-add-lamp');
    if (btnAdd) btnAdd.style.display = 'none';
    document.querySelectorAll('.editable').forEach(e => { e.style.color = 'black'; e.style.borderBottom = 'none'; });
    const sigZone = document.getElementById('signatureZone');
    const sigPlaceholder = sigZone.querySelector('.sig-placeholder');
    const sigClear = sigZone.querySelector('.sig-clear');
    const hasSig   = sigZone.classList.contains('has-sig');
    sigZone.style.border = 'none'; sigZone.style.background = 'transparent';
    if (!hasSig && sigPlaceholder) sigPlaceholder.style.display = 'none';
    if (sigClear) sigClear.style.display = 'none';
    frame.style.border = 'none';
    frame.style.setProperty('--fill-pct', '0%');
    document.querySelectorAll('.cv-add-btn,.cv-remove-btn').forEach(b => b.style.display = 'none');
    const photoClear = document.getElementById('cv-photo-clear');
    photoClear.style.display = 'none';
    const photoZone = document.getElementById('cv-photo-zone');
    photoZone.style.cursor = 'default';
    const hasPhoto = document.getElementById('cv-photo-img').style.display !== 'none';
    if (!hasPhoto) { photoZone.style.border = 'none'; photoZone.style.background = 'none'; }

    const hideStyle = document.createElement('style');
    hideStyle.id = 'unified-pdf-style';
    hideStyle.textContent = '#paperFrame::after,#cvFrame::after{display:none!important}.cv-editable{border-bottom:none!important}';
    document.head.appendChild(hideStyle);

    // Tampilkan keduanya sementara
    suratContainer.style.display = 'flex';
    cvContainer.style.display    = 'flex';

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        // Halaman 1: Surat
        setProgress('Halaman 1: Surat Lamaran...');
        const s1 = await elementToJpeg(frame, { windowWidth: 794 });
        pdf.addImage(s1.dataUrl, 'JPEG', 0, 0, 210, 297);

        // Halaman 2: CV
        setProgress('Halaman 2: CV...');
        pdf.addPage();
        const cvFrameEl = document.getElementById('cvFrame');
        const s2 = await elementToJpeg(cvFrameEl);
        const ratio = s2.w / s2.h;
        pdf.addImage(s2.dataUrl, 'JPEG', 0, 0, 210, 210 / ratio);

        // Halaman 3+: Dokumen lampiran yang diupload
        const lampItems = [...document.querySelectorAll('#attachmentGrid li[data-lid]')];
        let docIdx = 0;
        for (const li of lampItems) {
            const lid = li.dataset.lid;
            const doc = lampDocs[lid];
            if (!doc) continue;
            docIdx++;
            const name = li.querySelector('.lamp-editable')?.innerText || doc.name;
            setProgress(`Lampiran ${docIdx}: ${name}...`);
            if (doc.type === 'application/pdf') {
                const images = await pdfToImages(doc.arrayBuffer);
                for (const img of images) await addImagePageToPdf(pdf, img.dataUrl, img.w, img.h, 0);
            } else {
                // dataUrl sudah dirotasi & di-bake saat lampApply — langsung pakai
                await addImagePageToPdf(pdf, doc.dataUrl, 0, 0, 0);
            }
        }

        setProgress('Menyimpan...');
        pdf.save('Lamaran_dan_CV' + (docIdx > 0 ? `_+${docIdx}lampiran` : '') + '.pdf');
    } catch(e) {
        console.error(e); alert('Gagal membuat PDF. Coba lagi.');
    } finally {
        document.querySelectorAll('.btn-remove').forEach(b => b.style.display = '');
        document.querySelectorAll('.btn-lamp-upload').forEach(b => b.style.display = '');
        if (btnAdd) btnAdd.style.display = '';
        document.querySelectorAll('.editable').forEach(e => { e.style.color = ''; e.style.borderBottom = ''; });
        sigZone.style.border = ''; sigZone.style.background = '';
        if (!hasSig && sigPlaceholder) sigPlaceholder.style.display = '';
        if (sigClear) sigClear.style.display = '';
        frame.style.border = '';
        document.querySelectorAll('.cv-add-btn,.cv-remove-btn').forEach(b => b.style.display = '');
        if (hasPhoto) photoClear.style.display = 'block';
        photoZone.style.cursor = 'pointer';
        if (!hasPhoto) { photoZone.style.border = ''; photoZone.style.background = ''; }
        hideStyle.remove();
        suratContainer.style.display = wasSurat ? 'flex' : 'none';
        cvContainer.style.display    = wasSurat ? 'none' : 'flex';
        setProgress('');
        loader.classList.remove('active');
        document.getElementById('btnExportAll').disabled = false;
        setTimeout(() => { autoFit(); autoFitCV(); scalePaper(); }, 50);
    }
}

// ─── TAB SWITCHER ────────────────────────────────────────────────────────────
let currentTab = 'surat';
function switchTab(tab) {
    currentTab = tab;
    const isSurat = tab === 'surat';
    document.getElementById('editor-container-surat').style.display = isSurat ? 'flex' : 'none';
    document.getElementById('cv-container').style.display           = isSurat ? 'none'  : 'flex';
    document.getElementById('fit-status').style.display             = isSurat ? 'flex'  : 'none';
    document.getElementById('cv-fit-status').style.display          = isSurat ? 'none'  : 'flex';
    document.getElementById('tab-surat').style.background = isSurat ? '#c0392b' : 'transparent';
    document.getElementById('tab-surat').style.color      = isSurat ? 'white'   : '#aaa';
    document.getElementById('tab-cv').style.background    = isSurat ? 'transparent' : '#1a2a3a';
    document.getElementById('tab-cv').style.color         = isSurat ? '#aaa'    : 'white';
    // Beri waktu browser render dulu, baru autoFit + scale
    setTimeout(() => {
        if (isSurat) { autoFit(); }
        else { autoFitCV(); }
        scalePaper();
    }, 100);
}

// ─── CV PHOTO ────────────────────────────────────────────────────────────────
function cvClickPhoto() { document.getElementById('cv-photo-input').click(); }
function cvLoadPhoto(e) {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
        document.getElementById('cv-photo-img').src = ev.target.result;
        document.getElementById('cv-photo-img').style.display = 'block';
        document.getElementById('cv-photo-placeholder').style.display = 'none';
        document.getElementById('cv-photo-clear').style.display = 'block';
        localStorage.setItem('ls_cv_photo', ev.target.result);
    };
    r.readAsDataURL(file);
}
function cvClearPhoto(e) {
    e.stopPropagation();
    document.getElementById('cv-photo-img').src = '';
    document.getElementById('cv-photo-img').style.display = 'none';
    document.getElementById('cv-photo-placeholder').style.display = 'flex';
    document.getElementById('cv-photo-clear').style.display = 'none';
    localStorage.removeItem('ls_cv_photo');
}

// ─── CV PENDIDIKAN ───────────────────────────────────────────────────────────
function cvAddEdu(data = {}) {
    const list = document.getElementById('cv-edu-list');
    const div  = document.createElement('div');
    div.className = 'cv-edu-item';
    div.innerHTML = `
        <span class="cv-remove-btn" onclick="this.parentElement.remove();cvSave()"><i class="fas fa-times-circle"></i></span>
        <div class="cv-item-title"><span class="cv-editable" contenteditable="true" style="outline:none">${data.sekolah||'Nama Sekolah / Institusi'}</span></div>
        <div class="cv-item-sub">
            <span class="cv-editable" contenteditable="true" style="outline:none">${data.jurusan||'Jurusan / Program Studi'}</span>
            &nbsp;·&nbsp;
            <span class="cv-editable" contenteditable="true" style="outline:none">${data.tahun||'Tahun Masuk – Tahun Lulus'}</span>
        </div>
    `;
    div.querySelectorAll('.cv-editable').forEach(el => el.addEventListener('input', () => { cvSave(); scheduleAutoFitCV(); }));
    list.appendChild(div);
    cvSave();
}

// ─── CV PENGALAMAN KERJA ─────────────────────────────────────────────────────
function cvAddExp(data = {}) {
    const list = document.getElementById('cv-exp-list');
    const div  = document.createElement('div');
    div.className = 'cv-exp-item';
    div.innerHTML = `
        <span class="cv-remove-btn" onclick="this.parentElement.remove();cvSave()"><i class="fas fa-times-circle"></i></span>
        <div class="cv-item-title"><span class="cv-editable" contenteditable="true" style="outline:none">${data.posisi||'Nama Posisi / Jabatan'}</span></div>
        <div class="cv-item-sub">
            <span class="cv-editable" contenteditable="true" style="outline:none">${data.perusahaan||'Nama Perusahaan'}</span>
            &nbsp;·&nbsp;
            <span class="cv-editable" contenteditable="true" style="outline:none">${data.periode||'Bulan Tahun – Bulan Tahun'}</span>
        </div>
        <div class="cv-item-desc"><span class="cv-editable" contenteditable="true" style="outline:none">${data.desc||'Deskripsikan tanggung jawab dan pencapaian Anda di posisi ini.'}</span></div>
    `;
    div.querySelectorAll('.cv-editable').forEach(el => el.addEventListener('input', () => { cvSave(); scheduleAutoFitCV(); }));
    list.appendChild(div);
    cvSave();
}

// ─── CV SAVE / LOAD ──────────────────────────────────────────────────────────
function cvSave() {
    document.querySelectorAll('.cv-editable[data-cvkey]').forEach(el =>
        localStorage.setItem('ls_' + el.dataset.cvkey, el.innerText));
    // Simpan edu
    const edus = [...document.querySelectorAll('#cv-edu-list .cv-edu-item')].map(item => {
        const spans = item.querySelectorAll('.cv-editable');
        return { sekolah: spans[0]?.innerText, jurusan: spans[1]?.innerText, tahun: spans[2]?.innerText };
    });
    localStorage.setItem('ls_cv_edu', JSON.stringify(edus));
    // Simpan exp
    const exps = [...document.querySelectorAll('#cv-exp-list .cv-exp-item')].map(item => {
        const spans = item.querySelectorAll('.cv-editable');
        return { posisi: spans[0]?.innerText, perusahaan: spans[1]?.innerText, periode: spans[2]?.innerText, desc: spans[3]?.innerText };
    });
    localStorage.setItem('ls_cv_exp', JSON.stringify(exps));
}

function cvLoad() {
    document.querySelectorAll('.cv-editable[data-cvkey]').forEach(el => {
        const s = localStorage.getItem('ls_' + el.dataset.cvkey);
        if (s) el.innerText = s;
    });
    // Load foto
    const photo = localStorage.getItem('ls_cv_photo');
    if (photo) {
        document.getElementById('cv-photo-img').src = photo;
        document.getElementById('cv-photo-img').style.display = 'block';
        document.getElementById('cv-photo-placeholder').style.display = 'none';
        document.getElementById('cv-photo-clear').style.display = 'block';
    }
    // Load edu
    const edus = JSON.parse(localStorage.getItem('ls_cv_edu') || '[]');
    if (edus.length) edus.forEach(d => cvAddEdu(d));
    else cvAddEdu(); // default satu entry
    // Load exp
    const exps = JSON.parse(localStorage.getItem('ls_cv_exp') || '[]');
    if (exps.length) exps.forEach(d => cvAddExp(d));
    else cvAddExp(); // default satu entry
}

// Bind input event pada cv-editable yang statis
function cvBindStatic() {
    document.querySelectorAll('.cv-editable[data-cvkey]').forEach(el =>
        el.addEventListener('input', () => { cvSave(); scheduleAutoFitCV(); }));
}

// ─── CV EXPORT PDF ───────────────────────────────────────────────────────────
async function exportCvPDF() {
    const cvFrame     = document.getElementById('cvFrame');
    const addBtns     = cvFrame.querySelectorAll('.cv-add-btn, .cv-remove-btn');
    const photoZone   = document.getElementById('cv-photo-zone');
    const photoClear  = document.getElementById('cv-photo-clear');
    const loader      = document.getElementById('pdf-loading');

    loader.classList.add('active');
    document.getElementById('btnExportCV').disabled = true;

    addBtns.forEach(b => b.style.display = 'none');
    photoClear.style.display = 'none';
    photoZone.style.cursor = 'default';

    // Hapus border dashed foto jika tidak ada foto
    const hasPhoto = document.getElementById('cv-photo-img').style.display !== 'none';
    if (!hasPhoto) { photoZone.style.border = 'none'; photoZone.style.background = 'none'; }

    // Sembunyikan garis dashed cv-editable
    const hideStyle = document.createElement('style');
    hideStyle.id = 'cv-pdf-style';
    hideStyle.textContent = '.cv-editable { border-bottom: none !important; } #cvFrame::after { display:none!important; }';
    document.head.appendChild(hideStyle);

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
        setProgress('Merender CV...');
        const cvFrame = document.getElementById('cvFrame');
        const { dataUrl, w, h } = await elementToJpeg(cvFrame);
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const ratio = w / h;
        pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 210 / ratio);
        pdf.save('CV.pdf');
    } catch(e) {
        console.error(e); alert('Gagal membuat PDF CV.');
    } finally {
        addBtns.forEach(b => b.style.display = '');
        if (hasPhoto) photoClear.style.display = 'block';
        photoZone.style.cursor = 'pointer';
        if (!hasPhoto) { photoZone.style.border = ''; photoZone.style.background = ''; }
        document.getElementById('cv-pdf-style')?.remove();
        setProgress('');
        loader.classList.remove('active');
        document.getElementById('btnExportCV').disabled = false;
        setTimeout(() => { autoFitCV(); scalePaper(); }, 50);
    }
}

// ─── LAMPIRAN UPLOAD ─────────────────────────────────────────────────────────
let currentLampLid = null, currentLampBtn = null, pendingLampDoc = null;
let lampCurrentRotation = 0; // 0, 90, 180, 270

function openLampModal(lid, btn) {
    currentLampLid = lid;
    currentLampBtn = btn;
    pendingLampDoc = null;
    lampCurrentRotation = 0;
    // Reset UI
    document.getElementById('lamp-preview-area').style.display = 'none';
    document.getElementById('lamp-img-preview-wrap').style.display = 'none';
    document.getElementById('lamp-btn-apply').disabled = true;
    document.getElementById('lamp-btn-apply').style.opacity = '.4';
    document.getElementById('lampFileInput').value = '';
    const existing = lampDocs[lid];
    if (existing) {
        lampCurrentRotation = existing.rotation || 0;
        showLampPreview(existing.name, existing.size, existing.pages);
        // Tampilkan preview gambar jika ada
        if (existing.type !== 'application/pdf' && existing.dataUrl) {
            lampShowImgPreview(existing.dataUrl, lampCurrentRotation);
        }
        document.getElementById('lamp-btn-remove').style.display = '';
        document.getElementById('lamp-btn-apply').disabled = false;
        document.getElementById('lamp-btn-apply').style.opacity = '1';
        pendingLampDoc = existing;
    } else {
        document.getElementById('lamp-btn-remove').style.display = 'none';
    }
    document.getElementById('lampModal').classList.add('active');
}
function closeLampModal() {
    document.getElementById('lampModal').classList.remove('active');
    pendingLampDoc = null;
}
function showLampPreview(name, size, pages) {
    document.getElementById('lamp-preview-area').style.display = 'block';
    document.getElementById('lamp-prev-name').textContent = name;
    document.getElementById('lamp-prev-size').textContent = size ? formatBytes(size) : '';
    document.getElementById('lamp-prev-pages').textContent = pages > 1 ? pages + ' halaman' : '';
}
function formatBytes(b) {
    return b > 1048576 ? (b/1048576).toFixed(1)+' MB' : (b/1024).toFixed(0)+' KB';
}
function lampHandleDrop(e) {
    e.preventDefault();
    document.getElementById('lampDropZone').classList.remove('drag');
    const file = e.dataTransfer.files[0];
    if (file) processLampFile(file);
}
function lampHandleFile(e) {
    const file = e.target.files[0];
    if (file) processLampFile(file);
}
async function processLampFile(file) {
    if (file.size > 15 * 1024 * 1024) { alert('File terlalu besar (maks 15MB)'); return; }
    const applyBtn = document.getElementById('lamp-btn-apply');
    applyBtn.disabled = true; applyBtn.style.opacity = '.4';
    applyBtn.textContent = 'Memproses...';
    lampCurrentRotation = 0;
    try {
        const arrayBuffer = await file.arrayBuffer();
        const dataUrl = await bufferToDataUrl(arrayBuffer, file.type);
        let pages = 1;
        if (file.type === 'application/pdf') {
            try {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                // Gunakan .slice(0) agar arrayBuffer asli tidak ter-transfer/detached oleh PDF.js
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
                pages = pdf.numPages;
            } catch(e) { pages = 1; }
            document.getElementById('lamp-img-preview-wrap').style.display = 'none';
        } else {
            // Gambar: tampilkan preview & cek orientasi
            await lampShowImgPreview(dataUrl, 0);
        }
        pendingLampDoc = { name: file.name, type: file.type, dataUrl, size: file.size, pages, arrayBuffer, rotation: 0 };
        showLampPreview(file.name, file.size, pages);
        document.getElementById('lamp-btn-remove').style.display = '';
        applyBtn.disabled = false; applyBtn.style.opacity = '1';
        applyBtn.innerHTML = '<i class="fas fa-check me-1"></i>Terapkan';
    } catch(e) {
        alert('Gagal memproses file.'); console.error(e);
        applyBtn.innerHTML = '<i class="fas fa-check me-1"></i>Terapkan';
    }
}

// Tampilkan preview gambar pada canvas + deteksi orientasi
function lampShowImgPreview(dataUrl, rotation) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const wrap   = document.getElementById('lamp-img-preview-wrap');
            const canvas = document.getElementById('lamp-img-canvas');
            const badge  = document.getElementById('lamp-orientation-badge');
            const hint   = document.getElementById('lamp-rotate-hint');
            wrap.style.display = 'block';

            const nw = img.naturalWidth;
            const nh = img.naturalHeight;

            // Dimensi setelah rotasi user
            const isSwapped = (rotation === 90 || rotation === 270);
            const rw = isSwapped ? nh : nw;  // lebar setelah rotasi
            const rh = isSwapped ? nw : nh;  // tinggi setelah rotasi
            const isLandscape = rw > rh;

            // Canvas preview (max 360×180)
            const maxW = 360, maxH = 180;
            const scale = Math.min(maxW / rw, maxH / rh);
            canvas.width  = Math.round(rw * scale);
            canvas.height = Math.round(rh * scale);

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(rotation * Math.PI / 180);
            // Gambar asli di-scale sesuai rasio
            const drawW = isSwapped ? Math.round(nh * scale) : Math.round(nw * scale);
            const drawH = isSwapped ? Math.round(nw * scale) : Math.round(nh * scale);
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();

            // Badge orientasi
            badge.style.display = 'inline-block';
            if (isLandscape) {
                badge.style.background = '#ef4444';
                document.getElementById('lamp-orient-text').textContent = '⚠ Landscape – akan otomatis diputar saat ekspor PDF';
                hint.textContent = 'Gambar landscape akan otomatis diputar 90° di PDF. Klik "Putar 90°" jika ingin preview orientasi berbeda.';
            } else {
                badge.style.background = '#22c55e';
                document.getElementById('lamp-orient-text').textContent = '✓ Portrait – sudah siap';
                hint.textContent = 'Orientasi gambar sudah sesuai PDF A4 portrait.';
            }
            resolve();
        };
        img.src = dataUrl;
    });
}

// Putar gambar 90° searah jarum jam
function lampRotate() {
    if (!pendingLampDoc || pendingLampDoc.type === 'application/pdf') return;
    lampCurrentRotation = (lampCurrentRotation + 90) % 360;
    pendingLampDoc.rotation = lampCurrentRotation;
    lampShowImgPreview(pendingLampDoc.dataUrl, lampCurrentRotation);
}
function bufferToDataUrl(buffer, type) {
    return new Promise(resolve => {
        const blob = new Blob([buffer], { type });
        const r = new FileReader();
        r.onload = e => resolve(e.target.result);
        r.readAsDataURL(blob);
    });
}

// Putar dataUrl sebesar derajat tertentu, kembalikan {dataUrl, w, h}
function rotateDataUrl(dataUrl, degrees) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
            const nw = img.naturalWidth;
            const nh = img.naturalHeight;
            const swapped = (degrees === 90 || degrees === 270);
            const cw = swapped ? nh : nw;
            const ch = swapped ? nw : nh;
            const canvas = document.createElement('canvas');
            canvas.width  = cw;
            canvas.height = ch;
            const ctx = canvas.getContext('2d');
            ctx.translate(cw / 2, ch / 2);
            ctx.rotate(degrees * Math.PI / 180);
            ctx.drawImage(img, -nw / 2, -nh / 2, nw, nh);
            resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.92), w: cw, h: ch });
        };
        img.src = dataUrl;
    });
}

// Hitung total rotasi yang diperlukan (rotasi user + auto-rotate jika landscape)
function calcFinalRotation(naturalW, naturalH, userRotation) {
    const swapped    = (userRotation === 90 || userRotation === 270);
    const wAfter     = swapped ? naturalH : naturalW;
    const hAfter     = swapped ? naturalW : naturalH;
    const autoRotate = wAfter > hAfter ? 90 : 0;          // auto CW jika masih landscape
    return (userRotation + autoRotate) % 360;
}

async function lampApply() {
    if (!pendingLampDoc) return;

    if (pendingLampDoc.type !== 'application/pdf') {
        const applyBtn = document.getElementById('lamp-btn-apply');
        applyBtn.textContent = 'Memproses...';
        applyBtn.disabled = true;

        try {
            const img = await new Promise((resolve, reject) => {
                const i = new Image();
                i.onerror = reject;
                i.onload  = () => resolve(i);
                i.src     = pendingLampDoc.dataUrl;
            });

            // Dimensi display (EXIF-corrected oleh browser)
            const dispW = img.naturalWidth;
            const dispH = img.naturalHeight;

            // Hitung total rotasi: rotasi user + auto-rotate jika landscape
            let deg = lampCurrentRotation;
            const sw0 = (deg === 90 || deg === 270);
            const wA  = sw0 ? dispH : dispW;
            const hA  = sw0 ? dispW : dispH;
            if (wA > hA) deg = (deg + 90) % 360;

            // Canvas A4 ukuran penuh: 2480×3508px (@300dpi)
            const A4W = 2480, A4H = 3508;
            const canvas = document.createElement('canvas');
            canvas.width  = A4W;
            canvas.height = A4H;
            const ctx = canvas.getContext('2d');

            // Background putih
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, A4W, A4H);

            // Gambar setelah rotasi → dimensi efektif
            const swapped = (deg === 90 || deg === 270);

            // STRETCH penuh ke A4 — tidak ada gap, tidak ada crop
            ctx.save();
            ctx.translate(A4W / 2, A4H / 2);
            ctx.rotate(deg * Math.PI / 180);
            const stretchW = swapped ? A4H : A4W;
            const stretchH = swapped ? A4W : A4H;
            ctx.drawImage(img, -stretchW / 2, -stretchH / 2, stretchW, stretchH);
            ctx.restore();

            pendingLampDoc.dataUrl  = canvas.toDataURL('image/jpeg', 0.90);
            pendingLampDoc.rotation = 0;

        } catch(e) {
            console.error('Rotate/render error:', e);
        } finally {
            applyBtn.innerHTML = '<i class="fas fa-check me-1"></i>Terapkan';
            applyBtn.disabled = false;
        }
    }

    lampDocs[currentLampLid] = pendingLampDoc;
    currentLampBtn.classList.add('has-file');
    currentLampBtn.title = 'File terlampir: ' + pendingLampDoc.name + ' — klik untuk ganti/hapus';
    closeLampModal();
}
function lampRemoveDoc() {
    delete lampDocs[currentLampLid];
    if (currentLampBtn) { currentLampBtn.classList.remove('has-file'); currentLampBtn.title = 'Upload dokumen'; }
    closeLampModal();
}

// ─── KOMPRESI HELPER ─────────────────────────────────────────────────────────
// Scale 2 + quality 0.72 → ~60-70% lebih kecil dari scale 3 + quality 1.0
const PDF_SCALE   = 2;
const PDF_QUALITY = 0.72;

async function elementToJpeg(el) {
    // Strategi: lepas elemen dari wrapper (yang punya transform),
    // tempel langsung ke body tanpa transform, capture, kembalikan.
    const parent      = el.parentElement;
    const nextSibling = el.nextSibling;

    // Simpan style asli
    const savedStyle = el.getAttribute('style') || '';

    // Tempel ke body dengan style bersih
    el.style.cssText = [
        'position:fixed',
        'top:0',
        'left:-9999px',
        'width:794px',
        'transform:none',
        'z-index:99999',
        'box-shadow:none',
        'border:none',
        'margin:0',
        'overflow:visible',
    ].join(';');
    document.body.appendChild(el);

    await new Promise(r => setTimeout(r, 80));
    await new Promise(r => requestAnimationFrame(r));

    let canvas;
    try {
        canvas = await html2canvas(el, {
            scale: PDF_SCALE,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
        });
    } finally {
        // Kembalikan ke posisi semula
        el.setAttribute('style', savedStyle);
        if (nextSibling) parent.insertBefore(el, nextSibling);
        else parent.appendChild(el);
        requestAnimationFrame(scalePaper);
    }

    return {
        dataUrl: canvas.toDataURL('image/jpeg', PDF_QUALITY),
        w: canvas.width,
        h: canvas.height,
    };
}

async function compressImageDataUrl(dataUrl, maxPx = 1754, quality = PDF_QUALITY) {
    // 1754px ≈ A4 lebar @150dpi — cukup untuk cetak dokumen
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const ratio = Math.min(1, maxPx / Math.max(img.width, img.height));
            const w = Math.round(img.width * ratio), h = Math.round(img.height * ratio);
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve({ dataUrl: c.toDataURL('image/jpeg', quality), w, h });
        };
        img.src = dataUrl;
    });
}

async function pdfToImages(arrayBuffer, quality = PDF_QUALITY) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('ArrayBuffer lampiran kosong/detached. Upload ulang file lampiran.');
    }
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
    const images = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const vp   = page.getViewport({ scale: 1.5 }); // 1.5 = ~113dpi cukup tajam
        const c    = document.createElement('canvas');
        c.width = vp.width; c.height = vp.height;
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        images.push({ dataUrl: c.toDataURL('image/jpeg', quality), w: c.width, h: c.height });
    }
    return images;
}

async function addImagePageToPdf(pdf, dataUrl, wPx, hPx, rotation) {
    pdf.addPage();
    // Stretch penuh ke A4 — tidak ada gap, tidak ada crop
    // Rotasi sudah diterapkan saat lampApply()
    pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297);
}

function setProgress(msg) {
    const el = document.getElementById('pdf-progress');
    if (el) el.textContent = msg;
}

// ─── AUTO-FIT CV ─────────────────────────────────────────────────────────────
const CV_MIN_FONT = 6, CV_MAX_FONT = 11.5, CV_STEP = 0.2;
let cvAutoFitTimer = null;

function setCvFont(px) {
    document.documentElement.style.setProperty('--cv-font-size', px + 'px');
}
function autoFitCV() {
    const cvEl = document.getElementById('cvFrame');
    if (!cvEl) return;
    const A4_H = 1123; // px

    // Sembunyikan tombol tambah/hapus agar tidak mempengaruhi tinggi
    const addBtns = cvEl.querySelectorAll('.cv-add-btn, .cv-remove-btn');
    addBtns.forEach(b => b.style.visibility = 'hidden');

    setCvFont(CV_MIN_FONT);
    if (cvEl.scrollHeight > A4_H) { updateCvFitUI(CV_MIN_FONT, cvEl.scrollHeight, A4_H); addBtns.forEach(b => b.style.visibility=''); return; }
    setCvFont(CV_MAX_FONT);
    if (cvEl.scrollHeight <= A4_H) { updateCvFitUI(CV_MAX_FONT, cvEl.scrollHeight, A4_H); addBtns.forEach(b => b.style.visibility=''); return; }

    let lo = CV_MIN_FONT, hi = CV_MAX_FONT;
    while (hi - lo > CV_STEP) {
        const mid = (lo + hi) / 2;
        setCvFont(mid);
        cvEl.scrollHeight <= A4_H ? (lo = mid) : (hi = mid);
    }
    const best = Math.round(lo * 5) / 5;
    setCvFont(best);
    updateCvFitUI(best, cvEl.scrollHeight, A4_H);
    addBtns.forEach(b => b.style.visibility = '');
    requestAnimationFrame(scalePaper);
}

function updateCvFitUI(px, contentH, maxH) {
    const pt   = Math.round((px * 72 / 96) * 10) / 10;
    const pct  = Math.min(100, Math.round((contentH / maxH) * 100));
    const over = contentH > maxH;
    const bar  = document.getElementById('cv-fit-bar');
    if (bar) {
        bar.style.width      = pct + '%';
        bar.style.background = over ? '#ef4444' : px >= CV_MAX_FONT ? '#facc15' : '#22c55e';
    }
    const lbl = document.getElementById('cv-fit-label');
    if (lbl) lbl.textContent = pct + '%';
    const fsd = document.getElementById('cv-font-size-display');
    if (fsd) fsd.textContent = pt.toFixed(1).replace(/\.0$/, '') + 'pt';
}

function scheduleAutoFitCV() {
    clearTimeout(cvAutoFitTimer);
    cvAutoFitTimer = setTimeout(autoFitCV, 280);
}

// ─── PDF DROPDOWN MENU ───────────────────────────────────────────────────────
function togglePdfMenu() {
    const drop = document.getElementById('pdfMenuDrop');
    drop.style.display = drop.style.display === 'none' ? 'block' : 'none';
}
document.addEventListener('click', e => {
    if (!e.target.closest('#btnPdfMenu') && !e.target.closest('#pdfMenuDrop')) {
        const drop = document.getElementById('pdfMenuDrop');
        if (drop) drop.style.display = 'none';
    }
});

// ─── SKALA KERTAS UNTUK MOBILE ───────────────────────────────────────────────
function scalePaper() {
    const A4_W = 794;
    const avail = window.innerWidth - 16;
    const scale = Math.min(1, avail / A4_W);
    const toolbarH = document.querySelector('.toolbar')?.offsetHeight || 50;

    document.querySelectorAll('.editor-container').forEach(el => {
        el.style.marginTop      = (toolbarH + 6) + 'px';
        el.style.padding        = '8px 4px';
        el.style.justifyContent = 'flex-start';
        el.style.alignItems     = 'flex-start';
        el.style.overflow       = 'hidden';
    });

    ['suratWrapper', 'cvWrapper'].forEach(id => {
        const wrapper = document.getElementById(id);
        if (!wrapper) return;
        const paper = wrapper.querySelector('.paper-a4');
        if (!paper) return;

        // Terapkan scale
        wrapper.style.transform       = `scale(${scale})`;
        wrapper.style.transformOrigin = 'top left';
        wrapper.style.width           = A4_W + 'px';
        wrapper.style.display         = 'block';

        // Biarkan tinggi natural agar konten CV (auto-height) tidak terpotong
        // Kompensasi: kurangi tinggi container agar tidak ada blank space
        requestAnimationFrame(() => {
            const naturalH = paper.scrollHeight || paper.offsetHeight;
            wrapper.style.height = naturalH + 'px';
            const container = wrapper.parentElement;
            if (container) {
                container.style.height    = Math.ceil(naturalH * scale + 16) + 'px';
                container.style.minHeight = 'unset';
            }
        });
    });
}

window.addEventListener('resize', scalePaper);

// ─── EVENTS ──────────────────────────────────────────────────────────────────
document.getElementById('penSize').addEventListener('input', function(){ penSize=parseFloat(this.value); document.getElementById('penSizeVal').textContent=penSize+'px'; });
frame.addEventListener('input', () => { scheduleAutoFit(); triggerAutoSave(); });

// ─── BACKEND ENTRYPOINT ─────────────────────────────────────────────────────
window.__LGenInit = function __LGenInit() {
    updateDate();
    loadSavedData();
    autoFit();
    scalePaper();
    cvLoad();
    cvBindStatic();
    scheduleAutoFitCV();
};
