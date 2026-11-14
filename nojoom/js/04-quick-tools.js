/* 04-quick-tools.js — التحديث السريع، بطاقات الطباعة، تصدير/استيراد الحسابات JSON، العداد المؤقت */

// ============================================================
// ===== إضافات: تحديث سريع / بطاقات طباعة / JSON للحسابات =====
// ============================================================

// ----- أدوات مساعدة عامة -----
function _acctAllStudents() {
  const out = [];
  state.classes.forEach(cls => cls.students.forEach(s => out.push({ cls, s })));
  return out;
}
function _acctNormName(n) { return String(n || '').replace(/\s+/g, ' ').trim(); }
function _acctExtractId(local) { const m = String(local || '').match(/(\d{5,})/); return m ? m[1] : ''; }
// رقم الطالب داخل نجومي يوضع بين قوسين في نهاية الاسم، مثال: "محمد علي أحمد (2016001234)"
function _acctNameId(name) { const m = String(name || '').match(/\((\d{4,})\)\s*$/); return m ? m[1] : ''; }
function _acctBaseName(name) { return String(name || '').replace(/\s*\(\d{4,}\)\s*$/, '').trim(); }
function _acctDetectType(email) {
  email = (email || '').toLowerCase();
  if (email.indexOf('@moe.sch.ae') !== -1) return 'gov';
  if (email.indexOf('@alefedu.net') !== -1) return 'alif';
  return 'unknown';
}
const _ACCT_EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
function _acctParseLine(line) {
  line = line.trim();
  if (!line) return null;
  const m = line.match(_ACCT_EMAIL_RE);
  if (!m) return null;
  const email = m[0];
  const before = line.slice(0, m.index);
  const after = line.slice(m.index + email.length);
  const name = before.replace(/[(（]\s*$/, '').trim();
  const pass = after.replace(/^[\s)）:：\-–—]+/, '').trim();
  if (!pass) return null;
  return { name, email, pass };
}

// ----- تحديث سريع -----
function showQuickUpdateModal() {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  openModal(`
    <div class="modal-title">⚡ تحديث سريع لحسابات الطلاب</div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;line-height:1.8">
      الصق سطراً أو عدة أسطر — سيتم اكتشاف الإيميل تلقائياً، وأخذ ما بعده بالسطر ككلمة مرور (بأي فاصل: نقطتين، مسافة، شرطة).
      يحاول البرنامج مطابقة كل سطر مع طالب موجود بالاسم أو بالرقم داخل الإيميل، ويمكنك التعديل يدوياً قبل التطبيق.
    </div>
    <textarea class="input" id="qu-text" rows="5" style="font-family:'Courier New',monospace;direction:ltr;text-align:left;resize:vertical"
      placeholder="Humaid Khalid Abdulla Ali Al Balooshi (stum2018017515@moe.sch.ae) : Ubc5MbGuGurA
2018016503@alefedu.net - blackstrawberry88"></textarea>
    <button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="analyzeQuickUpdate()">🔎 تحليل النص</button>
    <div id="qu-preview" style="margin-top:14px"></div>
    <div class="modal-actions" style="margin-top:14px">
      <button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button>
    </div>
  `);
}

