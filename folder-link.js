/* shared/folder-link.js — ربط مجلدات OneDrive (مشترك بين البوابة ونجوم مدرستي ولوحة التحكم وبرنامج الغياب)
   ---------------------------------------------------------------------------------------------
   هيكل المجلدات المقترح على OneDrive:
     📁 بيانات المدرسة      ← مشترك مع كل المعلمين «عرض فقط» — فيه «بيانات المدرسة.xlsx»
     📁 <اسم المعلم>         ← مشترك مع هذا المعلم وحده «تعديل» — فيه ملف نجوم مدرستي الخاص به
     📁 <اسم معلم آخر> ...
   - المعلم يربط مجلدين: «بيانات المدرسة» + مجلده.
   - الإدارة تربط «بيانات المدرسة» + المجلد الذي يضم مجلدات المعلمين (أو مجلدات المعلمين نفسها).
   البرامج كلها على نفس الموقع، فالربط يتم مرة واحدة ويُستخدم في كل البرامج. */

const FL = (() => {
  const DB = 'raziFolderLinks', ST = 'h';
  function db() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(ST);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function idb(op, key, val) {
    const m = window.__FL_MEM;                 // للاختبار فقط
    if (m) return op === 'get' ? m[key] : op === 'put' ? (m[key] = val) : delete m[key];
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction(ST, op === 'get' ? 'readonly' : 'readwrite');
      const s = tx.objectStore(ST);
      const q = op === 'get' ? s.get(key) : op === 'put' ? s.put(val, key) : s.delete(key);
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
  }
  const dropSupported = () => typeof DataTransferItem !== 'undefined' && 'getAsFileSystemHandle' in DataTransferItem.prototype;
  const supported = () => typeof window.showDirectoryPicker === 'function' || typeof window.showOpenFilePicker === 'function' || dropSupported();
  const norm = t => String(t || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const normEmail = e => String(e || '').trim().toLowerCase().replace(/^tid-/, '');
  const safeName = n => String(n || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();

  /* ---------- المجلدات ---------- */
  async function folders() { try { return (await idb('get', 'folders')) || []; } catch (e) { return []; } }
  async function saveFolders(list) { await idb('put', 'folders', list); }
  async function addHandle(h) {
    const list = await folders();
    for (const x of list) { try { if (await x.isSameEntry(h)) return list; } catch (e) {} }
    list.push(h); await saveFolders(list); return list;
  }
  async function add() {                       // يفتح اختيار مجلد (يمكن تكراره لأكثر من مجلد)
    let h;
    try {
      if (typeof window.showDirectoryPicker !== 'function') throw Object.assign(new Error('no picker'), { name: 'AbortError' });
      h = await window.showDirectoryPicker({ id: 'razi-folders', mode: 'readwrite' });   // يتذكر آخر مكان (مجلد OneDrive)
    } catch (e) {
      if (!(e && e.name === 'AbortError') || !dropSupported()) throw e;
      const hs = await dropDialog('dir');      // بعض الأجهزة ترفض نافذة الاختيار ⇐ السحب والإفلات
      let list = await folders(); for (const x of hs) list = await addHandle(x); return list;
    }
    return addHandle(h);
  }
  /* ---------- السحب والإفلات (بديل نافذة الاختيار في الأجهزة التي ترفضها) ---------- */
  function dropHandles(e) {                    // يجب استدعاؤها داخل حدث drop مباشرة (قبل أي await)
    const ps = [...(e.dataTransfer && e.dataTransfer.items || [])].filter(i => i.kind === 'file').map(i => i.getAsFileSystemHandle());
    return Promise.all(ps).then(a => a.filter(Boolean));
  }
  // kind: 'dir' | 'xlsx' | 'json' — يعيد مصفوفة handles بعد منح إذن التعديل، أو يرفض بـ AbortError (dropCancelled)
  function dropDialog(kind) {
    return new Promise((resolve, reject) => {
      const old = document.getElementById('flDropDlg'); if (old) old.remove();
      const what = kind === 'dir' ? 'المجلد' : kind === 'xlsx' ? 'ملف «بيانات المدرسة» (Excel)' : 'ملفك في نجوم مدرستي (nojoom_data_….json)';
      const ov = document.createElement('div'); ov.id = 'flDropDlg';
      ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(10,12,30,.72);display:flex;align-items:center;justify-content:center;font-family:inherit;direction:rtl';
      ov.innerHTML = `<div style="background:#fff;color:#1f2937;border-radius:16px;max-width:560px;width:92%;padding:20px 22px;box-shadow:0 20px 60px #0006;line-height:1.9">
        <h3 style="margin:0 0 6px">📂 اسحب ${what} وأفلته هنا</h3>
        <div style="font-size:13.5px">جهازك لا يسمح بنافذة الاختيار، لكن يسمح بالسحب والإفلات:<br>
        1) افتح <b>مستكشف الملفات</b> (زر ⊞ Windows + E) وضعه بجانب المتصفح.<br>
        2) ${kind === 'dir' ? 'اسحب <b>المجلد نفسه</b> (لا تفتحه) — يمكنك سحب أكثر من مجلد معاً، مثل «بيانات المدرسة» ومجلدك' : 'اسحب <b>الملف</b>'} وأفلته في المربع.<br>
        3) اضغط <b>«تعديل الملفات / Allow»</b> إذا سألك المتصفح.</div>
        <div id="flDropZone" style="margin:12px 0;border:3px dashed #f5b301;border-radius:14px;padding:30px 10px;text-align:center;font-size:17px;color:#9a6b00;background:#fffbea">⬇️ أفلت ${kind === 'dir' ? 'المجلد' : 'الملف'} هنا</div>
        <div id="flDropMsg" style="font-size:13px;min-height:20px"></div>
        <div style="text-align:left"><button id="flDropCancel" style="font-family:inherit;border:1px solid #ccc;background:#f3f4f6;border-radius:8px;padding:6px 16px;cursor:pointer">إلغاء</button></div></div>`;
      document.body.appendChild(ov);
      const z = ov.querySelector('#flDropZone'), msg = ov.querySelector('#flDropMsg');
      const say = (t, bad) => { msg.innerHTML = t; msg.style.color = bad ? '#b91c1c' : '#047857'; };
      ov.querySelector('#flDropCancel').onclick = () => { ov.remove(); reject(Object.assign(new Error('cancelled'), { name: 'AbortError', dropCancelled: true })); };
      const stop = e => { e.preventDefault(); e.stopPropagation(); };
      ov.addEventListener('dragover', stop); ov.addEventListener('drop', stop);
      z.addEventListener('dragover', e => { stop(e); z.style.background = '#fff3c4'; });
      z.addEventListener('dragleave', () => { z.style.background = '#fffbea'; });
      z.addEventListener('drop', async e => {
        stop(e); z.style.background = '#fffbea';
        const hp = dropHandles(e);
        try {
          let hs = await hp;
          hs = kind === 'dir' ? hs.filter(h => h.kind === 'directory')
             : hs.filter(h => h.kind === 'file' && (kind === 'xlsx' ? /\.xlsx$/i : /\.json$/i).test(h.name));
          if (!hs.length) return say(kind === 'dir' ? '⚠️ أفلتَّ ملفاً — اسحب <b>المجلد نفسه</b>.' : '⚠️ هذا ليس الملف المطلوب.', true);
          const ok = [];
          for (const h of hs) { if (await perm(h, true, 'readwrite')) ok.push(h); }
          if (!ok.length) return say('⚠️ لم يُمنح إذن التعديل — أفلته مرة أخرى واضغط «السماح».', true);
          say('✅ تم الربط: ' + ok.map(h => h.name).join('، '));
          setTimeout(() => { ov.remove(); resolve(ok); }, 700);
        } catch (er) { say('❌ ' + (er && er.message || er), true); }
      });
    });
  }
  async function remove(i) { const list = await folders(); list.splice(i, 1); await saveFolders(list); return list; }
  async function clear() { await saveFolders([]); }
  async function perm(h, interactive, mode) {
    mode = mode || 'read';
    try {
      let p = await h.queryPermission({ mode });
      if (p !== 'granted' && interactive) p = await h.requestPermission({ mode });
      return p === 'granted';
    } catch (e) { return false; }
  }
  // حالة كل مجلد: granted / prompt
  async function status(interactive) {
    const list = await folders();
    const out = [];
    for (const h of list) out.push({ h, name: h.name, ok: await perm(h, interactive, 'read') });
    return out;
  }

  /* ---------- البحث داخل المجلدات ---------- */
  async function walk(dir, depth, prefix, cb) {
    for await (const [name, h] of dir.entries()) {
      if (h.kind === 'directory') { if (depth > 0) await walk(h, depth - 1, prefix + name + '/', cb); }
      else await cb(name, h, prefix, dir);
    }
  }
  // ملف «بيانات المدرسة» المختار مباشرة كملف (لأجهزة ترفض اختيار المجلدات)
  async function centralFile() { try { return (await idb('get', 'cfile')) || null; } catch (e) { return null; } }
  async function setCentralFile(h) { await idb('put', 'cfile', h || null); }
  async function pickFile(kind) {            // kind: 'xlsx' | 'json'
    const types = kind === 'json'
      ? [{ description: 'ملف نجوم مدرستي (JSON)', accept: { 'application/json': ['.json'] } }]
      : [{ description: 'ملف بيانات المدرسة (Excel)', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }];
    let h;
    try {
      if (typeof window.showOpenFilePicker !== 'function') throw Object.assign(new Error('no picker'), { name: 'AbortError' });
      [h] = await window.showOpenFilePicker({ id: 'razi-files', multiple: false, types });
    } catch (e) {
      if (!(e && e.name === 'AbortError') || !dropSupported()) throw e;
      return (await dropDialog(kind === 'json' ? 'json' : 'xlsx'))[0];
    }
    try { if ((await h.queryPermission({ mode: 'readwrite' })) !== 'granted') await h.requestPermission({ mode: 'readwrite' }); } catch (e) {}
    return h;
  }
  // ملف بيانات المدرسة (xlsx) — الأولوية للاسم «بيانات المدرسة»
  async function findCentral(interactive) {
    const found = [];
    for (const s of await status(interactive)) {
      if (!s.ok) continue;
      await walk(s.h, 1, s.name + '/', async (name, h, prefix) => {
        if (!/\.xlsx$/i.test(name) || name.startsWith('~$')) return;
        const f = await h.getFile();
        const score = (/بيانات\s*المدرس/.test(name) ? 10 : /بيانات/.test(name) ? 5 : 0) - (/تجريب/.test(name) ? 20 : 0) - (prefix.split('/').length - 2);
        found.push({ handle: h, name, path: prefix + name, modified: f.lastModified, score, folder: s.h, top: prefix === s.name + '/' });
      });
    }
    found.sort((a, b) => b.score - a.score || b.modified - a.modified);
    if (found[0]) return found[0];
    const cf = await centralFile();               // لا مجلدات ⇐ الملف المختار مباشرة
    if (cf && await perm(cf, interactive, 'read')) {
      let modified = 0; try { modified = (await cf.getFile()).lastModified; } catch (e) {}
      return { handle: cf, name: cf.name, path: cf.name, modified, score: 0, folder: null, top: false, direct: true };
    }
    return null;
  }
  // كل ملفات JSON (لوحة التحكم وبرنامج الغياب)
  async function listJson(interactive, depth) {
    const out = [];
    for (const s of await status(interactive)) {
      if (!s.ok) continue;
      await walk(s.h, depth == null ? 3 : depth, s.name + '/', async (name, h, prefix, dir) => {
        if (!/\.json$/i.test(name)) return;
        out.push({ handle: h, name, path: prefix + name, dir });
      });
    }
    return out;
  }
  async function readFiles(interactive, depth) {     // [{path, text, modified}]
    const list = await listJson(interactive, depth), out = [];
    for (const x of list) { try { const f = await x.handle.getFile(); out.push({ path: x.path, text: await f.text(), modified: f.lastModified }); } catch (e) {} }
    return out;
  }

  /* ---------- «من أنا؟» ---------- */
  async function me() { try { return (await idb('get', 'me')) || null; } catch (e) { return null; } }
  async function setMe(t) { await idb('put', 'me', t ? { key: t.key || '', name: t.name || '', email: normEmail(t.email) } : null); }
  // ملف نجوم مدرستي الخاص بالمعلم (يُحدَّد في بوابة الرازي، وتستخدمه نجوم مدرستي مباشرة)
  async function teacherFile() { try { return (await idb('get', 'tfile')) || null; } catch (e) { return null; } }
  async function setTeacherFile(h) { await idb('put', 'tfile', h || null); }
  // مطابقة ملف بيانات بمعلم من قائمة بيانات المدرسة
  function matchTeacher(d, teachers) {
    const si = (d && d.schoolInfo) || {};
    const em = normEmail(si.teacherEmail || d.teacherEmail || (d.rosterMeta && String(d.rosterMeta.teacherKey || '').includes('@') ? d.rosterMeta.teacherKey : ''));
    const key = d.rosterMeta && d.rosterMeta.teacherKey;
    const nm = norm(si.teacher || d.teacher);
    return teachers.find(t => em && normEmail(t.email) === em) || teachers.find(t => key && t.key === key)
      || teachers.find(t => nm && norm(t.name) === nm) || null;
  }
  // كل ملفات نجوم مدرستي في المجلدات المربوطة: [{handle, path, dir, d, teacher}]
  async function scanTeacherFiles(teachers, interactive) {
    const out = [];
    for (const x of await listJson(interactive, 2)) {
      try { const d = JSON.parse(await (await x.handle.getFile()).text()); if (d && Array.isArray(d.classes)) out.push(Object.assign({ d, teacher: matchTeacher(d, teachers || []) }, x)); } catch (e) {}
    }
    return out;
  }

  // ملف المعلم: بالبريد أو مفتاح المعلم داخل الملف، ثم باسم المجلد/الملف
  async function findTeacherFile(t, interactive) {
    const nm = norm(t.name), em = normEmail(t.email);
    let best = null;
    for (const x of await listJson(interactive, 2)) {
      let score = 0;
      const pathN = norm(x.path);
      if (nm && pathN.includes(nm)) score += 5;
      try {
        const d = JSON.parse(await (await x.handle.getFile()).text());
        if (!d || !Array.isArray(d.classes)) continue;
        const si = d.schoolInfo || {};
        if (em && normEmail(si.teacherEmail || d.teacherEmail) === em) score += 20;
        if (t.key && d.rosterMeta && d.rosterMeta.teacherKey === t.key) score += 20;
        if (nm && norm(si.teacher || d.teacher) === nm) score += 8;
      } catch (e) { continue; }
      if (score && (!best || score > best.score)) best = Object.assign({ score }, x);
    }
    return best;
  }
  // مجلد المعلم للكتابة: مجلد مربوط باسمه، أو مجلد فرعي باسمه، أو المجلد الوحيد الذي لا يحتوي بيانات المدرسة
  async function teacherDir(t, create) {
    const nm = norm(t.name);
    const st = (await status(false)).filter(s => s.ok);
    for (const s of st) if (norm(s.name) === nm) return s.h;
    for (const s of st) {
      for await (const [name, h] of s.h.entries()) if (h.kind === 'directory' && norm(name) === nm) return h;
    }
    const central = await findCentral(false);
    const nonCentral = [];
    // مجلد «بيانات المدرسة» نفسه لا يُكتب فيه؛ أما المجلد الأب الذي يضمه مع مجلدات المعلمين فيُسمح
    for (const s of st) { if (!central || !central.top || !(await s.h.isSameEntry(central.folder))) nonCentral.push(s.h); }
    if (nonCentral.length === 1 && !create) return nonCentral[0];
    if (create && nonCentral.length) {
      // الإدارة: إنشاء مجلد باسم المعلم داخل أول مجلد غير «بيانات المدرسة»
      if (!(await perm(nonCentral[0], true, 'readwrite'))) return null;
      return nonCentral[0].getDirectoryHandle(safeName(t.name), { create: true });
    }
    return nonCentral.length === 1 ? nonCentral[0] : null;
  }
  // اسم ملف المعلم من اسم المستخدم في بريده (أحرف إنجليزية لا تتشوه): nojoom_data_mahmoud.shehada.json
  const fileNameFor = t => {
    const u = normEmail(t.email).split('@')[0].replace(/[^a-z0-9._-]+/g, '');
    return u ? 'nojoom_data_' + u + '.json' : 'nojoom_' + safeName(t.name).replace(/\s+/g, '_') + '.json';
  };

  /* ---------- ملف بداية للمعلم (تملؤه نجوم مدرستي من بيانات المدرسة عند أول فتح) ---------- */
  function starterData(t, info) {
    info = info || {};
    return {
      version: 7, exportDate: new Date().toISOString(), starter: true,
      schoolInfo: { teacher: t.name || '', teacherEmail: t.email || '', subject: (t.subjects || []).join('، '),
        schoolName: info.schoolName || '', principal: info.principal || '' },
      teacher: t.name || '', subject: (t.subjects || []).join('، '),
      assessments: [], classes: [],
      rosterMeta: { managed: true, teacherKey: t.key || '', myClasses: (t.classes || []).slice(), createdBy: 'portal' }
    };
  }
  // قائمة المعلمين من ملف بيانات المدرسة — بنفس مفتاح نجوم مدرستي (البريد، أو الاسم المُوحَّد)
  function teachersFromWorkbook(wb) {
    const sn = wb.SheetNames.find(n => n.trim() === 'المعلمين والجداول') || wb.SheetNames.find(n => n.includes('المعلمين'));
    if (!sn) return [];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '' });
    if (!rows.length) return [];
    const H = Object.keys(rows[0]);
    const col = kws => H.find(h => kws.some(k => h.toLowerCase().includes(k)));
    const cE = col(['بريد', 'email', 'ايميل', 'إيميل']), cN = col(['اسم']), cS = col(['ماد', 'subject']), cR = col(['رائد', 'homeroom']);
    const cC = H.find(h => h !== cR && ['الصفوف', 'صفوف', 'الشعب', 'شعب', 'الصف', 'class'].some(k => h.toLowerCase().includes(k)));
    const nn = n => String(n || '').replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
    const disp = c => { c = String(c || '').replace(/\s+/g, ''); return !c ? '' : c.includes('/') ? c : c.length >= 2 ? c[0] + '/' + c.slice(1) : c; };
    const map = new Map();
    rows.forEach(r => {
      const email = String(cE ? r[cE] : '').trim().toLowerCase(), name = String(cN ? r[cN] : '').trim();
      const key = email || nn(name);
      if (!key) return;
      const t = map.get(key) || { key, email, name, subjects: [], classes: [] };
      const sub = String(cS ? r[cS] : '').trim();
      if (sub && !t.subjects.includes(sub)) t.subjects.push(sub);
      String(cC ? r[cC] : '').replace(/\s*\/\s*/g, '/').split(/[-,،;؛\s]+/).map(disp).filter(c => c && /\d\/\d/.test(c))
        .forEach(c => { if (!t.classes.includes(c)) t.classes.push(c); });
      map.set(key, t);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }
  async function writeText(fileHandle, text) {
    const w = await fileHandle.createWritable(); await w.write(text); await w.close();
  }

  return { supported, dropSupported, dropDialog, dropHandles, folders, addHandle, add, remove, clear, perm, status, findCentral, listJson, readFiles,
           me, setMe, teacherFile, setTeacherFile, centralFile, setCentralFile, pickFile, matchTeacher, scanTeacherFiles, findTeacherFile, teacherDir, fileNameFor, starterData, writeText, teachersFromWorkbook, norm, normEmail, safeName };
})();
