/* 14b-session-tools.js — أدوات الحصة:
   1) تذكير بالحفظ عند الانتقال دون حفظ الحصة
   2) ↩️ التراجع عن آخر عملية مع إشعار بما تم التراجع عنه
   3) 🎲 اختيار طالب عشوائي
   4) 📅 شريط «حصصي اليوم» + اختيار الصف والحصة تلقائياً حسب توقيت الحصص */

/* =====================================================================
   1) تذكير بالحفظ
   ===================================================================== */
function sessionClass() { return state.classes.find(c => c.id === state.activeClass); }

// التذكير يظهر فقط إذا غيّر المعلم فعلاً شيئاً في هذه الحصة (حضور/تأخر/مشاركة/خصم)
// — مجرد فتح الصف أو التنقل بين الأيام لا يُعدّ تغييراً.
const _touched = new Set();
const _touchKey = cls => cls.id + '|' + sessionDate;
function markSessionTouched() { const c = sessionClass(); if (c) _touched.add(_touchKey(c)); }
function isSessionDirty(cls) {
  cls = cls || sessionClass();
  if (!cls) return false;
  if (!_touched.has(_touchKey(cls))) return false;
  if (!_sessionDiffers(cls)) { _touched.delete(_touchKey(cls)); return false; }
  return true;
}
function _sessionDiffers(cls) {
  const saved = (cls._savedDates || []).includes(sessionDate);
  return cls.students.some(s => {
    const cur = s._todayAtt || 'unmarked';
    if (saved) {
      const prev = (s._prevAtt || {})[sessionDate] || 'unmarked';
      if (cur !== prev) return true;
      if (cur === 'present' && !!s._todayLate !== (s.lateDates || []).includes(sessionDate)) return true;
    } else if (cur !== 'unmarked') return true;
    return ((s._dailyPart || {})[sessionDate] || 0) > 0 || ((s._dailyDeduct || {})[sessionDate] || 0) > 0;
  });
}

let _guardBusy = false;
function guardUnsaved(proceed) {
  const cls = sessionClass();
  if (_guardBusy || !isSessionDirty(cls)) return proceed();
  window._guardProceed = proceed;
  openModal(`
    <div class="modal-title">⚠️ لم تُحفظ الحصة</div>
    <div style="font-size:13.5px;line-height:1.9;margin-bottom:12px">
      لديك تسجيل حضور أو مشاركات في <b>${cls.name}</b> بتاريخ <b>${sessionDate}</b> لم تُحفظ بعد.<br>
      <span style="color:var(--text-muted);font-size:12px">الملاحظات السلوكية تُحفظ فوراً، أما الحضور وسجل المشاركات اليومي فيحتاجان «حفظ الحصة».</span>
    </div>
    ${typeof selPeriods !== 'undefined' && !selPeriods.size ? `<div style="font-size:13px;font-weight:800;text-align:center">🔢 رقم الحصة (مطلوب للحفظ):</div>${periodPickHTML('gp-')}` : ''}
    <div class="modal-actions" style="flex-wrap:wrap">
      <button class="btn btn-primary" style="flex:1" onclick="guardSaveAndGo()">💾 حفظ ثم متابعة</button>
      <button class="btn btn-ghost" onclick="guardGoWithoutSave()">متابعة بدون حفظ</button>
      <button class="btn btn-ghost" onclick="window._guardProceed=null;closeModalForce()">إلغاء</button>
    </div>`);
}
function guardSaveAndGo() {
  if (typeof selPeriods !== 'undefined' && !selPeriods.size) return toast('اختر رقم الحصة أولاً', '⚠️');
  closeModalForce();
  saveSession();
  if (isSessionDirty()) return;               // لم يُحفظ (مثلاً لم تُختر الحصة)
  const go = window._guardProceed; window._guardProceed = null;
  if (go) go();
}
function guardGoWithoutSave() {
  closeModalForce();
  const go = window._guardProceed; window._guardProceed = null;
  _guardBusy = true;
  try { if (go) go(); } finally { _guardBusy = false; }
}
function onAttendancePage() { return document.getElementById('page-attendance')?.classList.contains('active'); }

