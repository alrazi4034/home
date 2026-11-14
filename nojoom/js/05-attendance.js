/* 05-attendance.js — الحضور، استيراد الغياب من برنامج الحضور، المشاركة، تصفير البيانات */

// ===== ATTENDANCE =====
// حالة الطالب: unmarked → present → late (حاضر + متأخر) → absent
function attLabel(s) {
  const att = s._todayAtt || 'unmarked';
  if (att === 'present') return s._todayLate ? '⏰ متأخر' : '✅ حاضر';
  return att === 'absent' ? '❌ غائب' : '○ ؟';
}
function attClass(s) { const att = s._todayAtt || 'unmarked'; return att + (att === 'present' && s._todayLate ? ' late' : ''); }
function lateCount(cls, s) { return (s.lateDates || []).filter(d => (cls._savedDates || []).includes(d)).length; }
function attMeta(cls, s) {
  const late = lateCount(cls, s);
  return `حاضر: ${s.present} | غائب: ${s.absent}${late ? ' | متأخر: ' + late : ''} | مشاركة: ${s.participation}`;
}

/* ===== رقم الحصة عند حفظ الحضور =====
   يختار المعلم حصة أو أكثر. الافتراضي: الحصص المحفوظة لهذا التاريخ، وإلا حصص آخر يوم مماثل (نفس اليوم من الأسبوع) لنفس الصف. */
const PERIODS_BY_WEEKDAY = { 5: 4 };   // الجمعة 4 حصص، وباقي الأيام 8
let selPeriods = new Set(), selPeriodsCtx = '';
function periodsCount(date) {
  const bell = typeof bellForDate === 'function' && bellForDate(date);   // من «توقيت الحصص» إن وُجد
  if (bell) return Math.max(...bell.map(b => b.p));
  const wd = new Date(date + 'T12:00:00').getDay(); return PERIODS_BY_WEEKDAY[wd] || 8;
}
function defaultPeriods(cls, date) {
  const sp = cls._savedPeriods || {};
  if (sp[date] && sp[date].length) return sp[date];
  // من جدول المعلم في الملف المركزي (أو ما تعلّمه البرنامج) لهذا اليوم
  if (typeof myScheduleFor === 'function') {
    const mine = myScheduleFor(date).filter(x => x.cls.id === cls.id).map(x => x.p);
    if (mine.length) return mine;
  }
  const wd = new Date(date + 'T12:00:00').getDay();
  const prev = Object.keys(sp).filter(d => d < date && sp[d] && sp[d].length && new Date(d + 'T12:00:00').getDay() === wd).sort().pop();
  return prev ? sp[prev] : [];
}
function renderPeriodChips() {
  const box = document.getElementById('period-chips');
  const cls = state.classes.find(c => c.id === state.activeClass);
  if (!box) return;
  if (!cls) { box.innerHTML = ''; return; }
  const ctx = cls.id + '|' + sessionDate;
  if (ctx !== selPeriodsCtx) { selPeriodsCtx = ctx; selPeriods = new Set(defaultPeriods(cls, sessionDate)); }
  const n = periodsCount(sessionDate);
  [...selPeriods].forEach(p => { if (p > n) selPeriods.delete(p); });
  const saved = (cls._savedPeriods || {})[sessionDate];
  box.innerHTML = `<span style="font-size:12px;font-weight:800;color:var(--text-muted)">الحصة:</span>` +
    Array.from({ length: n }, (_, i) => i + 1).map(p =>
      `<button class="flt-btn ${selPeriods.has(p) ? 'flt-btn-on' : ''}" style="min-width:34px;padding:4px 8px" onclick="togglePeriod(${p})">${p}</button>`).join('') +
    (saved && saved.length ? `<span style="font-size:11px;color:var(--present)">✓ محفوظ: ${saved.join('، ')}</span>` : '');
  if (typeof renderTodayBar === 'function') renderTodayBar();
}
function togglePeriod(p) {
  if (selPeriods.has(p)) selPeriods.delete(p); else selPeriods.add(p);
  renderPeriodChips();
}

