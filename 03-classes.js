/* 03-classes.js — إدارة الصفوف والطلاب، الترتيب الأبجدي، إحصائيات صفحة الصفوف، حسابات الطالب */

// ===== CLASS MANAGEMENT =====
function renderClassTabs() {
  const c = document.getElementById('class-tabs-container');
  if (!state.classes.length) { c.innerHTML = ''; return; }
  if (!state.activeClass || !state.classes.find(x => x.id === state.activeClass))
    state.activeClass = state.classes[0].id;
  c.innerHTML = state.classes.map(cls => `
    <button class="flt-btn ${cls.id === state.activeClass ? 'flt-btn-on' : ''}"
      onclick="setActiveClass(${cls.id})">
      🏫 ${cls.name} <span style="opacity:.7;font-size:11px">(${cls.students.length})</span>
    </button>`).join('');
}

function refreshAllCounterBadges() {
  // تحديث كل badges العدادات في الواجهة
  const cls = state.classes.find(c => c.id === state.activeClass);
  if (!cls) return;
  cls.students.forEach(s => _updateTempCounterUI(s.id));
}

function setActiveClass(id) {
  state.activeClass = id;
  _activeLetterFilter = 'all';
  renderClassTabs();
  renderStudentList();
}

function showAddClassModal() {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  openModal(`
    <div class="modal-title">🏫 إضافة صف جديد</div>
    <div class="form-group"><label class="form-label">اسم الصف</label>
      <input class="input" id="m-class-name" placeholder="مثال: 8/4" /></div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="addClass()">إضافة</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
    </div>`);
}
function addClass() {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const name = document.getElementById('m-class-name').value.trim();
  if (!name) return toast('أدخل اسم الصف', '⚠️');
  const cls = { id: Date.now(), name, students: [], _savedDates: [] };
  state.classes.push(cls);
  if (!state.activeClass) state.activeClass = cls.id;
  save(); closeModalForce(); renderClassTabs(); renderStudentList(); renderClasses(); updateReportSelects();
  toast('تم إضافة الصف ' + name, '🏫');
}
function deleteClass(id) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const cls = state.classes.find(c => c.id === id);
  if (!cls) return;
  const count = cls.students.length;
  if (!confirm(`⚠️ حذف الصف "${cls.name}"؟\n${count > 0 ? `سيتم حذف ${count} طالب وجميع بياناتهم بشكل نهائي.` : 'الصف فارغ.'}\nهذا الإجراء لا يمكن التراجع عنه.`)) return;
  state.classes = state.classes.filter(c => c.id !== id);
  if (state.activeClass === id) state.activeClass = state.classes[0]?.id || null;
  save(); renderClassTabs(); renderStudentList(); renderClasses(); updateLeaderboard(); updateReportSelects();
  toast('تم حذف الصف', '🗑️');
}

// ===== STUDENT MANAGEMENT =====
function showAddStudentModal(classId) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  openModal(`
    <div class="modal-title">👤 إضافة طلاب</div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <button id="tab-single" onclick="switchAddTab('single')"
        style="flex:1;padding:8px;border-radius:8px;border:2px solid var(--accent);background:rgba(247,201,72,0.15);color:var(--accent);font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;cursor:pointer">
        👤 طالب واحد
      </button>
      <button id="tab-bulk" onclick="switchAddTab('bulk')"
        style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;cursor:pointer">
        👥 إضافة جماعية
      </button>
    </div>

    <!-- إضافة فردية -->
    <div id="add-single-panel">
      <div class="form-group">
        <label class="form-label">اسم الطالب</label>
        <input class="input" id="m-student-name" placeholder="الاسم الكامل (رقم الهوية اختياري)" />
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" style="flex:1" onclick="addStudent(${classId})">إضافة</button>
        <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
      </div>
    </div>

    <!-- إضافة جماعية -->
    <div id="add-bulk-panel" style="display:none">
      <div class="form-group">
        <label class="form-label">أدخل الأسماء — كل اسم في سطر مستقل</label>
        <textarea class="input" id="m-bulk-names"
          placeholder="محمد علي أحمد&#10;خالد سعيد العمري&#10;راشد محمد الكندي&#10;..."
          style="height:200px;resize:vertical;line-height:1.8;font-size:13px"></textarea>
        <div style="font-size:11px;color:var(--text-muted);margin-top:5px">
          💡 يمكن إضافة رقم الهوية بعد الاسم: محمد علي (2016001234)
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" style="flex:1" onclick="addBulkStudents(${classId})">➕ إضافة الكل</button>
        <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
      </div>
    </div>
  `);
  setTimeout(() => document.getElementById('m-student-name')?.focus(), 100);
}

