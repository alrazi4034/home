/* 08-sessions.js — تبويب «🗓️ الحصص والإدخالات»: لكل معلم جدوله مع إدخالات الحضور والمشاركات والملاحظات لكل حصة
   (المعلم بلا جدول: عدد إدخالات الحضور لكل صف مع المشاركات والملاحظات) — يستخدم shared/teacher-sessions.js */
let SES_ROWS = [], SES_WEEK = null, SES_KEY = null;
function sesTeacherData(key) {
  const f = (MODEL.files.teachers || []).filter(x => x.key === key).sort((a, b) => (b.modified || 0) - (a.modified || 0))[0];
  return f ? f.raw : null;
}
function sesTT(t) { return t && t.hasTimetable && t.timetable && Object.keys(t.timetable).length ? t.timetable : null; }
function computeSessions(from, to, clsFilter) {
  const H = MODEL.central.holidays || [];
  const out = [];
  MODEL.teachers.forEach(t => {
    const raw = sesTeacherData(t.key);
    let tt = sesTT(t);
    if (!raw && !tt) return;
    if (clsFilter && tt) { const f = {}; Object.entries(tt).forEach(([wd, o]) => { Object.entries(o).forEach(([p, c]) => { if (c === clsFilter) (f[wd] = f[wd] || {})[p] = c; }); }); tt = f; }
    const data = raw ? { classes: (raw.classes || []).filter(c => !clsFilter || c.name === clsFilter) } : { classes: [] };
    const r = TS.compute(data, tt, from, to, H);
    out.push({ t, r, file: !!raw, pct: r.tot.scheduled ? (r.tot.scheduled - r.tot.missing) / r.tot.scheduled : null });
  });
  return out.sort((a, b) => (a.pct == null) - (b.pct == null) || (a.pct || 0) - (b.pct || 0) || a.t.name.localeCompare(b.t.name, 'ar'));
}
function renderSessions(from, to, cls) {
  const box = document.getElementById('page-sessions'); if (!box) return;
  SES_ROWS = computeSessions(from, to, cls);
  const T = SES_ROWS.reduce((a, x) => ({ sch: a.sch + x.r.tot.scheduled, miss: a.miss + x.r.tot.missing, ent: a.ent + x.r.tot.entries, part: a.part + x.r.tot.part, notes: a.notes + x.r.tot.pos + x.r.tot.neg }), { sch: 0, miss: 0, ent: 0, part: 0, notes: 0 });
  box.innerHTML = TS.CSS + `
    <div class="kpis">${kpi(SES_ROWS.length, 'معلم')}${kpi(T.sch, 'حصة مطلوبة')}${kpi(T.sch - T.miss, 'أُدخل حضورها', 'ok')}${kpi(T.miss, 'باقية بدون إدخال', T.miss ? 'bad' : '')}${kpi(T.ent, 'إدخال حضور')}${kpi(T.part, '✋ مشاركة')}${kpi(T.notes, '📝 ملاحظة')}</div>
    <div class="card"><h3>🗓️ الحصص والإدخالات لكل معلم <span class="muted" style="font-size:12px">(${from} → ${to}${cls ? ' — ' + esc(cls) : ''}) — اضغط اسم المعلم لعرض جدوله أسبوعياً</span></h3>
    ${sortableTable('sesT', [{ t: 'المعلم' }, { t: 'المادة' }, { t: 'ملف نجوم مدرستي' }, { t: 'الحصص المطلوبة', num: 1 }, { t: 'أُدخلت', num: 1 }, { t: 'باقية', num: 1 }, { t: 'نسبة الإدخال' }, { t: 'إدخالات الحضور', num: 1 }, { t: '✋ مشاركات', num: 1 }, { t: '🌟 إيجابية', num: 1 }, { t: '⚠️ سلبية', num: 1 }],
      SES_ROWS.map((x, i) => `<tr><td><span class="link" onclick="showTeacherSessions(${i})"><b>${esc(x.t.name)}</b></span></td><td>${esc((x.t.subjects || []).join('، '))}</td><td>${x.file ? '✅' : '<span class="muted">—</span>'}</td>
        <td class="num">${x.r.hasTT ? x.r.tot.scheduled : '<span class="muted">لا جدول</span>'}</td><td class="num">${x.r.hasTT ? x.r.tot.scheduled - x.r.tot.missing : '—'}</td>
        <td class="num"><b style="color:${x.r.tot.missing ? '#ff6b6b' : 'inherit'}">${x.r.hasTT ? x.r.tot.missing : '—'}</b></td>
        <td data-v="${x.pct == null ? -1 : x.pct}">${x.pct == null ? '—' : bar(x.pct, pctClass(x.pct)) + ' ' + fmtPct(x.pct)}</td>
        <td class="num">${x.r.tot.entries}</td><td class="num">${x.r.tot.part}</td><td class="num">${x.r.tot.pos}</td><td class="num">${x.r.tot.neg}</td></tr>`))}
    </div>`;
}
function showTeacherSessions(i) {
  const x = SES_ROWS[i]; if (!x) return;
  SES_KEY = x.t.key;
  SES_WEEK = TS.weekStart(LAST.to && LAST.to < TS.today() ? LAST.to : TS.today());
  sesModal();
}
function sesShift(n) { SES_WEEK = TS.addDays(SES_WEEK, 7 * n); sesModal(); }
function sesModal() {
  const x = SES_ROWS.find(r => r.t.key === SES_KEY); if (!x) return;
  const raw = sesTeacherData(x.t.key) || { classes: [] };
  const wr = TS.compute(raw, sesTT(x.t), SES_WEEK, TS.addDays(SES_WEEK, 4), MODEL.central.holidays || []);
  const f = d => d.slice(8) + '/' + d.slice(5, 7);
  openModal(TS.CSS + `<h2>🗓️ ${esc(x.t.name)} <span class="muted" style="font-size:13px">${esc((x.t.subjects || []).join('، '))}</span></h2>
    ${x.file ? '' : '<div class="muted">⚠️ لا يوجد ملف نجوم مدرستي لهذا المعلم — تظهر حصص الجدول فقط.</div>'}
    <div class="row" style="align-items:center;gap:8px;margin:6px 0">
      <button class="btn sm" onclick="sesShift(-1)">▶ السابق</button><b>الأسبوع ${f(SES_WEEK)} — ${f(TS.addDays(SES_WEEK, 4))}</b><button class="btn sm" onclick="sesShift(1)">التالي ◀</button>
    </div>
    ${TS.kpis(wr)}
    ${TS.gridHTML(wr)}
    <h3 style="margin-top:12px">ملخص الصفوف — الفترة المختارة (${LAST.from} → ${LAST.to})</h3>
    ${TS.tableHTML(x.r)}
    <div class="actions"><button class="btn" onclick="closeModal()">إغلاق</button></div>`);
}