// تغليف أوامر الانتقال: تغيير الصف، تغيير التاريخ، مغادرة صفحة الحضور
(function wrapNavigation() {
  const wrap = (name, cond) => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function (...args) {
      if (cond && !cond(...args)) return orig.apply(this, args);
      guardUnsaved(() => orig.apply(this, args));
    };
  };
  wrap('setActiveClass', id => id !== state.activeClass);
  wrap('shiftSessionDate');
  wrap('resetSessionToToday');
  wrap('changeSessionDate');
  wrap('showPage', page => page !== 'attendance' && onAttendancePage());
})();
// كل أمر يغيّر الحضور أو المشاركات يُعلِّم الحصة بأنها «تغيّرت»
(function wrapTouches() {
  const touch = name => {
    const orig = window[name];
    if (typeof orig !== 'function' || orig._touchWrapped) return;
    const w = function (...args) { markSessionTouched(); return orig.apply(this, args); };
    w._touchWrapped = true;
    window[name] = w;
  };
  ['toggleAttendance', 'markAllPresent', 'markAllAbsent', 'addParticipation', 'subtractPoint'].forEach(touch);
  // ملف الجلوس يُحمَّل بعد هذا الملف
  document.addEventListener('DOMContentLoaded', () => touch('sxAtt'));
})();
// 🚫 السبت والأحد عطلة نهاية الأسبوع: لا حضور ولا مشاركات ولا حفظ حصة
(function blockWeekend() {
  const block = name => {
    const orig = window[name];
    if (typeof orig !== 'function' || orig._wkWrapped) return;
    const w = function (...args) {
      if (typeof isWeekend === 'function' && isWeekend(sessionDate)) { toast('🚫 السبت والأحد عطلة — لا يمكن تسجيل حضور أو مشاركات. غيّر التاريخ إلى يوم دراسي.', '⚠️'); return; }
      return orig.apply(this, args);
    };
    w._wkWrapped = true;
    window[name] = w;
  };
  const list = ['toggleAttendance', 'markAllPresent', 'markAllAbsent', 'addParticipation', 'subtractPoint', 'saveSession', 'importAbsenceFromAttendance'];
  list.forEach(block);
  document.addEventListener('DOMContentLoaded', () => { block('sxAtt'); list.forEach(block); });
})();
window.addEventListener('beforeunload', e => {
  if (isSessionDirty()) { e.preventDefault(); e.returnValue = ''; }
});

/* =====================================================================
   2) التراجع (آخر 20 عملية)
   ===================================================================== */
const UNDO = [];
function undoFindStudent(id) {
  for (const c of state.classes) { const s = c.students.find(x => x.id === id); if (s) return { c, s }; }
  return null;
}
function undoRefreshButton() {
  const b = document.getElementById('undoBtn');
  if (!b) return;
  const last = UNDO[UNDO.length - 1];
  b.style.display = last ? 'flex' : 'none';
  if (last) b.title = 'تراجع عن: ' + last.desc + ' (Ctrl+Z)';
}
function undoClear() { UNDO.length = 0; undoRefreshButton(); }
function undoLast() {
  const u = UNDO.pop();
  if (!u) return toast('لا يوجد ما يمكن التراجع عنه', '⚠️');
  u.snap.forEach(sn => {
    const f = undoFindStudent(sn.id);
    if (!f) return;
    Object.keys(f.s).forEach(k => delete f.s[k]);
    Object.assign(f.s, JSON.parse(sn.json));
    recomputeWithAssessments(f.c, f.s);
  });
  save();
  renderStudentList();
  try { updateLeaderboard(); } catch (e) {}
  try { if (reportActiveStudent) showStudentReport(); } catch (e) {}
  undoRefreshButton();
  toast('↩️ تم التراجع عن: ' + u.desc, '↩️');
}
// تغليف عملية لتسجيل لقطة قبلها: getIds تُرجع الطلاب المتأثرين، desc تصف العملية
function undoWrap(name, getIds, desc) {
  const orig = window[name];
  if (typeof orig !== 'function') return;
  window[name] = function (...args) {
    let ids = [];
    try { ids = getIds(...args) || []; } catch (e) {}
    const before = ids.map(id => { const f = undoFindStudent(id); return f ? { id, json: JSON.stringify(f.s) } : null; }).filter(Boolean);
    const label = (() => { try { return desc(...args); } catch (e) { return name; } })();
    const r = orig.apply(this, args);
    const changed = before.some(b => { const f = undoFindStudent(b.id); return f && JSON.stringify(f.s) !== b.json; });
    if (changed) { UNDO.push({ desc: label, snap: before }); if (UNDO.length > 20) UNDO.shift(); undoRefreshButton(); }
    return r;
  };
}
const _undoName = id => (undoFindStudent(id) || { s: { name: '' } }).s.name;
const _undoClsIds = () => (sessionClass() || { students: [] }).students.map(s => s.id);
undoWrap('addParticipation', (c, id) => [id], (c, id) => 'مشاركة +1 لـ ' + _undoName(id));
undoWrap('subtractPoint', (c, id) => [id], (c, id) => 'خصم نقطة من ' + _undoName(id));
undoWrap('confirmBonus', (c, id) => [id], (c, id) => 'نقاط مكافأة لـ ' + _undoName(id));
undoWrap('saveNoteUnified', id => [id], id => 'ملاحظة سلوكية لـ ' + _undoName(id));
undoWrap('toggleAttendance', (c, id) => [id], (c, id) => 'تغيير حضور ' + _undoName(id));
undoWrap('markAllPresent', _undoClsIds, () => 'حضور الكل');
undoWrap('markAllAbsent', _undoClsIds, () => 'غياب الكل');
// بعد حفظ الحصة أو تغيير التاريخ لا يصح التراجع عن عمليات سابقة (تمت معالجتها)
(function () {
  const o = window.saveSession;
  window.saveSession = function (...a) { const wasDirty = isSessionDirty(); const r = o.apply(this, a); if (wasDirty && !isSessionDirty()) undoClear(); return r; };
})();
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
    e.preventDefault(); undoLast();
  }
});

