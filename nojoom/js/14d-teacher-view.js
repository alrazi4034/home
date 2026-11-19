/* 14d-teacher-view.js — تبويب «📊 لوحة التحكم»: جدول المعلم مع إدخالات الحضور والمشاركات والملاحظات لكل حصة
   (بدون جدول: عدد إدخالات الحضور لكل صف مع المشاركات والملاحظات) */
const TV = { week: null, scope: 'week' };
function tvInit() { if (!TV.week) TV.week = TS.weekStart(_today()); tvRender(); }
function tvShift(n) { TV.week = TS.addDays(TV.week, 7 * n); TV.scope = 'week'; tvRender(); }
function tvThisWeek() { TV.week = TS.weekStart(_today()); TV.scope = 'week'; tvRender(); }
function tvScope(s) { TV.scope = s; tvRender(); }
function tvRender() {
  const box = document.getElementById('tv-content'); if (!box) return;
  const si = getSchoolInfo(), meta = state.rosterMeta || {};
  const tt = meta.timetable || null;
  const H = meta.holidays || [];
  const data = { classes: state.classes };
  const wFrom = TV.week, wTo = TS.addDays(TV.week, 4);
  const termFrom = si.termStart || TS.addDays(_today(), -60), today = _today();
  const r = TS.compute(data, tt, wFrom, wTo, H);
  const rs = TV.scope === 'term' ? TS.compute(data, tt, termFrom, today < (si.termEnd || today) ? today : (si.termEnd || today), H) : r;
  const fmt = d => d.slice(8) + '/' + d.slice(5, 7);
  box.innerHTML = TS.CSS + `
    <div class="card" style="padding:14px 16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div><div style="font-size:16px;font-weight:900">👤 ${rsEsc(si.teacher || 'المعلم')}</div>
          <div style="font-size:12px;color:var(--text-muted)">${rsEsc(si.subject || '')}${r.hasTT ? ' — الجدول من بيانات المدرسة' : ' — لا يوجد جدول للمعلم في بيانات المدرسة'}</div></div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <button class="date-nav-btn" onclick="tvShift(-1)" title="الأسبوع السابق">▶</button>
          <span style="font-weight:800;font-size:13px;min-width:150px;text-align:center">الأسبوع ${fmt(wFrom)} — ${fmt(wTo)}</span>
          <button class="date-nav-btn" onclick="tvShift(1)" title="الأسبوع التالي">◀</button>
          <button class="date-nav-btn today" onclick="tvThisWeek()">هذا الأسبوع</button>
        </div>
      </div>
      ${TS.kpis(r)}
      ${r.hasTT || r.cells.length ? TS.gridHTML(r, { compact: true, click: 'tvGo' }) : '<div style="font-size:12.5px;color:var(--text-muted);margin-top:4px">لا يوجد جدول حصص — يظهر أدناه عدد إدخالات الحضور لكل صف مع المشاركات والملاحظات.</div>'}
    </div>
    <div class="card" style="padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div style="font-weight:900">📊 ملخص الصفوف ${TV.scope === 'term' ? `— الفصل الحالي (${fmt(rs.from)} — ${fmt(rs.to)})` : '— هذا الأسبوع'}</div>
        <div style="display:flex;gap:6px"><button class="flt-btn ${TV.scope === 'week' ? 'flt-btn-on' : ''}" onclick="tvScope('week')">الأسبوع المعروض</button>
          <button class="flt-btn ${TV.scope === 'term' ? 'flt-btn-on' : ''}" onclick="tvScope('term')">الفصل الحالي</button></div>
      </div>
      ${TV.scope === 'term' ? TS.kpis(rs) : ''}
      ${TS.tableHTML(rs)}
    </div>`;
}

// الضغط على حصة ⇐ صفحة الحضور بتاريخ الحصة وشعبتها ورقمها
function tvGo(d, clsName, p) {
  if (d > _today()) return toast('لا يمكن الانتقال لتاريخ مستقبلي', '⚠️');
  if (typeof isSessionDirty === 'function' && isSessionDirty() && !confirm('لديك تغييرات غير محفوظة في الحصة الحالية. الانتقال دون حفظ؟')) return;
  const cls = state.classes.find(c => c.name === clsName);
  sessionDate = d;
  if (typeof updateSessionDateDisplay === 'function') updateSessionDateDisplay();
  state.classes.forEach(c => c.students.forEach(s => {
    s._todayAtt = (s._prevAtt || {})[d] || 'unmarked';
    s._todayLate = s._todayAtt === 'present' && (s.lateDates || []).includes(d);
  }));
  if (cls) { state.activeClass = cls.id; if (typeof selPeriods !== 'undefined') { selPeriodsCtx = cls.id + '|' + d; selPeriods = new Set(); } }   // لا تحديد تلقائي للحصة
  save();
  showPage('attendance', document.querySelector('.tab-btn[onclick*="\'attendance\'"]'));
  if (typeof showOldDateWarning === 'function') showOldDateWarning();
  if (typeof renderPeriodChips === 'function') renderPeriodChips();
  toast(`📅 ${d} — ${clsName} — اختر رقم الحصة يدوياً`, '📋');
}
