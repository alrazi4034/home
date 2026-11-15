/* 13b-folder-setup.js — الربط بالمجلدات (الطريقة الموصى بها)
   المعلم يربط مجلد «بيانات المدرسة» ومجلده (يمكن أكثر من مجلد)، ثم يختار «من أنا؟»:
   البرنامج يجد ملف بيانات المدرسة وملف المعلم بنفسه، أو ينشئ ملف المعلم في مجلده.
   الربط مشترك مع بوابة الرازي (إن رُبط هناك يظهر هنا جاهزاً). */
let FS_ROSTER = null, FS_CENTRAL = null;

async function folderSetupOpen() {
  if (!FL.supported()) return alert('الربط بالمجلدات يعمل في Chrome أو Edge على الكمبيوتر فقط.');
  let st = await FL.status(false);
  if (!st.length) { try { await FL.add(); } catch (e) { if (e && e.name === 'AbortError') return; return alert('تعذّر ربط المجلد: ' + e.message); } st = await FL.status(false); }
  if (st.some(s => !s.ok)) st = await FL.status(true);
  FS_CENTRAL = await FL.findCentral(false);
  FS_ROSTER = null;
  if (FS_CENTRAL) {
    try { FS_ROSTER = parseRosterWorkbook(XLSX.read(await (await FS_CENTRAL.handle.getFile()).arrayBuffer(), { type: 'array', cellDates: true })); }
    catch (e) { FS_ROSTER = null; }
  }
  const me = await FL.me();
  const curKey = (state.rosterMeta && state.rosterMeta.teacherKey) || (me && me.key) || '';
  const teachers = (FS_ROSTER && FS_ROSTER.teachers) || [];
  const opts = teachers.map(t => `<option value="${rsEsc(t.key)}" ${t.key === curKey ? 'selected' : ''}>${rsEsc(t.name || t.email)}${t.subjects.length ? ' — ' + rsEsc(t.subjects.join('، ')) : ''}</option>`).join('');
  openModal(`
    <div class="modal-title">📁 الربط بالمجلدات</div>
    <div style="font-size:12.5px;line-height:1.9;color:var(--text-muted);margin-bottom:10px">
      اربط مجلد <b>«بيانات المدرسة»</b> و<b>مجلدك</b> على OneDrive (يمكن أكثر من مجلد). البرنامج يجد ملف بيانات المدرسة وملفك بنفسه.</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
      ${st.map((s, i) => `<div style="display:flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border-color);border-radius:10px;padding:6px 10px;font-size:13px">
        <span>📁</span><b style="flex:1">${rsEsc(s.name)}</b>${s.ok ? '<span style="color:var(--present)">✓</span>' : '<span style="color:var(--absent)">🔒 يحتاج إذن</span>'}
        <button class="btn btn-ghost btn-sm" onclick="folderSetupRemove(${i})" title="إزالة">✖</button></div>`).join('')}
      <button class="btn btn-ghost btn-sm" onclick="folderSetupAdd()">➕ إضافة مجلد</button>
    </div>
    <div style="font-size:12.5px;margin-bottom:6px">📗 ملف بيانات المدرسة: ${FS_CENTRAL ? '<b>' + rsEsc(FS_CENTRAL.path) + '</b> ✅' : '<span style="color:var(--absent)">لم يُعثر عليه — أضف مجلد «بيانات المدرسة»</span>'}</div>
    ${teachers.length ? `<div class="form-group" style="margin-top:8px"><label class="form-label">👤 من أنا؟</label>
      <select class="input" id="fs-me"><option value="">— اختر اسمك —</option>${opts}</select></div>` : ''}
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="folderSetupApply()" ${FS_CENTRAL && teachers.length ? '' : 'disabled'}>✅ تطبيق</button>
      <button class="btn btn-ghost" onclick="closeModalForce();openSetup(false)">↩ رجوع</button>
    </div>`);
}
async function folderSetupAdd() {
  try { await FL.add(); } catch (e) { if (!(e && e.name === 'AbortError')) alert('تعذّر ربط المجلد: ' + e.message); }
  folderSetupOpen();
}
async function folderSetupRemove(i) { await FL.remove(i); folderSetupOpen(); }