function switchAddTab(tab) {
  const isSingle = tab === 'single';
  document.getElementById('add-single-panel').style.display = isSingle ? 'block' : 'none';
  document.getElementById('add-bulk-panel').style.display   = isSingle ? 'none' : 'block';
  document.getElementById('tab-single').style.cssText = isSingle
    ? 'flex:1;padding:8px;border-radius:8px;border:2px solid var(--accent);background:rgba(247,201,72,0.15);color:var(--accent);font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;cursor:pointer'
    : 'flex:1;padding:8px;border-radius:8px;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;cursor:pointer';
  document.getElementById('tab-bulk').style.cssText = isSingle
    ? 'flex:1;padding:8px;border-radius:8px;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;cursor:pointer'
    : 'flex:1;padding:8px;border-radius:8px;border:2px solid var(--accent);background:rgba(247,201,72,0.15);color:var(--accent);font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;cursor:pointer';
  if (!isSingle) setTimeout(() => document.getElementById('m-bulk-names')?.focus(), 100);
}

// ===== ALPHABETICAL SORT HELPER =====
function sortStudentsAlpha(students) {
  return students.sort((a, b) => a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' }));
}

function addStudent(classId) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const entry = splitNameId(document.getElementById('m-student-name').value);
  const name = entry.name, sid = entry.sid;
  if (!name) return toast('أدخل اسم الطالب', '⚠️');
  const cls = state.classes.find(c => c.id === classId);
  if (!cls) return;
  // تحقق من التكرار في جميع الصفوف (بالرقم إن وُجد، وإلا بالاسم)
  const dupClass = state.classes.find(c => c.students.some(s => sid ? s.sid === sid : s.name === name));
  if (dupClass) return toast(`"${name}" موجود مسبقاً في صف ${dupClass.name}`, '⚠️');
  cls.students.push({ id: Date.now(), name, sid, points:0, present:0, absent:0, participation:0, absenceDates:[], _todayAtt:'unmarked', _prevAtt:{}, parentPhone:'', behaviorNotes:[], _manualBonus:0 });
  cls.students = sortStudentsAlpha(cls.students);
  save(); closeModalForce(); renderClasses(); renderStudentList(); updateLeaderboard();
  toast('تم إضافة ' + name, '👤');
}

function addBulkStudents(classId) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const raw = document.getElementById('m-bulk-names').value;
  const cls = state.classes.find(c => c.id === classId);
  if (!cls) return;

  const names = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (names.length === 0) return toast('أدخل أسماء الطلاب', '⚠️');

  // تحقق من التكرار في جميع الصفوف (ليس فقط الصف الحالي)
  const allNames = new Set(state.classes.flatMap(c => c.students.map(s => s.name)));
  const allSids = new Set(state.classes.flatMap(c => c.students.map(s => s.sid)).filter(Boolean));
  const toAdd = names.map(splitNameId).filter(e => {
    const dup = e.sid ? allSids.has(e.sid) : allNames.has(e.name);
    if (!dup) { allNames.add(e.name); if (e.sid) allSids.add(e.sid); }
    return !dup;
  });
  const skipped = names.length - toAdd.length;

  const baseId = Date.now();
  toAdd.forEach((e, i) => {
    cls.students.push({
      id: baseId + i, name: e.name, sid: e.sid,
      points:0, present:0, absent:0, participation:0,
      absenceDates:[], _todayAtt:'unmarked', _prevAtt:{},
      parentPhone:'', behaviorNotes:[], _manualBonus:0
    });
  });

  cls.students = sortStudentsAlpha(cls.students);

  save(); closeModalForce(); renderClasses(); renderStudentList(); updateLeaderboard();
  let msg = `تم إضافة ${toAdd.length} طالب`;
  if (skipped > 0) msg += ` (تم تخطي ${skipped} مكرر في نفس الصف أو صف آخر)`;
  toast(msg, '👥');
}
function deleteStudent(classId, studentId) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const cls = state.classes.find(c => c.id === classId);
  if (!cls) return;
  const s = cls.students.find(st => st.id === studentId);
  if (!s) return;
  if (!confirm(`⚠️ حذف الطالب "${s.name}"؟\nسيتم حذف جميع بياناته (النقاط، الحضور، الملاحظات) بشكل نهائي.`)) return;
  cls.students = cls.students.filter(st => st.id !== studentId);
  save(); renderClasses(); renderStudentList(); updateLeaderboard();
  toast('تم حذف الطالب', '🗑️');
}

