/* 09-students.js — تبويب «👨‍🎓 الطلاب»: تقرير الطالب في كل المواد (من ملفات نجوم مدرستي) جاهز للطباعة لولي الأمر */
let STU_IDX = null, STU_Q = '', STU_CLS = '';
function stuIndex() {
  const idx = new Map();
  (MODEL.files.teachers || []).forEach(t => {
    const raw = t.raw || {};
    (raw.classes || []).forEach((rc, ci) => {
      const mc = t.classes[ci]; if (!mc) return;
      (rc.students || []).forEach((rs, si) => {
        const ms = mc.students[si]; if (!ms) return;
        const k = ms.sid || ('n:' + mc.name + '|' + normName(ms.name));
        const L = idx.get(k) || []; L.push({ t, rc, rs, raw }); idx.set(k, L);
      });
    });
  });
  return idx;
}
function stuSubjects(list, from, to) {
  return list.map(x => SRPT.fromNojoom(x.rc, x.rs, x.raw.assessments || [], { from, to,
    subject: String(x.t.subject || (MODEL.teachers.get(x.t.key) || {}).subjects?.[0] || '').split('،')[0].trim(), teacher: x.t.name }))
    .sort((a, b) => a.subject.localeCompare(b.subject, 'ar'));
}
function renderStudents(from, to, cls) {
  const box = document.getElementById('page-students'); if (!box) return;
  STU_IDX = stuIndex();
  if (cls !== undefined) STU_CLS = cls || STU_CLS;
  const rows = [];
  const seen = new Set();
  MODEL.central.students.forEach(s => {
    seen.add(s.sid);
    rows.push({ sid: s.sid, name: s.name, cls: s.cls, list: STU_IDX.get(s.sid) || [] });
  });
  STU_IDX.forEach((list, k) => { if (!seen.has(k) && list[0]) rows.push({ sid: k.startsWith('n:') ? '' : k, name: splitNameId(list[0].rs.name).name, cls: list[0].rc.name, list }); });
  const q = normName(STU_Q);
  const shown = rows.filter(r => (!STU_CLS || r.cls === STU_CLS) && (!q || normName(r.name).includes(q) || String(r.sid).includes(STU_Q.trim())))
    .sort((a, b) => String(a.cls).localeCompare(String(b.cls), 'ar', { numeric: true }) || a.name.localeCompare(b.name, 'ar'));
  const F = LAST.from, T = LAST.to;
  const body = shown.slice(0, 600).map(r => {
    const subs = stuSubjects(r.list, F, T);
    const absDays = new Set(subs.flatMap(x => x.absent)).size, pos = subs.reduce((a, x) => a + x.pos.length, 0), neg = subs.reduce((a, x) => a + x.neg.length, 0);
    const key = r.sid || ('n:' + r.cls + '|' + normName(r.name));
    return `<tr><td><span class="link" onclick="stuOpen(${JSON.stringify(key).replace(/"/g, '&quot;')})"><b>${esc(r.name)}</b></span>${r.sid ? `<br><small class="muted">${esc(r.sid)}</small>` : ''}</td>
      <td>${esc(r.cls)}</td><td class="num">${subs.length}</td><td class="num">${absDays}</td><td class="num" style="color:#2ecc71">${pos}</td><td class="num" style="color:${neg ? '#ff6b6b' : 'inherit'}">${neg}</td>
      <td><button class="btn sm" onclick="stuOpen(${JSON.stringify(key).replace(/"/g, '&quot;')})">🖨️ التقرير</button></td></tr>`;
  }).join('');
  box.innerHTML = `
    <div class="card"><h3>👨‍🎓 تقارير الطلاب لولي الأمر <span class="muted" style="font-size:12px">(${F} → ${T}) — كل المواد من ملفات نجوم مدرستي</span></h3>
      <div class="row" style="gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <input type="search" placeholder="🔎 اسم الطالب أو رقمه" value="${esc(STU_Q)}" oninput="STU_Q=this.value;clearTimeout(window._stuT);window._stuT=setTimeout(()=>renderStudents(LAST.from,LAST.to),250)" style="min-width:220px">
        <select onchange="STU_CLS=this.value;renderStudents(LAST.from,LAST.to)"><option value="">كل الصفوف</option>${MODEL.classes.map(c => `<option ${c === STU_CLS ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <span class="muted">${shown.length} طالب</span>
      </div>
      ${shown.length ? `<div class="tbl-wrap"><table><thead><tr><th>الطالب</th><th>الصف</th><th>المواد</th><th>أيام الغياب</th><th>🌟 إيجابية</th><th>📌 للمتابعة</th><th></th></tr></thead><tbody>${body}</tbody></table></div>` : '<div class="muted">لا يوجد طلاب — اربط ملف «بيانات المدرسة» ومجلد ملفات المعلمين.</div>'}
    </div>`;
}
function stuOpen(key) {
  const list = (STU_IDX && STU_IDX.get(key)) || [];
  const cs = MODEL.central.students.get(key);
  const first = list[0];
  const name = cs ? cs.name : first ? splitNameId(first.rs.name).name : key;
  const cls = cs ? cs.cls : first ? first.rc.name : '';
  SRPT.open({ student: { name, sid: cs ? cs.sid : (key.startsWith('n:') ? '' : key), cls },
    school: { name: (MODEL.central.school && MODEL.central.school.name) || 'مدرسة الرازي للبنين' },
    from: LAST.from, to: LAST.to, subjects: stuSubjects(list, LAST.from, LAST.to), single: false });
}
