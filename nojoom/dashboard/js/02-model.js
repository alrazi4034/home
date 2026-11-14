/* 02-model.js — تحويل الملفات المقروءة إلى نموذج بيانات موحّد (MODEL)
   الصف دائماً بصيغة "5/1"، والتاريخ "YYYY-MM-DD"، والمعلم بمفتاح = البريد (أو الاسم إن لم يوجد بريد). */

let MODEL = null;

/* ---------- أدوات تحويل ---------- */
const AR_GRADES = { 'الأول':1,'الاول':1,'الثاني':2,'الثالث':3,'الرابع':4,'الخامس':5,'السادس':6,'السابع':7,'الثامن':8,
  'التاسع':9,'العاشر':10,'الحادي عشر':11,'الحادى عشر':11,'الثاني عشر':12,'الثانى عشر':12 };
const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function normName(n) {
  return String(n || '').replace(/[ً-ْـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
}
// رقم إماراتي بصيغة 971XXXXXXXXX (لروابط واتساب)
function normPhone(raw) {
  let d = String(raw || '').replace(/[^0-9]/g, '');
  if (!d) return '';
  if (d.startsWith('00971')) d = d.slice(2);
  else if (d.startsWith('05')) d = '971' + d.slice(1);
  else if (/^5\d{8}$/.test(d)) d = '971' + d;
  return d;
}
function normEmail(e) { return String(e || '').trim().toLowerCase().replace(/^tid-/, ''); }
function clsFromCode(code) {
  code = String(code == null ? '' : code).replace(/\s+/g, '');
  if (!code || code === '0') return '';
  if (code.includes('/')) return code;
  return code.length >= 2 ? code[0] + '/' + code.slice(1) : '';
}
function clsFromForm(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  const m = s.match(/^(.+?)\s*[\/\-]\s*(\d+)$/);
  if (m) {
    const g = AR_GRADES[m[1].trim()] || (/^\d+$/.test(m[1].trim()) ? +m[1].trim() : null);
    if (g) return g + '/' + m[2];
  }
  return clsFromCode(s);
}
function splitNameId(str) {
  const t = String(str || '').trim();
  const m = t.match(/^(.*?)\s*[(（]\s*([^()（）]*\d[^()（）]*?)\s*[)）]\s*$/);
  return m && m[1].trim() ? { name: m[1].trim(), sid: m[2].trim() } : { name: t, sid: '' };
}
function pad(n) { return String(n).padStart(2, '0'); }
// تاريخ من Excel (رقم تسلسلي أو نص أو Date) → YYYY-MM-DD
function toISO(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : '';
  }
  if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return '';
}
function toDateTime(v) {
  if (typeof v === 'number') { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${pad(d.m)}-${pad(d.d)} ${pad(d.H)}:${pad(d.M)}` : ''; }
  return String(v || '').replace('T', ' ').slice(0, 16);
}
// تاريخ الملاحظة: isoDate، وإلا "dd/mm/yyyy" (قد يحتوي علامات اتجاه)
function noteISO(n) {
  if (n.isoDate) return toISO(n.isoDate);
  const t = String(n.date || '').replace(/[\u200e\u200f\u061c]/g, '');
  return toISO(t);
}
function weekday(iso) { return new Date(iso + 'T00:00:00Z').getUTCDay(); }          // 0=الأحد … 5=الجمعة
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function sheetRows(wb, name, header) {
  const ws = wb.Sheets[name];
  return ws ? XLSX.utils.sheet_to_json(ws, header ? { header: 1, defval: '' } : { defval: '' }) : [];
}
function findSheet(wb, ...names) {
  for (const n of names) { const f = wb.SheetNames.find(s => s.trim() === n); if (f) return f; }
  for (const n of names) { const f = wb.SheetNames.find(s => s.includes(n)); if (f) return f; }
  return null;
}

/* ---------- الملف المركزي ---------- */
function parseCentral(wb) {
  const out = { students: new Map(), classes: [], teachers: [], terms: [], school: {}, issues: [] };
  if (!wb) return out;

  // الطلاب
  const stSheet = findSheet(wb, 'جميع الطلاب');
  const classSet = new Set();
  sheetRows(wb, stSheet).forEach(r => {
    const cls = clsFromCode(r['الصف']);
    const p = splitNameId(r['اسم الطالب']);
    const name = p.name || String(r['NAME IN ARABIC'] || '').trim();
    const sid = String(r['رقم الطالب'] == null ? '' : r['رقم الطالب']).trim() || p.sid;
    if (!cls || !name) return;
    classSet.add(cls);
    if (sid) out.students.set(sid, { sid, name, cls, phone: String(r['رقم التواصل'] || '') });
  });

  // المعلمون والجداول: الأيام = سلاسل مثل "0-0-0-52-0-62-63-0" (قيمة لكل حصة)
  const tSheet = findSheet(wb, 'المعلمين والجداول', 'المعلمين');
  const dayCols = { 'الاثنين': 1, 'الثلاثاء': 2, 'الأربعاء': 3, 'الاربعاء': 3, 'الخميس': 4, 'الجمعة': 5 };
  const tMap = new Map();
  sheetRows(wb, tSheet).forEach(r => {
    const H = Object.keys(r);
    const get = kws => { const h = H.find(h => kws.some(k => h.toLowerCase().includes(k))); return h ? r[h] : ''; };
    const name = String(get(['اسم']) || '').trim();
    const email = normEmail(get(['بريد', 'email', 'ايميل']));
    const key = email || normName(name);
    if (!key) return;
    const t = tMap.get(key) || { key, name, email, phone: '', subjects: [], classes: [], timetable: {}, hasTimetable: false };
    const ph = normPhone(get(['التواصل', 'جوال', 'هاتف', 'phone', 'mobile']));
    if (ph && !t.phone) t.phone = ph;
    const sub = String(get(['ماد', 'subject']) || '').trim();
    if (sub && !t.subjects.includes(sub)) t.subjects.push(sub);
    String(get(['الصفوف', 'صفوف']) || '').split(/[-,،;\s]+/).map(clsFromCode).filter(Boolean)
      .forEach(c => { if (!t.classes.includes(c)) t.classes.push(c); });
    H.forEach(h => {
      const wd = dayCols[h.trim()];
      if (!wd) return;
      const slots = String(r[h] || '').split('-');
      // سلسلة تبدأ بـ "-" تعني أن الحصة الأولى فارغة
      slots.forEach((v, i) => {
        const c = clsFromCode(v);
        if (!c) return;
        (t.timetable[wd] = t.timetable[wd] || {})[i + 1] = c;
        t.hasTimetable = true;
      });
    });
    tMap.set(key, t);
  });
  out.teachers = [...tMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  // التقويم: اسم المدرسة + أسابيع الفصول
  const cSheet = findSheet(wb, 'التقويم المدرسي', 'التقويم');
  const cal = sheetRows(wb, cSheet, true);
  const hi = cal.findIndex(row => row.some(v => String(v).includes('اسم المدرسة')));
  if (hi >= 0 && cal[hi + 1]) {
    const hdr = cal[hi], val = cal[hi + 1];
    hdr.forEach((h, i) => {
      if (String(h).includes('اسم المدرسة')) out.school.name = String(val[i] || '').trim();
      if (String(h).includes('مدير')) out.school.principal = String(val[i] || '').trim();
      if (String(h).includes('صفوف المدرسة')) String(val[i] || '').split(/[-,،\s]+/).map(clsFromCode).filter(Boolean).forEach(c => classSet.add(c));
      if (String(h).includes('العام')) out.school.year = String(val[i] || '').trim();
    });
  }
  const ti = cal.findIndex(row => row.some(v => String(v).includes('الفصل الدراسي')));
  if (ti >= 0) {
    const hdr = cal[ti];
    for (let c = 0; c < hdr.length; c += 2) {
      const tname = String(hdr[c] || '').trim();
      if (!tname) continue;
      const weeks = [];
      for (let r = ti + 1; r < cal.length; r++) { const d = toISO(cal[r][c + 1]); if (d) weeks.push(d); }
      if (weeks.length) out.terms.push({ name: tname, start: weeks[0], end: addDays(weeks[weeks.length - 1], 4), weeks });
    }
  }
  out.classes = [...classSet].sort((a, b) => a.localeCompare(b, 'ar', { numeric: true }));
  return out;
}

/* ---------- نموذج الغياب (Forms) ---------- */
function parseForm(wb, central) {
  const out = { records: [], issues: { badEmail: new Map(), badClass: new Map(), badDate: [], dup: 0, badJson: 0, unknownSid: new Map() } };
  if (!wb) return out;
  const sh = findSheet(wb, 'الغياب') || wb.SheetNames[0];
  const rows = sheetRows(wb, sh);
  if (!rows.length) return out;
  const H = Object.keys(rows[0]);
  const col = kws => H.find(h => kws.some(k => h.toLowerCase().includes(k)));
  const cId = col(['id']), cTime = col(['completion', 'وقت']), cEmail = col(['email', 'بريد']),
        cDate = col(['التاريخ', 'date']), cPer = col(['الحصة', 'period']), cCls = col(['الصف', 'class']), cAbs = col(['الغائب', 'absent']);
  const teacherByEmail = new Map(central.teachers.filter(t => t.email).map(t => [t.email, t]));
  const latest = new Map();
  rows.forEach((r, i) => {
    const email = normEmail(r[cEmail]);
    const date = toISO(r[cDate]);
    const period = parseInt(r[cPer], 10);
    const cls = clsFromForm(r[cCls]);
    if (!cls) { out.issues.badClass.set(String(r[cCls]), (out.issues.badClass.get(String(r[cCls])) || 0) + 1); return; }
    if (!date || !period) { out.issues.badDate.push({ row: i + 2, date: r[cDate], why: 'تاريخ أو حصة غير صالحة' }); return; }
    if (email && !teacherByEmail.has(email)) out.issues.badEmail.set(email, (out.issues.badEmail.get(email) || 0) + 1);
    let absent = [];
    const raw = r[cAbs];
    if (raw) {
      let list = null;
      try { list = JSON.parse(raw); } catch (e) { out.issues.badJson++; }
      if (!Array.isArray(list)) list = String(raw).match(/[^",\[\]]+?\s*\([^()]+\)/g) || [];
      absent = list.map(x => splitNameId(x)).filter(x => x.name);
      absent.forEach(a => {
        if (a.sid && central.students.size && !central.students.has(a.sid))
          out.issues.unknownSid.set(a.sid, a.name + ' — ' + cls);
      });
    }
    const rec = { id: Number(r[cId]) || i, time: toDateTime(r[cTime]), email, teacherKey: teacherByEmail.has(email) ? email : (email || ''),
                  date, period, cls, absent, src: 'form' };
    const k = date + '|' + cls + '|' + period;
    const prev = latest.get(k);
    if (prev) { out.issues.dup++; if (prev.id > rec.id) return; }
    latest.set(k, rec);
  });
  out.records = [...latest.values()];
  return out;
}

/* ---------- ملفات المعلمين (نجوم مدرستي) ---------- */
function parseTeacherFiles(files, central) {
  const out = { teachers: [], records: [], issues: { bad: [], noIdentity: [] } };
  const byEmail = new Map(central.teachers.filter(t => t.email).map(t => [t.email, t]));
  const byName = new Map(central.teachers.map(t => [normName(t.name), t]));
  // رقم الطالب بالاسم (لملفات قديمة بدون أرقام): بالاسم داخل الصف، ثم بالاسم إن كان فريداً
  const sidByClsName = new Map(), sidByName = new Map(), dupName = new Set();
  central.students.forEach(s => {
    sidByClsName.set(s.cls + '|' + normName(s.name), s.sid);
    const k = normName(s.name);
    if (sidByName.has(k)) dupName.add(k); else sidByName.set(k, s.sid);
  });
  const guessSid = (name, cls) => sidByClsName.get(cls + '|' + normName(name)) || (!dupName.has(normName(name)) && sidByName.get(normName(name))) || '';
  files.forEach(f => {
    let d;
    try { d = JSON.parse(f.text); } catch (e) { out.issues.bad.push(f.path); return; }
    if (!d || !Array.isArray(d.classes)) { out.issues.bad.push(f.path); return; }
    const si = d.schoolInfo || {};
    const email = normEmail(si.teacherEmail || d.teacherEmail || (d.rosterMeta && d.rosterMeta.teacherKey && d.rosterMeta.teacherKey.includes('@') ? d.rosterMeta.teacherKey : ''));
    const tname = String(si.teacher || d.teacher || '').trim();
    // مطابقة المعلم: بالبريد، ثم بالاسم الكامل، ثم بكلمات الاسم (مثل "محمود شحادة" ↔ "محمود زكي شحادة")
    let ct = (email && byEmail.get(email)) || byName.get(normName(tname)) || null;
    if (!ct && tname) {
      const words = normName(tname).split(' ').filter(w => w.length > 1);
      const cands = central.teachers.filter(t => { const tw = normName(t.name).split(' '); return words.length >= 2 && words.every(w => tw.includes(w)); });
      if (cands.length === 1) ct = cands[0];
    }
    const key = ct ? ct.key : (email || normName(tname) || 'file:' + f.path);
    if (!ct) out.issues.noIdentity.push(f.path + (tname ? ' (' + tname + ')' : ''));
    const t = {
      key, file: f.path, modified: f.modified, exportDate: d.exportDate || '',
      name: ct ? ct.name : (tname || f.path), subject: si.subject || d.subject || (ct ? ct.subjects.join('، ') : ''),
      classes: d.classes.map(c => ({
        name: c.name, savedDates: c._savedDates || [], savedPeriods: c._savedPeriods || {},
        students: (c.students || []).map(s => {
          const p = splitNameId(s.name);
          const notes = (s.behaviorNotes || []).map(n => ({ type: n.type, text: String(n.text || ''), code: n.code || '', date: noteISO(n) }));
          return { sid: s.sid || p.sid || guessSid(p.name, c.name), name: p.name, points: s.points || 0, absenceDates: s.absenceDates || [],
                   notes: notes.length, noteList: notes, present: s.present || 0, lateDates: s.lateDates || [],
                   log: (s.pointsLog || []).map(e => ({ date: toISO(e.date), pts: e.pts || 0 })) };
        })
      }))
    };
    out.teachers.push(t);
    t.classes.forEach(c => (c.savedDates || []).forEach(date => {
      const iso = toISO(date);
      if (!iso) return;
      out.records.push({ teacherKey: key, teacherName: t.name, cls: c.name, date: iso, src: 'nojoom',
        periods: ((c.savedPeriods || {})[date] || []).map(Number).filter(p => p > 0),   // رقم الحصة إن حدده المعلم
        absent: c.students.filter(s => s.absenceDates.includes(date)).map(s => ({ sid: s.sid, name: s.name })) });
    }));
  });
  return out;
}

function buildModel() {
  const central = parseCentral(RAW.central);
  const form = parseForm(RAW.form, central);
  const files = parseTeacherFiles(RAW.files, central);
  // أسماء المعلمين: من المركزي + أي بريد ظهر في الفورم أو ملف بلا مطابقة
  const teachers = new Map(central.teachers.map(t => [t.key, Object.assign({ known: true }, t)]));
  form.records.forEach(r => {
    if (r.teacherKey && !teachers.has(r.teacherKey))
      teachers.set(r.teacherKey, { key: r.teacherKey, name: r.teacherKey, email: r.teacherKey, subjects: [], classes: [], timetable: {}, hasTimetable: false, known: false });
  });
  files.teachers.forEach(f => {
    if (!teachers.has(f.key)) teachers.set(f.key, { key: f.key, name: f.name, email: '', subjects: f.subject ? [f.subject] : [], classes: f.classes.map(c => c.name), timetable: {}, hasTimetable: false, known: false });
  });
  const classes = central.classes.length ? central.classes
    : [...new Set(form.records.map(r => r.cls).concat(files.records.map(r => r.cls)))].sort((a, b) => a.localeCompare(b, 'ar', { numeric: true }));
  MODEL = { central, form, files, teachers, classes };
  return MODEL;
}

function studentInfo(sid, fallbackName) {
  const s = MODEL.central.students.get(sid);
  return s || { sid, name: fallbackName || sid, cls: '' };
}
function teacherName(key) { const t = MODEL.teachers.get(key); return t ? t.name : (key || 'غير معروف'); }
