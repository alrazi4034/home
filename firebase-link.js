/* =====================================================================
   firebase-link.js — طبقة الربط عبر Firebase (تسجيل دخول Google + تخزين
   سحابي في Firestore) — تحل محل datalink.js القديم (File System Access
   API المحلي) بنفس واجهة RaziLink.* تماماً، حتى لا نحتاج لتعديل باقي
   كود الصفحة (2000+ سطر).

   لماذا Firestore وليس Firebase Storage؟
   اعتباراً من فبراير 2026، Firebase Storage يتطلب ترقية لخطة Blaze
   (تحتاج بطاقة ائتمان مربوطة، حتى لو بدون رسوم فعلية). Firestore يبقى
   مجانياً بالكامل على خطة Spark بدون أي بطاقة — لذلك نخزّن ملف الإكسل
   كنص Base64 داخل مستند واحد في Firestore بدل تخزينه كملف.
   ملاحظة: حد Firestore للمستند الواحد هو 1MB تقريباً — يكفي بسهولة
   لملف بيانات مدرسة عادي (طلاب + معلمين + إداريين).

   طريقة الاستخدام (كما في الملف القديم تماماً):
     <script type="module" src="./firebase-link.js"></script>
     ...
     RaziLink.tryAutoLink((buf, fileName, handle) => { ... });
     RaziLink.linkFile((buf, fileName, handle) => { ... }, (err) => { ... });
     RaziLink.writeToLinkedFile(handle, arrayBuffer);
     RaziLink.unlink();
   ===================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/* ---------- نافذة صغيرة لإدخال البريد وكلمة المرور (بدل نافذة Google) ---------- */
function showLoginModal() {
  return new Promise((resolve, reject) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:sans-serif;direction:rtl;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:10px;padding:26px;width:min(320px,90vw);box-shadow:0 10px 30px rgba(0,0,0,.2);">
        <h3 style="margin:0 0 16px;font-size:16px;">🔐 تسجيل دخول الإداريين</h3>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <input id="raziLoginEmail" type="email" placeholder="البريد الإلكتروني" style="padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
          <input id="raziLoginPass" type="password" placeholder="كلمة المرور" style="padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
          <div id="raziLoginErr" style="color:#DC2626;font-size:12.5px;display:none;"></div>
          <div style="display:flex;gap:8px;margin-top:6px;">
            <button id="raziLoginSubmit" style="flex:1;padding:10px;border:none;border-radius:6px;background:#2563EB;color:#fff;cursor:pointer;font-size:14px;">دخول</button>
            <button id="raziLoginCancel" style="padding:10px 16px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;font-size:14px;">إلغاء</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const emailEl = overlay.querySelector('#raziLoginEmail');
    const passEl = overlay.querySelector('#raziLoginPass');
    const errEl = overlay.querySelector('#raziLoginErr');
    const cleanup = () => overlay.remove();
    overlay.querySelector('#raziLoginCancel').onclick = () => { cleanup(); reject(new Error('cancelled')); };
    overlay.querySelector('#raziLoginSubmit').onclick = submit;
    passEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    function submit() {
      const email = emailEl.value.trim();
      const pass = passEl.value;
      if (!email || !pass) {
        errEl.textContent = 'أدخل البريد وكلمة المرور.';
        errEl.style.display = 'block';
        return;
      }
      cleanup();
      resolve({ email, pass });
    }
    emailEl.focus();
  });
}

function loginErrorMessage(code) {
  const map = {
    'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة.',
    'auth/user-not-found': 'لا يوجد حساب بهذا البريد.',
    'auth/wrong-password': 'كلمة المرور غير صحيحة.',
    'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة.',
    'auth/too-many-requests': 'محاولات كثيرة فاشلة — حاول لاحقاً.'
  };
  return map[code] || ('تعذّر تسجيل الدخول: ' + code);
}

const firebaseConfig = {
  apiKey: "AIzaSyCKzs1e66o_KhNHhZfx7P6YLba9kmPJU_s",
  authDomain: "alrazi4034-fe795.firebaseapp.com",
  projectId: "alrazi4034-fe795",
  storageBucket: "alrazi4034-fe795.firebasestorage.app",
  messagingSenderId: "275666991476",
  appId: "1:275666991476:web:ced1a2c23935866972d421"
};

// اسم المستند في Firestore الذي يخزّن ملف بيانات المدرسة (مشترك بين كل البرامج)
const DOC_PATH = { collection: 'schoolData', id: 'main' };
const DEFAULT_FILE_NAME = 'بيانات_المدرسة.xlsx';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let authReadyResolve;
const authReady = new Promise((res) => { authReadyResolve = res; });

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  window.RaziCurrentUserEmail = user ? user.email : null;
  if (authReadyResolve) { authReadyResolve(); authReadyResolve = null; }
});