async function folderSetupApply() {
  const key = document.getElementById('fs-me')?.value;
  if (!key) return toast('اختر اسمك من القائمة', '⚠️');
  const t = FS_ROSTER.teachers.find(x => x.key === key);
  if (!t) return;
  closeModalForce();
  await FL.setMe(t);
  // 1) الملف المركزي
  rosterHandle = FS_CENTRAL.handle;
  await rsIdb('put', rosterHandle);
  // 2) المعلم وصفوفه (تُعبّأ مبدئياً من بيانات المدرسة، وتبقى قابلة للتعديل من «🏫 صفوفي»)
  const prev = state.rosterMeta || {};
  const changedTeacher = prev.teacherKey && prev.teacherKey !== key;
  state.rosterMeta = Object.assign({}, prev, { teacherKey: key });
  if (changedTeacher || !Array.isArray(prev.myClasses)) state.rosterMeta.myClasses = null;   // يظهر اختيار الصفوف (مُعبّأ مسبقاً)
  save();
  // 3) ملف المعلم: موجود ← يُربط؛ غير موجود ← يُنشأ في مجلده
  const found = await FL.findTeacherFile(t, true);
  let fileHandle = found ? found.handle : null, mode = 'open';
  if (!fileHandle) {
    const dir = await FL.teacherDir(t, false);
    if (!dir) {
      alert('لم أجد مجلدك الخاص.\nأضف مجلدك (الذي لديك عليه صلاحية تعديل) من «➕ إضافة مجلد» ثم اضغط «تطبيق».');
      return folderSetupOpen();
    }
    if (!(await FL.perm(dir, true, 'readwrite'))) return alert('لا توجد صلاحية كتابة على مجلدك «' + dir.name + '».');
    try { fileHandle = await dir.getFileHandle(FL.fileNameFor(t), { create: true }); mode = 'new'; }
    catch (e) { return alert('تعذّر إنشاء ملفك في «' + dir.name + '»:\n' + e.message + '\nتأكد أن صلاحيتك على المجلد «تعديل».'); }
  }
  const linked = await pickAndLinkJson(mode, fileHandle);
  if (linked === false) return;
  // 4) مزامنة القائمة المركزية (يظهر اختيار الصفوف أول مرة)
  await rosterSyncNow({ interactive: true });
  if (typeof setupBtnRefresh === 'function') setupBtnRefresh();
}

// قسم «الربط بالمجلدات» في أعلى نافذة الإعداد
(function wrapSetup() {
  const orig = window.openSetup;
  if (typeof orig !== 'function') return;
  window.openSetup = function (firstRun) {
    const r = orig.apply(this, arguments);
    Promise.resolve(r).then(async () => {
      const box = document.getElementById('modal-content');
      if (!box || !box.querySelector('.modal-title') || !/الربط والإعداد/.test(box.querySelector('.modal-title').textContent)) return;
      if (!FL.supported()) return;
      const st = await FL.status(false);
      const me = await FL.me();
      const el = document.createElement('div');
      el.style.cssText = 'border:1px solid var(--accent);background:rgba(247,201,72,.07);border-radius:12px;padding:10px 12px;margin-bottom:12px';
      el.innerHTML = `<div style="font-weight:800;margin-bottom:4px">📁 الربط بالمجلدات <span style="font-size:11px;color:var(--accent)">(موصى به)</span></div>
        <div style="font-size:12px;color:var(--text-muted);line-height:1.8;margin-bottom:8px">${st.length
          ? 'المجلدات المربوطة: <b>' + st.map(s => rsEsc(s.name)).join('، ') + '</b>' + (me ? ' — 👤 ' + rsEsc(me.name) : '')
          : 'اربط مجلد «بيانات المدرسة» ومجلدك مرة واحدة، والبرنامج يجد الملفات بنفسه — بدل الخطوات 1 و3.'}</div>
        <button class="btn btn-primary btn-sm" onclick="closeModalForce();folderSetupOpen()">${st.length ? '📁 فتح الربط بالمجلدات' : '📁 ربط المجلدات'}</button>`;
      box.querySelector('.modal-title').after(el);
    });
    return r;
  };
})();