function analyzeQuickUpdate() {
  const text = document.getElementById('qu-text').value;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const flat = _acctAllStudents();
  const results = lines.map(line => {
    const parsed = _acctParseLine(line);
    if (!parsed) return { ok: false, raw: line, reason: 'تعذّر العثور على إيميل وكلمة مرور بهذا السطر' };
    const type = _acctDetectType(parsed.email);
    const localPart = parsed.email.split('@')[0] || '';
    const id = _acctExtractId(localPart);
    let candidates = [];
    // 1) الطريقة الأساسية: البحث عن أي طالب يحتوي اسمه على نفس الرقم المستخرج من الإيميل (أي مكان بالاسم)
    if (id) {
      candidates = flat.filter(o => (o.s.sid && o.s.sid === id) || String(o.s.name || '').includes(id));
    }
    // 2) مطابقة عبر رقم موجود مسبقاً بأحد حسابات الطالب (تحديثات لاحقة)
    if (!candidates.length && id) {
      candidates = flat.filter(o => {
        const gid = _acctExtractId((o.s.govAccount?.user || '').split('@')[0] || '');
        const aid = _acctExtractId((o.s.alifAccount?.user || '').split('@')[0] || '');
        return (gid && gid === id) || (aid && aid === id);
      });
    }
    // 3) مطابقة بالاسم (مع تجاهل الرقم بين القوسين إن وجد في أي من الطرفين)
    if (!candidates.length && parsed.name) {
      const nn = _acctNormName(_acctBaseName(parsed.name));
      candidates = flat.filter(o => _acctNormName(_acctBaseName(o.s.name)) === nn);
    }
    return { ok: true, raw: line, name: parsed.name, email: parsed.email, pass: parsed.pass, type, candidates };
  });
  window._quResults = results;
  renderQuickPreview(results);
}

