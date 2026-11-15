/* 04-views.js — رسم صفحات لوحة التحكم */

function pctClass(p) { return p >= 0.9 ? 'ok' : p >= 0.7 ? 'warn' : 'bad'; }
function fmtPct(p) { return isFinite(p) ? Math.round(p * 100) + '%' : '—'; }
function bar(p, cls) { return `<div class="bar ${cls || ''}"><span style="width:${Math.min(100, Math.round(p * 100))}%"></span></div>`; }
function dayLabel(d) { return `${DAY_NAMES[weekday(d)]} ${d.slice(8)}/${d.slice(5, 7)}`; }
function kpi(v, l, cls) { return `<div class="kpi ${cls || ''}"><div class="v">${v}</div><div class="l">${l}</div></div>`; }
function sortableTable(id, head, rows) {
  return `<div class="tbl-wrap"><table id="${id}"><thead><tr>${head.map((h, i) => `<th class="${h.num ? 'num' : ''}" onclick="sortTable('${id}',${i})">${h.t}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
function sortTable(id, col) {
  const tb = document.querySelector('#' + id + ' tbody'); if (!tb) return;
  const rows = [...tb.rows];
  const dir = tb.dataset.sort === String(col) ? -1 : 1;
  tb.dataset.sort = dir === 1 ? String(col) : '';
  const val = r => { const c = r.cells[col]; const v = c.dataset.v !== undefined ? c.dataset.v : c.textContent; return isNaN(parseFloat(v)) ? v : parseFloat(v); };
  rows.sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * dir * (typeof x === 'number' ? -1 : 1); });
  rows.forEach(r => tb.appendChild(r));
}

