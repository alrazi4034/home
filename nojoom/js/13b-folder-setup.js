/* 13b-folder-setup.js — الربط من بوابة الرازي
   الربط (المجلدات + «من أنا» + ملف المعلم) يتم مرة واحدة من زر «📁» في ترويسة بوابة الرازي.
   نجوم مدرستي تقرأه تلقائياً عند الفتح: الملف المركزي + ملف المعلم + اسمه — بدون أي خيارات هنا.
   إذا احتاج المتصفح إذناً جديداً يظهر زر واحد «🔓 متابعة». */
let FL_PENDING = null;

async function flPortalState() {
  if (typeof FL === 'undefined' || !FL.supported()) return null;
  const [folders, me, tf] = await Promise.all([FL.folders(), FL.me(), FL.teacherFile()]);
  if (!folders.length || !me || !me.key || !tf) return null;
  return { folders, me, tf };
}
async function flSame(a, b) { try { return !!(a && b && await a.isSameEntry(b)); } catch (e) { return false; } }
async function flPermsOk(ps) {
  try {
    if ((await ps.tf.queryPermission({ mode: 'readwrite' })) !== 'granted') return false;
    for (const f of ps.folders) if ((await f.queryPermission({ mode: 'read' })) !== 'granted') return false;
    return true;
  } catch (e) { return false; }
}

// عند الفتح: إن كان الربط في البوابة مختلفاً عمّا هنا يُعتمد تلقائياً
async function flAdoptOnLoad() {
  const ps = await flPortalState();
  if (!ps) return false;
  let curFile = null, curCentral = null;
  try { curFile = await ljLoadHandle(); } catch (e) {}
  try { curCentral = await rsIdb('get'); } catch (e) {}
  const sameTeacher = state.rosterMeta && state.rosterMeta.teacherKey === ps.me.key;
  if (sameTeacher && curCentral && await flSame(curFile, ps.tf)) return false;     // مطابق: يكمل التشغيل العادي
  if (await flPermsOk(ps)) { await flApply(ps, false); return true; }
  FL_PENDING = ps;
  flShowBanner();
  // معلم آخر على هذا المتصفح: لا يُفتح ملفه السابق حتى يضغط «متابعة»
  return !!(state.rosterMeta && state.rosterMeta.teacherKey && state.rosterMeta.teacherKey !== ps.me.key);
}

