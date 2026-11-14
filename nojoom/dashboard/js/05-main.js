/* 05-main.js — تشغيل لوحة التحكم: الفلاتر، التبويبات، الإعدادات، التصدير */

let LAST = { miss: null, abs: null, teachers: null, stars: null, quality: [] };
let ACTIVE_TAB = 'missing';
let RANGE_TOUCHED = false;   // المستخدم غيّر المدى بنفسه

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
}
function openModal(html) { document.getElementById('modal').innerHTML = html; document.getElementById('modalBg').classList.add('open'); }
function closeModal() { document.getElementById('modalBg').classList.remove('open'); }
function toggleTheme() {
  document.body.classList.toggle('light');
  try { localStorage.setItem('nojoomDashTheme', document.body.classList.contains('light') ? 'light' : 'dark'); } catch (e) {}
}

function showTab(tab) {
  ACTIVE_TAB = tab;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + tab));
}

/* ---------- المدى الزمني ---------- */
function currentTerm() {
  const t = todayISO();
  const terms = MODEL ? MODEL.central.terms : [];
  return terms.find(x => t >= x.start && t <= x.end) || terms.filter(x => x.start <= t).pop() || terms[0] || null;
}
function setRange(from, to) {
  document.getElementById('f-from').value = from;
  document.getElementById('f-to').value = to;
}
function defaultRange() {
  const today = todayISO();
  const term = currentTerm();
  if (term) return [term.start, today < term.end ? today : term.end];
  const dates = MODEL.form.records.map(r => r.date).filter(d => d <= today).sort();
  return [dates[0] || addDays(today, -30), today];
}
function renderTermChips() {
  const box = document.getElementById('termChips');
  const today = todayISO();
  const chips = [['آخر أسبوع', addDays(today, -6), today], ['آخر 30 يوم', addDays(today, -29), today]];
  MODEL.central.terms.forEach(t => { if (t.start <= today) chips.push([t.name.trim(), t.start, today < t.end ? today : t.end]); });
  box.innerHTML = chips.map(([n, f, t]) => `<button class="chip" onclick="setRange('${f}','${t}');onFilterChange()">${esc(n)}</button>`).join('');
}
function renderClassFilter() {
  const sel = document.getElementById('f-class');
  const v = sel.value;
  sel.innerHTML = '<option value="">كل الصفوف</option>' + MODEL.classes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  sel.value = MODEL.classes.includes(v) ? v : '';
}

/* ---------- التحديث ---------- */
async function refreshAll(interactive) {
  if (typeof XLSX === 'undefined') { alert('تعذّر تحميل مكتبة Excel — تأكد من الاتصال بالإنترنت ثم أعد فتح الصفحة.'); return; }
  const st = await readSources(interactive);
  buildModel();
  const has = MODEL.form.records.length || MODEL.files.records.length;
  document.getElementById('emptyState').style.display = has ? 'none' : 'block';
  document.querySelectorAll('.page').forEach(p => p.style.display = has ? '' : 'none');
  const s = MODEL.central.school;
  document.getElementById('schoolLine').textContent = (s.name ? s.name + ' — ' : '') + 'نجوم مدرستي + نماذج الغياب — للقراءة فقط';
  renderClassFilter();
  renderTermChips();
  if (!RANGE_TOUCHED) { const [f, t] = defaultRange(); setRange(f, t); }
  if (has) render();
  if (interactive) toast('تم التحديث ✅');
  return st;
}

function onFilterChange() { RANGE_TOUCHED = true; if (MODEL) render(); }

function render() {
  const from = document.getElementById('f-from').value, to = document.getElementById('f-to').value;
  if (!from || !to || from > to) return toast('تحقق من التواريخ');
  const cls = document.getElementById('f-class').value;
  const miss = computeMissing(from, to, cls);
  const abs = computeAbsence(from, to, cls, miss);
  const teachers = computeTeachers(from, to, miss);
  const stars = computeStars(cls);
  const quality = computeQuality(miss);
  LAST = { miss, abs, teachers, stars, quality, from, to, cls };
  renderMissing(miss);
  renderAbsence(abs, miss);
  renderTeachers(teachers, to);
  renderStars(stars);
  renderQuality(quality);
}

