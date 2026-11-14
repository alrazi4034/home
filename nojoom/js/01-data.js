/* 01-data.js — البيانات: قوائم الطلاب، تعريف الصفوف، بناء الـ state، الحفظ والتحميل */

// ============================================================
// تعديل قائمة الطلاب:
// الطريقة السهلة: عدّل المصفوفات أدناه مباشرة
//
// لإضافة صف جديد: أضف { id, name, list } في CLASSES_DATA
// وأنشئ له مصفوفة مثل: const CLASS_A = ["اسم الطالب", ...]
//
// كل سطر في المصفوفة هو اسم طالب (يمكن إضافة رقم الهوية بين قوسين)
// مثال: "محمد علي أحمد (2016001234)",
// ============================================================

// ===== قوائم الطلاب — عدّل هنا فقط =====
// أضف صفوفك هنا، مثال:
// const CLASS_A = [
//   "اسم الطالب الأول",
//   "اسم الطالب الثاني",
// ];

// ===== تعريف الصفوف =====
// أضف صفوفك هنا، مثال:
// const CLASSES_DATA = [
//   { id: 1, name: "الصف أ", list: CLASS_A },
// ];
const CLASSES_DATA = [];

// ===== بناء State من القوائم =====
function buildDefaultState() {
  return {
    classes: CLASSES_DATA.map(cls => ({
      id: cls.id,
      name: cls.name,
      _savedDates: [],
      students: cls.list.map((name, idx) => ({
        id: cls.id * 1000 + idx,
        name,
        points: 0, present: 0, absent: 0, participation: 0,
        absenceDates: [], _todayAtt: 'unmarked', _prevAtt: {},
        parentPhone: '', behaviorNotes: []
      }))
    })),
    sessions: [],
    activeClass: CLASSES_DATA[0]?.id || null,
    assessments: [],
    schoolInfo: { schoolName:'', principal:'', teacher:'', subject:'', term:'', termStart:'', termEnd:'' }
  };
}

let state = buildDefaultState();

// ===== رقم الطالب (sid) =====
// الأسماء تُدخل بصيغة "الاسم (الرقم)". نفصل الرقم ونحفظه في s.sid ونُبقي الاسم نظيفاً.
// الرقم قد يحتوي حروفاً، لكن يجب أن يحتوي رقماً واحداً على الأقل (حتى لا نخلط مع أقواس عادية في الاسم).
function splitNameId(str) {
  const t = String(str || '').trim();
  const m = t.match(/^(.*?)\s*[(（]\s*([^()（）]*\d[^()（）]*?)\s*[)）]\s*$/);
  if (m && m[1].trim()) return { name: m[1].trim(), sid: m[2].trim() };
  return { name: t, sid: '' };
}
// يُطبَّق على كل الطلاب: أي اسم فيه (رقم) يُفصل إلى name + sid. لا يغيّر sid موجوداً مسبقاً.
function normalizeAllStudentIds() {
  (state.classes || []).forEach(cls => (cls.students || []).forEach(s => {
    const p = splitNameId(s.name);
    if (p.sid) { s.name = p.name; if (!s.sid) s.sid = p.sid; }
    if (s.sid === undefined) s.sid = '';
  }));
}

// ===== حفظ وتحميل =====
function save() {
  normalizeAllStudentIds();
  state._attDate = typeof sessionDate !== 'undefined' ? sessionDate : '';   // تاريخ حالة الحضور غير المحفوظة
  localStorage.setItem('nojomi_v4', JSON.stringify(state));
  syncToLinkedFileDebounced();
}