function flShowBanner() {
  let b = document.getElementById('fl-banner');
  if (!b) {
    b = document.createElement('div'); b.id = 'fl-banner';
    b.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:3000;background:var(--surface,#1e2236);border:2px solid var(--accent,#f7c948);border-radius:14px;padding:10px 16px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.35);font-size:13.5px;max-width:92vw';
    document.body.appendChild(b);
  }
  const n = FL_PENDING && FL_PENDING.me ? FL_PENDING.me.name : '';
  b.innerHTML = `<span>📁 مرتبط من بوابة الرازي${n ? ': <b>' + rsEsc(n) + '</b>' : ''}</span>
    <button class="btn btn-primary btn-sm" onclick="flContinue()">🔓 متابعة</button>`;
}
function flHideBanner() { const b = document.getElementById('fl-banner'); if (b) b.remove(); }

// ضغطة واحدة: طلب الإذن (يحتاج ضغطة من المستخدم) ثم إكمال الربط
async function flContinue() {
  const ps = FL_PENDING || await flPortalState();
  if (!ps) return flUnlockExisting();
  for (const f of ps.folders) {
    try { if ((await f.queryPermission({ mode: 'readwrite' })) !== 'granted') await f.requestPermission({ mode: 'readwrite' }); }
    catch (e) { try { await f.requestPermission({ mode: 'read' }); } catch (e2) {} }
  }
  try { if ((await ps.tf.queryPermission({ mode: 'readwrite' })) !== 'granted') await ps.tf.requestPermission({ mode: 'readwrite' }); } catch (e) {}
  if (!(await flPermsOk(ps))) { toast('اضغط «متابعة» مرة أخرى للسماح بالوصول للملفات', '🔓'); return; }
  FL_PENDING = null; flHideBanner();
  await flApply(ps, true);
}

async function flApply(ps, interactive) {
  const central = await FL.findCentral(false);
  if (!central) { toast('لم يُعثر على ملف «بيانات المدرسة» في المجلدات المربوطة — راجع الربط في بوابة الرازي', '⚠️'); return; }
  // أوقف أي حفظ معلّق على الملف السابق قبل تغيير البيانات (حتى لا يُكتب في ملف معلم آخر)
  if (typeof ljSyncTimer !== 'undefined' && ljSyncTimer) clearTimeout(ljSyncTimer);
  linkedJsonHandle = null;
  rosterHandle = central.handle;
  await rsIdb('put', rosterHandle);
  const prev = state.rosterMeta || {};
  const changed = prev.teacherKey && prev.teacherKey !== ps.me.key;
  if (changed) {                       // معلم آخر على نفس المتصفح: لا تُخلط بياناته بملف هذا المعلم
    state.classes = []; state.assessments = []; state.archivedStudents = []; state.archivedClasses = [];
    state.seating = {}; state.marsadReview = {};
  }
  // صفوف المعلم: من ملفه (أنشأته البوابة) إن وُجدت، وإلا تُعرض نافذة الصفوف مُعبّأة من بيانات المدرسة
  let fileMeta = null, fileData = null;
  try { fileData = JSON.parse(await (await ps.tf.getFile()).text()) || null; fileMeta = fileData && fileData.rosterMeta || null; } catch (e) {}
  // متصفح جديد (لا طلاب هنا) وملف المعلم فيه بيانات ⇒ تُنقل صفوفه كما هي ثم يُكمل الاستيراد
  const hasLocal = (state.classes || []).some(c => (c.students || []).length);
  if (!hasLocal && fileData && Array.isArray(fileData.classes) && fileData.classes.some(c => (c.students || []).length))
    state.classes = JSON.parse(JSON.stringify(fileData.classes));
  state.rosterMeta = Object.assign({}, changed ? {} : prev, { managed: true, teacherKey: ps.me.key });
  if (changed || !Array.isArray(state.rosterMeta.myClasses)) state.rosterMeta.myClasses = fileMeta && Array.isArray(fileMeta.myClasses) && fileMeta.myClasses.length && !fileMeta.createdBy ? fileMeta.myClasses : null;
  save();
  await pickAndLinkJson('open', ps.tf, { preferFile: true });
  await rosterSyncNow({ interactive: true });
  if (!state.archivedStudents) state.archivedStudents = [];
  if (!state.archivedClasses) state.archivedClasses = [];
  if (typeof rosterApplyLockUI === 'function') rosterApplyLockUI();
  if (typeof setupBtnRefresh === 'function') setupBtnRefresh();
  toast('تم الربط من بوابة الرازي ✅', '📁');
}

// إذن منتهٍ لربط قائم (بدون تغيير): زر واحد يعيد التفعيل
async function flUnlockExisting() {
  try { if (rosterHandle && (await rosterHandle.queryPermission({ mode: 'read' })) !== 'granted') await rosterHandle.requestPermission({ mode: 'read' }); } catch (e) {}
  try { if (linkedJsonHandle && (await linkedJsonHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') await linkedJsonHandle.requestPermission({ mode: 'readwrite' }); } catch (e) {}
  await initLinkedFileOnLoad();
  await rosterSyncNow({ interactive: true });
  if (typeof setupBtnRefresh === 'function') setupBtnRefresh();
}

// نافذة الإعداد: إن كان الربط من البوابة تظهر حالة مختصرة فقط (الخيارات اليدوية مخفية تحت «متقدم»)
(function wrapSetup() {
  const orig = window.openSetup;
  if (typeof orig !== 'function') return;
  window.openSetup = async function (firstRun, advanced) {
    const ps = advanced ? null : await flPortalState();
    if (!ps) {
      const r = await orig.call(this, firstRun);
      const box = document.getElementById('modal-content');
      if (!advanced && box && box.querySelector('.modal-title') && typeof FL !== 'undefined' && FL.supported()) {
        const el = document.createElement('div');
        el.style.cssText = 'border:1px solid var(--accent);background:rgba(247,201,72,.07);border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:12.5px;line-height:1.8';
        el.innerHTML = '📁 <b>الطريقة الموصى بها:</b> اربط مجلداتك مرة واحدة من زر «📁» في ترويسة <b>بوابة الرازي</b>، ثم افتح نجوم مدرستي — يعمل مباشرة دون أي خطوات هنا.';
        box.querySelector('.modal-title').after(el);
      }
      return r;
    }
    const m = state.rosterMeta || {}, si = getSchoolInfo();
    const locked = !!FL_PENDING || document.getElementById('btnRoster')?.textContent.trim() === '🔓' || document.getElementById('btnLinkJson')?.textContent.trim() === '🔓';
    openModal(`
      <div class="modal-title">📁 مرتبط من بوابة الرازي</div>
      <div style="font-size:13px;line-height:2">
        👤 <b>${rsEsc(ps.me.name)}</b>${si.subject ? ' — ' + rsEsc(si.subject) : ''}<br>
        📗 بيانات المدرسة: <b>${rsEsc(rosterHandle ? rosterHandle.name : '—')}</b>${m.lastSync ? ' — آخر مزامنة ' + new Date(m.lastSync).toLocaleString('ar') : ''}<br>
        📄 ملفي: <b>${rsEsc(ps.tf.name)}</b>${typeof ljLastActionText === 'function' ? ljLastActionText() : ''}<br>
        🏫 ${Array.isArray(m.myClasses) && m.myClasses.length ? m.myClasses.map(rsEsc).join('، ') : '—'}
      </div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-top:6px">لتغيير المجلدات أو الاسم: من زر «📁» في ترويسة بوابة الرازي.</div>
      <div class="modal-actions" style="flex-wrap:wrap">
        ${locked ? '<button class="btn btn-primary" onclick="closeModalForce();flContinue()">🔓 متابعة</button>' : ''}
        <button class="btn btn-ghost" onclick="closeModalForce();rosterSyncNow({interactive:true})">🔄 مزامنة الآن</button>
        <button class="btn btn-ghost" onclick="closeModalForce();rosterOpenClassPicker()">🏫 صفوفي</button>
        <button class="btn btn-ghost" onclick="closeModalForce();startTour()">🎓 جولة</button>
        <button class="btn btn-ghost" onclick="closeModalForce();openSetup(false, true)" style="font-size:11px;opacity:.7">⚙️ متقدم</button>
        <button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button>
      </div>`);
  };
})();

// زر الإعداد يصبح «🔓» عند الحاجة لإذن من ربط البوابة
(function wrapBtn() {
  const orig = window.setupBtnRefresh;
  if (typeof orig !== 'function') return;
  window.setupBtnRefresh = function () {
    orig.apply(this, arguments);
    const btn = document.getElementById('btnSetup');
    if (btn && FL_PENDING) { btn.innerHTML = '🔓'; btn.title = 'اضغط «متابعة» لتفعيل الربط من بوابة الرازي'; }
  };
})();
