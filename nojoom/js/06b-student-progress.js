/* 06b-student-progress.js — تقرير تطوّر الطالب (تحسّن / ثبات / تراجع) مع خطط مقترحة
   يقارن آخر 3 أسابيع دراسية بالأسابيع التي قبلها في: الحضور، التأخر، النقاط، المشاركة،
   الملاحظات الإيجابية والسلبية، ونتائج التقييمات. ثم يقترح خططاً عملية حسب ما يظهر في البيانات. */

const PG_RECENT_WEEKS = 3;

// مفتاح الأسبوع: أسبوع الفصل الدراسي إن وُجد، وإلا تاريخ يوم الاثنين
function pgWeekKey(date) {
  const tw = getTermWeek(date);
  if (tw !== null) return 'w' + String(tw).padStart(2, '0');
  const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return 'd' + d.toISOString().slice(0, 10);
}
function pgWeekLabel(k) { return k[0] === 'w' ? 'أسبوع ' + parseInt(k.slice(1), 10) : k.slice(6).split('-').reverse().join('/'); }
function pgNoteDate(n) {
  if (n.isoDate) return n.isoDate;
  const m = String(n.date || '').replace(/[‎‏؜]/g, '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}

function pgWeeklyStats(cls, s) {
  const W = {};
  const wk = d => (W[pgWeekKey(d)] = W[pgWeekKey(d)] || { sessions: 0, absent: 0, late: 0, pts: 0, part: 0, pos: 0, neg: 0, codes: {} });
  (cls._savedDates || []).forEach(d => { wk(d).sessions++; if ((s.absenceDates || []).includes(d)) wk(d).absent++; });
  (s.lateDates || []).forEach(d => { if ((cls._savedDates || []).includes(d)) wk(d).late++; });
  (s.pointsLog || []).forEach(e => { if (!e.date) return; const w = wk(e.date); w.pts += e.pts || 0; if (e.type === 'participation') w.part += e.pts || 0; });
  (s.behaviorNotes || []).forEach(n => {
    const d = pgNoteDate(n); if (!d) return;
    const w = wk(d);
    if (n.type === 'positive') w.pos++;
    else { w.neg++; const c = n.code || (typeof marsadCodeOf === 'function' ? marsadCodeOf(n.text) : '') || 'X'; w.codes[c] = (w.codes[c] || 0) + 1; }
  });
  return W;
}

// متوسط نقاط الصف الأسبوعية (للمقارنة)
function pgClassWeeklyAvg(cls) {
  const tot = {}, n = cls.students.length || 1;
  cls.students.forEach(s => (s.pointsLog || []).forEach(e => { if (e.date) { const k = pgWeekKey(e.date); tot[k] = (tot[k] || 0) + (e.pts || 0); } }));
  Object.keys(tot).forEach(k => tot[k] = tot[k] / n);
  return tot;
}

function pgAvg(list, f) { const v = list.map(f).filter(x => x !== null && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }

function pgAnalyze(cls, s) {
  const W = pgWeeklyStats(cls, s);
  const keys = Object.keys(W).sort();
  const active = keys.filter(k => W[k].sessions > 0 || W[k].pts || W[k].pos || W[k].neg);
  const recentK = active.slice(-PG_RECENT_WEEKS), prevK = active.slice(0, -PG_RECENT_WEEKS);
  const R = recentK.map(k => W[k]), P = prevK.map(k => W[k]);
  // سجل النقاط بدأ متأخراً في بعض الصفوف: النقاط والمشاركة تُقارن فقط من أول أسبوع فيه سجل نقاط
  let firstLog = '';
  cls.students.forEach(x => (x.pointsLog || []).forEach(e => { if (e.date && (!firstLog || e.date < firstLog)) firstLog = e.date; }));
  const logFrom = firstLog ? pgWeekKey(firstLog) : '~';
  const P2 = prevK.filter(k => k >= logFrom).map(k => W[k]);
  const att = w => w.sessions ? (w.sessions - w.absent) / w.sessions * 100 : null;

  // التقييمات بترتيب إنشائها
  const scores = (state.assessments || []).filter(a => (a.classIds || []).includes(cls.id))
    .map(a => { const v = a.scores && a.scores[s.id]; return v !== undefined && v !== '' && a.maxScore ? { name: a.name, pct: parseFloat(v) / a.maxScore * 100 } : null; })
    .filter(Boolean);

  // المؤشرات: [الاسم، السابق، الحالي، هل الأعلى أفضل، عتبة التغيّر، الوحدة]
  const ind = [
    ['نسبة الحضور', pgAvg(P, att), pgAvg(R, att), true, 5, '%'],
    ['التأخر في الأسبوع', pgAvg(P, w => w.late), pgAvg(R, w => w.late), false, 0.5, ''],
    ['النقاط في الأسبوع', pgAvg(P2, w => w.pts), pgAvg(R, w => w.pts), true, 2, ''],
    ['المشاركة في الأسبوع', pgAvg(P2, w => w.part), pgAvg(R, w => w.part), true, 1, ''],
    ['ملاحظات إيجابية / أسبوع', pgAvg(P, w => w.pos), pgAvg(R, w => w.pos), true, 0.5, ''],
    ['ملاحظات سلبية / أسبوع', pgAvg(P, w => w.neg), pgAvg(R, w => w.neg), false, 0.5, '']
  ];
  if (scores.length >= 2) {
    const half = Math.max(1, Math.floor(scores.length / 2));
    ind.push(['نتائج التقييمات', pgAvg(scores.slice(0, half), x => x.pct), pgAvg(scores.slice(half), x => x.pct), true, 5, '%']);
  }
  let score = 0;
  const rows = ind.map(([name, prev, cur, higherBetter, th, unit]) => {
    let dir = 'na';
    if (prev !== null && cur !== null) {
      const d = cur - prev;
      dir = Math.abs(d) < th ? 'same' : ((d > 0) === higherBetter ? 'up' : 'down');
      if (dir === 'up') score++; if (dir === 'down') score--;
    }
    return { name, prev, cur, dir, unit };
  });
  const enough = prevK.length >= 1 && recentK.length >= 1;
  const verdict = !enough ? { t: 'لا تكفي البيانات للمقارنة بعد', c: 'var(--text-muted)', i: '⏳' }
    : score >= 2 ? { t: 'تحسّن واضح', c: 'var(--present)', i: '📈' }
    : score === 1 ? { t: 'تحسّن طفيف', c: 'var(--present)', i: '↗️' }
    : score === 0 ? { t: 'مستوى ثابت', c: 'var(--accent)', i: '➖' }
    : score === -1 ? { t: 'تراجع طفيف', c: '#ffa94d', i: '↘️' }
    : { t: 'تراجع يستدعي المتابعة', c: 'var(--absent)', i: '📉' };

  // إجماليات الفصل (لاقتراح الخطط)
  const all = active.map(k => W[k]);
  const tot = { sessions: 0, absent: 0, late: 0, pos: 0, neg: 0, part: 0, codes: {} };
  all.forEach(w => { ['sessions', 'absent', 'late', 'pos', 'neg', 'part'].forEach(f => tot[f] += w[f]); Object.entries(w.codes).forEach(([c, n]) => tot.codes[c] = (tot.codes[c] || 0) + n); });
  const recentCodes = {};
  R.forEach(w => Object.entries(w.codes).forEach(([c, n]) => recentCodes[c] = (recentCodes[c] || 0) + n));
  return { W, keys: active, logFrom, recentK, rows, verdict, score, enough, tot, recentCodes, scores, attTotal: tot.sessions ? (tot.sessions - tot.absent) / tot.sessions * 100 : null };
}

/* ---------- الخطط المقترحة (قواعد واضحة من البيانات) ---------- */
const PG_PLANS = {
  absence: { i: '📅', t: 'خطة متابعة الحضور', who: 'المعلم + ولي الأمر + الأخصائي', steps: [
    'التواصل مع ولي الأمر لمعرفة أسباب الغياب والاتفاق على متابعة أسبوعية.',
    'إرسال ملخص أسبوعي بأيام الحضور والغياب لولي الأمر.',
    'تعزيز الحضور: نقاط إضافية عند الحضور الكامل لأسبوع.',
    'إحالة للأخصائي الاجتماعي إذا تجاوز الغياب 15% أو استمر بالارتفاع.'] },
  late: { i: '⏰', t: 'خطة الانضباط بالوقت', who: 'المعلم + ولي الأمر', steps: [
    'مناقشة أسباب التأخر مع الطالب بشكل فردي.',
    'تكليفه بمهمة في بداية الحصة (توزيع أوراق، تجهيز الجهاز) لتحفيز الحضور المبكر.',
    'إبلاغ ولي الأمر عند تكرار التأخر 3 مرات في أسبوعين.'] },
  talk: { i: '🤫', t: 'خطة ضبط التحدث والمقاطعة', who: 'المعلم', steps: [
    'مراجعة القواعد الصفية مع الطالب والاتفاق على إشارة تنبيه خاصة.',
    'إجلاسه قريباً من المعلم وبعيداً عن مصادر التشتت.',
    'تعزيز فوري (نقطة/ثناء) عند رفع اليد والالتزام بالدور.'] },
  aggression: { i: '🛑', t: 'خطة تعديل السلوك العدواني', who: 'المعلم + الأخصائي الاجتماعي + ولي الأمر', steps: [
    'إحالة فورية للأخصائي الاجتماعي وتوثيق المواقف.',
    'عقد سلوكي مكتوب بين الطالب والمعلم وولي الأمر لمدة أسبوعين.',
    'تدريب على بدائل التعبير عن الغضب، ومتابعة يومية قصيرة.'] },
  compliance: { i: '📋', t: 'خطة الالتزام بالتعليمات', who: 'المعلم + ولي الأمر', steps: [
    'تقسيم التعليمات إلى خطوات قصيرة وواضحة والتأكد من فهمها.',
    'إسناد دور قيادي بسيط في الصف لتعزيز المسؤولية.',
    'تعزيز إيجابي فوري عند الالتزام، ومتابعة أسبوعية مع ولي الأمر.'] },
  devices: { i: '📵', t: 'خطة الاستخدام المسؤول للأجهزة', who: 'المعلم + ولي الأمر', steps: [
    'الاتفاق على قواعد واضحة لاستخدام الأجهزة في الحصة.',
    'إسناد مهام رقمية تعليمية محددة الوقت بدل الاستخدام الحر.',
    'إبلاغ ولي الأمر عند التكرار ومتابعة الاستخدام في المنزل.'] },
  sleep: { i: '😴', t: 'خطة النشاط والانتباه في الحصة', who: 'المعلم + ولي الأمر', steps: [
    'التواصل مع ولي الأمر حول ساعات النوم والتغذية.',
    'إشراك الطالب في أنشطة حركية قصيرة أثناء الحصة.',
    'إحالة للممرضة/الأخصائي عند الاستمرار.'] },
  homework: { i: '📚', t: 'خطة متابعة الواجبات والأدوات', who: 'المعلم + ولي الأمر', steps: [
    'جدول أسبوعي للواجبات يوقّعه ولي الأمر.',
    'تذكير مختصر بالواجبات والأدوات المطلوبة في نهاية الحصة.',
    'مكافأة عند إنجاز الواجبات أسبوعاً كاملاً.'] },
  academic: { i: '🎯', t: 'خطة دعم أكاديمي (علاجية)', who: 'المعلم', steps: [
    'تحديد المهارات الأساسية الضعيفة من نتائج التقييمات.',
    'أنشطة علاجية قصيرة ومتدرجة (10 دقائق) مرتين أسبوعياً.',
    'تقييم تكويني بعد أسبوعين لقياس التحسن.',
    'مشاركة ولي الأمر بأنشطة منزلية داعمة.'] },
  engage: { i: '🙋', t: 'خطة رفع المشاركة والدافعية', who: 'المعلم', steps: [
    'أسئلة موجّهة يسهل النجاح فيها لبناء الثقة.',
    'العمل في مجموعات صغيرة بدور محدد للطالب.',
    'أهداف أسبوعية قصيرة مع مكافأة عند تحقيقها.'] },
  excel: { i: '🌟', t: 'خطة تعزيز وإثراء', who: 'المعلم', steps: [
    'شهادة تقدير ورسالة شكر لولي الأمر.',
    'تكليفه بدور قيادي أو مساعدة زملائه (قائد مجموعة).',
    'أنشطة إثرائية أو تحديات إضافية تناسب مستواه.'] }
};
const PG_CODE_PLAN = { B07: 'talk', B08: 'talk', B01: 'talk', B10: 'aggression', B11: 'aggression', B13: 'aggression',
  B09: 'compliance', B12: 'compliance', B04: 'compliance', B15: 'compliance', B02: 'compliance', B14: 'devices', B03: 'sleep',
  A01: 'homework', A02: 'homework', A06: 'homework', A03: 'academic', A07: 'academic', A04: 'engage', A05: 'engage', A08: 'engage' };

function pgPlans(a, cls, s) {
  const plans = [];
  const add = (key, why, prio) => { if (!plans.some(p => p.key === key)) plans.push({ key, why, prio }); else { const p = plans.find(p => p.key === key); p.why += ' · ' + why; p.prio = Math.max(p.prio, prio); } };
  const absPct = a.tot.sessions ? a.tot.absent / a.tot.sessions * 100 : 0;
  const attRow = a.rows[0];
  if (absPct >= 10 || attRow.dir === 'down') add('absence', `نسبة الغياب ${Math.round(absPct)}%${attRow.dir === 'down' ? ' ومتراجعة مؤخراً' : ''}`, absPct >= 15 ? 5 : 3);
  if (a.tot.late >= 3 || a.rows[1].dir === 'down') add('late', `تأخر ${a.tot.late} مرة`, 2);
  Object.entries(a.tot.codes).sort((x, y) => y[1] - x[1]).forEach(([c, n]) => {
    const key = PG_CODE_PLAN[c];
    if (!key) return;
    const recent = a.recentCodes[c] || 0;
    if (n >= 2 || recent >= 1 || key === 'aggression') {
      const label = (typeof MARSAD_NOTES !== 'undefined' && (MARSAD_NOTES.find(x => x.code === c) || {}).text) || c;
      add(key, `«${label}» ${n} مرة${recent ? ` (منها ${recent} في آخر ${PG_RECENT_WEEKS} أسابيع)` : ''}`, key === 'aggression' ? 5 : 3);
    }
  });
  const lowScores = a.scores.filter(x => x.pct < 50);
  const assessRow = a.rows.find(r => r.name === 'نتائج التقييمات');
  if (lowScores.length || (assessRow && assessRow.dir === 'down')) add('academic', lowScores.length ? `${lowScores.length} تقييم دون 50%` : 'تراجع في نتائج التقييمات', 4);
  const partRow = a.rows[3];
  if (partRow.dir === 'down' || (a.tot.part === 0 && a.tot.sessions >= 6)) add('engage', partRow.dir === 'down' ? 'تراجع في المشاركة' : 'لا توجد مشاركات مسجّلة', 2);
  if (!plans.length || (a.score >= 2 && absPct < 10 && a.tot.neg <= 1)) add('excel', a.score >= 2 ? 'تحسّن واضح في المؤشرات' : 'أداء منتظم دون مؤشرات مقلقة', 1);
  return plans.sort((x, y) => y.prio - x.prio).slice(0, 5);
}

/* ---------- العرض ---------- */
function pgFmt(v, unit) { return v === null ? '—' : (Math.round(v * 10) / 10) + unit; }
function pgChartSVG(a, cls) {
  const avg = pgClassWeeklyAvg(cls);
  const keys = a.keys.filter(k => k >= a.logFrom).slice(-10);
  if (keys.length < 2) return '';
  const vals = keys.map(k => a.W[k].pts), cav = keys.map(k => avg[k] || 0);
  const max = Math.max(1, ...vals, ...cav), Wd = 520, H = 140, pad = 24, step = (Wd - pad * 2) / (keys.length - 1);
  const pts = arr => arr.map((v, i) => `${pad + i * step},${H - pad - (v / max) * (H - pad * 2)}`).join(' ');
  return `<svg viewBox="0 0 ${Wd} ${H}" style="width:100%;max-width:560px;height:auto;direction:ltr">
    <polyline points="${pts(cav)}" fill="none" stroke="rgba(160,160,200,.6)" stroke-width="2" stroke-dasharray="5 4"/>
    <polyline points="${pts(vals)}" fill="none" stroke="#f7c948" stroke-width="3"/>
    ${vals.map((v, i) => `<circle cx="${pad + i * step}" cy="${H - pad - (v / max) * (H - pad * 2)}" r="4" fill="#f7c948"><title>${pgWeekLabel(keys[i])}: ${v}</title></circle>`).join('')}
    ${keys.map((k, i) => `<text x="${pad + i * step}" y="${H - 6}" font-size="9" fill="#8b7fb8" text-anchor="middle">${k[0] === 'w' ? 'أ' + parseInt(k.slice(1), 10) : k.slice(8)}</text>`).join('')}
  </svg><div style="font-size:11px;color:var(--text-muted)"><span style="color:#f7c948">━</span> نقاط الطالب أسبوعياً &nbsp; <span>┅</span> متوسط الصف</div>`;
}

function renderStudentProgress(cls, s) {
  const box = document.getElementById('report-progress-box');
  if (!box || !cls || !s) return;
  const a = pgAnalyze(cls, s);
  const plans = pgPlans(a, cls, s);
  const arrow = d => d === 'up' ? '<span style="color:var(--present);font-weight:900">▲ تحسّن</span>'
    : d === 'down' ? '<span style="color:var(--absent);font-weight:900">▼ تراجع</span>'
    : d === 'same' ? '<span style="color:var(--text-muted)">= ثابت</span>' : '<span style="color:var(--text-muted)">—</span>';
  box.innerHTML = `
    <div style="background:var(--surface2);border-radius:12px;padding:16px;margin-bottom:14px;border:1px solid rgba(78,205,196,.25)" id="pg-print-area">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <div style="font-size:14px;font-weight:800;color:var(--present)">📈 تطوّر الطالب</div>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-weight:900;color:${a.verdict.c};font-size:15px">${a.verdict.i} ${a.verdict.t}</span>
          <button class="btn btn-ghost btn-sm" onclick="printStudentProgress()">🖨️ طباعة</button>
        </div>
      </div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:8px">المقارنة: آخر ${a.recentK.length} أسابيع (${a.recentK.map(pgWeekLabel).join('، ') || '—'}) مقابل الأسابيع السابقة.</div>
      ${pgChartSVG(a, cls)}
      <div style="overflow-x:auto;margin-top:10px"><table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <tr style="color:var(--text-muted)"><th style="text-align:right;padding:5px">المؤشر</th><th>السابق</th><th>آخر ${PG_RECENT_WEEKS} أسابيع</th><th>الاتجاه</th></tr>
        ${a.rows.map(r => `<tr style="border-top:1px solid var(--border-color)"><td style="padding:6px">${r.name}</td><td style="text-align:center">${pgFmt(r.prev, r.unit)}</td><td style="text-align:center;font-weight:800">${pgFmt(r.cur, r.unit)}</td><td style="text-align:center">${arrow(r.dir)}</td></tr>`).join('')}
      </table></div>
      <div style="font-size:14px;font-weight:800;color:var(--accent);margin:16px 0 8px">🧭 خطط مقترحة</div>
      ${plans.map(p => { const P = PG_PLANS[p.key]; return `
        <div style="border:1px solid var(--border-color);border-radius:10px;padding:10px 12px;margin-bottom:8px">
          <div style="font-weight:800">${P.i} ${P.t}</div>
          <div style="font-size:12px;color:var(--text-muted);margin:3px 0 6px">السبب: ${p.why}</div>
          <ol style="margin:0;padding-right:18px;font-size:12.5px;line-height:1.9">${P.steps.map(x => `<li>${x}</li>`).join('')}</ol>
          <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px">👥 ${P.who} · ⏱️ المتابعة بعد أسبوعين</div>
        </div>`; }).join('')}
      <div style="font-size:11px;color:var(--text-muted)">الخطط مقترحة تلقائياً من بيانات المعلم في هذه المادة، ويمكن تعديلها حسب تقدير المعلم.</div>
    </div>`;
}

function printStudentProgress() {
  const cls = state.classes.find(c => c.id === reportActiveClass);
  const s = cls?.students.find(st => st.id === reportActiveStudent);
  const area = document.getElementById('pg-print-area');
  if (!s || !area) return;
  const si = getSchoolInfo();
  const w = window.open('', '_blank');
  if (!w) return toast('اسمح بالنوافذ المنبثقة للطباعة', '⚠️');
  w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تقرير تطوّر ${s.name}</title>
    <style>body{font-family:Tajawal,Tahoma,sans-serif;padding:24px;color:#111;--text-muted:#555;--border-color:#ccc;--present:#0d9488;--absent:#dc2626;--accent:#b45309;--surface2:#fff}
    button{display:none}table th,table td{border-bottom:1px solid #ddd}</style></head><body>
    <h2 style="margin:0">تقرير تطوّر الطالب: ${s.name}</h2>
    <div style="color:#555;margin:4px 0 14px">${si.schoolName || ''} — الصف ${cls.name} — ${si.subject || ''} — المعلم: ${si.teacher || ''} — ${new Date().toLocaleDateString('ar-EG', { numberingSystem: 'latn' })}</div>
    ${area.outerHTML}<script>setTimeout(()=>print(),400)<\/script></body></html>`);
  w.document.close();
}

/* ===== قوائم النجوم (نجوم اليوم / الأسبوع / الفصل) — من صفحة المتصدرين ===== */
function openStarsLists() {
  const si = getSchoolInfo();
  STARS.open({
    getStudents: () => state.classes.flatMap(c => c.students.map(s => ({
      name: s.name, sid: s.sid || '', cls: c.name, total: s.points,
      log: (s.pointsLog || []).map(e => ({ date: e.date, pts: e.pts || 0 }))
    }))),
    openFn: openModal, closeFn: closeModalForce, today: _today(),
    allLabel: 'الأوائل في كل صفوفي', school: si.schoolName, extra: [si.subject, si.teacher].filter(Boolean).join(' — ')
  });
}
