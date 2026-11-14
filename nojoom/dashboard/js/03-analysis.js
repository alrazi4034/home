/* 03-analysis.js — الحسابات: نواقص الغياب، غياب الطلاب، المعلمون، نجوم مدرستي، جودة البيانات */

/* ---------- الإعدادات (تُحفظ على هذا الجهاز) ---------- */
const SETTINGS_KEY = 'nojoomDashSettings';
const DEFAULT_SETTINGS = {
  periods: { 1: 8, 2: 8, 3: 8, 4: 8, 5: 4 },   // عدد الحصص: الاثنين..الخميس 8، الجمعة 4
  minDayRecords: 5,                            // يوم فيه أقل من هذا العدد من السجلات يُعتبر عطلة
  forceInclude: [], forceExclude: [],          // أيام يدوية
  chronicDays: 5                               // تنبيه الغياب المتكرر (أيام)
};
let SETTINGS = loadSettings();
function loadSettings() {
  try { return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); }
  catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
}
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (e) {} }

/* ---------- الأيام الدراسية ---------- */
// كل أيام الاثنين..الجمعة في المدى (وداخل الفصول الدراسية إن وُجد التقويم)، مع استبعاد العطل
function schoolDays(from, to) {
  const terms = MODEL.central.terms;
  const inTerm = d => !terms.length || terms.some(t => d >= t.start && d <= t.end);
  const activity = {};
  MODEL.form.records.forEach(r => { activity[r.date] = (activity[r.date] || 0) + 1; });
  MODEL.files.records.forEach(r => { activity[r.date] = (activity[r.date] || 0) + 1; });
  const days = [], excluded = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = weekday(d);
    if (!(SETTINGS.periods[wd] > 0) || !inTerm(d)) continue;
    const n = activity[d] || 0;
    const auto = n < SETTINGS.minDayRecords;
    const off = SETTINGS.forceExclude.includes(d) || (auto && !SETTINGS.forceInclude.includes(d));
    if (off) excluded.push({ date: d, records: n, manual: SETTINGS.forceExclude.includes(d) });
    else days.push(d);
  }
  return { days, excluded, activity };
}

