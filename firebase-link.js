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
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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
const provider = new GoogleAuthProvider();

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
 * تسجيل الدخول بحساب Google (نافذة منبثقة)، ثم سحب الملف من Firestore.
 */
async function linkFile(onData, onError) {
  try {
    if (!currentUser) {
      const result = await signInWithPopup(auth, provider);
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
      if (onError) onError(new Error('حسابك غير مصرّح له بالوصول لبيانات المدرسة. تواصل مع مسؤول النظام لإضافة بريدك.'));
      return;
    }
    if (err && err.code === 'auth/popup-closed-by-user') return; // المستخدم أغلق نافذة تسجيل الدخول
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
