/* 06-marsad.js — تحويل ملاحظات نجوم مدرستي إلى ملفات برنامج مِرْصاد
   - لكل معلم × صف يُنشأ ملف classBatch (نفس صيغة Marsad_input) يقرؤه marsad_result مباشرة.
   - البنود: ملاحظات + أسباب الخصم + استنتاج من البيانات − الإيجابية المرتبطة، ثم مراجعة المعلم (المحرّك المشترك MRS).
   - B05 (تكرار الغياب) يُحسب من نسبة أيام غياب الطالب إلى الأيام الدراسية (النموذج + نجوم مدرستي) في نفس المدى.
   - B06 (تكرار التأخر) يُحسب من حالة «متأخر» في حضور نجوم مدرستي (مع أي ملاحظة تأخر قديمة).
   - الملاحظات الإيجابية تذهب إلى «نقاط القوة»، والملاحظات الأخرى (غير ذلك) إلى «ملاحظات إضافية».
   - الناتج ملف ZIP واحد للمدرسة: يُفك ثم تُختار ملفاته (أو المجلد) في برنامج النتائج. */

/* المحرّك المشترك: nojoom/shared/marsad-engine.js (MRS) — نفس الحساب في نجوم مدرستي ولوحة التحكم.
   مراجعة المعلم (marsadReview في ملفه) تُعتمد كما هي. */
const MARSAD_DEFAULTS = { noteSomeEvery: 20, noteAlwaysEvery: 6, absPctSome: 10, absPctAlways: 20, lateSomeEvery: 15, lateAlwaysEvery: 6, testSome: 65, testAlways: 50 };
function marsadCfg() {
  const c = Object.assign({}, MARSAD_DEFAULTS, SETTINGS.marsad || {});
  ['noteSome', 'noteAlways', 'lateSome', 'lateAlways'].forEach(k => delete c[k]);   // إعدادات قديمة (بالعدد)
  return c;
}

/* ---------- وضعا التصدير ----------
   1) «تقييم فترة واحدة»: ملفات classBatch — يصبح هو التقييم الأساسي في مرصاد.
   2) «مقارنة فترتين»: ملف ZIP واحد فيه الفترة (أ) كتقييم أساسي + الفترة (ب) كإعادة تقييم.
      مرصاد يقارن بينهما في «متابعة التغيّر» ويُصدر تقارير التقدّم والتراجع.
   التكرار يُحسب بمعدل الحدوث لكل حصة (وليس بالعدد)، فتصح مقارنة شهرين بأسبوعين. */
const MRS_LAST_KEY = 'nojoom_marsad_last';
function marsadLast() { try { return JSON.parse(localStorage.getItem(MRS_LAST_KEY) || 'null'); } catch (e) { return null; } }

// تحليل كل (معلم × صف) لمدى معيّن
function marsadAnalyzeAll(from, to, reviewPick) {
  const cfg = marsadCfg();
  const miss = computeMissing(from, to, '');
  const abs = computeAbsence(from, to, '', miss);
  const absPct = new Map(), nDays = miss.days.length;
  abs.students.forEach(s => absPct.set(s.sid || 'n:' + normName(s.name), nDays ? s.dayCount / nDays * 100 : 0));
  const pctOf = s => { const p = splitNameId(s.name); const k = s.sid || p.sid; return nDays ? (absPct.get(k || 'n:' + normName(p.name)) || 0) : null; };
  const out = [], skipped = [];
  MODEL.files.teachers.forEach(t => {
    const raw = t.raw || {};
    const ct = MODEL.teachers.get(t.key);
    const subject = (t.subject || (ct && ct.subjects[0]) || '').split('،')[0].trim();
    (raw.classes || []).forEach(c => {
      if (!/^\d+\s*\/\s*\d+$/.test(String(c.name))) { skipped.push(t.name + ' — ' + c.name); return; }
      const rv = (raw.marsadReview && raw.marsadReview[c.name]) || {};
      const pc = t.classes.find(x => x.name === c.name);
      c = Object.assign({}, c, { students: (c.students || []).map((s, i) => s.sid ? s : Object.assign({}, s, { sid: (pc && pc.students[i] && pc.students[i].sid) || '' })) });
      const review = reviewPick(rv) ? (rv.cells || {}) : {};
      const rows = MRS.analyzeClass(c, raw.assessments || [], { from, to, cfg, absPct: pctOf, review });
      out.push({ t, subject, cls: c.name, rows, rv, reviewed: !!rv.reviewedAt });
    });
  });
  return { list: out, skipped, days: nDays };
}
function marsadStats(list) {
  const st = { students: 0, flagged: {}, reviewed: 0, classes: list.length, edited: 0 };
  MRS.CODES.forEach(c => st.flagged[c] = { sometimes: 0, always: 0 });
  list.forEach(x => { if (x.reviewed) st.reviewed++; st.students += x.rows.length;
    x.rows.forEach(r => MRS.CODES.forEach(k => { if (r.answers[k] !== 'never') st.flagged[k][r.answers[k]]++; if (r.overridden[k]) st.edited++; })); });
  return st;
}

