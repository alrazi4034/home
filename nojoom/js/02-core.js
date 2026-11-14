/* 02-core.js — الأساسيات: الثيم، تاريخ الحصة، بيانات المادة/المعلم، اللغة، التنقل بين الصفحات، النوافذ، التنبيهات، قائمة الملف */

// ===== Theme =====
function toggleTheme() {
  document.body.classList.toggle('light-mode');
  localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
}

// ===== Session Date =====
let sessionDate = new Date().toISOString().split('T')[0]; // يُحدَّث بعد تعريف _today()
// عدادات يومية للمشاركات والخصم — مخزّنة في بيانات الطالب نفسه
// _dailyPart[date] = عدد المشاركات هذا اليوم
// _dailyDeduct[date] = عدد الخصومات هذا اليوم
// هذا يضمن أن الحفظ الثاني يستبدل الأول بشكل صحيح

function _getTempCounter(studentId) {
  // للتوافق مع الكود القديم — يُعيد مرجعاً للعداد اليومي
  // لا نستخدمه لحفظ pointsLog بعد الآن
  const cls = state.classes.find(c => c.students.some(s => s.id === studentId));
  const s = cls?.students.find(st => st.id === studentId);
  if (!s) return { part: 0, deduct: 0 };
  if (!s._dailyPart)   s._dailyPart   = {};
  if (!s._dailyDeduct) s._dailyDeduct = {};
  return {
    get part()    { return s._dailyPart[sessionDate]   || 0; },
    get deduct()  { return s._dailyDeduct[sessionDate] || 0; },
    set part(v)   { s._dailyPart[sessionDate]   = v; },
    set deduct(v) { s._dailyDeduct[sessionDate] = v; },
    addPart()   { s._dailyPart[sessionDate]   = (s._dailyPart[sessionDate]   || 0) + 1; },
    addDeduct() { s._dailyDeduct[sessionDate] = (s._dailyDeduct[sessionDate] || 0) + 1; },
  };
}

function _resetTempCounters() {
  // تصفير العدادات اليومية لجميع طلاب الصف الحالي للتاريخ الحالي
  const cls = state.classes.find(c => c.id === state.activeClass);
  if (!cls) return;
  cls.students.forEach(s => {
    if (s._dailyPart)   delete s._dailyPart[sessionDate];
    if (s._dailyDeduct) delete s._dailyDeduct[sessionDate];
  });
}

function setTodayDate() {
  const d = new Date();
  document.getElementById('today-date').textContent = d.toLocaleDateString('ar-EG',{ weekday:'long', year:'numeric', month:'long', day:'numeric',numberingSystem:'latn'});
  updateSessionDateDisplay();
}

function showOldDateWarning() {
  const today = _today();
  if (sessionDate !== today) {
    const d = new Date(sessionDate + 'T12:00:00');
    const dateStr = d.toLocaleDateString('ar-EG',{ weekday:'long', month:'long', day:'numeric', numberingSystem:'latn'});
    const tw = getTermWeek(sessionDate);
    const weekStr = tw ? ` — أسبوع ${tw}` : '';
    toast(`📅 تسجيل على تاريخ سابق: ${dateStr}${weekStr}`, '⚠️');
  }
}

function updateSessionDateDisplay() {
  const el = document.getElementById('session-date-display');
  if (!el) return;
  const d = new Date(sessionDate + 'T12:00:00');
  const dayName  = d.toLocaleDateString('ar-EG',{ weekday: 'long',numberingSystem:'latn'});
  const dateNums = d.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const tw = getTermWeek(sessionDate);
  const weekSpan = tw ? ` <span style="color:#a29bfe;font-size:11px;font-weight:700">(أسبوع ${tw})</span>` : '';
  el.innerHTML = `${dayName} ${dateNums}${weekSpan}`;
}

function changeSessionDate() {
  openModal(`
    <div class="modal-title">📅 تغيير تاريخ الحصة</div>
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:14px">يمكنك تسجيل غياب يوم مختلف أو تصحيح يوم سابق</p>
    <div class="form-group">
      <label class="form-label">التاريخ</label>
      <input class="input" type="date" id="m-session-date" value="${sessionDate}" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="confirmChangeDate()">تأكيد</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
    </div>
  `);
}