/* =====================================================================
   3) 🎲 اختيار طالب عشوائي (يفضّل من لم يُختر ومن شارك أقل اليوم)
   ===================================================================== */
const RND_PICKED = {};   // "classId|date" → {studentId: مرات}
function openRandomPicker() {
  const cls = sessionClass();
  if (!cls || !cls.students.length) return toast('اختر صفاً فيه طلاب', '⚠️');
  openModal(`
    <div class="modal-title">🎲 اختيار طالب عشوائي — ${cls.name}</div>
    <div id="rnd-name" style="font-size:30px;font-weight:900;text-align:center;padding:26px 10px;min-height:96px;color:var(--accent)">…</div>
    <div id="rnd-info" style="text-align:center;font-size:12px;color:var(--text-muted);margin-bottom:10px"></div>
    <div class="modal-actions" style="flex-wrap:wrap">
      <button class="btn btn-success" id="rnd-part" style="flex:1" onclick="rndParticipate()" disabled>✋ +1 مشاركة</button>
      <button class="btn btn-primary" onclick="rndSpin()">🎲 مرة أخرى</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button>
    </div>`);
  rndSpin();
}
let _rndPick = null;
function rndSpin() {
  const cls = sessionClass();
  const key = cls.id + '|' + sessionDate;
  const picked = RND_PICKED[key] = RND_PICKED[key] || {};
  const pool = cls.students.filter(s => s._todayAtt !== 'absent');
  if (!pool.length) return toast('لا يوجد طلاب حاضرون', '⚠️');
  const w = pool.map(s => 1 / (1 + (picked[s.id] || 0) * 4 + ((s._dailyPart || {})[sessionDate] || 0) * 2));
  const tot = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * tot, choice = pool[0];
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { choice = pool[i]; break; } }
  const el = document.getElementById('rnd-name'), btn = document.getElementById('rnd-part');
  if (btn) btn.disabled = true;
  let n = 0;
  const t = setInterval(() => {
    if (!document.getElementById('rnd-name')) return clearInterval(t);
    el.textContent = pool[Math.floor(Math.random() * pool.length)].name;
    if (++n >= 14) {
      clearInterval(t);
      el.textContent = '🌟 ' + choice.name;
      picked[choice.id] = (picked[choice.id] || 0) + 1;
      _rndPick = choice.id;
      const done = Object.keys(picked).length;
      document.getElementById('rnd-info').textContent = `اختير اليوم ${done} من ${pool.length} طالب حاضر` + (picked[choice.id] > 1 ? ' — (اختير سابقاً)' : '');
      if (btn) btn.disabled = false;
    }
  }, 70);
}
function rndParticipate() {
  if (!_rndPick) return;
  addParticipation(state.activeClass, _rndPick);
  document.getElementById('rnd-part').disabled = true;
}

/* =====================================================================
   4) حصصي اليوم + الاختيار التلقائي حسب توقيت الحصص
   ===================================================================== */
function bellForDate(date) {
  const b = state.rosterMeta && state.rosterMeta.bell;
  if (!b) return null;
  const wd = new Date(date + 'T12:00:00').getDay();
  const list = wd === 5 ? (b.fri && b.fri.length ? b.fri : null) : b.normal;
  return list && list.length ? list : null;
}
// حصصي في يوم ما: من جدول المعلم في الملف المركزي، وإلا ما تعلّمه البرنامج من آخر يوم مماثل
/* جدول حصصي ليوم معيّن — الأولوية: ما حُفظ لهذا اليوم ← الأسبوع السابق (نفس اليوم) ← جدول الملف المركزي.
   إذا وُجد أي تسجيل للأسبوع السابق في هذا اليوم يُعتمد كاملاً (حتى لا تعود حصص قديمة من الجدول بعد تغييره). */
