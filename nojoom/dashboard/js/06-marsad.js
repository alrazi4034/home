/* 06-marsad.js — تحويل ملاحظات نجوم مدرستي إلى ملفات برنامج مِرْصاد
   - لكل معلم × صف يُنشأ ملف classBatch (نفس صيغة Marsad_input) يقرؤه marsad_result مباشرة.
   - البنود: ملاحظات + أسباب الخصم + استنتاج من البيانات − الإيجابية المرتبطة، ثم مراجعة المعلم (المحرّك المشترك MRS).
   - B05 (تكرار الغياب) يُحسب من نسبة أيام غياب الطالب إلى الأيام الدراسية (النموذج + نجوم مدرستي) في نفس المدى.
   - B06 (تكرار التأخر) يُحسب من حالة «متأخر» في حضور نجوم مدرستي (مع أي ملاحظة تأخر قديمة).
   - الملاحظات الإيجابية تذهب إلى «نقاط القوة»، والملاحظات الأخرى (غير ذلك) إلى «ملاحظات إضافية».
   - الناتج ملف ZIP واحد للمدرسة: يُفك ثم تُختار ملفاته (أو المجلد) في برنامج النتائج. */

/* المحرّك المشترك: nojoom/shared/marsad-engine.js (MRS) — نفس الحساب في نجوم مدرستي ولوحة التحكم.
   مراجعة المعلم (marsadReview في ملفه) تُعتمد كما هي. */
const MARSAD_DEFAULTS = { noteSome: 1, noteAlways: 3, absPctSome: 10, absPctAlways: 20, lateSome: 2, lateAlways: 4, testSome: 65, testAlways: 50 };
function marsadCfg() { return Object.assign({}, MARSAD_DEFAULTS, SETTINGS.marsad || {}); }

/* ---------- بناء الملفات ---------- */
function buildMarsadBatches(from, to) {
  const cfg = marsadCfg();
  // نسبة غياب كل طالب في المدى (كل المصادر: الفورم + نجوم مدرستي)
  const miss = computeMissing(from, to, '');
  const abs = computeAbsence(from, to, '', miss);
  const absPct = new Map(), nDays = miss.days.length;
  abs.students.forEach(s => absPct.set(s.sid || 'n:' + normName(s.name), nDays ? s.dayCount / nDays * 100 : 0));
  const pctOf = s => { const p = splitNameId(s.name); const k = s.sid || p.sid; return nDays ? (absPct.get(k || 'n:' + normName(p.name)) || 0) : null; };

  const files = [], stats = { students: 0, flagged: {}, skipped: [], reviewed: 0, classes: 0, edited: 0, inferred: 0 };
  MRS.CODES.forEach(c => stats.flagged[c] = { sometimes: 0, always: 0 });
  MODEL.files.teachers.forEach(t => {
    const raw = t.raw || {};
    const ct = MODEL.teachers.get(t.key);
    const subject = (t.subject || (ct && ct.subjects[0]) || '').split('،')[0].trim();
    (raw.classes || []).forEach(c => {
      if (!/^\d+\s*\/\s*\d+$/.test(String(c.name))) { stats.skipped.push(t.name + ' — ' + c.name); return; }
      const rv = (raw.marsadReview && raw.marsadReview[c.name]) || {};
      // رقم الطالب: من الملف، أو المستنتج من الملف المركزي عند قراءة الملفات القديمة
      const pc = t.classes.find(x => x.name === c.name);
      c = Object.assign({}, c, { students: (c.students || []).map((s, i) => s.sid ? s : Object.assign({}, s, { sid: (pc && pc.students[i] && pc.students[i].sid) || '' })) });
      const rows = MRS.analyzeClass(c, raw.assessments || [], { from, to, cfg, absPct: pctOf, review: rv.cells || {} });
      const f = MRS.buildBatch({ className: c.name, rows, teacherName: t.name, subject, from, to, file: t.file, reviewed: !!rv.reviewedAt });
      if (!f) return;
      stats.classes++; if (rv.reviewedAt) stats.reviewed++;
      rows.forEach(r => MRS.CODES.forEach(k => {
        if (r.answers[k] !== 'never') stats.flagged[k][r.answers[k]]++;
        if (r.overridden[k]) stats.edited++;
        if (r.kind[k] === 'data' && !r.overridden[k] && r.answers[k] !== 'never') stats.inferred++;
      }));
      stats.students += rows.length;
      files.push({ name: f.name, text: f.text, teacher: t.name, cls: c.name, n: rows.length, reviewed: !!rv.reviewedAt });
    });
  });
  stats.days = nDays;
  return { files, stats, cfg };
}
const makeZip = MRS.makeZip;
const MARSAD_STATEMENTS = MRS.STATEMENTS, MARSAD_CODES = MRS.CODES;

