/* 14e-merge-old.js — «📥 دمج بيانات قديمة»: ملف نجوم مدرستي سابق (نسخة احتياطية أو ملف قديم) يُدمج في الملف الحالي
   - الطلاب يُطابَقون برقم الطالب ثم بالاسم داخل نفس الشعبة (الأسماء القديمة بلا رقم تُطابق بالاسم).
   - الدمج «جمع» وليس استبدالاً: أيام الحضور والغياب والتأخر والملاحظات وسجل النقاط والتقييمات تُضاف بدون تكرار.
   - الملاحظات القديمة تُحوَّل إلى صياغة القائمة الجديدة إن كان بندها موجوداً فيها، والباقي يبقى بنصّه ورمزه (يُحسب في مرصاد).
   - الملف نفسه لا يُدمج مرتين. */
function mergeOldPick() {
  let inp = document.getElementById('mergeOldFile');
  if (!inp) {
    inp = document.createElement('input'); inp.type = 'file'; inp.id = 'mergeOldFile'; inp.accept = '.json'; inp.style.display = 'none';
    inp.onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const rd = new FileReader(); rd.onload = () => mergeOldPreview(String(rd.result), f.name); rd.readAsText(f, 'UTF-8'); };
    document.body.appendChild(inp);
  }
  inp.click();
}
const MO_NORM = s => String(s || '').replace(/\s*\([^()]*\)\s*$/, '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
const MO_SID = s => s.sid || (String(s.name || '').match(/\(([^()]+)\)\s*$/) || [])[1] || '';
function moHash(t) { let h = 0; for (let i = 0; i < t.length; i += 7) h = (h * 31 + t.charCodeAt(i)) | 0; return h + ':' + t.length; }
function moNoteText(n) {
  if (n.type !== 'negative') return n.text;
  const c = n.code || (typeof marsadCodeOf === 'function' ? marsadCodeOf(n.text) : '');
  const nw = (typeof MARSAD_NOTES !== 'undefined' ? MARSAD_NOTES : []).find(x => x.code === c);
  return nw ? nw.text : n.text;
}
let MO = null;
function mergeOldPreview(text, fname) {
  let d; try { d = JSON.parse(text); } catch (e) { return alert('الملف ليس ملف نجوم مدرستي صالحاً.'); }
  if (!d || !Array.isArray(d.classes)) return alert('الملف ليس ملف نجوم مدرستي (لا يحتوي صفوفاً).');
  const h = moHash(text);
  if ((state.rosterMeta && state.rosterMeta.mergedFrom || []).includes(h)) return alert('هذا الملف دُمج سابقاً في ملفك — لا حاجة لدمجه مرة أخرى.');
  const plan = [], noClass = [], unmatched = [];
  d.classes.forEach(oc => {
    const cls = state.classes.find(c => c.name === oc.name) || (state.archivedClasses || []).map(a => a.cls).find(c => c && c.name === oc.name);
    if (!cls) { if ((oc.students || []).length) noClass.push(oc.name); return; }
    (oc.students || []).forEach(os => {
      const sid = MO_SID(os), nm = MO_NORM(os.name);
      const st = (sid && cls.students.find(s => MO_SID(s) === sid)) || cls.students.find(s => MO_NORM(s.name) === nm)
        || (() => { const c = cls.students.filter(s => MO_NORM(s.name).startsWith(nm) || nm.startsWith(MO_NORM(s.name))); return c.length === 1 ? c[0] : null; })();
      if (st) plan.push({ cls, oc, st, os }); else if (os.name) unmatched.push(oc.name + ' — ' + MO_NORM(os.name));
    });
  });
  const notes = plan.reduce((n, x) => n + (x.os.behaviorNotes || []).length, 0);
  const days = new Set(d.classes.flatMap(c => c._savedDates || [])).size;
  MO = { d, h, fname, plan, noClass, unmatched };
  openModal(`
    <div class="modal-title">📥 دمج بيانات قديمة — ${rsEsc(fname)}</div>
    <div style="font-size:13px;line-height:2">
      ✅ طلاب مطابَقون: <b>${plan.length}</b> · أيام حصص: <b>${days}</b> · ملاحظات: <b>${notes}</b> · تقييمات: <b>${(d.assessments || []).length}</b><br>
      ${noClass.length ? `⚠️ صفوف غير موجودة في ملفك (لن تُدمج): <b>${noClass.map(rsEsc).join('، ')}</b> — أضفها من «🏫 إضافة / أرشفة شعب» ثم أعد الدمج.<br>` : ''}
      ${unmatched.length ? `<details><summary style="cursor:pointer">⚠️ ${unmatched.length} طالب لم يُطابَق (ربما انتقل أو تغيّر اسمه)</summary><div style="font-size:12px;max-height:140px;overflow:auto">${unmatched.map(rsEsc).join('<br>')}</div></details>` : ''}
      <div style="font-size:12px;color:var(--text-muted);margin-top:6px">الدمج يضيف القديم إلى الحالي (لا يحذف شيئاً ولا يكرر). الملاحظات القديمة تُحوَّل إلى الصياغة الجديدة حيث أمكن.</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="mergeOldApply()">📥 دمج الآن</button>
      <button class="btn btn-ghost" onclick="MO=null;closeModalForce()">إلغاء</button>
    </div>`);
}
function mergeOldApply() {
  if (!MO) return closeModalForce();
  const { d, plan } = MO;
  const uni = (a, b) => [...new Set([...(a || []), ...(b || [])])].sort();
  const touchedCls = new Set();
  plan.forEach(({ cls, oc, st, os }) => {
    if (!touchedCls.has(cls)) {
      touchedCls.add(cls);
      cls._savedDates = uni(cls._savedDates, oc._savedDates);
      cls._savedPeriods = Object.assign({}, cls._savedPeriods || {});
      Object.entries(oc._savedPeriods || {}).forEach(([dt, ps]) => { cls._savedPeriods[dt] = uni((cls._savedPeriods[dt] || []).map(Number), (ps || []).map(Number)).map(Number).sort((a, b) => a - b); });
    }
    if (!st.sid && MO_SID(os)) st.sid = MO_SID(os);
    const newAbs = (os.absenceDates || []).filter(x => !(st.absenceDates || []).includes(x));
    st.absenceDates = uni(st.absenceDates, os.absenceDates);
    st.lateDates = uni(st.lateDates, os.lateDates);
    st._prevAtt = Object.assign({}, os._prevAtt || {}, st._prevAtt || {});
    // العدادات: الحضور والغياب من الأيام القديمة غير الموجودة حالياً
    st.absent = (st.absent || 0) + newAbs.length;
    st.present = (st.present || 0) + Math.max(0, (os.present || 0));
    st.participation = (st.participation || 0) + (os.participation || 0);
    // الملاحظات (بدون تكرار) — بالصياغة الجديدة
    const key = n => (n.type || '') + '|' + (n.isoDate || n.date || '') + '|' + moNoteText(n);
    const have = new Set((st.behaviorNotes || []).map(key));
    st.behaviorNotes = st.behaviorNotes || [];
    (os.behaviorNotes || []).forEach(n => {
      const m = Object.assign({}, n, { text: moNoteText(n) });
      if (m.type === 'negative' && !m.code && typeof marsadCodeOf === 'function') m.code = marsadCodeOf(n.text) || '';
      if (!have.has(key(m))) { st.behaviorNotes.push(m); have.add(key(m)); }
    });
    // سجل النقاط والنقاط
    const pk = e => (e.date || '') + '|' + (e.type || '') + '|' + (e.pts || 0) + '|' + (e.t || e.time || '');
    const hp = new Set((st.pointsLog || []).map(pk));
    let addPts = 0;
    st.pointsLog = st.pointsLog || [];
    (os.pointsLog || []).forEach(e => { if (!hp.has(pk(e))) { st.pointsLog.push(e); hp.add(pk(e)); addPts += (+e.pts || 0); } });
    const logged = (os.pointsLog || []).reduce((a, e) => a + (+e.pts || 0), 0);
    st.points = (st.points || 0) + addPts + Math.max(0, (os.points || 0) - logged);   // نقاط قديمة بلا سجل تُضاف كما هي
    st.deductReasons = (st.deductReasons || []).concat((os.deductReasons || []).filter(r => !(st.deductReasons || []).some(x => x.date === r.date && x.code === r.code)));
    if (os.parentPhone && !st.parentPhone) st.parentPhone = os.parentPhone;
  });
  // التقييمات: تُضاف (بربط الصفوف والطلاب الجدد)
  let addA = 0;
  const clsMap = {}; (d.classes || []).forEach(oc => { const c = state.classes.find(x => x.name === oc.name); if (c) clsMap[oc.id] = c; });
  state.assessments = state.assessments || [];
  (d.assessments || []).forEach(a => {
    if (state.assessments.some(x => x.name === a.name && (x.date || '') === (a.date || '') && x.maxScore === a.maxScore)) return;
    const na = Object.assign({}, a, { id: Date.now() + Math.floor(Math.random() * 1e6), classIds: (a.classIds || []).map(id => clsMap[id] && clsMap[id].id).filter(Boolean), scores: {} });
    plan.forEach(({ oc, st, os }) => { if ((a.classIds || []).includes(oc.id) && a.scores && a.scores[os.id] !== undefined) na.scores[st.id] = a.scores[os.id]; });
    if (na.classIds.length) { state.assessments.push(na); addA++; }
  });
  state.rosterMeta = Object.assign({}, state.rosterMeta || {});
  state.rosterMeta.mergedFrom = (state.rosterMeta.mergedFrom || []).concat(MO.h);
  const n = plan.length;
  MO = null;
  closeModalForce();
  save();
  if (typeof renderStudentList === 'function') renderStudentList();
  toast(`تم دمج بيانات ${n} طالب${addA ? ' و' + addA + ' تقييم' : ''} ✅`, '📥');
}
