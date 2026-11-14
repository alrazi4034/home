/* 06-leaderboard-report.js — لوحة المتصدرين وفلتر الأسابيع، صفحة التقارير */

// ===== LEADERBOARD MULTI-SELECT =====
let lbSelectedClasses = new Set();
let lbSelectedWeeks  = new Set(); // أسابيع محددة — فارغ = كل الأسابيع
let lbMultiWeek = false;          // وضع الاختيار المتعدد // empty = all

// ===== LEADERBOARD WEEK FILTER =====
function renderLbWeekButtons() {
  const bar = document.getElementById('lb-week-buttons');
  if (!bar) return;
  const info = getSchoolInfo();
  if (!info.termStart) {
    bar.innerHTML = '<span style="font-size:11px;color:var(--text-muted);font-style:italic">أدخل تاريخ بداية الفصل لتفعيل فلتر الأسابيع</span>';
    return;
  }
  const weeks = getAvailableWeeks(null);
  if (!weeks.length) {
    bar.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">لا توجد بيانات أسابيع بعد</span>';
    return;
  }
  const allActive = lbSelectedWeeks.size === 0;
  bar.innerHTML = `
    <button onclick="setLbWeek(null)" class="flt-btn ${allActive?'flt-btn-on':''}">الكل</button>
    ${weeks.map(w => {
      const active = lbSelectedWeeks.has(w);
      return `<button onclick="setLbWeek(${w})" class="flt-btn ${active?'flt-btn-on':''}">أسبوع ${w}</button>`;
    }).join('')}
  `;
  // تحديث زر المتعدد
  const btn = document.getElementById('lb-multi-btn');
  if (btn) {
    btn.style.background = lbMultiWeek ? 'rgba(95,216,232,0.15)' : 'rgba(255,255,255,0.06)';
    btn.style.color      = lbMultiWeek ? '#5fd8e8' : 'var(--text-muted)';
    btn.style.borderColor= lbMultiWeek ? 'rgba(95,216,232,0.4)' : 'rgba(255,255,255,0.15)';
  }
}

function setLbWeek(week) {
  if (week === null) {
    // الكل
    lbSelectedWeeks.clear();
    lbMultiWeek = false;
  } else if (lbMultiWeek) {
    // وضع متعدد: toggle
    if (lbSelectedWeeks.has(week)) lbSelectedWeeks.delete(week);
    else lbSelectedWeeks.add(week);
    if (lbSelectedWeeks.size === 0) lbMultiWeek = false;
  } else {
    // اختيار واحد
    lbSelectedWeeks.clear();
    lbSelectedWeeks.add(week);
  }
  renderLbWeekButtons();
  updateLeaderboard();
}

function toggleLbMultiWeek() {
  lbMultiWeek = !lbMultiWeek;
  if (!lbMultiWeek && lbSelectedWeeks.size > 1) {
    // رجوع لاختيار واحد: احتفظ بالأخير
    const last = [...lbSelectedWeeks].pop();
    lbSelectedWeeks.clear();
    lbSelectedWeeks.add(last);
  }
  renderLbWeekButtons();
  updateLeaderboard();
}

function toggleLbFilterPanel() {
  const panel = document.getElementById('lb-filter-panel');
  const isVisible = panel.style.display !== 'none';
  panel.style.display = isVisible ? 'none' : 'flex';
  if (!isVisible) renderLbFilterPanel();
}

function renderLbFilterPanel() {
  const panel = document.getElementById('lb-filter-panel');
  if (!panel) return;
  panel.innerHTML = `
    <button onclick="lbSelectAll()" class="btn btn-sm ${lbSelectedClasses.size===0?'btn-primary':'btn-ghost'}">الكل</button>
    ${state.classes.map(cls => `
      <button onclick="lbToggleClass(${cls.id})" class="btn btn-sm ${lbSelectedClasses.has(cls.id)?'btn-primary':'btn-ghost'}">
        ${cls.name}
      </button>`).join('')}
  `;
}

function lbSelectAll() {
  lbSelectedClasses.clear();
  renderLbFilterPanel();
  updateLeaderboard();
}

function lbToggleClass(id) {
  if (lbSelectedClasses.has(id)) lbSelectedClasses.delete(id);
  else lbSelectedClasses.add(id);
  renderLbFilterPanel();
  updateLeaderboard();
}

