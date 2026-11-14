/* 06c-points-to-grades.js — تحويل النقاط إلى درجات من 100 بشروط ذكية
   الطريقة: درجة = أقل درجة + (أعلى − أقل) × x^γ
   - x = موقع الطالب بين أقل وأعلى نقاط (أو ترتيبه المئيني)، فأعلى طالب = أعلى درجة وأقل طالب = أقل درجة دائماً.
   - γ = 1 توزيع خطي. γ أقل من 1 يرفع الدرجات، وأكبر من 1 يخفضها — مع الحفاظ على الترتيب
     (من نقاطه أكثر لا تكون درجته أقل)، والمتساوون في النقاط يحصلون على نفس الدرجة.
   - يُحسب γ تلقائياً ليحقق: متوسطاً مطلوباً، و/أو عدداً أدنى من الطلاب فوق درجة معيّنة. */

const PG_DEF = { max: 95, min: 80, useK: true, k: 6, t: 90, useMean: false, mean: 88, mode: 'points', prio: 'k', round: 1, separate: true, source: 'total' };
let PG_CFG = (() => { try { return Object.assign({}, PG_DEF, JSON.parse(localStorage.getItem('nojomi_p2g') || '{}')); } catch (e) { return Object.assign({}, PG_DEF); } })();
let PG_LAST = null;

function p2gStud(k) { return k === 1 ? 'طالب واحد' : k === 2 ? 'طالبان' : k <= 10 ? k + ' طلاب' : k + ' طالباً'; }
function p2gRound(v, step) { return step === 0.5 ? Math.round(v * 2) / 2 : Math.round(v); }

// يحسب درجات مجموعة طلاب: items = [{s, cls, pts}]
function p2gCompute(items, c) {
  const n = items.length;
  if (!n) return { rows: [], gamma: 1, notes: [] };
  const notes = [];
  // x لكل طالب
  const pts = items.map(i => i.pts);
  const pmin = Math.min(...pts), pmax = Math.max(...pts);
  let xs;
  if (pmax === pmin) xs = items.map(() => 1);
  else if (c.mode === 'rank') {
    const sorted = pts.slice().sort((a, b) => a - b);
    const avgRank = v => { const first = sorted.indexOf(v), last = sorted.lastIndexOf(v); return (first + last) / 2; };
    xs = pts.map(v => avgRank(v) / (n - 1));
  } else xs = pts.map(v => (v - pmin) / (pmax - pmin));

  const span = c.max - c.min;
  const gradesAt = g => xs.map(x => p2gRound(c.min + span * Math.pow(x, g), c.round));
  const meanAt = g => { const gs = gradesAt(g); return gs.reduce((a, b) => a + b, 0) / n; };
  const countAt = g => gradesAt(g).filter(v => v >= c.t).length;
  const G_LO = 0.05, G_HI = 20;

  // γ الذي يحقق المتوسط (المتوسط يقل كلما زاد γ)
  let gMean = null;
  if (c.useMean) {
    if (pmax === pmin) notes.push('كل الطلاب لديهم نفس النقاط — حصلوا على نفس الدرجة.');
    else if (c.mean > meanAt(G_LO) + 0.01) { gMean = G_LO; notes.push(`⚠️ المتوسط ${c.mean} أعلى مما يمكن بين ${c.min} و${c.max} — أقصى متوسط ممكن ${meanAt(G_LO).toFixed(1)}.`); }
    else if (c.mean < meanAt(G_HI) - 0.01) { gMean = G_HI; notes.push(`⚠️ المتوسط ${c.mean} أقل مما يمكن بين ${c.min} و${c.max} — أقل متوسط ممكن ${meanAt(G_HI).toFixed(1)}.`); }
    else {
      let lo = Math.log(G_LO), hi = Math.log(G_HI);
      for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (meanAt(Math.exp(m)) > c.mean) lo = m; else hi = m; }
      gMean = Math.exp((lo + hi) / 2);
    }
  }
  // أكبر γ يحقق «على الأقل k طلاب ≥ t» (العدد يقل كلما زاد γ)
  let gK = null;
  if (c.useK) {
    if (c.k > n) notes.push(`⚠️ المطلوب ${p2gStud(c.k)} ≥ ${c.t} لكن عدد الطلاب ${n} فقط.`);
    else if (c.t > c.max) notes.push(`⚠️ الدرجة ${c.t} أعلى من أعلى درجة ${c.max}.`);
    else if (countAt(G_LO) < c.k) { gK = G_LO; notes.push(`⚠️ لا يمكن أن يحصل ${p2gStud(c.k)} على ${c.t} فأكثر (المتساوون في الأسفل كثيرون) — أقصى عدد ممكن ${countAt(G_LO)}.`); }
    else if (countAt(G_HI) >= c.k) gK = G_HI;
    else {
      let lo = Math.log(G_LO), hi = Math.log(G_HI);
      for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (countAt(Math.exp(m)) >= c.k) lo = m; else hi = m; }
      gK = Math.exp(lo);
    }
  }
  // الاختيار
  let gamma = 1;
  if (gMean !== null && gK !== null) {
    if (gMean <= gK) gamma = gMean;                 // المتوسط يحقق شرط العدد أيضاً
    else if (c.prio === 'k') { gamma = gK; notes.push(`ℹ️ الشرطان متعارضان: طُبّق شرط «${p2gStud(c.k)} ≥ ${c.t}»، فأصبح المتوسط ${meanAt(gK).toFixed(1)} بدل ${c.mean}.`); }
    else { gamma = gMean; notes.push(`ℹ️ الشرطان متعارضان: طُبّق المتوسط ${c.mean}، فأصبح عدد الطلاب ≥ ${c.t}: ${countAt(gMean)} بدل ${c.k}.`); }
  } else if (gMean !== null) gamma = gMean;
  else if (gK !== null) gamma = Math.min(1, gK);   // خطي ما لم يحتج الشرط رفع الدرجات

  const grades = gradesAt(gamma);
  const rows = items.map((it, i) => Object.assign({}, it, { grade: grades[i] }))
    .sort((a, b) => b.pts - a.pts || a.s.name.localeCompare(b.s.name, 'ar'));
  let rk = 0, last = null;
  rows.forEach((r, i) => { if (r.pts !== last) { rk = i + 1; last = r.pts; } r.rank = rk; });
  const mean = grades.reduce((a, b) => a + b, 0) / n;
  return { rows, gamma, notes, stats: { n, max: Math.max(...grades), min: Math.min(...grades), mean, countT: grades.filter(v => v >= c.t).length } };
}

