/* shared/teacher-sessions.js — حصص المعلم وإدخالاته (مشترك بين نجوم مدرستي ولوحة التحكم)
   المدخل: بيانات ملف نجوم مدرستي (classes بما فيها _savedPeriods/_savedDates/_dailyPart/behaviorNotes)
           + جدول المعلم {يوم الأسبوع (1=الاثنين … 5=الجمعة): {رقم الحصة: "8/2"}} إن وُجد + الإجازات.
   المخرج: لكل يوم/حصة: الشعبة، هل أُدخل الحضور، عدد المشاركات، عدد الملاحظات (إيجابية/سلبية). */
const TS = (() => {
  const DAY = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const wdOf = s => new Date(s + 'T12:00:00').getDay();
  const today = () => iso(new Date());
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normCls = c => String(c || '').replace(/\s+/g, '');
  function noteISO(n) {
    if (n.isoDate) return String(n.isoDate).slice(0, 10);
    const s = String(n.date || '');
    let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return '';
  }
  // بداية الأسبوع الدراسي (الاثنين)
  function weekStart(s) { const wd = wdOf(s); return addDays(s, wd === 0 ? -6 : 1 - wd); }
  function holidayOf(d, H) { return (H || []).find(h => h.from <= d && d <= (h.to || h.from)) || null; }

  /* data: ملف المعلم؛ tt: الجدول أو null؛ H: الإجازات */
  function compute(data, tt, from, to, H) {
    const classes = (data && data.classes) || [];
    const hasTT = !!(tt && Object.keys(tt).some(k => tt[k] && Object.keys(tt[k]).length));
    const byCls = {};
    classes.forEach(c => {
      const daily = {};       // date -> {part, pos, neg}
      (c.students || []).forEach(s => {
        // المشاركات: المحفوظة مع الحصة (pointsLog «participation») + غير المحفوظة بعد (_dailyPart)
        (s.pointsLog || []).forEach(e => { if (e.type === 'participation' && e.date >= from && e.date <= to) (daily[e.date] = daily[e.date] || { part: 0, pos: 0, neg: 0 }).part += (+e.pts || 0); });
        Object.entries(s._dailyPart || {}).forEach(([d, n]) => { if (d >= from && d <= to) (daily[d] = daily[d] || { part: 0, pos: 0, neg: 0 }).part += (+n || 0); });
        (s.behaviorNotes || []).forEach(n => { const d = noteISO(n); if (d && d >= from && d <= to) { const x = (daily[d] = daily[d] || { part: 0, pos: 0, neg: 0 }); if (n.type === 'positive') x.pos++; else x.neg++; } });
      });
      byCls[normCls(c.name)] = { name: c.name, sp: c._savedPeriods || {}, sd: c._savedDates || [], daily };
    });
    const days = [], cells = [];
    let maxP = 0;
    if (hasTT) Object.values(tt).forEach(o => Object.keys(o || {}).forEach(p => { maxP = Math.max(maxP, +p); }));
    Object.values(byCls).forEach(c => Object.entries(c.sp).forEach(([d, ps]) => { if (d >= from && d <= to) (ps || []).forEach(p => { maxP = Math.max(maxP, +p); }); }));
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const wd = wdOf(d);
      if (wd === 0 || wd === 6) continue;
      const hol = holidayOf(d, H);
      days.push({ d, wd, hol });
      const used = new Set();
      const shared = {};       // أول حصة لكل شعبة في اليوم تحمل أرقام اليوم
      const push = (p, clsName, scheduled) => {
        const c = byCls[normCls(clsName)] || { name: clsName, sp: {}, sd: [], daily: {} };
        const saved = (c.sp[d] || []).map(Number).includes(+p);
        const firstKey = normCls(clsName);
        const carry = !shared[firstKey];
        if (carry) shared[firstKey] = p;
        const x = c.daily[d] || { part: 0, pos: 0, neg: 0 };
        cells.push({ d, p: +p, cls: c.name || clsName, scheduled, saved, hol: !!hol, future: d > today(),
          part: carry ? x.part : null, pos: carry ? x.pos : null, neg: carry ? x.neg : null, withP: carry ? null : shared[firstKey] });
        used.add(firstKey + '|' + p);
      };
      if (hasTT && tt[wd]) Object.entries(tt[wd]).sort((a, b) => a[0] - b[0]).forEach(([p, cl]) => push(p, cl, true));
      // حصص محفوظة خارج الجدول (تبديل/احتياط) أو بدون جدول
      Object.values(byCls).forEach(c => (c.sp[d] || []).forEach(p => { if (!used.has(normCls(c.name) + '|' + p)) push(p, c.name, false); }));
      // يوم محفوظ بدون أرقام حصص (ملفات قديمة)
      Object.values(byCls).forEach(c => { if (c.sd.includes(d) && !(c.sp[d] || []).length && ![...used].some(k => k.startsWith(normCls(c.name) + '|'))) cells.push({ d, p: 0, cls: c.name, scheduled: false, saved: true, hol: !!hol, future: false, part: (c.daily[d] || {}).part || 0, pos: (c.daily[d] || {}).pos || 0, neg: (c.daily[d] || {}).neg || 0 }); });
    }
    // ملخص لكل شعبة
    const sum = {};
    Object.values(byCls).forEach(c => { sum[c.name] = { cls: c.name, entries: 0, dates: new Set(), scheduled: 0, missing: 0, part: 0, pos: 0, neg: 0 }; });
    cells.forEach(x => {
      const s = sum[x.cls] = sum[x.cls] || { cls: x.cls, entries: 0, dates: new Set(), scheduled: 0, missing: 0, part: 0, pos: 0, neg: 0 };
      if (x.saved) { s.entries++; s.dates.add(x.d); }
      if (x.scheduled && !x.hol && !x.future) { s.scheduled++; if (!x.saved) s.missing++; }
    });
    Object.values(byCls).forEach(c => Object.entries(c.daily).forEach(([d, x]) => { const s = sum[c.name]; s.part += x.part; s.pos += x.pos; s.neg += x.neg; }));
    const rows = Object.values(sum).filter(s => s.entries || s.scheduled || s.part || s.pos || s.neg)
      .sort((a, b) => String(a.cls).localeCompare(String(b.cls), 'ar', { numeric: true }));
    const tot = rows.reduce((t, s) => ({ entries: t.entries + s.entries, scheduled: t.scheduled + s.scheduled, missing: t.missing + s.missing, part: t.part + s.part, pos: t.pos + s.pos, neg: t.neg + s.neg }),
      { entries: 0, scheduled: 0, missing: 0, part: 0, pos: 0, neg: 0 });
    return { hasTT, from, to, days, cells, maxP: Math.max(maxP, hasTT ? 0 : 0), rows, tot };
  }

  const CSS = `<style>
    .ts-wrap{overflow:auto}.ts-g{border-collapse:separate;border-spacing:4px;min-width:100%;font-size:12px}
    .ts-g th{font-weight:800;padding:4px 6px;white-space:nowrap;opacity:.85}
    .ts-c{border-radius:10px;padding:5px 6px;min-width:96px;text-align:center;vertical-align:top;border:1.5px solid rgba(128,128,128,.25)}
    .ts-c b{display:block;font-size:13.5px}.ts-c .m{font-size:11px;opacity:.9;margin-top:2px;white-space:nowrap}
    .ts-ok{background:rgba(46,204,113,.16);border-color:rgba(46,204,113,.6)}
    .ts-miss{background:rgba(255,107,107,.15);border-color:rgba(255,107,107,.65)}
    .ts-fut{background:rgba(128,128,128,.08);border-style:dashed}
    .ts-hol{background:rgba(247,201,72,.12);border-color:rgba(247,201,72,.5)}
    .ts-extra{background:rgba(108,92,231,.14);border-color:rgba(108,92,231,.55)}
    .ts-empty{border:none}
    .ts-t{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:6px}.ts-t th,.ts-t td{padding:5px 8px;border-bottom:1px solid rgba(128,128,128,.22);text-align:center}.ts-t td.n{text-align:right;font-weight:800}
    .ts-k{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px}.ts-k span{border-radius:10px;padding:6px 12px;background:rgba(128,128,128,.12);font-size:12px}.ts-k b{font-size:16px;margin-inline-end:4px}
    .ts-leg{font-size:11px;opacity:.8;display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}
    .ts-t tr.ts-tot td{font-weight:900;border-top:2px solid rgba(128,128,128,.5);background:rgba(128,128,128,.08)}
    .ts-g.ts-cmp{border-spacing:3px}.ts-g.ts-cmp th{padding:1px 4px;font-size:11px}
    .ts-cmp .ts-c{padding:2px 5px;min-width:84px;border-radius:7px;line-height:1.25}
    .ts-cmp .ts-c b{display:inline;font-size:12.5px}.ts-cmp .ts-c .m{display:inline;margin:0 0 0 4px;font-size:10.5px}
    .ts-click{cursor:pointer;transition:transform .1s}.ts-click:hover{transform:scale(1.05);box-shadow:0 0 0 2px rgba(247,201,72,.8)}
  </style>`;

  function kpis(r) {
    const t = r.tot;
    return `<div class="ts-k">
      ${r.hasTT ? `<span><b>${t.scheduled}</b>حصة في الجدول (حتى اليوم)</span><span><b style="color:#2ecc71">${t.scheduled - t.missing}</b>أُدخل حضورها</span><span><b style="color:#ff6b6b">${t.missing}</b>بدون إدخال</span>` : ''}
      <span><b>${t.entries}</b>إدخال حضور</span><span><b>${t.part}</b>✋ مشاركة</span><span><b>${t.pos + t.neg}</b>📝 ملاحظة <small>(🌟${t.pos} · ⚠️${t.neg})</small></span></div>`;
  }
  // شبكة أسبوع واحد (الأيام أعمدة × الحصص صفوف)
  function gridHTML(r, opts) {
    opts = opts || {};
    if (!r.days.length) return '';
    const ps = [...new Set(r.cells.map(c => c.p))].filter(p => p > 0).sort((a, b) => a - b);
    const maxP = Math.max(r.hasTT ? 8 : 0, ...ps);
    if (!maxP && !r.cells.length) return '<div style="opacity:.7;padding:8px">لا توجد حصص في هذه الفترة.</div>';
    const cell = (d, p) => {
      const xs = r.cells.filter(c => c.d === d.d && c.p === p);
      if (!xs.length) return d.hol ? '<td class="ts-c ts-hol">🏖️</td>' : '<td class="ts-c ts-empty"></td>';
      return '<td>' + xs.map(x => {
        const k = x.hol ? 'ts-hol' : x.saved ? (x.scheduled ? 'ts-ok' : 'ts-extra') : x.future ? 'ts-fut' : 'ts-miss';
        const st = x.hol ? '🏖️' : x.saved ? '✅' : x.future ? '⏳' : '❌';
        const m = x.part === null ? `<div class="m" title="أرقام اليوم لهذه الشعبة في الحصة ${x.withP}">↑ مع ح${x.withP}</div>`
          : `<div class="m">✋${x.part} · 📝${x.pos + x.neg}</div>`;
        const click = opts.click && !x.future ? ` ts-click" onclick="${opts.click}('${x.d}','${esc(x.cls)}',${x.p})` : '';
        return `<div class="ts-c ${k}${click}" title="${x.scheduled ? 'في الجدول' : 'خارج الجدول'}${opts.click && !x.future ? ' — اضغط للانتقال إلى الحصة' : ''}">${st} <b>${esc(x.cls)}</b>${m}</div>`;
      }).join('') + '</td>';
    };
    let h = `<div class="ts-wrap"><table class="ts-g${opts.compact ? ' ts-cmp' : ''}"><tr><th>الحصة</th>${r.days.map(d => `<th>${DAY[d.wd]}${opts.compact ? ' ' : '<br>'}<small>${d.d.slice(8)}/${d.d.slice(5, 7)}</small>${d.hol ? ' 🏖️' : ''}</th>`).join('')}</tr>`;
    for (let p = 1; p <= maxP; p++) h += `<tr><th>${p}</th>${r.days.map(d => cell(d, p)).join('')}</tr>`;
    const noP = r.cells.filter(c => c.p === 0);
    if (noP.length) h += `<tr><th title="حصص محفوظة بدون رقم حصة">؟</th>${r.days.map(d => cell(d, 0)).join('')}</tr>`;
    h += '</table></div>';
    h += `<div class="ts-leg"><span>✅ أُدخل الحضور</span><span>❌ في الجدول ولم يُدخل</span><span>⏳ لم يحن بعد</span><span style="color:#8e7cff">✅ بنفسجي: خارج الجدول (تبديل/احتياط)</span><span>🏖️ إجازة</span><span>✋ مشاركات · 📝 ملاحظات (لليوم)</span></div>`;
    return h;
  }
  function tableHTML(r) {
    if (!r.rows.length) return '<div style="opacity:.7;padding:8px">لا توجد إدخالات في هذه الفترة.</div>';
    return `<table class="ts-t"><tr><th style="text-align:right">الشعبة</th><th>إدخالات الحضور</th><th>أيام</th>${r.hasTT ? '<th>حصص الجدول</th><th>بدون إدخال</th>' : ''}<th>✋ المشاركات</th><th>🌟 إيجابية</th><th>⚠️ سلبية</th></tr>
      ${r.rows.map(s => `<tr><td class="n">${esc(s.cls)}</td><td>${s.entries}</td><td>${s.dates.size}</td>${r.hasTT ? `<td>${s.scheduled}</td><td style="color:${s.missing ? '#ff6b6b' : 'inherit'};font-weight:${s.missing ? 800 : 400}">${s.missing}</td>` : ''}<td>${s.part}</td><td>${s.pos}</td><td>${s.neg}</td></tr>`).join('')}
      ${(() => { const t = r.tot, days = new Set(); r.rows.forEach(s => s.dates.forEach(d => days.add(d)));
        return `<tr class="ts-tot"><td class="n">المجموع</td><td>${t.entries}</td><td>${days.size}</td>${r.hasTT ? `<td>${t.scheduled}</td><td style="color:${t.missing ? '#ff6b6b' : 'inherit'}">${t.missing}</td>` : ''}<td>${t.part}</td><td>${t.pos}</td><td>${t.neg}</td></tr>`; })()}
    </table>`;
  }
  return { compute, gridHTML, tableHTML, kpis, CSS, weekStart, addDays, today, iso, DAY, noteISO, esc };
})();