/* ---------- نواقص الغياب ---------- */
// الحصة المتوقعة = كل صف × كل حصة في كل يوم دراسي.
// تُغطّى من الفورم (بالحصة)، أو من نجوم مدرستي (بالجدول إن وُجد، وإلا "حصة غير محددة").
function computeMissing(from, to, clsFilter) {
  const { days, excluded } = schoolDays(from, to);
  const daySet = new Set(days);
  const classes = MODEL.classes.filter(c => !clsFilter || c === clsFilter);
  const teachers = [...MODEL.teachers.values()];
  // من يدرّس الصف في هذه الحصة (حسب الجدول)
  const who = {};   // who[wd][p][cls] = [teacherKey]
  teachers.forEach(t => Object.entries(t.timetable || {}).forEach(([wd, slots]) =>
    Object.entries(slots).forEach(([p, cls]) => {
      ((who[wd] = who[wd] || {})[p] = who[wd][p] || {});
      (who[wd][p][cls] = who[wd][p][cls] || []).push(t.key);
    })));

  const slots = new Map();   // "date|cls|p" → {src, rec}
  let formCount = 0, nojoomCount = 0;
  MODEL.form.records.forEach(r => {
    if (!daySet.has(r.date) || !classes.includes(r.cls)) return;
    if (r.period > (SETTINGS.periods[weekday(r.date)] || 0)) return;
    slots.set(r.date + '|' + r.cls + '|' + r.period, { src: 'form', rec: r });
    formCount++;
  });
  const unplaced = new Map(); // "date|cls" → [records]
  MODEL.files.records.forEach(r => {
    if (!daySet.has(r.date) || !classes.includes(r.cls)) return;
    nojoomCount++;
    const t = MODEL.teachers.get(r.teacherKey);
    const tt = t && t.timetable && t.timetable[weekday(r.date)];
    // الأولوية: رقم الحصة الذي حدده المعلم في نجوم مدرستي، ثم جدول الحصص
    const maxP = SETTINGS.periods[weekday(r.date)] || 0;
    const ps = r.periods && r.periods.length ? r.periods.filter(p => p <= maxP).map(String)
             : tt ? Object.keys(tt).filter(p => tt[p] === r.cls) : [];
    if (ps.length) ps.forEach(p => { const k = r.date + '|' + r.cls + '|' + p; if (!slots.has(k)) slots.set(k, { src: 'nojoom', rec: r }); });
    else { const k = r.date + '|' + r.cls; (unplaced.get(k) || unplaced.set(k, []).get(k)).push(r); }
  });

  const missing = [], byClass = {}, byTeacher = {}, byDay = {};
  classes.forEach(c => byClass[c] = { cls: c, expected: 0, form: 0, nojoom: 0, unplaced: 0, missing: 0 });
  days.forEach(d => {
    const wd = weekday(d), P = SETTINGS.periods[wd] || 0;
    byDay[d] = { date: d, expected: 0, missing: 0 };
    classes.forEach(c => {
      let un = (unplaced.get(d + '|' + c) || []).length;
      for (let p = 1; p <= P; p++) {
        const bc = byClass[c];
        bc.expected++; byDay[d].expected++;
        const resp = (who[wd] && who[wd][p] && who[wd][p][c]) || [];
        resp.forEach(k => { const bt = byTeacher[k] = byTeacher[k] || { key: k, expected: 0, done: 0, missing: [] }; bt.expected++; });
        const s = slots.get(d + '|' + c + '|' + p);
        if (s) {
          bc[s.src]++;
          resp.forEach(k => byTeacher[k].done++);
          continue;
        }
        if (un > 0) { un--; bc.unplaced++; slots.set(d + '|' + c + '|' + p, { src: 'unplaced', rec: (unplaced.get(d + '|' + c))[0] }); resp.forEach(k => byTeacher[k].done++); continue; }
        bc.missing++; byDay[d].missing++;
        const m = { date: d, wd, period: p, cls: c, teachers: resp };
        missing.push(m);
        resp.forEach(k => byTeacher[k].missing.push(m));
      }
    });
  });
  const expected = Object.values(byClass).reduce((n, c) => n + c.expected, 0);
  return { days, excluded, slots, missing, byClass, byTeacher, byDay, expected, formCount, nojoomCount,
           covered: expected - missing.length, classes };
}