function updateLeaderboard() {
  const summary = document.getElementById('lb-filter-summary');
  if (summary) {
    summary.textContent = lbSelectedClasses.size === 0
      ? 'جميع الصفوف'
      : [...lbSelectedClasses].map(id => state.classes.find(c=>c.id===id)?.name).filter(Boolean).join('، ');
  }

  let all = [];
  state.classes.forEach(cls => {
    if (lbSelectedClasses.size === 0 || lbSelectedClasses.has(cls.id)) {
      cls.students.forEach(s => all.push({ ...s, className: cls.name }));
    }
  });
  // احسب النقاط حسب الأسابيع المحددة
  all = all.map(s => ({
    ...s,
    _displayPoints: getPointsForWeeks(s, lbSelectedWeeks.size > 0 ? lbSelectedWeeks : null)
  }));
  all.sort((a,b) => b._displayPoints - a._displayPoints);
  const max = all[0]?._displayPoints || 1;
  const weekLabel = lbSelectedWeeks.size === 0 ? '' : ` (${lbSelectedWeeks.size===1?'أسبوع '+[...lbSelectedWeeks][0]:lbSelectedWeeks.size+' أسابيع'})`;
  document.getElementById('stat-count').textContent = all.length;
  document.getElementById('stat-top').textContent = (all[0]?._displayPoints || 0) + weekLabel;
  document.getElementById('stat-avg').textContent = all.length ? Math.round(all.reduce((s,x) => s+x._displayPoints,0)/all.length) : 0;
  renderLbWeekButtons();

  const list = document.getElementById('leaderboard-list');
  if (!list) return;
  if (!all.length) { list.innerHTML = `<div class="empty-state"><div class="icon">🏆</div><p>لا يوجد طلاب</p></div>`; return; }

  list.innerHTML = all.map((s, i) => {
    const rankClass = i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'rank-other';
    const rankIcon  = i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1;
    const rowClass  = i===0?'leader-row leader-row-1':i===1?'leader-row leader-row-2':i===2?'leader-row leader-row-3':'leader-row';
    const nameClass = i<3 ? `leader-name-top leader-name-${i+1}` : '';
    const pct = max > 0 ? Math.round((s.points/max)*100) : 0;
    const barColor = i===0?'linear-gradient(90deg,#ffd700,#ff9f43)':i===1?'linear-gradient(90deg,#c0c0c0,#a0a0a0)':i===2?'linear-gradient(90deg,#cd7f32,#b5651d)':'linear-gradient(90deg,var(--accent),#ff9f43)';
    const specialBadge = i===0 ? `<span style="font-size:10px;background:rgba(255,215,0,0.2);color:#ffd700;border:1px solid rgba(255,215,0,0.4);border-radius:8px;padding:1px 6px;margin-right:5px">المتصدر 🌟</span>` :
                         i===1 ? `<span style="font-size:10px;background:rgba(192,192,192,0.15);color:var(--text-muted);border:1px solid rgba(192,192,192,0.3);border-radius:8px;padding:1px 6px;margin-right:5px">المركز الثاني</span>` :
                         i===2 ? `<span style="font-size:10px;background:rgba(205,127,50,0.15);color:#cd7f32;border:1px solid rgba(205,127,50,0.3);border-radius:8px;padding:1px 6px;margin-right:5px">المركز الثالث</span>` : '';
    const avatarStyle = i===0?'width:44px;height:44px;font-size:18px;background:linear-gradient(135deg,#ffd700,#ff9f43);color:#1a1530;border:2px solid rgba(255,215,0,0.5)':
                        i===1?'background:linear-gradient(135deg,#a0a0a0,#d0d0d0);color:#222':
                        i===2?'background:linear-gradient(135deg,#cd7f32,#b5651d);color:#fff':'';
    const total = (s.present||0)+(s.absent||0);
    const attPct = total>0 ? Math.round((s.present/total)*100) : 0;
    const pctColor = attPct>=75?'var(--present)':attPct>0?'#ff9f43':'var(--absent)';

    return `<div class="${rowClass}" style="position:relative">
      <div class="rank-badge ${rankClass}" style="${i<3?'width:40px;height:40px;font-size:'+(i===0?'22':'18')+'px':''}">
        ${rankIcon}
      </div>
      <div class="student-avatar" style="${avatarStyle}">${s.name.charAt(0)}</div>
      <div style="flex:1;min-width:80px">
        <div class="${nameClass}" style="${!nameClass?'font-weight:700;font-size:14px':''}">${s.name} ${specialBadge}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
          ${s.className} · حضر: ${s.present} · غاب: ${s.absent}
          <span style="color:${pctColor};font-weight:700;margin-right:4px">${attPct}%</span>
        </div>
      </div>
      <div class="leader-bar-wrap"><div class="leader-bar" style="width:${pct}%;background:${barColor}"></div></div>
      <div class="leader-points" style="${i===0?'font-size:18px;color:#ffd700':i<3?'font-size:15px':''}">⭐${s._displayPoints}</div>
      <button onclick="showCertificate(this)" 
        data-sid="${s.id}" data-rank="${i+1}"
        class="btn btn-ghost btn-sm" title="شهادة تقدير"
        style="font-size:13px;padding:4px 8px;color:#f7c948;border-color:rgba(247,201,72,0.3);flex-shrink:0">
        📜
      </button>
    </div>`;
  }).join('');

  if (all[0]?.points > 0) {
    setTimeout(() => spawnConfetti(), 300);
  }
}

function spawnConfetti() {
  const list = document.getElementById('leaderboard-list');
  const firstRow = list?.querySelector('.leader-row-1');
  if (!firstRow || firstRow.querySelector('.confetti-piece')) return;
  const colors = ['#ffd700','#ff9f43','#4ecdc4','#a29bfe','#ff6b6b','#5fd8e8'];
  for (let i = 0; i < 12; i++) {
    const c = document.createElement('div');
    c.className = 'confetti-piece';
    c.style.cssText = `left:${10+Math.random()*80}%;top:${Math.random()*40}%;background:${colors[i%colors.length]};animation-delay:${Math.random()*0.5}s;animation-duration:${0.8+Math.random()*0.8}s;transform:rotate(${Math.random()*360}deg)`;
    firstRow.appendChild(c);
    setTimeout(() => c.remove(), 2000);
  }
}

// ===== REPORT PAGE =====
let reportActiveClass = null;
let reportActiveStudent = null;

function updateReportSelects() {
  reportActiveClass = state.classes[0]?.id || null;
  reportActiveStudent = null;
}

function initReportPage() {
  if (!reportActiveClass) reportActiveClass = state.classes[0]?.id || null;
  renderReportClassFilter();
  renderReportStudentsList();
  document.getElementById('report-detail-box').innerHTML = '';
}

function renderReportClassFilter() {
  const c = document.getElementById('report-class-filter');
  if (!c) return;
  c.innerHTML = state.classes.map(cls => `
    <button class="flt-btn ${cls.id === reportActiveClass ? 'flt-btn-on' : ''}"
      onclick="setReportClass(${cls.id})">
      ${cls.name}
    </button>`).join('');
}

function setReportClass(id) {
  reportActiveClass = id;
  state.activeClass = id;   // يبقى نفس الصف في باقي الصفحات
  reportActiveStudent = null;
  _reportLetterFilter = 'all';
  repSelectedWeeks.clear();
  repMultiWeek = false;
  renderReportClassFilter();
  renderReportStudentsList();
  document.getElementById('report-detail-box').innerHTML = '';
}