function renderQuickPreview(results) {
  const box = document.getElementById('qu-preview');
  if (!results.length) { box.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">لم يتم العثور على أسطر صالحة.</div>'; return; }
  let html = `<div style="font-size:12px;font-weight:800;color:var(--accent);margin-bottom:8px">نتيجة التحليل (${results.length} سطر)</div>`;
  results.forEach((r, i) => {
    if (!r.ok) {
      html += `<div style="border:1px solid rgba(255,107,107,0.4);background:rgba(255,107,107,0.08);border-radius:10px;padding:9px 11px;margin-bottom:8px;font-size:12px">
        <b>${r.raw}</b><br><span style="color:var(--absent)">⚠️ ${r.reason}</span></div>`;
      return;
    }
    const studentOptions = ['<option value="">— اختر الطالب —</option>'].concat(
      state.classes.map(cls => {
        const opts = cls.students.map(s => {
          const sel = r.candidates.some(c => c.s.id === s.id) ? 'selected' : '';
          return `<option value="${cls.id}|${s.id}" ${sel}>${s.name}</option>`;
        }).join('');
        return `<optgroup label="🏫 ${cls.name}">${opts}</optgroup>`;
      })
    ).join('');
    const ambiguous = r.candidates.length > 1;
    const matched = r.candidates.length === 1;
    const typeOpts = `
      <option value="gov" ${r.type === 'gov' ? 'selected' : ''}>وزاري</option>
      <option value="alif" ${r.type === 'alif' ? 'selected' : ''}>ألف</option>
      ${r.type === 'unknown' ? '<option value="skip" selected>تجاهل (نوع غير معروف)</option>' : ''}
    `;
    html += `<div style="border:1px solid ${matched ? 'rgba(78,205,196,0.4)' : 'rgba(247,201,72,0.35)'};background:${matched ? 'rgba(78,205,196,0.07)' : 'rgba(247,201,72,0.06)'};border-radius:10px;padding:10px 11px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px">
        <b style="font-size:12.5px">${r.name || r.email}</b>
        <label style="font-size:11px;display:flex;align-items:center;gap:4px"><input type="checkbox" class="qu-apply" data-i="${i}" ${matched ? 'checked' : ''}> تطبيق</label>
      </div>
      ${ambiguous ? `<div style="font-size:10.5px;color:var(--accent);margin-bottom:5px">⚠️ أكثر من طالب بنفس الاسم — تحقق من الاختيار</div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <select class="input qu-student" data-i="${i}" style="flex:1;min-width:150px;font-size:12px;padding:6px 8px">${studentOptions}</select>
        <select class="input qu-type" data-i="${i}" style="width:110px;font-size:12px;padding:6px 8px">${typeOpts}</select>
      </div>
      <div style="font-family:'Courier New',monospace;font-size:11px;direction:ltr;text-align:left;color:var(--text-muted);margin-top:6px">${r.email} → ${r.pass}</div>
    </div>`;
  });
  html += `<button class="btn btn-success" style="width:100%;margin-top:6px" onclick="applyQuickUpdate()">✅ تطبيق التحديثات المحددة</button>`;
  box.innerHTML = html;
}

function applyQuickUpdate() {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const results = window._quResults || [];
  let count = 0;
  document.querySelectorAll('.qu-apply:checked').forEach(cb => {
    const i = parseInt(cb.getAttribute('data-i'), 10);
    const r = results[i];
    if (!r) return;
    const studentSel = document.querySelector(`.qu-student[data-i="${i}"]`);
    const typeSel = document.querySelector(`.qu-type[data-i="${i}"]`);
    if (!studentSel || !studentSel.value || !typeSel || typeSel.value === 'skip') return;
    const [clsId, stId] = studentSel.value.split('|').map(Number);
    const cls = state.classes.find(c => c.id === clsId);
    const s = cls?.students.find(st => st.id === stId);
    if (!s) return;
    if (typeSel.value === 'gov') {
      if (!s.govAccount) s.govAccount = { user: '', pass: '' };
      if ((s.govAccount.pass || '') !== r.pass) s.govPassUpdated = Date.now();
      s.govAccount.user = r.email; s.govAccount.pass = r.pass;
    } else {
      if (!s.alifAccount) s.alifAccount = { user: '', pass: '' };
      if ((s.alifAccount.pass || '') !== r.pass) s.alifPassUpdated = Date.now();
      s.alifAccount.user = r.email; s.alifAccount.pass = r.pass;
    }
    count++;
  });
  if (!count) { toast('لم يتم تحديد أي تحديث للتطبيق', '⚠️'); return; }
  save(); renderClasses();
  document.getElementById('qu-text').value = '';
  document.getElementById('qu-preview').innerHTML = '';
  toast(`تم تحديث ${count} حساب بنجاح`, '⚡');
}

// ----- بطاقات الطباعة -----
let _pcActiveClass = 'all';
let _pcLayout = '4';

function showPrintCardsModal() {
  _pcActiveClass = 'all';
  _pcLayout = '4';
  openModal(`
    <div class="modal-title">🖨️ بطاقات الطباعة</div>
    <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px">🏫 الصف</div>
    <div id="pc-class-filter" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px"></div>
    <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px">🧾 عدد البطاقات بالصفحة</div>
    <div id="pc-layout-filter" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <label style="font-size:12px;display:flex;align-items:center;gap:5px"><input type="checkbox" id="pc-select-all" onchange="pcToggleAll(this)"> تحديد الكل</label>
      <span id="pc-count" style="font-size:11px;color:var(--text-muted)"></span>
    </div>
    <div id="pc-student-list" style="max-height:280px;overflow-y:auto;border:1px solid var(--border-color);border-radius:10px;padding:8px"></div>
    <div class="modal-actions" style="margin-top:14px">
      <button class="btn btn-primary" style="flex:1" onclick="printSelectedCards()">🖨️ طباعة البطاقات المحددة</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button>
    </div>
  `);
  renderPcClassFilter();
  renderPcLayoutFilter();
  renderPcStudentList();
}
function renderPcClassFilter() {
  const el = document.getElementById('pc-class-filter');
  const chips = [{ id: 'all', name: 'كل الصفوف' }, ...state.classes];
  el.innerHTML = chips.map(c => `<button class="flt-btn" onclick="pcSetClass('${c.id}')" id="pc-cls-${c.id}">🏫 ${c.name}</button>`).join('');
  document.querySelectorAll('#pc-class-filter .flt-btn').forEach(b => b.classList.remove('flt-btn-on'));
  const active = document.getElementById('pc-cls-' + _pcActiveClass);
  if (active) active.classList.add('flt-btn-on');
}
function pcSetClass(id) {
  _pcActiveClass = (id === 'all') ? 'all' : Number(id);
  renderPcClassFilter();
  renderPcStudentList();
}
function renderPcLayoutFilter() {
  const el = document.getElementById('pc-layout-filter');
  const opts = [{ v: '4', l: '4 بالصفحة' }, { v: '2', l: 'بطاقتان' }, { v: '1', l: 'صفحة كاملة' }];
  el.innerHTML = opts.map(o => `<button class="flt-btn ${_pcLayout === o.v ? 'flt-btn-on' : ''}" id="pc-lay-${o.v}" onclick="pcSetLayout('${o.v}')">${o.l}</button>`).join('');
}
function pcSetLayout(v) {
  _pcLayout = v;
  document.querySelectorAll('#pc-layout-filter .flt-btn').forEach(b => b.classList.remove('flt-btn-on'));
  document.getElementById('pc-lay-' + v)?.classList.add('flt-btn-on');
}
function renderPcStudentList() {
  const list = _acctAllStudents().filter(o => _pcActiveClass === 'all' || o.cls.id === _pcActiveClass);
  const box = document.getElementById('pc-student-list');
  document.getElementById('pc-count').textContent = list.length + ' طالب';
  if (!list.length) { box.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:10px">لا يوجد طلاب.</div>'; return; }
  box.innerHTML = list.map(o => `
    <label style="display:flex;align-items:center;gap:8px;padding:5px 4px;font-size:12.5px;border-bottom:1px solid var(--border-color)">
      <input type="checkbox" class="pc-chk" data-cls="${o.cls.id}" data-st="${o.s.id}">
      <span style="flex:1">${o.s.name}</span>
      <span style="font-size:10px;color:var(--text-muted)">${o.cls.name}</span>
    </label>`).join('');
}
function pcToggleAll(cb) {
  document.querySelectorAll('.pc-chk').forEach(x => x.checked = cb.checked);
}
function _pcPassHTML(pw) {
  if (!pw) return '—';
  let out = '';
  for (const ch of String(pw)) out += (ch >= 'A' && ch <= 'Z') ? `<b>${ch}</b>` : ch;
  return out;
}
function _pcCardHTML(s, className) {
  const info = getSchoolInfo();
  const school = info.schoolName || 'بطاقة دخول الطالب';
  const gov = s.govAccount || {};
  const alif = s.alifAccount || {};
  return `<div class="pcard">
    <div class="ph-head">
      <div><div class="ph-name">${s.name}</div><div class="ph-meta">الصف: ${className}</div></div>
      <div class="ph-school">${school}</div>
    </div>
    <div class="ph-sec">
      <div class="ph-lbl">الحساب الوزاري</div>
      <div class="ph-em">${gov.user || '—'}</div>
      <div class="ph-pw">${_pcPassHTML(gov.pass)}</div>
    </div>
    <div class="ph-sec">
      <div class="ph-lbl">منصة ألف</div>
      <div class="ph-em">${alif.user || '—'}</div>
      <div class="ph-pw">${_pcPassHTML(alif.pass)}</div>
    </div>
    ${s.parentPhone ? `<div class="ph-phone">واتساب ولي الأمر: ${s.parentPhone}</div>` : ''}
  </div>`;
}
function printSelectedCards() {
  const chosen = [];
  document.querySelectorAll('.pc-chk:checked').forEach(x => {
    const clsId = Number(x.getAttribute('data-cls'));
    const stId = Number(x.getAttribute('data-st'));
    const cls = state.classes.find(c => c.id === clsId);
    const s = cls?.students.find(st => st.id === stId);
    if (s) chosen.push({ s, className: cls.name });
  });
  if (!chosen.length) { toast('لم يتم تحديد أي طالب', '⚠️'); return; }
  const cardsHTML = chosen.map(o => _pcCardHTML(o.s, o.className)).join('');
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
    <title>بطاقات الطلاب</title>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet">
    <style>
      @page { size: A4 landscape; margin: 8mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: 'Tajawal', sans-serif; background:#fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .pcards { display:grid; gap:3mm; }
      .pcard { border: 1.4px solid #999; border-radius: 3mm; padding: 3mm 4mm; page-break-inside: avoid; display:flex; flex-direction:column; justify-content:space-evenly; overflow:hidden; }
      .pcard .ph-head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: .5pt solid #ccc; padding-bottom: 1.5mm; }
      .pcard .ph-school { color:#8f6f38; font-weight:700; }
      .pcard .ph-name { font-weight:800; line-height:1.15; }
      .pcard .ph-meta { color:#555; margin-top:.6mm; }
      .pcard .ph-sec { }
      .pcard .ph-lbl { color:#777; font-weight:700; margin-bottom:.8mm; }
      .pcard .ph-em { font-family:'JetBrains Mono',monospace; direction:ltr; text-align:left; word-break:break-all; line-height:1.25; }
      .pcard .ph-pw { font-family:'JetBrains Mono',monospace; direction:ltr; text-align:left; letter-spacing:.3px; word-break:break-all; line-height:1.2; margin-top:.6mm; }
      .pcard .ph-pw b { font-weight:800; }
      .pcard .ph-phone { color:#777; direction:ltr; text-align:left; padding-top:1.5mm; border-top:.5pt dashed #ddd; }

      .pcards.layout4 { grid-template-columns: repeat(2,1fr); grid-auto-rows: 95mm; }
      .pcards.layout4 .ph-school{font-size:9pt} .pcards.layout4 .ph-name{font-size:16pt} .pcards.layout4 .ph-meta{font-size:9pt}
      .pcards.layout4 .ph-lbl{font-size:8.5pt} .pcards.layout4 .ph-em{font-size:10pt} .pcards.layout4 .ph-pw{font-size:15pt} .pcards.layout4 .ph-phone{font-size:8.5pt}

      .pcards.layout2 .pcard { padding: 8mm 10mm; }
      .pcards.layout1 .pcard { padding: 12mm 16mm; }
      .pcards.layout2 { grid-template-columns: repeat(2,1fr); grid-auto-rows: 194mm; }
      .pcards.layout2 .ph-school{font-size:16pt} .pcards.layout2 .ph-name{font-size:28pt} .pcards.layout2 .ph-meta{font-size:16pt}
      .pcards.layout2 .ph-lbl{font-size:15pt} .pcards.layout2 .ph-em{font-size:17pt} .pcards.layout2 .ph-pw{font-size:26pt} .pcards.layout2 .ph-phone{font-size:15pt}

      .pcards.layout1 { grid-template-columns: 1fr; grid-auto-rows: 194mm; }
      .pcards.layout1 .pcard { page-break-after: always; }
      .pcards.layout1 .ph-school{font-size:20pt} .pcards.layout1 .ph-name{font-size:36pt} .pcards.layout1 .ph-meta{font-size:20pt}
      .pcards.layout1 .ph-lbl{font-size:19pt} .pcards.layout1 .ph-em{font-size:21pt} .pcards.layout1 .ph-pw{font-size:32pt} .pcards.layout1 .ph-phone{font-size:19pt}
    </style>
    </head><body>
    <div class="pcards layout${_pcLayout}">${cardsHTML}</div>
    <script>
      window.onload = function() { setTimeout(function(){ window.print(); }, 500); }
    <\/script></body></html>`);
  win.document.close();
}

// ----- تصدير / استيراد بيانات الحسابات بصيغة JSON -----
function exportAccountsJSON() {
  try {
    const data = {
      kind: 'nojomi_students_accounts',
      version: 1,
      exportedAt: new Date().toISOString(),
      classes: state.classes.map(cls => ({
        name: cls.name,
        students: cls.students.map(s => ({
          name: s.name,
          parentPhone: s.parentPhone || '',
          phoneVerified: !!s.phoneVerified,
          govAccount: s.govAccount ? { user: s.govAccount.user || '', pass: s.govAccount.pass || '' } : null,
          alifAccount: s.alifAccount ? { user: s.alifAccount.user || '', pass: s.alifAccount.pass || '' } : null,
          govPassUpdated: s.govPassUpdated || null,
          alifPassUpdated: s.alifPassUpdated || null
        }))
      }))
    };
    downloadFile(JSON.stringify(data, null, 2), `nojomi_students_accounts_${todayStr()}.json`, 'application/json;charset=utf-8;');
    toast('تم تصدير بيانات الحسابات ✅', '🧾');
  } catch (e) { alert('خطأ: ' + e.message); }
}

function importAccountsJSONFile(event) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try { importAccountsJSON(e.target.result); }
    catch (err) { alert('خطأ في القراءة: ' + err.message); }
    event.target.value = '';
  };
  reader.readAsText(file, 'UTF-8');
}