function p2gPoints(s, c) {
  if (c.source === 'total') return s.points || 0;
  return (s.pointsLog || []).reduce((n, e) => n + (e.date >= c.from && e.date <= c.to ? (e.pts || 0) : 0), 0);
}

function p2gRun() {
  const c = PG_CFG;
  const ids = c.classIds && c.classIds.length ? c.classIds : [state.activeClass];
  const classes = state.classes.filter(x => ids.includes(x.id));
  const groups = c.separate
    ? classes.map(cl => ({ title: 'الشعبة ' + cl.name, items: cl.students.map(s => ({ s, cls: cl.name, pts: p2gPoints(s, c) })) }))
    : [{ title: classes.map(cl => cl.name).join('، '), items: classes.flatMap(cl => cl.students.map(s => ({ s, cls: cl.name, pts: p2gPoints(s, c) }))) }];
  PG_LAST = { cfg: Object.assign({}, c), groups: groups.map(g => Object.assign(g, p2gCompute(g.items, c))) };
  return PG_LAST;
}

/* ---------- الواجهة ---------- */
function openPointsToGrades() {
  if (!state.classes.length) return toast('لا توجد صفوف', '⚠️');
  if (!PG_CFG.classIds || !PG_CFG.classIds.some(id => state.classes.some(c => c.id === id))) PG_CFG.classIds = [state.activeClass];
  const today = _today();
  if (!PG_CFG.from) { PG_CFG.from = getSchoolInfo().termStart || today; PG_CFG.to = today; }
  const c = PG_CFG;
  const inp = (id, v, w) => `<input class="input" type="number" id="${id}" value="${v}" style="width:${w || 64}px;display:inline-block;padding:5px 6px" oninput="p2gRead()">`;
  openModal(`
    <div class="modal-title">📝 تحويل النقاط إلى درجات من 100</div>
    <div style="font-size:12.5px;line-height:2.3">
      <div><b>الصفوف:</b> ${state.classes.map(cl => `<label style="margin-inline-end:8px;white-space:nowrap"><input type="checkbox" class="p2g-cls" value="${cl.id}" ${c.classIds.includes(cl.id) ? 'checked' : ''} onchange="p2gRead()"> ${cl.name}</label>`).join('')}
        <label style="white-space:nowrap"><input type="checkbox" id="p2g-sep" ${c.separate ? 'checked' : ''} onchange="p2gRead()"> كل شعبة على حدة</label></div>
      <div><b>النقاط:</b> <select class="select" id="p2g-src" style="width:auto;display:inline-block" onchange="p2gRead()">
          <option value="total" ${c.source === 'total' ? 'selected' : ''}>مجموع النقاط الحالي</option><option value="range" ${c.source === 'range' ? 'selected' : ''}>نقاط فترة محددة</option></select>
        <span id="p2g-range" style="display:${c.source === 'range' ? 'inline' : 'none'}"> من <input class="input" type="date" id="p2g-from" value="${c.from}" style="width:auto;display:inline-block" onchange="p2gRead()"> إلى <input class="input" type="date" id="p2g-to" value="${c.to}" style="width:auto;display:inline-block" onchange="p2gRead()"></span></div>
      <div><b>الدرجات:</b> أعلى طالب ${inp('p2g-max', c.max)} — أقل طالب ${inp('p2g-min', c.min)}
        — التوزيع <select class="select" id="p2g-mode" style="width:auto;display:inline-block" onchange="p2gRead()"><option value="points" ${c.mode === 'points' ? 'selected' : ''}>حسب النقاط</option><option value="rank" ${c.mode === 'rank' ? 'selected' : ''}>حسب الترتيب</option></select>
        — التقريب <select class="select" id="p2g-round" style="width:auto;display:inline-block" onchange="p2gRead()"><option value="1" ${c.round === 1 ? 'selected' : ''}>عدد صحيح</option><option value="0.5" ${c.round === 0.5 ? 'selected' : ''}>نصف درجة</option></select></div>
      <div><label><input type="checkbox" id="p2g-usek" ${c.useK ? 'checked' : ''} onchange="p2gRead()"> على الأقل</label> ${inp('p2g-k', c.k, 54)} طلاب درجتهم ${inp('p2g-t', c.t, 60)} فأكثر</div>
      <div><label><input type="checkbox" id="p2g-usem" ${c.useMean ? 'checked' : ''} onchange="p2gRead()"> متوسط الدرجات</label> ${inp('p2g-mean', c.mean, 64)}
        — عند التعارض الأولوية لـ <select class="select" id="p2g-prio" style="width:auto;display:inline-block" onchange="p2gRead()"><option value="k" ${c.prio === 'k' ? 'selected' : ''}>عدد المتفوقين</option><option value="mean" ${c.prio === 'mean' ? 'selected' : ''}>المتوسط</option></select></div>
    </div>
    <div id="p2g-out" style="max-height:46vh;overflow-y:auto;margin-top:10px"></div>
    <div class="modal-actions" style="flex-wrap:wrap">
      <button class="btn btn-primary" onclick="p2gPrint()">🖨️ طباعة التقرير</button>
      <button class="btn btn-success" onclick="p2gExcel()">📤 Excel</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button>
    </div>`);
  p2gRender();
}

