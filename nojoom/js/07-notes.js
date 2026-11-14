/* 07-notes.js — الملاحظات السلوكية والنافذة الموحدة للملاحظة وحفظها */

// ===== BEHAVIOR NOTES =====
const POSITIVE_NOTES = [
  'الالتزام بالهدوء والخشوع أثناء الصلاة',
  'الصدق والأمانة',
  'سلوك مثالي يستحق الإشادة',
  'التزام كامل بالحضور والانضباط',
  'تفاعل ممتاز وإجابات متميزة في الدرس',
  'مشاركة فعّالة في الأنشطة الصفية',
  'المبادرة والمشاركة في الأنشطة',
  'مساعدة الزملاء وروح التعاون',
  'تحسّن ملحوظ في الأداء الأكاديمي',
  'إنجاز الواجبات بدقة واتقان',
  'رفع اليد قبل التحدث',
  'النظافة الشخصية ونظافة المكان',
  'غير ذلك...'
];

// ===== الملاحظات السلبية = بنود برنامج مِرْصاد (نفس الرموز B01..B15 و A01..A08) =====
// كل ملاحظة تُحفظ مع رمز مرصاد (code)، فتُحوِّلها لوحة التحكم إلى ملف يقرؤه برنامج مرصاد.
// B05 (تكرار الغياب) و B06 (تكرار التأخر) لا يُدخلان يدوياً: يُحسبان تلقائياً من الحضور (غائب / متأخر).
const MARSAD_NOTES = [
  { code: 'B01', g: 'B', text: 'الجدال مع المعلم أثناء الحصة' },
  { code: 'B02', g: 'B', text: 'تناول الطعام داخل الصف دون إذن' },
  { code: 'B03', g: 'B', text: 'النوم أثناء الحصة' },
  { code: 'B04', g: 'B', text: 'الخروج من الصف دون إذن' },
  { code: 'B07', g: 'B', text: 'التحدث مع الزملاء أثناء الشرح' },
  { code: 'B08', g: 'B', text: 'مقاطعة المعلم أو التحدث دون استئذان' },
  { code: 'B09', g: 'B', text: 'عدم الالتزام بتعليمات المعلم والتوجيهات الصفية' },
  { code: 'B10', g: 'B', text: 'استخدام ألفاظ غير لائقة مع الآخرين' },
  { code: 'B11', g: 'B', text: 'سلوك عدواني لفظي أو جسدي تجاه زملائه' },
  { code: 'B12', g: 'B', text: 'رفض تنفيذ التعليمات أو المهام المطلوبة' },
  { code: 'B13', g: 'B', text: 'العبث بممتلكات المدرسة أو الآخرين' },
  { code: 'B14', g: 'B', text: 'استخدام الأجهزة الإلكترونية دون إذن أو لغير التعلم' },
  { code: 'B15', g: 'B', text: 'عدم الالتزام بالزي أو المظهر المدرسي' },
  { code: 'A01', g: 'A', text: 'عدم إحضار الكتب أو الأدوات المدرسية' },
  { code: 'A02', g: 'A', text: 'عدم إنجاز الواجب المنزلي' },
  { code: 'A03', g: 'A', text: 'ضعف في المهارات الأساسية للمادة' },
  { code: 'A04', g: 'A', text: 'عدم المشاركة في الأنشطة والمناقشات الصفية' },
  { code: 'A05', g: 'A', text: 'عدم التركيز ومتابعة الشرح' },
  { code: 'A06', g: 'A', text: 'عدم إكمال الأنشطة والمهام الصفية' },
  { code: 'A07', g: 'A', text: 'تدنٍّ في نتائج الاختبارات والتقييمات' },
  { code: 'A08', g: 'A', text: 'ضعف الاهتمام والدافعية للتعلم' }
];
// الملاحظات القديمة (قبل التحديث) ورمزها في مرصاد
const MARSAD_LEGACY = {
  'التنمر (لفظي أو جسدي) على زملاءه': 'B11',
  'تجاهل توجيهات المعلم': 'B09',
  'التحدث بدون إذن ومقاطعة المعلم': 'B08',
  'الخروج من الصف بدون إذن': 'B04',
  'غياب متكرر يستدعي المتابعة': 'B05',
  'التأخر المتكرر عن الحصة': 'B06',
  'إهمال الواجبات والمهمات الدراسية': 'A02',
  'عدم إحضار الأدوات أو الكتب': 'A01',
  'اللعب داخل الصف أو إحداث فوضى': 'B09',
  'الانشغال بألعاب الحاسوب عن الحصة الدرسية': 'B14',
  'النوم اثناء الحصة الدرسية': 'B03',
  'الأكل اثناء الحصة': 'B02'
};
const NEGATIVE_NOTES = MARSAD_NOTES.map(n => n.text).concat(['غير ذلك...']);