function showMoveStudentModal(fromClassId, studentId) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const fromCls = state.classes.find(c => c.id === fromClassId);
  const s = fromCls?.students.find(st => st.id === studentId);
  if (!s) return;

  // الصفوف المتاحة للنقل (كل الصفوف ما عدا الحالي)
  const otherClasses = state.classes.filter(c => c.id !== fromClassId);
  if (!otherClasses.length) return toast('لا توجد صفوف أخرى للنقل إليها', '⚠️');

  openModal(`
    <div class="modal-title">🔀 نقل طالب — ${s.name}</div>
    <div style="background:var(--surface2);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:var(--text-muted)">
      الصف الحالي: <strong style="color:var(--accent)">${fromCls.name}</strong>
    </div>
    <div class="form-group">
      <label class="form-label">اختر الصف الجديد</label>
      <select class="select" id="m-move-target">
        ${otherClasses.map(c => `<option value="${c.id}">${c.name} (${c.students.length} طالب)</option>`).join('')}
      </select>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:-8px;margin-bottom:14px">
      ✅ جميع بيانات الطالب (النقاط، الحضور، الغياب، الحسابات) ستُنقل معه
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="confirmMoveStudent(${fromClassId},${studentId})">نقل</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
    </div>
  `);
}

function confirmMoveStudent(fromClassId, studentId) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const targetId = parseInt(document.getElementById('m-move-target').value);
  const fromCls = state.classes.find(c => c.id === fromClassId);
  const toCls   = state.classes.find(c => c.id === targetId);
  if (!fromCls || !toCls) return;

  const sIdx = fromCls.students.findIndex(st => st.id === studentId);
  if (sIdx === -1) return;

  const s = fromCls.students[sIdx];

  // التحقق من عدم تكرار الاسم في الصف المستهدف
  if (toCls.students.find(st => st.name === s.name)) {
    return toast(`${s.name} موجود مسبقاً في ${toCls.name}`, '⚠️');
  }

  // نقل الطالب: إزالة من المصدر وإضافة للهدف
  fromCls.students.splice(sIdx, 1);
  toCls.students.push(s);

  // ترتيب أبجدي في الصف الجديد
  toCls.students = sortStudentsAlpha(toCls.students);

  save();
  closeModalForce();
  renderClasses();
  renderClassTabs();
  renderStudentList();
  updateLeaderboard();
  toast(`تم نقل ${s.name} إلى ${toCls.name} ✅`, '🔀');
}

function editStudentWhatsApp(classId, studentId) {
  if (rosterManaged()) { // 🔒 عرض فقط: الرقم واعتماده من الملف المركزي
    const c = state.classes.find(x => x.id === classId), st = c?.students.find(x => x.id === studentId);
    if (!st) return;
    return openModal(`
      <div class="modal-title">📱 رقم ولي الأمر — ${rsEsc(st.name)}</div>
      <div style="font-size:15px;font-weight:800;direction:ltr;text-align:center;margin:10px 0">${st.parentPhone ? rsEsc(st.parentPhone) : '—'}</div>
      <div style="text-align:center;font-size:13px;margin-bottom:10px">${!st.parentPhone ? '⚪ لا يوجد رقم' : st.phoneVerified ? '✅ معتمد' : '⚠️ غير معتمد'}</div>
      <div style="font-size:12px;color:var(--text-muted);text-align:center;line-height:1.8">🔒 الرقم واعتماده يُعدَّلان من الملف المركزي فقط.<br>للتصحيح تواصل مع مسؤول البرنامج.</div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button></div>`);
  }
  const cls = state.classes.find(c => c.id === classId);
  const s = cls?.students.find(st => st.id === studentId);
  if (!s) return;
  const verifiedBadge = s.phoneVerified
    ? `<span style="background:rgba(78,205,196,0.2);color:var(--present);border:1px solid rgba(78,205,196,0.5);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700">✅ معتمد</span>`
    : s.parentPhone ? `<span style="background:rgba(247,201,72,0.15);color:var(--accent);border:1px solid rgba(247,201,72,0.4);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700">⚠️ غير معتمد</span>` : '';
  openModal(`
    <div class="modal-title">📱 رقم ولي الأمر — ${s.name}</div>
    <div class="form-group">
      <label class="form-label">رقم واتساب ولي الأمر (مع رمز الدولة)</label>
      <div style="display:flex;align-items:center;gap:8px">
        <input class="input" id="m-parent-phone" type="tel" value="${s.parentPhone||''}" placeholder="971501234567" style="flex:1"/>
        ${verifiedBadge}
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:6px;padding:7px;background:rgba(255,255,255,0.04);border-radius:8px">
        💡 مثال: 971501234567 (بدون + في البداية)
      </div>
    </div>
    ${s.parentPhone ? `
    <div style="background:rgba(78,205,196,0.07);border:1px solid rgba(78,205,196,0.2);border-radius:10px;padding:12px;margin-bottom:14px">
      <div style="font-size:12px;font-weight:700;color:var(--present);margin-bottom:8px">📲 تأكيد الرقم</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">أرسل رسالة واتساب لتأكيد أن هذا الرقم هو ولي الأمر المعتمد لمتابعة ${s.name} اكاديميا وسلوكيا.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="sendVerifyWA(${classId},${studentId})" class="btn btn-success btn-sm">📱 إرسال رسالة التأكيد</button>
        <button onclick="showVerifyQR(${classId},${studentId})" class="btn btn-ghost btn-sm" style="color:#5fd8e8;border-color:rgba(95,216,232,0.4)">📲 QR كود</button>
        ${s.phoneVerified
          ? `<button onclick="unmarkPhoneVerified(${classId},${studentId})" class="btn btn-ghost btn-sm" style="color:#ff9f43;border-color:rgba(255,159,67,0.4);font-size:11px">إلغاء الاعتماد</button>`
          : `<button onclick="markPhoneVerified(${classId},${studentId})" class="btn btn-ghost btn-sm" style="color:var(--present);border-color:rgba(78,205,196,0.5)">✅ اعتماد الرقم</button>`}
      </div>
    </div>` : ''}
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="saveParentPhone(${classId},${studentId})">💾 حفظ</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button>
    </div>
  `);
  setTimeout(() => document.getElementById('m-parent-phone')?.focus(), 100);
}

