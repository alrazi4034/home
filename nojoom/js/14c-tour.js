/* 14c-tour.js — جولة تعريفية: تُعرض مرة واحدة تلقائياً، وتُعاد من زر ❓ */

const TOUR_STEPS = [
  { sel: '#btnSetup', t: '🔗 الربط والإعداد', d: 'من هنا تربط الملف المركزي، وتختار اسمك وصفوفك، وتربط ملف بياناتك على OneDrive. مرة واحدة فقط.' },
  { sel: '#today-bar', t: '📅 حصصي اليوم', d: 'حصصك في هذا اليوم: ✅ محفوظة، ⏳ الحصة الحالية. اضغط على أي حصة لتنتقل لصفها مباشرة.' },
  { sel: '#class-tabs-container', t: '🏫 الصف', d: 'اختر الصف. يبقى نفس الصف محدداً عند الانتقال للتقارير والغياب والجلوس.' },
  { sel: '#period-chips', t: '🔢 رقم الحصة', d: 'حدّد رقم الحصة قبل الحفظ (إلزامي). البرنامج يتذكر حصصك ويحددها لك في الأسبوع التالي.' },
  { sel: '.att-btn', t: '✅ الحضور', d: 'اضغط على الزر للتبديل: حاضر ← ⏰ متأخر ← غائب.' },
  { sel: '[onclick="markAllPresent()"]', t: '⚡ تحضير سريع', d: '«حضور الكل» ثم اضغط فقط على الغائبين والمتأخرين.' },
  { sel: '.part-btn', t: '✋ المشاركة والملاحظات', d: '+1 مشاركة، ➖ خصم نقطة، 📝 ملاحظة سلوكية (تُحفظ فوراً وتُرسل لولي الأمر إن أردت).' },
  { sel: '#btnRandom', t: '🎲 اختيار عشوائي', d: 'يختار طالباً حاضراً للإجابة، ويفضّل من لم يُختر أو شارك أقل اليوم.' },
  { sel: '#btnSaveSession', t: '💾 حفظ الحصة', d: 'لا تنسَ الحفظ في نهاية الحصة. إذا انتقلت دون حفظ سيذكّرك البرنامج.' },
  { sel: '#undoBtn', t: '↩️ التراجع', d: 'أخطأت؟ اضغط «تراجع» (أو Ctrl+Z) للتراجع عن آخر عملية، وسيظهر لك ما تم التراجع عنه.', show: true },
  { sel: '[data-i18n="nav_report"]', t: '📊 التقارير', d: 'تقرير كل طالب، ومنه «تطوّر الطالب» مع خطط مقترحة قابلة للطباعة.' },
  { sel: '[data-i18n="nav_leaderboard"]', t: '🏆 المتصدرون', d: 'ترتيب الطلاب، ومنه «🌟 قوائم النجوم»: نجوم اليوم والأسبوع والفصل للطباعة.' },
  { sel: '#btnTour', t: '❓ المساعدة', d: 'يمكنك إعادة هذه الجولة في أي وقت من هذا الزر.' }
];
let _tourI = 0;
function startTour() {
  try { closeModalForce(); } catch (e) {}
  if (!onAttendancePage()) { _guardBusy = true; try { showPage('attendance', document.querySelector('[data-i18n="nav_attendance"]')); } finally { _guardBusy = false; } }
  _tourI = 0;
  tourShow();
}
function tourEnd() {
  document.getElementById('tour-ov')?.remove();
  const u = document.getElementById('undoBtn'); if (u && u.dataset.tourShown) { delete u.dataset.tourShown; undoRefreshButton(); }
  try { localStorage.setItem('nojomi_tour_done', '1'); } catch (e) {}
}
function tourGo(d) { _tourI += d; if (_tourI < 0) _tourI = 0; if (_tourI >= TOUR_STEPS.length) return tourEnd(); tourShow(); }
function tourShow() {
  // تخطّي الخطوات غير الظاهرة
  let st, el;
  while (_tourI < TOUR_STEPS.length) {
    st = TOUR_STEPS[_tourI];
    if (st.show) { const u = document.querySelector(st.sel); if (u && u.style.display === 'none') { u.style.display = 'flex'; u.dataset.tourShown = '1'; } }
    el = document.querySelector(st.sel);
    if (el && el.getClientRects().length && getComputedStyle(el).display !== 'none') break;
    _tourI++;
  }
  if (_tourI >= TOUR_STEPS.length) return tourEnd();
  el.scrollIntoView({ block: 'center', behavior: 'instant' });
  const r = el.getBoundingClientRect(), pad = 6;
  let ov = document.getElementById('tour-ov');
  if (!ov) { ov = document.createElement('div'); ov.id = 'tour-ov'; document.body.appendChild(ov); }
  const below = r.bottom + 190 < innerHeight;
  const top = below ? r.bottom + 12 : Math.max(10, r.top - 190);
  const left = Math.min(Math.max(10, r.left + r.width / 2 - 160), innerWidth - 330);
  ov.innerHTML = `
    <div class="tour-hole" style="top:${r.top - pad}px;left:${r.left - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px"></div>
    <div class="tour-box" style="top:${top}px;left:${left}px">
      <div style="font-size:11px;color:var(--text-muted)">${_tourI + 1} / ${TOUR_STEPS.length}</div>
      <div style="font-weight:900;font-size:15px;margin:4px 0">${st.t}</div>
      <div style="font-size:13px;line-height:1.8">${st.d}</div>
      <div style="display:flex;gap:6px;margin-top:10px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="tourEnd()">إنهاء</button>
        ${_tourI > 0 ? '<button class="btn btn-ghost btn-sm" onclick="tourGo(-1)">السابق</button>' : ''}
        <button class="btn btn-primary btn-sm" onclick="tourGo(1)">${_tourI === TOUR_STEPS.length - 1 ? 'تم ✓' : 'التالي'}</button>
      </div>
    </div>`;
}
window.addEventListener('resize', () => { if (document.getElementById('tour-ov')) tourShow(); });
document.addEventListener('keydown', e => { if (document.getElementById('tour-ov') && e.key === 'Escape') tourEnd(); });

// أول مرة: بعد اكتمال التحميل وإذا لم تكن نافذة الإعداد مفتوحة
function maybeStartTour() {
  let done = false;
  try { done = localStorage.getItem('nojomi_tour_done') === '1'; } catch (e) {}
  if (done || document.getElementById('modal-overlay')?.classList.contains('show')) return;
  setTimeout(startTour, 600);
}