function _localDateStr(d) {
  // تحويل Date إلى YYYY-MM-DD بالتوقيت المحلي (بدون UTC)
  return d.getFullYear() + '-'
    + String(d.getMonth()+1).padStart(2,'0') + '-'
    + String(d.getDate()).padStart(2,'0');
}
function _today() {
  return _localDateStr(new Date());
}
// تصحيح sessionDate باستخدام التوقيت المحلي عند أول تحميل
(function() { if (typeof sessionDate !== 'undefined') { sessionDate = _localDateStr(new Date()); } })();
function isWeekend(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0=الأحد, 6=السبت
  return day === 0 || day === 6;
}

// حساب نقاط الطالب في أسابيع محددة من pointsLog
// weeks = Set أو Array من أرقام الأسابيع، أو null = كل الأسابيع
function getPointsForWeeks(student, weeks) {
  if (!weeks || weeks.size === 0) return student.points || 0;
  const log = student.pointsLog || [];
  if (!log.length) return 0;
  return log
    .filter(e => e.termWeek !== undefined && weeks.has(e.termWeek))
    .reduce((sum, e) => sum + e.pts, 0);
}

// استخراج كل الأسابيع المتاحة في صف معين
function getAvailableWeeks(classIds) {
  const weeks = new Set();
  const info = getSchoolInfo();
  state.classes
    .filter(cls => !classIds || classIds.includes(cls.id))
    .forEach(cls => {
      // استخراج الأسابيع من pointsLog
      cls.students.forEach(s =>
        (s.pointsLog||[]).forEach(e => { if (e.termWeek) weeks.add(e.termWeek); })
      );
      // استخراج الأسابيع من _savedDates (الحضور والغياب)
      if (info.termStart) {
        (cls._savedDates||[]).forEach(d => {
          const tw = getTermWeek(d);
          if (tw !== null) weeks.add(tw);
        });
      }
    });
  return [...weeks].sort((a,b) => a-b);
}