/* ========== نواقص الغياب ========== */
let GRID_DAY = null;
function renderMissing(miss) {
  const el = document.getElementById('page-missing');
  const cov = miss.expected ? miss.covered / miss.expected : 0;
  const tRows = Object.values(miss.byTeacher).sort((a, b) => b.missing.length - a.missing.length);
  if (!GRID_DAY || !miss.days.includes(GRID_DAY)) GRID_DAY = miss.days[miss.days.length - 1] || null;

  const classRows = Object.values(miss.byClass).map(c => {
    const p = c.expected ? 1 - c.missing / c.expected : 0;
    return `<tr><td><b>${esc(c.cls)}</b></td><td class="num">${c.expected}</td><td class="num">${c.form}</td><td class="num">${c.nojoom + c.unplaced}</td>
      <td class="num" data-v="${c.missing}" style="color:var(--bad);font-weight:800">${c.missing}</td>
      <td data-v="${p}"><div style="display:flex;align-items:center;gap:8px">${bar(p, p < .7 ? 'bad' : p < .9 ? 'warn' : '')}<span class="pct ${pctClass(p)}">${fmtPct(p)}</span></div></td></tr>`;
  });
  const teacherRows = tRows.map(b => {
    const p = b.expected ? b.done / b.expected : 0;
    return `<tr><td><b>${esc(teacherName(b.key))}</b></td><td class="num">${b.expected}</td><td class="num">${b.done}</td>
      <td class="num" data-v="${b.missing.length}"><span class="link" onclick="showTeacherMissing('${esc(b.key)}')">${b.missing.length}</span></td>
      <td data-v="${p}"><span class="pct ${pctClass(p)}">${fmtPct(p)}</span></td></tr>`;
  });
  const noTT = MODEL.central.teachers.filter(t => !t.hasTimetable && t.classes.length).length;

  el.innerHTML = `
    <div class="kpis">
      ${kpi(fmtPct(cov), 'نسبة تسجيل الغياب', pctClass(cov))}
      ${kpi(miss.missing.length.toLocaleString('ar'), 'حصة بدون تسجيل غياب', 'bad')}
      ${kpi(miss.days.length, 'يوم دراسي في المدى')}
      ${kpi(miss.formCount.toLocaleString('ar'), 'تسجيل من النموذج', 'ok')}
      ${kpi(miss.nojoomCount.toLocaleString('ar'), 'تسجيل من نجوم مدرستي', 'star')}
    </div>

    <div class="card">
      <h3>📆 شبكة الحصص اليومية <span class="hint">كل صف × كل حصة — اضغط على الخلية للتفاصيل</span></h3>
      <div class="daynav">
        <button class="btn sm" onclick="gridStep(-1)">→ السابق</button>
        <select id="gridDay" onchange="GRID_DAY=this.value;renderGrid(LAST.miss)">${miss.days.map(d => `<option value="${d}" ${d === GRID_DAY ? 'selected' : ''}>${dayLabel(d)} — ${miss.byDay[d].missing} ناقص</option>`).join('')}</select>
        <button class="btn sm" onclick="gridStep(1)">التالي ←</button>
      </div>
      <div id="gridBox" style="overflow-x:auto"></div>
      <div class="legend">
        <span><i style="background:color-mix(in srgb,var(--ok) 35%,transparent)"></i> مسجّل في النموذج</span>
        <span><i style="background:color-mix(in srgb,var(--star) 35%,transparent)"></i> مسجّل في نجوم مدرستي (حسب الجدول)</span>
        <span><i style="border:1px dashed var(--star)"></i> نجوم مدرستي — حصة غير محددة (المعلم بلا جدول)</span>
        <span><i style="background:color-mix(in srgb,var(--bad) 35%,transparent)"></i> لم يُسجَّل</span>
      </div>
    </div>

    <div class="grid2">
      <div class="card"><h3>🏫 حسب الصف</h3>
        ${sortableTable('tblMissClass', [{ t: 'الصف' }, { t: 'الحصص', num: 1 }, { t: 'النموذج', num: 1 }, { t: 'نجوم', num: 1 }, { t: 'ناقص', num: 1 }, { t: 'النسبة' }], classRows)}
      </div>
      <div class="card"><h3>👩‍🏫 حسب المعلم <span class="hint">${tRows.length ? 'حسب جدول الحصص' : ''}</span></h3>
        ${tRows.length ? sortableTable('tblMissTeacher', [{ t: 'المعلم' }, { t: 'حصصه', num: 1 }, { t: 'سُجّلت', num: 1 }, { t: 'ناقص', num: 1 }, { t: 'النسبة' }], teacherRows)
          : '<div class="muted" style="line-height:1.9">لا يوجد جدول حصص للمعلمين في الملف المركزي، لذلك لا يمكن تحديد المسؤول عن كل حصة ناقصة.</div>'}
        ${noTT && tRows.length ? `<div class="muted" style="font-size:12px;margin-top:8px">⚠️ ${noTT} معلم بدون جدول حصص — حصصهم الناقصة تظهر حسب الصف فقط.</div>` : ''}
      </div>
    </div>

    <div class="card"><h3>📋 قائمة الحصص الناقصة <span class="hint">${miss.missing.length} حصة — الأحدث أولاً</span></h3>
      ${sortableTable('tblMissList', [{ t: 'التاريخ' }, { t: 'اليوم' }, { t: 'الحصة', num: 1 }, { t: 'الصف' }, { t: 'المعلم (حسب الجدول)' }],
        miss.missing.slice().reverse().slice(0, 1500).map(m => `<tr><td>${m.date}</td><td>${DAY_NAMES[m.wd]}</td><td class="num">${m.period}</td><td>${esc(m.cls)}</td>
          <td>${m.teachers.length ? m.teachers.map(k => esc(teacherName(k))).join('، ') : '<span class="muted">غير محدد</span>'}</td></tr>`))}
      ${miss.missing.length > 1500 ? '<div class="muted" style="font-size:12px;margin-top:6px">يُعرض أول 1500 — القائمة كاملة في ملف Excel.</div>' : ''}
    </div>`;
  renderGrid(miss);
}

