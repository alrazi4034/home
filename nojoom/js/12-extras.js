/* 12-extras.js — فلتر الحروف، إضافة ملاحظة من صفحة الحضور، نافذة "حول" */

// ===== LETTER FILTER =====
let _activeLetterFilter = 'all';

function renderLetterFilter() {
  const container = document.getElementById('student-letter-filter');
  if (!container) return;
  const cls = state.classes.find(c => c.id === state.activeClass);
  if (!cls || !cls.students.length) { container.innerHTML = ''; return; }

  // جمع الحرف الأول من كل اسم (بدون تكرار)
  const letters = [...new Set(cls.students.map(s => s.name.trim().charAt(0)))].sort((a,b) => a.localeCompare(b, 'ar'));

  container.innerHTML = `
    <button onclick="setLetterFilter('all')" class="flt-btn ${_activeLetterFilter==='all'?'flt-btn-on':''}">الكل</button>
    ${letters.map(l => `
      <button onclick="setLetterFilter('${l}')" class="flt-btn ${_activeLetterFilter===l?'flt-btn-on':''}">${l}</button>`).join('')}
  `;
}

function setLetterFilter(letter) {
  _activeLetterFilter = letter;
  renderLetterFilter();
  applyLetterFilter();
}

function applyLetterFilter() {
  const rows = document.querySelectorAll('#student-list-container .student-row');
  rows.forEach(row => {
    const name = (row.querySelector('.student-name')?.textContent || '').trim();
    const show = _activeLetterFilter === 'all' || name.charAt(0) === _activeLetterFilter;
    row.style.display = show ? '' : 'none';
  });
}

function filterStudentList() {
  // kept for compatibility — now handled by letter filter
  applyLetterFilter();
}

// ===== ADD NOTE FROM ATTENDANCE PAGE — يستخدم نفس النافذة الموحدة مع أزرار النقاط =====
function showAddNoteFromAttendance(studentId, studentName, parentPhone) {
  showAddNoteModal(studentId, studentName, parentPhone, () => {
    refreshAllPointsUI(studentId);
  });
}

