/* 07b-marsad-review.js — سبب الخصم بضغطة واحدة + شاشة «مراجعة مرصاد» وتصديرها
   - بعد «خصم» يظهر شريط صغير اختياري بأسباب سريعة؛ كل سبب = نصف ملاحظة لبند مرصاد المقابل.
   - شاشة المراجعة: لكل طالب × بند يظهر المستوى المقترح وسببه، والمعلم يعدّله بضغطة،
     ثم يصدّر ملف مرصاد للشعبة أو لكل صفوفه. التعديلات تُحفظ في ملفه وتعتمدها لوحة التحكم أيضاً. */

/* ================= سبب الخصم ================= */
let _dedBarTimer = null;
function showDeductReasonBar(classId, studentId) {
  const cls = state.classes.find(c => c.id === classId);
  const s = cls && cls.students.find(x => x.id === studentId);
  if (!s) return;
  let bar = document.getElementById('ded-reason-bar');
  if (!bar) { bar = document.createElement('div'); bar.id = 'ded-reason-bar'; document.body.appendChild(bar); }
  bar.innerHTML = `<div class="drb-title">سبب الخصم من <b>${s.name.split('(')[0].trim()}</b>؟ <span class="drb-opt">(اختياري)</span></div>
    <div class="drb-chips">${MRS.DEDUCT_REASONS.map(r => `<button class="drb-chip" onclick="addDeductReason(${classId},${studentId},'${r.code}')">${r.t}</button>`).join('')}
    <button class="drb-chip drb-x" onclick="hideDeductReasonBar()" title="بدون سبب">✖</button></div>`;
  bar.classList.add('show');
  clearTimeout(_dedBarTimer);
  _dedBarTimer = setTimeout(hideDeductReasonBar, 7000);
}
function hideDeductReasonBar() { const b = document.getElementById('ded-reason-bar'); if (b) b.classList.remove('show'); clearTimeout(_dedBarTimer); }
function addDeductReason(classId, studentId, code) {
  const cls = state.classes.find(c => c.id === classId);
  const s = cls && cls.students.find(x => x.id === studentId);
  if (!s) return hideDeductReasonBar();
  if (!s.deductReasons) s.deductReasons = [];
  s.deductReasons.push({ date: sessionDate, code });
  save();
  hideDeductReasonBar();
  const r = MRS.DEDUCT_REASONS.find(x => x.code === code);
  toast(`سُجّل السبب: ${r ? r.t : code}`, '📝');
}
(function wrapDeduct() {
  const orig = window.subtractPoint;
  if (typeof orig !== 'function') return;
  window.subtractPoint = function (classId, studentId) {
    const cls = state.classes.find(c => c.id === classId);
    const s = cls && cls.students.find(x => x.id === studentId);
    const before = s && s._dailyDeduct ? (s._dailyDeduct[sessionDate] || 0) : 0;
    const r = orig.apply(this, arguments);
    const after = s && s._dailyDeduct ? (s._dailyDeduct[sessionDate] || 0) : 0;
    if (after > before) showDeductReasonBar(classId, studentId);
    return r;
  };
})();