/* ---------- غياب الطلاب ---------- */
function computeAbsence(from, to, clsFilter, miss) {
  const daySet = new Set(miss.days);
  const per = new Map();   // sid|name → {sid, name, cls, days:Set, periods, events:[]}
  const daily = {};
  miss.days.forEach(d => daily[d] = new Set());
  const add = (a, rec, period) => {
    const info = a.sid ? studentInfo(a.sid, a.name) : { sid: '', name: a.name, cls: rec.cls };
    const cls = info.cls || rec.cls;
    if (clsFilter && cls !== clsFilter) return;
    const k = a.sid || 'n:' + normName(a.name);
    const st = per.get(k) || per.set(k, { sid: a.sid, name: info.name, cls, days: new Set(), periods: 0, events: [] }).get(k);
    st.days.add(rec.date); st.periods++;
    st.events.push({ date: rec.date, period, cls: rec.cls, src: rec.src, teacher: rec.src === 'form' ? teacherName(rec.teacherKey) : rec.teacherName });
    daily[rec.date] && daily[rec.date].add(k);
  };
  miss.slots.forEach((s, key) => {
    const [d, cls, p] = key.split('|');
    if (!daySet.has(d)) return;
    (s.rec.absent || []).forEach(a => add(a, s.rec, s.src === 'form' ? +p : null));
  });
  // سجلات نجوم مدرستي غير المُستخدمة في الشبكة (فائض) تُحتسب أيضاً كأيام غياب
  const used = new Set([...miss.slots.values()].map(s => s.rec));
  MODEL.files.records.forEach(r => {
    if (!daySet.has(r.date) || used.has(r) || (clsFilter && r.cls !== clsFilter)) return;
    r.absent.forEach(a => add(a, r, null));
  });
  const students = [...per.values()].map(s => Object.assign(s, { dayCount: s.days.size }))
    .sort((a, b) => b.dayCount - a.dayCount || b.periods - a.periods);
  const totalStudents = clsFilter ? [...MODEL.central.students.values()].filter(s => s.cls === clsFilter).length : MODEL.central.students.size;
  const byClass = {};
  MODEL.classes.filter(c => !clsFilter || c === clsFilter).forEach(c => {
    const size = [...MODEL.central.students.values()].filter(s => s.cls === c).length;
    byClass[c] = { cls: c, size, studentDays: 0, periods: 0, students: 0 };
  });
  students.forEach(s => { const b = byClass[s.cls]; if (b) { b.studentDays += s.dayCount; b.periods += s.periods; b.students++; } });
  Object.values(byClass).forEach(b => b.rate = b.size && miss.days.length ? b.studentDays / (b.size * miss.days.length) : 0);
  const dailyList = miss.days.map(d => ({ date: d, count: daily[d].size, rate: totalStudents ? daily[d].size / totalStudents : 0 }));
  return { students, byClass, daily: dailyList, totalStudents };
}

/* ---------- المعلمون ---------- */
function computeTeachers(from, to, miss) {
  const daySet = new Set(miss.days);
  const rows = new Map();
  MODEL.teachers.forEach(t => rows.set(t.key, { t, form: 0, nojoom: 0, last: '', file: null, expected: 0, done: 0, missing: 0 }));
  MODEL.form.records.forEach(r => {
    const row = rows.get(r.teacherKey); if (!row) return;
    if (r.date > row.last && r.date <= to) row.last = r.date;
    if (daySet.has(r.date)) row.form++;
  });
  MODEL.files.records.forEach(r => {
    const row = rows.get(r.teacherKey); if (!row) return;
    if (r.date > row.last && r.date <= to) row.last = r.date;
    if (daySet.has(r.date)) row.nojoom++;
  });
  MODEL.files.teachers.forEach(f => { const row = rows.get(f.key); if (row) row.file = f; });
  Object.values(miss.byTeacher).forEach(b => { const row = rows.get(b.key); if (row) { row.expected = b.expected; row.done = b.done; row.missing = b.missing.length; } });
  return [...rows.values()];
}

/* ---------- نجوم مدرستي (من ملفات المعلمين) ---------- */
function computeStars(clsFilter) {
  const per = new Map();
  MODEL.files.teachers.forEach(t => t.classes.forEach(c => c.students.forEach(s => {
    const info = s.sid ? studentInfo(s.sid, s.name) : { name: s.name, cls: c.name };
    const cls = info.cls || c.name;
    if (clsFilter && cls !== clsFilter) return;
    const k = s.sid || 'n:' + normName(s.name);
    const st = per.get(k) || per.set(k, { sid: s.sid, name: info.name, cls, points: 0, notes: 0, teachers: [] }).get(k);
    st.points += s.points; st.notes += s.notes;
    st.teachers.push({ name: t.name, points: s.points });
  })));
  const list = [...per.values()].sort((a, b) => b.points - a.points);
  const teachers = MODEL.files.teachers.map(t => {
    const studs = t.classes.flatMap(c => c.students);
    return { name: t.name, subject: t.subject, file: t.file, exportDate: t.exportDate, modified: t.modified,
      classes: t.classes.map(c => c.name), students: studs.length,
      points: studs.reduce((n, s) => n + s.points, 0), notes: studs.reduce((n, s) => n + s.notes, 0),
      sessions: t.classes.reduce((n, c) => n + c.savedDates.length, 0) };
  });
  return { list, teachers };
}