/* ---------- بناء الملفات ---------- */
function buildMarsadExport(mode, A, B) {
  const files = [];
  const stampA = new Date(Date.now() - 120000).toISOString(), stampB = new Date().toISOString();
  if (mode === 'base') {
    const a = marsadAnalyzeAll(A.from, A.to, () => true);
    a.list.forEach(x => { const f = MRS.buildBatch({ className: x.cls, rows: x.rows, teacherName: x.t.name, subject: x.subject, from: A.from, to: A.to, file: x.t.file, reviewed: x.reviewed });
      if (f) files.push(f); });
    return { files, statsA: marsadStats(a.list), skipped: a.skipped, daysA: a.days };
  }
  // مقارنة فترتين: مراجعة المعلم تُنسب للفترة التي تمت فيها
  const inB = rv => rv.reviewedAt && rv.reviewedAt.slice(0, 10) >= B.from;
  const a = marsadAnalyzeAll(A.from, A.to, rv => rv.reviewedAt && !inB(rv));
  const b = marsadAnalyzeAll(B.from, B.to, rv => inB(rv));
  const cmp = { better: 0, worse: 0, same: 0, nobase: 0 };
  b.list.forEach(xb => {
    const xa = a.list.find(x => x.t === xb.t && x.cls === xb.cls);
    xb.rows.forEach(r => {
      const ra = xa && xa.rows.find(y => y.key === r.key);
      const c = MRS.compareAnswers(ra ? ra.answers : null, r.answers, ra && ra.na, r.na);
      r.change = c.change; r.reason = c.reason; cmp[c.verdict]++;
    });
    if (xa) {
      const fa = MRS.buildBatch({ className: xa.cls, rows: xa.rows, teacherName: xa.t.name, subject: xa.subject, from: A.from, to: A.to, file: xa.t.file, reviewed: xa.reviewed, stamp: stampA, period: 'A' });
      if (fa) files.push(Object.assign(fa, { name: '1_الفترة_أ_' + fa.name }));
    }
    const fb = MRS.buildReeval({ className: xb.cls, rows: xb.rows, teacherName: xb.t.name, subject: xb.subject, from: B.from, to: B.to, baseFrom: A.from, baseTo: A.to, file: xb.t.file, stamp: stampB });
    if (fb) files.push(Object.assign(fb, { name: '2_الفترة_ب_' + fb.name }));
  });
  return { files, statsA: marsadStats(a.list), statsB: marsadStats(b.list), cmp, skipped: b.skipped, daysA: a.days, daysB: b.days };
}
const makeZip = MRS.makeZip;
const MARSAD_STATEMENTS = MRS.STATEMENTS, MARSAD_CODES = MRS.CODES;

/* ---------- الواجهة ---------- */
let MRS_UI = null;
function mrsDefaults(mode) {
  const to = LAST.to || new Date().toISOString().slice(0, 10);
  const term = (MODEL.central.terms || []).find(t => t.start <= to && to <= t.end);
  const termFrom = (term && term.start) || LAST.from || addDays(to, -60);
  if (mode === 'base') return { mode, A: { from: LAST.from || termFrom, to }, B: null };
  const bFrom = addDays(to, -13);
  const last = marsadLast();
  return { mode, A: { from: (last && last.A && last.A.from) || termFrom, to: addDays(bFrom, -1) }, B: { from: bFrom, to } };
}
function mrsSetMode(m) { MRS_UI = mrsDefaults(m); openMarsadExport(); }
function mrsReadDates() {
  const g = id => (document.getElementById(id) || {}).value || '';
  MRS_UI.A = { from: g('mra-from'), to: g('mra-to') };
  if (MRS_UI.mode === 'compare') MRS_UI.B = { from: g('mrb-from'), to: g('mrb-to') };
}
function mrsApplyDates() { mrsReadDates(); openMarsadExport(); }
function mrsCheck(u) {
  const ok = p => p && p.from && p.to && p.from <= p.to;
  if (!ok(u.A)) return 'حدّد بداية ونهاية ' + (u.mode === 'base' ? 'الفترة' : 'الفترة (أ)');
  if (u.mode === 'compare') {
    if (!ok(u.B)) return 'حدّد بداية ونهاية الفترة (ب)';
    if (u.B.from <= u.A.to) return 'الفترة (ب) يجب أن تبدأ بعد نهاية الفترة (أ)';
  }
  return '';
}
const daysBetween = p => Math.round((new Date(p.to) - new Date(p.from)) / 864e5) + 1;