/* ---------- تحويل ArrayBuffer <-> Base64 (لتخزين الملف كنص في Firestore) ---------- */
function bufferToBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/* ---------- تحميل الملف من Firestore ---------- */
async function downloadFile() {
  const ref = doc(db, DOC_PATH.collection, DOC_PATH.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const err = new Error('no-file-yet');
    err.code = 'no-file-yet';
    throw err;
  }
  const data = snap.data();
  const buf = base64ToBuffer(data.fileData);
  const fileName = data.fileName || DEFAULT_FILE_NAME;
  return { buf, fileName };
}

function fsaSupported() {
  // نُبقي نفس اسم الدالة توافقاً مع الكود القديم — هنا تعني "نظام
  // الربط السحابي عبر Firebase متاح ومفعّل".
  return true;
}

/**
 * يحاول إعادة الاتصال تلقائياً: ينتظر تحديد حالة تسجيل الدخول من
 * Firebase (الجلسة محفوظة تلقائياً في المتصفح من مرة سابقة)، فإذا كان
 * المستخدم مسجلاً دخوله يسحب الملف من Firestore مباشرة بدون أي نقرة.
 * يرجع 'linked' | 'needs-gesture' | 'none' | 'unsupported'
 */
async function tryAutoLink(onData) {
  await authReady;
  if (!currentUser) return 'needs-gesture'; // يحتاج ضغط زر "تسجيل الدخول"
  try {
    const { buf, fileName } = await downloadFile();
    if (onData) onData(buf, fileName, 'firebase');
    return 'linked';
  } catch (e) {
    if (e && e.code === 'no-file-yet') return 'none';
    console.warn('تعذّر تحميل بيانات المدرسة من Firestore', e);
    return 'none';
  }
}

/**
 * تسجيل الدخول ببريد وكلمة مرور (نافذة مدمجة)، ثم سحب الملف من Firestore.
 * الحسابات تُنشأ يدوياً من Firebase Console → Authentication → Users،
 * لا يوجد تسجيل ذاتي.
 */
async function linkFile(onData, onError) {
  try {
    if (!currentUser) {
      let creds;
      try {
        creds = await showLoginModal();
      } catch (e) {
        return; // المستخدم ضغط "إلغاء"
      }
      const result = await signInWithEmailAndPassword(auth, creds.email, creds.pass);
      currentUser = result.user;
      window.RaziCurrentUserEmail = currentUser.email;
    }
    const { buf, fileName } = await downloadFile();
    if (onData) onData(buf, fileName, 'firebase');
  } catch (err) {
    if (err && err.code === 'no-file-yet') {
      // أول استخدام: لا يوجد ملف مرفوع بعد على Firebase — هذا متوقع،
      // نعطي إشارة واضحة بدل رسالة خطأ عامة.
      if (onError) onError(new Error('لا يوجد ملف بيانات مرفوع على Firebase بعد. استخدم "استيراد ملف" ثم احفظه ليُرفع لأول مرة.'));
      return;
    }
    if (err && (err.code === 'permission-denied' || err.code === 'firestore/permission-denied')) {
      if (onError) onError(new Error('حسابك غير مصرّح له بالوصول لبيانات المدرسة. تواصل مع مسؤول النظام.'));
      return;
    }
    if (err && err.code && err.code.startsWith('auth/')) {
      if (onError) onError(new Error(loginErrorMessage(err.code)));
      return;
    }
    if (onError) onError(err);
  }
}

/** يحفظ ArrayBuffer جديد في Firestore (يستبدل بيانات المدرسة الحالية). */
async function writeToLinkedFile(handle, arrayBuffer) {
  if (!currentUser) throw new Error('يجب تسجيل الدخول أولاً.');
  const ref = doc(db, DOC_PATH.collection, DOC_PATH.id);
  await setDoc(ref, {
    fileData: bufferToBase64(arrayBuffer),
    fileName: DEFAULT_FILE_NAME,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.email
  });
}

/** تسجيل الخروج من الحساب الحالي. */
async function unlink() {
  await signOut(auth);
  currentUser = null;
  window.RaziCurrentUserEmail = null;
}

async function loadHandle() {
  await authReady;
  return currentUser ? 'firebase' : null;
}

window.RaziLink = {
  fsaSupported,
  tryAutoLink,
  linkFile,
  writeToLinkedFile,
  unlink,
  loadHandle
};
