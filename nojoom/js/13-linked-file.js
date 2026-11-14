/* 13-linked-file.js — الربط التلقائي بملف JSON على الجهاز (قراءة وكتابة) */

/* ================= الربط التلقائي بملف JSON على الجهاز (قراءة وكتابة تلقائية) ================= */
const LJ_DB_NAME = 'nojomiFileLinkDB';
const LJ_STORE = 'handles';
const LJ_KEY = 'linkedJSON';
const ljFsApiSupported = typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function';

let linkedJsonHandle = null;
let linkedJsonFileName = '';
let ljSyncTimer = null;

function ljOpenDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LJ_DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(LJ_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function ljSaveHandle(handle){
  const db = await ljOpenDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LJ_STORE, 'readwrite');
    tx.objectStore(LJ_STORE).put(handle, LJ_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function ljLoadHandle(){
  const db = await ljOpenDB();
  return new Promise((resolve) => {
    const tx = db.transaction(LJ_STORE, 'readonly');
    const req = tx.objectStore(LJ_STORE).get(LJ_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}
async function ljClearHandle(){
  try{
    const db = await ljOpenDB();
    const tx = db.transaction(LJ_STORE, 'readwrite');
    tx.objectStore(LJ_STORE).delete(LJ_KEY);
  }catch(e){ /* تجاهل */ }
}

function setLinkJsonStatus(text){
  const el = document.getElementById('linkJsonStatus');
  if(el) el.textContent = text;
}

/* آخر عملية قراءة أو كتابة على الملف المرتبط — لعرضها في شريط الحالة */
let ljLastAction = null; // {type:'read'|'write', time: Date}
function ljRecordAction(type){
  ljLastAction = { type, time: new Date() };
}
function ljLastActionText(){
  if(!ljLastAction) return '';
  const label = ljLastAction.type === 'write' ? 'آخر كتابة' : 'آخر قراءة';
  return ' — ' + label + ' ' + ljLastAction.time.toLocaleTimeString('ar');
}

async function writeStateToHandle(){
  if(!linkedJsonHandle) return false;
  try{
    const perm = await linkedJsonHandle.queryPermission({mode:'readwrite'});
    if(perm !== 'granted'){
      setLinkJsonStatus('⚠️ يحتاج إعادة الربط لتفعيل الحفظ التلقائي');
      return false;
    }
    const writable = await linkedJsonHandle.createWritable();
    await writable.write(JSON.stringify(buildBackupData(), null, 2));
    await writable.close();
    ljRecordAction('write');
    setLinkJsonStatus('🔗 ' + linkedJsonFileName + ljLastActionText());
    return true;
  }catch(e){
    console.warn('تعذّر الحفظ في الملف المرتبط', e);
    setLinkJsonStatus('⚠️ تعذّر الحفظ التلقائي — قد يكون الملف نُقل أو حُذف');
    return false;
  }
}

/* مزامنة مؤجَّلة (debounce) — لتفادي كتابة الملف عشرات المرات أثناء عمليات متتالية سريعة */
function syncToLinkedFileDebounced(){
  if(!linkedJsonHandle) return;
  if(ljSyncTimer) clearTimeout(ljSyncTimer);
  ljSyncTimer = setTimeout(writeStateToHandle, 700);
}

async function readHandleText(handle){
  const file = await handle.getFile();
  const text = await file.text();
  ljRecordAction('read');
  return text;
}

async function pickAndLinkJson(mode){
  mode = mode || 'open';
  if(!ljFsApiSupported){
    alert('ميزة الربط التلقائي مدعومة فقط في متصفحي Chrome أو Edge على الحاسوب. استخدم زر "📁 الملف" للاستيراد والتصدير اليدوي بدلاً من ذلك.');
    return;
  }
  try{
    const ljTypes = [{ description:'ملف بيانات نجوم مدرستي', accept: {'application/json':['.json']} }];
    let handle;
    if(mode === 'new'){
      handle = await window.showSaveFilePicker({ suggestedName: 'nojoom_' + ((getSchoolInfo().teacher || 'data').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_')) + '.json', types: ljTypes });
    } else {
      const picked = await window.showOpenFilePicker({ types: ljTypes, multiple: false });
      handle = picked[0];
      const perm = await handle.requestPermission({mode:'readwrite'});
      if(perm !== 'granted'){ alert('لم تُمنح صلاحية الكتابة على الملف، لا يمكن الربط التلقائي بدونها.'); return; }
    }
    let existingText = '';
    try{ existingText = await readHandleText(handle); }catch(e){ existingText = ''; }

    linkedJsonHandle = handle;
    linkedJsonFileName = handle.name;
    await ljSaveHandle(handle);

    let hasData = false;
    if(existingText && existingText.trim()){
      try{
        const parsed = JSON.parse(existingText);
        hasData = !!(parsed && parsed.classes && parsed.classes.length);
      }catch(e){ hasData = false; }
    }

    if(hasData){
      const wantsImport = confirm('الملف المرتبط يحتوي على بيانات محفوظة سابقاً.\n\nاضغط "موافق" لاستيراد بياناته إلى المتصفح (سيتم دمجها مع البيانات الحالية حسب أسماء الطلاب).\nاضغط "إلغاء" للإبقاء على بيانات المتصفح الحالية وحفظها في الملف بدلاً منها.');
      if(wantsImport){
        importFromJSON(existingText);
        toast('تم استيراد البيانات من الملف المرتبط ✅', '🔗');
      } else {
        await writeStateToHandle();
        toast('تم حفظ بيانات المتصفح في الملف المرتبط ✅', '🔗');
      }
    } else {
      await writeStateToHandle();
      toast('تم ربط الملف — سيُحفَظ تلقائياً من الآن ✅', '🔗');
    }

    const btn = document.getElementById('btnLinkJson');
    btn.textContent = '🔗';
    btn.title = 'مرتبط بملف: ' + linkedJsonFileName + ' — اضغط لخيارات الربط';
    setLinkJsonStatus('🔗 ' + linkedJsonFileName + ljLastActionText());
  }catch(err){
    if(err && err.name === 'AbortError') return;
    console.error(err);
    alert('تعذّر ربط الملف: ' + err.message);
  }
}

async function manualSyncNow(){
  const ok = await writeStateToHandle();
  if(ok) toast('تمت المزامنة مع الملف المرتبط ✅', '🔄');
}

async function unlinkJsonFile(){
  await ljClearHandle();
  linkedJsonHandle = null;
  linkedJsonFileName = '';
  ljLastAction = null;
  const btn = document.getElementById('btnLinkJson');
  btn.textContent = '🔗';
  btn.title = 'ربط تلقائي بملف JSON على الجهاز (قراءة وكتابة تلقائية)';
  setLinkJsonStatus('');
  toast('تم فك الربط التلقائي', '✖');
}

async function onLinkJsonBtnClick(){
  if(!ljFsApiSupported){
    alert('ميزة الربط التلقائي مدعومة فقط في متصفحي Chrome أو Edge على الحاسوب. استخدم زر "📁 الملف" للاستيراد والتصدير اليدوي بدلاً من ذلك.');
    return;
  }
  if(!linkedJsonHandle){
    showLinkMenu(false);
    return;
  }
  const perm = await linkedJsonHandle.queryPermission({mode:'readwrite'});
  if(perm !== 'granted'){
    try{
      const reqPerm = await linkedJsonHandle.requestPermission({mode:'readwrite'});
      if(reqPerm === 'granted'){
        const btn = document.getElementById('btnLinkJson');
        btn.textContent = '🔗';
        btn.title = 'مرتبط بملف: ' + linkedJsonFileName + ' — اضغط لخيارات الربط';
        const text = await readHandleText(linkedJsonHandle);
        if(text && text.trim()){
          try{ const parsed = JSON.parse(text); if(parsed && parsed.classes) importFromJSON(text); }catch(e){ /* تجاهل */ }
        }
        setLinkJsonStatus('🔗 ' + linkedJsonFileName + ljLastActionText());
        toast('تم إعادة تفعيل الربط التلقائي ✅', '🔗');
      } else {
        setLinkJsonStatus('⚠️ لم تُمنح الصلاحية');
      }
    }catch(e){ console.warn(e); }
    return;
  }
  showLinkMenu(true);
}

function showLinkMenu(linked){
  openModal(`
    <div class="modal-title">🔗 الربط التلقائي</div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">${linked ? 'مرتبط حالياً بملف: <b>'+linkedJsonFileName+'</b>' : 'اختر طريقة الربط. لن يُنشأ أي ملف جديد إلا إذا اخترت ذلك.'}</p>
    <div class="modal-actions" style="flex-direction:column;gap:10px">
      ${linked ? `<button class="btn btn-primary" style="width:100%;justify-content:flex-start;gap:10px" onclick="closeModalForce();manualSyncNow()">🔄 مزامنة الآن</button>` : ''}
      <button class="btn ${linked?'btn-ghost':'btn-primary'}" style="width:100%;justify-content:flex-start;gap:10px" onclick="closeModalForce();pickAndLinkJson('open')">📂 ${linked?'ربط ملف JSON موجود آخر':'ربط ملف JSON موجود'}</button>
      <button class="btn btn-ghost" style="width:100%;justify-content:flex-start;gap:10px" onclick="closeModalForce();pickAndLinkJson('new')">🆕 إنشاء ملف جديد وربطه</button>
      ${linked ? `<button class="btn btn-danger" style="width:100%;justify-content:flex-start;gap:10px" onclick="closeModalForce();unlinkJsonFile()">✖ فك الربط</button>` : ''}
      <button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button>
    </div>`);
}

async function initLinkedFileOnLoad(){
  if(!ljFsApiSupported) return;
  try{
    const handle = await ljLoadHandle();
    if(!handle) return;
    linkedJsonHandle = handle;
    linkedJsonFileName = handle.name;
    const perm = await handle.queryPermission({mode:'readwrite'});
    const btn = document.getElementById('btnLinkJson');
    if(perm === 'granted'){
      btn.textContent = '🔗';
      btn.title = 'مرتبط بملف: ' + linkedJsonFileName + ' — اضغط لخيارات الربط';
      const text = await readHandleText(handle);
      if(text && text.trim()){
        try{
          const parsed = JSON.parse(text);
          if(parsed && parsed.classes){
            importFromJSON(text);
          }
        }catch(e){ /* ملف غير صالح — تجاهل القراءة والاستمرار بالبيانات المحلية */ }
      }
      setLinkJsonStatus('🔗 ' + linkedJsonFileName + ljLastActionText());
    } else {
      btn.textContent = '🔓';
      btn.title = 'اضغط لإعادة تفعيل الربط بـ: ' + linkedJsonFileName;
      setLinkJsonStatus('اضغط لإعادة تفعيل الربط بـ: ' + linkedJsonFileName);
    }
  }catch(e){ console.warn('تعذّرت استعادة الربط التلقائي', e); }
}
