/* 07-remind.js — تذكير المعلمين على واتساب: رسالة بالحصص الناقصة + الرابط المباشر للبرنامج + رمز QR
   - رقم المعلم من عمود «رقم التواصل» في صفحة «المعلمين والجداول».
   - الرابط المباشر: يُستنتج من مكان لوحة التحكم (index-nojoom.html بجانبها)، أو يُكتب في الإعدادات.
   - QR الأول: يفتح رسالة واتساب جاهزة للمعلم (تمسحه بجوالك وترسل).
   - QR الثاني: رابط البرنامج نفسه (للمعلم أو للطباعة). */

function appUrl() {
  if (SETTINGS.appUrl) return SETTINGS.appUrl;
  return /^https?:/.test(location.protocol) ? new URL('index-nojoom.html', location.href).href : '';
}
function qrImg(data, size) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;
}
// التذكير يخص آخر أسبوع من المدى المحدد (حتى لا تكون الرسالة طويلة)
function reminderSince() { const w = addDays(LAST.to, -6); return w > LAST.from ? w : LAST.from; }
function teacherMissingSince(key) {
  const since = reminderSince();
  return (LAST.miss.byTeacher[key] || { missing: [] }).missing.filter(m => m.date >= since);
}
function shortDay(d) { return `${DAY_NAMES[weekday(d)]} ${d.slice(8)}/${d.slice(5, 7)}`; }

function reminderText(key) {
  const t = MODEL.teachers.get(key) || { name: key };
  const row = (LAST.teachers || []).find(r => r.t.key === key) || {};
  const miss = teacherMissingSince(key).slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.period - b.period);
  const school = MODEL.central.school.name || '';
  const url = appUrl();
  const lines = [`السلام عليكم أ. ${t.name} 🌟`, `تذكير من متابعة الغياب${school ? ' — ' + school : ''}`, `الفترة: ${reminderSince()} إلى ${LAST.to}`, ''];
  if (t.hasTimetable && miss.length) {
    lines.push(`لم يُسجَّل الغياب في ${miss.length} حصة:`);
    miss.slice(0, 15).forEach(m => lines.push(`• ${shortDay(m.date)} — الحصة ${m.period} — ${m.cls}`));
    if (miss.length > 15) lines.push(`… و${miss.length - 15} حصة أخرى`);
  } else if (t.hasTimetable) {
    lines.push('✅ كل حصصك في هذه الفترة مسجّلة — شكراً لك.');
  } else {
    lines.push(`عدد تسجيلات الغياب لديك في هذه الفترة: ${(row.form || 0) + (row.nojoom || 0)}`);
    lines.push(`آخر تسجيل: ${row.last || 'لا يوجد'}`);
  }
  lines.push('', 'يرجى تسجيل الغياب من برنامج نجوم مدرستي مع تحديد رقم الحصة:');
  if (url) lines.push(url);
  lines.push('', 'شكراً لتعاونكم 🙏');
  return lines.join('\n');
}

function openReminder(key) {
  const t = MODEL.teachers.get(key) || { name: key, phone: '' };
  const url = appUrl();
  openModal(`<h2>📱 تذكير ${esc(t.name)}</h2>
    <div class="row"><label>رقم واتساب <input id="rm-phone" style="width:170px;direction:ltr" value="${esc(t.phone || '')}" placeholder="9715XXXXXXXX" oninput="refreshReminderQR()"></label>
      ${t.phone ? '' : '<span class="muted" style="font-size:12px">لا يوجد رقم في الملف المركزي (عمود «رقم التواصل»)</span>'}</div>
    <textarea id="rm-text" style="width:100%;height:230px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:10px;font-family:inherit;font-size:13px;line-height:1.7" oninput="refreshReminderQR()">${esc(reminderText(key))}</textarea>
    <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-top:12px;text-align:center;font-size:12px" id="rm-qrs"></div>
    ${url ? '' : '<div class="muted" style="font-size:12px;margin-top:8px">⚠️ لا يوجد رابط مباشر للبرنامج — افتح لوحة التحكم من رابط الموقع، أو اكتب الرابط في ⚙️ الإعدادات.</div>'}
    <div class="actions">
      <button class="btn success" onclick="sendReminderWA()">📱 فتح واتساب</button>
      <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('rm-text').value).then(()=>toast('تم النسخ'))">📋 نسخ الرسالة</button>
      <button class="btn" onclick="closeModal()">إغلاق</button>
    </div>`);
  refreshReminderQR();
}
function reminderWaLink() {
  const phone = normPhone(document.getElementById('rm-phone').value);
  const text = document.getElementById('rm-text').value;
  return (phone ? `https://wa.me/${phone}` : 'https://wa.me/') + '?text=' + encodeURIComponent(text);
}
function refreshReminderQR() {
  const box = document.getElementById('rm-qrs');
  if (!box) return;
  clearTimeout(box._t);
  box._t = setTimeout(() => {
    const url = appUrl();
    box.innerHTML = `<div><img src="${qrImg(reminderWaLink(), 220)}" width="170" height="170" style="background:#fff;border-radius:10px;padding:6px" alt="QR"><br>امسح بجوالك لإرسال الرسالة</div>
      ${url ? `<div><img src="${qrImg(url, 220)}" width="170" height="170" style="background:#fff;border-radius:10px;padding:6px" alt="QR"><br>رابط نجوم مدرستي للمعلم</div>` : ''}`;
  }, 300);
}
function sendReminderWA() { window.open(reminderWaLink(), '_blank'); }

