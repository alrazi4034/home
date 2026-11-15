/* 08-absence-grades.js — صفحة الغياب، حساب النقاط (مصدر الحقيقة)، صفحة الدرجات */

// ===== ABSENCE PAGE =====
let absenceClassId = null;
let absenceFilter = 'all'; // 'all' | 'absent' | 'present'

function initAbsencePage() {
  absenceClassId = absenceClassId || state.classes[0]?.id || null;
  const picker = document.getElementById('absence-date-picker');
  const todayStr = _today();
  if (picker) picker.max = todayStr;
  if (picker && !picker.value) picker.value = todayStr;
  renderAbsenceClassFilter();
  renderAbsencePage();
  _updateAbsenceDateDisplay();
}

function onAbsenceDatePicked() {
  const picker = document.getElementById('absence-date-picker');
  if (!picker?.value) return;
  const today = _today();
  if (picker.value > today) { picker.value = today; toast('لا يمكن اختيار تاريخ مستقبلي', '⛔'); }
  const d = new Date(picker.value + 'T12:00:00');
  if (d.getDay() === 0 || d.getDay() === 6) {
    // ارجع لأقرب يوم عمل سابق
    do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
    picker.value = _localDateStr(d);
  }
  _updateAbsenceDateDisplay();
  renderAbsencePage();
}

function _updateAbsenceDateDisplay() {
  const picker = document.getElementById('absence-date-picker');
  const el     = document.getElementById('absence-date-display');
  if (!el) return;
  const val = picker?.value || new Date().toISOString().split('T')[0];
  const d   = new Date(val + 'T12:00:00');
  const dayName  = d.toLocaleDateString('ar-EG',{ weekday: 'long',numberingSystem:'latn'});
  const dateNums = d.toLocaleDateString('en-GB',  { year: 'numeric', month: '2-digit', day: '2-digit' });
  const tw = getTermWeek(val);
  const weekSpan = tw ? ` <span style="color:#a29bfe;font-size:11px;font-weight:700">(أسبوع ${tw})</span>` : '';
  el.innerHTML = `${dayName} ${dateNums}${weekSpan}`;
}

function renderAbsenceClassFilter() {
  const c = document.getElementById('absence-class-filter');
  if (!c) return;
  c.innerHTML = state.classes.map(cls => `
    <button class="flt-btn ${cls.id === absenceClassId ? 'flt-btn-on' : ''}"
      onclick="setAbsenceClass(${cls.id})">
      ${cls.name}
    </button>`).join('');
}

function setAbsenceClass(id) {
  absenceClassId = id;
  state.activeClass = id;   // يبقى نفس الصف في باقي الصفحات
  renderAbsenceClassFilter();
  renderAbsencePage();
}

function setAbsFilter(f) {
  absenceFilter = f;
  document.getElementById('abf-all').className = 'flt-btn' + (f==='all'?' flt-btn-on':'');
  document.getElementById('abf-absent').className = 'flt-btn' + (f==='absent'?' flt-btn-on':'');
  document.getElementById('abf-present').className = 'flt-btn' + (f==='present'?' flt-btn-on':'');
  renderAbsencePage();
}

function renderAbsencePage() {
  if (absenceView === 'timeline') { renderAbsenceTimeline(); return; }
  const container = document.getElementById('absence-page-content');
  const picker = document.getElementById('absence-date-picker');
  const selectedDate = picker?.value;
  if (!selectedDate || !absenceClassId) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📅</div><p>اختر الصف والتاريخ</p></div>`;
    return;
  }

  const cls = state.classes.find(c => c.id === absenceClassId);
  if (!cls) return;

  const dateObj = new Date(selectedDate + 'T12:00:00');
  const displayDate = dateObj.toLocaleDateString('ar-EG',{ weekday:'long', year:'numeric', month:'long', day:'numeric',numberingSystem:'latn'});

  // بناء حالة كل طالب في هذا اليوم
  let students = cls.students.map(s => {
    const isAbsent = (s.absenceDates || []).includes(selectedDate);
    const isPresent = (cls._savedDates || []).includes(selectedDate) && !isAbsent;
    const status = (cls._savedDates || []).includes(selectedDate)
      ? (isAbsent ? 'absent' : 'present')
      : 'unknown';
    return { ...s, status };
  });

  // تطبيق الفلتر
  if (absenceFilter === 'absent') students = students.filter(s => s.status === 'absent');
  if (absenceFilter === 'present') students = students.filter(s => s.status === 'present');

  const totalPresent = cls.students.filter(s => {
    const isAbsent = (s.absenceDates||[]).includes(selectedDate);
    return (cls._savedDates||[]).includes(selectedDate) && !isAbsent;
  }).length;
  const totalAbsent = cls.students.filter(s => (s.absenceDates||[]).includes(selectedDate)).length;
  const isSaved = (cls._savedDates||[]).includes(selectedDate);

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;padding:14px 18px;background:var(--surface);border-radius:var(--radius);border:1px solid var(--border-color)">
      <div>
        <div style="font-size:15px;font-weight:800">${displayDate} — ${cls.name}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:3px">
          ${isSaved
            ? `✅ <span style="color:var(--present)">${totalPresent} حاضر</span> · ❌ <span style="color:var(--absent)">${totalAbsent} غائب</span>`
            : `<span style="color:var(--text-muted)">لم تُحفظ حصة لهذا اليوم بعد</span>`}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="markAllAbsencePresent('${selectedDate}')">✅ تسجيل الكل حاضر</button>
        <button class="btn btn-primary btn-sm" onclick="saveAbsenceEdits('${selectedDate}')">💾 حفظ التعديلات</button>
      </div>
    </div>
    <div class="card">
      ${students.length === 0
        ? `<div class="empty-state" style="padding:30px"><div class="icon">👤</div><p>لا يوجد طلاب بهذا الفلتر</p></div>`
        : students.map(s => `
          <div class="abs-student-row" id="absrow-${s.id}">
            <div class="student-avatar" style="${s.status==='absent'?'background:rgba(255,107,107,0.3);color:var(--absent);border-color:var(--absent)':s.status==='present'?'background:rgba(78,205,196,0.2);color:var(--present);border-color:var(--present)':''}">${s.name.charAt(0)}</div>
            <div class="student-info">
              <div class="student-name">${s.name}</div>
              <div class="student-meta">⭐ ${s.points} | إجمالي الغياب: ${(s.absenceDates||[]).length} يوم</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <button onclick="setAbsStudentStatus(${s.id},'${selectedDate}','present')"
                style="padding:5px 12px;border-radius:18px;border:2px solid ${s.status==='present'?'var(--present)':'rgba(78,205,196,0.3)'};background:${s.status==='present'?'rgba(78,205,196,0.2)':'transparent'};color:${s.status==='present'?'var(--present)':'var(--text-muted)'};cursor:pointer;font-family:Tajawal,sans-serif;font-size:12px;font-weight:700;transition:all 0.2s">
                ✅ حاضر
              </button>
              <button onclick="setAbsStudentStatus(${s.id},'${selectedDate}','absent')"
                style="padding:5px 12px;border-radius:18px;border:2px solid ${s.status==='absent'?'var(--absent)':'rgba(255,107,107,0.3)'};background:${s.status==='absent'?'rgba(255,107,107,0.2)':'transparent'};color:${s.status==='absent'?'var(--absent)':'var(--text-muted)'};cursor:pointer;font-family:Tajawal,sans-serif;font-size:12px;font-weight:700;transition:all 0.2s">
                ❌ غائب
              </button>
            </div>
          </div>`).join('')}
    </div>`;
}