// دالة مشتركة لبناء شارات ملخص التقييمات
function buildAssessBadges(sAssessments, studentId) {
  if (!sAssessments || !sAssessments.length) return '';
  var numNames = ['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر'];
  var totalScore = 0, totalMax = 0;
  var badges = sAssessments.map(function(a, idx) {
    var sc = a.scores && a.scores[studentId];
    var label = 'التقييم ' + (numNames[idx] || (idx+1));
    if (sc === undefined || sc === '') {
      return '<span style="font-size:11px;color:var(--text-muted)">' + label + ': <span style="opacity:0.6">—</span></span>';
    }
    var val = parseFloat(sc);
    totalScore += val; totalMax += a.maxScore;
    var pct = Math.round((val / a.maxScore) * 100);
    var c = pct >= 75 ? 'var(--present)' : pct >= 50 ? '#ff9f43' : 'var(--absent)';
    return '<span style="font-size:11px;color:var(--text-muted)">' + label
      + ': <b style="color:' + c + ';font-weight:800">' + sc + '/' + a.maxScore + '</b></span>';
  });
  var totalStr = '';
  if (totalMax > 0) {
    var tp = Math.round((totalScore / totalMax) * 100);
    var tc = tp >= 75 ? 'var(--present)' : tp >= 50 ? '#ff9f43' : 'var(--absent)';
    totalStr = '<span style="font-size:11px;font-weight:800;padding:2px 8px;color:' + tc + ';margin-right:4px">المجموع: ' + Math.round(totalScore) + '/' + totalMax + '</span>';
  }
  return '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;align-items:center">'
    + badges.join(' <span style="color:rgba(128,128,128,0.3)">|</span> ')
    + (totalStr ? ' ' + totalStr : '')
    + '</div>';
}

function renderReportStudentsList() {
  const list = document.getElementById('report-students-list');
  if (!list) return;
  const cls = state.classes.find(c => c.id === reportActiveClass);
  if (!cls || !cls.students.length) {
    list.innerHTML = `<div class="empty-state" style="padding:30px"><div class="icon">👤</div><p>لا يوجد طلاب في هذا الصف</p></div>`;
    return;
  }
  const dateFrom = document.getElementById('report-date-from')?.value || '';
  const dateTo   = document.getElementById('report-date-to')?.value || '';

  list.innerHTML = `<div class="card"><div style="padding:4px 0">` +
    cls.students.map(s => {
      const isActive = s.id === reportActiveStudent;
      // حساب الحضور والغياب ضمن نطاق التاريخ
      let present = s.present, absent = s.absent;
      if (dateFrom || dateTo) {
        const savedDays = (cls._savedDates || []).filter(d => (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo));
        const absentInRange = (s.absenceDates || []).filter(d => savedDays.includes(d)).length;
        absent  = absentInRange;
        present = savedDays.length - absentInRange;
      }
      const total = present + absent;
      const pct = total > 0 ? Math.round((present/total)*100) : 0;
      const pctColor = pct >= 75 ? 'var(--present)' : pct > 0 ? '#ff9f43' : 'var(--absent)';
      const _wPts  = getPointsForWeeks(s, repSelectedWeeks.size > 0 ? repSelectedWeeks : null);
      const maxPts = Math.max(...cls.students.map(x => getPointsForWeeks(x, repSelectedWeeks.size > 0 ? repSelectedWeeks : null)), 1);
      const ptsPct = Math.min(100, Math.round((_wPts / maxPts) * 100));
      const maxPart = Math.max(...cls.students.map(x => x.participation), 1);
      const partPct = Math.min(100, Math.round((s.participation / maxPart) * 100));
      const partColor = s.participation >= maxPart * 0.7 ? 'var(--present)' : s.participation >= maxPart * 0.4 ? '#a29bfe' : 'var(--text-muted)';

      return `<div class="student-row" style="cursor:pointer;${isActive ? 'background:rgba(247,201,72,0.1);border-right:3px solid var(--accent)' : ''}"
        onclick="selectReportStudent(${s.id})">
        <div class="student-avatar" style="${isActive ? 'background:linear-gradient(135deg,var(--accent),#ff9f43);color:#1a1530' : ''}">${s.name.charAt(0)}</div>
        <div class="student-info">
          <div class="student-name">${s.name}</div>
          <div class="student-meta">${(() => {
            const posN = (s.behaviorNotes||[]).filter(n=>n.type==='positive').length;
            const negN = (s.behaviorNotes||[]).filter(n=>n.type!=='positive').length;
            const parts = [
              `<span>حضر: <b class="mc-present">${present}</b></span>`,
              `<span>غاب: <b class="mc-absent">${absent}</b></span>`,
              `<span>شارك: <b class="mc-purple">${s.participation}</b></span>`,
              `<span>ملاحظات +: <b class="mc-present">${posN}</b></span>`,
              `<span>ملاحظات -: <b class="mc-absent">${negN}</b></span>`,
            ];
            return parts.join(' <span style="color:rgba(255,255,255,0.2)">|</span> ');
          })()}</div>
          ${buildAssessBadges((state.assessments||[]).filter(a => a.classIds.includes(reportActiveClass)), s.id)}
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;min-width:54px;margin:0 4px">
          <div style="background:rgba(247,201,72,0.15);border:1px solid rgba(247,201,72,0.3);border-radius:10px;padding:4px 7px;text-align:center;width:100%">
            <div style="font-size:14px;font-weight:900;color:var(--accent);line-height:1">⭐${_wPts}${repSelectedWeeks.size>0?'<span style=\"font-size:9px;color:var(--text-muted);display:block;margin-top:1px\">أسبوعي</span>':''}</div>
          </div>
          <div style="width:100%;background:rgba(247,201,72,0.1);border-radius:4px;height:4px;margin-top:3px;overflow:hidden">
            <div style="width:${ptsPct}%;height:100%;background:linear-gradient(90deg,var(--accent),#ff9f43);border-radius:4px;transition:width 0.5s"></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;min-width:50px">
          <span style="color:${pctColor};font-weight:800;font-size:13px">${pct}%</span>
          <div style="width:50px;background:rgba(255,255,255,0.08);border-radius:6px;height:5px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${pctColor};border-radius:6px"></div>
          </div>
        </div>
      </div>`;
    }).join('') + `</div></div>`;
  renderReportLetterFilter();
  renderRepWeekButtons();
  setTimeout(applyReportLetterFilter, 10);
}

function selectReportStudent(studentId) {
  reportActiveStudent = studentId;
  renderReportStudentsList();
  showStudentReport();
  setTimeout(() => document.getElementById('report-detail-box')?.scrollIntoView({ behavior:'smooth', block:'start' }), 100);
}

// فلتر الحروف في صفحة التقارير
let _reportLetterFilter = 'all';
let repSelectedWeeks = new Set();
let repMultiWeek = false;

