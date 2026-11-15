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
  const supported = () => typeof window.showDirectoryPicker === 'function';
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
    const h = await window.showDirectoryPicker({ mode: 'readwrite' });
    return addHandle(h);
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
    return found[0] || null;
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
  const fileNameFor = t => 'nojoom_' + safeName(t.name).replace(/\s+/g, '_') + '.json';

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

  return { supported, folders, addHandle, add, remove, clear, perm, status, findCentral, listJson, readFiles,
           me, setMe, findTeacherFile, teacherDir, fileNameFor, starterData, writeText, teachersFromWorkbook, norm, normEmail, safeName };
})();