function saveParentPhone(classId, studentId) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const cls = state.classes.find(c => c.id === classId);
  const s = cls?.students.find(st => st.id === studentId);
  if (!s) return;
  const newPhone = normalizePhoneUAE(document.getElementById('m-parent-phone').value.trim());
  if (newPhone !== s.parentPhone) s.phoneVerified = false;
  s.parentPhone = newPhone;
  save(); closeModalForce(); renderClasses();
  toast(`تم حفظ رقم ولي أمر ${s.name}`, '📱');
}

function _buildVerifyMsg(studentName, schoolName, teacherName) {
  const school  = schoolName  || 'المدرسة';
  const teacher = teacherName || '';
  return 'السلام عليكم\n\nسيد/ة ولي أمر الطالب/ة: ' + studentName + '\n\nهل ترغب في اعتماد هذا الرقم كرقم تواصل رسمي مع ' + school + '\nلمتابعة أداء ابنكم/ابنتكم أكاديمياً وسلوكياً؟\n\nالرد بـ "موافق" للاعتماد\nأو أرسل رقماً آخر\n\nمعلم المادة: ' + teacher;
}

function sendVerifyWA(classId, studentId) {
  const cls = state.classes.find(c => c.id === classId);
  const s = cls?.students.find(st => st.id === studentId);
  if (!s?.parentPhone) return;
  const info = getSchoolInfo();
  const msg = _buildVerifyMsg(s.name, info.schoolName, info.teacher);
  window.open('https://wa.me/' + s.parentPhone.replace(/\D/g,'') + '?text=' + encodeURIComponent(msg), '_blank');
}

function showVerifyQR(classId, studentId) {
  const cls = state.classes.find(c => c.id === classId);
  const s = cls?.students.find(st => st.id === studentId);
  if (!s?.parentPhone) return;
  const info = getSchoolInfo();
  const msg = _buildVerifyMsg(s.name, info.schoolName, info.teacher);
  const waLink = 'https://wa.me/' + s.parentPhone.replace(/\D/g,'') + '?text=' + encodeURIComponent(msg);
  const qrUrl  = 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=' + encodeURIComponent(waLink);
  openModal(`
    <div class="modal-title">📲 QR تأكيد الرقم — ${s.name}</div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">امسح الكود لإرسال رسالة التأكيد لولي الأمر عبر واتساب</p>
    <div style="text-align:center;margin-bottom:14px">
      <img src="${qrUrl}" style="border-radius:14px;border:3px solid var(--present);width:120px;height:120px;max-width:100%"/>
    </div>
    <div class="modal-actions">
      <button onclick="markPhoneVerified(${classId},${studentId})" class="btn btn-success" style="flex:1">✅ تأكيد الاعتماد</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button>
    </div>
  `);
}

function markPhoneVerified(classId, studentId) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const cls = state.classes.find(c => c.id === classId);
  const s = cls?.students.find(st => st.id === studentId);
  if (!s) return;
  s.phoneVerified = true;
  save(); renderClasses();
  editStudentWhatsApp(classId, studentId);
  toast('✅ تم اعتماد رقم ولي أمر ' + s.name, '✅');
}

