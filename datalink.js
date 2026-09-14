/* =====================================================================
   datalink.js — طبقة الربط التلقائي المشتركة لبرامج مدرسة الرازي
   =====================================================================
   يحفظ "handle" الملف (ملف بيانات المدرسة .xlsx) في IndexedDB الخاصة
   بالمتصفح لهذا الموقع. بما أن كل صفحات البرنامج (index.html,
   attendance.html, behavior.html ...الخ) تعمل من نفس الدومين، فكلها
   تقدر تصل لنفس الـ handle المحفوظ — فبمجرد ما يتم الربط مرة واحدة من
   أي صفحة، باقي الصفحات تقدر "تسحب" نفس ملف البيانات تلقائياً دون
   الحاجة لإعادة رفعه، وبدون ما ينفصل الربط عند تحديث الصفحة (F5).

   طريقة الاستخدام في أي صفحة:
     <script src="./datalink.js"></script>
     ...
     RaziLink.tryAutoLink(buf => { // حمّل الـ workbook هنا
     });
     RaziLink.linkFile(buf => { // نفس الشي بعد اختيار المستخدم للملف
     });
   ===================================================================== */

(function (global) {
  const DB_NAME = 'razi-portal-link';
  const STORE = 'handles';
  const KEY = 'schoolDataFile';

  function fsaSupported() {
    return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveHandle(handle) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(handle, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function loadHandle() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function clearHandle() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function ensurePermission(handle, mode) {
    const opts = { mode: mode || 'read' };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    // requestPermission يحتاج إيماءة مستخدم (نقرة زر) في أول مرة فقط —
    // بعدها المتصفح يتذكر الإذن لنفس الموقع بدون ما يسأل من جديد.
    if ((await handle.requestPermission(opts)) === 'granted') return true;
    return false;
  }

  /**
   * يحاول إعادة الاتصال تلقائياً بالملف المرتبط سابقاً (بدون أي نقرة من
   * المستخدم) إن كان الإذن ما زال ممنوحاً. يُستدعى عند تحميل الصفحة.
   * onData(arrayBuffer, fileName, handle) تُستدعى عند النجاح.
   * يرجع 'linked' | 'needs-gesture' | 'none' | 'unsupported'
   */
  async function tryAutoLink(onData) {
    if (!fsaSupported()) return 'unsupported';
    let handle;
    try {
      handle = await loadHandle();
    } catch (e) {
      return 'none';
    }
    if (!handle) return 'none';
    try {
      const granted = await handle.queryPermission({ mode: 'readwrite' });
      if (granted !== 'granted') return 'needs-gesture';
      const file = await handle.getFile();
      const buf = await file.arrayBuffer();
      if (onData) onData(buf, file.name, handle);
      return 'linked';
    } catch (e) {
      return 'none';
    }
  }

  /**
   * يفتح منتقي الملفات ويربط ملفاً جديداً (يحتاج نقرة زر من المستخدم).
   * يحفظ الـ handle في IndexedDB ليصير متاحاً لهذه الصفحة وباقي الصفحات
   * على نفس الموقع تلقائياً بعد ذلك.
   */
  async function linkFile(onData, onError) {
    if (!fsaSupported()) {
      if (onError) onError(new Error('unsupported'));
      return;
    }
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'ملف Excel',
          accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
        }],
        excludeAcceptAllOption: false,
        multiple: false
      });
      const ok = await ensurePermission(handle, 'readwrite');
      if (!ok) { if (onError) onError(new Error('permission-denied')); return; }
      await saveHandle(handle);
      const file = await handle.getFile();
      const buf = await file.arrayBuffer();
      if (onData) onData(buf, file.name, handle);
    } catch (err) {
      if (err && err.name === 'AbortError') return; // المستخدم ألغى الاختيار
      if (onError) onError(err);
    }
  }

  /** يكتب ArrayBuffer جديد مباشرة على نفس الملف المرتبط (بدون تنزيل نسخة). */
  async function writeToLinkedFile(handle, arrayBuffer) {
    const ok = await ensurePermission(handle, 'readwrite');
    if (!ok) throw new Error('permission-denied');
    const writable = await handle.createWritable();
    await writable.write(arrayBuffer);
    await writable.close();
  }

  /** يزيل الربط المحفوظ (لو المستخدم أراد ربط ملف مختلف). */
  async function unlink() {
    await clearHandle();
  }

  /**
   * يعيد الاتصال بالملف المرتبط سابقاً (المحفوظ بـ IndexedDB) بطلب صلاحية
   * فقط — بدون فتح منتقي ملفات جديد. يحتاج نقرة زر من المستخدم (لأن
   * requestPermission يتطلب إيماءة مستخدم). onError تُستدعى إن لم يوجد
   * ملف مرتبط أصلاً (لتتيح للمستدعي الرجوع لـ linkFile كبديل).
   */
  async function reconnect(onData, onError) {
    if (!fsaSupported()) {
      if (onError) onError(new Error('unsupported'));
      return;
    }
    let handle;
    try {
      handle = await loadHandle();
    } catch (e) {
      handle = null;
    }
    if (!handle) {
      if (onError) onError(new Error('no-stored-handle'));
      return;
    }
    try {
      const ok = await ensurePermission(handle, 'readwrite');
      if (!ok) { if (onError) onError(new Error('permission-denied')); return; }
      const file = await handle.getFile();
      const buf = await file.arrayBuffer();
      if (onData) onData(buf, file.name, handle);
    } catch (err) {
      if (onError) onError(err);
    }
  }

  global.RaziLink = {
    fsaSupported,
    tryAutoLink,
    linkFile,
    writeToLinkedFile,
    unlink,
    loadHandle,
    reconnect
  };
})(window);