function marsadCodeOf(text) {
  const n = MARSAD_NOTES.find(x => x.text === text);
  return n ? n.code : (MARSAD_LEGACY[text] || '');
}
// خيارات القائمة: الإيجابية قائمة بسيطة، والسلبية مقسّمة (سلوكي / أكاديمي / أخرى)
function noteOptionsHTML(isPos, selected) {
  const opt = t => `<option value="${t}" ${t === selected ? 'selected' : ''}>${t}</option>`;
  if (isPos) return POSITIVE_NOTES.map(opt).join('');
  return `<optgroup label="السلوك">${MARSAD_NOTES.filter(n => n.g === 'B').map(n => opt(n.text)).join('')}</optgroup>
    <optgroup label="الجانب الأكاديمي">${MARSAD_NOTES.filter(n => n.g === 'A').map(n => opt(n.text)).join('')}</optgroup>
    <optgroup label="أخرى">${opt('غير ذلك...')}</optgroup>`;
}

// ===== نافذة الملاحظة الموحدة — تُستخدم من صفحة الحضور وصفحة التقارير =====
function showAddNoteModal(studentId, studentName, parentPhone, afterSaveCallback) {
  // حفظ الـ callback للاستخدام لاحقاً
  window._noteAfterSave = afterSaveCallback || null;

  openModal(`
    <div class="modal-title">📝 ملاحظة سلوكية — ${studentName}</div>

    <!-- نوع الملاحظة -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      <button id="note-tab-pos" onclick="switchNoteTab('positive')"
        style="padding:10px 8px;border-radius:10px;border:2px solid var(--present);background:rgba(78,205,196,0.15);color:var(--present);font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;cursor:pointer;text-align:center">
        🌟 إيجابية
      </button>
      <button id="note-tab-neg" onclick="switchNoteTab('negative')"
        style="padding:10px 8px;border-radius:10px;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;cursor:pointer;text-align:center">
        ⚠️ سلبية
      </button>
    </div>

    <!-- نص الملاحظة -->
    <div class="form-group">
      <label class="form-label">اختر الملاحظة</label>
      <select class="select" id="note-select" onchange="onNoteSelectChange()">
        ${POSITIVE_NOTES.map(n=>`<option value="${n}">${n}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" id="note-custom-group" style="display:none">
      <label class="form-label">اكتب الملاحظة</label>
      <textarea class="input" id="note-custom-text" style="height:70px;resize:vertical" placeholder="أدخل الملاحظة هنا..."></textarea>
    </div>

    <!-- قسم النقاط -->
    <div id="note-points-section" style="border-radius:10px;padding:12px;margin-bottom:12px;background:rgba(78,205,196,0.07);border:1px solid rgba(78,205,196,0.25)">
      <div style="font-size:12px;font-weight:700;color:var(--present);margin-bottom:10px">⭐ مكافأة نقاط (اختياري)</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <button onclick="setNotePointsMode('none')" id="npt-none"
          style="padding:6px 12px;border-radius:8px;border:2px solid var(--accent);background:rgba(247,201,72,0.25);color:var(--accent);font-family:Tajawal,sans-serif;font-size:13px;font-weight:800;cursor:pointer;transition:all 0.15s">
          لا شيء
        </button>
        ${[1,2,3,4,5].map(n => `
        <button onclick="setNotePointsMode('add',${n})" id="npt-add-${n}"
          style="width:38px;height:38px;border-radius:50%;border:1px solid rgba(78,205,196,0.4);background:transparent;color:var(--text-muted);font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center">
          +${n}
        </button>`).join('')}
      </div>
    </div>

    <div id="note-deduct-section" style="border-radius:10px;padding:12px;margin-bottom:12px;background:rgba(255,107,107,0.07);border:1px solid rgba(255,107,107,0.25);display:none">
      <div style="font-size:12px;font-weight:700;color:var(--absent);margin-bottom:10px">⭐ خصم نقاط (اختياري)</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <button onclick="setNotePointsMode('none')" id="npt-none2"
          style="padding:6px 12px;border-radius:8px;border:2px solid var(--accent);background:rgba(247,201,72,0.25);color:var(--accent);font-family:Tajawal,sans-serif;font-size:13px;font-weight:800;cursor:pointer;transition:all 0.15s">
          لا شيء
        </button>
        ${[1,2,3,4,5].map(n => `
        <button onclick="setNotePointsMode('sub',${n})" id="npt-sub-${n}"
          style="width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,107,107,0.4);background:transparent;color:var(--text-muted);font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center">
          −${n}
        </button>`).join('')}
      </div>
    </div>

    <!-- أزرار الحفظ -->
    <div class="modal-actions" style="flex-wrap:wrap;gap:8px">
      <button class="btn btn-primary" style="flex:1" onclick="saveNoteAndClose(${studentId},'${(parentPhone||'').replace(/'/g,"\\'")}')">💾 حفظ</button>
      ${parentPhone ? `
        <button class="btn btn-success" onclick="saveNoteAndWhatsApp(${studentId},'${studentName.replace(/'/g,"\\'")}','${parentPhone.replace(/'/g,"\\'")}')">📱 حفظ + واتساب</button>
        <button class="btn btn-ghost" onclick="saveNoteAndQR(${studentId},'${studentName.replace(/'/g,"\\'")}','${parentPhone.replace(/'/g,"\\'")}') " style="color:#a29bfe;border-color:#a29bfe">📲 QR</button>
      ` : ''}
      <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
    </div>
  `);
  window._currentNoteType = 'positive';
  window._notePointsMode  = 'none';
  window._notePointsValue = 0;
}

// ===== اختصارات الاستدعاء من صفحتين =====
// showAddNoteFromAttendance مُعرَّفة في نهاية الملف وتستخدم النافذة الموحدة

// ===== تبديل نوع الملاحظة يُظهر/يُخفي قسم النقاط المناسب =====
function switchNoteTab(type) {
  window._currentNoteType = type;
  window._notePointsMode  = 'none';
  window._notePointsValue = 0;
  const isPos = type === 'positive';
  const list  = isPos ? POSITIVE_NOTES : NEGATIVE_NOTES;
  _renderNotePointButtons();

  document.getElementById('note-tab-pos').style.cssText = `padding:10px 8px;border-radius:10px;text-align:center;font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;cursor:pointer;border:${isPos?'2px solid var(--present);background:rgba(78,205,196,0.15);color:var(--present)':'1px solid var(--border-color);background:transparent;color:var(--text-muted)'}`;
  document.getElementById('note-tab-neg').style.cssText = `padding:10px 8px;border-radius:10px;text-align:center;font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;cursor:pointer;border:${!isPos?'2px solid var(--absent);background:rgba(255,107,107,0.15);color:var(--absent)':'1px solid var(--border-color);background:transparent;color:var(--text-muted)'}`;

  const sel = document.getElementById('note-select');
  if (sel) sel.innerHTML = noteOptionsHTML(isPos);
  onNoteSelectChange();

  // إظهار قسم النقاط المناسب
  const addSec = document.getElementById('note-points-section');
  const subSec = document.getElementById('note-deduct-section');
  if (addSec) addSec.style.display = isPos ? 'block' : 'none';
  if (subSec) subSec.style.display = isPos ? 'none' : 'block';

  // إعادة تعيين أزرار النقاط
  _resetNotePointButtons();
}

function setNotePointsMode(mode, value) {
  window._notePointsMode  = mode;
  window._notePointsValue = value || 0;
  _renderNotePointButtons();
}

function _renderNotePointButtons() {
  const mode  = window._notePointsMode  || 'none';
  const value = window._notePointsValue || 0;
  const isPos = window._currentNoteType === 'positive';

  // إعادة رسم زر "لا شيء"
  ['npt-none','npt-none2'].forEach(id => {
    const b = document.getElementById(id);
    if (!b) return;
    const active = mode === 'none';
    b.style.background   = active ? 'rgba(247,201,72,0.25)' : 'transparent';
    b.style.borderWidth  = active ? '2px' : '1px';
    b.style.borderStyle  = 'solid';
    b.style.borderColor  = active ? 'var(--accent)' : 'rgba(255,255,255,0.15)';
    b.style.color        = active ? 'var(--accent)' : 'var(--text-muted)';
    b.style.fontWeight   = active ? '800' : '700';
  });

  // إعادة رسم أزرار الإضافة +1..+5
  [1,2,3,4,5].forEach(n => {
    const ba = document.getElementById(`npt-add-${n}`);
    if (!ba) return;
    const active = mode === 'add' && value === n;
    ba.style.background  = active ? 'rgba(78,205,196,0.25)' : 'transparent';
    ba.style.borderWidth = active ? '2px' : '1px';
    ba.style.borderStyle = 'solid';
    ba.style.borderColor = active ? 'var(--present)' : 'rgba(78,205,196,0.4)';
    ba.style.color       = active ? 'var(--present)' : 'var(--text-muted)';
    ba.style.fontWeight  = active ? '900' : '700';
    ba.style.transform   = active ? 'scale(1.1)' : 'scale(1)';
  });

  // إعادة رسم أزرار الخصم -1..-5
  [1,2,3,4,5].forEach(n => {
    const bs = document.getElementById(`npt-sub-${n}`);
    if (!bs) return;
    const active = mode === 'sub' && value === n;
    bs.style.background  = active ? 'rgba(255,107,107,0.25)' : 'transparent';
    bs.style.borderWidth = active ? '2px' : '1px';
    bs.style.borderStyle = 'solid';
    bs.style.borderColor = active ? 'var(--absent)' : 'rgba(255,107,107,0.4)';
    bs.style.color       = active ? 'var(--absent)' : 'var(--text-muted)';
    bs.style.fontWeight  = active ? '900' : '700';
    bs.style.transform   = active ? 'scale(1.1)' : 'scale(1)';
  });
}

function _resetNotePointButtons() { _renderNotePointButtons(); }

// ===== أزرار الحفظ الموحدة =====
function saveNoteAndClose(studentId, parentPhone) {
  saveNoteUnified(studentId, parentPhone, () => {
    if (typeof window._noteAfterSave === 'function') window._noteAfterSave();
    else { showStudentReport(); updateLeaderboard(); }
  });
}

function saveNoteAndWhatsApp(studentId, studentName, parentPhone) {
  saveNoteUnified(studentId, parentPhone, () => {
    if (typeof window._noteAfterSave === 'function') window._noteAfterSave();
    else updateLeaderboard();
    showParentQR(studentId, studentName, parentPhone);
  });
}

function saveNoteAndQR(studentId, studentName, parentPhone) {
  saveNoteUnified(studentId, parentPhone, () => {
    if (typeof window._noteAfterSave === 'function') window._noteAfterSave();
    else updateLeaderboard();
    showParentQR(studentId, studentName, parentPhone);
  });
}

function onNoteSelectChange() {
  const sel = document.getElementById('note-select');
  const customGroup = document.getElementById('note-custom-group');
  customGroup.style.display = sel.value === 'غير ذلك...' ? 'block' : 'none';
}

function getNoteText() {
  const sel = document.getElementById('note-select');
  if (sel.value === 'غير ذلك...') {
    return document.getElementById('note-custom-text')?.value.trim() || '';
  }
  return sel.value;
}

// ===== دالة حفظ الملاحظة الموحدة — تُستخدم من صفحة الحضور وصفحة التقارير =====
function saveNoteUnified(studentId, parentPhone, afterSave) {
  const cls = state.classes.find(c => c.students.some(st => st.id === studentId));
  const s = cls?.students.find(st => st.id === studentId);
  if (!s) return;
  const text = getNoteText();
  if (!text) return toast('أدخل نص الملاحظة', '⚠️');
  if (!s.behaviorNotes) s.behaviorNotes = [];

  const mode = window._notePointsMode || 'none';
  const rawVal = parseInt(window._notePointsValue || document.getElementById('note-points-value')?.value || 0);
  const pts = mode === 'none' ? 0 : rawVal * (mode === 'sub' ? -1 : 1);

  const noteDateISO = todayISO();
  const noteType = window._currentNoteType || 'positive';
  s.behaviorNotes.push({
    type:   noteType,
    text,
    code:   noteType === 'negative' ? marsadCodeOf(text) : '',   // رمز البند في برنامج مرصاد
    date:   new Date().toLocaleDateString('ar-EG', {numberingSystem:'latn'}),
    points: pts,
    isoDate: noteDateISO
  });

  // سجّل في pointsLog إن كانت الملاحظة تحمل نقاطاً
  if (pts !== 0) {
    logPoints(s, 'note', pts, noteDateISO, { noteText: text });
  }

  // نقاط الملاحظات تُحسب تلقائياً من behaviorNotes في recomputeWithAssessments
  recomputeWithAssessments(cls, s);
  save();
  closeModalForce();
  refreshAllPointsUI(studentId);

  const ptMsg = pts > 0 ? ` (+${pts} ⭐)` : pts < 0 ? ` (${pts} ⭐)` : '';
  toast(`تم حفظ الملاحظة${ptMsg} ✅`, '📝');

  if (typeof afterSave === 'function') afterSave();
}

function saveNote(studentId, parentPhone) {
  saveNoteUnified(studentId, parentPhone, () => {
    showStudentReport();
    updateLeaderboard();
  });
}

function saveNoteAndNotify(studentId, studentName, parentPhone) {
  saveNoteUnified(studentId, parentPhone, () => {
    showStudentReport();
    updateLeaderboard();
    showParentQR(studentId, studentName, parentPhone);
  });
}

function deleteNote(studentId, noteIdx) {
  const cls = state.classes.find(c => c.students.some(st => st.id === studentId));
  const s = cls?.students.find(st => st.id === studentId);
  if (!s || !s.behaviorNotes) return;

  s.behaviorNotes.splice(noteIdx, 1);
  recomputeWithAssessments(cls, s);
  save();
  refreshAllPointsUI(s.id);
  showStudentReport();
}

function _noteMsgText(isPos, studentName, noteText, fmt) {
  const info = (typeof getSchoolInfo === 'function') ? getSchoolInfo() : {};
  const subject = (info.subject || (document.getElementById('subject-title')||{}).textContent || '').trim();
  const teacher = (info.teacher || '').trim();
  let note = String(noteText || '').trim();
  if (note && !/[.!؟?]$/.test(note)) note += '.';
  const subjB = subject ? `*${subject}*` : 'المادة';
  const teachB = teacher ? ` مع المعلم *${teacher}*` : '';
  if (fmt === 'short') {
    return isPos
      ? `السلام عليكم ورحمة الله\nنود إعلامكم بأن ابنكم *${studentName}* قد أبدى سلوكاً مميزاً في حصة مادة: ${subjB}${teacher ? ` | المعلم: *${teacher}*` : ''}. وهو:\n*${note}*\nنشكر لكم حسن التعاون ونتمنى له مزيداً من التفوق.`
      : `السلام عليكم ورحمة الله\nنود إعلامكم بأن ابنكم *${studentName}* قد أبدى سلوكاً يحتاج إلى متابعة في حصة مادة: ${subjB}${teacher ? ` | المعلم: *${teacher}*` : ''}. وهو:\n*${note}*\nنأمل متابعتكم الكريمة وتعاونكم لما فيه مصلحة الطالب.\nشكراً جزيلاً.`;
  }
  if (isPos) {
    return `السلام عليكم ورحمة الله وبركاته،\n\nولي أمر الطالب *${studentName}* المحترم،\n\nيسرّنا إبلاغكم بأن ابنكم قد أظهر سلوكًا إيجابيًا ومميزًا أثناء حصة ${subjB}${teachB}، وتمثّل في:\n\n🌟 *${note}*\n\nنثمّن هذا السلوك المميز، ونشجع ابنكم على الاستمرار فيه، لما له من أثر إيجابي في تعلمه وفي البيئة الصفية.\n\nشكرًا لكم على دعمكم المستمر، ونتمنى لابنكم دوام التميز والنجاح.\n\nمعًا نحو التميز والإبداع.`;
  }
  return `السلام عليكم ورحمة الله وبركاته،\n\nولي أمر الطالب *${studentName}* المحترم،\n\nنود إحاطتكم علمًا بأن الطالب قد أظهر سلوكًا يحتاج إلى متابعة أثناء حصة ${subjB}${teachB}، وتمثّل في:\n\n🔸 *${note}*\n\nنأمل منكم التكرم بمتابعة هذا السلوك مع ابنكم، وتعزيز السلوكيات الإيجابية لديه، بما يسهم في توفير بيئة تعليمية مناسبة للجميع.\n\nشاكرين لكم تعاونكم وحرصكم الدائم على مصلحة ابنكم.\n\nمعًا نحو بيئة تعليمية إيجابية.`;
}
function _noteMsgPreview(t) {
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\*([^*\n]+)\*/g,'<b style="color:var(--text)">$1</b>');
}

function showParentQR(studentId, studentName, parentPhone, fmt) {
  const cls = state.classes.find(c => c.students.some(st => st.id === studentId));
  const s = cls?.students.find(st => st.id === studentId);
  if (!s || !s.behaviorNotes?.length) return;
  fmt = fmt || 'full';
  const lastNote = s.behaviorNotes[s.behaviorNotes.length - 1];
  const isPos = lastNote.type === 'positive';
  const msgText = _noteMsgText(isPos, studentName, lastNote.text, fmt);

  const encoded = encodeURIComponent(msgText);
  const waLink = `https://wa.me/${parentPhone.replace(/\D/g,'')}?text=${encoded}`;
  const qrUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=380x380&margin=10&data=${encodeURIComponent(waLink)}`;
  const safeName = String(studentName).replace(/'/g,"\\'");

  openModal(`
    <div class="modal-title">${isPos?'🌟 إبلاغ إيجابي':'⚠️ إبلاغ سلوكي'} — ${studentName}</div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">امسح QR Code لإرسال الرسالة مباشرة لولي الأمر عبر واتساب</p>
    <div style="text-align:center;margin-bottom:14px">
      <img src="${qrUrl}" alt="QR Code" style="border-radius:12px;border:3px solid ${isPos?'var(--present)':'var(--absent)'};width:170px;height:170px"/>
    </div>
    <div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px">
      <button class="btn ${fmt==='full'?'btn-success':'btn-ghost'}" style="padding:5px 14px;font-size:12px" onclick="showParentQR(${studentId},'${safeName}','${parentPhone}','full')">📜 الصيغة الرسمية</button>
      <button class="btn ${fmt==='short'?'btn-success':'btn-ghost'}" style="padding:5px 14px;font-size:12px" onclick="showParentQR(${studentId},'${safeName}','${parentPhone}','short')">✉️ الصيغة المختصرة</button>
    </div>
    <div style="background:var(--surface2);border-radius:10px;padding:12px;font-size:12px;color:var(--text-muted);margin-bottom:14px;line-height:1.8;white-space:pre-wrap;max-height:240px;overflow:auto">${_noteMsgPreview(msgText)}</div>
    <div class="modal-actions">
      <a href="${waLink}" target="_blank" class="btn btn-success" style="flex:1;text-align:center;text-decoration:none">📱 فتح واتساب مباشرة</a>
      <button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button>
    </div>
  `);
}



function showSummaryQROnly(waLink) {
  var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=12&data=' + encodeURIComponent(waLink);
  openModal(
    '<div class="modal-title">📲 QR — إرسال واتساب</div>'
    +'<div style="text-align:center;padding:10px 0 16px">'
    +'<div style="display:inline-block;background:var(--surface2);border-radius:16px;padding:16px;border:3px solid var(--accent)">'
    +'<img src="'+qrUrl+'" alt="QR" style="display:block;border-radius:10px;width:140px;height:140px"/>'
    +'</div>'
    +'<div style="font-size:12px;color:var(--text-muted);margin-top:12px">افتح كاميرا هاتفك وامسح الكود<br>سيفتح واتساب مع الرسالة تلقائياً</div>'
    +'</div>'
    +'<div class="modal-actions">'
    +'<a href="'+waLink+'" target="_blank" class="btn btn-success" style="flex:1;text-align:center;text-decoration:none">📱 فتح واتساب مباشرة</a>'
    +'<button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button>'
    +'</div>'
  );
}

function sendSummaryWhatsApp() {
  var txt = document.getElementById('summary-msg-textarea')?.value || '';
  if (!txt) return;
  var phone = document.getElementById('summary-msg-textarea')?.dataset.phone || '';
  var encoded = encodeURIComponent(txt);
  var waLink = 'https://wa.me/' + phone.replace(/\D/g,'') + '?text=' + encoded;
  window.open(waLink, '_blank');
}

function showSummaryQRFromTextarea() {
  var txt = document.getElementById('summary-msg-textarea')?.value || '';
  if (!txt) return;
  var phone = document.getElementById('summary-msg-textarea')?.dataset.phone || '';
  var encoded = encodeURIComponent(txt);
  var waLink = 'https://wa.me/' + phone.replace(/\D/g,'') + '?text=' + encoded;
  showSummaryQROnly(waLink);
}
function showReportSummaryQR(studentId, studentName, parentPhone) {
  var cls = state.classes.find(function(c){ return c.students.some(function(st){ return st.id === studentId; }); });
  var s = cls && cls.students.find(function(st){ return st.id === studentId; });
  if (!s) return;
  if (!parentPhone) return toast('لا يوجد رقم واتساب مسجل', '⚠️');

  var subjectTitle = (document.getElementById('subject-title') || {}).textContent || 'المادة';
  var total = (cls._savedDates || []).length;
  var attPct = total > 0 ? Math.round((s.present / total) * 100) : 0;
  var assessList = (state.assessments || []).filter(function(a){ return a.classIds.includes(cls.id); });
  var gradedScores = assessList.map(function(a){
    var sc = a.scores && a.scores[s.id];
    return (sc !== undefined && sc !== '') ? Math.round((parseFloat(sc) / a.maxScore) * 100) : null;
  }).filter(function(x){ return x !== null; });
  var avgScore = gradedScores.length ? Math.round(gradedScores.reduce(function(a,b){ return a+b; }, 0) / gradedScores.length) : null;

  var lines = [];
  lines.push('السلام عليكم ورحمة الله وبركاته');
  lines.push('');
  lines.push('أود مشاركتكم ملخص أداء ابنكم/ابنتكم:');
  lines.push('*' + studentName + '* — ' + cls.name);
  lines.push('المادة: ' + subjectTitle);
  lines.push('');
  lines.push('*ملخص الأداء:*');
  lines.push('- الحضور: ' + s.present + ' من ' + total + ' حصة (' + attPct + '%)');
  lines.push('- المشاركة: ' + s.participation + ' مرة');
  lines.push('- رصيد النقاط: ' + s.points);
  if (avgScore !== null) lines.push('- متوسط التقييمات: ' + avgScore + '%');
  var posNotes = (s.behaviorNotes || []).filter(function(n){ return n.type === 'positive'; }).length;
  var negNotes = (s.behaviorNotes || []).filter(function(n){ return n.type !== 'positive'; }).length;
  if (posNotes > 0 || negNotes > 0) lines.push('- ملاحظات سلوكية: ' + posNotes + ' إيجابية / ' + negNotes + ' تحتاج متابعة');
  lines.push('');
  if (attPct >= 90 && s.points >= 60) lines.push('اداء متميز — نشكركم على متابعتكم ودعمكم.');
  else if (attPct < 60) lines.push('يحتاج الطالب متابعة في الحضور.');
  else lines.push('اداء جيد — نتمنى له مزيداً من التفوق.');
  lines.push('');
  lines.push('مع خالص التحيات،');
  lines.push(subjectTitle);

  var msgText = lines.join('\n');
  var safePhone = parentPhone.replace(/\D/g,'');

  openModal(`
    <div class="modal-title">📊 ملخص تقرير — ${studentName}</div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">يمكنك تعديل الرسالة قبل الإرسال</div>
    <textarea id="summary-msg-textarea"
      data-phone="${safePhone}"
      style="width:100%;min-height:220px;background:var(--surface2);border:1.5px solid var(--border-color);border-radius:10px;padding:12px;font-family:Tajawal,sans-serif;font-size:12px;color:var(--text);line-height:1.9;resize:vertical;direction:rtl;outline:none;box-sizing:border-box"
    >${msgText}</textarea>
    <div class="modal-actions" style="margin-top:12px">
      <button class="btn btn-success" style="flex:2" onclick="sendSummaryWhatsApp()">📱 إرسال واتساب مباشر</button>
      <button class="btn btn-ghost" style="flex:1;color:#a29bfe;border-color:rgba(162,155,254,0.4)" onclick="showSummaryQRFromTextarea()">📲 إرسال عبر QR</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button>
    </div>
  `);
  setTimeout(() => {
    document.getElementById('modal-content')?.closest('.modal')?.classList.add('summary-modal');
  }, 10);
}


function _sendSummaryWA(phone) {
  var txt = document.getElementById('summary-msg-area')?.value || '';
  var link = 'https://wa.me/' + phone.replace(/\D/g,'') + '?text=' + encodeURIComponent(txt);
  window.open(link, '_blank');
}

function _showSummaryQR(phone) {
  var txt = document.getElementById('summary-msg-area')?.value || '';
  var link = 'https://wa.me/' + phone.replace(/\D/g,'') + '?text=' + encodeURIComponent(txt);
  var qUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=12&data=' + encodeURIComponent(link);
  var win = window.open('', '_blank', 'width=660,height=700,resizable=yes');
  if (!win) return;
  win.document.write('<html dir="rtl"><head><title>QR كود الإرسال</title>'
    +'<style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0f0c1a;font-family:Tajawal,sans-serif;color:#fff}'
    +'h3{color:#f7c948;margin-bottom:12px}img{border-radius:16px;border:4px solid #f7c948}'
    +'p{font-size:13px;color:rgba(255,255,255,0.5);margin-top:10px}</style></head>'
    +'<body><h3>📲 امسح للإرسال عبر واتساب</h3>'
    +'<img src="'+qUrl.replace('size=600x600','size=800x800')+'" width="280" height="280" style="cursor:zoom-in;background:#fff" title="اضغط للتكبير" onclick="var f=this.dataset.f===\'1\';this.dataset.f=f?\'0\':\'1\';this.style.cssText=f?\'cursor:zoom-in;background:#fff\':\'position:fixed;inset:0;margin:auto;width:min(96vw,96vh);height:min(96vw,96vh);background:#fff;padding:12px;box-sizing:border-box;border-radius:16px;cursor:zoom-out;box-shadow:0 0 0 100vmax rgba(0,0,0,.92)\'">'
    +'<p>بعد المسح سيفتح واتساب مع الرسالة</p>'
    +'</body></html>');
  win.document.close();
}

function openWhatsApp(phone, studentName) {
  showAddNoteModal_forWA(phone, studentName);
}

function showAddNoteModal_forWA(phone, studentName) {
  const msgText = `السلام عليكم،\nهذه رسالة بشأن ابنكم/ابنتكم ${studentName}.`;
  const encoded = encodeURIComponent(msgText);
  const waLink  = `https://wa.me/${phone.replace(/\D/g,'')}?text=${encoded}`;
  window.open(waLink, '_blank');
}