/* ---------- الواجهة ---------- */
function openMarsadExport() {
  if (!MODEL || !MODEL.files.teachers.length) {
    return openModal(`<h2>🧭 تصدير إلى مرصاد</h2><div style="line-height:2">اربط «مجلد ملفات المعلمين» أولاً — الملاحظات السلوكية تُقرأ من ملفات نجوم مدرستي.</div>
      <div class="actions"><button class="btn" onclick="closeModal()">إغلاق</button></div>`);
  }
  const cfg = marsadCfg();
  const from = LAST.from, to = LAST.to;
  const r = buildMarsadBatches(from, to);
  const top = MRS.CODES.map(c => ({ c, s: r.stats.flagged[c].sometimes, a: r.stats.flagged[c].always }))
    .filter(x => x.s + x.a).sort((x, y) => (y.a * 2 + y.s) - (x.a * 2 + x.s));
  openModal(`<h2>🧭 تصدير ملاحظات نجوم مدرستي إلى مرصاد</h2>
    <div class="muted" style="line-height:1.9;font-size:12.5px;margin-bottom:10px">
      المدى: <b>${from}</b> إلى <b>${to}</b> (من الفلتر). يُنشأ ملف لكل معلم × صف بصيغة مرصاد، ويُجمع في ملف ZIP واحد للمدرسة.
      فُكّ الملف ثم اختر ملفاته (أو مجلده) في <b>marsad_result</b>.</div>
    <div class="card"><h3>قواعد التحويل</h3>
      <div class="row">ملاحظة سلبية مسجّلة: <label>«أحياناً» من <input type="number" min="1" style="width:56px" id="mr-ns" value="${cfg.noteSome}"> مرة</label>
        <label>«دائماً» من <input type="number" min="1" style="width:56px" id="mr-na" value="${cfg.noteAlways}"> مرات</label></div>
      <div class="row">B05 تكرار الغياب — نسبة أيام الغياب من ${r.stats.days} يوم دراسي: <label>«أحياناً» من <input type="number" min="1" max="100" style="width:56px" id="mr-as" value="${cfg.absPctSome}">%</label>
        <label>«دائماً» من <input type="number" min="1" max="100" style="width:56px" id="mr-aa" value="${cfg.absPctAlways}">%</label>
      </div>
      <div class="row">B06 تكرار التأخر (مرات «متأخر» في الحضور): <label>«أحياناً» من <input type="number" min="1" style="width:56px" id="mr-ls" value="${cfg.lateSome}"></label>
        <label>«دائماً» من <input type="number" min="1" style="width:56px" id="mr-la" value="${cfg.lateAlways}"></label></div>
      <div class="row">A07 متوسط التقييمات: <label>«أحياناً» أقل من <input type="number" min="1" max="100" style="width:56px" id="mr-ts" value="${cfg.testSome}">%</label>
        <label>«دائماً» أقل من <input type="number" min="1" max="100" style="width:56px" id="mr-ta" value="${cfg.testAlways}">%</label>
        <button class="btn sm" onclick="saveMarsadCfg()">↻ تطبيق</button></div>
      <div class="muted" style="font-size:12px;line-height:1.8">يُستنتج أيضاً من البيانات: A04 المشاركة (مقارنة بالصف)، A05 التركيز (الخصومات)، A08 الدافعية (مؤشر مركّب)، A03 اقتراح عند تدنٍّ شديد.
        الملاحظات الإيجابية تخفّف البنود المرتبطة بها. <b>مراجعة المعلم في نجوم مدرستي تُعتمد كما هي.</b></div>
    </div>
    <div class="kpis">${kpi(r.files.length, 'ملف (معلم × صف)', 'star')}${kpi(r.stats.reviewed + ' / ' + r.stats.classes, 'شعبة راجعها المعلم ✅', r.stats.reviewed === r.stats.classes ? 'good' : 'warn')}${kpi(r.stats.students, 'سجل طالب')}${kpi(top.reduce((n, x) => n + x.a, 0), 'بند «دائماً»', 'bad')}${kpi(top.reduce((n, x) => n + x.s, 0), 'بند «أحياناً»', 'warn')}</div>
    <div class="card"><h3>البنود المرصودة</h3>
      ${top.length ? `<div class="tbl-wrap" style="max-height:260px"><table><thead><tr><th>البند</th><th class="num">أحياناً</th><th class="num">دائماً</th></tr></thead><tbody>
        ${top.map(x => `<tr><td style="white-space:normal"><b>${x.c}</b> ${esc(MRS.STATEMENTS[x.c][0])}</td><td class="num">${x.s}</td><td class="num" style="color:var(--bad);font-weight:800">${x.a}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="muted">لا توجد ملاحظات سلبية أو غياب يتجاوز الحد في هذا المدى.</div>'}
      ${r.stats.skipped.length ? `<div class="muted" style="font-size:12px;margin-top:6px">تم تخطي صفوف بأسماء غير قياسية: ${r.stats.skipped.map(esc).join('، ')}</div>` : ''}
    </div>
    <div class="actions"><button class="btn primary" onclick="downloadMarsadZip()" ${r.files.length ? '' : 'disabled'}>📦 تنزيل ملف مرصاد (ZIP)</button><button class="btn" onclick="closeModal()">إغلاق</button></div>`);
}
function saveMarsadCfg() {
  const v = id => Math.max(1, parseInt(document.getElementById(id).value, 10) || 1);
  SETTINGS.marsad = { noteSome: v('mr-ns'), noteAlways: Math.max(v('mr-ns'), v('mr-na')), absPctSome: v('mr-as'), absPctAlways: Math.max(v('mr-as'), v('mr-aa')),
    lateSome: v('mr-ls'), lateAlways: Math.max(v('mr-ls'), v('mr-la')), testSome: Math.max(v('mr-ts'), v('mr-ta')), testAlways: v('mr-ta') };
  saveSettings();
  openMarsadExport();
}
function downloadMarsadZip() {
  const r = buildMarsadBatches(LAST.from, LAST.to);
  if (!r.files.length) return toast('لا توجد ملفات');
  const blob = makeZip(r.files);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `مرصاد_من_نجوم_مدرستي_${LAST.from}_${LAST.to}.zip`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`تم تنزيل ${r.files.length} ملف مرصاد ✅`);
}