function gridStep(n) {
  const days = LAST.miss.days, i = days.indexOf(GRID_DAY);
  if (i + n < 0 || i + n >= days.length) return;
  GRID_DAY = days[i + n];
  document.getElementById('gridDay').value = GRID_DAY;
  renderGrid(LAST.miss);
}

function renderGrid(miss) {
  const box = document.getElementById('gridBox');
  if (!box) return;
  if (!GRID_DAY) { box.innerHTML = '<div class="muted">لا توجد أيام دراسية في المدى المحدد.</div>'; return; }
  const P = SETTINGS.periods[weekday(GRID_DAY)] || 0;
  let html = `<table class="slots"><thead><tr><th></th>${Array.from({ length: P }, (_, i) => `<th>${i + 1}</th>`).join('')}</tr></thead><tbody>`;
  miss.classes.forEach(c => {
    html += `<tr><th style="text-align:right;padding-left:8px">${esc(c)}</th>`;
    for (let p = 1; p <= P; p++) {
      const s = miss.slots.get(GRID_DAY + '|' + c + '|' + p);
      const cls = s ? s.src : 'miss';
      const label = !s ? '✗' : s.src === 'form' ? (s.rec.absent.length ? s.rec.absent.length + ' غ' : '✓') : s.src === 'nojoom' ? '⭐' : '⭐?';
      html += `<td><div class="slot ${cls}" title="${esc(slotTitle(s, c, p))}" onclick="showSlot('${GRID_DAY}','${esc(c)}',${p})" style="cursor:pointer">${label}</div></td>`;
    }
    html += '</tr>';
  });
  box.innerHTML = html + '</tbody></table>';
}

function slotTitle(s, c, p) {
  if (!s) {
    const wd = weekday(GRID_DAY);
    const resp = [...MODEL.teachers.values()].filter(t => t.timetable[wd] && t.timetable[wd][p] === c).map(t => t.name);
    return `${c} — الحصة ${p}: لم يُسجَّل الغياب${resp.length ? ' — ' + resp.join('، ') : ''}`;
  }
  if (s.src === 'form') return `${c} — الحصة ${p}: ${teacherName(s.rec.teacherKey)} — ${s.rec.absent.length} غائب — ${s.rec.time}`;
  return `${c} — الحصة ${p}: نجوم مدرستي — ${s.rec.teacherName} — ${s.rec.absent.length} غائب`;
}

function showSlot(d, c, p) {
  const s = LAST.miss.slots.get(d + '|' + c + '|' + p);
  const absent = s ? s.rec.absent : [];
  openModal(`<h2>${esc(c)} — الحصة ${p} — ${dayLabel(d)}</h2>
    <div style="line-height:2">${esc(slotTitle(s, c, p))}</div>
    ${absent.length ? `<div class="card" style="margin-top:10px"><h3>الغائبون (${absent.length})</h3>${absent.map(a => `• ${esc(a.name)} ${a.sid ? '<span class="muted">(' + esc(a.sid) + ')</span>' : ''}`).join('<br>')}</div>` : ''}
    <div class="actions"><button class="btn" onclick="closeModal()">إغلاق</button></div>`);
}

function showTeacherMissing(key) {
  const b = LAST.miss.byTeacher[key];
  if (!b) return;
  openModal(`<h2>${esc(teacherName(key))} — الحصص الناقصة (${b.missing.length})</h2>
    <div class="tbl-wrap"><table><thead><tr><th>التاريخ</th><th>اليوم</th><th class="num">الحصة</th><th>الصف</th></tr></thead><tbody>
    ${b.missing.slice().reverse().map(m => `<tr><td>${m.date}</td><td>${DAY_NAMES[m.wd]}</td><td class="num">${m.period}</td><td>${esc(m.cls)}</td></tr>`).join('')}
    </tbody></table></div><div class="actions"><button class="btn" onclick="closeModal()">إغلاق</button></div>`);
}