/* ---------- جودة البيانات ---------- */
function computeQuality(miss) {
  const q = [];
  const today = todayISO();
  const fi = MODEL.form.issues;
  if (fi.badEmail.size) q.push({ title: 'إيميلات في نموذج الغياب غير موجودة في صفحة المعلمين', count: [...fi.badEmail.values()].reduce((a, b) => a + b, 0),
    detail: [...fi.badEmail.entries()].map(([e, n]) => `${e} — ${n} سجل`) });
  if (fi.badClass.size) q.push({ title: 'أسماء صفوف في النموذج لم تُفهم', count: fi.badClass.size, detail: [...fi.badClass.entries()].map(([c, n]) => `${c} — ${n}`) });
  const terms = MODEL.central.terms;
  const odd = MODEL.form.records.filter(r => r.date > today || weekday(r.date) === 0 || weekday(r.date) === 6 ||
    (terms.length && !terms.some(t => r.date >= t.start && r.date <= t.end)));
  if (odd.length) q.push({ title: 'سجلات بتاريخ في المستقبل أو عطلة نهاية الأسبوع أو خارج الفصول', count: odd.length,
    detail: odd.slice(0, 50).map(r => `${r.date} (${DAY_NAMES[weekday(r.date)]}) — ${r.cls} حصة ${r.period} — ${teacherName(r.teacherKey)}`) });
  if (fi.dup) q.push({ title: 'تكرار تسجيل نفس الحصة في النموذج (اعتُمد آخر تسجيل)', count: fi.dup, detail: [] });
  if (fi.unknownSid.size) q.push({ title: 'طلاب في النموذج برقم غير موجود في الملف المركزي', count: fi.unknownSid.size,
    detail: [...fi.unknownSid.entries()].map(([sid, n]) => `${n} (${sid})`) });
  if (fi.badJson) q.push({ title: 'خانة الغائبين بصيغة غير سليمة (قُرئت بطريقة بديلة)', count: fi.badJson, detail: [] });
  const noEmail = MODEL.central.teachers.filter(t => !t.email);
  if (noEmail.length) q.push({ title: 'معلمون بدون بريد إلكتروني في الملف المركزي', count: noEmail.length, detail: noEmail.map(t => t.name) });
  const badPhone = MODEL.central.teachers.filter(t => !t.phone || !/^9715\d{8}$/.test(t.phone));
  if (badPhone.length) q.push({ title: 'أرقام واتساب للمعلمين ناقصة أو غير صحيحة (لا يصل التذكير)', count: badPhone.length,
    detail: badPhone.map(t => `${t.name} — ${t.phone || 'لا يوجد رقم'}`) });
  const noTT = MODEL.central.teachers.filter(t => !t.hasTimetable && t.classes.length);
  if (noTT.length) q.push({ title: 'معلمون بدون جدول حصص (لا يمكن تحديد المسؤول عن الحصة الناقصة)', count: noTT.length, detail: noTT.map(t => t.name) });
  if (MODEL.files.issues.bad.length) q.push({ title: 'ملفات JSON لم تُقرأ', count: MODEL.files.issues.bad.length, detail: MODEL.files.issues.bad });
  if (MODEL.files.issues.noIdentity.length) q.push({ title: 'ملفات معلمين بدون مطابقة لاسم/بريد في الملف المركزي', count: MODEL.files.issues.noIdentity.length, detail: MODEL.files.issues.noIdentity });
  if (miss && miss.excluded.length) q.push({ title: 'أيام استُبعدت كعطلة (سجلات قليلة جداً) — يمكن تغييرها من الإعدادات', count: miss.excluded.length,
    detail: miss.excluded.map(e => `${e.date} (${DAY_NAMES[weekday(e.date)]}) — ${e.records} سجل${e.manual ? ' — يدوي' : ''}`) });
  RAW.errors.forEach(e => q.push({ title: e, count: 1, detail: [] }));
  return q;
}
