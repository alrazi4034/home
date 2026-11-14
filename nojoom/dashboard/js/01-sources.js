/* 01-sources.js — ربط مصادر البيانات وقراءتها (للقراءة فقط)
   - الملف المركزي (Excel) — أو نسخة البوابة المحفوظة على الجهاز
   - ملف نموذج الغياب (Excel من Microsoft Forms)
   - مجلد ملفات المعلمين (JSON من نجوم مدرستي، يُقرأ مع المجلدات الفرعية)
   يُحفظ الربط في IndexedDB فيُقرأ تلقائياً في كل مرة (مع طلب إذن القراءة عند الحاجة). */

const DSH_DB = 'nojoomDashboardDB', DSH_STORE = 'handles';
const SRC = { central: null, form: null, folder: null };              // مقابض الملفات
const RAW = { central: null, form: null, files: [], names: {}, errors: [] }; // البيانات المقروءة
const FALLBACK = { central: null, form: null, folder: null };         // ملفات مختارة بدون ربط دائم

function dshFsOk() { return typeof window.showOpenFilePicker === 'function' && typeof window.showDirectoryPicker === 'function'; }

function dshDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DSH_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(DSH_STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function hIdb(op, key, val) {
  const db = await dshDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(DSH_STORE, op === 'get' ? 'readonly' : 'readwrite');
    const st = tx.objectStore(DSH_STORE);
    const q = op === 'get' ? st.get(key) : op === 'put' ? st.put(val, key) : st.delete(key);
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}

async function loadHandles() {
  if (!window.indexedDB) return;
  for (const k of ['central', 'form', 'folder']) {
    try { SRC[k] = await hIdb('get', k) || null; } catch (e) { SRC[k] = null; }
  }
}

async function linkSource(kind) {
  if (!dshFsOk()) { document.getElementById('fb-' + kind).click(); return; }
  try {
    let h;
    if (kind === 'folder') h = await window.showDirectoryPicker({ mode: 'read' });
    else [h] = await window.showOpenFilePicker({ multiple: false, types: [{ description: 'Excel', accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'] } }] });
    SRC[kind] = h;
    FALLBACK[kind] = null;
    await hIdb('put', kind, h);
    toast('تم الربط: ' + h.name);
    await refreshAll(true);
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    alert('تعذّر الربط:\n' + (e.message || e));
  }
}

// متصفح لا يدعم الربط الدائم: اختيار ملف/مجلد لهذه الجلسة فقط
function fallbackPicked(kind, input) {
  FALLBACK[kind] = kind === 'folder' ? Array.from(input.files) : input.files[0] || null;
  input.value = '';
  refreshAll(false);
}

async function ensurePerm(h, interactive) {
  let p = await h.queryPermission({ mode: 'read' });
  if (p !== 'granted' && interactive) p = await h.requestPermission({ mode: 'read' });
  return p === 'granted';
}

function xlsxFromBuffer(buf) { return XLSX.read(buf, { type: 'array', cellDates: false }); }

async function readJsonFiles(dir, prefix, out) {
  for await (const [name, h] of dir.entries()) {
    if (h.kind === 'directory') await readJsonFiles(h, prefix + name + '/', out);
    else if (/\.json$/i.test(name)) {
      try {
        const f = await h.getFile();
        out.push({ path: prefix + name, modified: f.lastModified, text: await f.text() });
      } catch (e) { RAW.errors.push('تعذّرت قراءة ' + prefix + name); }
    }
  }
}

// قراءة كل المصادر. interactive = بعد ضغطة زر (يمكن طلب الإذن)
async function readSources(interactive) {
  const status = {};
  RAW.errors = [];
  // الملف المركزي
  RAW.central = null;
  try {
    if (FALLBACK.central) {
      RAW.central = xlsxFromBuffer(await FALLBACK.central.arrayBuffer());
      RAW.names.central = FALLBACK.central.name; status.central = 'ok';
    } else if (SRC.central) {
      if (await ensurePerm(SRC.central, interactive)) {
        const f = await SRC.central.getFile();
        RAW.central = xlsxFromBuffer(await f.arrayBuffer());
        RAW.names.central = f.name + ' — ' + new Date(f.lastModified).toLocaleString('ar'); status.central = 'ok';
      } else status.central = 'locked';
    } else if (localStorage.getItem('raziSchoolDataXlsx')) {
      const dataUrl = localStorage.getItem('raziSchoolDataXlsx');
      const bin = atob(dataUrl.split(',')[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      RAW.central = xlsxFromBuffer(bytes.buffer);
      RAW.names.central = (localStorage.getItem('raziSchoolDataFilename') || 'بيانات البوابة') + ' (نسخة البوابة على هذا الجهاز)';
      status.central = 'ok';
    } else status.central = 'none';
  } catch (e) { status.central = 'error'; RAW.errors.push('الملف المركزي: ' + e.message); }

  // نموذج الغياب
  RAW.form = null;
  try {
    if (FALLBACK.form) {
      RAW.form = xlsxFromBuffer(await FALLBACK.form.arrayBuffer());
      RAW.names.form = FALLBACK.form.name; status.form = 'ok';
    } else if (SRC.form) {
      if (await ensurePerm(SRC.form, interactive)) {
        const f = await SRC.form.getFile();
        RAW.form = xlsxFromBuffer(await f.arrayBuffer());
        RAW.names.form = f.name + ' — ' + new Date(f.lastModified).toLocaleString('ar'); status.form = 'ok';
      } else status.form = 'locked';
    } else status.form = 'none';
  } catch (e) { status.form = 'error'; RAW.errors.push('نموذج الغياب: ' + e.message); }

  // مجلد ملفات المعلمين
  RAW.files = [];
  try {
    if (FALLBACK.folder) {
      for (const f of FALLBACK.folder) if (/\.json$/i.test(f.name))
        RAW.files.push({ path: f.webkitRelativePath || f.name, modified: f.lastModified, text: await f.text() });
      RAW.names.folder = RAW.files.length + ' ملف'; status.folder = 'ok';
    } else if (SRC.folder) {
      if (await ensurePerm(SRC.folder, interactive)) {
        await readJsonFiles(SRC.folder, '', RAW.files);
        RAW.names.folder = SRC.folder.name + ' — ' + RAW.files.length + ' ملف JSON'; status.folder = 'ok';
      } else status.folder = 'locked';
    } else status.folder = 'none';
  } catch (e) { status.folder = 'error'; RAW.errors.push('مجلد المعلمين: ' + e.message); }

  renderSourceStatus(status);
  return status;
}

function renderSourceStatus(status) {
  const txt = {
    none: 'غير مرتبط — اضغط «ربط»',
    locked: '🔓 يحتاج إذن قراءة — اضغط «🔄 تحديث» أو «ربط»',
    error: '❗ تعذّرت القراءة'
  };
  ['central', 'form', 'folder'].forEach(k => {
    const card = document.getElementById('src-' + k);
    const st = status[k];
    card.classList.toggle('ok', st === 'ok');
    card.classList.toggle('locked', st === 'locked');
    document.getElementById('st-' + k).textContent = st === 'ok' ? '✅ ' + (RAW.names[k] || '') : txt[st] || '';
  });
}