function importAccountsJSON(text) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const data = JSON.parse(text);
  if (!data || data.kind !== 'nojomi_students_accounts' || !Array.isArray(data.classes)) {
    alert('ملف غير صالح — يجب أن يكون ملف "تصدير حسابات JSON" الصادر من هذا البرنامج.');
    return;
  }
  let added = 0, updated = 0, newClasses = 0;
  data.classes.forEach(sc => {
    let cls = state.classes.find(c => c.name === sc.name);
    if (!cls) {
      cls = { id: Date.now() + newClasses, name: sc.name, _savedDates: [], students: [] };
      state.classes.push(cls);
      newClasses++;
    }
    (sc.students || []).forEach(ss => {
      const existing = cls.students.find(s => s.name === ss.name);
      if (!existing) {
        cls.students.push({
          id: Date.now() + added + newClasses + 9500, name: ss.name,
          points: 0, present: 0, absent: 0, participation: 0,
          absenceDates: [], _todayAtt: 'unmarked', _prevAtt: {},
          parentPhone: ss.parentPhone || '', phoneVerified: !!ss.phoneVerified, behaviorNotes: [],
          govAccount: ss.govAccount || null, alifAccount: ss.alifAccount || null,
          govPassUpdated: ss.govPassUpdated || null, alifPassUpdated: ss.alifPassUpdated || null
        });
        added++;
      } else {
        if (ss.parentPhone) existing.parentPhone = ss.parentPhone;
        if (ss.phoneVerified !== undefined) existing.phoneVerified = !!ss.phoneVerified;
        if (ss.govAccount) {
          if (!existing.govAccount) existing.govAccount = { user: '', pass: '' };
          if (ss.govAccount.user) existing.govAccount.user = ss.govAccount.user;
          if (ss.govAccount.pass && ss.govAccount.pass !== existing.govAccount.pass) {
            existing.govAccount.pass = ss.govAccount.pass;
            existing.govPassUpdated = ss.govPassUpdated || Date.now();
          }
        }
        if (ss.alifAccount) {
          if (!existing.alifAccount) existing.alifAccount = { user: '', pass: '' };
          if (ss.alifAccount.user) existing.alifAccount.user = ss.alifAccount.user;
          if (ss.alifAccount.pass && ss.alifAccount.pass !== existing.alifAccount.pass) {
            existing.alifAccount.pass = ss.alifAccount.pass;
            existing.alifPassUpdated = ss.alifPassUpdated || Date.now();
          }
        }
        updated++;
      }
    });
  });
  if (!state.activeClass && state.classes.length > 0) state.activeClass = state.classes[0].id;
  state.classes.forEach(cls => { cls.students = sortStudentsAlpha(cls.students); });
  save(); renderClasses(); renderClassTabs(); renderStudentList(); updateLeaderboard(); updateReportSelects();
  alert(`✅ تم استيراد بيانات الحسابات:\n• ${newClasses} صف جديد\n• ${added} طالب جديد\n• ${updated} طالب تم تحديث حساباته`);
}