/* ---------- الإعدادات ---------- */
function openSettings() {
  const ex = LAST.miss ? LAST.miss.excluded : [];
  openModal(`<h2>⚙️ إعدادات لوحة التحكم</h2>
    <div class="card"><h3>عدد الحصص في كل يوم</h3>
      <div class="row">${[1, 2, 3, 4, 5].map(wd => `<label>${DAY_NAMES[wd]} <input type="number" min="0" max="12" style="width:64px" id="set-p${wd}" value="${SETTINGS.periods[wd] || 0}"></label>`).join('')}</div>
    </div>
    <div class="card"><h3>العطل والأيام المستبعدة</h3>
      <div class="row"><label>اعتبر اليوم عطلة إذا كانت سجلاته أقل من <input type="number" min="0" style="width:64px" id="set-min" value="${SETTINGS.minDayRecords}"></label></div>
      <div class="row"><label>استبعاد يوم يدوياً <input type="date" id="set-exday"></label><button class="btn sm" onclick="addExcludeDay()">➕ استبعاد</button></div>
      <div id="exList" style="font-size:12.5px;line-height:2">${renderExList(ex)}</div>
    </div>
    <div class="card"><h3>الغياب المتكرر</h3>
      <div class="row"><label>نبّه عند غياب الطالب <input type="number" min="1" style="width:64px" id="set-chronic" value="${SETTINGS.chronicDays}"> أيام فأكثر</label></div>
    </div>
    <div class="card"><h3>رابط برنامج نجوم مدرستي (لرسائل التذكير)</h3>
      <div class="row"><input id="set-url" style="width:100%;direction:ltr" placeholder="https://…/index-nojoom.html" value="${esc(SETTINGS.appUrl || appUrl())}"></div>
      <div class="muted" style="font-size:12px">يُستنتج تلقائياً عند فتح لوحة التحكم من الموقع. اتركه كما هو أو اكتب الرابط الصحيح.</div>
    </div>
    <div class="card"><h3>المصادر المرتبطة</h3>
      <div class="row">${['central', 'form', 'folder'].map(k => `<button class="btn sm danger" onclick="unlinkSource('${k}')">✖ إلغاء ربط ${{ central: 'الملف المركزي', form: 'نموذج الغياب', folder: 'مجلد المعلمين' }[k]}</button>`).join('')}</div>
    </div>
    <div class="actions"><button class="btn primary" onclick="applySettings()">💾 حفظ</button><button class="btn" onclick="closeModal()">إلغاء</button></div>`);
}
function renderExList(ex) {
  const manual = SETTINGS.forceExclude.map(d => `🚫 ${d} (${DAY_NAMES[weekday(d)]}) — يدوي <span class="link" onclick="toggleDay('${d}','ex')">إلغاء</span>`);
  const auto = ex.filter(e => !e.manual).map(e => `💤 ${e.date} (${DAY_NAMES[weekday(e.date)]}) — ${e.records} سجل <span class="link" onclick="toggleDay('${e.date}','in')">اعتبره يوماً دراسياً</span>`);
  const forced = SETTINGS.forceInclude.map(d => `✅ ${d} — مُدرج يدوياً <span class="link" onclick="toggleDay('${d}','unin')">إلغاء</span>`);
  return manual.concat(auto, forced).join('<br>') || '<span class="muted">لا توجد أيام مستبعدة.</span>';
}
function toggleDay(d, op) {
  if (op === 'ex') SETTINGS.forceExclude = SETTINGS.forceExclude.filter(x => x !== d);
  if (op === 'in') SETTINGS.forceInclude.push(d);
  if (op === 'unin') SETTINGS.forceInclude = SETTINGS.forceInclude.filter(x => x !== d);
  saveSettings(); render();
  document.getElementById('exList').innerHTML = renderExList(LAST.miss.excluded);
}
function addExcludeDay() {
  const d = document.getElementById('set-exday').value;
  if (!d || SETTINGS.forceExclude.includes(d)) return;
  SETTINGS.forceExclude.push(d);
  SETTINGS.forceInclude = SETTINGS.forceInclude.filter(x => x !== d);
  saveSettings(); render();
  document.getElementById('exList').innerHTML = renderExList(LAST.miss.excluded);
}
function applySettings() {
  [1, 2, 3, 4, 5].forEach(wd => SETTINGS.periods[wd] = Math.max(0, parseInt(document.getElementById('set-p' + wd).value, 10) || 0));
  SETTINGS.minDayRecords = Math.max(0, parseInt(document.getElementById('set-min').value, 10) || 0);
  SETTINGS.chronicDays = Math.max(1, parseInt(document.getElementById('set-chronic').value, 10) || 1);
  const u = document.getElementById('set-url').value.trim();
  SETTINGS.appUrl = /^https?:\/\//.test(u) ? u : '';   // فارغ = يُستنتج تلقائياً
  saveSettings(); closeModal(); render(); toast('تم حفظ الإعدادات');
}
async function unlinkSource(k) {
  if (!confirm('إلغاء الربط؟ لن يُحذف أي ملف.')) return;
  SRC[k] = null; FALLBACK[k] = null;
  try { await hIdb('del', k); } catch (e) {}
  closeModal(); refreshAll(false);
}