function openMarsadExport() {
  if (!MODEL || !MODEL.files.teachers.length) {
    return openModal(`<h2>🧭 تصدير إلى مرصاد</h2><div style="line-height:2">اربط «مجلد ملفات المعلمين» أولاً — الملاحظات السلوكية تُقرأ من ملفات نجوم مدرستي.</div>
      <div class="actions"><button class="btn" onclick="closeModal()">إغلاق</button></div>`);
  }
  if (!MRS_UI) MRS_UI = mrsDefaults('compare');
  const u = MRS_UI, cfg = marsadCfg(), err = mrsCheck(u);
  const r = err ? null : buildMarsadExport(u.mode, u.A, u.B);
  const st = r ? (u.mode === 'base' ? r.statsA : r.statsB) : null;
  const top = st ? MRS.CODES.map(c => ({ c, s: st.flagged[c].sometimes, a: st.flagged[c].always })).filter(x => x.s + x.a).sort((x, y) => (y.a * 2 + y.s) - (x.a * 2 + x.s)) : [];
  const dIn = (id, v) => `<input type="date" id="${id}" value="${v || ''}" onchange="mrsApplyDates()">`;
  openModal(`<h2>🧭 تصدير إلى مرصاد</h2>
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      <button class="btn ${u.mode === 'compare' ? 'primary' : ''}" onclick="mrsSetMode('compare')">📊 مقارنة فترتين (تقدّم وتراجع)</button>
      <button class="btn ${u.mode === 'base' ? 'primary' : ''}" onclick="mrsSetMode('base')">📄 تقييم فترة واحدة</button>
    </div>
    <div class="muted" style="line-height:1.9;font-size:12.5px;margin-bottom:8px">
      ${u.mode === 'compare'
        ? 'ملف ZIP واحد فيه الفترة (أ) كتقييم سابق والفترة (ب) كتقييم حالي. استورده في مرصاد ثم افتح «متابعة التغيّر». <b>التكرار يُحسب بمعدل الحدوث لكل حصة حضرها الطالب</b>، فتصح مقارنة فترة طويلة بفترة قصيرة.'
        : 'تقييم واحد للفترة المحددة — يصبح التقييم الحالي للطلاب في مرصاد.'}</div>
    <div class="row" style="margin-bottom:6px"><b style="min-width:80px">${u.mode === 'compare' ? 'الفترة (أ)' : 'الفترة'}</b> من ${dIn('mra-from', u.A.from)} إلى ${dIn('mra-to', u.A.to)} <span class="muted">${u.A.from && u.A.to ? daysBetween(u.A) + ' يوم' : ''}${r ? ' — ' + r.daysA + ' يوم دراسي' : ''}</span></div>
    ${u.mode === 'compare' ? `<div class="row" style="margin-bottom:8px"><b style="min-width:80px">الفترة (ب)</b> من ${dIn('mrb-from', u.B.from)} إلى ${dIn('mrb-to', u.B.to)} <span class="muted">${u.B.from && u.B.to ? daysBetween(u.B) + ' يوم' : ''}${r ? ' — ' + r.daysB + ' يوم دراسي' : ''}</span></div>` : ''}
    ${err ? `<div class="card" style="border-color:var(--warn)">⚠️ ${esc(err)}</div>` : `
    <div class="kpis">${kpi(r.files.length, 'ملف')}${kpi(st.reviewed + ' / ' + st.classes, 'شعبة راجعها المعلم ✅', st.reviewed === st.classes ? 'good' : 'warn')}${kpi(st.students, 'سجل طالب')}
      ${u.mode === 'compare' ? kpi(r.cmp.better, 'تحسّن', 'good') + kpi(r.cmp.worse, 'تراجع', 'bad') + kpi(r.cmp.same, 'مستقر') : kpi(top.reduce((n, x) => n + x.a, 0), 'بند «دائماً»', 'bad') + kpi(top.reduce((n, x) => n + x.s, 0), 'بند «أحياناً»', 'warn')}</div>
    <details class="card"><summary><b>قواعد التحويل</b> <span class="muted">(اضغط للتعديل)</span></summary>
      <div class="row">ملاحظة سلبية (أو سببا خصم): <label>«أحياناً» إذا تكررت مرة كل <input type="number" min="2" style="width:56px" id="mr-ns" value="${cfg.noteSomeEvery}"> حصة أو أقل</label>
        <label>«دائماً» مرة كل <input type="number" min="1" style="width:56px" id="mr-na" value="${cfg.noteAlwaysEvery}"> حصص أو أقل</label></div>
      <div class="row">B06 التأخر: <label>«أحياناً» مرة كل <input type="number" min="2" style="width:56px" id="mr-ls" value="${cfg.lateSomeEvery}"> حصة</label>
        <label>«دائماً» مرة كل <input type="number" min="1" style="width:56px" id="mr-la" value="${cfg.lateAlwaysEvery}"> حصص</label></div>
      <div class="row">B05 الغياب (نسبة من الأيام الدراسية): <label>«أحياناً» من <input type="number" min="1" max="100" style="width:56px" id="mr-as" value="${cfg.absPctSome}">%</label>
        <label>«دائماً» من <input type="number" min="1" max="100" style="width:56px" id="mr-aa" value="${cfg.absPctAlways}">%</label></div>
      <div class="row">A07 متوسط التقييمات: <label>«أحياناً» أقل من <input type="number" min="1" max="100" style="width:56px" id="mr-ts" value="${cfg.testSome}">%</label>
        <label>«دائماً» أقل من <input type="number" min="1" max="100" style="width:56px" id="mr-ta" value="${cfg.testAlways}">%</label>
        <button class="btn sm" onclick="saveMarsadCfg()">↻ تطبيق</button></div>
      <div class="muted" style="font-size:12px;line-height:1.8">يُستنتج أيضاً: A04 المشاركة (مقارنة بالصف)، A05 التركيز (الخصومات)، A08 الدافعية (مؤشر مركّب)، A03 اقتراح عند تدنٍّ شديد.
        الملاحظات الإيجابية تخفّف البنود المرتبطة بها. مراجعة المعلم تُنسب للفترة التي راجع فيها.</div>
    </details>
    <div class="card"><h3>البنود المرصودة ${u.mode === 'compare' ? 'في الفترة (ب)' : ''}</h3>
      ${top.length ? `<div class="tbl-wrap" style="max-height:220px"><table><thead><tr><th>البند</th><th class="num">أحياناً</th><th class="num">دائماً</th></tr></thead><tbody>
        ${top.map(x => `<tr><td style="white-space:normal"><b>${x.c}</b> ${esc(MRS.STATEMENTS[x.c][0])}</td><td class="num">${x.s}</td><td class="num" style="color:var(--bad);font-weight:800">${x.a}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="muted">لا توجد بنود مرصودة في هذا المدى.</div>'}
      ${r.skipped.length ? `<div class="muted" style="font-size:12px;margin-top:6px">تم تخطي صفوف بأسماء غير قياسية: ${r.skipped.map(esc).join('، ')}</div>` : ''}
    </div>`}
    <div class="actions">${err ? '' : `<button class="btn primary" onclick="downloadMarsadZip()" ${r.files.length ? '' : 'disabled'}>📦 تنزيل ملف مرصاد (ZIP)</button>`}<button class="btn" onclick="closeModal()">إغلاق</button></div>`);
}
function saveMarsadCfg() {
  const v = (id, min) => Math.max(min || 1, parseInt(document.getElementById(id).value, 10) || 1);
  const ns = v('mr-ns', 2), na = Math.min(v('mr-na'), ns), ls = v('mr-ls', 2), la = Math.min(v('mr-la'), ls);
  SETTINGS.marsad = { noteSomeEvery: ns, noteAlwaysEvery: na, lateSomeEvery: ls, lateAlwaysEvery: la,
    absPctSome: v('mr-as'), absPctAlways: Math.max(v('mr-as'), v('mr-aa')), testSome: Math.max(v('mr-ts'), v('mr-ta')), testAlways: v('mr-ta') };
  saveSettings();
  openMarsadExport();
}
function downloadMarsadZip() {
  const u = MRS_UI, err = mrsCheck(u);
  if (err) return toast(err);
  const r = buildMarsadExport(u.mode, u.A, u.B);
  if (!r.files.length) return toast('لا توجد ملفات');
  try { localStorage.setItem(MRS_LAST_KEY, JSON.stringify({ mode: u.mode, A: u.A, B: u.B, at: new Date().toISOString() })); } catch (e) {}
  const name = u.mode === 'compare' ? `مرصاد_مقارنة_${u.A.from}_${u.A.to}_مع_${u.B.from}_${u.B.to}.zip` : `مرصاد_تقييم_${u.A.from}_${u.A.to}.zip`;
  MRS.download(makeZip(r.files), name);
  toast(`تم تنزيل ${r.files.length} ملف مرصاد ✅`);
}