function buildAccountsMessage(s) {
  const gov = s.govAccount;
  const alif = s.alifAccount;
  let msg = `السلام عليكم ورحمة الله\nبيانات دخول ابنكم/ابنتكم *${s.name}* للمنصات التعليمية:\n\n`;
  if (gov && (gov.user || gov.pass)) {
    msg += `*الحساب الوزاري:*\n`;
    if (gov.user) msg += `المستخدم: ${gov.user}\n`;
    if (gov.pass) msg += `كلمة المرور: ${gov.pass}\n`;
    msg += '\n';
  }
  if (alif && (alif.user || alif.pass)) {
    msg += `*منصة ألف (Alef):*\n`;
    if (alif.user) msg += `المستخدم: ${alif.user}\n`;
    if (alif.pass) msg += `كلمة المرور: ${alif.pass}\n`;
    msg += '\n';
  }
  msg += `نتمنى للطالب التوفيق والنجاح.`;
  return msg;
}

function sendAccountsViaWhatsApp(classId, studentId) {
  const cls = state.classes.find(c => c.id === classId);
  const s = cls?.students.find(st => st.id === studentId);
  if (!s || !s.parentPhone) return toast('لا يوجد رقم واتساب مسجل', '⚠️');
  const gov = s.govAccount; const alif = s.alifAccount;
  if ((!gov || (!gov.user && !gov.pass)) && (!alif || (!alif.user && !alif.pass))) {
    return toast('لا توجد بيانات حسابات مسجلة', '⚠️');
  }
  const msg = buildAccountsMessage(s);
  const waLink = `https://wa.me/${s.parentPhone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`;
  window.open(waLink, '_blank');
}

