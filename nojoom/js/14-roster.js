/* 14-roster.js — القائمة المركزية للطلاب: ربط ملف بيانات المدرسة (Excel) ومزامنة الصفوف والأسماء تلقائياً */

/* =====================================================================
   الفكرة:
   - ملف بيانات المدرسة (Excel) هو المصدر الوحيد للطلاب والصفوف:
       • صفحة "جميع الطلاب": الصف | اسم الطالب "الاسم (الرقم)" | رقم التواصل | معتمد | LMS | ALEF
       • صفحة "المعلمين والجداول": اسم المعلم | مادة التدريس | البريد الالكتروني | الصفوف (مثال: 51-52-53)
   - يوضع على OneDrive في مجلد مشترك "للعرض فقط" مع كل المعلمين.
   - برنامج كل معلم يربط هذا الملف مرة واحدة ويختار اسمه، ثم يقرأه تلقائياً عند الفتح
     وعند الرجوع للنافذة إذا تغيّر الملف.
   - بعد الربط يصبح البرنامج "مُداراً مركزياً": المعلم لا يضيف/يحذف/ينقل طلاباً، ولا يفتح صفوفاً،
     ولا يعدّل أرقام التواصل أو اعتمادها أو الحسابات. كل ذلك من الملف المركزي فقط.
   - المطابقة برقم الطالب (sid) الموجود بين القوسين.
   - لا يُحذف أي طالب أو صف نهائياً: يُنقل إلى الأرشيف مع كامل بياناته، ويرجع تلقائياً إذا عاد للملف.
   ===================================================================== */

const RS_IDB_KEY = 'rosterXlsx';
let rosterHandle = null;
let rosterBusy = false;
let rosterPendingReport = null;   // تغييرات كبيرة بانتظار تأكيد المعلم