function unmarkPhoneVerified(classId, studentId) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const cls = state.classes.find(c => c.id === classId);
  const s = cls?.students.find(st => st.id === studentId);
  if (!s) return;
  s.phoneVerified = false;
  save(); renderClasses();
  editStudentWhatsApp(classId, studentId);
  toast('تم إلغاء اعتماد الرقم', '⚠️');
}
// تتبع حالة طي/تمديد كل صف
const _classExpandState = {};

// ===== مستطيل إحصائيات صفحة إدارة الصفوف =====
function renderClassesStatsBar() {
  const el = document.getElementById('classes-stats-bar');
  if (!el) return;
  let total = 0, noPhone = 0, noAccounts = 0;
  const hrOnly = typeof rsHomeroomEnforced === 'function' && rsHomeroomEnforced();
  const hrList = hrOnly ? (state.rosterMeta.homeroom || []) : null;
  state.classes.forEach(cls => cls.students.forEach(s => {
    total++;
    if (!s.parentPhone) noPhone++;
    if (hrOnly && !hrList.includes(cls.name)) return;      // الحسابات تخص صفوف الرائد فقط
    const hasFullAccounts = !!(s.govAccount?.user && s.govAccount?.pass && s.alifAccount?.user && s.alifAccount?.pass);
    if (!hasFullAccounts) noAccounts++;
  }));
  el.innerHTML = `
    <div class="stat-card yellow"><div class="stat-icon">👨‍🎓</div><div class="stat-value" style="color:var(--accent)">${total}</div><div class="stat-label">إجمالي طلاب المدرسة</div></div>
    <div class="stat-card red" style="cursor:pointer" onclick="showMissingDetail('phone')" title="اضغط لعرض الطلاب"><div class="stat-icon">📵</div><div class="stat-value" style="color:var(--absent)">${noPhone}</div><div class="stat-label">ينقصهم رقم هاتف ⓘ</div></div>
    ${hrOnly && !hrList.length ? `<div class="stat-card purple" title="حسابات الطلاب تظهر لرائد الصف فقط"><div class="stat-icon">🔐</div><div class="stat-value" style="color:#a29bfe;font-size:15px">—</div><div class="stat-label">الحسابات لرائد الصف فقط</div></div>`
      : `<div class="stat-card purple" style="cursor:pointer" onclick="showMissingDetail('accounts')" title="اضغط لعرض الطلاب"><div class="stat-icon">🔐</div><div class="stat-value" style="color:#a29bfe">${noAccounts}</div><div class="stat-label">ينقصهم بيانات حسابات${hrOnly ? ' (صفوف الريادة: ' + hrList.join('، ') + ')' : ''} ⓘ</div></div>`}
  `;
}