/* ================= مراجعة مرصاد ================= */
let MRV = { clsId: null, from: '', to: '', rows: [], sel: null };
function mrvStore(clsName) {
  if (!state.marsadReview) state.marsadReview = {};
  if (!state.marsadReview[clsName]) state.marsadReview[clsName] = { cells: {}, reviewedAt: '' };
  if (!state.marsadReview[clsName].cells) state.marsadReview[clsName].cells = {};
  return state.marsadReview[clsName];
}
function mrvDefaultRange() {
  const info = typeof getSchoolInfo === 'function' ? getSchoolInfo() : {};
  const today = typeof _today === 'function' ? _today() : new Date().toISOString().slice(0, 10);
  return { from: info.termStart || '', to: info.termEnd && info.termEnd < today ? info.termEnd : today };
}
function mrvAnalyze(cls) {
  return MRS.analyzeClass(cls, state.assessments || [], { from: MRV.from, to: MRV.to, review: mrvStore(cls.name).cells });
}
function openMarsadReview() {
  if (!state.classes.length) return toast('لا توجد صفوف', '⚠️');
  const r = mrvDefaultRange();
  if (!MRV.from) { MRV.from = r.from; MRV.to = r.to; }
  if (!MRV.clsId || !state.classes.some(c => c.id === MRV.clsId)) MRV.clsId = state.activeClass && state.classes.some(c => c.id === state.activeClass) ? state.activeClass : state.classes[0].id;
  let ov = document.getElementById('mrv-ov');
  if (!ov) { ov = document.createElement('div'); ov.id = 'mrv-ov'; document.body.appendChild(ov); }
  ov.style.display = 'flex';
  mrvRender();
}
function closeMarsadReview() { const ov = document.getElementById('mrv-ov'); if (ov) ov.style.display = 'none'; }
function mrvSetClass(id) { MRV.clsId = +id; MRV.sel = null; mrvRender(); }
function mrvSetRange() {
  MRV.from = document.getElementById('mrv-from').value || '';
  MRV.to = document.getElementById('mrv-to').value || '';
  mrvRender();
}
function mrvCell(key, code) {
  const cls = state.classes.find(c => c.id === MRV.clsId); if (!cls) return;
  const row = MRV.rows.find(r => r.key === key); if (!row) return;
  const st = mrvStore(cls.name);
  const next = MRS.LV[(MRS.RANK[row.answers[code]] + 1) % 3];
  const cell = st.cells[key] || (st.cells[key] = {});
  if (next === row.auto[code]) delete cell[code]; else cell[code] = next;
  if (!Object.keys(cell).length) delete st.cells[key];
  MRV.sel = key;
  save();
  mrvRender();
}
function mrvResetAll() {
  const cls = state.classes.find(c => c.id === MRV.clsId); if (!cls) return;
  if (!confirm('إرجاع كل خانات هذه الشعبة إلى المستوى المقترح؟')) return;
  mrvStore(cls.name).cells = {};
  save(); mrvRender();
}
function mrvApprove() {
  const cls = state.classes.find(c => c.id === MRV.clsId); if (!cls) return;
  mrvStore(cls.name).reviewedAt = new Date().toISOString();
  save(); mrvRender();
  toast('تم اعتماد مراجعة ' + cls.name + ' ✅', '🧭');
}
function mrvSelect(key) { MRV.sel = key; mrvRender(); }

