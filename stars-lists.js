/* shared/stars-lists.js — قوائم «نجوم اليوم» و«نجوم الأسبوع» و«نجوم الفصل»
   مشترك بين نجوم مدرستي (صفوف المعلم) ولوحة التحكم (كل المدرسة).
   المدخل: طلاب بصيغة { name, sid, cls: '5/1', log: [{date:'YYYY-MM-DD', pts}], total }
   النقاط في اليوم/الأسبوع = مجموع نقاط سجل الطالب في تلك الفترة (حضور + مشاركة + ملاحظات + خصم). */

const STARS = (() => {
  const GRADE_AR = { 1: 'الأول', 2: 'الثاني', 3: 'الثالث', 4: 'الرابع', 5: 'الخامس', 6: 'السادس', 7: 'السابع', 8: 'الثامن', 9: 'التاسع', 10: 'العاشر', 11: 'الحادي عشر', 12: 'الثاني عشر' };
  const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const iso = d => d.toISOString().slice(0, 10);
  const fmt = d => d.slice(8) + '/' + d.slice(5, 7);
  const medal = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : r;

  function range(mode, ref) {
    if (mode === 'day') {
      const wd = new Date(ref + 'T12:00:00Z').getUTCDay();
      return { from: ref, to: ref, title: '⭐ نجوم اليوم', sub: `${DAYS[wd]} ${fmt(ref)}/${ref.slice(0, 4)}` };
    }
    if (mode === 'week') {
      const d = new Date(ref + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));        // الاثنين
      const from = iso(d); d.setUTCDate(d.getUTCDate() + 4);             // الجمعة
      return { from, to: iso(d), title: '🌟 نجوم الأسبوع', sub: `من ${fmt(from)} إلى ${fmt(iso(d))}/${from.slice(0, 4)}` };
    }
    return { from: '', to: '', title: '🏆 نجوم الفصل', sub: 'مجموع النقاط حتى الآن' };
  }

  function latestDate(students, max) {
    let best = '';
    students.forEach(s => (s.log || []).forEach(e => { if (e.date && e.date <= max && e.date > best) best = e.date; }));
    return best || max;
  }

  // scope: 'all' | 'grade' | 'class'
  function compute(students, opt) {
    const r = range(opt.mode, opt.ref);
    const scored = students.map(s => {
      const pts = opt.mode === 'term' ? (s.total != null ? s.total : (s.log || []).reduce((n, e) => n + (e.pts || 0), 0))
        : (s.log || []).reduce((n, e) => n + (e.date >= r.from && e.date <= r.to ? (e.pts || 0) : 0), 0);
      return { name: s.name, sid: s.sid || '', cls: s.cls || '', grade: String(s.cls || '').split('/')[0], pts };
    }).filter(s => s.pts > 0);
    const rank = list => {
      list.sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name, 'ar'));
      let last = null, rk = 0;
      const out = [];
      for (let i = 0; i < list.length; i++) {
        if (list[i].pts !== last) { rk = i + 1; last = list[i].pts; }
        if (rk > opt.top) break;                                  // المتساوون في آخر مركز يدخلون جميعاً
        out.push(Object.assign({ rank: rk }, list[i]));
      }
      return out;
    };
    const groups = [];
    if (opt.scope === 'all') groups.push({ title: opt.allLabel || 'على مستوى المدرسة', rows: rank(scored) });
    else {
      const key = opt.scope === 'grade' ? 'grade' : 'cls';
      const by = {};
      scored.forEach(s => (by[s[key]] = by[s[key]] || []).push(s));
      Object.keys(by).sort((a, b) => a.localeCompare(b, 'ar', { numeric: true })).forEach(k =>
        groups.push({ title: key === 'grade' ? 'الصف ' + (GRADE_AR[k] || k) : 'الشعبة ' + k, rows: rank(by[k]) }));
    }
    return Object.assign({}, r, { groups, mode: opt.mode, scope: opt.scope });
  }

  function html(res) {
    if (!res.groups.some(g => g.rows.length)) return '<div style="opacity:.7;padding:10px">لا توجد نقاط مسجّلة في هذه الفترة.</div>';
    return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px">${res.groups.filter(g => g.rows.length).map(g => `
      <div style="border:1px solid rgba(247,201,72,.35);border-radius:12px;padding:10px 12px">
        <div style="font-weight:900;margin-bottom:6px">${esc(g.title)}</div>
        ${g.rows.map(r => `<div style="display:flex;gap:8px;align-items:center;padding:3px 0;font-size:13px">
          <span style="min-width:24px;text-align:center;font-weight:900">${medal(r.rank)}</span>
          <span style="flex:1">${esc(r.name)} <span style="opacity:.6;font-size:11px">${esc(r.cls)}</span></span>
          <b style="color:#f7c948">${r.pts} ⭐</b></div>`).join('')}
      </div>`).join('')}</div>`;
  }

  function print(res, school, extra) {
    const w = window.open('', '_blank');
    if (!w) { alert('اسمح بالنوافذ المنبثقة للطباعة'); return; }
    w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${esc(res.title)}</title>
      <style>@page{size:A4;margin:14mm}body{font-family:Tajawal,Tahoma,sans-serif;color:#1a1530;margin:0}
      .hd{text-align:center;border-bottom:3px solid #f7c948;padding-bottom:10px;margin-bottom:14px}
      .hd h1{margin:4px 0;font-size:28px}.hd .s{color:#555}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
      .g{border:2px solid #f7c948;border-radius:14px;padding:10px 14px;break-inside:avoid}
      .g h3{margin:0 0 6px;font-size:16px}.r{display:flex;gap:10px;padding:5px 0;border-bottom:1px dashed #ddd;font-size:15px}
      .r:last-child{border:none}.r b{margin-inline-start:auto;color:#b45309}.k{min-width:28px;text-align:center;font-weight:900}.c{color:#777;font-size:12px}</style></head><body>
      <div class="hd"><div class="s">${esc(school || '')}</div><h1>${esc(res.title)}</h1><div class="s">${esc(res.sub)}${extra ? ' — ' + esc(extra) : ''}</div></div>
      <div class="grid">${res.groups.filter(g => g.rows.length).map(g => `<div class="g"><h3>${esc(g.title)}</h3>
        ${g.rows.map(r => `<div class="r"><span class="k">${medal(r.rank)}</span><span>${esc(r.name)} <span class="c">${esc(r.cls)}</span></span><b>${r.pts} ⭐</b></div>`).join('')}</div>`).join('')}</div>
      <script>setTimeout(()=>print(),400)<\/script></body></html>`);
    w.document.close();
  }

  function excel(res, fileName) {
    if (typeof XLSX === 'undefined') { alert('مكتبة Excel غير محمّلة — تحقق من الاتصال بالإنترنت'); return; }
    const rows = [];
    res.groups.forEach(g => g.rows.forEach(r => rows.push({ 'المجموعة': g.title, 'المركز': r.rank, 'الطالب': r.name, 'رقم الطالب': r.sid, 'الشعبة': r.cls, 'النقاط': r.pts })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ '': 'لا توجد نقاط' }]), 'النجوم');
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.writeFile(wb, fileName || 'نجوم.xlsx');
  }

  /* نافذة القوائم: getStudents() ترجع الطلاب، openFn/closeFn لعرض النافذة في كل برنامج */
  let ctx = null;
  function open(o) {
    ctx = o;
    const today = o.today || iso(new Date());
    const ref = latestDate(o.getStudents(), today);
    o.openFn(`<div class="modal-title" style="font-size:17px;font-weight:900;margin-bottom:10px">🌟 قوائم النجوم</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;font-size:13px">
        <select id="st-mode" class="select input" style="width:auto" onchange="STARS.refresh()"><option value="day">نجوم اليوم</option><option value="week" selected>نجوم الأسبوع</option><option value="term">نجوم الفصل</option></select>
        <input type="date" id="st-ref" class="input" style="width:auto" value="${ref}" max="${today}" onchange="STARS.refresh()">
        <select id="st-scope" class="select input" style="width:auto" onchange="STARS.refresh()"><option value="all">${esc(o.allLabel || 'المدرسة')}</option><option value="grade">الأوائل في كل مرحلة</option><option value="class">الأوائل في كل شعبة</option></select>
        <select id="st-top" class="select input" style="width:auto" onchange="STARS.refresh()"><option value="3">أول 3</option><option value="5">أول 5</option><option value="10" selected>أول 10</option></select>
      </div>
      <div id="st-sub" style="font-size:12px;opacity:.75;margin-bottom:8px"></div>
      <div id="st-out" style="max-height:52vh;overflow-y:auto"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">
        <button class="btn btn-primary primary" onclick="STARS.doPrint()">🖨️ طباعة</button>
        <button class="btn btn-success success" onclick="STARS.doExcel()">📤 Excel</button>
        <button class="btn btn-ghost" onclick="STARS.close()">إغلاق</button>
      </div>`);
    refresh();
  }
  let last = null;
  function refresh() {
    const v = id => document.getElementById(id).value;
    last = compute(ctx.getStudents(), { mode: v('st-mode'), ref: v('st-ref') || iso(new Date()), scope: v('st-scope'), top: +v('st-top'), allLabel: ctx.allLabel });
    document.getElementById('st-sub').textContent = last.title + ' — ' + last.sub;
    document.getElementById('st-out').innerHTML = html(last);
  }
  return {
    compute, html, print, excel, open, refresh, range,
    close: () => ctx && ctx.closeFn(),
    doPrint: () => last && print(last, ctx.school, ctx.extra),
    doExcel: () => last && excel(last, `${last.title.replace(/[^؀-ۿ\w ]/g, '').trim()}_${last.from || 'الفصل'}.xlsx`)
  };
})();