// قائمة المعلمين الذين يحتاجون تذكيراً
function openReminderAll() {
  if (!LAST.teachers) return;
  const weekAgo = addDays(LAST.to, -7);
  const list = LAST.teachers.map(r => Object.assign({}, r, { wMiss: teacherMissingSince(r.t.key).length }))
    .filter(r => r.t.known && (r.t.classes || []).length && (r.wMiss > 0 || !r.last || r.last < weekAgo))
    .sort((a, b) => b.wMiss - a.wMiss);
  openModal(`<h2>📣 تذكير المعلمين <span class="muted" style="font-size:12px">(آخر أسبوع: ${reminderSince()} إلى ${LAST.to})</span></h2>
    <div class="muted" style="font-size:12px;margin-bottom:8px">معلمون لديهم حصص ناقصة حسب الجدول، أو لم يسجّلوا منذ أكثر من 7 أيام.</div>
    ${list.length ? `<div class="tbl-wrap"><table><thead><tr><th>المعلم</th><th class="num">ناقص</th><th>آخر تسجيل</th><th>واتساب</th><th></th></tr></thead><tbody>
      ${list.map(r => `<tr><td><b>${esc(r.t.name)}</b></td><td class="num">${r.t.hasTimetable ? r.wMiss : '—'}</td><td>${r.last || '—'}</td>
        <td style="direction:ltr">${r.t.phone ? esc(r.t.phone) : '<span class="muted">لا يوجد</span>'}</td>
        <td><button class="btn sm success" onclick="openReminder('${esc(r.t.key)}')">📱 تذكير</button></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="muted">✅ لا يوجد معلمون يحتاجون تذكيراً في هذه الفترة.</div>'}
    <div class="actions"><button class="btn" onclick="closeModal()">إغلاق</button></div>`);
}

/* ===== قوائم النجوم على مستوى المدرسة (يجمع نقاط الطالب عند كل معلميه) ===== */
function openStarsDash() {
  const per = new Map();
  MODEL.files.teachers.forEach(t => t.classes.forEach(c => c.students.forEach(s => {
    const info = s.sid ? studentInfo(s.sid, s.name) : { name: s.name, cls: c.name };
    const k = s.sid || 'n:' + normName(s.name) + '|' + c.name;
    const st = per.get(k) || per.set(k, { name: info.name, sid: s.sid, cls: info.cls || c.name, total: 0, log: [] }).get(k);
    st.total += s.points || 0;
    (s.log || []).forEach(e => st.log.push(e));
  })));
  STARS.open({
    getStudents: () => [...per.values()], openFn: openModal, closeFn: closeModal, today: todayISO(),
    allLabel: 'الأوائل على مستوى المدرسة', school: MODEL.central.school.name || ''
  });
}

/* ===== تكبير أي QR بالضغط عليه (ملء الشاشة)، والضغط مرة ثانية أو Esc للإغلاق ===== */
function qrCloseFull() { const o = document.getElementById('qr-full-ov'); if (o) o.remove(); }
document.addEventListener('click', e => {
  const t = e.target;
  if (!t || !t.matches || !t.matches('img[src*="api.qrserver.com"]') || t.closest('#qr-full-ov')) return;
  e.preventDefault(); e.stopPropagation();
  qrCloseFull();
  const ov = document.createElement('div');
  ov.id = 'qr-full-ov'; ov.title = 'اضغط للإغلاق';
  ov.innerHTML = '<img alt="QR" src="' + t.src.replace(/size=\d+x\d+/, 'size=800x800') + '">';
  ov.addEventListener('click', qrCloseFull);
  document.body.appendChild(ov);
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') qrCloseFull(); });