function myScheduleFor(date) {
  const wd = new Date(date + 'T12:00:00').getDay();
  const tt = state.rosterMeta && state.rosterMeta.timetable;
  const learned = [];
  state.classes.forEach(c => {
    const sp = c._savedPeriods || {};
    if (sp[date] && sp[date].length) { sp[date].forEach(p => learned.push({ p, cls: c, src: 'saved' })); return; }
    const prev = Object.keys(sp).filter(d => d < date && sp[d] && sp[d].length && new Date(d + 'T12:00:00').getDay() === wd).sort().pop();
    if (prev) sp[prev].forEach(p => learned.push({ p, cls: c, src: 'learned' }));
  });
  let out = learned;
  if (!learned.length && tt && tt[wd]) {
    out = [];
    Object.entries(tt[wd]).forEach(([p, name]) => { const c = state.classes.find(x => x.name === name); if (c) out.push({ p: +p, cls: c, src: 'tt' }); });
  }
  const seen = new Set();
  return out.filter(x => { const k = x.p + '|' + x.cls.id; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.p - b.p);
}
function nowHM() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function currentPeriod(date) {
  const bell = bellForDate(date);
  if (!bell || date !== _today()) return null;
  const t = nowHM();
  const cur = bell.find(x => t >= x.start && t < x.end);
  if (cur) return cur.p;
  const next = bell.find(x => t < x.start && x.start <= addMinutes(t, 10));   // قبل بداية الحصة بعشر دقائق
  return next ? next.p : null;
}
function addMinutes(hm, m) { const [h, mi] = hm.split(':').map(Number); const x = h * 60 + mi + m; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); }

/* شريط حصص اليوم — من جدول المعلم في «بيانات المدرسة» فقط (لا توقيت ولا تخمين):
   أخضر = أُدخلت، أحمر = لم تُدخل. الضغط على حصة يفتح شعبتها ويحدد رقمها. */