/* ---------- التصدير إلى Excel ---------- */
function exportExcel() {
  if (!LAST.miss) return toast('لا توجد بيانات للتصدير');
  const wb = XLSX.utils.book_new();
  const add = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ '': 'لا توجد بيانات' }]), name);
  add('الحصص الناقصة', LAST.miss.missing.map(m => ({ 'التاريخ': m.date, 'اليوم': DAY_NAMES[m.wd], 'الحصة': m.period, 'الصف': m.cls,
    'المعلم حسب الجدول': m.teachers.map(teacherName).join('، ') })));
  add('ملخص الصفوف', Object.values(LAST.miss.byClass).map(c => ({ 'الصف': c.cls, 'الحصص المتوقعة': c.expected, 'النموذج': c.form,
    'نجوم مدرستي': c.nojoom + c.unplaced, 'ناقص': c.missing, 'النسبة %': c.expected ? Math.round((1 - c.missing / c.expected) * 100) : 0 })));
  add('المعلمون', LAST.teachers.map(r => ({ 'المعلم': r.t.name, 'المادة': (r.t.subjects || []).join('، '), 'الصفوف': (r.t.classes || []).join('، '),
    'تسجيلات النموذج': r.form, 'تسجيلات نجوم': r.nojoom, 'آخر تسجيل': r.last, 'جدول حصص': r.t.hasTimetable ? 'نعم' : 'لا',
    'حصص ناقصة': r.t.hasTimetable ? r.missing : '', 'ملف نجوم': r.file ? r.file.file : '' })));
  add('غياب الطلاب', LAST.abs.students.map(s => ({ 'الطالب': s.name, 'رقم الطالب': s.sid, 'الصف': s.cls, 'أيام الغياب': s.dayCount, 'حصص الغياب': s.periods,
    'التواريخ': [...s.days].sort().join('، ') })));
  add('الغياب اليومي', LAST.abs.daily.map(d => ({ 'التاريخ': d.date, 'اليوم': DAY_NAMES[weekday(d.date)], 'عدد الغائبين': d.count, 'النسبة %': Math.round(d.rate * 1000) / 10 })));
  if (LAST.stars.list.length) add('نجوم مدرستي', LAST.stars.list.map((s, i) => ({ '#': i + 1, 'الطالب': s.name, 'الصف': s.cls, 'النقاط': s.points, 'الملاحظات': s.notes })));
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.writeFile(wb, `تقرير_لوحة_التحكم_${LAST.from}_${LAST.to}.xlsx`);
}

/* ---------- البدء ---------- */
(async function init() {
  try { if (localStorage.getItem('nojoomDashTheme') === 'light') document.body.classList.add('light'); } catch (e) {}
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  await loadHandles();
  await refreshAll(false);
})();