function renderRepWeekButtons() {
  const bar = document.getElementById('rep-week-buttons');
  if (!bar) return;
  const info = getSchoolInfo();
  if (!info.termStart) {
    bar.innerHTML = '<span style="font-size:11px;color:var(--text-muted);font-style:italic">أدخل تاريخ بداية الفصل لتفعيل فلتر الأسابيع</span>';
    return;
  }
  const clsIds = reportActiveClass ? [reportActiveClass] : null;
  const weeks = getAvailableWeeks(clsIds);
  if (!weeks.length) { bar.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">لا توجد بيانات أسابيع بعد</span>'; return; }
  const allActive = repSelectedWeeks.size === 0;
  bar.innerHTML = `
    <button onclick="setRepWeek(null)" class="flt-btn ${allActive?'flt-btn-on':''}">الكل</button>
    ${weeks.map(w => {
      const active = repSelectedWeeks.has(w);
      return `<button onclick="setRepWeek(${w})" class="flt-btn ${active?'flt-btn-on':''}">أسبوع ${w}</button>`;
    }).join('')}
  `;
  const btn = document.getElementById('rep-multi-btn');
  if (btn) {
    btn.style.background  = repMultiWeek ? 'rgba(95,216,232,0.15)' : 'rgba(255,255,255,0.06)';
    btn.style.color       = repMultiWeek ? '#5fd8e8' : 'var(--text-muted)';
    btn.style.borderColor = repMultiWeek ? 'rgba(95,216,232,0.4)' : 'rgba(255,255,255,0.15)';
  }
}

function setRepWeek(week) {
  if (week === null) {
    repSelectedWeeks.clear();
    repMultiWeek = false;
  } else if (repMultiWeek) {
    if (repSelectedWeeks.has(week)) repSelectedWeeks.delete(week);
    else repSelectedWeeks.add(week);
    if (repSelectedWeeks.size === 0) repMultiWeek = false;
  } else {
    repSelectedWeeks.clear();
    repSelectedWeeks.add(week);
  }
  renderRepWeekButtons();
  renderReportStudentsList();
  if (reportActiveStudent) showStudentReport();
}

function toggleRepMultiWeek() {
  repMultiWeek = !repMultiWeek;
  if (!repMultiWeek && repSelectedWeeks.size > 1) {
    const last = [...repSelectedWeeks].pop();
    repSelectedWeeks.clear();
    repSelectedWeeks.add(last);
  }
  renderRepWeekButtons();
  renderReportStudentsList();
}
function renderReportLetterFilter() {
  const c = document.getElementById('report-letter-filter');
  if (!c) return;
  const cls = state.classes.find(cl => cl.id === reportActiveClass);
  if (!cls) { c.innerHTML = ''; return; }
  const letters = [...new Set(cls.students.map(s => s.name.charAt(0)))].sort();
  if (letters.length <= 1) { c.innerHTML = ''; return; }
  c.innerHTML = `
    <button onclick="setReportLetterFilter('all')" class="flt-btn ${_reportLetterFilter==='all'?'flt-btn-on':''}">الكل</button>
    ${letters.map(l=>`<button onclick="setReportLetterFilter('${l}')" class="flt-btn ${_reportLetterFilter===l?'flt-btn-on':''}">${l}</button>`).join('')}
  `;
}
function setReportLetterFilter(letter) {
  _reportLetterFilter = letter;
  renderReportLetterFilter();
  applyReportLetterFilter();
}
function applyReportLetterFilter() {
  const rows = document.querySelectorAll('#report-students-list .student-row');
  rows.forEach(row => {
    const name = (row.querySelector('.student-name')?.textContent||'').trim();
    row.style.display = (_reportLetterFilter==='all' || name.charAt(0)===_reportLetterFilter) ? '' : 'none';
  });
}

function showStudentReport() {
  const cls = state.classes.find(c => c.id === reportActiveClass);
  const s = cls?.students.find(st => st.id === reportActiveStudent);
  const rc = document.getElementById('report-detail-box');
  if (!s) { rc.innerHTML = ''; return; }

  // احترام فلتر التاريخ إذا كان مفعّلاً
  const _dateFrom = document.getElementById('report-date-from')?.value || '';
  const _dateTo   = document.getElementById('report-date-to')?.value || '';
  let presentVal = s.present, absentVal = s.absent;
  if (_dateFrom || _dateTo) {
    const savedInRange = (cls._savedDates || []).filter(d => (!_dateFrom || d >= _dateFrom) && (!_dateTo || d <= _dateTo));
    const absentInRange = (s.absenceDates || []).filter(d => savedInRange.includes(d)).length;
    absentVal  = absentInRange;
    presentVal = Math.max(0, savedInRange.length - absentInRange);
  }

  const total = presentVal + absentVal;
  const attPct = total > 0 ? Math.round((presentVal/total)*100) : 0;
  const level = s.points >= 100 ? '🥇 ممتاز' : s.points >= 60 ? '🥈 جيد جداً' : s.points >= 30 ? '🥉 جيد' : '📘 مبتدئ';
  const absenceDates = (s.absenceDates || []).slice().sort();

  // خط زمني الحضور والغياب
  const allDates = [...new Set([
    ...(cls._savedDates || []),
    ...(s.absenceDates || [])
  ])].sort();

  // دالة لبناء HTML الخط الزمني حسب الفلتر
  function buildTimelineHTML(filterMode) {
    const datesToShow = filterMode === 'absent'
      ? allDates.filter(d => (s.absenceDates||[]).includes(d))
      : allDates;

    if (datesToShow.length === 0) {
      return filterMode === 'absent'
        ? `<div style="text-align:center;padding:16px;color:var(--present);font-size:13px">لا يوجد أي غياب مسجّل</div>`
        : `<div style="text-align:center;padding:16px;color:var(--present);font-size:13px">لم تُسجَّل أي حصة بعد</div>`;
    }

    return `<div style="position:relative;padding-right:20px">
      <div style="position:absolute;right:8px;top:0;bottom:0;width:2px;background:rgba(255,255,255,0.1)"></div>
      ${datesToShow.map(d => {
        const isAbsent = (s.absenceDates||[]).includes(d);
        const dateObj = new Date(d+'T12:00:00');
        const dayName = dateObj.toLocaleDateString('ar-EG',{weekday:'long',numberingSystem:'latn'});
        const displayDate = dateObj.toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric',numberingSystem:'latn'});
        const dotColor = isAbsent ? 'var(--absent)' : 'var(--present)';
        const bgColor = isAbsent ? 'rgba(255,107,107,0.1)' : 'rgba(78,205,196,0.08)';
        const borderColor = isAbsent ? 'rgba(255,107,107,0.3)' : 'rgba(78,205,196,0.25)';
        const label = isAbsent ? 'غياب' : 'حضور';
        const labelColor = isAbsent ? 'var(--absent)' : 'var(--present)';
        return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;position:relative">
          <div style="position:absolute;right:-16px;width:10px;height:10px;border-radius:50%;background:${dotColor};border:2px solid var(--surface)"></div>
          <div style="background:${bgColor};border:1px solid ${borderColor};border-radius:10px;padding:7px 14px;flex:1;display:flex;align-items:center;justify-content:space-between">
            <div>
              <span style="font-size:13px;font-weight:700">${displayDate}</span>
              <span style="color:var(--text-muted);font-size:12px;margin-right:8px">— ${dayName}</span>
            </div>
            <span style="color:${labelColor};font-weight:800;font-size:12px">${label}</span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  const timelineHTML = buildTimelineHTML('absent'); // الافتراضي: غياب فقط
  // حفظ البيانات للفلتر
  window._reportTimelineData = { allDates, absenceDates: s.absenceDates || [] };

  // درجات التقييمات
  const studentAssessments = (state.assessments||[]).filter(a => a.classIds.includes(reportActiveClass));
  const gradesHTML = studentAssessments.length === 0
    ? `<div style="color:var(--text-muted);font-size:13px;padding:8px 0">لا توجد تقييمات مضافة لهذا الصف بعد</div>`
    : studentAssessments.map(a => {
        const score = a.scores?.[s.id];
        const pct = score !== undefined && score !== '' ? Math.round((parseFloat(score)/a.maxScore)*100) : null;
        const color = pct === null ? 'var(--text-muted)' : pct >= 75 ? 'var(--present)' : pct >= 50 ? '#ff9f43' : 'var(--absent)';
        const earnedPts = a.awardedPoints?.[s.id];
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 13px;background:var(--surface);border-radius:10px;margin-bottom:6px;border:1px solid var(--border-color)">
          <div>
            <div style="font-size:13px;font-weight:700">${a.name}</div>
            ${earnedPts !== undefined ? `<div style="font-size:11px;color:var(--accent);margin-top:2px">⭐ +${earnedPts} نقطة مكتسبة</div>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="text-align:center">
              <div style="font-size:16px;font-weight:900;color:${color}">${score !== undefined && score !== '' ? score : '—'}</div>
              <div style="font-size:10px;color:var(--text-muted)">من ${a.maxScore}</div>
            </div>
            ${pct !== null ? `<span style="font-size:12px;font-weight:800;color:${color}">${pct}%</span>` : ''}
          </div>
        </div>`;
      }).join('');

  // الملاحظات السلوكية
  const notes = (s.behaviorNotes || []);
  const notesHTML = notes.length === 0
    ? `<div style="color:var(--text-muted);font-size:13px;padding:8px 0">لا توجد ملاحظات سلوكية مسجّلة</div>`
    : notes.map((n,i) => {
        const isPos = n.type === 'positive';
        const nPts = n.points || 0;
        const ptsBadge = nPts !== 0
          ? `<span style="background:${nPts>0?'rgba(78,205,196,0.2)':'rgba(255,107,107,0.2)'};color:${nPts>0?'var(--present)':'var(--absent)'};border:1px solid ${nPts>0?'rgba(78,205,196,0.4)':'rgba(255,107,107,0.4)'};border-radius:6px;padding:1px 7px;font-size:11px;font-weight:800">${nPts>0?'+':''}${nPts} ⭐</span>`
          : '';
        return `<div style="display:flex;align-items:start;gap:8px;padding:9px 13px;background:${isPos?'rgba(78,205,196,0.16)':'rgba(255,107,107,0.16)'};border-radius:10px;margin-bottom:6px;border:1px solid ${isPos?'rgba(78,205,196,0.45)':'rgba(255,107,107,0.45)'}">
          <span style="font-size:16px">${isPos?'🌟':'⚠️'}</span>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
              <span style="font-size:12px;font-weight:700;color:${isPos?'var(--present)':'var(--absent)'}">${isPos?'إيجابية':'سلبية'}</span>
              ${ptsBadge}
            </div>
            <div id="note-text-${reportActiveStudent}-${i}" style="font-size:13px;color:var(--text);margin-top:3px">${n.text}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px">${n.date||''}</div>
          </div>
          <div style="display:flex;gap:5px;flex-shrink:0">
            ${s.parentPhone ? `<button onclick="showParentQR(${reportActiveStudent},'${s.name}','${s.parentPhone}')" style="background:rgba(37,211,102,0.15);border:1px solid rgba(10,111,50,0.3);color:#25d366;border-radius:6px;cursor:pointer;padding:3px 7px;font-size:12px" title="إرسال واتساب">📱</button>
            <button onclick="showCallQR('${s.parentPhone}','${s.name}')" style="background:rgba(162,155,254,0.15);border:1px solid rgba(50,55,80,0.3);color:#a29bfe;border-radius:6px;cursor:pointer;padding:3px 7px;font-size:12px" title="QR اتصال">📲</button>` : ''}
            <button onclick="editNote(${reportActiveStudent},${i},'${s.name}','${s.parentPhone||''}')" style="background:rgba(247,201,72,0.1);border:1px solid rgba(70,60,22,0.3);color:var(--accent);border-radius:6px;cursor:pointer;padding:3px 7px;font-size:12px">✏️</button>
            <button onclick="deleteNote(${reportActiveStudent},${i})" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:14px;opacity:0.6;padding:3px">🗑️</button>
          </div>
        </div>`;
      }).join('');

  rc.innerHTML = `
    <div class="card mt-4" style="border:2px solid rgba(247,201,72,0.2)">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="student-avatar" style="width:46px;height:46px;font-size:18px;background:linear-gradient(135deg,var(--accent),#ff9f43);color:#1a1530">${s.name.charAt(0)}</div>
          <div>
            <div style="font-size:15px;font-weight:800">${s.name}</div>
            <div style="font-size:12px;color:var(--text-muted)">${cls.name} • ${level}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <div class="points-badge" style="font-size:15px">⭐ ${s.points}</div>
          ${s.parentPhone ? `<button onclick="showReportSummaryQR(${reportActiveStudent},'${s.name}','${s.parentPhone}')" class="btn btn-success btn-sm">📊 ملخص لولي الأمر</button>
          <button onclick="showCallQR('${s.parentPhone}','${s.name}')" class="btn btn-ghost btn-sm" style="color:#a29bfe;border-color:#a29bfe" title="QR Code للاتصال السريع">📲 QR اتصال</button>` : ''}
        </div>
      </div>
      <div style="padding:18px">
        <!-- 5 بطاقات الإحصاء -->
        ${(() => {
          const totalSessions = (cls._savedDates||[]).length;
          const assessList = (state.assessments||[]).filter(a=>a.classIds.includes(reportActiveClass));
          const gradedCount = assessList.filter(a=>a.scores?.[s.id]!==undefined&&a.scores?.[s.id]!=='').length;
          const posNotes = (s.behaviorNotes||[]).filter(n=>n.type==='positive').length;
          const negNotes = (s.behaviorNotes||[]).filter(n=>n.type!=='positive').length;
          return `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:18px">
            <!-- 1: رصيد النقاط -->
            <div class="stat-card yellow" style="padding:14px 10px">
              <div class="stat-icon" style="font-size:22px">⭐</div>
              <div class="stat-value" style="color:var(--accent);font-size:26px">${s.points}</div>
              <div class="stat-label">رصيد النقاط</div>
            </div>
            <!-- 2: نسبة الحضور -->
            <div class="stat-card teal" style="padding:14px 10px">
              <div class="stat-icon" style="font-size:22px">${attPct>=75?'✅':'⚠️'}</div>
              <div class="stat-value" style="color:${attPct>=75?'var(--present)':'var(--absent)'};font-size:24px">${attPct}%</div>
              <div class="stat-label">الحضور</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:3px">${presentVal}/${totalSessions} حصة</div>
            </div>
            <!-- 3: المشاركات -->
            <div class="stat-card purple" style="padding:14px 10px">
              <div class="stat-icon" style="font-size:22px">✋</div>
              <div class="stat-value" style="color:#a29bfe;font-size:26px">${s.participation}</div>
              <div class="stat-label">مشاركة</div>
            </div>
            <!-- 4: التقييمات -->
            <div class="stat-card yellow" style="padding:14px 10px;border-top-color:#5fd8e8">
              <div class="stat-icon" style="font-size:22px">📝</div>
              <div class="stat-value" style="color:#5fd8e8;font-size:24px">${gradedCount}</div>
              <div class="stat-label">تقييمات</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:3px">من أصل ${assessList.length}</div>
            </div>
            <!-- 5: الملاحظات -->
            <div class="stat-card" style="padding:14px 10px;background:var(--surface);border:1px solid var(--border-color)">
              <div class="stat-icon" style="font-size:22px">📋</div>
              <div style="display:flex;gap:8px;justify-content:center;margin:4px 0 2px">
                <span style="font-size:22px;font-weight:900;color:var(--present)">${posNotes}</span>
                <span style="font-size:16px;color:var(--text-muted);align-self:center">/</span>
                <span style="font-size:22px;font-weight:900;color:var(--absent)">${negNotes}</span>
              </div>
              <div class="stat-label">ملاحظات +/-</div>
            </div>
          </div>`;
        })()}

        <!-- جدول تفاصيل احتساب رصيد النقاط -->
        ${(() => {
          const ATTEND_PTS = 2;
          const attendPts = presentVal * ATTEND_PTS;
          const partPts   = s.participation;
          const notePts   = (s.behaviorNotes||[]).reduce((sm,n)=>sm+(n.points||0),0);
          const manualPts = s._manualBonus||0;
          const assessList2 = (state.assessments||[]).filter(a=>a.classIds.includes(reportActiveClass));
          const assessPts = assessList2.reduce((sm,a)=>sm+(a.awardedPoints?.[s.id]||0),0);
          const rows = [
            { label:'📅 الحضور', detail:`${presentVal} حصة × 2`, pts: attendPts, color:'var(--present)' },
            { label:'✋ المشاركة', detail:`${s.participation} مشاركة × 1`, pts: partPts, color:'#a29bfe' },
            { label:'📝 التقييمات', detail:`${assessList2.length} تقييم`, pts: assessPts, color:'#5fd8e8' },
            { label:'📋 الملاحظات', detail:`إيجابية/سلبية`, pts: notePts, color: notePts>=0?'var(--present)':'var(--absent)' },

          ];
          const tableRows = rows.map(r=>`
            <div style="display:flex;align-items:center;padding:7px 12px;border-bottom:1px solid var(--border-color);font-size:13px">
              <div style="flex:1;font-weight:600">${r.label}</div>
              <div style="flex:1;color:var(--text-muted);font-size:12px">${r.detail}</div>
              <div style="min-width:60px;text-align:left;font-weight:800;font-size:14px;color:${r.color}">${r.pts>0?'+':''}${r.pts} ⭐</div>
            </div>`).join('');
          return `
          <div style="background:var(--surface2);border-radius:12px;overflow:hidden;margin-bottom:16px;border:1px solid rgba(247,201,72,0.2)">
            <div style="padding:10px 14px;background:rgba(247,201,72,0.08);border-bottom:1px solid rgba(247,201,72,0.15);font-size:13px;font-weight:800;color:var(--accent)">
              ⭐ تفاصيل احتساب رصيد النقاط
            </div>
            ${tableRows}
            <div style="display:flex;align-items:center;padding:9px 12px;background:rgba(247,201,72,0.08);font-size:14px;font-weight:900">
              <div style="flex:1;color:var(--text)">المجموع</div>
              <div style="min-width:60px;text-align:left;color:var(--accent);font-size:16px">${s.points} ⭐</div>
            </div>
          </div>`;
        })()}

        <!-- سجل الدرجات في التقرير -->
        <div style="background:var(--surface2);border-radius:12px;padding:16px;margin-bottom:14px;border:1px solid rgba(247,201,72,0.15)">
          <div style="font-size:14px;font-weight:800;color:var(--accent);margin-bottom:12px">📝 التقييمات</div>
          ${gradesHTML}
        </div>

        <!-- سجل الحضور والغياب -->
        <div style="background:var(--surface2);border-radius:12px;padding:16px;margin-bottom:14px;border:1px solid rgba(255,255,255,0.1)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <div style="font-size:14px;font-weight:800;color:var(--text)">📅 سجل الحضور والغياب — ${allDates.length} حصة</div>
            <div style="display:flex;gap:6px">
              <button id="tl-btn-absent" onclick="switchReportTimeline('absent')" 
                style="padding:4px 10px;border-radius:8px;border:1px solid var(--absent);background:rgba(255,107,107,0.2);color:var(--absent);font-family:Tajawal,sans-serif;font-size:12px;font-weight:700;cursor:pointer">
                غياب فقط
              </button>
              <button id="tl-btn-all" onclick="switchReportTimeline('all')"
                style="padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:transparent;color:var(--text-muted);font-family:Tajawal,sans-serif;font-size:12px;font-weight:700;cursor:pointer">
                الكل
              </button>
            </div>
          </div>
          <div id="report-timeline-content">${timelineHTML}</div>
        </div>

        <!-- الملاحظات السلوكية -->
        <div style="background:var(--surface2);border-radius:12px;padding:16px;margin-bottom:14px;border:1px solid rgba(162,155,254,0.2)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div style="font-size:14px;font-weight:800;color:#a29bfe">📝 الملاحظات السلوكية</div>
            <button onclick="showAddNoteModal(${reportActiveStudent},'${s.name}','${s.parentPhone||''}')" class="btn btn-ghost btn-sm" style="color:#a29bfe;border-color:#a29bfe">➕ ملاحظة</button>
          </div>
          ${notesHTML}
        </div>

        <!-- رسم بياني أسبوعي -->
        <div style="background:var(--surface2);border-radius:12px;padding:16px;margin-bottom:14px;border:1px solid rgba(247,201,72,0.15)">
          <div style="font-size:14px;font-weight:800;color:var(--accent);margin-bottom:12px">📊 تطور النقاط أسبوعاً بأسبوع</div>
          <div id="weekly-chart-container" style="overflow-x:auto;min-height:40px"></div>
        </div>

        <!-- تطوّر الطالب والخطط المقترحة -->
        <div id="report-progress-box"></div>

        <!-- ملاحظة تلقائية -->
        <div style="background:var(--surface2);border-radius:12px;padding:12px 16px;font-size:13px;color:var(--text-muted);margin-top:6px">
          💡 <strong style="color:var(--text)">ملاحظة تلقائية:</strong>
          ${(() => {
            const hasNeg = (s.behaviorNotes||[]).some(n=>n.type==='negative');
            const assessList = (state.assessments||[]).filter(a=>a.classIds.includes(reportActiveClass));
            const scores = assessList.map(a=>{const sc=a.scores?.[s.id];return sc!==undefined&&sc!==''?Math.round((parseFloat(sc)/a.maxScore)*100):null;}).filter(x=>x!==null);
            const avgScore = scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null;
            const hasFailure = scores.some(p=>p<50);
            const msgs = [];
            if (attPct < 60) msgs.push(`نسبة الحضور منخفضة (${attPct}%) — يحتاج متابعة مستمرة ⚠️`);
            else if (attPct >= 90) msgs.push(`التزام ممتاز بالحضور (${attPct}%) 🌟`);
            if (hasFailure) msgs.push('يحتاج دعماً في التحصيل — بعض التقييمات دون 50% 📚');
            else if (avgScore !== null && avgScore >= 85) msgs.push(`مستوى أكاديمي متميز (متوسط ${avgScore}%) 🏆`);
            if (hasNeg) msgs.push('سلوك يستدعي المتابعة والتوجيه');
            const posN2 = (s.behaviorNotes||[]).filter(n=>n.type==='positive').length;
            if (posN2 >= 3) msgs.push(`تميّز إيجابي ملحوظ (${posN2} ملاحظة إيجابية) ✨`);
            if (s.participation >= 15) msgs.push(`مشاركة فعّالة ومميزة (${s.participation} مشاركة) 👍`);
            if (msgs.length === 0) return `أداء ${s.name} منتظم — شجّعه على المزيد من المشاركة والتفوق 💪`;
            return msgs.join(' | ');
          })()}
        </div>

      </div>
    </div>`;
  renderWeeklyChart();
  try { renderStudentProgress(cls, s); } catch (e) { console.warn('progress', e); }
}

function renderWeeklyChart() {
  var container = document.getElementById('weekly-chart-container');
  if (!container) return;
  var cls = state.classes.find(function(c) { return c.id === reportActiveClass; });
  var s = cls && cls.students.find(function(st) { return st.id === reportActiveStudent; });
  if (!s) return;
  var log = s.pointsLog || [];
  var hasWeeks = log.some(function(e) { return e.termWeek !== undefined && e.termWeek !== null; });
  if (!hasWeeks) {
    container.innerHTML = '<div style="text-align:center;padding:16px;color:rgba(255,255,255,0.4);font-size:13px">📊 أدخل تاريخ بداية الفصل لعرض الرسم البياني</div>';
    return;
  }
  var weekMap = {};
  log.forEach(function(e) {
    if (e.termWeek !== undefined && e.termWeek !== null) {
      weekMap[e.termWeek] = (weekMap[e.termWeek] || 0) + (e.pts || 0);
    }
  });
  var weeks = Object.keys(weekMap).map(Number).sort(function(a, b) { return a - b; });
  var values = weeks.map(function(w) { return weekMap[w]; });
  var maxVal = Math.max.apply(null, values.concat([1]));

  // أبعاد - عرض كامل، محور Y على اليمين
  var svgW = 600, svgH = 200;
  var padR = 44; // محور Y على اليمين
  var padL = 16;
  var padT = 24;
  var padB = 44;
  var chartW = svgW - padL - padR;
  var chartH = svgH - padT - padB;

  // الأسبوع الأول من اليمين: نحسب X من اليمين
  var coords = weeks.map(function(w, i) {
    var xFromRight = padR + (i / (weeks.length === 1 ? 1 : weeks.length - 1)) * chartW;
    var x = svgW - xFromRight;
    var y = padT + chartH - (values[i] / maxVal) * chartH;
    return { x: x, y: y, w: w, v: values[i] };
  });

  var linePath = coords.map(function(p, i) {
    return (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1);
  }).join(' ');
  var areaPath = linePath
    + ' L' + coords[coords.length - 1].x.toFixed(1) + ',' + (padT + chartH).toFixed(1)
    + ' L' + coords[0].x.toFixed(1) + ',' + (padT + chartH).toFixed(1) + ' Z';

  var gradId = 'wcg' + s.id;
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 ' + svgW + ' ' + svgH);
  // عرض كامل بدون max-width
  svg.style.cssText = 'width:100%;display:block';

  // شبكة أفقية مع تسميات المحور Y على اليمين
  var gridHTML = [0, 1, 2, 3, 4].map(function(i) {
    var yy = (padT + (i / 4) * chartH).toFixed(1);
    var val = Math.round(maxVal * (1 - i / 4));
    return '<line x1="' + padL + '" y1="' + yy + '" x2="' + (svgW - padR) + '" y2="' + yy + '" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>'
         + '<text x="' + (svgW - padR + 6) + '" y="' + (parseFloat(yy) + 4) + '" text-anchor="start" font-size="10" fill="#c8c0e0" font-family="Tajawal,sans-serif">' + val + '</text>';
  }).join('');

  // عنوان المحور Y (على اليمين)
  var yLabelHTML = '<text x="' + (svgW - 10) + '" y="' + (padT + chartH / 2) + '" text-anchor="middle" font-size="9" fill="#b0a8cc" font-family="Tajawal,sans-serif" transform="rotate(90,' + (svgW - 10) + ',' + (padT + chartH / 2) + ')">&#x646;&#x642;&#x637;&#x629;</text>';

  // تسميات المحور X
  var xLabelsHTML = coords.map(function(p) {
    return '<text x="' + p.x.toFixed(1) + '" y="' + (padT + chartH + 16) + '" text-anchor="middle" font-size="10" fill="#c8c0e0" font-family="Tajawal,sans-serif">W' + p.w + '</text>';
  }).join('');

  var xTitleHTML = '<text x="' + (padL + chartW / 2) + '" y="' + (svgH - 4) + '" text-anchor="middle" font-size="9" fill="#b0a8cc" font-family="Tajawal,sans-serif">&#x627;&#x644;&#x623;&#x633;&#x628;&#x648;&#x639;</text>';

  // النقاط
  var dotsHTML = coords.map(function(p) {
    return '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="5" fill="#f7c948" stroke="#1a1530" stroke-width="2"/>'
         + '<text x="' + p.x.toFixed(1) + '" y="' + (p.y - 10).toFixed(1) + '" text-anchor="middle" font-size="10" fill="#f7c948" font-family="Tajawal,sans-serif" font-weight="700">' + p.v + '</text>';
  }).join('');

  svg.innerHTML = '<defs>'
    + '<linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#f7c948" stop-opacity="0.4"/>'
    + '<stop offset="100%" stop-color="#f7c948" stop-opacity="0.02"/>'
    + '</linearGradient></defs>'
    + gridHTML
    + yLabelHTML
    + '<line class="chart-axis-line" x1="' + padL + '" y1="' + (padT + chartH) + '" x2="' + (svgW - padR) + '" y2="' + (padT + chartH) + '" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>'
    + '<line class="chart-axis-line" x1="' + (svgW - padR) + '" y1="' + padT + '" x2="' + (svgW - padR) + '" y2="' + (padT + chartH) + '" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>'
    + '<path d="' + areaPath + '" fill="url(#' + gradId + ')"/>'
    + '<path d="' + linePath + '" fill="none" stroke="#f7c948" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
    + dotsHTML
    + xLabelsHTML
    + xTitleHTML;

  container.innerHTML = '';
  container.appendChild(svg);
}

function switchReportTimeline(mode) {
  const data = window._reportTimelineData;
  if (!data) return;
  const { allDates, absenceDates } = data;
  const datesToShow = mode === 'absent' ? allDates.filter(d => absenceDates.includes(d)) : allDates;
  const content = document.getElementById('report-timeline-content');
  if (!content) return;

  // تحديث أزرار الفلتر
  const btnAbsent = document.getElementById('tl-btn-absent');
  const btnAll = document.getElementById('tl-btn-all');
  if (btnAbsent) {
    btnAbsent.style.background = mode==='absent' ? 'rgba(255,107,107,0.2)' : 'transparent';
    btnAbsent.style.color = mode==='absent' ? 'var(--absent)' : 'var(--text-muted)';
    btnAbsent.style.borderColor = mode==='absent' ? 'var(--absent)' : 'rgba(255,255,255,0.2)';
  }
  if (btnAll) {
    btnAll.style.background = mode==='all' ? 'rgba(78,205,196,0.15)' : 'transparent';
    btnAll.style.color = mode==='all' ? 'var(--present)' : 'var(--text-muted)';
    btnAll.style.borderColor = mode==='all' ? 'var(--present)' : 'rgba(255,255,255,0.2)';
  }

  if (datesToShow.length === 0) {
    content.innerHTML = `<div style="text-align:center;padding:16px;color:var(--present);font-size:13px">لا يوجد أي غياب مسجّل</div>`;
    return;
  }
  content.innerHTML = `<div style="position:relative;padding-right:20px">
    <div style="position:absolute;right:8px;top:0;bottom:0;width:2px;background:rgba(255,255,255,0.1)"></div>
    ${datesToShow.map(d => {
      const isAbsent = absenceDates.includes(d);
      const dateObj = new Date(d+'T12:00:00');
      const dayName = dateObj.toLocaleDateString('ar-EG',{weekday:'long',numberingSystem:'latn'});
      const displayDate = dateObj.toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric',numberingSystem:'latn'});
      const dotColor = isAbsent ? 'var(--absent)' : 'var(--present)';
      const bgColor = isAbsent ? 'rgba(255,107,107,0.1)' : 'rgba(78,205,196,0.08)';
      const borderColor = isAbsent ? 'rgba(255,107,107,0.3)' : 'rgba(78,205,196,0.25)';
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;position:relative">
        <div style="position:absolute;right:-16px;width:10px;height:10px;border-radius:50%;background:${dotColor};border:2px solid var(--surface)"></div>
        <div style="background:${bgColor};border:1px solid ${borderColor};border-radius:10px;padding:7px 14px;flex:1;display:flex;align-items:center;justify-content:space-between">
          <div>
            <span style="font-size:13px;font-weight:700">${displayDate}</span>
            <span style="color:var(--text-muted);font-size:12px;margin-right:8px">— ${dayName}</span>
          </div>
          <span style="color:${isAbsent?'var(--absent)':'var(--present)'};font-weight:800;font-size:12px">${isAbsent?'غياب':'حضور'}</span>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