function p2gRead() {
  const v = id => document.getElementById(id);
  const num = (id, d) => { const x = parseFloat(v(id).value); return isNaN(x) ? d : x; };
  const c = PG_CFG;
  c.classIds = [...document.querySelectorAll('.p2g-cls:checked')].map(x => +x.value);
  c.separate = v('p2g-sep').checked;
  c.source = v('p2g-src').value; v('p2g-range').style.display = c.source === 'range' ? 'inline' : 'none';
  c.from = v('p2g-from').value; c.to = v('p2g-to').value;
  c.max = Math.min(100, num('p2g-max', 95)); c.min = Math.max(0, Math.min(num('p2g-min', 80), c.max));
  c.mode = v('p2g-mode').value; c.round = +v('p2g-round').value;
  c.useK = v('p2g-usek').checked; c.k = Math.max(1, Math.round(num('p2g-k', 6))); c.t = num('p2g-t', 90);
  c.useMean = v('p2g-usem').checked; c.mean = num('p2g-mean', 88); c.prio = v('p2g-prio').value;
  try { localStorage.setItem('nojomi_p2g', JSON.stringify(c)); } catch (e) {}
  p2gRender();
}

function p2gRender() {
  const out = document.getElementById('p2g-out');
  if (!out) return;
  if (!PG_CFG.classIds.length) { out.innerHTML = '<div style="color:var(--text-muted)">اختر صفاً واحداً على الأقل.</div>'; return; }
  const r = p2gRun(), c = r.cfg;
  out.innerHTML = r.groups.map(g => {
    const st = g.stats || { n: 0 };
    const okK = !c.useK || st.countT >= c.k, okM = !c.useMean || Math.abs(st.mean - c.mean) <= 0.5;
    return `<div style="border:1px solid var(--border-color);border-radius:12px;padding:10px 12px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-weight:800">${g.title}
        <span style="font-size:12px;font-weight:700">أعلى ${st.max ?? '—'} · أقل ${st.min ?? '—'} · المتوسط ${st.n ? st.mean.toFixed(1) : '—'}
          · ≥${c.t}: ${st.countT ?? 0} ${c.useK || c.useMean ? (okK && okM ? '✅' : '⚠️') : ''}</span></div>
      ${g.notes.map(n => `<div style="font-size:11.5px;color:var(--text-muted)">${n}</div>`).join('')}
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:6px">
        <tr style="color:var(--text-muted)"><th style="text-align:center">#</th><th style="text-align:right">الطالب</th>${c.separate ? '' : '<th>الشعبة</th>'}<th>النقاط</th><th>الدرجة</th></tr>
        ${g.rows.map(x => `<tr style="border-top:1px solid var(--border-color)"><td style="text-align:center">${x.rank}</td><td>${x.s.name}</td>${c.separate ? '' : `<td style="text-align:center">${x.cls}</td>`}
          <td style="text-align:center">${x.pts}</td><td style="text-align:center;font-weight:900;color:${x.grade >= c.t ? 'var(--present)' : 'var(--accent)'}">${x.grade}</td></tr>`).join('')}
      </table></div>`;
  }).join('');
}