function renderStudentList() {
  const container = document.getElementById('student-list-container');
  const cls = state.classes.find(c => c.id === state.activeClass);
  if (!cls) { container.innerHTML = `<div class="empty-state"><div class="icon">🏫</div><p>أضف صفاً أولاً</p></div>`; return; }
  if (!cls.students.length) { container.innerHTML = `<div class="card"><div class="empty-state"><div class="icon">👤</div><p>لا يوجد طلاب في هذا الصف</p></div></div>`; return; }

  const rows = cls.students.map(s => {
    const att = attClass(s);
    const attIcon = attLabel(s);
    return `
      <div class="student-row" id="srow-${s.id}">
        <div class="student-avatar">${s.name.charAt(0)}</div>
        <div class="student-info">
          <div class="student-name">${s.name}</div>
          <div class="student-meta" id="meta-${s.id}">${attMeta(cls, s)}</div>
        </div>
        <div class="student-actions">
          <span id="sptsday-${s.id}" style="display:inline-flex;align-items:center;gap:1px;font-size:12px;font-weight:900;min-width:32px;justify-content:center;transition:all 0.25s;color:var(--text-muted);text-shadow:none;letter-spacing:0.3px">+0</span>
          <div class="points-badge" id="pts-${s.id}">⭐ ${s.points}</div>
          <button class="att-btn ${att}" id="att-${s.id}" onclick="toggleAttendance(${cls.id},${s.id})" title="تغيير الحضور">${attIcon}</button>
          <button class="part-btn" onclick="addParticipation(${cls.id},${s.id})">✋ +1</button>
          <button class="part-btn deduct" onclick="subtractPoint(${cls.id},${s.id})">➖</button>
          <button class="part-btn note" onclick="showAddNoteFromAttendance(${s.id},'${s.name.replace(/'/g,"\\'")}',' ${(s.parentPhone||'').replace(/'/g,"\\'")}')\ " title="إضافة ملاحظة سلوكية">📝 ملاحظة</button>
        </div>
      </div>`;
  }).join('');
  container.innerHTML = `<div class="card">${rows}</div>`;
  updateSessionSummary(cls);
  renderPeriodChips();
  // استعادة العدادات اليومية في الواجهة بعد إعادة الرسم
  setTimeout(() => cls.students.forEach(s => _updateTempCounterUI(s.id)), 0);
  renderLetterFilter();
  applyLetterFilter();
}

function toggleAttendance(classId, studentId) {
  const cls = state.classes.find(c => c.id === classId);
  const s = cls.students.find(st => st.id === studentId);
  const cur = s._todayAtt || 'unmarked';
  // حاضر → متأخر → غائب → فارغ
  let next;
  if (cur === 'unmarked') { next = 'present'; s._todayLate = false; }
  else if (cur === 'present' && !s._todayLate) { next = 'present'; s._todayLate = true; }
  else if (cur === 'present') { next = 'absent'; s._todayLate = false; }
  else { next = 'unmarked'; s._todayLate = false; }
  s._todayAtt = next;
  const btn = document.getElementById('att-' + studentId);
  btn.className = 'att-btn ' + attClass(s);
  btn.textContent = attLabel(s);
  updateSessionSummary(cls);
  const row = document.getElementById('srow-' + studentId);
  row.style.transition = 'background 0.3s';
  row.style.background = s._todayLate ? 'rgba(255,169,77,0.08)' : next === 'present' ? 'rgba(78,205,196,0.07)' : next === 'absent' ? 'rgba(255,107,107,0.07)' : '';
  setTimeout(() => { row.style.background = ''; }, 600);
  save();
  _updateTempCounterUI(studentId);
}

function markAllPresent() {
  const cls = state.classes.find(c => c.id === state.activeClass);
  if (!cls) return;
  cls.students.forEach(s => { s._todayAtt = 'present'; s._todayLate = false; });
  renderStudentList();
  toast('تم تسجيل حضور جميع الطلاب', '✅');
}