// إعادة احتساب present و absent من المصدر الصحيح (absenceDates + _savedDates)
function recomputeAttendance(cls) {
  cls.students.forEach(s => {
    // عدد الأيام المحفوظة لهذا الصف
    const savedDays = (cls._savedDates || []);
    // أيام الغياب = التواريخ المحفوظة التي وُجد فيها في absenceDates
    const absentDays = (s.absenceDates || []).filter(d => savedDays.includes(d));
    // أيام الحضور = إجمالي الأيام المحفوظة - أيام الغياب
    s.absent = absentDays.length;
    s.present = savedDays.length - absentDays.length;
    // النقاط من الحضور = أيام الحضور + المشاركات + المكافآت
    // نحتفظ بـ _bonusPoints و _participationPoints منفصلين إن وُجدا
    // بسيط: نقاط = حضور + مشاركة + مكافآت
    if (s._basePoints !== undefined) {
      s.points = s.present + s.participation + s._basePoints;
    }
    // تنظيف absenceDates من أي تواريخ غير محفوظة
    s.absenceDates = absentDays;
  });
}

function setAbsStudentStatus(studentId, date, newStatus) {
  const cls = state.classes.find(c => c.id === absenceClassId);
  const s = cls?.students.find(st => st.id === studentId);
  if (!s) return;
  if (!s.absenceDates) s.absenceDates = [];
  if (!s._prevAtt) s._prevAtt = {};

  // تسجيل التاريخ كيوم محفوظ إذا لم يكن كذلك
  if (!cls._savedDates) cls._savedDates = [];
  if (!cls._savedDates.includes(date)) cls._savedDates.push(date);

  // تحديث absenceDates و _prevAtt
  if (newStatus === 'absent') {
    if (!s.absenceDates.includes(date)) s.absenceDates.push(date);
    s._prevAtt[date] = 'absent';
    s.lateDates = (s.lateDates || []).filter(d => d !== date);   // الغائب ليس متأخراً
    if (date === sessionDate) s._todayLate = false;
  } else {
    s.absenceDates = s.absenceDates.filter(d => d !== date);
    s._prevAtt[date] = 'present';
  }

  // إذا كان التاريخ هو sessionDate الحالي — حدّث _todayAtt أيضاً
  if (date === sessionDate) {
    s._todayAtt = newStatus;
  }

  // إعادة الاحتساب من المصدر
  recomputeWithAssessments(cls, s);

  save();
  renderAbsencePage();
  // تحديث صفحة الحضور إذا كانت نفس الشعبة النشطة
  if (cls.id === state.activeClass) renderStudentList();
  if (reportActiveStudent === studentId) showStudentReport();
  if (reportActiveClass === absenceClassId) renderReportStudentsList();
  updateLeaderboard();
}

// إعادة احتساب طالب واحد — يستخدم recomputeWithAssessments دائماً للتوحيد
function recomputeStudentAttendance(cls, s) {
  recomputeWithAssessments(cls, s);
}

