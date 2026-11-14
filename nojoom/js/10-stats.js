/* 10-stats.js — الخط الزمني للغياب، لوحة الإحصائيات */

// ===== ABSENCE TIMELINE VIEW =====
let absenceView = 'day'; // 'day' | 'timeline'
let timelineFilter = 'all'; // 'all' | 'absent'

function setAbsView(v) {
  absenceView = v;
  document.getElementById('absv-day').className = 'flt-btn' + (v==='day'?' flt-btn-on':'');
  document.getElementById('absv-timeline').className = 'flt-btn' + (v==='timeline'?' flt-btn-on':'');
  const wrap = document.getElementById('timeline-filter-wrap');
  if (wrap) wrap.style.display = v==='timeline' ? 'flex' : 'none';
  renderAbsencePage();
}

function setTimelineFilter(f) {
  timelineFilter = f;
  document.getElementById('tlf-all').className = 'flt-btn' + (f==='all'?' flt-btn-on':'');
  document.getElementById('tlf-absent').className = 'flt-btn' + (f==='absent'?' flt-btn-on':'');
  renderAbsencePage();
}

function renderAbsenceTimeline() {
  const container = document.getElementById('absence-page-content');
  if (!absenceClassId) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📅</div><p>اختر الصف أولاً</p></div>`;
    return;
  }
  const cls = state.classes.find(c => c.id === absenceClassId);
  if (!cls) return;

  const savedDates = [...(cls._savedDates || [])].sort();
  if (!savedDates.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📅</div><p>لا توجد حصص مسجلة لهذا الصف</p></div>`;
    return;
  }

  const students = cls.students;
  let html = `<div class="card" style="overflow-x:auto">
    <div style="padding:14px 18px;border-bottom:1px solid var(--border-color);font-size:14px;font-weight:800">
      📊 الخط الزمني الكامل — ${cls.name} (${savedDates.length} حصة)
    </div>
    <div style="min-width:600px">`;

  students.forEach(s => {
    const rows = savedDates.map(d => {
      const isAbsent = (s.absenceDates||[]).includes(d);
      return { d, isAbsent };
    });
    const filteredRows = timelineFilter === 'absent' ? rows.filter(r => r.isAbsent) : rows;
    if (timelineFilter === 'absent' && !filteredRows.length) return;

    html += `<div style="padding:10px 16px;border-bottom:1px solid var(--border-color)">
      <div style="font-size:13px;font-weight:700;margin-bottom:6px">${s.name}
        <span style="font-size:11px;color:var(--text-muted);font-weight:500">— غاب: ${(s.absenceDates||[]).length} | حضر: ${s.present}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">`;

    filteredRows.forEach(({d, isAbsent}) => {
      const dateObj = new Date(d+'T12:00:00');
      const shortDate = dateObj.toLocaleDateString('ar-EG',{month:'short',day:'numeric',numberingSystem:'latn'});
      html += `<div title="${d}" style="padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;background:${isAbsent?'rgba(255,107,107,0.2)':'rgba(78,205,196,0.15)'};color:${isAbsent?'var(--absent)':'var(--present)'};border:1px solid ${isAbsent?'rgba(255,107,107,0.4)':'rgba(78,205,196,0.3)'}">
        ${isAbsent?'❌':'✅'} ${shortDate}
      </div>`;
    });

    html += `</div></div>`;
  });

  html += `</div></div>`;
  container.innerHTML = html;
}

// ===== STATS DASHBOARD =====
// ===== STATS PAGE STATE =====
let statsSelectedClasses = new Set();
let statsSelectedWeeks   = new Set();
let statsMultiWeek = false;
const _statsCollapsed = {}; // section collapse state

function initStatsPage() {
  renderStatsClassFilter();
  renderStatsWeekButtons();
  renderStatsDashboard();
}

function renderStatsClassFilter() {
  const c = document.getElementById('stats-class-filter');
  if (!c) return;
  c.innerHTML = `
    <button onclick="statsSelectAll()" class="flt-btn ${statsSelectedClasses.size===0?'flt-btn-on':''}">الكل</button>
    ${state.classes.map(cls => `
      <button onclick="statsToggleClass(${cls.id})" class="flt-btn ${statsSelectedClasses.has(cls.id)?'flt-btn-on':''}">${cls.name}</button>
    `).join('')}`;
}