function p2gDesc(c) {
  const parts = [`أعلى طالب ${c.max}`, `أقل طالب ${c.min}`];
  if (c.useK) parts.push(`على الأقل ${p2gStud(c.k)} ≥ ${c.t}`);
  if (c.useMean) parts.push(`متوسط ${c.mean}`);
  parts.push(c.mode === 'rank' ? 'حسب الترتيب' : 'حسب النقاط');
  parts.push(c.source === 'total' ? 'مجموع النقاط الحالي' : `نقاط الفترة ${c.from} إلى ${c.to}`);
  return parts.join(' — ');
}

function p2gPrint() {
  if (!PG_LAST) return;
  const si = getSchoolInfo(), c = PG_LAST.cfg;
  const w = window.open('', '_blank');
  if (!w) return toast('اسمح بالنوافذ المنبثقة للطباعة', '⚠️');
  w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تقرير الدرجات</title>
    <style>@page{size:A4;margin:12mm}body{font-family:Tajawal,Tahoma,sans-serif;color:#111}h2{margin:0}.s{color:#555;margin:4px 0 12px}
    table{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:13px}th,td{border:1px solid #bbb;padding:5px 7px;text-align:center}td.n{text-align:right}
    th{background:#f2f2f2}.g{break-inside:avoid;margin-bottom:16px}.sum{font-size:12.5px;color:#333;margin:4px 0}.hi{font-weight:800}</style></head><body>
    <h2>تقرير تحويل النقاط إلى درجات (من 100)</h2>
    <div class="s">${si.schoolName || ''} — ${si.subject || ''} — المعلم: ${si.teacher || ''} — ${new Date().toLocaleDateString('ar-EG', { numberingSystem: 'latn' })}<br>الشروط: ${p2gDesc(c)}</div>
    ${PG_LAST.groups.map(g => `<div class="g"><h3 style="margin:6px 0">${g.title}</h3>
      <div class="sum">عدد الطلاب ${g.stats ? g.stats.n : 0} · أعلى ${g.stats ? g.stats.max : '—'} · أقل ${g.stats ? g.stats.min : '—'} · المتوسط ${g.stats ? g.stats.mean.toFixed(1) : '—'} · عدد ≥ ${c.t}: ${g.stats ? g.stats.countT : 0}</div>
      ${g.notes.map(n => `<div class="sum">${n}</div>`).join('')}
      <table><tr><th>#</th><th>الطالب</th><th>رقم الطالب</th>${c.separate ? '' : '<th>الشعبة</th>'}<th>النقاط</th><th>الدرجة</th></tr>
      ${g.rows.map(x => `<tr><td>${x.rank}</td><td class="n">${x.s.name}</td><td>${x.s.sid || ''}</td>${c.separate ? '' : `<td>${x.cls}</td>`}<td>${x.pts}</td><td class="hi">${x.grade}</td></tr>`).join('')}
      </table></div>`).join('')}
    <script>setTimeout(()=>print(),400)<\/script></body></html>`);
  w.document.close();
}

function p2gExcel() {
  if (!PG_LAST) return;
  if (typeof XLSX === 'undefined') return toast('مكتبة Excel غير محمّلة', '⚠️');
  const c = PG_LAST.cfg, wb = XLSX.utils.book_new();
  PG_LAST.groups.forEach((g, i) => {
    const rows = g.rows.map(x => ({ 'الترتيب': x.rank, 'الطالب': x.s.name, 'رقم الطالب': x.s.sid || '', 'الشعبة': x.cls, 'النقاط': x.pts, 'الدرجة من 100': x.grade }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '': 'لا يوجد طلاب' }]);
    XLSX.utils.book_append_sheet(wb, ws, (g.title.replace('الشعبة ', '').replace(/[\\/?*\[\]:]/g, '-') || 'درجات').slice(0, 28) + (PG_LAST.groups.length > 1 ? '' : ''));
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['الشروط'], [p2gDesc(c)]]), 'الشروط');
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.writeFile(wb, `درجات_من_النقاط_${_today()}.xlsx`);
}