function markAllAbsent() {
  const cls = state.classes.find(c => c.id === state.activeClass);
  if (!cls) return;
  cls.students.forEach(s => { s._todayAtt = 'absent'; s._todayLate = false; });
  renderStudentList();
  toast('تم تسجيل غياب جميع الطلاب', '❌');
}

function updateSessionSummary(cls) {
  const present = cls.students.filter(s => s._todayAtt === 'present').length;
  const absent = cls.students.filter(s => s._todayAtt === 'absent').length;
  const unmarked = cls.students.filter(s => !s._todayAtt || s._todayAtt === 'unmarked').length;
  const late = cls.students.filter(s => s._todayAtt === 'present' && s._todayLate).length;
  document.getElementById('session-summary').textContent = `حاضر: ${present}${late ? ' (منهم ' + late + ' متأخر)' : ''} | غائب: ${absent} | لم يُسجَّل: ${unmarked}`;
}

function saveSession() {
  const cls = state.classes.find(c => c.id === state.activeClass);
  if (!cls) return toast('اختر صفاً أولاً', '⚠️');
  if (!selPeriods.size) {
    const box = document.getElementById('period-chips');
    if (box) { box.style.outline = '2px solid var(--absent)'; box.style.borderRadius = '10px'; setTimeout(() => box.style.outline = '', 1800); }
    return toast('اختر رقم الحصة أولاً (أعلى القائمة)', '⚠️');
  }

  const ATTEND_POINTS = 2; // نقطتان لكل حصة حضور
  const alreadySaved = (cls._savedDates || []).includes(sessionDate);

  let count = 0;
  cls.students.forEach(s => {
    if (!s._prevAtt) s._prevAtt = {};
    if (alreadySaved) {
      // إلغاء تسجيل اليوم السابق من _savedDates وإعادة الحساب بعد الحذف
      const wasAbsent = (s.absenceDates || []).includes(sessionDate);
      if (!wasAbsent) {/* كان حاضراً */ }
      s.absenceDates = (s.absenceDates || []).filter(d => d !== sessionDate);
    }
    if (s._todayAtt === 'present') {
      count++;
      s.absenceDates = (s.absenceDates || []).filter(d => d !== sessionDate);
      s._prevAtt[sessionDate] = 'present';
    } else if (s._todayAtt === 'absent') {
      if (!s.absenceDates) s.absenceDates = [];
      if (!s.absenceDates.includes(sessionDate)) s.absenceDates.push(sessionDate);
      s._prevAtt[sessionDate] = 'absent';
    }
  });

  if (!cls._savedDates) cls._savedDates = [];
  if (!cls._savedDates.includes(sessionDate)) cls._savedDates.push(sessionDate);
  // رقم الحصة/الحصص لهذا التاريخ
  if (!cls._savedPeriods) cls._savedPeriods = {};
  cls._savedPeriods[sessionDate] = [...selPeriods].sort((a, b) => a - b);
  // التأخر: الطالب الحاضر المعلَّم «متأخر»
  cls.students.forEach(s => {
    s.lateDates = (s.lateDates || []).filter(d => d !== sessionDate);
    if (s._todayAtt === 'present' && s._todayLate) s.lateDates.push(sessionDate);
  });

  // إعادة حساب + تسجيل في pointsLog دفعة واحدة
  cls.students.forEach(s => {
    recomputeWithAssessments(cls, s);
    // سجّل الحضور
    if (s._todayAtt === 'present') {
      if (!s.pointsLog || !s.pointsLog.some(e => e.date === sessionDate && e.type === 'attendance')) {
        logPoints(s, 'attendance', 2, sessionDate);
      }
    }
    // سجّل المشاركات والخصم — الجديد يُجمع مع القديم
    const dayPart   = (s._dailyPart   || {})[sessionDate] || 0;
    const dayDeduct = (s._dailyDeduct || {})[sessionDate] || 0;

    // اقرأ ما كان مسجلاً في pointsLog لهذا اليوم (من حفظات سابقة)
    const prevPartLog   = (s.pointsLog||[]).find(e => e.date === sessionDate && e.type === 'participation');
    const prevDeductLog = (s.pointsLog||[]).find(e => e.date === sessionDate && e.type === 'deduct');
    const prevPart      = prevPartLog   ? prevPartLog.pts   : 0;
    const prevDeduct    = prevDeductLog ? Math.abs(prevDeductLog.pts) : 0;

    // المجموع النهائي = القديم المحفوظ + الجديد منذ آخر حفظ
    const totalPart   = prevPart   + dayPart;
    const totalDeduct = prevDeduct + dayDeduct;

    // احذف السجلات القديمة واكتب المجموع النهائي
    if (s.pointsLog) {
      s.pointsLog = s.pointsLog.filter(
        e => !((e.date === sessionDate) && (e.type === 'participation' || e.type === 'deduct'))
      );
    }
    if (totalPart   > 0) logPoints(s, 'participation', totalPart,    sessionDate);
    if (totalDeduct > 0) logPoints(s, 'deduct',        -totalDeduct, sessionDate);
  });
  // تصفير العدادات المؤقتة بعد الحفظ
  _resetTempCounters();

  save();
  cls.students.forEach(s => {
    const metaEl = document.getElementById('meta-' + s.id);
    const ptsEl  = document.getElementById('pts-' + s.id);
    if (metaEl) metaEl.textContent = attMeta(cls, s);
    if (ptsEl)  ptsEl.textContent  = '⭐ ' + s.points;
  });
  updateLeaderboard();
  if (reportActiveStudent) showStudentReport();
  renderPeriodChips();
  toast(`تم حفظ الحصة ${cls._savedPeriods[sessionDate].join('، ')} (${sessionDate}) — ${count} حاضر (+${ATTEND_POINTS} نقطة لكل منهم) 🎉`, '💾');
}

