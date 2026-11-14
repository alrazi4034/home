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
    <div class="modal-actions" style="flex-wrap:wrap">
      <button class="btn btn-primary" style="flex:1" onclick="guardSaveAndGo()">💾 حفظ ثم متابعة</button>
      <button class="btn btn-ghost" onclick="guardGoWithoutSave()">متابعة بدون حفظ</button>
      <button class="btn btn-ghost" onclick="window._guardProceed=null;closeModalForce()">إلغاء</button>
    </div>`);
}
function guardSaveAndGo() {
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

function renderTodayBar() {
  const box = document.getElementById('today-bar');
  if (!box) return;
  const sched = myScheduleFor(sessionDate);
  const bell = bellForDate(sessionDate);
  const cur = currentPeriod(sessionDate);
  if (!sched.length) {
    box.innerHTML = `<span style="font-size:12px;color:var(--text-muted)">📅 حصصي اليوم: سيتعرّف البرنامج على حصصك تلقائياً بعد أسبوع من حفظ الحصص مع أرقامها.</span>`;
    return;
  }
  const done = sched.filter(x => ((x.cls._savedPeriods || {})[sessionDate] || []).includes(x.p)).length;
  const doneTxt = done === 0 ? 'لم تُدخل أي حصة اليوم' : done === 1 ? 'تم إدخال حصة واحدة اليوم' : done === 2 ? 'تم إدخال حصتين اليوم'
    : done <= 10 ? `تم إدخال ${done} حصص اليوم` : `تم إدخال ${done} حصة اليوم`;
  box.innerHTML = `<span style="font-size:12px;font-weight:800;color:var(--text-muted)">📅 ${doneTxt}:</span>` +
    sched.map(x => {
      const ok = ((x.cls._savedPeriods || {})[sessionDate] || []).includes(x.p);
      const time = bell ? (bell.find(b => b.p === x.p) || {}).start || '' : '';
      const isCur = cur === x.p;
      return `<button class="flt-btn ${x.cls.id === state.activeClass && selPeriods.has(x.p) ? 'flt-btn-on' : ''}" style="padding:4px 9px;${isCur ? 'box-shadow:0 0 0 2px var(--accent);' : ''}" onclick="goToMyPeriod(${x.cls.id},${x.p})" title="${time ? 'تبدأ ' + time : ''}">
        ${ok ? '✅' : isCur ? '⏳' : '▫️'} ح${x.p} · ${x.cls.name}${time ? ` <span style="opacity:.6;font-size:10px">${time}</span>` : ''}</button>`;
    }).join('') + (sched[0].src === 'learned' ? `<span style="font-size:10.5px;color:var(--text-muted)">(متوقعة من الأسبوع الماضي)</span>` : '');
}
function goToMyPeriod(classId, p) {
  const apply = () => {
    if (state.activeClass !== classId) { _guardBusy = true; try { setActiveClass(classId); } finally { _guardBusy = false; } }
    selPeriodsCtx = classId + '|' + sessionDate;
    const saved = ((sessionClass()._savedPeriods || {})[sessionDate]) || [];
    selPeriods = new Set(saved.length ? saved : [p]);
    if (!selPeriods.has(p)) selPeriods.add(p);
    renderPeriodChips(); renderTodayBar();
  };
  if (state.activeClass !== classId) guardUnsaved(apply); else apply();
}
// عند فتح البرنامج وعند تغيّر الحصة: انتقل تلقائياً لصف الحصة الحالية (إذا لم توجد تغييرات غير محفوظة)
let _autoLastPeriod = null;
function autoSelectCurrentPeriod() {
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