// =================================================================
// مصدر الحقيقة الوحيد لحساب نقاط الطالب
// النقاط = (حضور×2) + مشاركات + نقاط_ملاحظات + _manualBonus + نقاط_تقييمات
// =================================================================
function recomputeWithAssessments(cls, s) {
  const ATTEND_POINTS = 2;
  const savedDays  = cls._savedDates || [];
  const absentDays = (s.absenceDates || []).filter(d => savedDays.includes(d));
  s.absent   = absentDays.length;
  s.present  = Math.max(0, savedDays.length - absentDays.length);
  s.absenceDates = absentDays;

  const attendPts = s.present * ATTEND_POINTS;                    // نقطتان / حضور
  const partPts   = s.participation || 0;                         // نقطة / مشاركة
  const notePts   = (s.behaviorNotes || [])                       // نقاط الملاحظات (+1..5 أو -1..5)
                      .reduce((sum, n) => sum + (n.points || 0), 0);
  const manualPts = s._manualBonus || 0;                          // مكافآت/خصومات يدوية
  const assessPts = (state.assessments || []).reduce((sum, a) => {// نقاط التقييمات
    if (!a.classIds?.includes(cls.id)) return sum;
    return sum + (a.awardedPoints?.[s.id] || 0);
  }, 0);

  s.points = attendPts + partPts + notePts + manualPts + assessPts;
}

function recalcAllPoints() {
  state.classes.forEach(cls => {
    cls.students.forEach(s => recomputeWithAssessments(cls, s));
  });
}

// تحديث شامل للـ DOM بعد أي تغيير في النقاط
function refreshAllPointsUI(studentId) {
  // تحديث badge النقاط في صفحة الحضور (إن كانت مفتوحة)
  if (studentId !== undefined) {
    const cls = state.classes.find(c => c.students.some(st => st.id === studentId));
    const s   = cls?.students.find(st => st.id === studentId);
    if (s) {
      const ptsEl  = document.getElementById('pts-' + studentId);
      const metaEl = document.getElementById('meta-' + studentId);
      if (ptsEl)  ptsEl.textContent  = '⭐ ' + s.points;
      if (metaEl) metaEl.textContent = `حاضر: ${s.present} | غائب: ${s.absent} | مشاركة: ${s.participation}`;
    }
  }
  // تحديث المتصدرين دائماً
  updateLeaderboard();
  // تحديث التقرير إن كان الطالب المفتوح هو نفسه
  if (studentId !== undefined && reportActiveStudent === studentId) showStudentReport();
}

function markAllAbsencePresent(date) {
  const cls = state.classes.find(c => c.id === absenceClassId);
  if (!cls) return;
  if (!cls._savedDates) cls._savedDates = [];
  if (!cls._savedDates.includes(date)) cls._savedDates.push(date);

  cls.students.forEach(s => {
    s.absenceDates = (s.absenceDates || []).filter(d => d !== date);
    if (!s._prevAtt) s._prevAtt = {};
    s._prevAtt[date] = 'present';
    if (date === sessionDate) s._todayAtt = 'present';
    recomputeWithAssessments(cls, s);
  });

  save();
  renderAbsencePage();
  if (cls.id === state.activeClass) renderStudentList();
  renderReportStudentsList();
  if (reportActiveStudent) showStudentReport();
  updateLeaderboard();
  toast('تم تسجيل الكل حاضر ✅', '✅');
}

function saveAbsenceEdits(date) {
  save();
  // تحديث كل الواجهات
  renderReportStudentsList();
  if (reportActiveStudent) showStudentReport();
  updateLeaderboard();
  toast('تم حفظ التعديلات ✅', '💾');
}

function goToPrevDay() {
  const picker = document.getElementById('absence-date-picker');
  if (!picker.value) picker.value = _today();
  const d = new Date(picker.value + 'T12:00:00');
  do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
  picker.value = _localDateStr(d);
  _updateAbsenceDateDisplay(); renderAbsencePage();
}
function goToNextDay() {
  const picker = document.getElementById('absence-date-picker');
  if (!picker.value) picker.value = _today();
  const today = _today();
  if (picker.value >= today) {
    toast('لا يمكن الانتقال لتاريخ مستقبلي', '⛔');
    return;
  }
  const d = new Date(picker.value + 'T12:00:00');
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  const nextDate = _localDateStr(d);
  if (nextDate > today) {
    toast('لا يمكن الانتقال لتاريخ مستقبلي', '⛔');
    return;
  }
  picker.value = nextDate;
  _updateAbsenceDateDisplay(); renderAbsencePage();
}
function goToToday() {
  const t = new Date();
  while (t.getDay() === 0 || t.getDay() === 6) { t.setDate(t.getDate() - 1); }
  const val = _localDateStr(t);
  document.getElementById('absence-date-picker').value = val;
  _updateAbsenceDateDisplay(); renderAbsencePage();
  const realToday = _today();
  if (val !== realToday) {
    const d2 = new Date(val + 'T12:00:00');
    const ds = d2.toLocaleDateString('ar-EG',{ weekday:'long', month:'long', day:'numeric', numberingSystem:'latn'});
    toast('اليوم إجازة — تم الانتقال لـ ' + ds, '📅');
  }
}

// ===== GRADES PAGE =====
let activeAssessmentId = null;

function initGradesPage() {
  if (!state.assessments) state.assessments = [];
  renderAssessmentTabs();
  renderGradesContent();
}

function renderAssessmentTabs() {
  const c = document.getElementById('grades-assessments-tabs');
  if (!c) return;
  if (!state.assessments.length) { c.innerHTML = `<span style="color:var(--text-muted);font-size:13px">لا توجد تقييمات بعد — اضغط "إضافة تقييم"</span>`; return; }
  if (!activeAssessmentId || !state.assessments.find(a => a.id === activeAssessmentId))
    activeAssessmentId = state.assessments[0].id;
  c.innerHTML = state.assessments.map(a => `
    <div style="display:inline-flex;align-items:center;gap:2px;position:relative">
      <button class="flt-btn ${a.id === activeAssessmentId ? 'flt-btn-on' : ''}" onclick="setActiveAssessment(${a.id})">
        📝 ${a.name} <span style="opacity:.7;font-size:11px">(/${a.maxScore})${a.date ? ' · ' + a.date.slice(5).split('-').reverse().join('/') : ''}</span>
      </button>
      
    </div>`).join('');
}