function showAccountsQR(classId, studentId) {
  const cls = state.classes.find(c => c.id === classId);
  const s = cls?.students.find(st => st.id === studentId);
  if (!s || !s.parentPhone) return toast('لا يوجد رقم واتساب مسجل', '⚠️');
  const gov = s.govAccount; const alif = s.alifAccount;
  if ((!gov || (!gov.user && !gov.pass)) && (!alif || (!alif.user && !alif.pass))) {
    return toast('لا توجد بيانات حسابات مسجلة، احفظ البيانات أولاً', '⚠️');
  }
  const msg = buildAccountsMessage(s);
  const waLink = `https://wa.me/${s.parentPhone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`;
  const qrUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=380x380&margin=10&data=${encodeURIComponent(waLink)}`;
  openModal(`
    <div class="modal-title">📲 QR — حسابات ${s.name}</div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">امسح الكود لإرسال بيانات الحسابات لولي الأمر عبر واتساب</p>
    <div style="text-align:center;margin-bottom:14px">
      <img src="${qrUrl}" alt="QR" style="border-radius:12px;border:3px solid #5fd8e8;width:170px;height:170px"/>
    </div>
    <div class="modal-actions">
      <a href="${waLink}" target="_blank" class="btn btn-success" style="flex:1;text-align:center;text-decoration:none">📱 فتح واتساب</a>
      <button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button>
    </div>
  `);
}

// ===== TEMP COUNTER UI =====
function _updateTempCounterUI(studentId) {
  const cls = state.classes.find(c => c.students.some(s => s.id === studentId));
  const s = cls?.students.find(st => st.id === studentId);
  if (!s) return;
  // عداد نقاط اليوم (قبل مجموع النقاط)
  var dayEl = document.getElementById('sptsday-' + studentId);
  if (dayEl) {
    var attPts = (s._todayAtt === 'present') ? 2 : 0;
    var savedPart2 = (s.pointsLog||[]).find(function(e){ return e.date === sessionDate && e.type === 'participation'; });
    var savedDed2  = (s.pointsLog||[]).find(function(e){ return e.date === sessionDate && e.type === 'deduct'; });
    var partTotal  = ((savedPart2 ? savedPart2.pts : 0) + ((s._dailyPart   || {})[sessionDate] || 0));
    var dedTotal   = (savedDed2 ? Math.abs(savedDed2.pts) : 0) + ((s._dailyDeduct || {})[sessionDate] || 0);
    var dayNet = attPts + partTotal - dedTotal;
    dayEl.textContent = (dayNet >= 0 ? '+' : '') + dayNet;
    if (dayNet > 0) {
      dayEl.style.color = '#4ecdc4';
      dayEl.style.textShadow = '0 0 10px rgba(78,205,196,0.5)';
      dayEl.style.fontWeight = '900';
    } else if (dayNet < 0) {
      dayEl.style.color = '#ff6b6b';
      dayEl.style.textShadow = '0 0 10px rgba(255,107,107,0.45)';
      dayEl.style.fontWeight = '900';
    } else {
      dayEl.style.color = 'var(--text-muted)';
      dayEl.style.textShadow = 'none';
      dayEl.style.fontWeight = '700';
    }
  }
}