/* ========== غياب الطلاب ========== */
function renderAbsence(abs, miss) {
  const el = document.getElementById('page-absence');
  const chronic = abs.students.filter(s => s.dayCount >= SETTINGS.chronicDays);
  const avg = abs.daily.length ? abs.daily.reduce((n, d) => n + d.rate, 0) / abs.daily.length : 0;
  const maxC = Math.max(1, ...abs.daily.map(d => d.count));
  const unknown = MODEL.central.students.size ? abs.students.filter(s => !s.sid || !MODEL.central.students.has(s.sid)).length : 0;
  el.innerHTML = `
    <div class="kpis">
      ${kpi(abs.students.length, 'طالب غاب مرة على الأقل' + (unknown ? ` <span class="muted">(منهم ${unknown} غير موجودين في الملف المركزي)</span>` : ''), 'warn')}
      ${kpi(chronic.length, `غياب متكرر (${SETTINGS.chronicDays} أيام فأكثر)`, 'bad')}
      ${kpi(fmtPct(avg), 'متوسط نسبة الغياب اليومي')}
      ${kpi(abs.totalStudents, 'إجمالي الطلاب')}
    </div>
    <div class="card"><h3>📈 عدد الطلاب الغائبين يومياً</h3>
      <div class="chart">${abs.daily.map(d => `<div class="col" title="${dayLabel(d.date)}: ${d.count} طالب (${fmtPct(d.rate)})"><span style="height:${Math.round(d.count / maxC * 100)}%"></span><small>${d.date.slice(5)}</small></div>`).join('')}</div>
    </div>
    <div class="grid2">
      <div class="card"><h3>🏫 الغياب حسب الصف</h3>
        ${sortableTable('tblAbsClass', [{ t: 'الصف' }, { t: 'الطلاب', num: 1 }, { t: 'غابوا', num: 1 }, { t: 'أيام غياب', num: 1 }, { t: 'حصص غياب', num: 1 }, { t: 'النسبة' }],
          Object.values(abs.byClass).map(b => `<tr><td><b>${esc(b.cls)}</b></td><td class="num">${b.size}</td><td class="num">${b.students}</td><td class="num">${b.studentDays}</td><td class="num">${b.periods}</td>
            <td data-v="${b.rate}"><div style="display:flex;align-items:center;gap:8px">${bar(b.rate * 5, 'bad')}<span class="pct">${fmtPct(b.rate)}</span></div></td></tr>`))}
      </div>
      <div class="card"><h3>🚨 الأكثر غياباً <span class="hint">اضغط على الاسم لعرض التواريخ</span></h3>
        ${sortableTable('tblAbsTop', [{ t: 'الطالب' }, { t: 'الصف' }, { t: 'أيام', num: 1 }, { t: 'حصص', num: 1 }],
          abs.students.slice(0, 300).map((s, i) => `<tr><td><span class="link" onclick="showStudentAbs(${i})">${esc(s.name)}</span>${s.dayCount >= SETTINGS.chronicDays ? ' 🚨' : ''}</td><td>${esc(s.cls)}</td><td class="num">${s.dayCount}</td><td class="num">${s.periods}</td></tr>`))}
      </div>
    </div>`;
}

function showStudentAbs(i) {
  const s = LAST.abs.students[i];
  const byDay = {};
  s.events.forEach(e => (byDay[e.date] = byDay[e.date] || []).push(e));
  openModal(`<h2>${esc(s.name)} ${s.sid ? '<span class="muted">(' + esc(s.sid) + ')</span>' : ''} — ${esc(s.cls)}</h2>
    <div class="muted" style="margin-bottom:8px">${s.dayCount} يوم — ${s.periods} حصة</div>
    <div class="tbl-wrap"><table><thead><tr><th>التاريخ</th><th>اليوم</th><th>الحصص</th><th>سجّله</th></tr></thead><tbody>
    ${Object.keys(byDay).sort().reverse().map(d => `<tr><td>${d}</td><td>${DAY_NAMES[weekday(d)]}</td>
      <td>${byDay[d].map(e => e.period ? e.period : '⭐').join('، ')}</td><td>${[...new Set(byDay[d].map(e => e.teacher))].map(esc).join('، ')}</td></tr>`).join('')}
    </tbody></table></div><div class="actions"><button class="btn" onclick="closeModal()">إغلاق</button></div>`);
}