/* ---------- أدوات عامة ---------- */
function rsEsc(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function rsNormName(n) {
  return String(n || '')
    .replace(/[ً-ْـ]/g, '')      // التشكيل والتطويل
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ').trim();
}
function rsClassDisplay(code) {
  code = String(code || '').replace(/\s+/g, '');
  if (!code) return '';
  if (code.includes('/')) return code;
  return code.length >= 2 ? (code[0] + '/' + code.slice(1)) : code;
}
function rsIdFromAccounts(s) {
  return [s.govAccount?.user, s.alifAccount?.user]
    .map(u => (String(u || '').split('@')[0].match(/(\d{5,})/) || [])[1])
    .filter(Boolean);
}
function rsFsSupported() { return typeof window.showOpenFilePicker === 'function'; }
function rsSortClasses(list) { return list.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar', { numeric: true })); }

/* ---------- الوضع المُدار مركزياً (قفل صلاحيات المعلم) ---------- */
function rosterManaged() { return !!(state.rosterMeta && state.rosterMeta.managed); }
// يوضع في أول كل دالة تغيّر الطلاب/الصفوف/الأرقام/الحسابات
function rosterGuard() {
  if (!rosterManaged()) return false;
  toast('🔒 الطلاب والصفوف وأرقام التواصل تُدار من الملف المركزي فقط', '🔒');
  return true;
}
function rosterApplyLockUI() {
  document.body.classList.toggle('roster-managed', rosterManaged());
}

/* ---------- حفظ مقبض الملف في IndexedDB (نفس قاعدة الربط التلقائي) ---------- */
async function rsIdb(op, val) {
  const db = await ljOpenDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LJ_STORE, op === 'get' ? 'readonly' : 'readwrite');
    const st = tx.objectStore(LJ_STORE);
    const req = op === 'get' ? st.get(RS_IDB_KEY) : op === 'put' ? st.put(val, RS_IDB_KEY) : st.delete(RS_IDB_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ---------- قراءة ملف بيانات المدرسة ---------- */
function parseRosterWorkbook(wb) {
  const ws = wb.Sheets['جميع الطلاب'];
  if (!ws) throw new Error('لم يتم العثور على صفحة "جميع الطلاب" في ملف بيانات المدرسة.');
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const headerKeys = rows.length ? Object.keys(rows[0]) : [];
  const findHeader = (kw, wantPass) => headerKeys.find(h => {
    const H = h.toUpperCase();
    return H.includes(kw) && (wantPass ? H.includes('PASS') : !H.includes('PASS'));
  });
  const lmsEmailH = findHeader('LMS', false), lmsPassH = findHeader('LMS', true);
  const alefEmailH = findHeader('ALEF', false), alefPassH = findHeader('ALEF', true);
  // إذا لم يوجد عمود الهاتف أو الاعتماد في الملف، لا نلمس القيم الحالية
  const hasPhoneCol = headerKeys.includes('رقم التواصل');
  const hasApprovedCol = headerKeys.includes('معتمد');
  const acct = (eh, ph, r) => (eh && (r[eh] || (ph && r[ph])))
    ? { user: String(r[eh] || '').trim(), pass: String(ph ? r[ph] || '' : '').trim() } : null;

  const byClass = {};
  let count = 0;
  rows.forEach(r => {
    const cls = rsClassDisplay(r['الصف']);
    // الاسم من "اسم الطالب" بصيغة "الاسم (الرقم)"، والرقم من عمود "رقم الطالب" إن وُجد
    const parsed = splitNameId(r['اسم الطالب']);
    const name = parsed.name || String(r['NAME IN ARABIC'] || '').trim();
    const sid = String(r['رقم الطالب'] == null ? '' : r['رقم الطالب']).trim() || parsed.sid;
    if (!cls || !name) return;
    const phoneRaw = r['رقم التواصل'];
    const approvedRaw = String(r['معتمد'] == null ? '' : r['معتمد']).trim();
    (byClass[cls] = byClass[cls] || []).push({
      cls, name, sid,
      phone: hasPhoneCol ? (phoneRaw !== '' ? normalizePhoneUAE(phoneRaw) : '') : null,
      approved: hasApprovedCol ? (approvedRaw === '1' || approvedRaw.toLowerCase() === 'true' || approvedRaw === 'معتمد') : null,
      govAccount: acct(lmsEmailH, lmsPassH, r),
      alifAccount: acct(alefEmailH, alefPassH, r)
    });
    count++;
  });
  return {
    byClass, count,
    teachers: parseTeacherSheet(wb),
    bell: parseBellSheet(wb),
    info: (typeof readSchoolInfoFromWorkbook === 'function') ? readSchoolInfoFromWorkbook(wb) : null
  };
}

// صفحة المعلمين ("المعلمين والجداول"): اسم المعلم | مادة التدريس | البريد الالكتروني | الصفوف (51-52-53)
// ترجع null إذا لم توجد الصفحة
function parseTeacherSheet(wb) {
  const sheetName = wb.SheetNames.find(n => n.trim() === 'المعلمين والجداول')
                 || wb.SheetNames.find(n => n.includes('المعلمين'))
                 || wb.SheetNames.find(n => n.includes('توزيع'));
  if (!sheetName) return null;
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  if (!rows.length) return [];
  const H = Object.keys(rows[0]);
  const col = kws => H.find(h => kws.some(k => h.toLowerCase().includes(k)));
  const cE = col(['بريد', 'email', 'ايميل', 'إيميل']);
  const cN = col(['اسم']);
  const cS = col(['ماد', 'subject']);
  const cC = col(['الصفوف', 'صفوف', 'الشعب', 'شعب', 'الصف', 'class']);
  const map = new Map();
  rows.forEach(r => {
    const email = String(cE ? r[cE] : '').trim().toLowerCase();
    const name = String(cN ? r[cN] : '').trim();
    const key = email || rsNormName(name);
    if (!key) return;
    const t = map.get(key) || { key, email, name, subjects: [], classes: [] };
    if (!t.name) t.name = name;
    const sub = String(cS ? r[cS] : '').trim();
    if (sub && !t.subjects.includes(sub)) t.subjects.push(sub);
    String(cC ? r[cC] : '').replace(/\s*\/\s*/g, '/').split(/[-,،;؛\s]+/)
      .map(rsClassDisplay).filter(Boolean)
      .forEach(c => { if (!t.classes.includes(c)) t.classes.push(c); });
    // جدول الحصص (اختياري): أعمدة الأيام بقيم مثل "0-0-0-52-0-62-63-0"
    const dayCols = { 'الاثنين': 1, 'الثلاثاء': 2, 'الأربعاء': 3, 'الاربعاء': 3, 'الخميس': 4, 'الجمعة': 5 };
    t.timetable = t.timetable || {};
    H.forEach(h => {
      const wd = dayCols[h.trim()];
      if (!wd) return;
      String(r[h] || '').split('-').forEach((v, i) => {
        const c = rsClassDisplay(v);
        if (c && c !== '0' && /\d\/\d/.test(c)) (t.timetable[wd] = t.timetable[wd] || {})[i + 1] = c;
      });
    });
    map.set(key, t);
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

// صفحة «توقيت الحصص» (اختيارية): الحصة | البداية | النهاية | بداية الجمعة | نهاية الجمعة
function rsTime(v) {
  if (v === '' || v == null) return '';
  if (typeof v === 'number') { const m = Math.round((v % 1) * 24 * 60); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  if (v instanceof Date) return String(v.getHours()).padStart(2, '0') + ':' + String(v.getMinutes()).padStart(2, '0');
  const m = String(v).match(/(\d{1,2})[:.](\d{2})/);
  return m ? m[1].padStart(2, '0') + ':' + m[2] : '';
}
function parseBellSheet(wb) {
  const name = wb.SheetNames.find(n => n.includes('توقيت'));
  if (!name) return null;
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
  const out = { normal: [], fri: [] };
  rows.slice(1).forEach(r => {
    const p = parseInt(String(r[0]).replace(/[^0-9]/g, ''), 10);
    if (!p) return;
    const a = rsTime(r[1]), b = rsTime(r[2]), c = rsTime(r[3]), d = rsTime(r[4]);
    if (a && b) out.normal.push({ p, start: a, end: b });
    if (c && d) out.fri.push({ p, start: c, end: d });
  });
  return out.normal.length ? out : null;
}

function rsReadPortalWorkbook() {
  const dataUrl = localStorage.getItem('raziSchoolDataXlsx');
  if (!dataUrl) return null;
  const binary = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return {
    wb: XLSX.read(bytes.buffer, { type: 'array', cellDates: true }),
    fileName: localStorage.getItem('raziSchoolDataFilename') || 'بيانات البوابة',
    fileModified: null, source: 'portal'
  };
}

// يرجع { wb, fileName, fileModified, source } أو null. interactive = يسمح بطلب الصلاحية (يحتاج ضغطة زر)
async function rsGetWorkbook(interactive) {
  if (rosterHandle) {
    let perm = await rosterHandle.queryPermission({ mode: 'read' });
    if (perm !== 'granted' && interactive) perm = await rosterHandle.requestPermission({ mode: 'read' });
    if (perm !== 'granted') return { needsPermission: true };
    const file = await rosterHandle.getFile();
    const buf = await file.arrayBuffer();
    return {
      wb: XLSX.read(buf, { type: 'array', cellDates: true }),
      fileName: file.name, fileModified: file.lastModified, source: 'file'
    };
  }
  return rsReadPortalWorkbook();
}

/* ---------- خوارزمية المزامنة ----------
   تُنفَّذ على نسخة من البيانات أولاً، ولا تُعتمد إلا إذا كانت آمنة أو بعد التأكيد. */
function rosterPlan(roster, teacherKey, myClasses) {
  const R = roster.byClass;
  const today = new Date().toISOString().slice(0, 10);
  const work = {
    classes: structuredClone(state.classes),
    archived: structuredClone(state.archivedStudents || []),
    archivedClasses: structuredClone(state.archivedClasses || [])
  };
  const rep = { added: [], renamed: [], moved: [], archived: [], restored: [], updated: [], unmatched: [],
                classesAdded: [], classesArchived: [], classesRestored: [], missingClasses: [], classes: [], total: 0 };

  // --- توزيع المعلم (إن وُجدت صفحة التوزيع)
  // الصفوف: ما حدده المعلم بنفسه (myClasses)، وإلا ما في صفحة المعلمين والجداول
  let teacher = null, assigned = null;
  if (myClasses === undefined) myClasses = state.rosterMeta && Array.isArray(state.rosterMeta.myClasses) ? state.rosterMeta.myClasses : null;
  if (roster.teachers) {
    teacher = roster.teachers.find(t => t.key === teacherKey) || null;
    if (!teacher) { rep.noTeacher = true; return { work, rep }; }
    rep.teacher = { name: teacher.name, email: teacher.email, subjects: teacher.subjects };
  }
  const base = myClasses || (teacher ? teacher.classes : null);
  if (base) {
    assigned = base.filter(c => R[c]);
    rep.missingClasses = base.filter(c => !R[c]);

    const allIds = new Set(work.classes.map(c => c.id));
    let cid = Date.now();
    // صفوف لم تعد مُسندة للمعلم → أرشيف الصفوف (مع كامل بياناتها)
    work.classes.filter(c => R[c.name] && !assigned.includes(c.name)).forEach(c => {
      work.classes = work.classes.filter(x => x !== c);
      work.archivedClasses.push({ cls: c, date: today });
      rep.classesArchived.push(c.name);
    });
    // صفوف مُسندة غير موجودة → استرجاع من الأرشيف أو إنشاء جديد
    assigned.forEach(n => {
      if (work.classes.some(c => c.name === n)) return;
      const ai = work.archivedClasses.findIndex(a => a.cls && a.cls.name === n);
      if (ai >= 0) {
        work.classes.push(work.archivedClasses.splice(ai, 1)[0].cls);
        rep.classesRestored.push(n);
      } else {
        while (allIds.has(cid)) cid++;
        allIds.add(cid);
        work.classes.push({ id: cid, name: n, _savedDates: [], students: [] });
        rep.classesAdded.push(n);
      }
    });
    rsSortClasses(work.classes);
  }

  const my = work.classes.filter(c => R[c.name] && (!assigned || assigned.includes(c.name)));
  rep.classes = my.map(c => c.name);
  if (!my.length) { rep.noClasses = true; return { work, rep }; }
  rep.total = my.reduce((n, c) => n + c.students.length, 0);

  // --- فهارس القائمة المركزية
  const rows = [];
  Object.values(R).forEach(list => list.forEach(r => rows.push(r)));
  const bySid = new Map(), byMail = new Map();
  rows.forEach(r => {
    if (r.sid) bySid.set(r.sid, r);
    [r.govAccount?.user, r.alifAccount?.user].forEach(m => { if (m) byMail.set(m.toLowerCase(), r); });
  });
  const uniqueNameMap = list => {
    const m = new Map(), dup = new Set();
    list.forEach(r => { const k = rsNormName(r.name); if (m.has(k)) dup.add(k); m.set(k, r); });
    dup.forEach(k => m.delete(k));
    return m;
  };
  const byNameAll = uniqueNameMap(rows);
  const nameIdx = {};
  const rowsByNameIn = cls => (nameIdx[cls] = nameIdx[cls] || uniqueNameMap(R[cls] || []));

  // 1) إعطاء رقم لكل طالب ليس له رقم (بالإيميل، ثم الرقم داخل الإيميل، ثم الاسم)
  const taken = new Set();
  work.classes.forEach(c => c.students.forEach(s => { if (s.sid) taken.add(s.sid); }));
  my.forEach(c => c.students.forEach(s => {
    if (s.sid) return;
    let r = null;
    for (const m of [s.govAccount?.user, s.alifAccount?.user]) { if (!r && m) r = byMail.get(m.toLowerCase()) || null; }
    if (!r) for (const id of rsIdFromAccounts(s)) { if (!r) r = bySid.get(id) || null; }
    if (!r) r = rowsByNameIn(c.name).get(rsNormName(s.name)) || byNameAll.get(rsNormName(s.name)) || null;
    if (r && r.sid && !taken.has(r.sid)) { s.sid = r.sid; taken.add(r.sid); }
  }));

  const matched = new Set();
  const applyRow = (s, r, clsName) => {
    let changed = false;
    if (r.sid && !s.sid) s.sid = r.sid;
    if (r.name && r.name !== s.name) { rep.renamed.push({ from: s.name, to: r.name, cls: clsName }); s.name = r.name; }
    // رقم التواصل واعتماده من الملف المركزي فقط
    if (r.phone !== null) {
      const phone = r.phone || '';
      if (phone !== (s.parentPhone || '')) { s.parentPhone = phone; changed = true; }
      if (r.approved !== null) {
        const verified = !!(phone && r.approved);
        if (verified !== !!s.phoneVerified) { s.phoneVerified = verified; changed = true; }
      }
    }
    if (r.govAccount?.user && (r.govAccount.user !== s.govAccount?.user || r.govAccount.pass !== s.govAccount?.pass)) {
      s.govAccount = { user: r.govAccount.user, pass: r.govAccount.pass }; changed = true;
    }
    if (r.alifAccount?.user && (r.alifAccount.user !== s.alifAccount?.user || r.alifAccount.pass !== s.alifAccount?.pass)) {
      s.alifAccount = { user: r.alifAccount.user, pass: r.alifAccount.pass }; changed = true;
    }
    if (changed) rep.updated.push({ name: s.name, cls: clsName });
  };
  const archive = (s, c, reason) => {
    c.students = c.students.filter(x => x !== s);
    work.archived.push({ student: s, fromClass: c.name, reason, date: today });
    rep.archived.push({ name: s.name, cls: c.name, reason });
  };

  // 2) مراجعة طلاب صفوف المعلم
  my.forEach(c => {
    c.students.slice().forEach(s => {
      const r = s.sid ? bySid.get(s.sid) : rowsByNameIn(c.name).get(rsNormName(s.name));
      if (!r) {
        // غير موجود في الملف المركزي (برقمه أو باسمه) → أرشيف مع كامل بياناته
        archive(s, c, 'غير موجود في الملف المركزي');
        return;
      }
      matched.add(r);
      if (r.cls !== c.name) {
        const t = my.find(x => x.name === r.cls);
        if (t) {
          c.students = c.students.filter(x => x !== s);
          t.students.push(s);
          rep.moved.push({ name: r.name || s.name, from: c.name, to: t.name, id: s.id });
        } else {
          archive(s, c, 'نُقل إلى صف ' + r.cls);
          return;
        }
      }
      applyRow(s, r, r.cls);
    });
  });

  // 3) إضافة الطلاب الجدد (أو إرجاعهم من الأرشيف) في صفوف المعلم
  const allIds = new Set();
  work.classes.forEach(c => c.students.forEach(s => allIds.add(s.id)));
  work.archived.forEach(a => a.student && allIds.add(a.student.id));
  let idSeed = Date.now();
  const newId = () => { while (allIds.has(idSeed)) idSeed++; allIds.add(idSeed); return idSeed; };
  const sidInState = new Set();
  work.classes.forEach(c => c.students.forEach(s => { if (s.sid) sidInState.add(s.sid); }));

  my.forEach(c => (R[c.name] || []).forEach(r => {
    if (matched.has(r)) return;
    if (r.sid && sidInState.has(r.sid)) return;   // موجود في صف آخر — لا نكرره
    // استرجاع من الأرشيف: بالرقم، أو بالاسم لطالب أُرشف بدون رقم من نفس الصف
    let ai = r.sid ? work.archived.findIndex(a => a.student && a.student.sid === r.sid) : -1;
    if (ai < 0) ai = work.archived.findIndex(a => a.student && !a.student.sid && a.fromClass === c.name && rsNormName(a.student.name) === rsNormName(r.name));
    if (ai >= 0) {
      const s = work.archived.splice(ai, 1)[0].student;
      c.students.push(s);
      applyRow(s, r, c.name);
      rep.restored.push({ name: s.name, cls: c.name, id: s.id });
    } else {
      c.students.push({
        id: newId(), name: r.name, sid: r.sid || '',
        points: 0, present: 0, absent: 0, participation: 0, absenceDates: [],
        _todayAtt: 'unmarked', _prevAtt: {}, parentPhone: r.phone || '',
        phoneVerified: !!(r.phone && r.approved), behaviorNotes: [], _manualBonus: 0,
        govAccount: r.govAccount || null, alifAccount: r.alifAccount || null,
        pointsLog: [], _dailyPart: {}, _dailyDeduct: {}
      });
      rep.added.push({ name: r.name, cls: c.name });
    }
    if (r.sid) sidInState.add(r.sid);
  }));

  // تغييرات كبيرة تحتاج تأكيداً (حماية من ملف خاطئ أو ناقص):
  // أرشفة صف كامل، أو أكثر من 10% من طلاب المعلم، أو أكثر من ربع صف واحد
  const perClass = {};
  rep.archived.forEach(x => { perClass[x.cls] = (perClass[x.cls] || 0) + 1; });
  const classSize = n => (state.classes.find(c => c.name === n)?.students.length) || 0;
  rep.risky = rep.classesArchived.length > 0 ||
    rep.archived.length > Math.max(3, Math.round(rep.total * 0.1)) ||
    Object.entries(perClass).some(([n, k]) => k > Math.max(2, Math.round(classSize(n) * 0.25)));
  rep.changes = rep.added.length + rep.renamed.length + rep.moved.length + rep.archived.length +
    rep.restored.length + rep.updated.length + rep.classesAdded.length + rep.classesArchived.length + rep.classesRestored.length;
  return { work, rep, teacher, info: roster.info, bell: roster.bell };
}

function rosterCommit(plan, meta) {
  const { work, rep, teacher, info } = plan;
  state.classes = work.classes;
  state.archivedStudents = work.archived;
  state.archivedClasses = work.archivedClasses;
  const touched = new Set([...rep.moved, ...rep.restored].map(x => x.id));
  state.classes.forEach(c => {
    if (rep.classes.includes(c.name)) c.students = sortStudentsAlpha(c.students);
    c.students.forEach(s => { if (touched.has(s.id) && typeof recomputeWithAssessments === 'function') recomputeWithAssessments(c, s); });
  });
  if (!state.classes.some(c => c.id === state.activeClass)) state.activeClass = state.classes[0]?.id || null;

  // بيانات المعلم والمدرسة من الملف المركزي
  state.schoolInfo = state.schoolInfo || {};
  if (teacher) {
    if (teacher.name) state.schoolInfo.teacher = teacher.name;
    if (teacher.subjects.length) state.schoolInfo.subject = teacher.subjects.join('، ');
    state.schoolInfo.teacherEmail = teacher.email || '';
  }
  if (info) {
    if (info.schoolName) state.schoolInfo.schoolName = info.schoolName;
    if (info.principal) state.schoolInfo.principal = info.principal;
    // الفصل الدراسي الحالي من «التقويم المدرسي»
    if (info.termStart) {
      const changed = state.schoolInfo.termStart !== info.termStart;
      state.schoolInfo.termStart = info.termStart;
      if (info.termEnd) state.schoolInfo.termEnd = info.termEnd;
      if (changed && typeof recalcAllTermWeeks === 'function') recalcAllTermWeeks();
    }
  }

  const prev = state.rosterMeta || {};
  state.rosterMeta = {
    managed: true, teacherKey: prev.teacherKey || null,
    bell: plan.bell || null,                                  // توقيت الحصص من الملف المركزي
    timetable: teacher && teacher.timetable && Object.keys(teacher.timetable).length ? teacher.timetable : null,
    myClasses: Array.isArray(prev.myClasses) ? prev.myClasses : null,
    fileName: meta.fileName, source: meta.source, fileModified: meta.fileModified,
    lastSync: new Date().toISOString(), lastReport: rsSlimReport(rep)
  };
  save();
  rosterApplyLockUI();
  rosterRerender();
}

function rsSlimReport(rep) {
  const r = {};
  ['added', 'renamed', 'moved', 'archived', 'restored', 'updated', 'unmatched'].forEach(k => {
    r[k] = (rep[k] || []).slice(0, 200).map(x => { const o = Object.assign({}, x); delete o.id; return o; });
  });
  ['classesAdded', 'classesArchived', 'classesRestored', 'missingClasses', 'classes'].forEach(k => { r[k] = rep[k] || []; });
  r.changes = rep.changes;
  return r;
}

function rosterRerender() {
  try {
    const si = getSchoolInfo();
    if (typeof renderSchoolInfoBar === 'function') renderSchoolInfoBar(si.subject, si.teacher, si.schoolName);
    renderClassTabs(); renderStudentList(); renderClasses(); updateLeaderboard(); updateReportSelects();
  } catch (e) { console.warn('roster rerender', e); }
}

/* ---------- تشغيل المزامنة ---------- */
// opts.interactive: ضغطة من المستخدم (يُسمح بطلب الصلاحية وإظهار النوافذ)
// opts.onlyIfChanged: لا تقرأ إلا إذا تغيّر تاريخ تعديل الملف
async function rosterSyncNow(opts) {
  opts = opts || {};
  if (rosterBusy) return;
  rosterBusy = true;
  try {
    if (opts.onlyIfChanged && rosterHandle) {
      const perm = await rosterHandle.queryPermission({ mode: 'read' });
      if (perm !== 'granted') return;
      const f = await rosterHandle.getFile();
      if (state.rosterMeta && state.rosterMeta.fileModified === f.lastModified) return;
    }
    const src = await rsGetWorkbook(!!opts.interactive);
    if (!src) {
      if (opts.interactive) toast('لم يُربط الملف المركزي بعد', '⚠️');
      return;
    }
    if (src.needsPermission) { rosterBtnState('locked'); return; }
    const roster = parseRosterWorkbook(src.wb);
    if (!roster.count) throw new Error('الملف المركزي لا يحتوي أي طالب.');
    const meta = { fileName: src.fileName, source: src.source, fileModified: src.fileModified };

    // اختيار المعلم أول مرة (عند وجود صفحة المعلمين والجداول)
    const tKey = state.rosterMeta && state.rosterMeta.teacherKey;
    if (roster.teachers && (!tKey || !roster.teachers.some(t => t.key === tKey))) {
      rosterBtnState('warn');
      if (opts.interactive) rosterShowTeacherPicker(roster, meta, !!tKey);
      return;
    }
    // تحديد الصفوف أول مرة (المعلم يحدد صفوفه من بيانات المدرسة)
    if (!Array.isArray(state.rosterMeta && state.rosterMeta.myClasses)) {
      rosterBtnState('warn');
      if (opts.interactive) rosterShowClassPicker(roster, meta, true);
      return;
    }

    const plan = rosterPlan(roster, tKey);
    if (plan.rep.noClasses) {
      rosterBtnState('warn');
      if (opts.interactive) rosterShowClassPicker(roster, meta, false);
      return;
    }
    if (plan.rep.risky) {
      rosterPendingReport = { plan, meta };
      rosterBtnState('warn');
      if (opts.interactive) rosterShowReport(plan.rep, true);
      else toast('تغييرات كبيرة في الملف المركزي — اضغط 👥 للمراجعة', '⚠️');
      return;
    }
    rosterCommit(plan, meta);
    rosterBtnState('ok');
    if (opts.interactive) rosterShowReport(plan.rep, false);
    else if (plan.rep.changes) toast('👥 تحديث من الملف المركزي: ' + rsSummaryText(plan.rep), '👥');
  } catch (e) {
    console.warn('roster sync', e);
    rosterBtnState('error');
    if (opts.interactive) alert('تعذّرت المزامنة مع الملف المركزي:\n' + e.message);
  } finally {
    rosterBusy = false;
  }
}

function rsSummaryText(rep) {
  const n = k => (rep[k] || []).length;
  const parts = [];
  if (n('classesAdded')) parts.push(n('classesAdded') + ' صف جديد');
  if (n('classesRestored')) parts.push(n('classesRestored') + ' صف مسترجع');
  if (n('classesArchived')) parts.push(n('classesArchived') + ' صف مؤرشف');
  if (n('added')) parts.push(n('added') + ' طالب جديد');
  if (n('renamed')) parts.push(n('renamed') + ' تعديل اسم');
  if (n('moved')) parts.push(n('moved') + ' نقل صف');
  if (n('restored')) parts.push(n('restored') + ' استرجاع');
  if (n('archived')) parts.push(n('archived') + ' أرشفة');
  if (n('updated')) parts.push(n('updated') + ' تحديث بيانات');
  return parts.join('، ') || 'لا تغييرات';
}

/* ---------- واجهة المستخدم ---------- */
function rosterBtnState(st) {
  const btn = document.getElementById('btnRoster');
  if (!btn) return;
  const m = state.rosterMeta;
  const last = m && m.lastSync ? ' — آخر مزامنة: ' + new Date(m.lastSync).toLocaleString('ar') : '';
  const map = {
    none:   ['👥', 'الملف المركزي للطلاب (غير مرتبط) — اضغط للربط'],
    ok:     ['👥', 'الملف المركزي: ' + (m?.fileName || '') + last],
    locked: ['🔓', 'اضغط لتحديث الطلاب من الملف المركزي (يحتاج إذن قراءة الملف)'],
    warn:   ['⚠️', 'الملف المركزي يحتاج مراجعة — اضغط'],
    error:  ['❗', 'تعذّرت قراءة الملف المركزي — اضغط للتفاصيل']
  };
  const [icon, title] = map[st] || map.none;
  btn.textContent = icon;
  btn.title = title;
}

async function onRosterBtnClick() {
  if (rosterPendingReport) { rosterShowReport(rosterPendingReport.plan.rep, true); return; }
  if (rosterHandle) {
    const perm = await rosterHandle.queryPermission({ mode: 'read' });
    if (perm !== 'granted' || document.getElementById('btnRoster')?.textContent === '⚠️') {
      await rosterSyncNow({ interactive: true });
      return;
    }
  }
  showRosterMenu();
}

function showRosterMenu() {
  const m = state.rosterMeta;
  const si = state.schoolInfo || {};
  const arch = (state.archivedStudents || []).length + (state.archivedClasses || []).length;
  const hasPortal = !!localStorage.getItem('raziSchoolDataXlsx');
  const linked = !!rosterHandle;
  const managed = rosterManaged();
  const status = linked
    ? `🔗 مرتبط بالملف: <b>${rsEsc(rosterHandle.name)}</b>`
    : (managed ? `🔒 مُدار من الملف المركزي: <b>${rsEsc(m.fileName || '')}</b> — الملف غير مرتبط على هذا المتصفح`
               : (hasPortal ? '📦 غير مرتبط — متاحة نسخة بيانات البوابة على هذا الجهاز' : '⚪ غير مرتبط'));
  const who = managed && si.teacher ? `<br>👤 المعلم: <b>${rsEsc(si.teacher)}</b>${si.subject ? ' — ' + rsEsc(si.subject) : ''}` : '';
  const last = m && m.lastSync ? `<br>آخر مزامنة: <b>${new Date(m.lastSync).toLocaleString('ar')}</b> (${rsSummaryText(m.lastReport || {})})` : '';
  const btn = (cls, onclick, icon, title, sub) =>
    `<button class="btn ${cls}" style="width:100%;justify-content:flex-start;gap:10px" onclick="${onclick}">${icon} ${title}<br><span style="font-size:11px;font-weight:400;opacity:.8">${sub}</span></button>`;
  openModal(`
    <div class="modal-title">👥 الملف المركزي للطلاب</div>
    <div style="font-size:12px;color:var(--text-muted);line-height:1.9;margin-bottom:12px">
      ${status}${who}${last}<br>
      الصفوف والطلاب وأرقام التواصل تُقرأ من ملف بيانات المدرسة فقط. نقاط الطلاب وبياناتهم لا تتأثر.
    </div>
    <div class="modal-actions" style="flex-direction:column;gap:10px">
      ${rsFsSupported() ? btn(linked ? 'btn-ghost' : 'btn-primary', 'rosterLinkFile()', '🔗', linked ? 'تغيير الملف المركزي' : 'ربط الملف المركزي', 'اختر ملف بيانات المدرسة من مجلد OneDrive المشترك') : ''}
      ${(linked || (!managed && hasPortal)) ? btn('btn-success', 'closeModalForce();rosterSyncNow({interactive:true})', '🔄', 'مزامنة الآن', linked ? 'قراءة الملف وتطبيق التغييرات' : 'من نسخة بيانات البوابة على هذا الجهاز') : ''}
      ${(linked || (!managed && hasPortal)) && managed ? btn('btn-primary', 'closeModalForce();rosterOpenClassPicker()', '🏫', 'صفوفي', 'حدّد الصفوف التي تدرّسها من بيانات المدرسة') : ''}
      ${(linked && managed && m.teacherKey) ? btn('btn-ghost', 'closeModalForce();rosterChangeTeacher()', '👤', 'تغيير اسم المعلم', 'إذا اخترت اسماً خاطئاً عند الربط') : ''}
      ${m && m.lastReport ? btn('btn-ghost', 'rosterShowReport(state.rosterMeta.lastReport,false)', '📋', 'تقرير آخر مزامنة', 'ما الذي تغيّر') : ''}
      ${btn('btn-ghost', 'rosterShowArchive()', '🗂️', 'الأرشيف (' + arch + ')', 'طلاب وصفوف حُذفت من الملف المركزي — بياناتها محفوظة')}
      <button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button>
    </div>`);
}

async function rosterLinkFile() {
  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: 'ملف بيانات المدرسة (Excel)', accept: {
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        'application/vnd.ms-excel': ['.xls'] } }]
    });
    // تحقق من الملف قبل حفظ الربط
    const file = await handle.getFile();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    parseRosterWorkbook(wb);
    rosterHandle = handle;
    await rsIdb('put', handle);
    closeModalForce();
    toast('تم ربط الملف المركزي: ' + handle.name, '🔗');
    await rosterSyncNow({ interactive: true });
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    alert('تعذّر ربط الملف:\n' + (e.message || e));
  }
}

/* ---------- اختيار المعلم (مرة واحدة) ---------- */
function rosterShowTeacherPicker(roster, meta, wasMissing) {
  window._rosterPick = { roster, meta };
  const opts = roster.teachers.map(t =>
    `<option value="${rsEsc(t.key)}">${rsEsc(t.name || t.email)}${t.subjects.length ? ' — ' + rsEsc(t.subjects.join('، ')) : ''} (${t.classes.length} صف)</option>`).join('');
  openModal(`
    <div class="modal-title">👤 اختر اسمك</div>
    <div style="font-size:12px;color:var(--text-muted);line-height:1.9;margin-bottom:10px">
      ${wasMissing ? '⚠️ اسمك السابق لم يعد موجوداً في «المعلمين والجداول».<br>' : ''}
      يتم الاختيار مرة واحدة، وبعدها تحدد صفوفك.
    </div>
    <select class="input" id="rs-teacher-select"><option value="">— اختر —</option>${opts}</select>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="rosterConfirmTeacher()">✅ تأكيد</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
    </div>`);
}

function rosterConfirmTeacher() {
  const ctx = window._rosterPick;
  const key = document.getElementById('rs-teacher-select')?.value;
  if (!ctx || !key) return toast('اختر اسمك من القائمة', '⚠️');
  const t = ctx.roster.teachers.find(x => x.key === key);
  if (!confirm(`تأكيد: أنت «${t.name || t.email}»؟`)) return;
  state.rosterMeta = Object.assign({}, state.rosterMeta || {}, { teacherKey: key });
  save();
  closeModalForce();
  rosterShowClassPicker(ctx.roster, ctx.meta, true);
}

/* ---------- المعلم يحدد صفوفه من بيانات المدرسة ---------- */
async function rosterOpenClassPicker() {
  try {
    const src = await rsGetWorkbook(true);
    if (!src || src.needsPermission) return toast('لا يمكن قراءة الملف المركزي', '⚠️');
    rosterShowClassPicker(parseRosterWorkbook(src.wb), { fileName: src.fileName, source: src.source, fileModified: src.fileModified }, false);
  } catch (e) { alert('تعذّرت قراءة الملف المركزي:\n' + e.message); }
}

function rosterShowClassPicker(roster, meta, first) {
  window._rosterCls = { roster, meta };
  const m = state.rosterMeta || {};
  const teacher = roster.teachers ? roster.teachers.find(t => t.key === m.teacherKey) : null;
  const pre = new Set(Array.isArray(m.myClasses) ? m.myClasses : (teacher ? teacher.classes : state.classes.map(c => c.name)));
  const codes = Object.keys(roster.byClass).sort((a, b) => a.localeCompare(b, 'ar', { numeric: true }));
  const grades = {};
  codes.forEach(c => { (grades[c.split('/')[0]] = grades[c.split('/')[0]] || []).push(c); });
  const items = Object.entries(grades).map(([g, list]) => `
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">
      ${list.map(code => `<label style="display:flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border-color);border-radius:10px;padding:8px 12px;font-size:13.5px;font-weight:700;cursor:pointer">
        <input type="checkbox" class="rs-cls-chk" value="${rsEsc(code)}" ${pre.has(code) ? 'checked' : ''}> ${rsEsc(code)}
        <span style="font-size:10.5px;font-weight:400;color:var(--text-muted)">(${roster.byClass[code].length})</span></label>`).join('')}
    </div>`).join('');
  openModal(`
    <div class="modal-title">🏫 صفوفي</div>
    <div style="font-size:12px;color:var(--text-muted);line-height:1.9;margin-bottom:10px">
      ${first ? 'حدّد الصفوف التي تدرّسها. ' : ''}الطلاب يُضافون تلقائياً من بيانات المدرسة.
      إلغاء تحديد صف ينقله إلى الأرشيف مع كامل بياناته، ويرجع إذا حددته مرة أخرى.
    </div>
    <div style="max-height:55vh;overflow-y:auto">${items}</div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="rosterConfirmClasses()">✅ حفظ صفوفي</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
    </div>`);
}

function rosterConfirmClasses() {
  const ctx = window._rosterCls;
  if (!ctx) return closeModalForce();
  const picked = Array.from(document.querySelectorAll('.rs-cls-chk:checked')).map(c => c.value);
  if (!picked.length) return toast('حدد صفاً واحداً على الأقل', '⚠️');
  const key = state.rosterMeta && state.rosterMeta.teacherKey;
  const plan = rosterPlan(ctx.roster, key, picked);
  closeModalForce();
  state.rosterMeta = Object.assign({}, state.rosterMeta || {}, { myClasses: picked });
  save();
  if (plan.rep.risky) { rosterPendingReport = { plan, meta: ctx.meta }; rosterBtnState('warn'); return rosterShowReport(plan.rep, true); }
  rosterCommit(plan, ctx.meta);
  rosterBtnState('ok');
  rosterShowReport(plan.rep, false);
}

async function rosterChangeTeacher() {
  if (!confirm('تغيير اسم المعلم؟\nستتغير الصفوف حسب «المعلمين والجداول» للاسم الجديد، والصفوف الحالية تُنقل للأرشيف ببياناتها.')) return;
  state.rosterMeta.teacherKey = null;
  state.rosterMeta.myClasses = null;
  save();
  await rosterSyncNow({ interactive: true });
}

/* ---------- تقرير المزامنة ---------- */
function rsList(title, items, fmt) {
  if (!items || !items.length) return '';
  return `<div style="margin-bottom:10px"><div style="font-weight:800;font-size:12.5px;margin-bottom:4px">${title} (${items.length})</div>
    <div style="font-size:12px;line-height:1.9;color:var(--text-muted)">${items.slice(0, 80).map(x => '• ' + fmt(x)).join('<br>')}${items.length > 80 ? '<br>…' : ''}</div></div>`;
}

function rosterShowReport(rep, pending) {
  const body =
    rsList('🏫 صفوف جديدة', rep.classesAdded, x => rsEsc(x)) +
    rsList('♻️ صفوف مسترجعة من الأرشيف', rep.classesRestored, x => rsEsc(x)) +
    rsList('🗂️ صفوف أُزيلت من صفوفك (تُنقل للأرشيف ببياناتها)', rep.classesArchived, x => rsEsc(x)) +
    rsList('⚠️ صفوف غير موجودة في صفحة الطلاب', rep.missingClasses, x => rsEsc(x)) +
    rsList('🆕 طلاب جدد', rep.added, x => `${rsEsc(x.name)} — ${rsEsc(x.cls)}`) +
    rsList('✏️ تعديل أسماء', rep.renamed, x => `${rsEsc(x.from)} ← <b>${rsEsc(x.to)}</b>`) +
    rsList('🔀 نقل بين الصفوف', rep.moved, x => `${rsEsc(x.name)}: ${rsEsc(x.from)} ← ${rsEsc(x.to)}`) +
    rsList('♻️ طلاب مسترجعون من الأرشيف', rep.restored, x => `${rsEsc(x.name)} — ${rsEsc(x.cls)}`) +
    rsList('🗂️ أرشفة طلاب (حُذفوا من الملف)', rep.archived, x => `${rsEsc(x.name)} — ${rsEsc(x.cls)} <span style="opacity:.7">(${rsEsc(x.reason)})</span>`) +
    rsList('📞 تحديث هاتف/اعتماد/حسابات', rep.updated, x => `${rsEsc(x.name)} — ${rsEsc(x.cls)}`) +
    rsList('❔ طلاب بلا رقم ولم يُعثر عليهم في الملف (لم يتغيروا)', rep.unmatched, x => `${rsEsc(x.name)} — ${rsEsc(x.cls)}`);
  const warn = pending
    ? `<div style="background:rgba(255,170,0,.12);border:1px solid rgba(255,170,0,.5);border-radius:10px;padding:10px;font-size:12px;margin-bottom:10px;line-height:1.8">
        ⚠️ هذه المزامنة ستؤرشف ${rep.classesArchived?.length ? rep.classesArchived.length + ' صف و' : ''}${rep.archived.length} طالب.
        تأكد أن الملف المرتبط هو ملف بيانات المدرسة الصحيح والمحدّث. البيانات المؤرشفة لا تُحذف.</div>` : '';
  openModal(`
    <div class="modal-title">📋 ${pending ? 'مراجعة تغييرات الملف المركزي' : 'نتيجة المزامنة'}</div>
    ${warn}
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">الصفوف: ${(rep.classes || []).map(rsEsc).join('، ') || '—'}</div>
    <div style="max-height:55vh;overflow-y:auto">${body || '<div style="font-size:13px">✅ لا توجد تغييرات — كل شيء مطابق للملف المركزي.</div>'}</div>
    <div class="modal-actions">
      ${pending ? `<button class="btn btn-primary" style="flex:1" onclick="rosterApplyPending()">✅ تطبيق التغييرات</button>
                   <button class="btn btn-ghost" onclick="rosterDiscardPending()">لاحقاً</button>`
                : `<button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button>`}
    </div>`);
}

function rosterApplyPending() {
  if (!rosterPendingReport) return closeModalForce();
  const { plan, meta } = rosterPendingReport;
  rosterPendingReport = null;
  rosterCommit(plan, meta);
  rosterBtnState('ok');
  closeModalForce();
  toast('تم تطبيق تغييرات الملف المركزي', '👥');
}
function rosterDiscardPending() {
  rosterPendingReport = null;
  rosterBtnState('warn');
  closeModalForce();
}

/* ---------- الأرشيف (للعرض فقط عند المعلم) ---------- */
function rosterShowArchive() {
  const studs = state.archivedStudents || [];
  const clss = state.archivedClasses || [];
  const cRows = clss.map(a => `<div style="border-bottom:1px solid var(--border-color);padding:7px 0;font-size:12.5px">
      🏫 <b>${rsEsc(a.cls?.name)}</b> <span style="font-size:11px;color:var(--text-muted)">— ${(a.cls?.students || []).length} طالب — ${rsEsc(a.date || '')}</span></div>`).join('');
  const sRows = studs.map(a => {
    const s = a.student || {};
    return `<div style="border-bottom:1px solid var(--border-color);padding:7px 0;font-size:12.5px;line-height:1.6">
      <b>${rsEsc(s.name)}</b>${s.sid ? ' <span style="opacity:.6">(' + rsEsc(s.sid) + ')</span>' : ''}<br>
      <span style="font-size:11px;color:var(--text-muted)">${rsEsc(a.fromClass)} — ${rsEsc(a.reason || '')} — ${rsEsc(a.date || '')} — ⭐ ${s.points || 0}</span></div>`;
  }).join('');
  openModal(`
    <div class="modal-title">🗂️ الأرشيف</div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;line-height:1.8">
      طلاب وصفوف حُذفت من الملف المركزي أو لم تعد مُسندة إليك. بياناتها محفوظة، وترجع تلقائياً إذا أُعيدت في الملف المركزي.
    </div>
    <div style="max-height:55vh;overflow-y:auto">
      ${cRows ? '<div style="font-weight:800;font-size:12.5px;margin:4px 0">الصفوف</div>' + cRows : ''}
      ${sRows ? '<div style="font-weight:800;font-size:12.5px;margin:10px 0 4px">الطلاب</div>' + sRows : ''}
      ${(!cRows && !sRows) ? '<div style="font-size:13px">الأرشيف فارغ.</div>' : ''}
    </div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button></div>`);
}

/* ---------- عند فتح البرنامج + عند الرجوع للنافذة ---------- */
async function rosterInitOnLoad() {
  if (!state.archivedStudents) state.archivedStudents = [];
  if (!state.archivedClasses) state.archivedClasses = [];
  rosterApplyLockUI();
  rosterBtnState(state.rosterMeta && state.rosterMeta.lastSync ? 'ok' : 'none');
  if (!rsFsSupported() || typeof ljOpenDB !== 'function') return;
  try {
    rosterHandle = await rsIdb('get') || null;
    if (!rosterHandle) { if (rosterManaged()) rosterBtnState('locked'); return; }
    const perm = await rosterHandle.queryPermission({ mode: 'read' });
    if (perm !== 'granted') { rosterBtnState('locked'); return; }
    await rosterSyncNow({ interactive: false });
  } catch (e) { console.warn('roster init', e); }
}

function rosterOnFocus() {
  if (!rosterHandle || rosterPendingReport || document.visibilityState === 'hidden') return;
  rosterSyncNow({ interactive: false, onlyIfChanged: true });
}
window.addEventListener('focus', rosterOnFocus);
document.addEventListener('visibilitychange', rosterOnFocus);

/* =====================================================================
   الربط والإعداد (زر 🔗 واحد): الملف المركزي + ملف بياناتي على OneDrive
   + رمز المسؤول لمسح البيانات واستعادة النسخ الاحتياطية
   ===================================================================== */
const ADMIN_CODE = '131991';
function adminCodeOk(action) {
  const c = prompt('🔒 ' + action + '\nأدخل رمز المسؤول:');
  if (c === null) return false;
  if (String(c).trim() !== ADMIN_CODE) { alert('❌ الرمز غير صحيح'); return false; }
  return true;
}
// استعادة نسخة احتياطية: في الوضع المركزي برمز المسؤول فقط
function requestRestoreBackup() {
  if (rosterManaged() && !adminCodeOk('استعادة نسخة احتياطية (تستبدل بيانات المعلم الحالية)')) return;
  document.getElementById('importFile').click();
}

// حالة الزر الموحّد = أسوأ حالة بين الربطين
function setupBtnRefresh() {
  const btn = document.getElementById('btnSetup');
  if (!btn) return;
  const rIcon = document.getElementById('btnRoster')?.textContent.trim();
  const lIcon = document.getElementById('btnLinkJson')?.textContent.trim();
  const rosterOk = !!rosterHandle && rIcon === '👥' && rosterManaged();
  const fileOk = typeof linkedJsonHandle !== 'undefined' && !!linkedJsonHandle && lIcon !== '🔓';
  let icon = '🔗', title = 'الربط والإعداد';
  if (rIcon === '❗') { icon = '❗'; title = 'تعذّرت قراءة الملف المركزي — اضغط'; }
  else if (rIcon === '⚠️') { icon = '⚠️'; title = 'الملف المركزي يحتاج مراجعة — اضغط'; }
  else if (rIcon === '🔓' || lIcon === '🔓') { icon = '🔓'; title = 'اضغط لتفعيل الربط (إذن قراءة/كتابة الملفات)'; }
  else if (!rosterOk || !fileOk) title = 'الربط غير مكتمل — اضغط لإكماله';
  else title = 'مرتبط: الملف المركزي + ملف بياناتي';
  btn.innerHTML = icon + (icon === '🔗' && !(rosterOk && fileOk) ? '<span style="color:var(--absent);font-size:9px;vertical-align:top">●</span>' : '');
  btn.title = title;
}
(function watchSetupButtons() {
  const obs = new MutationObserver(setupBtnRefresh);
  ['btnRoster', 'btnLinkJson'].forEach(id => {
    const el = document.getElementById(id);
    if (el) obs.observe(el, { childList: true, characterData: true, subtree: true });
  });
})();

async function openSetup(firstRun) {
  if (rosterPendingReport) { rosterShowReport(rosterPendingReport.plan.rep, true); return; }
  const fs = rsFsSupported();
  const m = state.rosterMeta || {}, si = getSchoolInfo();
  const rIcon = document.getElementById('btnRoster')?.textContent.trim();
  const lIcon = document.getElementById('btnLinkJson')?.textContent.trim();
  const hasFile = typeof linkedJsonHandle !== 'undefined' && !!linkedJsonHandle;
  const step = (n, ok, title, status, buttons) => `
    <div style="border:1px solid ${ok ? 'rgba(78,205,196,.5)' : 'var(--border-color)'};border-radius:12px;padding:12px;margin-bottom:10px">
      <div style="font-weight:800;margin-bottom:4px">${ok ? '✅' : n} ${title}</div>
      <div style="font-size:12px;color:var(--text-muted);line-height:1.8;margin-bottom:8px">${status}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${buttons}</div>
    </div>`;
  const b = (cls, onclick, label) => `<button class="btn ${cls} btn-sm" onclick="${onclick}">${label}</button>`;

  // 1) الملف المركزي
  let s1, b1, ok1 = false;
  if (!rosterHandle) { s1 = rosterManaged() ? '🔒 البرنامج مُدار مركزياً، لكن الملف غير مرتبط على هذا المتصفح.' : 'ملف بيانات المدرسة (Excel) من مجلد OneDrive المشترك.'; b1 = fs ? b('btn-primary', 'rosterLinkFile()', '🔗 ربط الملف المركزي') : ''; }
  else if (rIcon === '🔓') { s1 = 'مرتبط بـ <b>' + rsEsc(rosterHandle.name) + '</b> — يحتاج إذن القراءة.'; b1 = b('btn-primary', 'closeModalForce();rosterSyncNow({interactive:true})', '🔓 تفعيل'); }
  else {
    ok1 = rIcon === '👥' && rosterManaged();
    s1 = 'مرتبط بـ <b>' + rsEsc(rosterHandle.name) + '</b>' + (m.lastSync ? ' — آخر مزامنة ' + new Date(m.lastSync).toLocaleString('ar') : '');
    b1 = b('btn-ghost', 'closeModalForce();rosterSyncNow({interactive:true})', '🔄 مزامنة الآن') + b('btn-ghost', 'showRosterMenu()', '⚙️ خيارات');
  }
  // 2) المعلم والصفوف
  const ok2 = rosterManaged() && Array.isArray(m.myClasses) && m.myClasses.length > 0;
  const s2 = ok2 ? `👤 <b>${rsEsc(si.teacher || '—')}</b>${si.subject ? ' — ' + rsEsc(si.subject) : ''}<br>🏫 ${m.myClasses.map(rsEsc).join('، ')}` : 'بعد ربط الملف المركزي: اختر اسمك ثم حدّد صفوفك.';
  const b2 = rosterHandle && rIcon === '👥' ? b(ok2 ? 'btn-ghost' : 'btn-primary', 'closeModalForce();rosterOpenClassPicker()', '🏫 صفوفي') : '';
  // 3) ملف بياناتي (حفظ تلقائي)
  let s3, b3, ok3 = false;
  if (!hasFile) { s3 = 'ملف JSON يُحفظ فيه كل ما تسجّله تلقائياً. أنشئه داخل مجلدك على OneDrive حتى تصل بياناتك إلى لوحة التحكم.'; b3 = fs ? b('btn-primary', "closeModalForce();pickAndLinkJson('new')", '🆕 إنشاء ملف جديد') + b('btn-ghost', "closeModalForce();pickAndLinkJson('open')", '📂 ربط ملف موجود') : ''; }
  else if (lIcon === '🔓') { s3 = 'مرتبط بـ <b>' + rsEsc(linkedJsonFileName) + '</b> — يحتاج إذن الكتابة.'; b3 = b('btn-primary', 'closeModalForce();onLinkJsonBtnClick()', '🔓 تفعيل'); }
  else {
    ok3 = true;
    s3 = 'مرتبط بـ <b>' + rsEsc(linkedJsonFileName) + '</b>' + (typeof ljLastActionText === 'function' ? ljLastActionText() : '');
    b3 = b('btn-ghost', 'closeModalForce();manualSyncNow()', '🔄 حفظ الآن') + b('btn-ghost', "closeModalForce();pickAndLinkJson('open')", '📂 تغيير الملف') + b('btn-danger', 'closeModalForce();unlinkJsonFile()', '✖ فك الربط');
  }
  openModal(`
    <div class="modal-title">🔗 الربط والإعداد</div>
    ${firstRun ? '<div style="font-size:12.5px;line-height:1.9;margin-bottom:10px">مرحباً 👋 ثلاث خطوات مرة واحدة فقط، وبعدها يعمل كل شيء تلقائياً.</div>' : ''}
    ${!fs ? '<div style="font-size:12px;color:var(--absent);margin-bottom:10px">⚠️ الربط يعمل في Chrome أو Edge على الكمبيوتر فقط.</div>' : ''}
    ${step('1️⃣', ok1, 'الملف المركزي للمدرسة', s1, b1)}
    ${step('2️⃣', ok2, 'اسمي وصفوفي', s2, b2)}
    ${step('3️⃣', ok3, 'ملف بياناتي (حفظ تلقائي)', s3, b3)}
    <div style="font-size:11.5px;color:var(--text-muted);line-height:1.8">💡 عندما يسألك المتصفح عن إذن الملفات اختر «السماح في كل زيارة» حتى لا يُطلب منك مرة أخرى.</div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModalForce();startTour()">🎓 جولة تعريفية</button>
      ${firstRun ? `<button class="btn btn-ghost" onclick="try{localStorage.setItem('nojomi_setup_later','1')}catch(e){};closeModalForce();maybeStartTour()">لاحقاً</button>` : ''}
      <button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button>
    </div>`);
}

// بعد اكتمال تحميل الربطين: تحديث الزر، وعرض الإعداد أول مرة
const _rosterInitOrig = rosterInitOnLoad;
rosterInitOnLoad = async function () {
  await _rosterInitOrig();
  setupBtnRefresh();
  if (typeof autoSelectCurrentPeriod === 'function') { renderTodayBar(); autoSelectCurrentPeriod(); }
  let later = false;
  try { later = localStorage.getItem('nojomi_setup_later') === '1'; } catch (e) {}
  const hasFile = typeof linkedJsonHandle !== 'undefined' && !!linkedJsonHandle;
  if (rsFsSupported() && !rosterManaged() && !rosterHandle && !hasFile && !later && !document.getElementById('modal-overlay')?.classList.contains('show')) openSetup(true);
  else if (typeof maybeStartTour === 'function') maybeStartTour();
};