function statsSelectAll() { statsSelectedClasses.clear(); statsSelectedWeeks.clear(); renderStatsClassFilter(); renderStatsWeekButtons(); renderStatsDashboard(); }
function statsToggleClass(id) {
  if (statsSelectedClasses.has(id)) statsSelectedClasses.delete(id);
  else statsSelectedClasses.add(id);
  renderStatsClassFilter(); statsSelectedWeeks.clear(); renderStatsWeekButtons(); renderStatsDashboard();
}

function renderStatsWeekButtons() {
  const bar = document.getElementById('stats-week-buttons');
  if (!bar) return;
  const info = getSchoolInfo();
  if (!info.termStart) {
    bar.innerHTML = '<span style="font-size:11px;color:var(--text-muted);font-style:italic">أدخل تاريخ بداية الفصل لتفعيل فلتر الأسابيع</span>';
    return;
  }
  const clsIds = statsSelectedClasses.size > 0 ? [...statsSelectedClasses] : null;
  const weeks  = getAvailableWeeks(clsIds);
  if (!weeks.length) {
    bar.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">لا توجد بيانات أسابيع بعد</span>';
    return;
  }
  const allActive = statsSelectedWeeks.size === 0;
  bar.innerHTML = `
    <button onclick="setStatsWeek(null)" class="flt-btn ${allActive?'flt-btn-on':''}">الكل</button>
    ${weeks.map(w => {
      const active = statsSelectedWeeks.has(w);
      return `<button onclick="setStatsWeek(${w})" class="flt-btn ${active?'flt-btn-on':''}">أسبوع ${w}</button>`;
    }).join('')}
  `;
  const btn = document.getElementById('stats-multi-btn');
  if (btn) {
    btn.style.background  = statsMultiWeek ? 'rgba(95,216,232,0.15)' : 'rgba(255,255,255,0.06)';
    btn.style.color       = statsMultiWeek ? '#5fd8e8' : 'var(--text-muted)';
    btn.style.borderColor = statsMultiWeek ? 'rgba(95,216,232,0.4)' : 'rgba(255,255,255,0.15)';
  }
}

function setStatsWeek(week) {
  if (week === null) {
    statsSelectedWeeks.clear();
    statsMultiWeek = false;
  } else if (statsMultiWeek) {
    if (statsSelectedWeeks.has(week)) statsSelectedWeeks.delete(week);
    else statsSelectedWeeks.add(week);
    if (statsSelectedWeeks.size === 0) statsMultiWeek = false;
  } else {
    statsSelectedWeeks.clear();
    statsSelectedWeeks.add(week);
  }
  renderStatsWeekButtons();
  renderStatsDashboard();
}

function toggleStatsMultiWeek() {
  statsMultiWeek = !statsMultiWeek;
  if (!statsMultiWeek && statsSelectedWeeks.size > 1) {
    const last = [...statsSelectedWeeks].pop();
    statsSelectedWeeks.clear();
    statsSelectedWeeks.add(last);
  }
  renderStatsWeekButtons();
  renderStatsDashboard();
}

function filterDates(dates, from, to) {
  return dates.filter(d => (!from || d >= from) && (!to || d <= to));
}