/* ========== المعلمون ========== */
function renderTeachers(rows, to) {
  const el = document.getElementById('page-teachers');
  const weekAgo = addDays(to, -7);
  const inactive = rows.filter(r => r.t.known && r.t.classes.length && (!r.last || r.last < weekAgo));
  el.innerHTML = `
    <div class="kpis">
      ${kpi(rows.filter(r => r.t.known).length, 'معلم في الملف المركزي')}
      ${kpi(rows.filter(r => r.form).length, 'سجّلوا في النموذج', 'ok')}
      ${kpi(rows.filter(r => r.file).length, 'لديهم ملف نجوم مدرستي', 'star')}
      ${kpi(inactive.length, 'بلا تسجيل آخر 7 أيام', 'bad')}
    </div>
    <div class="card"><h3>👩‍🏫 نشاط المعلمين <span class="hint">في المدى المحدد</span> <button class="btn sm success" style="margin-inline-start:auto" onclick="openReminderAll()">📣 تذكير المعلمين</button></h3>
      ${sortableTable('tblTeachers', [{ t: 'المعلم' }, { t: 'المادة' }, { t: 'الصفوف' }, { t: 'النموذج', num: 1 }, { t: 'نجوم', num: 1 }, { t: 'آخر تسجيل' },
        { t: 'جدول' }, { t: 'ناقص', num: 1 }, { t: 'ملف نجوم مدرستي' }, { t: 'تذكير' }],
        rows.map(r => `<tr style="${!r.t.known ? 'opacity:.75' : ''}"><td><b>${esc(r.t.name)}</b>${!r.t.known ? ' <span class="muted">(غير موجود في المركزي)</span>' : ''}</td>
          <td>${esc((r.t.subjects || []).join('، '))}</td><td style="white-space:normal;max-width:220px">${esc((r.t.classes || []).join('، '))}</td>
          <td class="num">${r.form}</td><td class="num">${r.nojoom}</td>
          <td data-v="${r.last || ''}" style="color:${!r.last || r.last < weekAgo ? 'var(--bad)' : 'inherit'}">${r.last || '—'}</td>
          <td>${r.t.hasTimetable ? '✅' : '—'}</td>
          <td class="num" data-v="${r.missing}">${r.t.hasTimetable ? `<span class="link" onclick="showTeacherMissing('${esc(r.t.key)}')">${r.missing}</span>` : '—'}</td>
          <td>${r.file ? `✅ <span class="muted">${new Date(r.file.modified).toLocaleDateString('ar')}</span>` : '—'}</td>
          <td>${r.t.known ? `<button class="btn sm" title="${r.t.phone ? 'واتساب ' + esc(r.t.phone) : 'لا يوجد رقم'}" onclick="openReminder('${esc(r.t.key)}')">📱${r.t.phone ? '' : '?'}</button>` : ''}</td></tr>`))}
    </div>`;
}