/* ===== استيراد الغياب من برنامج الحضور (نفس الصف/المعلم/اليوم) =====
   يقرأ بيانات "برنامج الحضور" (attendanceDashboard_v3) مباشرة من ذاكرة المتصفح
   المحلية (localStorage) على نفس الجهاز والمتصفح — لا يحتاج رفع أي ملف. */
/* يحوّل أسماء الصفوف بالأرقام العربية الترتيبية (مثل "السادس") إلى رقم (6)
   حتى يتطابق اسم الصف بين برنامج الحضور ("السادس/2") ونجوم مدرستي ("6/2") */
const CLASS_ORDINAL_WORDS = [
  [/الحادي\s*عشر/g, '11'], [/الثاني\s*عشر/g, '12'], [/الثالث\s*عشر/g, '13'],
  [/الاول/g, '1'], [/الثاني/g, '2'], [/الثالث/g, '3'], [/الرابع/g, '4'],
  [/الخامس/g, '5'], [/السادس/g, '6'], [/السابع/g, '7'], [/الثامن/g, '8'],
  [/التاسع/g, '9'], [/العاشر/g, '10']
];
function normalizeClassKey(s){
  let str = String(s||'').replace(/[إأآا]/g,'ا').trim();
  CLASS_ORDINAL_WORDS.forEach(([re, num]) => { str = str.replace(re, num); });
  return str.replace(/[\s\-_]/g,'');
}
function attDateOnly(v){
  if(!v) return null;
  const d = new Date(v);
  if(isNaN(d)) return null;
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function readAttendanceAppData(){
  try{
    const raw = localStorage.getItem('attendanceDashboard_v3');
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}

function importAbsenceFromAttendance(){
  const cls = state.classes.find(c => c.id === state.activeClass);
  if(!cls) return toast('اختر صفاً أولاً', '⚠️');
  const app = readAttendanceAppData();
  if(!app){
    alert('لم يتم العثور على بيانات "برنامج الحضور" على هذا الجهاز.\nافتح برنامج الحضور مرة واحدة على نفس المتصفح والجهاز، ثم أعد المحاولة.');
    return;
  }
  const dayCells = (app.submissionCells || {})[sessionDate];
  if(!dayCells || !Object.keys(dayCells).length){
    alert('لا يوجد أي تسجيل حضور في برنامج الحضور بتاريخ ' + sessionDate + '.');
    return;
  }
  const myKey = normalizeClassKey(cls.name);
  const matchedClassNames = Object.keys(dayCells).filter(cn => normalizeClassKey(cn) === myKey);

  if(!matchedClassNames.length){
    alert('لم يتم إيجاد صف "' + cls.name + '" في برنامج الحضور بتاريخ ' + sessionDate + '.\nتأكد أن اسم الصف في "نجوم مدرستي" مطابق تماماً لاسمه في برنامج الحضور.');
    return;
  }

  // كل الحصص (المعلمين) المسجَّلة لهذا الصف تحديداً في هذا اليوم
  let periodEntries = [];
  matchedClassNames.forEach(cn => {
    Object.keys(dayCells[cn]||{}).forEach(period => {
      periodEntries.push({ className: cn, period, info: dayCells[cn][period] });
    });
  });
  if(!periodEntries.length){
    alert('لا يوجد تسجيل حضور لصفك بهذا التاريخ.');
    return;
  }

  showAttendanceTeacherPicker(cls, periodEntries, app);
}

function showAttendanceTeacherPicker(cls, periodEntries, app){
  window._attApp = app;
  window._attPeriodEntries = periodEntries;
  const html = `
    <div class="modal-title">📥 استيراد الغياب — ${cls.name}</div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">المعلمون الذين سجّلوا حضوراً لهذا الصف بتاريخ ${sessionDate} — اختر الحصة المطلوب استيراد غيابها:</p>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${periodEntries.map((e,i) => {
        const teacher = (e.info && e.info.teacherName) ? e.info.teacherName : 'بدون اسم معلم';
        return `<button class="btn btn-import" style="width:100%;justify-content:flex-start;gap:10px" onclick="closeModalForce();applyAttendanceImport([window._attPeriodEntries[${i}]], window._attApp)">
          👤 ${teacher} — الحصة ${e.period}
        </button>`;
      }).join('')}
      <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
    </div>`;
  openModal(html);
}

function applyAttendanceImport(periodEntries, app){
  const cls = state.classes.find(c => c.id === state.activeClass);
  if(!cls) return;
  if(!periodEntries || !periodEntries.length){
    alert('لا يوجد تسجيل حضور مطابق لهذا الصف بهذا التاريخ.');
    return;
  }

  const absentNames = new Set();
  (app.records||[]).forEach(r => {
    if(attDateOnly(r.date) !== sessionDate) return;
    const rClass = r.currentClass || r.recordedClass;
    const hit = periodEntries.find(e => normalizeClassKey(e.className) === normalizeClassKey(rClass) && String(e.period) === String(r.period));
    if(hit) absentNames.add(String(r.studentName||'').trim());
  });

  let matchedAbsent = 0;
  const unmatchedAbsent = [];
  cls.students.forEach(s => { s._todayAtt = 'present'; }); // وجود تسجيل حضور فعلي يعني أن غير المذكورين حاضرون
  absentNames.forEach(name => {
    const s = cls.students.find(st => normalizeClassKey(st.name) === normalizeClassKey(name));
    if(s){ s._todayAtt = 'absent'; matchedAbsent++; }
    else unmatchedAbsent.push(name);
  });

  renderStudentList();
  updateSessionSummary(cls);
  save();

  let msg = `📥 تم استيراد الغياب من برنامج الحضور (${sessionDate}) — غائب: ${matchedAbsent}\nراجع القائمة ثم اضغط "💾 حفظ الحصة" لتثبيتها.`;
  if(unmatchedAbsent.length) msg += `\n\n⚠️ لم يتم إيجاد تطابق بالاسم لهؤلاء الطلاب ضمن هذا الصف (تحقق يدوياً): ${unmatchedAbsent.join('، ')}`;
  alert(msg);
}

// ===== PARTICIPATION =====
function subtractPoint(classId, studentId) {
  const cls = state.classes.find(c => c.id === classId);
  const s = cls.students.find(st => st.id === studentId);
  if (s.points <= 0) return toast(`${s.name} لا يملك نقاطاً للخصم`, '⚠️');
  s._manualBonus = (s._manualBonus || 0) - 1;
  // عداد يومي — يتراكم ويُحفظ مع حفظ الحصة
  _getTempCounter(studentId).addDeduct();
  recomputeWithAssessments(cls, s);
  save();
  const badge = document.getElementById('pts-' + studentId);
  if (badge) {
    badge.textContent = '⭐ ' + s.points;
    badge.classList.remove('pts-anim-up','pts-anim-down');
    void badge.offsetWidth;
    badge.classList.add('pts-anim-down');
    setTimeout(() => badge.classList.remove('pts-anim-down'), 420);
  }
  _updateTempCounterUI(studentId);
  const metaEl = document.getElementById('meta-' + studentId);
  if (metaEl) metaEl.textContent = `حاضر: ${s.present} | غائب: ${s.absent} | مشاركة: ${s.participation}`;
  refreshAllPointsUI(studentId);
  toast(`📉 خُصمت نقطة من ${s.name}`, '🔴');
}

function addParticipation(classId, studentId) {
  const cls = state.classes.find(c => c.id === classId);
  const s = cls.students.find(st => st.id === studentId);
  s.participation++;
  // عداد يومي — يتراكم ويُحفظ مع حفظ الحصة
  _getTempCounter(studentId).addPart();
  recomputeWithAssessments(cls, s);
  save();
  // تحديث الواجهة
  const badge = document.getElementById('pts-' + studentId);
  if (badge) {
    badge.textContent = '⭐ ' + s.points;
    badge.classList.remove('pts-anim-up','pts-anim-down');
    void badge.offsetWidth;
    badge.classList.add('pts-anim-up');
    setTimeout(() => badge.classList.remove('pts-anim-up'), 420);
  }
  _updateTempCounterUI(studentId);
  const metaEl = document.getElementById('meta-' + studentId);
  if (metaEl) metaEl.textContent = `حاضر: ${s.present} | غائب: ${s.absent} | مشاركة: ${s.participation}`;
  refreshAllPointsUI(studentId);
  toast(`✋ ${s.name} شارك! +1`, '⭐');
}

function addBonusPoints(classId, studentId) {
  const cls = state.classes.find(c => c.id === classId);
  const s = cls.students.find(st => st.id === studentId);
  openModal(`
    <div class="modal-title">🎁 نقاط مكافأة — ${s.name}</div>
    <div class="form-group"><label class="form-label">عدد النقاط</label>
      <input class="input" id="m-bonus" type="number" value="5" min="1" max="50" /></div>
    <div class="form-group"><label class="form-label">السبب (اختياري)</label>
      <input class="input" id="m-reason" placeholder="مثال: إجابة رائعة..." /></div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="confirmBonus(${classId},${studentId})">منح النقاط</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
    </div>`);
}
function confirmBonus(classId, studentId) {
  const cls = state.classes.find(c => c.id === classId);
  const s = cls.students.find(st => st.id === studentId);
  const pts = parseInt(document.getElementById('m-bonus').value) || 0;
  const reason = document.getElementById('m-reason').value;
  if (pts <= 0) return toast('أدخل عدد نقاط صحيح', '⚠️');
  s._manualBonus = (s._manualBonus || 0) + pts;
  recomputeWithAssessments(cls, s);
  save(); closeModalForce();
  refreshAllPointsUI(studentId);
  renderStudentList();
  toast(`🎁 ${s.name} حصل على ${pts} نقطة${reason ? ' — ' + reason : ''}`, '⭐');
}

// ===== CLEAR ALL =====
function clearAllData() {
  if (!adminCodeOk('مسح البيانات')) return;   // 🔒 برمز المسؤول
  openModal(`
    <div class="modal-title">🗑️ تصفير البيانات</div>
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px">اختر ما تريد تصفيره — ستُحتفظ ببيانات الطلاب والصفوف وأرقام التواصل والحسابات.</p>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px">
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;background:var(--surface2);border-radius:10px;padding:10px 14px;border:1px solid var(--border-color)">
        <input type="checkbox" id="clr-attendance" checked style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent)">
        <div>
          <div style="font-size:13px;font-weight:700">📅 الحضور والغياب</div>
          <div style="font-size:11px;color:var(--text-muted)">سجل الحضور والغياب وجميع الجلسات المحفوظة</div>
        </div>
      </label>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;background:var(--surface2);border-radius:10px;padding:10px 14px;border:1px solid var(--border-color)">
        <input type="checkbox" id="clr-participation" checked style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent)">
        <div>
          <div style="font-size:13px;font-weight:700">✋ المشاركات والمكافآت</div>
          <div style="font-size:11px;color:var(--text-muted)">عداد المشاركات والنقاط اليدوية والخصومات</div>
        </div>
      </label>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;background:var(--surface2);border-radius:10px;padding:10px 14px;border:1px solid var(--border-color)">
        <input type="checkbox" id="clr-notes" checked style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent)">
        <div>
          <div style="font-size:13px;font-weight:700">📝 الملاحظات السلوكية</div>
          <div style="font-size:11px;color:var(--text-muted)">جميع الملاحظات الإيجابية والسلبية</div>
        </div>
      </label>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;background:var(--surface2);border-radius:10px;padding:10px 14px;border:1px solid var(--border-color)">
        <input type="checkbox" id="clr-assessments" checked style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent)">
        <div>
          <div style="font-size:13px;font-weight:700">📊 التقييمات والدرجات</div>
          <div style="font-size:11px;color:var(--text-muted)">جميع الاختبارات والأنشطة والدرجات المدخلة</div>
        </div>
      </label>
    </div>
    <div style="background:rgba(255,107,107,0.08);border:1px solid rgba(255,107,107,0.3);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--absent);margin-bottom:16px">
      ⚠️ هذا الإجراء لا يمكن التراجع عنه. يُنصح بعمل نسخة احتياطية أولاً.
    </div>
    <div class="modal-actions">
      <button class="btn btn-danger" style="flex:1" onclick="confirmClearSelected()">🗑️ تصفير المحدد</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
    </div>
  `);
}

function confirmClearSelected() {
  const clrAtt   = document.getElementById('clr-attendance')?.checked;
  const clrPart  = document.getElementById('clr-participation')?.checked;
  const clrNotes = document.getElementById('clr-notes')?.checked;
  const clrAssess= document.getElementById('clr-assessments')?.checked;

  if (!clrAtt && !clrPart && !clrNotes && !clrAssess) {
    return toast('اختر عنصراً واحداً على الأقل', '⚠️');
  }

  state.classes.forEach(cls => {
    if (clrAtt) { cls._savedDates = []; cls._savedPeriods = {}; }
    cls.students.forEach(s => {
      if (clrAtt) {
        s.present = 0; s.absent = 0;
        s.absenceDates = []; s._todayAtt = 'unmarked'; s._prevAtt = {}; s.lateDates = []; s._todayLate = false;
      }
      if (clrPart) {
        s.participation = 0;
        s._manualBonus  = 0;
      }
      if (clrNotes) {
        s.behaviorNotes = [];
        s.pointsLog = [];
        s._dailyPart = {}; s._dailyDeduct = {};
      }
      // إعادة الحساب بعد التصفير
      recomputeWithAssessments(cls, s);
    });
  });

  if (clrAssess) {
    state.assessments = [];
  }

  state.sessions = [];
  save();
  localStorage.removeItem('nojomi_activated');
  closeModalForce();

  // إعادة رسم كل الصفحات
  renderClassTabs(); renderStudentList(); renderClasses();
  updateLeaderboard(); updateReportSelects();
  if (typeof initGradesPage === 'function') initGradesPage();
  if (typeof renderStatsDashboard === 'function') renderStatsDashboard();

  const cleared = [
    clrAtt    && 'الحضور والغياب',
    clrPart   && 'المشاركات والمكافآت',
    clrNotes  && 'الملاحظات',
    clrAssess && 'التقييمات'
  ].filter(Boolean).join('، ');
  toast(`تم تصفير: ${cleared} ✅`, '🗑️');
}

