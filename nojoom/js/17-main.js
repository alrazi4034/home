/* 17-main.js — التفعيل وبدء تشغيل البرنامج — يجب أن يبقى آخر ملف */

// ===== INIT =====

// ===== نظام التفعيل =====
function _lv(){ return [26,29,30,22,26,31].map(n=>String.fromCharCode(n^47)).join(''); }

function licCheck() {
  var val = document.getElementById('lic-input').value.trim();
  var inp = document.getElementById('lic-input');
  var msg = document.getElementById('lic-msg');
  if (val === _lv()) {
    localStorage.setItem('nojomi_activated', '1');
    document.getElementById('lic-overlay').classList.add('hidden');
  } else {
    inp.classList.add('error');
    msg.textContent = '❌ كود غير صحيح';
    setTimeout(function(){ inp.classList.remove('error'); }, 400);
    inp.value = '';
  }
}

// ⚙️ مفتاح التفعيل: false = التفعيل معطّل (يفتح البرنامج مباشرة) | true = يطلب كود الدخول
const LICENSE_REQUIRED = false;
if (!LICENSE_REQUIRED || localStorage.getItem('nojomi_activated') === '1') {
  document.getElementById('lic-overlay').classList.add('hidden');
}
// ===========================
load();
// رسم ترويسة المدرسة من البيانات المحفوظة
(function() { const _si = state.schoolInfo || {}; renderSchoolInfoBar(_si.subject||'', _si.teacher||'', _si.schoolName||''); })();
if (!state.assessments) state.assessments = [];
if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-mode');
setTodayDate();
renderClassTabs();
renderStudentList();
renderClasses();
updateLeaderboard();
updateReportSelects();


// المزامنة مع القائمة المركزية بعد اكتمال قراءة الملف المرتبط
initLinkedFileOnLoad().finally(() => rosterInitOnLoad());
