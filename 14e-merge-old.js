/* 14e-merge-old.js — «📥 دمج بيانات قديمة»: ملف نجوم مدرستي سابق (نسخة احتياطية أو ملف قديم) يُدمج في الملف الحالي
   - الطلاب يُطابَقون بالرقم (رقم الطالب أو الرقم داخل حسابات البوابة/ألف) في أي شعبة، ثم بالاسم، ثم بتشابه الاسم، والباقي يدوياً.
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
// كل الأرقام الممكنة للطالب: رقم الطالب + الأرقام داخل حسابات الطالب (البوابة/ألف) — الملفات القديمة بلا رقم تُطابق بها
function moIds(s) {
  const ids = new Set();
  const sid = MO_SID(s); if (sid) ids.add(String(sid).trim());
  [s.govAccount && s.govAccount.user, s.alifAccount && s.alifAccount.user].forEach(u => { const m = String(u || '').split('@')[0].match(/(\d{5,})/); if (m) ids.add(m[1]); });
  return ids;
}
// تشابه الأسماء: نسبة الكلمات المشتركة (يتحمل تغيّر اسم الأب/الجد أو إضافة اسم)
function moSim(a, b) {
  const A = MO_NORM(a).split(' ').filter(Boolean), B = MO_NORM(b).split(' ').filter(Boolean);
  if (!A.length || !B.length) return 0;
  const sb = new Set(B); const common = A.filter(w => sb.has(w)).length;
  let sc = common / Math.max(A.length, B.length);
  if (A[0] === B[0]) sc += 0.15;                                  // نفس الاسم الأول
  if (A[A.length - 1] === B[B.length - 1]) sc += 0.15;            // نفس اسم العائلة
  return Math.min(1, sc);
}
function moAllStudents() {
  const out = [];
  state.classes.forEach(c => c.students.forEach(s => out.push({ cls: c, st: s })));
  return out;
}
function mergeOldPreview(text, fname) {
  let d; try { d = JSON.parse(text); } catch (e) { return alert('الملف ليس ملف نجوم مدرستي صالحاً.'); }
  if (!d || !Array.isArray(d.classes)) return alert('الملف ليس ملف نجوم مدرستي (لا يحتوي صفوفاً).');
  const h = moHash(text);
  const again = (state.rosterMeta && state.rosterMeta.mergedFrom || []).includes(h);
  if (again && !confirm('هذا الملف دُمج سابقاً في ملفك.\n\nإعادة الدمج آمنة: لا تكرر أي بيانات، وتُصلح ما لم يُدمج سابقاً (أيام الحضور ونقاط التقييمات والمكافآت) ثم تعيد احتساب النقاط.\n\nمتابعة؟')) return;
  const all = moAllStudents();
  const idIndex = new Map(); all.forEach(x => moIds(x.st).forEach(id => idIndex.set(id, x)));
  const used = new Set();
  const plan = [], unmatched = [];
  let byId = 0, byName = 0, byFuzzy = 0;
  d.classes.forEach(oc => {
    const cls = state.classes.find(c => c.name === oc.name);
    (oc.students || []).forEach(os => {
      if (!os.name) return;
      let hit = null, how = '';
      // 1) بالرقم (في أي شعبة — الطالب قد يكون انتقل)
      for (const id of moIds(os)) { const x = idIndex.get(id); if (x && !used.has(x.st)) { hit = x; how = 'id'; break; } }
      // 2) بالاسم الكامل داخل نفس الشعبة
      if (!hit && cls) { const st = cls.students.find(s => !used.has(s) && MO_NORM(s.name) === MO_NORM(os.name)); if (st) { hit = { cls, st }; how = 'name'; } }
      // 3) تشابه الاسم داخل نفس الشعبة (مرشح واحد واضح)
      if (!hit && cls) {
        const sc = cls.students.filter(s => !used.has(s)).map(s => ({ s, v: moSim(os.name, s.name) })).sort((x, y) => y.v - x.v);
        if (sc[0] && sc[0].v >= 0.6 && (!sc[1] || sc[0].v - sc[1].v >= 0.2)) { hit = { cls, st: sc[0].s }; how = 'fuzzy'; }
      }
      if (hit) { used.add(hit.st); plan.push({ cls: hit.cls, oc, st: hit.st, os, sameCls: hit.cls.name === oc.name, how }); how === 'id' ? byId++ : how === 'name' ? byName++ : byFuzzy++; }
      else unmatched.push({ oc, os, cls });
    });
  });
  const notes = plan.reduce((n, x) => n + (x.os.behaviorNotes || []).length, 0);
  const days = new Set(d.classes.flatMap(c => c._savedDates || [])).size;
  MO = { d, h, fname, plan, unmatched, again };
  // المطابقة اليدوية للباقي: قائمة بطلاب نفس الشعبة (الأقرب اسماً أولاً) أو كل الطلاب
  const opts = u => {
    const pool = (u.cls ? u.cls.students.map(st => ({ cls: u.cls, st })) : all).filter(x => !used.has(x.st))
      .map(x => ({ x, v: moSim(u.os.name, x.st.name) })).sort((a, b) => b.v - a.v);
    return `<option value="">— لا يُدمج —</option>` + pool.map(({ x, v }) => `<option value="${x.cls.id}|${x.st.id}">${rsEsc(x.st.name)}${u.cls ? '' : ' — ' + rsEsc(x.cls.name)}${v >= 0.5 ? ' ⭐' : ''}</option>`).join('');
  };
  const fuzzyList = plan.filter(x => x.how === 'fuzzy');
  openModal(`
    <div class="modal-title">📥 دمج بيانات قديمة — ${rsEsc(fname)}</div>
    <div style="font-size:13px;line-height:2">
      ✅ طلاب مطابَقون: <b>${plan.length}</b> <span style="font-size:11.5px;color:var(--text-muted)">(بالرقم ${byId} · بالاسم ${byName} · بتشابه الاسم ${byFuzzy})</span><br>
      أيام حصص: <b>${days}</b> · ملاحظات: <b>${notes}</b> · تقييمات: <b>${(d.assessments || []).length}</b>
      ${fuzzyList.length ? `<details><summary style="cursor:pointer">🔍 ${fuzzyList.length} طالب طوبق بتشابه الاسم — راجعهم</summary><div style="font-size:12px;max-height:120px;overflow:auto">${fuzzyList.map(x => rsEsc(MO_NORM(x.os.name)) + ' ⇐ <b>' + rsEsc(x.st.name) + '</b>').join('<br>')}</div></details>` : ''}
      ${unmatched.length ? `<div style="margin-top:6px;font-weight:800">⚠️ ${unmatched.length} طالب لم يُطابَق تلقائياً — اختر الطالب المقابل له (أو اتركه بدون دمج):</div>
        <div style="max-height:230px;overflow:auto;border:1px solid var(--border);border-radius:10px;padding:6px 8px">
        ${unmatched.map((u, i) => `<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;padding:3px 0;border-bottom:1px dashed var(--border);font-size:12.5px">
          <span><b>${rsEsc(MO_NORM(u.os.name))}</b> <span style="color:var(--text-muted)">(${rsEsc(u.oc.name)})</span></span>
          <select class="select mo-pick" data-i="${i}" style="max-width:55%;font-size:12px;padding:3px 6px">${opts(u)}</select></div>`).join('')}
        </div>` : ''}
      <div style="font-size:12px;color:var(--text-muted);margin-top:6px">الدمج يضيف القديم إلى الحالي (لا يحذف شيئاً ولا يكرر). المطابقة بالرقم أولاً (رقم الطالب أو الرقم في حساباته)، ثم بالاسم.</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="mergeOldApply()">📥 دمج الآن</button>
      <button class="btn btn-ghost" onclick="MO=null;closeModalForce()">إلغاء</button>
    </div>`);
}
function mergeOldApply() {
  if (!MO) return closeModalForce();
  const { d, plan } = MO;
  const taken = new Set(plan.map(x => x.st));
  document.querySelectorAll('.mo-pick').forEach(sel => {
    if (!sel.value) return;
    const u = MO.unmatched[+sel.dataset.i]; const [cid, sid] = sel.value.split('|').map(Number);
    const cls = state.classes.find(c => c.id === cid), st = cls && cls.students.find(x => x.id === sid);
    if (!st || taken.has(st)) return;
    taken.add(st); plan.push({ cls, oc: u.oc, st, os: u.os, sameCls: cls.name === u.oc.name, how: 'manual' });
  });
  const uni = (a, b) => [...new Set([...(a || []), ...(b || [])])].sort();
  // الشعبة الجديدة المقابلة لكل شعبة قديمة = شعبة أغلب طلابها المطابَقين (الأسماء قد تختلف: «6/1» و«61» …)
  const votes = {};
  plan.forEach(({ oc, cls }) => { const v = votes[oc.id] = votes[oc.id] || new Map(); v.set(cls, (v.get(cls) || 0) + 1); });
  const clsMap = {};
  Object.entries(votes).forEach(([ocId, v]) => { clsMap[ocId] = [...v.entries()].sort((x, y) => y[1] - x[1])[0][0]; });
  (d.classes || []).forEach(oc => { if (!clsMap[oc.id]) { const c = state.classes.find(x => x.name === oc.name); if (c) clsMap[oc.id] = c; } });
  // أيام الحصص المحفوظة تُدمج في الشعبة المقابلة
  (d.classes || []).forEach(oc => {
    const cls = clsMap[oc.id]; if (!cls) return;
    cls._savedDates = uni(cls._savedDates, oc._savedDates);
    cls._savedPeriods = Object.assign({}, cls._savedPeriods || {});
    Object.entries(oc._savedPeriods || {}).forEach(([dt, ps]) => { cls._savedPeriods[dt] = uni((cls._savedPeriods[dt] || []).map(Number), (ps || []).map(Number)).map(Number).sort((a, b) => a - b); });
  });
  plan.forEach(({ cls, oc, st, os }) => {
    const hadMarks = Array.isArray(st._mPart);
    st._mPart = st._mPart || []; st._mBonus = st._mBonus || [];
    // هل دُمج هذا الطالب في نسخة سابقة من الدمج (قبل حفظ العلامات)؟ ⇐ نعرفه من وجود سجله القديم كاملاً لديه
    const pk0 = e => (e.date || '') + '|' + (e.type || '') + '|' + (e.pts || 0) + '|' + (e.assessId || e.t || e.time || '');
    const hp0 = new Set((st.pointsLog || []).map(pk0));
    const nk0 = n => (n.type || '') + '|' + (n.isoDate || n.date || '') + '|' + moNoteText(n);
    const hn0 = new Set((st.behaviorNotes || []).map(nk0)), ha0 = new Set(st.absenceDates || []);
    const ev = [...(os.pointsLog || []).map(e => hp0.has(pk0(e))), ...(os.behaviorNotes || []).map(n => hn0.has(nk0(n))), ...(os.absenceDates || []).map(x => ha0.has(x))];
    const legacy = MO.again && !hadMarks && (!ev.length || ev.every(Boolean));   // دُمج بالنسخة السابقة ⇐ مشاركاته أُضيفت سابقاً
    if (!st.sid && MO_SID(os)) st.sid = MO_SID(os);
    st.absenceDates = uni(st.absenceDates, os.absenceDates);
    st.lateDates = uni(st.lateDates, os.lateDates);
    st._prevAtt = Object.assign({}, os._prevAtt || {}, st._prevAtt || {});
    // العدادات بلا تاريخ تُضاف مرة واحدة فقط لكل ملف
    if (!st._mPart.includes(MO.h)) { if (!legacy) st.participation = (st.participation || 0) + (os.participation || 0); st._mPart.push(MO.h); }
    if (!st._mBonus.includes(MO.h)) { st._manualBonus = (st._manualBonus || 0) + (os._manualBonus || 0); st._mBonus.push(MO.h); }
    // الملاحظات (بدون تكرار) — بالصياغة الجديدة
    const key = n => (n.type || '') + '|' + (n.isoDate || n.date || '') + '|' + moNoteText(n);
    const have = new Set((st.behaviorNotes || []).map(key));
    st.behaviorNotes = st.behaviorNotes || [];
    (os.behaviorNotes || []).forEach(n => {
      const m = Object.assign({}, n, { text: moNoteText(n) });
      if (m.type === 'negative' && !m.code && typeof marsadCodeOf === 'function') m.code = marsadCodeOf(n.text) || '';
      if (!have.has(key(m))) { st.behaviorNotes.push(m); have.add(key(m)); }
    });
    // سجل النقاط (مشاركات/خصم بالتاريخ) — بدون تكرار؛ termWeek يُعاد حسابه من التاريخ
    const pk = e => (e.date || '') + '|' + (e.type || '') + '|' + (e.pts || 0) + '|' + (e.assessId || e.t || e.time || '');
    const hp = new Set((st.pointsLog || []).map(pk));
    st.pointsLog = st.pointsLog || [];
    (os.pointsLog || []).forEach(e => { if (!hp.has(pk(e))) { const x = Object.assign({}, e); delete x.termWeek; const tw = getTermWeek(x.date); if (tw !== null) x.termWeek = tw; st.pointsLog.push(x); hp.add(pk(e)); } });
    st.deductReasons = (st.deductReasons || []).concat((os.deductReasons || []).filter(r => !(st.deductReasons || []).some(x => x.date === r.date && x.code === r.code)));
    if (os.parentPhone && !st.parentPhone) st.parentPhone = os.parentPhone;
  });
  // التقييمات: الدرجات ونقاطها تُنقل لأرقام الطلاب الجدد (وتُكمَّل إن كان التقييم موجوداً من دمج سابق)
  let addA = 0;
  state.assessments = state.assessments || [];
  (d.assessments || []).forEach(a => {
    const newCls = [...new Set((a.classIds || []).map(id => clsMap[id] && clsMap[id].id).filter(Boolean))];
    if (!newCls.length) return;
    let na = state.assessments.find(x => x.name === a.name && (x.date || '') === (a.date || '') && x.maxScore === a.maxScore);
    if (!na) { na = Object.assign({}, a, { id: Date.now() + Math.floor(Math.random() * 1e6), classIds: [], scores: {}, awardedPoints: {} }); state.assessments.push(na); addA++; }
    na.classIds = [...new Set([...(na.classIds || []), ...newCls])];
    na.scores = na.scores || {}; na.awardedPoints = na.awardedPoints || {};
    plan.forEach(({ oc, st, os }) => {
      if (!(a.classIds || []).includes(oc.id)) return;
      if (a.scores && a.scores[os.id] !== undefined && na.scores[st.id] === undefined) na.scores[st.id] = a.scores[os.id];
      if (a.awardedPoints && a.awardedPoints[os.id] !== undefined && !na.awardedPoints[st.id]) na.awardedPoints[st.id] = a.awardedPoints[os.id];
    });
  });
  // إعادة احتساب النقاط والحضور لكل الطلاب من المصدر
  if (typeof recalcAllTermWeeks === 'function') recalcAllTermWeeks();
  state.classes.forEach(c => c.students.forEach(st => recomputeWithAssessments(c, st)));
  state.rosterMeta = Object.assign({}, state.rosterMeta || {});
  if (!state.rosterMeta.mergedFrom || !state.rosterMeta.mergedFrom.includes(MO.h)) state.rosterMeta.mergedFrom = (state.rosterMeta.mergedFrom || []).concat(MO.h);
  const n = plan.length;
  MO = null;
  closeModalForce();
  save();
  if (typeof renderStudentList === 'function') renderStudentList();
  toast(`تم دمج بيانات ${n} طالب${addA ? ' و' + addA + ' تقييم' : ''} ✅`, '📥');
}