function load() {
  const d = localStorage.getItem('nojomi_v4');
  if (!d) return;
  try {
    const saved = JSON.parse(d);
    state.classes.forEach(cls => {
      const sc = saved.classes?.find(c => c.name === cls.name);
      if (!sc) return;
      cls._savedDates = sc._savedDates || [];
      cls._savedPeriods = sc._savedPeriods || {};
      cls.students.forEach(st => {
        const ss = sc.students?.find(s => s.name === st.name);
        if (!ss) return;
        st.points = ss.points || 0;
        st.present = ss.present || 0;
        st.absent = ss.absent || 0;
        st.participation = ss.participation || 0;
        st.absenceDates = ss.absenceDates || [];
        st.lateDates = ss.lateDates || [];
        st._prevAtt = ss._prevAtt || {};
        // حالة الحضور الحالية تُستعاد فقط إن كانت لنفس اليوم؛ وإلا تُؤخذ من المحفوظ لليوم أو «غير محدد» (لا حضور تلقائي من يوم سابق)
        { const today = typeof _today === 'function' ? _today() : new Date().toISOString().slice(0, 10);
          if (saved._attDate === today || (!saved._attDate && st._prevAtt[today])) { st._todayAtt = ss._todayAtt || 'unmarked'; st._todayLate = !!ss._todayLate; }
          else { st._todayAtt = st._prevAtt[today] || 'unmarked'; st._todayLate = st._todayAtt === 'present' && st.lateDates.includes(today); } }
        st.parentPhone = ss.parentPhone || '';
        st.behaviorNotes = ss.behaviorNotes || [];
        st.govAccount = ss.govAccount || null;
        st.alifAccount = ss.alifAccount || null;
        // ترحيل: _bonusPoints القديم -> _manualBonus (بطرح نقاط الملاحظات المحفوظة)
        if (ss._manualBonus !== undefined) {
          st._manualBonus = ss._manualBonus;
        } else if (ss._bonusPoints !== undefined) {
          const notePts = (ss.behaviorNotes || []).reduce((sum, n) => sum + (n.points || 0), 0);
          st._manualBonus = (ss._bonusPoints || 0) - notePts;
        } else {
          st._manualBonus = 0;
        }
        if (ss.pointsLog)    st.pointsLog    = ss.pointsLog;
        if (ss._dailyPart)   st._dailyPart   = ss._dailyPart;
        if (ss._dailyDeduct) st._dailyDeduct = ss._dailyDeduct;
        if (ss.sid) st.sid = ss.sid;
        if (ss.phoneVerified !== undefined) st.phoneVerified = ss.phoneVerified;
      });
    });
    state.sessions = saved.sessions || [];
    state.assessments = saved.assessments || [];
    state.seating = saved.seating || {};
    state.archivedStudents = saved.archivedStudents || [];   // طلاب حُذفوا من القائمة المركزية (مع كامل بياناتهم)
    state.archivedClasses = saved.archivedClasses || [];     // صفوف لم تعد مُسندة للمعلم (مع كامل بياناتها)
    state.rosterMeta = saved.rosterMeta || null;             // معلومات آخر مزامنة مع القائمة المركزية
    state.activeClass = saved.activeClass || state.classes[0]?.id;
    // restore header info
    // استعادة schoolInfo — دعم البيانات القديمة والجديدة
    if (saved.schoolInfo) {
      state.schoolInfo = saved.schoolInfo;
    } else {
      // ترحيل من النظام القديم (بيانات على مستوى الجذر)
      state.schoolInfo = {
        schoolName: saved.schoolName || '',
        principal:  saved.principal  || '',
        teacher:    saved.teacher    || '',
        subject:    saved.subject    || '',
        term:       saved.term       || '',
        termStart:  saved.termStart  || '',
        termEnd:    saved.termEnd    || ''
      };
    }
    // رسم الترويسة
    const _si = state.schoolInfo;
    renderSchoolInfoBar(_si.subject, _si.teacher, _si.schoolName);
    // تحديث hidden spans
    const _subEl = document.getElementById('subject-title');
    const _schEl = document.getElementById('school-title');
    const _parts = []; if(_si.subject) _parts.push('المادة: '+_si.subject); if(_si.teacher) _parts.push('المعلم: '+_si.teacher);
    if(_subEl) _subEl.textContent = _parts.join(' | ') || 'اسم المادة — اسم المعلم';
    if(_schEl) _schEl.textContent = _si.schoolName ? ' | المدرسة: ' + _si.schoolName : '';
    // استعادة الصفوف المضافة من الواجهة (غير الموجودة في CLASSES_DATA)
    if (saved.classes) {
      saved.classes.forEach(sc => {
        const exists = state.classes.find(c => c.name === sc.name);
        if (!exists) {
          state.classes.push({
            id: sc.id, name: sc.name, _savedDates: sc._savedDates || [],
            _savedPeriods: sc._savedPeriods || {},   // أرقام الحصص لكل تاريخ حفظ: { '2026-11-10': [3,5] }
            students: (sc.students || []).map(ss => ({
              id: ss.id, name: ss.name, sid: ss.sid || '',
              phoneVerified: ss.phoneVerified || false,
              points: ss.points||0, present: ss.present||0,
              absent: ss.absent||0, participation: ss.participation||0,
              absenceDates: ss.absenceDates||[], _todayAtt: ss._todayAtt||'unmarked',
              lateDates: ss.lateDates||[], _todayLate: !!ss._todayLate,   // التأخر: الطالب حاضر + متأخر
              _prevAtt: ss._prevAtt||{}, parentPhone: ss.parentPhone||'',
              behaviorNotes: ss.behaviorNotes||[],
              govAccount: ss.govAccount||null, alifAccount: ss.alifAccount||null,
              pointsLog: ss.pointsLog||[],
              _dailyPart: ss._dailyPart||{},
              _dailyDeduct: ss._dailyDeduct||{},
              _manualBonus: ss._manualBonus !== undefined ? ss._manualBonus
                : (ss._bonusPoints !== undefined
                    ? (ss._bonusPoints||0) - (ss.behaviorNotes||[]).reduce((s,n)=>s+(n.points||0),0)
                    : 0)
            }))
          });
        }
      });
      state.activeClass = saved.activeClass || state.classes[0]?.id;
    }
  } catch(e) { console.error('load error', e); }
  normalizeAllStudentIds();
  // إعادة حساب الأسابيع لأي entry لم يُسجَّل فيه termWeek
  recalcAllTermWeeks();
}