function ttScheduleFor(date) {
  const wd = new Date(date + 'T12:00:00').getDay();
  const tt = state.rosterMeta && state.rosterMeta.timetable;
  const out = [];
  if (tt && tt[wd]) Object.entries(tt[wd]).forEach(([p, name]) => { const c = state.classes.find(x => x.name === name); if (c) out.push({ p: +p, cls: c, extra: false }); });
  // حصص محفوظة لهذا اليوم وليست في الجدول (مثل الاحتياط) تظهر أيضاً
  state.classes.forEach(c => (((c._savedPeriods || {})[date]) || []).forEach(p => { if (!out.some(x => x.p === +p && x.cls.id === c.id)) out.push({ p: +p, cls: c, extra: true }); }));
  return out.sort((a, b) => a.p - b.p);
}
const QUICK_BTN = `<button class="btn btn-primary btn-sm" style="padding:4px 12px;font-weight:900" onclick="quickEnterNow()" title="يفتح الشعبة والحصة الموافقة للوقت الحالي حسب «توقيت الحصص» وجدولك في بيانات المدرسة">⚡ حصتي الآن</button>`;
function renderTodayBar() {
  const box = document.getElementById('today-bar');
  if (!box) return;
  _renderTodayBar(box);
  box.insertAdjacentHTML('afterbegin', QUICK_BTN + ' ');
}
function _renderTodayBar(box) {
  const hol = typeof holidayOn === 'function' ? holidayOn(sessionDate) : null;
  if (hol) { box.innerHTML = `<span style="font-size:12.5px;font-weight:800;color:var(--accent)">🏖️ ${hol.name || 'إجازة'} — ${hol.from}${hol.to && hol.to !== hol.from ? ' إلى ' + hol.to : ''} (ليس يوم دوام)</span>`; return; }
  const wd = new Date(sessionDate + 'T12:00:00').getDay();
  if (wd === 0 || wd === 6) { box.innerHTML = `<span style="font-size:12px;color:var(--text-muted)">📅 عطلة نهاية الأسبوع</span>`; return; }
  const sched = ttScheduleFor(sessionDate);
  if (!sched.length) { box.innerHTML = `<span style="font-size:12px;color:var(--text-muted)">📅 لا توجد لك حصص في جدول «بيانات المدرسة» لهذا اليوم.</span>`; return; }
  const isDone = x => (((x.cls._savedPeriods || {})[sessionDate]) || []).map(Number).includes(x.p);
  const done = sched.filter(isDone).length, total = sched.filter(x => !x.extra).length;
  box.innerHTML = `<span style="font-size:12px;font-weight:800;color:var(--text-muted)">📅 حصص اليوم (${sched.filter(x => !x.extra && isDone(x)).length}/${total}):</span>` +
    sched.map(x => {
      const ok = isDone(x);
      const on = x.cls.id === state.activeClass && selPeriods.has(x.p);
      const col = ok ? 'var(--present,#2ecc71)' : 'var(--absent,#e74c3c)';
      return `<button class="flt-btn" onclick="goToMyPeriod(${x.cls.id},${x.p})" title="${ok ? 'تم إدخالها' : 'لم تُدخل بعد'}${x.extra ? ' (خارج الجدول)' : ''}"
        style="padding:4px 10px;font-weight:800;border:2px solid ${col};background:${ok ? 'rgba(46,204,113,.18)' : 'rgba(231,76,60,.16)'};color:${col};${on ? 'box-shadow:0 0 0 2px var(--accent);' : ''}">
        ${ok ? '✓' : '✗'} ${x.cls.name} | الحصة ${x.p}${x.extra ? ' *' : ''}</button>`;
    }).join('');
}
// ⚡ حصتي الآن: الدخول السريع لشعبة الحصة الجارية (أو التي تبدأ خلال 10 دقائق) حسب اليوم والساعة
function quickEnterNow() {
  const today = _today(), wd = new Date(today + 'T12:00:00').getDay();
  if (wd === 0 || wd === 6) return toast('اليوم عطلة نهاية الأسبوع', '📅');
  const hol = typeof holidayOn === 'function' ? holidayOn(today) : null;
  if (hol) return toast('اليوم إجازة: ' + (hol.name || ''), '🏖️');
  const bell = bellForDate(today);
  if (!bell) return toast('لا يوجد «توقيت الحصص» في بيانات المدرسة — لا يمكن معرفة الحصة الحالية', '⚠️');
  const p = currentPeriod(today);
  if (!p) {
    const t = nowHM(), next = bell.find(x => x.start > t);
    return toast(next ? `لا توجد حصة الآن — الحصة ${next.p} تبدأ ${next.start}` : 'انتهت حصص اليوم', '⏰');
  }
  const hit = ttScheduleFor(today).find(x => x.p === p && !x.extra);
  if (!hit) return toast(`الحصة ${p} الآن — ليس لديك حصة فيها حسب جدولك`, '☕');
  const go = () => {
    if (sessionDate !== today) resetSessionToToday();
    goToMyPeriod(hit.cls.id, p);
    if (typeof onAttendancePage === 'function' && !onAttendancePage()) showPage('attendance', document.querySelector('.tab-btn[onclick*="\'attendance\'"]'));
    toast(`⚡ ${hit.cls.name} | الحصة ${p}`, '📋');
  };
  if (sessionDate !== today && typeof isSessionDirty === 'function' && isSessionDirty()) {
    if (!confirm('لديك تغييرات غير محفوظة في الحصة الحالية. الانتقال دون حفظ؟')) return;
  }
  go();
}
function goToMyPeriod(classId, p) {   // ضغطة المعلم على حصة من الشريط = اختيار يدوي لشعبتها ورقمها
  const apply = () => {
    if (state.activeClass !== classId) { _guardBusy = true; try { setActiveClass(classId); } finally { _guardBusy = false; } }
    selPeriodsCtx = classId + '|' + sessionDate;
    selPeriods = new Set([p]);
    renderPeriodChips(); renderTodayBar();
  };
  if (state.activeClass !== classId) guardUnsaved(apply); else apply();
}
// عند فتح البرنامج وعند تغيّر الحصة: انتقل تلقائياً لصف الحصة الحالية (إذا لم توجد تغييرات غير محفوظة)
let _autoLastPeriod = null;
function autoSelectCurrentPeriod() {
  return;   // أُلغي الاختيار التلقائي للحصة والصف — الاختيار يدوي
  if (!onAttendancePage() || sessionDate !== _today()) return;
  const p = currentPeriod(sessionDate);
  if (!p || p === _autoLastPeriod) return;
  const hit = myScheduleFor(sessionDate).find(x => x.p === p);
  if (!hit) return;
  if (state.activeClass !== hit.cls.id && isSessionDirty()) return;   // لا نقاطع عملاً غير محفوظ
  _autoLastPeriod = p;
  goToMyPeriod(hit.cls.id, p);
  toast(`⏰ الحصة ${p} — ${hit.cls.name}`, '📅');
}
setInterval(() => { renderTodayBar(); autoSelectCurrentPeriod(); }, 60000);