function mrvRender() {
  const ov = document.getElementById('mrv-ov'); if (!ov) return;
  const cls = state.classes.find(c => c.id === MRV.clsId);
  MRV.rows = cls ? mrvAnalyze(cls) : [];
  const st = cls ? mrvStore(cls.name) : { cells: {} };
  const codes = MRS.CODES;
  const sym = { never: '', sometimes: 'أ', always: 'د' };
  const flagged = { sometimes: 0, always: 0 }, edited = MRV.rows.reduce((n, r) => n + Object.keys(r.overridden).filter(c => r.overridden[c]).length, 0);
  MRV.rows.forEach(r => codes.forEach(c => { if (r.answers[c] !== 'never') flagged[r.answers[c]]++; }));
  const head = codes.map(c => `<th class="mrv-code" title="${c} — ${MRS.STATEMENTS[c][0]}"><span>${MRS.SHORT[c]}</span><small>${c}</small></th>`).join('');
  const body = MRV.rows.map(r => `<tr class="${MRV.sel === r.key ? 'mrv-selrow' : ''}">
      <td class="mrv-name" onclick="mrvSelect('${r.key}')" title="اضغط لعرض الأسباب">${r.name}
        <div class="mrv-pn"><span class="pos">+${r.posCount}</span> <span class="neg">−${r.negCount}</span></div></td>
      ${codes.map(c => {
        const a = r.answers[c];
        const tip = (r.reasons[c] || 'لا توجد بيانات لهذا البند') + (r.overridden[c] ? ` | ✏️ عدّلها المعلم (المقترح: ${MRS.LABEL[r.auto[c]]})` : '') + (r.needsConfirm[c] ? ' | ⚠️ يحتاج تأكيدك' : '');
        return `<td class="mrv-c lv-${a}${r.overridden[c] ? ' ovr' : ''}${r.needsConfirm[c] && !r.overridden[c] ? ' conf' : ''}${r.kind[c] === 'data' ? ' dat' : ''}" title="${tip.replace(/"/g, '&quot;')}" onclick="mrvCell('${r.key}','${c}')">${sym[a]}</td>`;
      }).join('')}</tr>`).join('');
  const sel = MRV.rows.find(r => r.key === MRV.sel);
  const detail = sel ? `<div class="mrv-detail"><b>${sel.name}</b>${sel.strengths ? ` — <span class="pos">نقاط القوة: ${sel.strengths}</span>` : ''}
      <ul>${codes.filter(c => sel.reasons[c] || sel.answers[c] !== 'never').map(c => `<li><b>${c} ${MRS.SHORT[c]}:</b> ${MRS.LABEL[sel.answers[c]]}${sel.overridden[c] ? ' ✏️' : ''} — ${sel.reasons[c] || 'تعديل المعلم'}</li>`).join('') || '<li>لا توجد ملاحظات أو مؤشرات.</li>'}</ul></div>`
    : `<div class="mrv-detail mrv-hint">اضغط اسم طالب لعرض أسباب كل بند. اضغط أي خانة لتغييرها: فارغ ← أحياناً ← دائماً.</div>`;
  ov.innerHTML = `<div class="mrv-box">
    <div class="mrv-top">
      <div class="mrv-title">🧭 مراجعة مرصاد</div>
      <select class="select" onchange="mrvSetClass(this.value)">${state.classes.map(c => `<option value="${c.id}" ${c.id === MRV.clsId ? 'selected' : ''}>${c.name}${state.marsadReview && state.marsadReview[c.name] && state.marsadReview[c.name].reviewedAt ? ' ✅' : ''}</option>`).join('')}</select>
      <label>من <input type="date" id="mrv-from" value="${MRV.from}" onchange="mrvSetRange()"></label>
      <label>إلى <input type="date" id="mrv-to" value="${MRV.to}" onchange="mrvSetRange()"></label>
      <span class="mrv-sum">أحياناً: <b>${flagged.sometimes}</b> — دائماً: <b>${flagged.always}</b> — عدّلتَ: <b>${edited}</b>${st.reviewedAt ? ` — ✅ اعتُمدت ${new Date(st.reviewedAt).toLocaleDateString('en-GB')}` : ''}</span>
      <button class="btn btn-ghost btn-sm" onclick="closeMarsadReview()">✖ إغلاق</button>
    </div>
    <div class="mrv-legend">
      <span><i class="lv-sometimes">أ</i> أحياناً</span><span><i class="lv-always">د</i> دائماً</span>
      <span><i class="ovr">✏️</i> عدّلها المعلم</span><span><i class="dat">·</i> مستنتجة من البيانات</span><span><i class="conf">؟</i> يحتاج تأكيدك</span>
      <span>الملاحظات الإيجابية تخفّف البنود المرتبطة بها.</span>
    </div>
    <div class="mrv-wrap"><table class="mrv-tbl"><thead><tr><th class="mrv-name">الطالب</th>${head}</tr></thead><tbody>${body || `<tr><td colspan="${codes.length + 1}">لا يوجد طلاب.</td></tr>`}</tbody></table></div>
    ${detail}
    <div class="mrv-actions">
      <button class="btn btn-primary btn-sm" onclick="mrvApprove()">✅ اعتماد مراجعة الشعبة</button>
      <button class="btn btn-ghost btn-sm" onclick="mrvExport('one')">📦 ملف مرصاد لهذه الشعبة</button>
      <button class="btn btn-ghost btn-sm" onclick="mrvExport('all')">📦 ملفات كل صفوفي (ZIP)</button>
      <button class="btn btn-ghost btn-sm" onclick="mrvResetAll()">↺ إرجاع المقترح</button>
    </div></div>`;
}

function mrvExport(which) {
  const info = typeof getSchoolInfo === 'function' ? getSchoolInfo() : {};
  const list = which === 'one' ? state.classes.filter(c => c.id === MRV.clsId) : state.classes;
  const files = [], skipped = [];
  list.forEach(cls => {
    const rows = mrvAnalyze(cls);
    const st = mrvStore(cls.name);
    const f = MRS.buildBatch({ className: cls.name, rows, teacherName: info.teacher || '', subject: info.subject || '', from: MRV.from, to: MRV.to, reviewed: !!st.reviewedAt });
    if (f) files.push(f); else skipped.push(cls.name);
  });
  if (!files.length) return toast('لا توجد شعب بصيغة «صف/شعبة» للتصدير', '⚠️');
  const unreviewed = list.filter(c => !mrvStore(c.name).reviewedAt).map(c => c.name);
  if (unreviewed.length && !confirm(`لم تُعتمد مراجعة: ${unreviewed.join('، ')}\nسيُصدَّر المستوى المقترح لها كما هو. متابعة؟`)) return;
  if (files.length === 1) {
    MRS.download(new Blob([files[0].text], { type: 'application/json' }), files[0].name);
  } else {
    MRS.download(MRS.makeZip(files), `مرصاد_${(info.teacher || 'معلم').replace(/\s+/g, '_')}_${MRV.from || ''}_${MRV.to || ''}.zip`);
  }
  toast(`تم تصدير ${files.length} ملف مرصاد ✅${skipped.length ? ' — تخطّي: ' + skipped.join('، ') : ''}`, '🧭');
}