/* ========== نجوم مدرستي ========== */
function renderStars(st) {
  const el = document.getElementById('page-stars');
  if (!MODEL.files.teachers.length) {
    el.innerHTML = `<div class="card"><h3>⭐ نجوم مدرستي</h3><div class="muted" style="line-height:2">اربط «مجلد ملفات المعلمين» لعرض النقاط والمتصدرين على مستوى المدرسة.<br>
      الملفات هي ملفات JSON التي يربطها كل معلم في برنامجه (زر 🔗) داخل مجلده على OneDrive.</div></div>`;
    return;
  }
  const byClass = {};
  st.list.forEach(s => (byClass[s.cls] = byClass[s.cls] || []).push(s));
  el.innerHTML = `
    <div class="kpis">
      ${kpi(st.teachers.length, 'ملف معلم', 'star')}
      ${kpi(st.list.length, 'طالب')}
      ${kpi(st.list.reduce((n, s) => n + s.points, 0).toLocaleString('ar'), 'مجموع النقاط', 'star')}
      ${kpi(st.list.reduce((n, s) => n + s.notes, 0), 'ملاحظة سلوكية')}
    </div>
    <div class="grid2">
      <div class="card"><h3>🏆 المتصدرون على مستوى المدرسة <span class="hint">مجموع نقاط الطالب عند كل معلميه</span>
        <button class="btn sm primary" style="margin-inline-start:auto" onclick="openStarsDash()">🌟 قوائم النجوم</button></h3>
        ${sortableTable('tblStars', [{ t: '#', num: 1 }, { t: 'الطالب' }, { t: 'الصف' }, { t: 'النقاط', num: 1 }, { t: 'المعلمون', num: 1 }],
          st.list.slice(0, 100).map((s, i) => `<tr><td class="num">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td><b>${esc(s.name)}</b></td><td>${esc(s.cls)}</td>
            <td class="num" style="color:var(--star);font-weight:900">${s.points}</td><td class="num" title="${esc(s.teachers.map(t => t.name + ': ' + t.points).join(' | '))}">${s.teachers.length}</td></tr>`))}
      </div>
      <div class="card"><h3>🏫 الأوائل في كل صف</h3>
        ${Object.keys(byClass).sort((a, b) => a.localeCompare(b, 'ar', { numeric: true })).map(c => `<div style="margin-bottom:8px"><b>${esc(c)}:</b> ${byClass[c].slice(0, 3).map((s, i) => `${['🥇', '🥈', '🥉'][i]} ${esc(s.name)} <span class="muted">(${s.points})</span>`).join(' &nbsp; ')}</div>`).join('')}
      </div>
    </div>
    <div class="card"><h3>📁 ملفات المعلمين</h3>
      ${sortableTable('tblFiles', [{ t: 'المعلم' }, { t: 'المادة' }, { t: 'الصفوف' }, { t: 'الطلاب', num: 1 }, { t: 'حصص مسجّلة', num: 1 }, { t: 'النقاط', num: 1 }, { t: 'ملاحظات', num: 1 }, { t: 'آخر تحديث' }],
        st.teachers.map(t => `<tr><td><b>${esc(t.name)}</b><br><span class="muted" style="font-size:11px">${esc(t.file)}</span></td><td>${esc(t.subject)}</td><td style="white-space:normal;max-width:200px">${esc(t.classes.join('، '))}</td>
          <td class="num">${t.students}</td><td class="num">${t.sessions}</td><td class="num">${t.points}</td><td class="num">${t.notes}</td><td>${new Date(t.modified).toLocaleString('ar')}</td></tr>`))}
    </div>`;
}

/* ========== جودة البيانات ========== */
function renderQuality(q) {
  const el = document.getElementById('page-quality');
  document.getElementById('qBadge').textContent = q.length || '';
  el.innerHTML = `<div class="card"><h3>🧹 ملاحظات على البيانات <span class="hint">تصحيحها في الملفات المصدر يحسّن دقة التقارير</span></h3>
    ${q.length ? q.map((x, i) => `<div class="issue"><div><b>⚠️ ${esc(x.title)}</b>
      ${x.detail.length ? `<div class="muted" style="font-size:12px">${x.detail.slice(0, 12).map(esc).join('<br>')}${x.detail.length > 12 ? `<br><span class="link" onclick="showIssue(${i})">عرض الكل (${x.detail.length})</span>` : ''}</div>` : ''}</div>
      <div class="cnt">${x.count}</div></div>`).join('') : '<div class="muted">✅ لا توجد ملاحظات.</div>'}</div>`;
}
function showIssue(i) {
  const x = LAST.quality[i];
  openModal(`<h2>${esc(x.title)}</h2><div style="line-height:1.9;font-size:13px">${x.detail.map(esc).join('<br>')}</div>
    <div class="actions"><button class="btn" onclick="closeModal()">إغلاق</button></div>`);
}