// عرض تفصيلي لقائمة الطلاب الناقص لهم رقم هاتف أو بيانات حسابات، مع رابط سريع للتعديل
function showMissingDetail(kind) {
  const list = [];
  state.classes.forEach(cls => cls.students.forEach(s => {
    if (kind !== 'phone' && typeof canSeeAccounts === 'function' && !canSeeAccounts(cls.name)) return;
    const missing = kind === 'phone'
      ? !s.parentPhone
      : !(s.govAccount?.user && s.govAccount?.pass && s.alifAccount?.user && s.alifAccount?.pass);
    if (missing) list.push({ cls, s });
  }));
  const title = kind === 'phone' ? '📵 طلاب بدون رقم هاتف ولي الأمر' : '🔐 طلاب تنقصهم بيانات حسابات';
  const rows = list.length ? list.map(o => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:8px 10px;border-bottom:1px solid var(--border-color)">
      <div style="font-size:13px"><b>${o.s.name}</b> <span style="font-size:11px;color:var(--text-muted)">— 🏫 ${o.cls.name}</span></div>
      <button class="btn btn-ghost btn-sm" onclick="closeModalForce();${kind === 'phone' ? `editStudentWhatsApp(${o.cls.id},${o.s.id})` : `showStudentAccountsModal(${o.cls.id},${o.s.id})`}">✏️ تعديل</button>
    </div>`).join('') : `<div style="padding:20px;text-align:center;color:var(--text-muted)">لا يوجد طلاب — كل البيانات مكتملة ✅</div>`;
  openModal(`
    <div class="modal-title">${title} (${list.length})</div>
    <div style="max-height:360px;overflow-y:auto;border:1px solid var(--border-color);border-radius:10px">${rows}</div>
    <div class="modal-actions" style="margin-top:14px"><button class="btn btn-ghost" style="flex:1" onclick="closeModalForce()">إغلاق</button></div>
  `);
}

function renderClasses() {
  renderClassesStatsBar();
  const c = document.getElementById('classes-container');
  if (!state.classes.length) { c.innerHTML = `<div class="empty-state"><div class="icon">🏫</div><p>لا توجد صفوف بعد</p></div>`; return; }

  // حفظ حالة الطي الحالية قبل إعادة الرسم
  state.classes.forEach(cls => {
    const body = document.getElementById('cls-body-' + cls.id);
    if (body) _classExpandState[cls.id] = body.style.display !== 'none';
  });

  c.innerHTML = state.classes.map(cls => {
    const students = cls.students;
    const totalStudents = students.length;
    const avgPoints = totalStudents ? Math.round(students.reduce((s,x)=>s+x.points,0)/totalStudents) : 0;
    const totalSessions = (cls._savedDates||[]).length;
    const failCount = students.filter(s => {
      const assessments = (state.assessments||[]).filter(a=>a.classIds.includes(cls.id));
      if (!assessments.length) return false;
      const scores = assessments.map(a => {
        const sc = a.scores?.[s.id];
        if (sc === undefined || sc === '') return null;
        return Math.round((parseFloat(sc)/a.maxScore)*100);
      }).filter(x => x !== null);
      if (!scores.length) return false;
      return scores.some(p => p < 50);
    }).length;

    // استعادة حالة الطي: مفتوح إذا كان مفتوحاً قبل الرسم
    const isExpanded = _classExpandState[cls.id] === true;
    const bodyDisplay = isExpanded ? 'block' : 'none';
    const arrowRotate = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';

    return `
    <div class="card mb-4" style="overflow:visible">
      <div class="card-header" style="cursor:pointer;user-select:none" onclick="toggleClassCollapse(${cls.id})">
        <div class="card-title">
          🏫 ${cls.name}
          <span style="font-size:12px;color:var(--text-muted);font-weight:500">(${totalStudents} طالب)</span>
          <span id="cls-arrow-${cls.id}" style="margin-right:8px;font-size:13px;color:var(--accent);transition:transform 0.3s;display:inline-block;transform:${arrowRotate}">▼</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap" onclick="event.stopPropagation()">
          <span style="font-size:11px;background:rgba(247,201,72,0.15);color:var(--accent);border-radius:6px;padding:2px 8px">⭐ متوسط: ${avgPoints}</span>
          ${failCount > 0 ? `<span style="font-size:11px;background:rgba(255,107,107,0.15);color:var(--absent);border-radius:6px;padding:2px 8px">⚠️ دون 50%: ${failCount}</span>` : ''}
          <span style="font-size:11px;background:rgba(78,205,196,0.1);color:var(--present);border-radius:6px;padding:2px 8px">📅 ${totalSessions} حصة</span>
          <button class="btn btn-primary btn-sm" onclick="showAddStudentModal(${cls.id})">➕ طالب</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteClass(${cls.id})" style="color:var(--absent)">🗑️</button>
        </div>
      </div>
      <div id="cls-body-${cls.id}" style="display:${bodyDisplay}">
        ${students.length === 0
          ? `<div class="empty-state" style="padding:30px"><div class="icon" style="font-size:36px">👤</div><p>لا يوجد طلاب</p></div>`
          : students.map(s => {
              const hasAccounts = (s.govAccount?.user || s.govAccount?.pass || s.alifAccount?.user || s.alifAccount?.pass);
              const hasPhone = !!s.parentPhone;
              return `
            <div class="student-row">
              <div class="student-avatar">${s.name.charAt(0)}</div>
              <div class="student-info">
                <div class="student-name">${s.name}</div>
                <div class="student-meta">⭐ ${s.points} | حاضر: ${s.present} | غائب: ${s.absent} | مشاركة: ${s.participation}${s.parentPhone?` | 📱 ${s.parentPhone}`:''}</div>
              </div>
              ${(typeof canSeeAccounts !== 'function' || canSeeAccounts(cls.name)) ? `<button onclick="showStudentAccountsModal(${cls.id},${s.id})" class="btn btn-ghost btn-sm ${hasAccounts ? 'contact-complete' : 'contact-missing'}"
                title="${hasAccounts ? 'حسابات الطالب' : 'حسابات غير مضافة — اضغط لإضافتها'}"
                style="font-size:16px;padding:4px 9px;">
                📧
              </button>` : ''}
              <button onclick="editStudentWhatsApp(${cls.id},${s.id})"
                class="btn btn-ghost btn-sm ${!s.parentPhone ? 'contact-nophone' : s.phoneVerified ? 'contact-verified' : 'contact-unverified'}"
                title="${!s.parentPhone ? 'رقم ولي الأمر — اضغط لإضافته' : s.phoneVerified ? '✅ معتمد: '+s.parentPhone : '⚠️ غير معتمد: '+s.parentPhone}"
                style="font-size:15px;padding:4px 9px;display:flex;align-items:center;gap:2px">
                📱${!s.parentPhone ? '' : s.phoneVerified ? '<span style="font-size:9px;color:var(--present)">✓</span>' : '<span style="font-size:9px;color:var(--accent)">!</span>'}
              </button>
              <button onclick="showMoveStudentModal(${cls.id},${s.id})" class="btn btn-ghost btn-sm"
                title="نقل الطالب إلى شعبة أخرى"
                style="font-size:16px;padding:4px 9px;color:#a29bfe;border-color:rgba(162,155,254,0.4)">
                🔀
              </button>
              <button class="btn btn-ghost btn-sm" onclick="deleteStudent(${cls.id},${s.id})" style="font-size:16px;padding:4px 9px;color:var(--absent)">🗑️</button>
            </div>`;
            }).join('')}
      </div>
    </div>`;
  }).join('');
}

function toggleClassCollapse(clsId) {
  const body = document.getElementById('cls-body-' + clsId);
  const arrow = document.getElementById('cls-arrow-' + clsId);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  _classExpandState[clsId] = !isOpen;
  if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}

// ===== STUDENT ACCOUNTS (حسابات الطالب) =====
function showStudentAccountsModal(classId, studentId) {
  const cls = state.classes.find(c => c.id === classId);
  const s = cls?.students.find(st => st.id === studentId);
  if (!s) return;
  if (typeof canSeeAccounts === 'function' && !canSeeAccounts(cls.name)) return toast('🔒 حسابات الطلاب تظهر لرائد الصف فقط', '🔐');
  const gov = s.govAccount || { user: '', pass: '' };
  const alif = s.alifAccount || { user: '', pass: '' };

  openModal(`
    <div class="modal-title">🎓 حسابات الطالب — ${s.name}</div>

    <!-- الحساب الوزاري -->
    <div style="background:rgba(95,216,232,0.08);border:1px solid rgba(95,216,232,0.25);border-radius:12px;padding:14px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:800;color:#5fd8e8;margin-bottom:10px">🏛️ الحساب الوزاري</div>
      <div class="form-group" style="margin-bottom:8px">
        <label class="form-label">البريد الالكتروني الوزاري/ حساب بوابة التعلم الذكي</label>
        <div style="display:flex;gap:6px;align-items:center">
          <input class="input" id="m-gov-user" value="${gov.user||''}" placeholder="stum20xxxxxxxx@moe.sch.ae" style="flex:1;min-width:0;box-sizing:border-box"/>
          <button onclick="copyField('m-gov-user')" title="نسخ الحساب"
            style="flex-shrink:0;width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:rgba(95,216,232,0.15);border:1.5px solid rgba(95,216,232,0.4);border-radius:8px;cursor:pointer;font-size:16px;color:#5fd8e8;transition:all 0.2s"
            onmouseover="this.style.background='rgba(95,216,232,0.3)'" onmouseout="this.style.background='rgba(95,216,232,0.15)'">📋</button>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">كلمة المرور</label>
        <div style="display:flex;gap:6px;align-items:center">
          <div style="position:relative;flex:1;min-width:0">
            <input class="input" id="m-gov-pass" type="password" value="${gov.pass||''}" placeholder="كلمة المرور" style="padding-left:36px;width:100%;box-sizing:border-box"/>
            <button onclick="togglePassVis('m-gov-pass','eye-gov')" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:15px;z-index:1" id="eye-gov">👁️</button>
          </div>
          <button onclick="copyField('m-gov-pass')" title="نسخ كلمة المرور"
            style="flex-shrink:0;width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:rgba(95,216,232,0.15);border:1.5px solid rgba(95,216,232,0.4);border-radius:8px;cursor:pointer;font-size:16px;color:#5fd8e8;transition:all 0.2s"
            onmouseover="this.style.background='rgba(95,216,232,0.3)'" onmouseout="this.style.background='rgba(95,216,232,0.15)'">📋</button>
        </div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:5px">🕓 ${s.govPassUpdated ? 'آخر تحديث: ' + timeAgo(s.govPassUpdated) : 'لم يُحدَّث بعد'}</div>
      </div>
    </div>

    <!-- حساب منصة ألف -->
    <div style="background:rgba(162,155,254,0.08);border:1px solid rgba(162,155,254,0.25);border-radius:12px;padding:14px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:800;color:#a29bfe;margin-bottom:10px">📚 منصة ألف (Alef)</div>
      <div class="form-group" style="margin-bottom:8px">
        <label class="form-label">حساب منصة ألف</label>
        <div style="display:flex;gap:6px;align-items:center">
          <input class="input" id="m-alif-user" value="${alif.user||''}" placeholder="20xxxxxxxx@alefedu.net" style="flex:1;min-width:0;box-sizing:border-box"/>
          <button onclick="copyField('m-alif-user')" title="نسخ الحساب"
            style="flex-shrink:0;width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:rgba(162,155,254,0.15);border:1.5px solid rgba(162,155,254,0.4);border-radius:8px;cursor:pointer;font-size:16px;color:#a29bfe;transition:all 0.2s"
            onmouseover="this.style.background='rgba(162,155,254,0.3)'" onmouseout="this.style.background='rgba(162,155,254,0.15)'">📋</button>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">كلمة المرور</label>
        <div style="display:flex;gap:6px;align-items:center">
          <div style="position:relative;flex:1;min-width:0">
            <input class="input" id="m-alif-pass" type="password" value="${alif.pass||''}" placeholder="كلمة المرور" style="padding-left:36px;width:100%;box-sizing:border-box"/>
            <button onclick="togglePassVis('m-alif-pass','eye-alif')" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:15px;z-index:1" id="eye-alif">👁️</button>
          </div>
          <button onclick="copyField('m-alif-pass')" title="نسخ كلمة المرور"
            style="flex-shrink:0;width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:rgba(162,155,254,0.15);border:1.5px solid rgba(162,155,254,0.4);border-radius:8px;cursor:pointer;font-size:16px;color:#a29bfe;transition:all 0.2s"
            onmouseover="this.style.background='rgba(162,155,254,0.3)'" onmouseout="this.style.background='rgba(162,155,254,0.15)'">📋</button>
        </div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:5px">🕓 ${s.alifPassUpdated ? 'آخر تحديث: ' + timeAgo(s.alifPassUpdated) : 'لم يُحدَّث بعد'}</div>
      </div>
    </div>

    <div class="modal-actions" style="flex-wrap:wrap;gap:8px">
      <button class="btn btn-primary" style="flex:1;min-width:100px" onclick="saveStudentAccounts(${classId},${studentId})">💾 حفظ</button>
      ${s.parentPhone ? `
      <button class="btn btn-success btn-sm" onclick="sendAccountsViaWhatsApp(${classId},${studentId})" title="إرسال البيانات واتساب">📱 واتساب</button>
      <button class="btn btn-ghost btn-sm" onclick="showAccountsQR(${classId},${studentId})" title="QR Code للرسالة" style="color:#a29bfe;border-color:#a29bfe">📲 QR</button>
      ` : ''}
      <button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button>
    </div>
  `);
}

function copyField(inputId) {
  var el = document.getElementById(inputId);
  if (!el) return;
  // للباسوورد: نحول مؤقتاً لـ text للنسخ
  var wasPass = el.type === 'password';
  if (wasPass) el.type = 'text';
  var val = el.value || '';
  if (wasPass) el.type = 'password';
  if (!val) { toast('الحقل فارغ', '⚠️'); return; }
  navigator.clipboard.writeText(val).then(function(){
    toast('تم النسخ ✅', '📋');
  }).catch(function(){
    var tmp = document.createElement('input');
    tmp.value = val; tmp.style.position = 'fixed'; tmp.style.opacity = '0';
    document.body.appendChild(tmp);
    tmp.select(); document.execCommand('copy');
    document.body.removeChild(tmp);
    toast('تم النسخ ✅', '📋');
  });
}

function togglePassVis(inputId, btnId) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  const btn = document.getElementById(btnId);
  if (btn) btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
}

function saveStudentAccounts(classId, studentId) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const cls = state.classes.find(c => c.id === classId);
  const s = cls?.students.find(st => st.id === studentId);
  if (!s) return;
  const newGov = {
    user: document.getElementById('m-gov-user')?.value.trim() || '',
    pass: document.getElementById('m-gov-pass')?.value || ''
  };
  const newAlif = {
    user: document.getElementById('m-alif-user')?.value.trim() || '',
    pass: document.getElementById('m-alif-pass')?.value || ''
  };
  // تسجيل تاريخ آخر تحديث لكل كلمة مرور تغيّرت فعلياً
  if ((s.govAccount?.pass || '') !== newGov.pass) s.govPassUpdated = Date.now();
  if ((s.alifAccount?.pass || '') !== newAlif.pass) s.alifPassUpdated = Date.now();
  s.govAccount = newGov;
  s.alifAccount = newAlif;
  save();
  closeModalForce();
  renderClasses();
  toast(`تم حفظ حسابات ${s.name} ✅`, '🎓');
}

// ===== تنسيق وقت نسبي (منذ كم من الوقت) =====
function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  const d = Math.floor(h / 24);
  if (d < 30) return `قبل ${d} ي`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `قبل ${mo} شهر`;
  const y = Math.floor(mo / 12);
  return `قبل ${y} سنة`;
}