function setActiveAssessment(id) {
  activeAssessmentId = id;
  renderAssessmentTabs();
  renderGradesContent();
}

function showAddAssessmentModal() {
  if (!state.classes.length) return toast('أضف صفاً أولاً', '⚠️');
  openModal(`
    <div class="modal-title">📝 إضافة تقييم جديد</div>
    <div class="form-group">
      <label class="form-label">اسم التقييم</label>
      <input class="input" id="m-assess-name" placeholder="مثال: اختبار الفصل الأول، نشاط الوحدة 3..." />
    </div>
    <div class="form-group">
      <label class="form-label">تاريخ التقييم <span style="font-weight:400;color:var(--text-muted)">(يُستخدم لحساب التحسّن والتراجع)</span></label>
      <input class="input" id="m-assess-date" type="date" value="${todayISO()}" />
    </div>
    <div style="display:grid;grid-template-columns:2fr 2fr;gap:50px">
      <div class="form-group">
        <label class="form-label">الدرجة النهائية</label>
        <input class="input" id="m-assess-max" type="number" value="100" min="1" max="1000" />
      </div>
      <div class="form-group">
        <label class="form-label">النقاط المخصصة</label>
        <input class="input" id="m-assess-pts" type="number" value="10" min="0" max="100"
          title="النقاط التي سيحصل عليها الطالب حسب نسبته — مثلاً: 80% من 10 = 8 نقاط" />
      </div>
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin:-8px 0 10px 0;padding:8px 10px;background:rgba(247,201,72,0.08);border-radius:8px;border:1px solid rgba(247,201,72,0.2)">
      💡 مثال: درجة التقييم 50، النقاط 10 — الطالب الحاصل على 40/50 (80%) يأخذ 8 نقاط
    </div>
    <div class="form-group">
      <label class="form-label">الصفوف التي يُطبَّق عليها (اختيار متعدد)</label>
      <div id="m-assess-classes" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
        ${state.classes.map(cls => `
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;background:var(--surface2);border:1px solid var(--border-color);border-radius:8px;padding:5px 10px;font-size:13px">
            <input type="checkbox" value="${cls.id}" checked style="cursor:pointer"> ${cls.name}
          </label>`).join('')}
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="confirmAddAssessment()">إضافة</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
    </div>
  `);
  setTimeout(() => document.getElementById('m-assess-name')?.focus(), 100);
}

function confirmAddAssessment() {
  const name = document.getElementById('m-assess-name').value.trim();
  const maxScore = parseInt(document.getElementById('m-assess-max').value) || 100;
  const pointsValue = parseFloat(document.getElementById('m-assess-pts').value) || 0;
  if (!name) return toast('أدخل اسم التقييم', '⚠️');
  const checked = [...document.querySelectorAll('#m-assess-classes input:checked')].map(el => parseInt(el.value));
  if (!checked.length) return toast('اختر صفاً على الأقل', '⚠️');
  const date = document.getElementById('m-assess-date')?.value || todayISO();
  const assessment = { id: Date.now(), name, maxScore, pointsValue, date, classIds: checked, scores: {}, awardedPoints: {} };
  if (!state.assessments) state.assessments = [];
  state.assessments.push(assessment);
  activeAssessmentId = assessment.id;
  save(); closeModalForce(); renderAssessmentTabs(); renderGradesContent();
  toast(`تم إضافة تقييم: ${name} (${pointsValue} نقطة)`, '📝');
}

function deleteAssessment(id) {
  const _a = (state.assessments || []).find(a => a.id === id);
  const _n = _a ? Object.values(_a.scores || {}).filter(v => v !== '' && v != null).length : 0;
  if (_n) {   // تقييم فيه درجات ⇐ تأكيد بكتابة كلمة «حذف» (حماية من الحذف بالخطأ)
    const w = prompt(`⚠️ التقييم «${_a.name}» فيه ${_n} درجة مُدخلة وسيُحذف نهائياً مع درجاته.\nللتأكيد اكتب كلمة: حذف`);
    if (w === null || w.trim() !== 'حذف') { if (w !== null) toast('لم يُحذف — الكلمة غير مطابقة', '⚠️'); return; }
  } else if (!confirm('حذف هذا التقييم؟')) return;
  state.assessments = (state.assessments||[]).filter(a => a.id !== id);
  // إعادة حساب النقاط الكاملة لكل الطلاب المتأثرين بعد الحذف
  state.classes.forEach(cls => {
    cls.students.forEach(s => recomputeWithAssessments(cls, s));
  });
  activeAssessmentId = state.assessments[0]?.id || null;
  save(); renderAssessmentTabs(); renderGradesContent();
  renderStudentList(); updateLeaderboard();
  toast('تم حذف التقييم وتحديث النقاط', '🗑️');
}