// رسم شريط مقارنة
function buildBarChart(data, valueKey, labelFn, colorFn, unit='') {
  const maxVal = Math.max(...data.map(d => d[valueKey] || 0), 1);
  const colors = ['#a29bfe','#5fd8e8','#55efc4','#ffeaa7','#fd79a8','#fdcb6e','#e17055','#00b894'];
  return data.map((d, i) => {
    const val = d[valueKey] || 0;
    const pct = Math.round(val / maxVal * 100);
    const col = typeof colorFn === 'function' ? colorFn(d, i) : colors[i % colors.length];
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div style="min-width:80px;max-width:80px;font-size:11px;font-weight:700;color:var(--text);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${d.name}">${d.name}</div>
      <div style="flex:1;background:rgba(255,255,255,0.06);border-radius:8px;height:24px;overflow:hidden;position:relative">
        <div style="width:${pct}%;height:100%;background:${col};border-radius:8px;transition:width 0.7s;opacity:0.88"></div>
        <span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:800;color:var(--text)">${typeof labelFn==='function'?labelFn(val,d):val}${unit}</span>
      </div>
    </div>`;
  }).join('');
}

// صندوق قابل للطي
function collapsibleSection(id, title, content, defaultOpen = true) {
  const isOpen = (_statsCollapsed[id] !== undefined) ? _statsCollapsed[id] : defaultOpen;
  return `<div class="card mb-4" style="overflow:visible">
    <div class="card-header" style="cursor:pointer;user-select:none" onclick="toggleStatsSection('${id}')">
      <div class="card-title">${title}</div>
      <span id="st-arrow-${id}" style="color:var(--accent);font-size:13px;transition:transform 0.3s;display:inline-block;transform:${isOpen?'rotate(180deg)':'rotate(0deg)'}">▼</span>
    </div>
    <div id="st-body-${id}" style="display:${isOpen?'block':'none'}">${content}</div>
  </div>`;
}

function toggleStatsSection(id) {
  const body = document.getElementById('st-body-' + id);
  const arrow = document.getElementById('st-arrow-' + id);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  _statsCollapsed[id] = !isOpen;
  if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}


// مصفوفة ألوان ثابتة للصفوف — يُستخدم نفس اللون في كل الرسوم البيانية
var CLASS_COLORS = ['#f7c948','#4ecdc4','#a29bfe','#ff6b6b','#5fd8e8','#ff9f43','#25d366','#fd79a8',
                    '#e17055','#74b9ff','#fab1a0','#00cec9','#fdcb6e','#6c5ce7','#b2bec3','#55efc4'];

function getClassColor(classId) {
  // نعطي كل صف لوناً ثابتاً بناءً على موضعه في state.classes
  var idx = state.classes.findIndex(function(c){ return c.id === classId; });
  if (idx < 0) idx = 0;
  return CLASS_COLORS[idx % CLASS_COLORS.length];
}

function buildWeeklyPointsChart(activeCls, weeksFilter) {
  // نجمع أسابيع الفصل المتاحة (من pointsLog ومن _savedDates)
  var allWeeks = new Set();
  var info = getSchoolInfo();
  activeCls.forEach(function(cls) {
    cls.students.forEach(function(s) {
      (s.pointsLog||[]).forEach(function(e) {
        if (e.termWeek !== null && e.termWeek !== undefined) allWeeks.add(e.termWeek);
      });
    });
    // إضافة الأسابيع من _savedDates
    if (info.termStart) {
      (cls._savedDates||[]).forEach(function(d) {
        var tw = getTermWeek(d);
        if (tw !== null) allWeeks.add(tw);
      });
    }
  });
  var weeks = Array.from(allWeeks).sort(function(a,b){return a-b;});
  // إذا كان هناك فلتر أسابيع، نستخدمها فقط
  if (weeksFilter && weeksFilter.size > 0) {
    weeks = weeks.filter(function(w){ return weeksFilter.has(w); });
  }
  if (!weeks.length || activeCls.length < 1) return '';

  var svgW = 560, svgH = 220;
  var padL = 16, padR = 44, padT = 28, padB = 44;
  var chartW = svgW - padL - padR, chartH = svgH - padT - padB;

  // حساب متوسط النقاط لكل صف لكل أسبوع
  // نحسب متوسط مجموع نقاط كل طالب (من pointsLog) لكل أسبوع
  var series = activeCls.map(function(cls) {
    var color = getClassColor(cls.id);
    var pts = weeks.map(function(w) {
      var total = 0, count = 0;
      cls.students.forEach(function(s) {
        // نحسب مجموع نقاط هذا الطالب في هذا الأسبوع
        var wLog = (s.pointsLog||[]).filter(function(e){ return e.termWeek === w; });
        // نتحقق إذا كان هذا الأسبوع مسجلاً (حضور أو نقاط)
        var hasData = wLog.length > 0 || (cls._savedDates||[]).some(function(d){ return getTermWeek(d) === w; });
        if (hasData) {
          var weekPts = wLog.reduce(function(sum,e){ return sum + (e.pts||0); }, 0);
          total += weekPts;
          count++;
        }
      });
      return count > 0 ? Math.round(total / count * 10) / 10 : null; // null = لا بيانات
    });
    return { name: cls.name, color: color, pts: pts, id: cls.id };
  });

  // فلتر الصفوف التي لديها على الأقل قيمة واحدة غير null
  var activeSeries = series.filter(function(sr){
    return sr.pts.some(function(v){ return v !== null; });
  });
  if (!activeSeries.length) return '';

  var maxVal = 1;
  activeSeries.forEach(function(sr){
    sr.pts.forEach(function(v){ if(v !== null && v > maxVal) maxVal = v; });
  });

  // شبكة
  var gridHTML = [0,1,2,3,4].map(function(i) {
    var yy = (padT + (i/4)*chartH).toFixed(1);
    var val = Math.round(maxVal*(1-i/4));
    return '<line x1="'+padL+'" y1="'+yy+'" x2="'+(svgW-padR)+'" y2="'+yy+'" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>'
          +'<text x="'+(svgW-padR+5)+'" y="'+(parseFloat(yy)+4)+'" font-size="9" fill="rgba(255,255,255,0.4)" font-family="Tajawal,sans-serif">'+val+'</text>';
  }).join('');

  // تسميات X
  var xLabels = weeks.map(function(w, i) {
    var x = weeks.length===1 ? padL+chartW/2 : padL+(i/(weeks.length-1))*chartW;
    return '<text x="'+x.toFixed(1)+'" y="'+(padT+chartH+16)+'" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.5)" font-family="Tajawal,sans-serif">W'+w+'</text>';
  }).join('');

  // خطوط كل صف
  var linesHTML = activeSeries.map(function(sr) {
    // نبني path فقط للنقاط غير null
    var pathParts = [];
    var dotsHTML = '';
    sr.pts.forEach(function(v, i) {
      var x = weeks.length===1 ? padL+chartW/2 : padL+(i/(weeks.length-1))*chartW;
      if (v === null) return; // لا بيانات لهذا الأسبوع
      var y = padT + chartH - (v/maxVal)*chartH;
      if (pathParts.length === 0) pathParts.push('M'+x.toFixed(1)+','+y.toFixed(1));
      else pathParts.push('L'+x.toFixed(1)+','+y.toFixed(1));
      dotsHTML += '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="4.5" fill="'+sr.color+'" stroke="#1a1530" stroke-width="1.5"/>';
      // label القيمة فوق النقطة
      dotsHTML += '<text x="'+x.toFixed(1)+'" y="'+(y-8).toFixed(1)+'" text-anchor="middle" font-size="9" fill="'+sr.color+'" font-family="Tajawal,sans-serif" font-weight="bold">'+v+'</text>';
    });
    if (!pathParts.length) return '';
    return '<path d="'+pathParts.join(' ')+'" fill="none" stroke="'+sr.color+'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>'+dotsHTML;
  }).join('');

  // legend منفصل أعلى الرسم
  var legendHTML = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;padding:10px 12px;background:rgba(255,255,255,0.04);border-radius:10px;border:1px solid rgba(255,255,255,0.08)">'
    + '<span style="font-size:11px;font-weight:700;color:var(--text-muted);margin-left:4px;align-self:center">📊 مفتاح الألوان:</span>'
    + activeSeries.map(function(sr){
      return '<div style="display:flex;align-items:center;gap:5px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:3px 10px">'
            +'<div style="width:22px;height:4px;background:'+sr.color+';border-radius:2px;flex-shrink:0"></div>'
            +'<span style="font-size:12px;font-weight:700;color:'+sr.color+'">'+sr.name+'</span>'
            +'</div>';
    }).join('') + '</div>';

  var svg = '<svg viewBox="0 0 '+svgW+' '+svgH+'" style="width:100%;display:block" xmlns="http://www.w3.org/2000/svg">'
    + gridHTML
    + '<line x1="'+padL+'" y1="'+(padT+chartH)+'" x2="'+(svgW-padR)+'" y2="'+(padT+chartH)+'" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>'
    + '<line x1="'+(svgW-padR)+'" y1="'+padT+'" x2="'+(svgW-padR)+'" y2="'+(padT+chartH)+'" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>'
    + linesHTML + xLabels
    + '</svg>';

  return '<div style="background:var(--surface2);border-radius:12px;padding:14px 16px;border:1px solid var(--border-color)">'
    +'<div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:10px">📈 تطور متوسط نقاط الصفوف أسبوعياً</div>'
    + legendHTML + svg + '</div>';
}
function renderStatsDashboard() {
  const container = document.getElementById('stats-dashboard');
  if (!container) return;
  if (!state.classes.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📊</div><p>لا توجد بيانات بعد</p></div>`;
    return;
  }

  renderStatsWeekButtons();
  const weeksFilter = statsSelectedWeeks.size > 0 ? statsSelectedWeeks : null;
  const activeCls = state.classes.filter(c =>
    statsSelectedClasses.size === 0 || statsSelectedClasses.has(c.id)
  );

  // حساب البيانات — إذا في أسابيع محددة نستخدم pointsLog، وإلا نستخدم البيانات الكاملة
  const clsStats = activeCls.map(cls => {
    const sts = cls.students;
    let totalPresent = 0, totalAbsent = 0, totalPart = 0;
    let posNotes = 0, negNotes = 0, totalPts = 0;
    if (weeksFilter) {
      // من pointsLog حسب الأسابيع
      sts.forEach(s => {
        const log = (s.pointsLog||[]).filter(e => weeksFilter.has(e.termWeek));
        totalPresent += log.filter(e=>e.type==='attendance').length;
        totalPart    += log.filter(e=>e.type==='participation').reduce((a,e)=>a+e.pts,0);
        totalPts     += log.reduce((a,e)=>a+e.pts,0);
      });
      // الملاحظات بالأسابيع
      sts.forEach(s => {
        (s.behaviorNotes||[]).forEach(n => {
          const w = n.isoDate ? getTermWeek(n.isoDate) : null;
          if (w && weeksFilter.has(w)) {
            if (n.type==='positive') posNotes++; else negNotes++;
          }
        });
      });
      totalAbsent = 0; // لا يمكن حسابه بدقة من pointsLog
    } else {
      const savedInRange = cls._savedDates || [];
      sts.forEach(s => {
        const absentInRange = (s.absenceDates||[]).filter(d=>savedInRange.includes(d)).length;
        totalPresent += Math.max(0, savedInRange.length - absentInRange);
        totalAbsent  += absentInRange;
        totalPart    += s.participation||0;
        posNotes     += (s.behaviorNotes||[]).filter(n=>n.type==='positive').length;
        negNotes     += (s.behaviorNotes||[]).filter(n=>n.type!=='positive').length;
        totalPts     += s.points||0;
      });
    }
    const attRate = (totalPresent + totalAbsent) > 0
      ? Math.round(totalPresent / (totalPresent + totalAbsent) * 100) : 0;
    const avgPts = sts.length ? Math.round(totalPts / sts.length) : 0;
    const sessions = weeksFilter ? null : (cls._savedDates||[]).length;
    return { name: cls.name, id: cls.id, count: sts.length, sessions,
      present: totalPresent, absent: totalAbsent, attRate,
      totalPart, posNotes, negNotes, avgPts };
  });

  // إجماليات
  const totalStudents = clsStats.reduce((a,c)=>a+c.count,0);
  const totalPresent  = clsStats.reduce((a,c)=>a+c.present,0);
  const totalAbsent   = clsStats.reduce((a,c)=>a+c.absent,0);
  const totalPart     = clsStats.reduce((a,c)=>a+c.totalPart,0);
  const totalPos      = clsStats.reduce((a,c)=>a+c.posNotes,0);
  const totalNeg      = clsStats.reduce((a,c)=>a+c.negNotes,0);
  const avgAtt        = (totalPresent+totalAbsent)>0 ? Math.round(totalPresent/(totalPresent+totalAbsent)*100) : 0;
  const allAssessments = state.assessments || [];
  let totalGraded = 0, totalFailures = 0;
  allAssessments.forEach(a => {
    const scores = Object.values(a.scores||{}).filter(v=>v!==''&&v!==undefined);
    totalGraded  += scores.length;
    totalFailures += scores.filter(v=>Math.round((parseFloat(v)/a.maxScore)*100)<50).length;
  });

  // ===== بطاقات الملخص =====
  const summaryCards = `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:24px">
    <div class="stat-card yellow"><div class="stat-icon">👨‍🎓</div><div class="stat-value" style="color:var(--accent)">${totalStudents}</div><div class="stat-label">إجمالي الطلاب</div></div>
    <div class="stat-card teal"><div class="stat-icon">✅</div><div class="stat-value" style="color:var(--present)">${avgAtt}%</div><div class="stat-label">متوسط الحضور</div></div>
    <div class="stat-card red"><div class="stat-icon">❌</div><div class="stat-value" style="color:var(--absent)">${totalAbsent}</div><div class="stat-label">إجمالي الغيابات</div></div>
    <div class="stat-card purple"><div class="stat-icon">✋</div><div class="stat-value" style="color:#a29bfe">${totalPart}</div><div class="stat-label">إجمالي المشاركات</div></div>
    <div class="stat-card yellow"><div class="stat-icon">🌟</div><div class="stat-value" style="color:var(--present)">${totalPos}</div><div class="stat-label">ملاحظات إيجابية</div></div>
    <div class="stat-card red"><div class="stat-icon">⚠️</div><div class="stat-value" style="color:var(--absent)">${totalNeg}</div><div class="stat-label">ملاحظات سلبية</div></div>
  </div>`;

  // ===== مقارنة نسب الحضور =====
  const attContent = `<div style="padding:16px 20px">
    ${buildBarChart(clsStats, 'attRate', v=>`${v}%`,
      (d) => d.attRate >= 75 ? 'var(--present)' : d.attRate >= 50 ? '#ff9f43' : 'var(--absent)')}
  </div>`;

  // ===== مقارنة المشاركات =====
  const partContent = `<div style="padding:16px 20px">
    <div style="font-size:11px;font-weight:800;color:var(--text-muted);margin-bottom:10px">إجمالي المشاركات</div>
    ${buildBarChart(clsStats, 'totalPart', null, null)}
  </div>`;

  // ===== مقارنة الملاحظات السلوكية =====
  const notesContent = `<div style="padding:16px 20px">
    <div style="font-size:11px;font-weight:800;color:var(--text-muted);margin-bottom:10px">🌟 الملاحظات الإيجابية</div>
    ${buildBarChart(clsStats, 'posNotes', null, ()=>'var(--present)')}
    <div style="font-size:11px;font-weight:800;color:var(--text-muted);margin:14px 0 10px">⚠️ الملاحظات السلبية</div>
    ${buildBarChart(clsStats, 'negNotes', null, ()=>'var(--absent)')}
  </div>`;

  // ===== مقارنة التقييمات =====
  let gradesContent = '';
  if (allAssessments.length) {
    // فلتر التقييم
    const assessId = parseInt(document.getElementById('stats-assess-select')?.value) || allAssessments[0]?.id;
    const selAssess = allAssessments.find(a => a.id === assessId) || allAssessments[0];
    const assessSelect = allAssessments.length > 1 ? `
      <div style="padding:12px 16px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--text-muted)">التقييم:</span>
        <select class="select" id="stats-assess-select" onchange="renderStatsDashboard()" style="width:auto;padding:4px 10px;font-size:12px">
          ${allAssessments.map(a=>`<option value="${a.id}" ${a.id===selAssess?.id?'selected':''}>${a.name} (/${a.maxScore})</option>`).join('')}
        </select>
      </div>` : '';

    const clsGrades = activeCls.map(cls => {
      if (!selAssess?.classIds?.includes(cls.id)) return { name: cls.name, avgPct: null };
      const scores = cls.students.map(s => selAssess.scores?.[s.id]).filter(v=>v!==undefined&&v!=='').map(v=>parseFloat(v));
      const avg = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : null;
      return { name: cls.name, avgPct: avg !== null ? Math.round(avg/selAssess.maxScore*100) : null };
    }).filter(d => d.avgPct !== null);

    gradesContent = assessSelect + `<div style="padding:16px 20px">
      ${clsGrades.length ? buildBarChart(clsGrades, 'avgPct', v=>`${v}%`,
        (d) => d.avgPct >= 75 ? 'var(--present)' : d.avgPct >= 50 ? '#ff9f43' : 'var(--absent)')
        : `<div style="color:var(--text-muted);font-size:13px;padding:8px 0">لا توجد درجات مدخلة لهذا التقييم</div>`}
    </div>`;
  } else {
    gradesContent = `<div style="padding:16px;color:var(--text-muted);font-size:13px">لا توجد تقييمات مضافة بعد</div>`;
  }

  // ===== إحصائيات كل صف (ملخص) =====
  const classCardsContent = `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;padding:16px">
  ${clsStats.map(d => {
    const rateColor = d.attRate>=75?'var(--present)':d.attRate>=50?'#ff9f43':'var(--absent)';
    return `<div style="background:var(--surface2);border-radius:12px;padding:14px;border:1px solid var(--border-color)">
      <div style="font-size:14px;font-weight:800;margin-bottom:10px">🏫 ${d.name} <span style="font-size:11px;color:var(--text-muted);font-weight:500">(${d.count} طالب)</span></div>
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-bottom:4px">
          <span>نسبة الحضور</span><span style="color:${rateColor}">${d.attRate}%</span>
        </div>
        <div style="background:rgba(255,255,255,0.07);border-radius:6px;height:6px;overflow:hidden">
          <div style="width:${d.attRate}%;height:100%;background:${rateColor};border-radius:6px"></div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        <span style="font-size:11px;background:rgba(162,155,254,0.2);color:#1e293b;border-radius:5px;padding:2px 7px;font-weight:700">✋ ${d.totalPart} مشاركة</span>
        <span style="font-size:11px;background:rgba(78,205,196,0.2);color:#1e293b;border-radius:5px;padding:2px 7px;font-weight:700">🌟 ${d.posNotes}</span>
        <span style="font-size:11px;background:rgba(255,107,107,0.2);color:#1e293b;border-radius:5px;padding:2px 7px;font-weight:700">⚠️ ${d.negNotes}</span>
        <span style="font-size:11px;background:rgba(247,201,72,0.2);color:#1e293b;border-radius:5px;padding:2px 7px;font-weight:700">⭐ متوسط ${d.avgPts}</span>
      </div>
    </div>`;
  }).join('')}
  </div>`;

  const weeklyChartHTML = buildWeeklyPointsChart(activeCls, weeksFilter);
  const weeklyChartSection = weeklyChartHTML
    ? collapsibleSection('wkpts', '📈 تطور نقاط الصفوف أسبوعياً', `<div style="padding:14px 16px">${weeklyChartHTML}</div>`, true)
    : '';

  container.innerHTML = summaryCards
    + weeklyChartSection
    + collapsibleSection('att',   '📅 مقارنة نسب الحضور بين الصفوف',         attContent,    true)
    + collapsibleSection('part',  '✋ مقارنة المشاركات بين الصفوف',            partContent,   true)
    + collapsibleSection('notes', '📝 مقارنة الملاحظات السلوكية بين الصفوف',   notesContent,  true)
    + (allAssessments.length ? collapsibleSection('grades', '📊 مقارنة متوسطات التقييمات بين الصفوف', gradesContent, true) : '')
    + collapsibleSection('cls',   '🏫 ملخص كل صف',                           classCardsContent, false);
}

