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

  /* data: ملف المعلم؛ tt: الجدول أو null؛ H: الإجازات
     الفكرة: الشبكة تعرض الحصص التي أُدخلت فقط في أماكنها الفعلية (مهما تغيّر الجدول لاحقاً).
     الجدول يُستخدم فقط لمعرفة «كم حصة لكل شعبة في الأسبوع» لهذا المعلم ⇐ الباقي = المطلوب − المُدخل (يظهر في شريط تحت الشبكة).
     حصص الاحتياط (شعب خارج جدول المعلم) والحصص الزائدة لا تؤثر على العدّ. */
  const toISO = v => {
    const s = String(v || ''); let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
  };
  const cleanName = n => String(n || '').replace(/\s*[\(\[]\s*[A-Za-z0-9\-]+\s*[\)\]]\s*$/, '').trim();
  function compute(data, tt, from, to, H) {
    const classes = (data && data.classes) || [];
    const hasTT = !!(tt && Object.keys(tt).some(k => tt[k] && Object.keys(tt[k]).length));
    const now = today();
    const byCls = {};
    classes.forEach(c => {
      const daily = {}, abs = {}, late = {};
      (c.students || []).forEach(s => {
        (s.pointsLog || []).forEach(e => { if (e.type === 'participation' && e.date >= from && e.date <= to) (daily[e.date] = daily[e.date] || { part: 0, pos: 0, neg: 0 }).part += (+e.pts || 0); });
        Object.entries(s._dailyPart || {}).forEach(([d, n]) => { if (d >= from && d <= to) (daily[d] = daily[d] || { part: 0, pos: 0, neg: 0 }).part += (+n || 0); });
        (s.behaviorNotes || []).forEach(n => { const d = noteISO(n); if (d && d >= from && d <= to) { const x = (daily[d] = daily[d] || { part: 0, pos: 0, neg: 0 }); if (n.type === 'positive') x.pos++; else x.neg++; } });
        (s.absenceDates || []).forEach(v => { const d = toISO(v); if (d >= from && d <= to) (abs[d] = abs[d] || []).push(cleanName(s.name)); });
        (s.lateDates || []).forEach(v => { const d = toISO(v); if (d >= from && d <= to) (late[d] = late[d] || []).push(cleanName(s.name)); });
      });
      byCls[normCls(c.name)] = { name: c.name, sp: c._savedPeriods || {}, sd: (c._savedDates || []).map(toISO), daily, abs, late };
    });
    // عدد حصص كل شعبة في كل يوم من أيام الأسبوع حسب جدول المعلم
    const ttCount = {};            // normCls -> {wd: n}
    const ttName = {};
    if (hasTT) Object.entries(tt).forEach(([wd, o]) => Object.values(o || {}).forEach(cl => { if (!cl) return; const k = normCls(cl); ttName[k] = ttName[k] || cl; (ttCount[k] = ttCount[k] || {})[wd] = ((ttCount[k] || {})[wd] || 0) + 1; }));
    const days = [], cells = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const wd = wdOf(d);
      if (wd === 0 || wd === 6) continue;
      const hol = holidayOf(d, H);
      days.push({ d, wd, hol, future: d > now });
      const shared = {};
      Object.values(byCls).forEach(c => {
        const k = normCls(c.name);
        let ps = (c.sp[d] || []).map(Number);
        if (!ps.length && c.sd.includes(d)) ps = [0];          // ملفات قديمة: يوم محفوظ بدون رقم حصة
        ps.sort((a, b) => a - b).forEach(p => {
          const carry = !shared[k]; if (carry) shared[k] = p || '؟';
          const x = c.daily[d] || { part: 0, pos: 0, neg: 0 };
          cells.push({ d, p, cls: c.name, saved: true, extra: hasTT && !ttCount[k], hol: !!hol,
            absent: c.abs[d] || [], late: c.late[d] || [],
            part: carry ? x.part : null, pos: carry ? x.pos : null, neg: carry ? x.neg : null, withP: carry ? null : shared[k] });
        });
      });
    }
    // الحصص الباقية لكل أسبوع × شعبة (المطلوب حسب الجدول في أيام الدوام حتى اليوم − المُدخل، بحد أقصى المطلوب)
    const weeks = [];
    if (hasTT) {
      const wmap = {};
      days.forEach(x => { const w = weekStart(x.d); (wmap[w] = wmap[w] || []).push(x); });
      Object.entries(wmap).sort().forEach(([w, ds]) => {
        const list = [];
        Object.keys(ttCount).forEach(k => {
          const req = ds.filter(x => !x.hol && !x.future).reduce((n, x) => n + (ttCount[k][x.wd] || 0), 0);
          const c = byCls[k];
          const done = c ? cells.filter(x => normCls(x.cls) === k && weekStart(x.d) === w).length : 0;
          if (!req && !done) return;
          list.push({ cls: (c && c.name) || ttName[k], req, done, left: Math.max(0, req - done) });
        });
        list.sort((a, b) => String(a.cls).localeCompare(String(b.cls), 'ar', { numeric: true }));
        weeks.push({ w, list, partial: ds.some(x => x.hol) || ds.some(x => x.future) });
      });
    }
    // ملخص لكل شعبة
    const sum = {};
    const S = name => sum[name] = sum[name] || { cls: name, entries: 0, dates: new Set(), scheduled: 0, missing: 0, absent: 0, part: 0, pos: 0, neg: 0, extra: false };
    Object.values(byCls).forEach(c => S(c.name));
    Object.keys(ttCount).forEach(k => S((byCls[k] && byCls[k].name) || ttName[k]));
    cells.forEach(x => { const s = S(x.cls); s.entries++; s.dates.add(x.d); if (x.extra) s.extra = true; });
    weeks.forEach(W => W.list.forEach(l => { const s = S(l.cls); s.scheduled += l.req; s.missing += l.left; }));
    Object.values(byCls).forEach(c => {
      const s = sum[c.name];
      Object.values(c.daily).forEach(x => { s.part += x.part; s.pos += x.pos; s.neg += x.neg; });
      Object.entries(c.abs).forEach(([d, l]) => { if (s.dates.has(d)) s.absent += l.length; });
    });
    const rows = Object.values(sum).filter(s => s.entries || s.scheduled || s.part || s.pos || s.neg)
      .sort((a, b) => String(a.cls).localeCompare(String(b.cls), 'ar', { numeric: true }));
    const tot = rows.reduce((t, s) => ({ entries: t.entries + s.entries, scheduled: t.scheduled + s.scheduled, missing: t.missing + s.missing, absent: t.absent + s.absent, part: t.part + s.part, pos: t.pos + s.pos, neg: t.neg + s.neg }),
      { entries: 0, scheduled: 0, missing: 0, absent: 0, part: 0, pos: 0, neg: 0 });
    return { hasTT, from, to, days, cells, weeks, rows, tot };
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
    .ts-c .l1{white-space:nowrap}.ts-c .l1 b{display:inline}.ts-c .l2{font-size:10.5px;white-space:nowrap;margin-top:2px;opacity:.95}
    .ts-cmp .ts-c .l1 b{font-size:12.5px}.ts-cmp .ts-c .m{display:inline;margin:0}
    .ts-ab{display:inline-block;border-radius:6px;padding:0 4px;background:rgba(128,128,128,.15);cursor:pointer;font-weight:700}
    .ts-ab.on{background:rgba(255,107,107,.25);color:#ff6b6b}.ts-ab:hover{outline:1.5px solid rgba(255,107,107,.8)}
    .ts-strip{margin-top:8px;border:1.5px dashed rgba(255,107,107,.55);border-radius:10px;padding:7px 10px;background:rgba(255,107,107,.06)}
    .ts-strip-h{font-weight:800;font-size:12.5px;margin-bottom:5px}.ts-strip-h small{font-weight:400;opacity:.75}
    .ts-strip-r{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:3px 0}
    .ts-left{background:rgba(255,107,107,.15);border:1px solid rgba(255,107,107,.5);border-radius:8px;padding:2px 8px;font-size:12px}
    .ts-done{color:#2ecc71;font-size:12px;font-weight:700}.ts-wk{font-size:11px;opacity:.75;min-width:78px}
    #ts-pop{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:99999;display:flex;align-items:center;justify-content:center}
    .ts-pop-in{background:var(--bg-card,#fff);color:var(--text,#222);border-radius:14px;padding:12px 16px;min-width:260px;max-width:90vw;max-height:80vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.3);direction:rtl;text-align:right}
    .ts-pop-h{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px}.ts-pop-h button{border:none;background:none;font-size:16px;cursor:pointer;color:inherit}
    .ts-pop-s{font-weight:800;margin-top:6px;font-size:13px}.ts-pop-in ol{margin:4px 0;padding-inline-start:22px;font-size:13px}.ts-pop-e{font-size:12.5px;opacity:.8}
    .ts-click{cursor:pointer;transition:transform .1s}.ts-click:hover{transform:scale(1.05);box-shadow:0 0 0 2px rgba(247,201,72,.8)}
  </style>`;

  function kpis(r) {
    const t = r.tot;
    return `<div class="ts-k">
      ${r.hasTT ? `<span><b>${t.scheduled}</b>حصة مطلوبة (حتى اليوم)</span><span><b style="color:#2ecc71">${t.scheduled - t.missing}</b>أُدخل حضورها</span><span><b style="color:#ff6b6b">${t.missing}</b>باقية بدون إدخال</span>` : ''}
      <span><b>${t.entries}</b>إدخال حضور</span><span><b>${t.absent}</b>🚫 غياب</span><span><b>${t.part}</b>✋ مشاركة</span><span><b>${t.pos + t.neg}</b>📝 ملاحظة <small>(🌟${t.pos} · ⚠️${t.neg})</small></span></div>`;
  }
  // نافذة صغيرة بأسماء الغائبين/المتأخرين
  const REG = {}; let regN = 0;
  function showAbs(id, ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    const x = REG[id]; if (!x) return;
    let el = document.getElementById('ts-pop'); if (el) el.remove();
    el = document.createElement('div'); el.id = 'ts-pop';
    el.innerHTML = `<div class="ts-pop-in" onclick="event.stopPropagation()"><div class="ts-pop-h"><b>${esc(x.title)}</b><button onclick="document.getElementById('ts-pop').remove()">✕</button></div>
      <div class="ts-pop-s">🚫 الغائبون (${x.absent.length})</div>${x.absent.length ? '<ol>' + x.absent.map(n => `<li>${esc(n)}</li>`).join('') + '</ol>' : '<div class="ts-pop-e">لا يوجد غياب ✅</div>'}
      ${x.late.length ? `<div class="ts-pop-s">⏰ المتأخرون (${x.late.length})</div><ol>${x.late.map(n => `<li>${esc(n)}</li>`).join('')}</ol>` : ''}</div>`;
    el.onclick = () => el.remove();
    document.body.appendChild(el);
  }
  // شبكة أسبوع: الحصص المُدخلة فقط في أماكنها + شريط الحصص الباقية تحتها
  function gridHTML(r, opts) {
    opts = opts || {};
    if (!r.days.length) return '';
    const ps = [...new Set(r.cells.map(c => c.p))].filter(p => p > 0);
    const maxP = Math.max(r.hasTT ? 8 : 0, ...ps, 0);
    if (!r.cells.length && !r.hasTT) return '<div style="opacity:.7;padding:8px">لا توجد إدخالات في هذه الفترة.</div>';
    const cell = (d, p) => {
      const xs = r.cells.filter(c => c.d === d.d && c.p === p);
      if (!xs.length) return `<td class="ts-c ${d.hol ? 'ts-hol' : 'ts-empty'}">${d.hol && p === 1 ? '🏖️' : ''}</td>`;
      return '<td>' + xs.map(x => {
        const id = 'a' + (++regN); REG[id] = { title: `${x.cls} — ${DAY[wdOf(x.d)]} ${x.d.slice(8)}/${x.d.slice(5, 7)}${x.p ? ' — الحصة ' + x.p : ''}`, absent: x.absent, late: x.late };
        const ab = `<span class="ts-ab${x.absent.length ? ' on' : ''}" onclick="TS.showAbs('${id}',event)" title="اضغط لعرض الأسماء">🚫${x.absent.length}${x.late.length ? ' ⏰' + x.late.length : ''}</span>`;
        const m = x.part === null ? `<span title="مشاركات وملاحظات اليوم مع الحصة ${x.withP}">↑ح${x.withP}</span>` : `✋${x.part} 📝${x.pos + x.neg}`;
        const click = opts.click ? ` ts-click" onclick="${opts.click}('${x.d}','${esc(x.cls)}',${x.p || 1})` : '';
        return `<div class="ts-c ${x.extra ? 'ts-extra' : 'ts-ok'}${click}" title="${x.extra ? 'خارج جدولك (احتياط/تبديل) — لا يؤثر على العدّ' : 'أُدخل الحضور'}${opts.click ? ' — اضغط للانتقال إلى الحصة' : ''}">
          <div class="l1"><b>${esc(x.cls)}</b>${x.extra ? ' 🔄' : ''}</div><div class="l2">${ab} <span class="m">${m}</span></div></div>`;
      }).join('') + '</td>';
    };
    let h = `<div class="ts-wrap"><table class="ts-g${opts.compact ? ' ts-cmp' : ''}"><tr><th>الحصة</th>${r.days.map(d => `<th>${DAY[d.wd]}${opts.compact ? ' ' : '<br>'}<small>${d.d.slice(8)}/${d.d.slice(5, 7)}</small>${d.hol ? ' 🏖️' : ''}</th>`).join('')}</tr>`;
    for (let p = 1; p <= maxP; p++) h += `<tr><th>${p}</th>${r.days.map(d => cell(d, p)).join('')}</tr>`;
    if (r.cells.some(c => c.p === 0)) h += `<tr><th title="حصص محفوظة بدون رقم حصة">؟</th>${r.days.map(d => cell(d, 0)).join('')}</tr>`;
    h += '</table></div>';
    h += stripHTML(r);
    h += `<div class="ts-leg"><span>✅ أخضر: أُدخل الحضور</span><span style="color:#8e7cff">🔄 بنفسجي: خارج جدولك (احتياط/تبديل)</span><span>🚫 الغائبون — اضغط للأسماء</span><span>✋ مشاركات · 📝 ملاحظات (لليوم)</span><span>🏖️ إجازة</span></div>`;
    return h;
  }
  // شريط «حصص لم تُدخل بعد» — وقتها غير معروف، تُعرف من عدد حصص كل شعبة في جدولك
  function stripHTML(r) {
    if (!r.hasTT) return '';
    const W = r.weeks.filter(w => w.list.length);
    if (!W.length) return '';
    const multi = W.length > 1;
    const parts = W.map(w => {
      const left = w.list.filter(l => l.left);
      const f = w.w.slice(8) + '/' + w.w.slice(5, 7);
      const body = left.length ? left.map(l => `<span class="ts-left" title="المطلوب ${l.req} — أُدخل ${Math.min(l.done, l.req)}"><b>${esc(l.cls)}</b> باقي ${l.left} من ${l.req}</span>`).join('')
        : '<span class="ts-done">✅ كل الحصص المطلوبة أُدخلت</span>';
      return `<div class="ts-strip-r">${multi ? `<span class="ts-wk">أسبوع ${f}</span>` : ''}${body}</div>`;
    }).join('');
    return `<div class="ts-strip"><div class="ts-strip-h">⏳ حصص لم يُدخل حضورها بعد <small>(وقتها غير محدد — تُحسب من عدد حصص كل شعبة في جدولك حتى اليوم، بدون أيام الإجازات)</small></div>${parts}</div>`;
  }
  function tableHTML(r) {
    if (!r.rows.length) return '<div style="opacity:.7;padding:8px">لا توجد إدخالات في هذه الفترة.</div>';
    return `<table class="ts-t"><tr><th style="text-align:right">الشعبة</th><th>إدخالات الحضور</th><th>أيام</th>${r.hasTT ? '<th>الحصص المطلوبة</th><th>باقية</th>' : ''}<th>🚫 غياب</th><th>✋ المشاركات</th><th>🌟 إيجابية</th><th>⚠️ سلبية</th></tr>
      ${r.rows.map(s => `<tr><td class="n">${esc(s.cls)}${s.extra && !s.scheduled ? ' <small style="opacity:.7">🔄 احتياط</small>' : ''}</td><td>${s.entries}</td><td>${s.dates.size}</td>${r.hasTT ? `<td>${s.scheduled || '—'}</td><td style="color:${s.missing ? '#ff6b6b' : 'inherit'};font-weight:${s.missing ? 800 : 400}">${s.scheduled ? s.missing : '—'}</td>` : ''}<td>${s.absent}</td><td>${s.part}</td><td>${s.pos}</td><td>${s.neg}</td></tr>`).join('')}
      ${(() => { const t = r.tot, days = new Set(); r.rows.forEach(s => s.dates.forEach(d => days.add(d)));
        return `<tr class="ts-tot"><td class="n">المجموع</td><td>${t.entries}</td><td>${days.size}</td>${r.hasTT ? `<td>${t.scheduled}</td><td style="color:${t.missing ? '#ff6b6b' : 'inherit'}">${t.missing}</td>` : ''}<td>${t.absent}</td><td>${t.part}</td><td>${t.pos}</td><td>${t.neg}</td></tr>`; })()}
    </table>`;
  }
  return { compute, gridHTML, stripHTML, tableHTML, kpis, showAbs, CSS, weekStart, addDays, today, iso, DAY, noteISO, esc };
})();