function renderGradesContent() {
  const c = document.getElementById('grades-content');
  if (!c) return;
  if (!state.assessments?.length) {
    c.innerHTML = `<div class="empty-state"><div class="icon">📝</div><p>اضغط "إضافة تقييم" للبدء</p></div>`;
    return;
  }
  const assess = state.assessments.find(a => a.id === activeAssessmentId);
  if (!assess) { c.innerHTML = ''; return; }

  const appliedClasses = state.classes.filter(cls => assess.classIds.includes(cls.id));
  if (!appliedClasses.length) {
    c.innerHTML = `
      <div class="card mb-4">
        <div class="card-header">
          <div>
            <div class="card-title">📝 ${assess.name}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px">الدرجة النهائية: ${assess.maxScore} | النقاط: ${assess.pointsValue||0} ⭐</div>
          </div>
          <button onclick="deleteAssessment(${assess.id})" class="btn btn-danger btn-sm">🗑️ حذف هذا التقييم</button>
        </div>
      </div>
      <div class="empty-state"><div class="icon">🏫</div><p>لا توجد صفوف مرتبطة بهذا التقييم — يمكنك حذفه من الزر أعلاه</p></div>`;
    return;
  }

  let html = `
    <div class="card mb-4">
      <div class="card-header">
        <div>
          <div class="card-title">📝 ${assess.name}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap">
            <span style="font-size:12px;color:var(--text-muted)">التاريخ:</span>
            <input type="date" value="${assess.date || ''}" onchange="setAssessDate(${assess.id}, this.value)" title="تاريخ التقييم — لحساب التحسّن والتراجع"
              style="font-family:inherit;font-size:12px;padding:3px 6px;border-radius:8px;border:1px solid var(--border-color);background:var(--surface2);color:var(--text)">
            <span style="font-size:12px;color:var(--text-muted)">الدرجة النهائية:</span>
            <span style="font-size:14px;font-weight:900;color:#5fd8e8">${assess.maxScore}</span>
            <span style="font-size:12px;color:var(--text-muted)">النقاط المخصصة:</span>
            <span style="font-size:13px;font-weight:800;color:var(--accent)">${assess.pointsValue||0} ⭐</span>
            <span style="font-size:12px;color:var(--text-muted)">الصفوف:</span>
            ${appliedClasses.map(c=>`<span style="background:rgba(162,155,254,0.15);border:1px solid rgba(162,155,254,0.3);border-radius:8px;padding:2px 10px;font-size:12px;font-weight:700;color:#a29bfe;backdrop-filter:blur(4px)">${c.name}</span>`).join('')}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="openQuickGrades(${assess.id})" class="btn btn-ghost btn-sm" title="لصق الدرجات من Excel أو كتابتها بسرعة">⚡ إدخال سريع</button>
          <button onclick="saveGrades()" class="btn btn-primary btn-sm">💾 حفظ الدرجات</button>
          <button onclick="deleteAssessment(${assess.id})" class="btn btn-ghost btn-sm" style="color:var(--absent)">🗑️</button>
        </div>
      </div>
    </div>`;

  appliedClasses.forEach(cls => {
    const scored = cls.students.filter(s => assess.scores?.[s.id] !== undefined && assess.scores?.[s.id] !== '').length;
    const scores = cls.students.map(s => assess.scores?.[s.id]).filter(v => v !== undefined && v !== '').map(v => parseFloat(v));
    const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;
    const failCount = scores.filter(v => Math.round((v/assess.maxScore)*100) < 50).length;
    const clsId = 'gcls-' + cls.id + '-' + assess.id;
    html += `
      <div class="card mb-4" style="overflow:visible">
        <div class="card-header" style="cursor:pointer;user-select:none" onclick="toggleGradeClassCollapse('${clsId}')">
          <div class="card-title">
            🏫 ${cls.name}
            <span id="ga-arrow-${clsId}" style="margin-right:6px;font-size:12px;color:var(--accent);transition:transform 0.3s;display:inline-block">▼</span>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap" onclick="event.stopPropagation()">
            <span style="font-size:11px;color:var(--text-muted)">تم إدخال ${scored} من ${cls.students.length}</span>
            ${avg !== null ? `<span style="font-size:11px;background:rgba(162,155,254,0.15);color:#a29bfe;border-radius:6px;padding:2px 8px">متوسط: ${avg}/${assess.maxScore}</span>` : ''}
            ${failCount > 0 ? `<span style="font-size:11px;background:rgba(255,107,107,0.15);color:var(--absent);border-radius:6px;padding:2px 8px">⚠️ رسوب: ${failCount}</span>` : ''}
          </div>
        </div>
        <div id="${clsId}" style="display:block">
          <div style="padding:8px 0">
            <!-- row header -->
            <div style="display:flex;align-items:center;padding:6px 18px;font-size:11px;font-weight:700;color:var(--text-muted);border-bottom:1px solid var(--border-color)">
              <div style="flex:1">الطالب</div>
              <div style="width:120px;text-align:center">الدرجة (من ${assess.maxScore})</div>
              <div style="width:80px;text-align:center">النسبة</div>
            </div>
            ${cls.students.map(s => {
              const score = assess.scores?.[s.id] !== undefined ? assess.scores[s.id] : '';
              const pct = score !== '' ? Math.round((parseFloat(score)/assess.maxScore)*100) : null;
              const color = pct === null ? 'var(--text-muted)' : pct >= 75 ? 'var(--present)' : pct >= 50 ? '#ff9f43' : 'var(--absent)';
              // مجموع درجات الطالب في كل التقييمات
              const allAssess = state.assessments || [];
              const studentScoresSummary = allAssess
                .filter(a => a.classIds.includes(cls.id) && a.id !== assess.id)
                .map(a => {
                  const sc = a.scores?.[s.id];
                  if (sc === undefined || sc === '') return null;
                  return { name: a.name, score: sc, max: a.maxScore };
                }).filter(Boolean);
              const totalScored = allAssess.filter(a => a.classIds.includes(cls.id)).reduce((sum, a) => {
                const sc = a.scores?.[s.id];
                return sum + (sc !== undefined && sc !== '' ? parseFloat(sc) : 0);
              }, 0);
              const totalMax = allAssess.filter(a => a.classIds.includes(cls.id)).reduce((sum, a) => sum + a.maxScore, 0);
              const hasTotals = allAssess.filter(a => a.classIds.includes(cls.id)).some(a => a.scores?.[s.id] !== undefined && a.scores?.[s.id] !== '');
              return `<div class="student-row" id="grow-${cls.id}-${s.id}">
                <div class="student-avatar">${s.name.charAt(0)}</div>
                <div class="student-info">
                  <div class="student-name">${s.name}</div>
                  ${hasTotals ? buildAssessBadges(allAssess.filter(a=>a.classIds.includes(cls.id)), s.id) : ''}
                </div>
                <div style="width:120px;text-align:center">
                  <input type="number" min="0" max="${assess.maxScore}" value="${score}"
                    id="gscore-${assess.id}-${s.id}" class="gscore-in" data-sid="${s.id}" data-cls="${cls.id}"
                    oninput="updateGradePreview(${assess.id},${s.id},${assess.maxScore})"
                    onkeydown="gradeKeyNav(event)" onpaste="gradePasteColumn(event, ${assess.id}, ${assess.maxScore})"
                    style="width:80px;text-align:center;background:var(--surface2);border:1.5px solid var(--border-color);border-radius:8px;padding:5px 8px;color:var(--accent);font-family:Tajawal,sans-serif;font-size:14px;font-weight:900;outline:none"
                    onfocus="this.style.borderColor='var(--accent)';this.closest('.student-row').classList.add('grade-focus')" onblur="this.style.borderColor='var(--border-color)';this.closest('.student-row').classList.remove('grade-focus')" />
                </div>
                <div style="width:80px;text-align:center">
                  <span id="gpct-${assess.id}-${s.id}" style="font-size:13px;font-weight:800;color:${color}">${pct !== null ? pct+'%' : '—'}</span>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>`;
  });
  c.innerHTML = html;
}

function updateGradePreview(assessId, studentId, maxScore) {
  const input = document.getElementById(`gscore-${assessId}-${studentId}`);
  const pctEl = document.getElementById(`gpct-${assessId}-${studentId}`);
  if (!input || !pctEl) return;
  // منع تجاوز الدرجة النهائية
  if (input.value !== '' && parseFloat(input.value) > maxScore) {
    input.value = maxScore;
    input.style.borderColor = 'var(--absent)';
    setTimeout(() => { input.style.borderColor = ''; }, 800);
    toast(`الدرجة القصوى هي ${maxScore}`, '⚠️');
  }
  if (input.value !== '' && parseFloat(input.value) < 0) input.value = 0;
  const val = input.value;
  if (val === '' || isNaN(parseFloat(val))) { pctEl.textContent = '—'; pctEl.style.color = 'var(--text-muted)'; return; }
  const pct = Math.round((parseFloat(val)/maxScore)*100);
  pctEl.textContent = pct + '%';
  pctEl.style.color = pct >= 75 ? 'var(--present)' : pct >= 50 ? '#ff9f43' : 'var(--absent)';
}

function saveGrades() {
  const assess = state.assessments?.find(a => a.id === activeAssessmentId);
  if (!assess) return;
  if (!assess.scores) assess.scores = {};
  if (!assess.awardedPoints) assess.awardedPoints = {};

  const appliedClasses = state.classes.filter(cls => assess.classIds.includes(cls.id));
  const pointsValue = assess.pointsValue || 0;
  let count = 0;

  // أولاً: تحديث الدرجات و awardedPoints
  appliedClasses.forEach(cls => {
    cls.students.forEach(s => {
      const input = document.getElementById(`gscore-${assess.id}-${s.id}`);
      if (!input) return;
      const v = input.value.trim();
      const newScore = v === '' ? '' : parseFloat(v);
      assess.scores[s.id] = newScore;
      if (newScore !== '' && pointsValue > 0) {
        const pct = parseFloat(newScore) / assess.maxScore;
        const earned = Math.round(pct * pointsValue);
        const prevEarned = assess.awardedPoints[s.id] || 0;
        assess.awardedPoints[s.id] = earned;
        // سجّل في pointsLog فقط إذا تغيّرت القيمة
        if (earned !== prevEarned) {
          // إزالة السجل القديم لهذا التقييم إن وجد
          if (s.pointsLog) s.pointsLog = s.pointsLog.filter(e => !(e.type === 'assessment' && e.assessId === assess.id));
          if (earned > 0) logPoints(s, 'assessment', earned, todayISO(), { assessId: assess.id, assessName: assess.name });
        }
      } else {
        // إزالة نقاط التقييم من pointsLog إذا مُسحت الدرجة
        if (s.pointsLog) s.pointsLog = s.pointsLog.filter(e => !(e.type === 'assessment' && e.assessId === assess.id));
        assess.awardedPoints[s.id] = 0;
      }
      if (v !== '') count++;
    });
  });

  // ثانياً: إعادة الحساب الكاملة من المصدر (حضور + مشاركة + مكافآت + كل التقييمات)
  appliedClasses.forEach(cls => {
    cls.students.forEach(s => recomputeWithAssessments(cls, s));
  });

  save();
  renderStudentList();
  updateLeaderboard();
  const msg = pointsValue > 0 ? `تم حفظ ${count} درجة وتحديث النقاط ✅` : `تم حفظ ${count} درجة ✅`;
  toast(msg, '💾');
}

function toggleGradeClassCollapse(id) {
  const body = document.getElementById(id);
  const arrow = document.getElementById('ga-arrow-' + id);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}



/* ===== تاريخ التقييم + الإدخال السريع ===== */
function setAssessDate(id, v) {
  const a = (state.assessments || []).find(x => x.id === id);
  if (!a) return;
  a.date = v || '';
  save(); renderAssessmentTabs();
  toast('تم حفظ تاريخ التقييم', '📅');
}
// Enter أو ↓ ينقل إلى الطالب التالي، ↑ إلى السابق
function gradeKeyNav(e) {
  if (!['Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
  e.preventDefault();
  const all = [...document.querySelectorAll('#grades-content .gscore-in')];
  const i = all.indexOf(e.target);
  const n = all[i + (e.key === 'ArrowUp' ? -1 : 1)];
  if (n) { n.focus(); n.select(); n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  else if (e.key === 'Enter') saveGrades();
}
// لصق عمود درجات من Excel في أول خانة ⇐ يتوزع على الطلاب بالترتيب
function gradePasteColumn(e, assessId, max) {
  const txt = (e.clipboardData || window.clipboardData).getData('text');
  const lines = txt.split(/\r?\n/).map(x => x.trim()).filter((x, i, a) => x !== '' || i < a.length - 1);
  if (lines.length < 2) return;
  e.preventDefault();
  const all = [...document.querySelectorAll('#grades-content .gscore-in')].filter(x => x.dataset.cls === e.target.dataset.cls);
  let i = all.indexOf(e.target), n = 0;
  lines.forEach(l => {
    if (i >= all.length) return;
    const v = l.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).match(/-?\d+(\.\d+)?/);
    all[i].value = v ? Math.min(max, Math.max(0, parseFloat(v[0]))) : '';
    updateGradePreview(assessId, +all[i].dataset.sid, max);
    i++; n++;
  });
  toast(`تم لصق ${n} درجة — راجعها ثم اضغط «حفظ الدرجات»`, '📋');
}
// إدخال سريع: لصق «رقم الطالب أو الاسم + الدرجة» أو عمود درجات بالترتيب
function openQuickGrades(assessId) {
  const a = (state.assessments || []).find(x => x.id === assessId); if (!a) return;
  const classes = state.classes.filter(c => a.classIds.includes(c.id));
  openModal(`
    <div class="modal-title">⚡ إدخال سريع — ${a.name}</div>
    <div style="font-size:12.5px;color:var(--text-muted);line-height:1.8;margin-bottom:8px">
      الصق من Excel سطراً لكل طالب بإحدى الصيغ:<br>
      • <b>رقم الطالب</b> ثم الدرجة: <code>20190012345 17</code> أو <code>AB12345 17</code><br>
      • <b>الاسم (الرقم)</b> ثم الدرجة: <code>محمد أحمد (20190012345) 17</code><br>
      • أو <b>عمود درجات فقط</b> بنفس ترتيب الطلاب في الشعبة المختارة.<br>
      تظهر نافذة <b>مراجعة</b> قبل الاعتماد لتصحيح أي سطر.<br>
      💡 يمكنك أيضاً لصق عمود الدرجات مباشرة في خانة أول طالب، والتنقل بين الخانات بـ Enter.
    </div>
    <div class="form-group"><label class="form-label">الشعبة (للعمود بالترتيب)</label>
      <select class="select" id="qg-cls">${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
    <textarea class="input" id="qg-text" rows="9" style="font-family:monospace;direction:ltr;text-align:left" placeholder="20190012345	17"></textarea>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="applyQuickGrades(${a.id})">🔍 مراجعة</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
    </div>`);
  setTimeout(() => document.getElementById('qg-text')?.focus(), 100);
}
let QG_REVIEW = null;
function qgNormId(x) { return String(x || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[\s\-_]/g, '').toUpperCase(); }
function qgSidOf(s) { return qgNormId(s.sid || (String(s.name).match(/\(([^()]+)\)\s*$/) || [])[1] || ''); }
// يقرأ النص ⇐ نافذة مراجعة (لا يُحفظ شيء قبل «اعتماد»)
function applyQuickGrades(assessId) {
  const a = (state.assessments || []).find(x => x.id === assessId); if (!a) return;
  const digits = x => String(x).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/٫/g, '.');
  const lines = digits(document.getElementById('qg-text').value).split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (!lines.length) return toast('الصق الدرجات أولاً', '⚠️');
  const clsSel = state.classes.find(c => c.id === +document.getElementById('qg-cls').value);
  const pool = state.classes.filter(c => a.classIds.includes(c.id)).flatMap(c => c.students.map(s => ({ c, s, k: c.id + ':' + s.id })));
  const norm = t => String(t).replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
  const bare = n => norm(String(n).replace(/\([^()]*\)\s*$/, ''));
  const rows = [];
  if (lines.every(l => /^-?\d+(\.\d+)?$/.test(l))) {
    if (!clsSel) return;
    lines.forEach((l, i) => { const s = clsSel.students[i]; rows.push({ line: l, k: s ? clsSel.id + ':' + s.id : '', g: parseFloat(l), how: s ? 'بالترتيب' : '' }); });
  } else {
    lines.forEach(l => {
      const m = l.match(/^(.*?)[\s,;:،]+(-?\d+(?:\.\d+)?)\s*$/);
      if (!m) { rows.push({ line: l, k: '', g: '', how: '' }); return; }
      let key = m[1].trim(), g = parseFloat(m[2]), id = '', name = '';
      const pm = key.match(/^(.*?)\s*[\(\[]\s*([^()\[\]]+?)\s*[\)\]]\s*$/);
      if (pm) { name = pm[1]; id = pm[2]; }
      else if (!/\s/.test(key) && /\d/.test(key)) id = key;           // رقم فقط أو أرقام وحروف
      else name = key;
      let hit = null, how = '';
      if (id) { const ni = qgNormId(id); hit = pool.find(x => qgSidOf(x.s) && qgSidOf(x.s) === ni); if (hit) how = 'بالرقم'; }
      if (!hit && name) {
        const nk = norm(name);
        hit = pool.find(x => bare(x.s.name) === nk);
        if (!hit) { const c = pool.filter(x => bare(x.s.name).includes(nk) || nk.includes(bare(x.s.name))); if (c.length === 1) hit = c[0]; }
        if (hit) how = 'بالاسم';
      }
      rows.push({ line: l, k: hit ? hit.k : '', g, how });
    });
  }
  QG_REVIEW = { assessId, rows, pool };
  qgRenderReview();
}
function qgRenderReview() {
  const R = QG_REVIEW; if (!R) return;
  const a = (state.assessments || []).find(x => x.id === R.assessId);
  const cnt = {}; R.rows.forEach(r => { if (r.k) cnt[r.k] = (cnt[r.k] || 0) + 1; });
  const opts = sel => '<option value="">— غير مطابق —</option>' + R.pool.map(x => `<option value="${x.k}" ${x.k === sel ? 'selected' : ''}>${x.c.name} — ${x.s.name.replace(/\s*\([^()]*\)\s*$/, '')}${x.s.sid ? ' (' + x.s.sid + ')' : ''}</option>`).join('');
  const ok = R.rows.filter(r => r.k && r.g !== '' && !isNaN(r.g)).length;
  openModal(`
    <div class="modal-title">🔍 مراجعة الدرجات قبل الاعتماد — ${a ? a.name : ''}</div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">صحّح الطالب أو الدرجة عند الحاجة. الدرجة القصوى ${a ? a.maxScore : ''}. ✅ ${ok} من ${R.rows.length}</div>
    <div style="max-height:55vh;overflow:auto">
    <table style="width:100%;border-collapse:collapse;font-size:12.5px">
      <tr style="color:var(--text-muted)"><th style="text-align:right">السطر</th><th>الطالب</th><th>الدرجة</th><th></th></tr>
      ${R.rows.map((r, i) => {
        const dup = r.k && cnt[r.k] > 1, over = a && r.g !== '' && (r.g > a.maxScore || r.g < 0);
        const st = !r.k ? '❌' : dup ? '⚠️ مكرر' : over ? '⚠️ خارج الحد' : '✅ ' + (r.how || '');
        return `<tr style="border-top:1px solid var(--border-color);background:${!r.k || dup || over ? 'rgba(255,107,107,.08)' : 'transparent'}">
          <td style="font-family:monospace;direction:ltr;text-align:left;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${rsEsc(r.line)}">${rsEsc(r.line)}</td>
          <td><select class="select" style="font-size:12px;padding:4px" onchange="QG_REVIEW.rows[${i}].k=this.value;QG_REVIEW.rows[${i}].how='يدوي';qgRenderReview()">${opts(r.k)}</select></td>
          <td style="text-align:center"><input class="input" type="number" value="${r.g}" style="width:70px;padding:4px;text-align:center" oninput="QG_REVIEW.rows[${i}].g=this.value===''?'':parseFloat(this.value)" onchange="qgRenderReview()"></td>
          <td style="font-size:11px;white-space:nowrap">${st}</td></tr>`; }).join('')}
    </table></div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="qgApprove()">✅ اعتماد وحفظ (${ok})</button>
      <button class="btn btn-ghost" onclick="openQuickGrades(${R.assessId})">↩ تعديل النص</button>
      <button class="btn btn-ghost" onclick="QG_REVIEW=null;closeModalForce()">إلغاء</button>
    </div>`);
}
function qgApprove() {
  const R = QG_REVIEW; if (!R) return;
  const a = (state.assessments || []).find(x => x.id === R.assessId); if (!a) return;
  if (!a.scores) a.scores = {};
  let n = 0;
  R.rows.forEach(r => {
    if (!r.k || r.g === '' || isNaN(r.g)) return;
    const sid = +r.k.split(':')[1], v = Math.min(a.maxScore, Math.max(0, r.g));
    const el = document.getElementById(`gscore-${a.id}-${sid}`);
    if (el) el.value = v; else a.scores[sid] = v;
    n++;
  });
  QG_REVIEW = null;
  closeModalForce();
  if (activeAssessmentId === a.id) saveGrades();      // يحسب نقاط الدرجات ويحفظ كالمعتاد
  else { save(); if (typeof renderGradesContent === 'function') renderGradesContent(); }
  toast(`تم اعتماد ${n} درجة ✅`, '⚡');
}
(function () {   // إبراز صف الطالب أثناء إدخال درجته
  const st = document.createElement('style');
  st.textContent = '.student-row.grade-focus{background:rgba(247,201,72,.16)!important;outline:2px solid var(--accent);outline-offset:-2px;border-radius:12px}.student-row.grade-focus .student-name{color:var(--accent)}';
  document.head.appendChild(st);
})();