// إعادة حساب termWeek لكل pointsLog entries — يُحل مشكلة البيانات المحفوظة بـ termWeek=null
function recalcAllTermWeeks() {
  const info = getSchoolInfo();
  if (!info.termStart) return; // لا يمكن الحساب بدون تاريخ بداية
  state.classes.forEach(function(cls) {
    cls.students.forEach(function(s) {
      if (!s.pointsLog) return;
      s.pointsLog.forEach(function(entry) {
        if (!entry.termWeek && entry.date) {
          var tw = getTermWeek(entry.date);
          if (tw !== null) entry.termWeek = tw;
        }
      });
    });
  });
}
// رقم الأسبوع من بداية الفصل (1, 2, 3, ...)
// إذا لم يكن هناك فصل مسجّل، يُعيد null
function getTermWeek(dateStr) {
  const info = getSchoolInfo();
  if (!info.termStart) return null;
  const start = new Date(info.termStart + 'T00:00:00');
  const d     = new Date(dateStr      + 'T12:00:00');
  if (d < start) return null;
  const diffDays = Math.floor((d - start) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

// تاريخ اليوم بصيغة YYYY-MM-DD
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// أضف حدث نقاط لـ pointsLog الطالب
function logPoints(s, type, pts, dateStr, extra) {
  if (!s.pointsLog) s.pointsLog = [];
  const date    = dateStr || todayISO();
  const termWeek = getTermWeek(date);
  const entry = { date, type, pts };
  if (termWeek !== null) entry.termWeek = termWeek;
  if (extra) Object.assign(entry, extra);
  s.pointsLog.push(entry);
}

function confirmChangeDate() {
  const val = document.getElementById('m-session-date').value;
  if (!val) return;

  // منع اختيار تاريخ مستقبلي
  const today = _today();
  if (val > today) {
    alert('⚠️ لا يمكن تسجيل الغياب ليوم في المستقبل!\nيُسمح فقط بتاريخ اليوم أو الأيام السابقة.');
    return;
  }

  // منع السبت والأحد
  if (isWeekend(val)) {
    toast('السبت والأحد أيام إجازة — لا يمكن تسجيل حصص فيهما', '⚠️');
    return;
  }

  sessionDate = val;
  updateSessionDateDisplay();

  // تحميل الغياب المسجل لهذا التاريخ على جميع الصفوف
  state.classes.forEach(cls => {
    cls.students.forEach(s => {
      const prevAtt = s._prevAtt || {};
      if (prevAtt[sessionDate]) {
        s._todayAtt = prevAtt[sessionDate];
      } else {
        s._todayAtt = 'unmarked';
      }
      s._todayLate = s._todayAtt === 'present' && (s.lateDates || []).includes(sessionDate);
    });
  });

  closeModalForce();
  _resetTempCounters();
  renderStudentList();
  showOldDateWarning();
  toast('تم تغيير تاريخ الحصة إلى ' + sessionDate, '📅');
}

function shiftSessionDate(days) {
  const today = _today();
  const d = new Date(sessionDate + 'T12:00:00');
  // تخطى أيام الإجازة (السبت والأحد)
  let attempts = 0;
  do {
    d.setDate(d.getDate() + days);
    attempts++;
  } while (isWeekend(d.toISOString().split('T')[0]) && attempts < 7);
  const newDate = d.toISOString().split('T')[0];
  if (newDate > today) {
    toast('لا يمكن الانتقال لتاريخ مستقبلي', '⚠️');
    return;
  }
  sessionDate = newDate;
  updateSessionDateDisplay();
  state.classes.forEach(cls => {
    cls.students.forEach(s => {
      const prevAtt = s._prevAtt || {};
      s._todayAtt = prevAtt[sessionDate] || 'unmarked';
      s._todayLate = s._todayAtt === 'present' && (s.lateDates || []).includes(sessionDate);
    });
  });
  renderStudentList();
  showOldDateWarning();
  toast('تاريخ الحصة: ' + sessionDate, '📅');
}

function resetSessionToToday() {
  // إذا كان اليوم سبت أو أحد، ارجع لآخر يوم دراسي (جمعة أو قبلها)
  const d = new Date();
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  sessionDate = _localDateStr(d);
  updateSessionDateDisplay();
  state.classes.forEach(cls => {
    cls.students.forEach(s => {
      const prevAtt = s._prevAtt || {};
      s._todayAtt = prevAtt[sessionDate] || 'unmarked';
      s._todayLate = s._todayAtt === 'present' && (s.lateDates || []).includes(sessionDate);
    });
  });
  renderStudentList();
  showOldDateWarning();
  if (sessionDate !== _today()) {
    const d2 = new Date(sessionDate + 'T12:00:00');
    const ds = d2.toLocaleDateString('ar-EG',{ weekday:'long', month:'long', day:'numeric', numberingSystem:'latn'});
    toast('اليوم إجازة — تم الانتقال لـ ' + ds, '📅');
  } else {
    toast('تم الرجوع لتاريخ اليوم', '📅');
  }
}

// ===== SUBJECT/TEACHER EDIT =====
function editSubjectInfo() {
  if (rosterManaged()) { // 🔒 بيانات المدرسة والمعلم والفصل الدراسي من الملف المركزي
    const si = getSchoolInfo();
    return openModal(`<div class="modal-title">🏫 بيانات المدرسة والمعلم</div>
      <div style="line-height:2.1;font-size:13.5px">
        المدرسة: <b>${si.schoolName || '—'}</b><br>المدير/ة: <b>${si.principal || '—'}</b><br>
        المعلم: <b>${si.teacher || '—'}</b><br>المادة: <b>${si.subject || '—'}</b><br>
        الفصل الدراسي: <b>${si.termStart || '—'}</b> إلى <b>${si.termEnd || '—'}</b></div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:8px">🔒 تُقرأ من الملف المركزي — للتعديل تواصل مع مسؤول البرنامج.</div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button></div>`);
  }
  const info = getSchoolInfo();
  openModal(`
    <div class="modal-title">✏️ بيانات المدرسة والمعلم</div>
    <div style="max-height:75vh;overflow-y:auto;padding-left:80px">

      <!-- بيانات المدرسة -->
      <div style="font-size:11px;font-weight:800;color:var(--accent);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(247,201,72,0.2)">🏫 بيانات المدرسة</div>
      <div class="form-group">
        <label class="form-label">اسم المدرسة</label>
        <input class="input" id="m-school-name" value="${info.schoolName}" placeholder="اسم المدرسة" />
      </div>
      <div class="form-group">
        <label class="form-label">اسم مدير/ة المدرسة</label>
        <input class="input" id="m-principal" value="${info.principal}" placeholder="اسم المدير" />
      </div>
      <div class="form-group">
        <label class="form-label">اسم المعلم</label>
        <input class="input" id="m-teacher" value="${info.teacher}" placeholder="اسم المعلم" />
      </div>
      <div class="form-group">
        <label class="form-label">مادة التدريس</label>
        <input class="input" id="m-subject-name" value="${info.subject}" placeholder="مثال: الذكاء الاصطناعي والتكنولوجيا" />
      </div>

      <!-- الفصل الدراسي -->
      <div style="font-size:11px;font-weight:800;color:#5fd8e8;margin:40px 0 10px;padding-bottom:2px;border-bottom:1px solid rgba(95,216,232,0.2)">📅 الفصل الدراسي</div>
      <div class="form-group">
        <label class="form-label">الفصل الدراسي</label>
        <select class="select" id="m-term">
          <option value="" ${!info.term?'selected':''}>-- اختر الفصل --</option>
          <option value="1" ${info.term==='1'?'selected':''}>الفصل الأول</option>
          <option value="2" ${info.term==='2'?'selected':''}>الفصل الثاني</option>
          <option value="3" ${info.term==='3'?'selected':''}>الفصل الثالث</option>
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:50px">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">تاريخ البداية</label>
          <input class="input" type="date" id="m-term-start" value="${info.termStart||''}" onchange="calcTermWeeks()" />
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">تاريخ النهاية</label>
          <input class="input" type="date" id="m-term-end" value="${info.termEnd||''}" onchange="calcTermWeeks()" />
        </div>
      </div>
      <div id="term-weeks-display" style="margin-top:10px;min-height:28px"></div>

    </div>
    <div class="modal-actions" style="margin-top:14px">
      <button class="btn btn-primary" style="flex:1" onclick="saveSubjectInfo()">💾 حفظ</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
    </div>`);
  setTimeout(() => {
    document.getElementById('m-school-name')?.focus();
    calcTermWeeks(); // اعرض الأسابيع إن كانت موجودة
  }, 120);
}

function calcTermWeeks() {
  const start = document.getElementById('m-term-start')?.value;
  const end   = document.getElementById('m-term-end')?.value;
  const disp  = document.getElementById('term-weeks-display');
  if (!disp) return;
  if (!start || !end) { disp.innerHTML = ''; return; }
  const d1 = new Date(start + 'T12:00:00');
  const d2 = new Date(end   + 'T12:00:00');
  if (d2 <= d1) {
    disp.innerHTML = '<div style="font-size:12px;color:var(--absent);padding:6px 10px;background:rgba(255,107,107,0.08);border-radius:8px;border:1px solid rgba(255,107,107,0.2)">⚠️ تاريخ النهاية يجب أن يكون بعد البداية</div>';
    return;
  }
  const diffMs   = d2 - d1;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const weeks    = Math.round(diffDays / 7);
  const d1Fmt = d1.toLocaleDateString('ar-EG',{ day:'numeric', month:'long',numberingSystem:'latn'});
  const d2Fmt = d2.toLocaleDateString('ar-EG',{ day:'numeric', month:'long',numberingSystem:'latn'});
  disp.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(95,216,232,0.08);border:1px solid rgba(95,216,232,0.2);border-radius:10px;font-size:12px">
      <span style="font-size:18px">📆</span>
      <div>
        <span style="color:var(--text);font-weight:700">من ${d1Fmt} إلى ${d2Fmt}</span>
        <span style="color:#5fd8e8;font-weight:900;margin-right:8px;font-size:13px">${weeks} أسبوع</span>
        <span style="color:var(--text-muted)">(${diffDays} يوم)</span>
      </div>
    </div>`;
}

function getSchoolInfo() {
  // مصدر الحقيقة: state.schoolInfo
  const si = state.schoolInfo || {};
  return {
    schoolName: si.schoolName || '',
    principal:  si.principal  || '',
    teacher:    si.teacher    || '',
    subject:    si.subject    || '',
    term:       si.term       || '',
    termStart:  si.termStart  || '',
    termEnd:    si.termEnd    || ''
  };
}

function saveSubjectInfo() {
  const schoolName = document.getElementById('m-school-name')?.value.trim() || '';
  const principal  = document.getElementById('m-principal')?.value.trim()  || '';
  const teacher    = document.getElementById('m-teacher')?.value.trim()    || '';
  const subject    = document.getElementById('m-subject-name')?.value.trim() || '';

  // السطر الثالث: المادة | المعلم | المدرسة
  const parts = [];
  if (subject)    parts.push('المادة: ' + subject);
  if (teacher)    parts.push('المعلم: ' + teacher);
  const subjectLine = parts.join(' | ');
  // تحديث hidden spans للتوافق مع الكود القديم
  const subjectEl = document.getElementById('subject-title');
  if (subjectEl) subjectEl.textContent = subjectLine || 'اسم المادة — اسم المعلم';
  const schoolTitleEl = document.getElementById('school-title');
  if (schoolTitleEl) schoolTitleEl.textContent = schoolName ? ' | المدرسة: ' + schoolName : '';
  // رسم الترويسة المرئية
  renderSchoolInfoBar(subject, teacher, schoolName);

  // قراءة حقول الفصل
  const term      = document.getElementById('m-term')?.value       || '';
  const termStart = document.getElementById('m-term-start')?.value || '';
  const termEnd   = document.getElementById('m-term-end')?.value   || '';

  // حفظ في state.schoolInfo ثم save() يحفظ كل شيء دفعة واحدة
  if (!state.schoolInfo) state.schoolInfo = {};
  state.schoolInfo.schoolName = schoolName;
  state.schoolInfo.principal  = principal;
  state.schoolInfo.teacher    = teacher;
  state.schoolInfo.subject    = subject;
  state.schoolInfo.term       = term;
  state.schoolInfo.termStart  = termStart;
  state.schoolInfo.termEnd    = termEnd;
  save(); // يحفظ state كاملاً بما فيه schoolInfo
  recalcAllTermWeeks(); // إعادة حساب الأسابيع بعد تحديث تاريخ الفصل

  closeModalForce();
  toast('تم حفظ البيانات ✅', '✅');
}

function renderSchoolInfoBar(subject, teacher, schoolName) {
  const bar = document.getElementById('school-info-display');
  if (!bar) return;
  const items = [];
  if (subject)    items.push({ label: 'المادة', value: subject, color: '#d4a843' });
  if (teacher)    items.push({ label: 'المعلم', value: teacher, color: '#a29bfe' });
  if (schoolName) items.push({ label: 'المدرسة', value: schoolName, color: '#4ecdc4' });
  if (!items.length) {
    bar.innerHTML = '<span style="font-size:11px;color:#8b7fb8;font-style:italic">اضغط لإضافة بيانات المدرسة</span>';
    return;
  }
  bar.innerHTML = items.map((item, i) => `
    <span style="display:inline-flex;align-items:center;gap:3px">
      <span style="font-size:10px;color:#8b7fb8;font-weight:600">${item.label}:</span>
      <span style="font-size:11px;color:${item.color};font-weight:700">${item.value}</span>
    </span>
    ${i < items.length - 1 ? '<span style="color:rgba(255,255,255,0.2);margin:0 5px;font-size:11px">|</span>' : ''}
  `).join('');
}

// ===== LANGUAGE / i18n =====
let currentLang = 'ar';

const TRANSLATIONS = {
  ar: {
    nav_attendance: '📋 الحضور', nav_leaderboard: '🏆 المتصدرون', nav_classes: '🏫 صفوفي',
    nav_report: '📊 التقارير', nav_absence: '📅 سجل الغياب',
    btn_export: '📤 تصدير', btn_import: '📥 استيراد',
    today_label: '📅 اليوم:', session_date_label: 'تاريخ الحصة:',
    change_btn: '✏️ تغيير', mark_all_present: '✅ حضور الكل',
    save_session: '💾 حفظ الحصة', clear_all: '🗑️ تصفير الكل',
    leaderboard_title: '🏆 لوحة المتصدرين', all_classes: 'جميع الصفوف',
    manage_classes: '🏫 إدارة الصفوف والطلاب', add_class: '➕ إضافة صف',
    report_title: '📊 تقارير الطلاب',
    absence_title: '📅 سجل الغياب اليومي',
    class_label: 'الصف', date_label: 'التاريخ',
    prev_day: '▶ السابق', today_btn: 'اليوم', next_day: 'التالي ◀',
    filter_all: 'الكل', filter_absent: 'غائبون فقط', filter_present: 'حاضرون فقط',
    highest_pts: 'أعلى نقاط', avg_pts: 'متوسط النقاط', total_students: 'إجمالي الطلاب',
    attendance_days: 'أيام حضور', absence_days: 'أيام غياب', participations: 'مشاركات',
    absence_pct: 'نسبة الحضور', total_pts: 'النقاط الكلية', level: 'المستوى',
    timeline_title: '📅 سجل الغياب', no_absence: '✅ لا يوجد أي غياب مسجّل',
    note_label: 'ملاحظة:', lang_btn: '🌐 EN',
    footer_text: '',
    mark_all_present_btn: '✅ تسجيل الكل حاضر', save_edits: '💾 حفظ التعديلات',
    present_btn: '✅ حاضر', absent_btn: '❌ غائب',
    att_bar: '📅 نسبة الحضور', pts_bar: '⭐ مجموع النقاط',
    top1_badge: 'المتصدر 🌟', top2_badge: 'المركز الثاني', top3_badge: 'المركز الثالث',
    present_label: 'حاضر', absent_label: 'غائب', participation_label: 'مشاركة',
    days_label: 'يوم',
  },
  en: {
    nav_attendance: '📋 Attendance', nav_leaderboard: '🏆 Leaderboard', nav_classes: '🏫 My classes',
    nav_report: '📊 Reports', nav_absence: '📅 Absence Log',
    btn_export: '📤 Export', btn_import: '📥 Import',
    today_label: '📅 Today:', session_date_label: 'Session Date:',
    change_btn: '✏️ Change', mark_all_present: '✅ All Present',
    save_session: '💾 Save Session', clear_all: '🗑️ Reset All',
    leaderboard_title: '🏆 Leaderboard', all_classes: 'All Classes',
    manage_classes: '🏫 Manage Classes & Students', add_class: '➕ Add Class',
    report_title: '📊 Student Reports',
    absence_title: '📅 Daily Absence Log',
    class_label: 'Class', date_label: 'Date',
    prev_day: '◀ Previous', today_btn: 'Today', next_day: 'Next ▶',
    filter_all: 'All', filter_absent: 'Absent Only', filter_present: 'Present Only',
    highest_pts: 'Top Points', avg_pts: 'Avg Points', total_students: 'Total Students',
    attendance_days: 'Present Days', absence_days: 'Absent Days', participations: 'Participations',
    absence_pct: 'Attendance Rate', total_pts: 'Total Points', level: 'Level',
    timeline_title: '📅 Absence Log', no_absence: '✅ No absences recorded',
    note_label: 'Note:', lang_btn: '🌐 عربي',
    footer_text: '© All Rights Reserved — Mahmoud Shehada, Al-Razi School',
    mark_all_present_btn: '✅ Mark All Present', save_edits: '💾 Save Changes',
    present_btn: '✅ Present', absent_btn: '❌ Absent',
    att_bar: '📅 Attendance Rate', pts_bar: '⭐ Total Points',
    top1_badge: 'Top Student 🌟', top2_badge: '2nd Place', top3_badge: '3rd Place',
    present_label: 'Present', absent_label: 'Absent', participation_label: 'Participation',
    days_label: 'days',
  }
};

function t(key) {
  return TRANSLATIONS[currentLang][key] || TRANSLATIONS['ar'][key] || key;
}

function toggleLang() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  const isEn = currentLang === 'en';
  document.documentElement.lang = isEn ? 'en' : 'ar';
  document.documentElement.dir = isEn ? 'ltr' : 'rtl';
  document.body.style.direction = isEn ? 'ltr' : 'rtl';
  document.getElementById('lang-btn').textContent = t('lang_btn');
  localStorage.setItem('lang', currentLang);
  // تحديث عناصر data-i18n في الهيدر
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (TRANSLATIONS[currentLang][key]) el.textContent = TRANSLATIONS[currentLang][key];
  });
  // تحديث الكلمات الثابتة data-ar / data-en
  document.querySelectorAll('[data-ar]').forEach(el => {
    el.textContent = isEn ? el.getAttribute('data-en') : el.getAttribute('data-ar');
  });
  // تحديث الـ footer
  const footer = document.querySelector('.site-footer');
  if (footer) footer.textContent = t('footer_text');
  // إعادة رسم الصفحة الحالية
  const activePage = document.querySelector('.page.active');
  if (activePage) {
    const pid = activePage.id.replace('page-','');
    if (pid === 'leaderboard') updateLeaderboard();
    else if (pid === 'report') initReportPage();
    else if (pid === 'absence') initAbsencePage();
    else if (pid === 'attendance') { renderClassTabs(); renderStudentList(); }
    else if (pid === 'classes') renderClasses();
  }
}

// ===== PAGES =====
function syncActiveClassToPages() {
  const id = state.activeClass;
  if (!id || !state.classes.some(c => c.id === id)) return;
  if (typeof reportActiveClass !== 'undefined' && reportActiveClass !== id) { reportActiveClass = id; reportActiveStudent = null; }
  if (typeof absenceClassId !== 'undefined') absenceClassId = id;
}
function showPage(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  if (btn) btn.classList.add('active');
  // الصف المختار يبقى نفسه عند التنقل بين الصفحات (مصدره state.activeClass)
  syncActiveClassToPages();
  if (page === 'attendance') { renderClassTabs(); renderStudentList(); }
  if (page === 'leaderboard') updateLeaderboard();
  if (page === 'report') initReportPage();
  if (page === 'absence') initAbsencePage();
  if (page === 'grades') initGradesPage();
  if (page === 'stats') initStatsPage();
  if (page === 'seating') sxInit();
}

function _nearestWeekday(dateStr, direction) {
  // direction: -1 للماضي, +1 للمستقبل
  var d = new Date(dateStr + 'T12:00:00');
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + direction);
  }
  return d.toISOString().split('T')[0];
}
function onReportDateFromChange() {
  var el = document.getElementById('report-date-from');
  var today = new Date().toISOString().split('T')[0];
  if (el.value > today) el.value = today;
  if (el.value && (new Date(el.value + 'T12:00:00').getDay() === 0 || new Date(el.value + 'T12:00:00').getDay() === 6)) {
    el.value = _nearestWeekday(el.value, -1);
  }
  renderReportStudentsList();
}
function onReportDateToChange() {
  var el = document.getElementById('report-date-to');
  var today = new Date().toISOString().split('T')[0];
  if (el.value > today) el.value = today;
  if (el.value && (new Date(el.value + 'T12:00:00').getDay() === 0 || new Date(el.value + 'T12:00:00').getDay() === 6)) {
    el.value = _nearestWeekday(el.value, -1);
  }
  renderReportStudentsList();
}
function clearReportDateFilter() {
  document.getElementById('report-date-from').value = '';
  document.getElementById('report-date-to').value = '';
  renderReportStudentsList();
}

// ===== MODALS =====
function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('show');
}
function closeModal(e) {
  // النوافذ تُغلق فقط من زر الإغلاق - لا تُغلق بالضغط خارجها
}
function closeModalForce() {
  document.getElementById('modal-overlay').classList.remove('show');
}

// ===== TOAST =====
function toast(msg, icon='✅') {
  document.getElementById('toast-msg').textContent = msg;
  document.getElementById('toast-icon').textContent = icon;
  const t = document.getElementById('toast');
  t.classList.remove('warn','error');
  if (icon === '⚠️') t.classList.add('warn');
  if (icon === '⛔' || icon === '❌') t.classList.add('error');
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show','warn','error'), 2800);
}


function showFileMenu(){
  openModal(`
    <div class="modal-title">📁 الملف</div>
    <div class="modal-actions" style="flex-direction:column;gap:10px">
      <button class="btn btn-import" style="width:100%;justify-content:flex-start;gap:10px" onclick="closeModalForce();requestRestoreBackup()">
        📥 استيراد بيانات<br><span style="font-size:11px;font-weight:400;opacity:.8">من نسخة احتياطية JSON أو ملف CSV</span>
      </button>
      <button class="btn btn-success" style="width:100%;justify-content:flex-start;gap:10px" onclick="closeModalForce();exportToExcel()">
        📤 تصدير بيانات<br><span style="font-size:11px;font-weight:400;opacity:.8">نسخة احتياطية JSON أو جداول CSV</span>
      </button>
      <button class="btn btn-danger" style="width:100%;justify-content:flex-start;gap:10px" onclick="closeModalForce();clearAllData()">
        🗑️ تصفير بيانات<br><span style="font-size:11px;font-weight:400;opacity:.8">مسح الحضور/المشاركات/الملاحظات/التقييمات</span>
      </button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
    </div>`);
}