function openDirectWhatsApp(phone, studentName) {
  const msg = `السلام عليكم، هذه رسالة بشأن ابنكم/ابنتكم ${studentName}.`;
  window.open(`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
}

function saveNoteFromAttendance(studentId, parentPhone) {
  saveNoteUnified(studentId, parentPhone, () => {
    refreshAllPointsUI(studentId);
  });
}

function saveNoteAndNotifyFromAttendance(studentId, studentName, parentPhone) {
  saveNoteAndShowQR(studentId, studentName, parentPhone);
}

function saveNoteAndShowQR(studentId, studentName, parentPhone) {
  saveNoteUnified(studentId, parentPhone, () => {
    const s = state.classes.flatMap(c => c.students).find(st => st.id === studentId);
    if (s) {
      const ptsEl = document.getElementById('pts-' + studentId);
      if (ptsEl) ptsEl.textContent = '⭐ ' + s.points;
    }
    updateLeaderboard();
    showParentQR(studentId, studentName, parentPhone);
  });
}

// ===== ABOUT MODAL =====
// ===== XOR — بيانات المطوّر =====
function _ad(a){return a.map(n=>String.fromCharCode(n^61)).join('');}
var _a1=_ad([1656,1552,1656,1653,1554,29,1545,1552,1562,1554,1556]);
var _a2=_ad([80,92,85,80,82,72,89,19,78,85,88,85,89,92,125,80,82,88,19,78,94,85,19,92,88]);
var _a3=_ad([1656,1554,1548,1550,1556,29,1562,1657,1548,1562,1551,1655,29,1657,1657,1559,1540,1657,1655,1656,29,1562,1657,1566,1550,1562,1550,1655,29,8233,29,1554,1557,1655]);
var _a4=_ad([1656,1555,1544,1544,29,1657,1657,1562,1550,1559,1555,1554,1562,1656,29,1562,1657,1559,1540,1657,1655,1656,1655,29,1660,1655,29,1562,1657,1656,1554,1562,1548,1550,29,1562,1657,1552,1662,1653,1656,1655,1556,29,8233,29,1562,1657,1560,1656,1562,1548,1562,1559,29,1562,1657,1540,1548,1557,1655,1556,29,1562,1657,1656,1559,1552,1554,1556]);
var _a5=_ad([1656,1546,1653,1644,1548,29,1562,1657,1557,1548,1659,1562,1656,1553,29,18,29,1562,1657,1566,1550,1559,1562,1549]);
var _a6=_ad([1656,1554,1548,1550,1556,29,1562,1657,1548,1562,1551,1655,29,8233,29,9,13,14,9,29,8233,29,1554,1557,1655]);
var _a7=_ad([1557,1554,1548,1655,1556,29,1562,1657,1541,1659,1552,1562,1659,1655]);
var _a8=_ad([148,29,15,13,15,11,29,1656,1552,1656,1653,1554,29,1545,1552,1562,1554,1556,19,29,1553,1656,1655,1540,29,1562,1657,1552,1663,1653,1663,29,1656,1552,1660,1653,1541,1556,19,29,1655,1650,1656,1659,1540,29,1659,1550,1555,29,1566,1653,29,1559,1653,1551,1655,1540,29,1566,1653,29,1559,1540,1554,1655,1657,29,1562,1657,1557,1548,1659,1562,1656,1553,29,1554,1653,1659,29,1560,1549,1659,29,1544,1548,1655,1552,19]);
var _a9=_ad([148,29,1553,1656,1655,1540,29,1562,1657,1552,1663,1653,1663,29,1656,1552,1660,1653,1541,1556,29,1657,1656,1552,1656,1653,1554,29,1545,1552,1562,1554,1556,29,8233,29,1656,1554,1548,1550,1556,29,1562,1657,1548,1562,1551,1655]);
var _a0=_ad([1557,1548,1659,1562,1656,1553,29,1549,1662,1655,29,1544,1650,1656,1645,1644,1656,29,1657,1656,1550,1562,1540,1554,1556,29,1562,1657,1656,1540,1657,1656,29,1540,1657,1652,29,1656,1559,1562,1557,1540,1556,29,1566,1554,1562,1564,29,1546,1657,1562,1557,1658,29,1557,1545,1662,1657,29,1545,1562,1656,1657,29,1653,1550,1658,1657,1585,29,1656,1659,29,1555,1657,1562,1657,29,1559,1550,1553,1655,1657,29,1562,1657,1552,1547,1653,1548,29,1653,1562,1657,1543,1655,1562,1557,1585,29,1562,1552,1559,1550,1562,1557,29,1562,1657,1659,1663,1562,1546,29,1653,1562,1657,1656,1545,1562,1548,1662,1562,1559,1585,29,1653,1559,1552,1657,1655,1657,29,1562,1657,1557,1655,1562,1659,1562,1559,29,1657,1560,1544,1554,1562,1548,29,1559,1663,1562,1548,1655,1548,29,1554,1663,1655,1663,1556,29,1559,1554,1540,1656,29,1562,1657,1540,1656,1657,1655,1556,29,1562,1657,1559,1540,1657,1655,1656,1655,1556,19]);
// ==================
function showAboutModal() {
  openModal(`
    <div style="max-height:75vh;overflow-y:auto;padding-right:4px">

      <!-- العنوان -->
      <div style="text-align:center;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid rgba(247,201,72,0.2)">
        <div style="font-size:26px;margin-bottom:4px">⭐</div>
        <div style="font-size:18px;font-weight:900;color:var(--accent);letter-spacing:1px">نجوم مدرستي</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px">نظام متابعة أداء الطلاب — v35</div>
      </div>

      <!-- 1. المطوّر -->
      <div style="margin-bottom:14px;background:rgba(247,201,72,0.06);border:1px solid rgba(247,201,72,0.18);border-radius:12px;padding:12px 14px">
        <div style="font-size:12px;font-weight:800;color:var(--accent);margin-bottom:7px">👨‍💻 المطوّر</div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${_a1}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;direction:ltr;text-align:right">${_a2}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${_a3}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${_a4}</div>
      </div>

      <!-- 2. عن البرنامج -->
      <div style="margin-bottom:14px">
        <div style="font-size:12px;font-weight:800;color:var(--accent);margin-bottom:5px">📖 عن البرنامج</div>
        <div style="font-size:11px;color:var(--text-muted);line-height:1.8">
          ${_a0}
        </div>
      </div>

      <!-- 3. الأهداف -->
      <div style="margin-bottom:14px">
        <div style="font-size:12px;font-weight:800;color:var(--accent);margin-bottom:6px">🎯 الأهداف</div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${['تعزيز دافعية الطلاب وتحفيزهم على التميّز','تسهيل متابعة الحضور والسلوك والمشاركة اليومية','توفير تقارير واضحة تدعم اتخاذ القرارات التربوية','تحسين التواصل بين المعلم وولي الأمر'].map(t=>`
            <div style="display:flex;align-items:flex-start;gap:7px;font-size:11px;color:var(--text-muted);line-height:1.6">
              <span style="color:var(--present);flex-shrink:0;margin-top:1px">✓</span>${t}
            </div>`).join('')}
        </div>
      </div>

      <!-- 4. المميزات -->
      <div style="margin-bottom:14px">
        <div style="font-size:12px;font-weight:800;color:var(--accent);margin-bottom:6px">⚙️ المميزات</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
          ${['تسجيل الحضور والغياب اليومي','نظام نقاط ومكافآت تحفيزي','لوحة المتصدرين وشهادات التقدير','تقارير تفصيلية لكل طالب','إدارة الصفوف والطلاب بسهولة','استيراد وتصدير (CSV / JSON)','إحصائيات شاملة لجميع الصفوف','يعمل بدون إنترنت — Offline'].map(f=>`
            <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text-muted);background:rgba(255,255,255,0.04);border-radius:7px;padding:4px 7px">
              <span style="color:var(--accent);font-size:9px">◆</span>${f}
            </div>`).join('')}
        </div>
      </div>

      <!-- 5. الإهداء -->
      <div style="margin-bottom:14px;background:linear-gradient(135deg,rgba(247,201,72,0.07),rgba(255,159,67,0.05));border:1px solid rgba(247,201,72,0.18);border-radius:12px;padding:14px;text-align:center">
        <div style="font-size:12px;font-weight:800;color:var(--accent);margin-bottom:7px">❤️ إهداء</div>
        <div style="font-size:11px;color:var(--text-muted);line-height:1.9">
          إلى كلّ معلم مخلص في دولة الإمارات العربية المتحدة<br>
          <span style="color:var(--text)">شكراً لعطائكم وجهودكم في بناء الأجيال وصناعة مستقبل هذا الوطن الغالي.</span><br><br>
          نُهدي هذا البرنامج تقديراً لدوركم العظيم في رفعة الإمارات،<br>
          سائلين الله أن يحفظ هذا الوطن ويديم عليه التقدم والازدهار.<br><br>
          <span style="color:var(--text-muted);font-size:10px">مع خالص المحبة والتقدير</span>
        </div>
        <div style="margin-top:10px;font-size:16px">🇦🇪</div>
        <!-- التوقيع -->
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(247,201,72,0.15);font-size:11px;color:var(--text-muted);line-height:1.8">
          ${_a5} <span style="color:var(--text);font-weight:700">${_a1}</span><br>
          ${_a6}<br>
          مديرة المدرسة: <span style="color:var(--accent)">${_a7}</span>
        </div>
      </div>

      <!-- زر التقييم -->
      <div style="text-align:center;margin-bottom:14px">
        <a href="https://forms.cloud.microsoft/r/hejfi0MmjJ" target="_blank"
          style="display:inline-flex;align-items:center;gap:6px;padding:9px 20px;border-radius:10px;background:linear-gradient(135deg,rgba(247,201,72,0.2),rgba(255,159,67,0.15));border:1.5px solid rgba(247,201,72,0.5);color:var(--accent);text-decoration:none;font-family:Tajawal,sans-serif;font-size:13px;font-weight:800">
          ⭐ شاركنا رأيك — تقييم البرنامج
        </a>
      </div>

      <!-- 6. حقوق النشر -->
      <div style="font-size:10px;color:var(--text-muted);text-align:center;line-height:1.7;padding-bottom:4px">
        <span style="font-weight:700;color:var(--text)">📜 حقوق النشر</span><br>
        ${_a8}
       <br> <button onclick="closeModalForce()" style="display:inline-block;margin-right:18px;margin-top:14px;background:rgba(111,111,111,0.07);border:1px solid rgba(55,55,55,0.15);color:var(--text-muted);font-family:Tajawal,sans-serif;font-size:16px;padding:2px 10px;border-radius:6px;cursor:pointer">إغلاق</button>
      </div>

    </div>
  `);
  setTimeout(()=>{ const m=document.getElementById('modal-content'); if(m) m.closest('.modal')?.classList.add('about-modal'); },10);
}

// تعبئة بيانات المطوّر من XOR عند التحميل
(function(){
  var fc = document.getElementById('site-footer-cr');
  if (fc) fc.textContent = _a9;
  document.querySelectorAll('.cert-cr-text').forEach(function(el){ el.textContent = '© ' + _a1 + ' — ' + _a6; });
})();
