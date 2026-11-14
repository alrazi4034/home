/* 09-import-export.js — التصدير، تطبيع أرقام الهواتف، الاستيراد من بيانات المدرسة، استيراد الطلاب والأسماء والهواتف، تعديل الملاحظة، استدعاء QR */

// ===== EXPORT =====
function showImportExportMenu() {
  openModal(`
    <div class="modal-title">📂 استيراد وتصدير بيانات الطلاب</div>
    <div class="modal-actions" style="flex-direction:column;gap:10px">
      <button class="btn btn-import" style="width:100%;justify-content:flex-start;gap:10px" onclick="closeModalForce();openImportFromSchoolDataModal()">
        🏫 استيراد من بيانات المدرسة<br><span style="font-size:11px;font-weight:400;opacity:.8">من الملف المرتبط بالصفحة الرئيسية — مع تحديد الصفوف</span>
      </button>
      <button class="btn btn-import" style="width:100%;justify-content:flex-start;gap:10px" onclick="closeModalForce();document.getElementById('importStudentsFile').setAttribute('accept','.csv');document.getElementById('importStudentsFile').click()">
        📥 استيراد من ملف إكسل<br><span style="font-size:11px;font-weight:400;opacity:.8">الصف، الاسم، الهاتف، الحسابات (CSV)</span>
      </button>
      <button class="btn btn-import" style="width:100%;justify-content:flex-start;gap:10px" onclick="closeModalForce();document.getElementById('importAccountsJSONFile').click()">
        🧾 استيراد من JSON<br><span style="font-size:11px;font-weight:400;opacity:.8">حسابات وزاري/ألف بصيغة JSON</span>
      </button>
      <button class="btn btn-success" style="width:100%;justify-content:flex-start;gap:10px" onclick="doExportStudentData();closeModalForce()">
        📤 تصدير ملف إكسل<br><span style="font-size:11px;font-weight:400;opacity:.8">بيانات الطلاب الأساسية (CSV)</span>
      </button>
      <button class="btn btn-success" style="width:100%;justify-content:flex-start;gap:10px" onclick="exportAccountsJSON();closeModalForce()">
        🧾 تصدير ملف JSON<br><span style="font-size:11px;font-weight:400;opacity:.8">حسابات وزاري/ألف</span>
      </button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
    </div>`);
}

/* ===== تطبيع أرقام الهواتف الإماراتية إلى صيغة 9715xxxxxxxx ===== */
function normalizePhoneUAE(raw){
  let d = String(raw||'').replace(/[^0-9]/g,'');
  if(!d) return '';
  if(d.startsWith('00971')) d = d.slice(2);
  else if(d.startsWith('971')){ /* بالصيغة الصحيحة أصلاً */ }
  else if(d.startsWith('05')) d = '971' + d.slice(1);
  else if(/^5\d{8}$/.test(d)) d = '971' + d;
  else if(d.startsWith('0') && d.length === 10) d = '971' + d.slice(1);
  return d;
}
/* يفصل "الاسم (الرقم)" إلى اسم نظيف ورقم — نفس الصيغة المستخدمة في عمود "اسم الطالب" ببيانات
   المدرسة المرتبطة وعمود "اسم ورقم" في ملف الحضور. لو ما فيه رقم بين قوسين، يرجع id فارغ. */
function parseStudentEntry(str){
  const s = String(str||'').trim();
  const m = s.match(/^(.*?)\s*\(([^()]+)\)$/);
  if(m) return { name: m[1].trim(), id: m[2].trim() };
  return { name: s, id: '' };
}

/* ===== استيراد من بيانات المدرسة (الملف المرتبط بالصفحة الرئيسية) ===== */
function openImportFromSchoolDataModal() {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  let dataUrl = null, fname = '';
  try {
    dataUrl = localStorage.getItem('raziSchoolDataXlsx');
    fname = localStorage.getItem('raziSchoolDataFilename') || '';
  } catch(e) {}
  if (!dataUrl) {
    alert('لم تُربط بيانات المدرسة بعد.\nافتح الصفحة الرئيسية لبوابة الرازي واضغط "🔗 ربط ملف بيانات المدرسة" أولاً، ثم ارجع لهذه الصفحة.');
    return;
  }
  try {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i=0; i<binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const wb = XLSX.read(bytes.buffer, {type:'array', cellDates:true});
    const ws = wb.Sheets['جميع الطلاب'];
    if (!ws) { alert('لم يتم العثور على صفحة "جميع الطلاب" في الملف المرتبط.'); return; }
    const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
    const headerKeys = rows.length ? Object.keys(rows[0]) : [];
    const findHeader = (kw, wantPass) => headerKeys.find(h => {
      const H = h.toUpperCase();
      return H.includes(kw) && (wantPass ? H.includes('PASS') : !H.includes('PASS'));
    });
    const lmsEmailH = findHeader('LMS', false), lmsPassH = findHeader('LMS', true);
    const alefEmailH = findHeader('ALEF', false), alefPassH = findHeader('ALEF', true);

    const byClass = {};
    rows.forEach(r => {
      const code = String(r['الصف']||'').trim();
      const { name, id: sid } = parseStudentEntry(String(r['اسم الطالب']||'').trim());
      const phoneRaw = r['رقم التواصل'];
      const phone = phoneRaw !== '' ? normalizePhoneUAE(phoneRaw) : '';
      const approvedRaw = String(r['معتمد']==null ? '' : r['معتمد']).trim();
      const approved = approvedRaw === '1' || approvedRaw.toLowerCase() === 'true' || approvedRaw === 'معتمد';
      const govAccount = (lmsEmailH && (r[lmsEmailH] || (lmsPassH && r[lmsPassH]))) ? { user: String(r[lmsEmailH]||'').trim(), pass: String(lmsPassH ? r[lmsPassH]||'' : '').trim() } : null;
      const alifAccount = (alefEmailH && (r[alefEmailH] || (alefPassH && r[alefPassH]))) ? { user: String(r[alefEmailH]||'').trim(), pass: String(alefPassH ? r[alefPassH]||'' : '').trim() } : null;
      if (!code || !name) return;
      const display = code.length >= 2 ? (code[0] + '/' + code.slice(1)) : code;
      if (!byClass[display]) byClass[display] = [];
      byClass[display].push({ name, sid, phone, approved, govAccount, alifAccount });
    });

    const classCodes = Object.keys(byClass).sort();
    if (!classCodes.length) { alert('لم يتم العثور على طلاب في الملف المرتبط.'); return; }
    window._schoolDataByClass = byClass;
    window._schoolDataInfo = readSchoolInfoFromWorkbook(wb);

    const existingNames = new Set(state.classes.flatMap(c => c.students.map(s => s.name)));
    const existingSids = new Set(state.classes.flatMap(c => c.students.map(s => s.sid)).filter(Boolean));
    const rowsHtml = classCodes.map(code => {
      const list = byClass[code];
      const newCount = list.filter(s => !(s.sid && existingSids.has(s.sid)) && !existingNames.has(s.name)).length;
      return `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--surface2);border:1px solid var(--border-color);border-radius:8px;padding:8px 12px;font-size:13px;margin-bottom:6px">
        <input type="checkbox" class="school-data-class-chk" value="${code}" checked style="cursor:pointer">
        <span style="flex:1">🏫 ${code}</span>
        <span style="font-size:11px;color:var(--text-muted)">${list.length} طالب${newCount < list.length ? ' — ' + newCount + ' جديد' : ''}</span>
      </label>`;
    }).join('');

    const info = window._schoolDataInfo;
    const infoLine = info.schoolName
      ? `المدرسة: <b>${info.schoolName}</b>${info.principal ? ' — المديرة: <b>'+info.principal+'</b>' : ''}${info.termStart ? ' — الفصل الدراسي: <b>'+info.termStart+' → '+info.termEnd+'</b>' : ''}<br>`
      : '';

    openModal(`
      <div class="modal-title">🏫 استيراد من بيانات المدرسة</div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:10px;line-height:1.8">
        الملف المرتبط: ${fname || '—'}<br>
        ${infoLine}
        حدد الصفوف التي تريد استيرادها. الطلاب الموجودون مسبقاً بالاسم (بأي صف) لن يُكرَّروا — فقط تُكمَّل حساباتهم الناقصة (LMS/ALEF) ورقم التواصل إن وُجدت في ملف المدرسة ولم تكن مُدخلة هنا مسبقاً.
        حسابات LMS وALEF ورقم التواصل تُستورد تلقائياً مع كل طالب جديد من ملف بيانات المدرسة.
        أرقام التواصل التي عليها علامة <b>معتمد</b> في ملف المدرسة تُستورد كمعتمدة، والباقي غير معتمد حتى يُؤكَّد يدوياً.
      </div>
      <div style="max-height:320px;overflow-y:auto;margin-bottom:10px">${rowsHtml}</div>
      <div class="modal-actions">
        <button class="btn btn-primary" style="flex:1" onclick="confirmImportFromSchoolData()">📥 استيراد المحدد</button>
        <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
      </div>`);
  } catch(err) {
    alert('تعذّر قراءة الملف المرتبط: ' + err.message);
  }
}

/* يقرأ اسم المدرسة، اسم المديرة، والفصل الدراسي الحالي (بداية/نهاية) من صفحة "التقويم المدرسي" */
function readSchoolInfoFromWorkbook(wb) {
  const out = { schoolName:'', principal:'', academicYear:'', termStart:'', termEnd:'' };
  const wsCal = wb.Sheets['التقويم المدرسي'];
  if (!wsCal) return out;
  const grid = XLSX.utils.sheet_to_json(wsCal, {header:1, defval:''});
  let infoHeaderRow = -1, termHeaderRow = -1;
  grid.forEach((row,i) => {
    if (row.includes('اسم المدرسة')) infoHeaderRow = i;
    if (row.some(c => String(c).includes('الفصل الدراسي الأول'))) termHeaderRow = i;
  });
  if (infoHeaderRow >= 0) {
    const headers = grid[infoHeaderRow].filter(h => h);
    const vals = grid[infoHeaderRow+1] || [];
    const info = {};
    headers.forEach((h,idx) => info[h] = vals[idx] ?? '');
    out.schoolName   = String(info['اسم المدرسة'] || '').trim();
    out.principal    = String(info['اسم مديرة المدرسة'] || '').trim();
    out.academicYear = String(info['العام الدراسي'] || '').trim();
  }
  if (termHeaderRow >= 0) {
    const termHeaders = grid[termHeaderRow];
    const rawRows = [];
    for (let i = termHeaderRow+1; i < grid.length; i++) {
      const row = grid[i];
      if (!row || row.every(c => c === '' || c === undefined)) continue;
      rawRows.push(row);
    }
    const toDate = v => {
      if (v instanceof Date) return v;
      if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400 * 1000));
      const d = new Date(v);
      return isNaN(d) ? null : d;
    };
    const segments = [0,1,2].map(ti => {
      const wCol = ti*2, dCol = ti*2+1;
      const weeks = rawRows
        .map(row => toDate(row[dCol]))
        .filter(Boolean)
        .sort((a,b) => a - b);
      return weeks.length ? { start: weeks[0], end: weeks[weeks.length-1] } : null;
    }).filter(Boolean);
    if (segments.length) {
      const today = new Date(); today.setHours(0,0,0,0);
      // الفصل الحالي = آخر فصل بدأ قبل اليوم أو يساويه، وإلا أول فصل
      let current = segments.filter(s => s.start <= today).pop() || segments[0];
      const fmt = d => d.toISOString().slice(0,10);
      out.termStart = fmt(current.start);
      out.termEnd   = fmt(current.end);
    }
  }
  return out;
}

function confirmImportFromSchoolData() {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const byClass = window._schoolDataByClass || {};
  const checked = Array.from(document.querySelectorAll('.school-data-class-chk:checked')).map(c => c.value);
  if (!checked.length) { toast('حدد صفاً واحداً على الأقل', '⚠️'); return; }

  let addedStudents = 0, addedClasses = 0, updatedAccounts = 0;
  const existingNames = new Set(state.classes.flatMap(c => c.students.map(s => s.name)));
  const allStudentsByName = {}, allStudentsBySid = {};
  state.classes.forEach(c => c.students.forEach(s => { allStudentsByName[s.name] = s; if (s.sid) allStudentsBySid[s.sid] = s; }));

  checked.forEach((code, ci) => {
    let cls = state.classes.find(c => c.name === code);
    if (!cls) {
      cls = { id: Date.now() + ci, name: code, students: [], _savedDates: [] };
      state.classes.push(cls);
      addedClasses++;
    }
    const list = byClass[code] || [];
    list.forEach((s, i) => {
      if ((s.sid && allStudentsBySid[s.sid]) || existingNames.has(s.name)) {
        // طالب موجود مسبقاً: نكمّل فقط الحقول الفارغة (حساب LMS/ALEF أو رقم التواصل)
        // بدون الكتابة فوق أي بيانات أُدخلت يدوياً مسبقاً
        const existing = (s.sid && allStudentsBySid[s.sid]) || allStudentsByName[s.name];
        if (!existing) return;
        let changed = false;
        if (s.sid && !existing.sid) { existing.sid = s.sid; changed = true; }
        if (s.govAccount && !(existing.govAccount?.user || existing.govAccount?.pass)) {
          existing.govAccount = { user: s.govAccount.user || '', pass: s.govAccount.pass || '' };
          changed = true;
        }
        if (s.alifAccount && !(existing.alifAccount?.user || existing.alifAccount?.pass)) {
          existing.alifAccount = { user: s.alifAccount.user || '', pass: s.alifAccount.pass || '' };
          changed = true;
        }
        if (s.phone && !existing.parentPhone) {
          existing.parentPhone = s.phone;
          existing.phoneVerified = !!s.approved;
          changed = true;
        }
        if (changed) updatedAccounts++;
        return;
      }
      cls.students.push({
        id: Date.now() + ci * 1000 + i, name: s.name, sid: s.sid || '',
        points:0, present:0, absent:0, participation:0, absenceDates:[],
        _todayAtt:'unmarked', _prevAtt:{}, parentPhone: s.phone || '',
        phoneVerified: !!(s.phone && s.approved), behaviorNotes:[], _manualBonus:0,
        govAccount: s.govAccount || null, alifAccount: s.alifAccount || null
      });
      existingNames.add(s.name);
      if (s.sid) allStudentsBySid[s.sid] = cls.students[cls.students.length - 1];
      addedStudents++;
    });
    cls.students = sortStudentsAlpha(cls.students);
  });

  // سحب بيانات المدرسة والمديرة والفصل الدراسي (بدون الكتابة فوق حقول أُدخلت يدوياً)
  const info = window._schoolDataInfo;
  if (info) {
    if (!state.schoolInfo) state.schoolInfo = {};
    if (info.schoolName && !state.schoolInfo.schoolName) state.schoolInfo.schoolName = info.schoolName;
    if (info.principal  && !state.schoolInfo.principal)  state.schoolInfo.principal  = info.principal;
    if (info.academicYear && !state.schoolInfo.term)     state.schoolInfo.term      = info.academicYear;
    if (info.termStart  && !state.schoolInfo.termStart)  state.schoolInfo.termStart = info.termStart;
    if (info.termEnd    && !state.schoolInfo.termEnd)    state.schoolInfo.termEnd   = info.termEnd;
    const schoolTitleEl = document.getElementById('school-title');
    if (schoolTitleEl) schoolTitleEl.textContent = state.schoolInfo.schoolName ? ' | المدرسة: ' + state.schoolInfo.schoolName : '';
    renderSchoolInfoBar(state.schoolInfo.subject, state.schoolInfo.teacher, state.schoolInfo.schoolName);
  }

  save(); closeModalForce();
  renderClassTabs(); renderStudentList(); renderClasses(); updateLeaderboard(); updateReportSelects();
  toast(`تم استيراد ${addedStudents} طالب${addedClasses ? ' في ' + addedClasses + ' صف جديد' : ''}${updatedAccounts ? ' — وتحديث حسابات ' + updatedAccounts + ' طالب موجود مسبقاً' : ''}`, '🏫');
}

function exportToExcel() {
  openModal(`
    <div class="modal-title">📤 تصدير البيانات</div>
    <div class="modal-actions" style="flex-direction:column;gap:10px">
      <button class="btn btn-primary" style="width:100%;justify-content:flex-start;gap:10px" onclick="doExportJSON();closeModalForce()">
        💾 نسخة احتياطية كاملة (JSON)<br><span style="font-size:11px;font-weight:400;opacity:.8">للاستيراد لاحقاً</span>
      </button>
      <button class="btn btn-success" style="width:100%;justify-content:flex-start;gap:10px" onclick="doExportCSV();closeModalForce()">
        📊 جدول النقاط (CSV / Excel)<br><span style="font-size:11px;font-weight:400;opacity:.8">لعرضها في Excel أو الطباعة</span>
      </button>
      <button class="btn btn-ghost" style="width:100%;justify-content:flex-start;gap:10px" onclick="doExportAbsenceReport();closeModalForce()">
        📋 سجل الغياب اليومي (CSV)<br><span style="font-size:11px;font-weight:400;opacity:.8">مرتب حسب التاريخ</span>
      </button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
    </div>`);
}

function buildBackupData() {
  const info = getSchoolInfo();
  return {
    version: 7, exportDate: new Date().toISOString(),
    schoolInfo: state.schoolInfo || {},
    schoolName: info.schoolName,
    principal:  info.principal,
    teacher:    info.teacher,
    subject:    info.subject,
    term:       info.term,
    termStart:  info.termStart,
    termEnd:    info.termEnd,
    assessments: state.assessments || [],
    classes: state.classes.map(cls => ({
      id: cls.id, name: cls.name, _savedDates: cls._savedDates||[], _savedPeriods: cls._savedPeriods||{},
      students: cls.students.map(s => ({
        id: s.id, name: s.name, sid: s.sid || '', lateDates: s.lateDates || [],
        points: s.points||0, present: s.present||0, absent: s.absent||0,
        participation: s.participation||0, absenceDates: s.absenceDates||[],
        _prevAtt: s._prevAtt||{}, parentPhone: s.parentPhone||'',
        behaviorNotes: s.behaviorNotes||[],
        govAccount: s.govAccount||null,
        alifAccount: s.alifAccount||null,
        _manualBonus: s._manualBonus||0,
        phoneVerified: s.phoneVerified||false,
        pointsLog: s.pointsLog||[],
        _dailyPart:   s._dailyPart   || {},
        _dailyDeduct: s._dailyDeduct || {},
        deductReasons: s.deductReasons || []
      }))
    })),
    sessions: state.sessions||[],
    seating: state.seating||{},
    archivedStudents: state.archivedStudents||[],
    archivedClasses: state.archivedClasses||[],
    rosterMeta: state.rosterMeta||null,
    marsadReview: state.marsadReview||{}
  };
}

function doExportJSON() {
  try {
    const data = buildBackupData();
    downloadFile(JSON.stringify(data,null,2), `nojomi_backup_${todayStr()}.json`, 'application/json;charset=utf-8;');
    toast('تم التصدير ✅','💾');
  } catch(e) { alert('خطأ: '+e.message); }
}

function doExportCSV() {
  try {
    const allDates = new Set();
    state.classes.forEach(cls => {
      (cls._savedDates || []).forEach(d => allDates.add(d));
      cls.students.forEach(s => (s.absenceDates||[]).forEach(d => allDates.add(d)));
    });
    const sortedDates = [...allDates].sort();
    const assessments = state.assessments || [];

    let csv = "\uFEFF";
    const assessHeaders = assessments.map(a => `"${a.name}(/${a.maxScore})"`).join(',');
    const fixedHeaders = "الصف,أيام_الحصص,اسم الطالب,رقم التواصل,حالة_التواصل,مستخدم_وزاري,مرور_وزاري,مستخدم_ألف,مرور_ألف,النقاط,المكافآت_اليدوية";
    const middleHeaders = assessHeaders ? `,${assessHeaders}` : '';
    const tailHeaders = ",المشاركات,أيام الحضور,أيام الغياب,نسبة الحضور%,ملاحظات_إيجابية,ملاحظات_سلبية";
    const dateHeaders = sortedDates.length ? ',' + sortedDates.map(d=>`"غياب_${d}"`).join(',') : '';
    csv += fixedHeaders + middleHeaders + tailHeaders + dateHeaders + '\n';

    state.classes.forEach(cls => {
      const savedDatesStr = (cls._savedDates||[]).sort().join('|');
      cls.students.forEach(s => {
        const tot = (s.present||0)+(s.absent||0);
        const pct = tot>0?Math.round((s.present/tot)*100):0;
        const govUser = s.govAccount?.user || '';
        const govPass = s.govAccount?.pass || '';
        const alifUser = s.alifAccount?.user || '';
        const alifPass = s.alifAccount?.pass || '';
        const bonusPoints = s._manualBonus || 0;
        const posNotes = (s.behaviorNotes||[]).filter(n=>n.type==='positive').length;
        const negNotes = (s.behaviorNotes||[]).filter(n=>n.type!=='positive').length;
        const phoneStatus = !s.parentPhone ? '' : s.phoneVerified ? '1' : '0';
        let row = `"${cls.name}","${savedDatesStr}","${s.name}","'${s.parentPhone||''}","${phoneStatus}","${govUser}","${govPass}","${alifUser}","${alifPass}",${s.points||0},${bonusPoints}`;
        // درجات التقييمات
        assessments.forEach(a => {
          const score = a.classIds.includes(cls.id) ? (a.scores?.[s.id] !== undefined && a.scores?.[s.id] !== '' ? a.scores[s.id] : '') : 'N/A';
          row += `,${score}`;
        });
        row += `,${s.participation||0},${s.present||0},${s.absent||0},${pct}%,${posNotes},${negNotes}`;
        sortedDates.forEach(d => { row += ',' + ((s.absenceDates||[]).includes(d) ? '1' : '0'); });
        csv += row + '\n';
      });
    });

    downloadFile(csv, `nojomi_grades_${todayStr()}.csv`, 'text/csv;charset=utf-8;');
    toast('تم التصدير ✅','📊');
  } catch(e) { alert('خطأ: '+e.message); }
}

function doExportAbsenceReport() {
  try {
    const absenceMap = {};
    state.classes.forEach(cls => cls.students.forEach(s => (s.absenceDates||[]).forEach(d => {
      if (!absenceMap[d]) absenceMap[d]=[];
      absenceMap[d].push({cls:cls.name, name:s.name});
    })));
    const sorted = Object.keys(absenceMap).sort();
    if (!sorted.length) { alert('لا يوجد سجل غياب مسجّل بعد.'); return; }
    let csv = "\uFEFF";
    csv += "التاريخ,اليوم,الصف,اسم الطالب\n";
    sorted.forEach(d => {
      const dateObj = new Date(d+'T12:00:00');
      const dayName = dateObj.toLocaleDateString('ar-EG',{weekday:'long',numberingSystem:'latn'});
      const disp = dateObj.toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric',numberingSystem:'latn'});
      absenceMap[d].forEach(r => { csv += `"${disp}",${dayName},${r.cls},"${r.name}"\n`; });
    });
    downloadFile(csv, `Grade8_absence_${todayStr()}.csv`, 'text/csv;charset=utf-8;');
    toast('تم التصدير ✅','📋');
  } catch(e) { alert('خطأ: '+e.message); }
}

function doExportStudentData() {
  try {
    let csv = "\uFEFF";
    // نفس أول 7 أعمدة من doExportCSV بالضبط
    csv += "الصف,اسم الطالب,رقم التواصل,حالة_التواصل,مستخدم_وزاري,مرور_وزاري,مستخدم_ألف,مرور_ألف\n";
    state.classes.forEach(cls => cls.students.forEach(s => {
      const govUser  = s.govAccount?.user  || '';
      const govPass  = s.govAccount?.pass  || '';
      const alifUser = s.alifAccount?.user || '';
      const alifPass = s.alifAccount?.pass || '';
      const pStatus = !s.parentPhone ? '' : s.phoneVerified ? 'معتمد' : 'غير معتمد';
      csv += `${cls.name},"${s.name}","'${s.parentPhone||''}","${pStatus}","${govUser}","${govPass}","${alifUser}","${alifPass}"\n`;
    }));
    downloadFile(csv, `nojomi_students_${todayStr()}.csv`, 'text/csv;charset=utf-8;');
    toast('تم تصدير بيانات الطلاب ✅','📤');
  } catch(e) { alert('خطأ: '+e.message); }
}

// ===== IMPORT STUDENTS (unified: CSV or JSON) =====
// أعمدة CSV المتوقعة: الصف | اسم الطالب | رقم التواصل | بريد الطالب الوزاري | كلمة مرور البريد الوزاري | حساب منصة ألف | كلمة مرور منصة ألف
function importStudentsFile(event) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        importFromJSON(e.target.result);
      } else {
        importStudentsFromCSV(e.target.result);
      }
    } catch(err) { alert('خطأ في القراءة: ' + err.message); }
    event.target.value = '';
  };
  reader.readAsText(file, 'UTF-8');
}

function importStudentsFromCSV(text) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  text = text.replace(/^\uFEFF/, '');
  // دعم الفاصلة والتابولايشن
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length <= 1) { alert('الملف فارغ أو يحتوي على سطر عنوان فقط'); return; }

  // اكتشاف الفاصل
  const delim = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';

  // قراءة سطر الرأس لتحديد ترتيب الأعمدة ديناميكياً
  const headers = lines[0].split(delim).map(h => h.replace(/"/g,'').trim());

  // خريطة الأعمدة حسب المسميات المتفق عليها
  const colMap = {
    cls:      headers.findIndex(h => h.includes('الصف')),
    name:     headers.findIndex(h => h.includes('اسم الطالب') || h === 'الاسم'),
    phone:    headers.findIndex(h => h.includes('رقم التواصل') || h.includes('الهاتف') || h.includes('رقم')),
    verified: headers.findIndex(h => h.includes('حالة_التواصل') || h.includes('حالة التواصل')),
    govUser:  headers.findIndex(h => h.includes('بريد الطالب الوزاري') || h.includes('مستخدم_وزاري') || h.includes('وزاري') && h.includes('بريد')),
    govPass:  headers.findIndex(h => h.includes('كلمة مرور البريد الوزاري') || h.includes('مرور_وزاري')),
    alifUser: headers.findIndex(h => h.includes('حساب منصة ألف') || h.includes('مستخدم_ألف') || h.includes('ألف') && h.includes('حساب')),
    alifPass: headers.findIndex(h => h.includes('كلمة مرور منصة ألف') || h.includes('مرور_ألف')),
  };

  // fallback بترتيب الأعمدة إذا لم توجد رؤوس مطابقة
  // الترتيب الصحيح حسب doExportStudentData:
  // 0=الصف | 1=اسم الطالب | 2=رقم التواصل | 3=حالة_التواصل | 4=مستخدم_وزاري | 5=مرور_وزاري | 6=مستخدم_ألف | 7=مرور_ألف
  if (colMap.cls      === -1) colMap.cls      = 0;
  if (colMap.name     === -1) colMap.name     = 1;
  if (colMap.phone    === -1) colMap.phone    = 2;
  if (colMap.verified === -1) colMap.verified = 3;
  if (colMap.govUser  === -1) colMap.govUser  = 4;
  if (colMap.govPass  === -1) colMap.govPass  = 5;
  if (colMap.alifUser === -1) colMap.alifUser = 6;
  if (colMap.alifPass === -1) colMap.alifPass = 7;

  const getCell = (row, idx) => idx >= 0 && idx < row.length
    ? row[idx].replace(/"/g,'').replace(/^=?"?'?/,'').replace(/"?'?$/,'').trim()
    : '';

  let addedStudents = 0, updatedStudents = 0, newClasses = 0, movedStudents = 0;
  const touchedKeys = new Set();     // 'اسم الصف|اسم الطالب' لكل من ظهر في الملف الجديد
  const touchedClassNames = new Set();

  for (let i = 1; i < lines.length; i++) {
    const row = smartSplitCSV(lines[i], delim);
    const clsName  = getCell(row, colMap.cls);
    const stNameRaw = getCell(row, colMap.name);
    if (!clsName || !stNameRaw) continue;
    const stName = parseStudentEntry(stNameRaw).name || stNameRaw;
    touchedClassNames.add(clsName);
    touchedKeys.add(clsName + '|' + stName);

    const phone         = normalizePhoneUAE(getCell(row, colMap.phone));
    const verifiedStr   = getCell(row, colMap.verified);
    const isVerified    = verifiedStr === '1' || verifiedStr === 'معتمد';
    const govUser  = getCell(row, colMap.govUser);
    const govPass  = getCell(row, colMap.govPass);
    const alifUser = getCell(row, colMap.alifUser);
    const alifPass = getCell(row, colMap.alifPass);

    let cls = state.classes.find(c => c.name === clsName);
    if (!cls) {
      cls = { id: Date.now() + newClasses, name: clsName, _savedDates: [], students: [] };
      state.classes.push(cls);
      newClasses++;
    }

    let existing = cls.students.find(s => s.name === stName);
    if (!existing) {
      // ابحث عن الطالب باسمه في كل الصفوف الأخرى — لو موجود، انقله لهذا الصف مع الاحتفاظ
      // الكامل بنقاطه وملاحظاته وسجل حضوره (بدل إنشاء سجل جديد فارغ) — يحدث عادة عند نقل طالب بين الشعب
      for (const otherCls of state.classes) {
        if (otherCls === cls) continue;
        const idx = otherCls.students.findIndex(s => s.name === stName);
        if (idx !== -1) {
          existing = otherCls.students.splice(idx, 1)[0];
          cls.students.push(existing);
          movedStudents++;
          break;
        }
      }
    }
    if (!existing) {
      cls.students.push({
        id: Date.now() + addedStudents + newClasses + 9000,
        name: stName,
        points: 0, present: 0, absent: 0, participation: 0,
        absenceDates: [], _todayAtt: 'unmarked', _prevAtt: {},
        parentPhone: phone, phoneVerified: isVerified, behaviorNotes: [],
        govAccount:  { user: govUser,  pass: govPass  },
        alifAccount: { user: alifUser, pass: alifPass }
      });
      addedStudents++;
    } else {
      // تحديث البيانات الموجودة — أولوية الرقم المعتمد
      if (phone) {
        // إذا الرقم الجديد معتمد، أو الموجود غير معتمد/فارغ → استورد الجديد
        const existingVerified = existing.phoneVerified === true;
        if (isVerified || !existingVerified || !existing.parentPhone) {
          existing.parentPhone  = phone;
          existing.phoneVerified = isVerified;
        }
        // إذا الموجود معتمد والجديد غير معتمد → لا تغيير
      }
      if (govUser)  { if (!existing.govAccount)  existing.govAccount  = {}; existing.govAccount.user  = govUser; }
      if (govPass)  { if (!existing.govAccount)  existing.govAccount  = {}; existing.govAccount.pass  = govPass; }
      if (alifUser) { if (!existing.alifAccount) existing.alifAccount = {}; existing.alifAccount.user = alifUser; }
      if (alifPass) { if (!existing.alifAccount) existing.alifAccount = {}; existing.alifAccount.pass = alifPass; }
      updatedStudents++;
    }
  }

  if (!state.activeClass && state.classes.length > 0)
    state.activeClass = state.classes[0].id;

  // ترتيب أبجدي لكل الصفوف بعد الاستيراد
  state.classes.forEach(cls => { cls.students = sortStudentsAlpha(cls.students); });

  // طلاب موجودون في نجوم مدرستي ضمن صفوف ظهرت بالملف الجديد، لكن أسماءهم غير موجودة بالملف —
  // غالباً حُذفوا من بيانات المدرسة. لا نحذفهم تلقائياً (حفاظاً على نقاطهم وسجلاتهم)، فقط نُبلغ المستخدم.
  const missingCandidates = [];
  state.classes.forEach(cls => {
    if (!touchedClassNames.has(cls.name)) return;
    cls.students.forEach(s => {
      if (!touchedKeys.has(cls.name + '|' + s.name)) missingCandidates.push({ classId: cls.id, className: cls.name, studentId: s.id, name: s.name });
    });
  });

  save(); renderClasses(); renderClassTabs(); renderStudentList(); updateLeaderboard(); updateReportSelects();

  let msg = `✅ تم الاستيراد:\n`;
  if (newClasses > 0) msg += `• ${newClasses} صف جديد\n`;
  if (addedStudents > 0) msg += `• ${addedStudents} طالب جديد\n`;
  if (movedStudents > 0) msg += `• ${movedStudents} طالب تم نقله لصف آخر (مع الاحتفاظ بنقاطه وملاحظاته)\n`;
  if (updatedStudents > 0) msg += `• ${updatedStudents} طالب تم تحديث بياناته`;

  if (missingCandidates.length) {
    alert(msg);
    showMissingStudentsModal(missingCandidates);
  } else {
    alert(msg);
  }
}

/* طلاب موجودون بصفوفهم بنجوم مدرستي لكن اختفوا من آخر ملف بيانات مستورد — على الأغلب حُذفوا مركزياً
   أو نُقلوا لصف لم يُدرج بنفس عملية الاستيراد. نعرضهم للمراجعة اليدوية مع خيار إزالة اختياري. */
function showMissingStudentsModal(list){
  const html = `
    <div class="modal-title">⚠️ طلاب غير موجودين في آخر ملف مستورد</div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">
      هؤلاء الطلاب موجودون حالياً في نجوم مدرستي ضمن صفوف ظهرت بالملف المستورَد، لكن أسماءهم لم تُذكر فيه —
      على الأغلب تم حذفهم من بيانات المدرسة، أو نُقلوا لصف لم يشمله هذا الاستيراد.
      <b>لم يتم حذف أي منهم تلقائياً</b> (نقاطهم وملاحظاتهم محفوظة) — راجعهم واختر من تريد إزالته يدوياً إن رغبت.
    </p>
    <div style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;margin-bottom:14px">
      ${list.map((m,i) => `
        <label style="display:flex;align-items:center;gap:10px;background:var(--surface2);border-radius:10px;padding:8px 12px;border:1px solid var(--border-color)">
          <input type="checkbox" class="missing-student-chk" data-idx="${i}" style="width:16px;height:16px;accent-color:var(--accent)">
          <span style="font-size:13px;font-weight:700">${escapeHtmlSafe(m.name)}</span>
          <span style="font-size:11px;color:var(--text-muted)">— صف ${escapeHtmlSafe(m.className)}</span>
        </label>`).join('')}
    </div>
    <div class="modal-actions">
      <button class="btn btn-danger" style="flex:1" onclick="removeSelectedMissingStudents()">🗑️ إزالة المحدد نهائياً</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إبقاء الجميع (إغلاق)</button>
    </div>`;
  window._missingStudentsList = list;
  openModal(html);
}
function escapeHtmlSafe(s){
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function removeSelectedMissingStudents(){
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const list = window._missingStudentsList || [];
  const checked = Array.from(document.querySelectorAll('.missing-student-chk:checked')).map(el => parseInt(el.dataset.idx,10));
  if (!checked.length) { closeModalForce(); return; }
  if (!confirm(`سيتم حذف ${checked.length} طالب نهائياً مع كل نقاطهم وملاحظاتهم. هل أنت متأكد؟`)) return;
  checked.forEach(idx => {
    const m = list[idx];
    if (!m) return;
    const cls = state.classes.find(c => c.id === m.classId);
    if (!cls) return;
    cls.students = cls.students.filter(s => s.id !== m.studentId);
  });
  save(); renderClasses(); renderClassTabs(); renderStudentList(); updateLeaderboard(); updateReportSelects();
  closeModalForce();
  toast(`تم حذف ${checked.length} طالب`, '🗑️');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
function todayStr() { return new Date().toLocaleDateString('en-GB').replace(/\//g,'-'); }

// ===== IMPORT NAMES ONLY =====
// يستورد الأسماء والصفوف فقط — لا يمس النقاط أو الغياب أو الحضور
function importNamesOnly(event) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      if (file.name.endsWith('.json')) importNamesFromJSON(e.target.result);
      else importNamesFromCSV(e.target.result);
    } catch(err) { alert('خطأ في القراءة: ' + err.message); }
    event.target.value = '';
  };
  reader.readAsText(file, 'UTF-8');
}

function importNamesFromJSON(text) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const data = JSON.parse(text);
  if (!data.classes) { alert('ملف JSON غير صالح'); return; }

  let addedClasses = 0, addedStudents = 0, skipped = 0;

  data.classes.forEach(sc => {
    // البحث عن الصف في state
    let cls = state.classes.find(c => c.name === sc.name);

    // إذا الصف غير موجود — أنشئه فارغاً
    if (!cls) {
      cls = { id: Date.now() + Math.floor(Math.random()*99999), name: sc.name, _savedDates: [], students: [] };
      state.classes.push(cls);
      addedClasses++;
    }

    // إضافة الطلاب الجدد فقط (من ليس له اسم موجود مسبقاً)
    const existingNames = new Set(cls.students.map(s => s.name));
    (sc.students || []).forEach((ss, i) => {
      if (!existingNames.has(ss.name)) {
        cls.students.push({
          id: ss.id || Date.now() + i,
          name: ss.name,
          // بيانات صفرية — لا نستورد النقاط أو الغياب
          points: 0, present: 0, absent: 0, participation: 0,
          absenceDates: [], _todayAtt: 'unmarked', _prevAtt: {}
        });
        existingNames.add(ss.name);
        addedStudents++;
      } else {
        skipped++;
      }
    });
  });

  if (!state.activeClass && state.classes.length > 0)
    state.activeClass = state.classes[0].id;

  save(); renderClasses(); renderClassTabs(); renderStudentList(); updateLeaderboard(); updateReportSelects();

  let msg = `✅ تم استيراد الأسماء:\n`;
  if (addedClasses > 0) msg += `• ${addedClasses} صف جديد\n`;
  msg += `• ${addedStudents} طالب جديد`;
  if (skipped > 0) msg += `\n• تم تخطي ${skipped} اسم موجود مسبقاً`;
  msg += `\n\nملاحظة: النقاط والغياب لم تتغير.`;
  alert(msg);
}

function importNamesFromCSV(text) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length <= 1) { alert('الملف فارغ'); return; }
  const delim = lines[0].includes(';') ? ';' : ',';

  let addedStudents = 0, skipped = 0, newClasses = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = smartSplitCSV(lines[i], delim);
    if (row.length < 2) continue;
    const clsName = row[0].replace(/"/g, '').trim();
    const stName  = row[1].replace(/"/g, '').trim();
    const phone   = row[2] ? row[2].replace(/"/g,'').trim() : '';
    if (!clsName || !stName) continue;

    let cls = state.classes.find(c => c.name === clsName);
    if (!cls) {
      cls = { id: Date.now() + newClasses, name: clsName, _savedDates: [], students: [] };
      state.classes.push(cls);
      newClasses++;
    }

    const exists = cls.students.find(s => s.name === stName);
    if (!exists) {
      cls.students.push({
        id: Date.now() + addedStudents + newClasses,
        name: stName,
        points: 0, present: 0, absent: 0, participation: 0,
        absenceDates: [], _todayAtt: 'unmarked', _prevAtt: {},
        parentPhone: phone, behaviorNotes: []
      });
      addedStudents++;
    } else {
      // تحديث الرقم إذا كان موجوداً في الملف
      if (phone && !exists.parentPhone) exists.parentPhone = phone;
      skipped++;
    }
  }

  if (!state.activeClass && state.classes.length > 0)
    state.activeClass = state.classes[0].id;

  state.classes.forEach(cls => { cls.students = sortStudentsAlpha(cls.students); });
  save(); renderClasses(); renderClassTabs(); renderStudentList(); updateLeaderboard(); updateReportSelects();

  let msg = `✅ تم استيراد الأسماء:\n`;
  if (newClasses > 0) msg += `• ${newClasses} صف جديد\n`;
  msg += `• ${addedStudents} طالب جديد`;
  if (skipped > 0) msg += `\n• تم تخطي ${skipped} اسم موجود مسبقاً`;
  msg += `\n\nملاحظة: النقاط والغياب لم تتغير.`;
  alert(msg);
}

// ===== IMPORT =====
function importFromExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      if (file.name.endsWith('.json')) importFromJSON(e.target.result);
      else importFromCSV(e.target.result);
    } catch(err) { alert('خطأ: '+err.message); }
    event.target.value = '';
  };
  reader.readAsText(file, 'UTF-8');
}

function importFromJSON(text) {
  const data = JSON.parse(text);
  if (!data.classes) { alert('ملف غير صالح'); return; }

  // استعادة التقييمات
  if (data.assessments && data.assessments.length) {
    state.assessments = data.assessments;
    // ===== إصلاح: ضبط التقييم النشط بعد الاستيراد =====
    if (!activeAssessmentId || !state.assessments.find(a => a.id === activeAssessmentId)) {
      activeAssessmentId = state.assessments[0]?.id || null;
    }
  }

  let updated = 0;
  const newStudents = [];

  state.classes.forEach(cls => {
    const sc = data.classes.find(c => c.name === cls.name);
    if (!sc) return;
    if (sc._savedDates) cls._savedDates = sc._savedDates;
    if (sc._savedPeriods) cls._savedPeriods = sc._savedPeriods;
    cls.students.forEach(st => {
      const ss = (st.sid && sc.students?.find(s => s.sid && s.sid === st.sid)) || sc.students?.find(s => s.name === st.name);
      if (!ss) return;
      if (ss.sid && !st.sid) st.sid = ss.sid;
      if (Array.isArray(ss.lateDates)) st.lateDates = ss.lateDates;
      st.points = ss.points||0; st.present = ss.present||0; st.absent = ss.absent||0;
      st.participation = ss.participation||0; st.absenceDates = ss.absenceDates||[];
      st._prevAtt = ss._prevAtt||{}; st.parentPhone = ss.parentPhone||'';
      st.behaviorNotes = ss.behaviorNotes||[];
      st.govAccount = ss.govAccount||null; st.alifAccount = ss.alifAccount||null;
      // ترحيل من _bonusPoints القديم إلى _manualBonus الجديد
      if (ss._manualBonus !== undefined) {
        st._manualBonus = ss._manualBonus;
      } else if (ss._bonusPoints !== undefined) {
        const notePts2 = (ss.behaviorNotes||[]).reduce((sm,n)=>sm+(n.points||0),0);
        st._manualBonus = (ss._bonusPoints||0) - notePts2;
      } else {
        st._manualBonus = 0;
      }
      if (ss.phoneVerified !== undefined) st.phoneVerified = ss.phoneVerified;
      if (ss.pointsLog) st.pointsLog = ss.pointsLog;
      if (ss._dailyPart) st._dailyPart = ss._dailyPart;
      if (ss._dailyDeduct) st._dailyDeduct = ss._dailyDeduct;
      if (Array.isArray(ss.deductReasons)) st.deductReasons = ss.deductReasons;
      updated++;
    });
    const existingNames = new Set(cls.students.map(s => s.name));
    const existingSids = new Set(cls.students.map(s => s.sid).filter(Boolean));
    (sc.students || []).forEach(ss => {
      if (ss.sid && existingSids.has(ss.sid)) return;
      if (!existingNames.has(ss.name)) newStudents.push({ classId: cls.id, className: cls.name, ...ss });
    });
  });

  data.classes.forEach(sc => {
    const exists = state.classes.find(c => c.name === sc.name);
    if (!exists) {
      (sc.students || []).forEach(ss => {
        newStudents.push({ classId: sc.id, className: sc.name, isNewClass: true, ...ss });
      });
    }
  });

  if (data.seating && typeof data.seating === 'object') state.seating = Object.assign({}, state.seating||{}, data.seating);
  if (Array.isArray(data.archivedStudents) && data.archivedStudents.length) state.archivedStudents = data.archivedStudents;
  if (Array.isArray(data.archivedClasses) && data.archivedClasses.length) state.archivedClasses = data.archivedClasses;
  if (data.rosterMeta && !state.rosterMeta) state.rosterMeta = data.rosterMeta;
  if (data.marsadReview && typeof data.marsadReview === 'object') state.marsadReview = data.marsadReview;
  // استعادة schoolInfo في state (يدعم v7 و v6 القديم)
  if (data.schoolInfo) {
    state.schoolInfo = data.schoolInfo;
  } else {
    state.schoolInfo = {
      schoolName: data.schoolName || '',
      principal:  data.principal  || '',
      teacher:    data.teacher    || '',
      subject:    data.subject    || '',
      term:       data.term       || '',
      termStart:  data.termStart  || '',
      termEnd:    data.termEnd    || ''
    };
  }
  save(); // احفظ schoolInfo ضمن state
  // تحديث الواجهة
  const _si2 = state.schoolInfo;
  renderSchoolInfoBar(_si2.subject, _si2.teacher, _si2.schoolName);
  const _p2 = []; if(_si2.subject) _p2.push('المادة: '+_si2.subject); if(_si2.teacher) _p2.push('المعلم: '+_si2.teacher);
  const _subEl2 = document.getElementById('subject-title');
  const _schEl2 = document.getElementById('school-title');
  if(_subEl2) _subEl2.textContent = _p2.join(' | ') || 'اسم المادة — اسم المعلم';
  if(_schEl2) _schEl2.textContent = _si2.schoolName ? ' | المدرسة: ' + _si2.schoolName : '';
  if (data.schoolTitle && !data.schoolName) { /* legacy — ignore, nojomi title is fixed */ }
  if (data.subjectTitle) document.getElementById('subject-title').textContent = data.subjectTitle;

  save();
  renderStudentList(); updateLeaderboard(); updateReportSelects();
  // تحديث سجل الدرجات بعد الاستيراد
  if (state.assessments?.length) {
    if (!activeAssessmentId) activeAssessmentId = state.assessments[0]?.id || null;
    renderAssessmentTabs();
    renderGradesContent();
  }

  let msg = `✅ تم استيراد بيانات ${updated} طالب.`;
  if (data.assessments?.length) msg += `\n📝 تم استيراد ${data.assessments.length} تقييم.`;

  if (newStudents.length > 0 && !rosterManaged()) { // 🔒 في الوضع المركزي لا تُضاف طلاب من ملفات الاستيراد
    const byClass = {};
    newStudents.forEach(s => { if (!byClass[s.className]) byClass[s.className] = []; byClass[s.className].push(s.name); });
    let details = '';
    Object.entries(byClass).forEach(([cls, names]) => {
      details += `\n📚 ${cls} (${names.length} طالب):`; names.forEach(n => { details += `\n   • ${n}`; });
    });
    const answer = confirm(`${msg}\n\n⚠️ وُجد ${newStudents.length} طالب في الملف غير مضافين:${details}\n\nهل تريد إضافتهم؟`);
    if (answer) {
      newStudents.forEach((ss, i) => {
        let cls = state.classes.find(c => c.id === ss.classId || c.name === ss.className);
        if (!cls) { cls = { id: ss.classId || Date.now()+i, name: ss.className, _savedDates: [], students: [] }; state.classes.push(cls); }
        cls.students.push({
          id: ss.id || Date.now()+i, name: ss.name, sid: ss.sid || '', phoneVerified: ss.phoneVerified || false, lateDates: ss.lateDates || [],
          points: ss.points||0, present: ss.present||0, absent: ss.absent||0,
          participation: ss.participation||0, absenceDates: ss.absenceDates||[],
          _todayAtt: 'unmarked', _prevAtt: ss._prevAtt||{},
          parentPhone: ss.parentPhone||'', behaviorNotes: ss.behaviorNotes||[],
          govAccount: ss.govAccount||null, alifAccount: ss.alifAccount||null,
          _manualBonus: ss._manualBonus !== undefined ? ss._manualBonus : ((ss._bonusPoints||0) - (ss.behaviorNotes||[]).reduce((sm,n)=>sm+(n.points||0),0))
        });
      });
      if (!state.activeClass) state.activeClass = state.classes[0]?.id;
      // ترتيب أبجدي لجميع الصفوف بعد الإضافة
      state.classes.forEach(cls => { cls.students = sortStudentsAlpha(cls.students); });
      // إعادة حساب النقاط من المصدر لضمان الاتساق
      state.classes.forEach(cls => { cls.students.forEach(s => recomputeWithAssessments(cls, s)); });
      save();
      renderClassTabs(); renderStudentList(); renderClasses(); updateLeaderboard(); updateReportSelects();
      alert(`✅ تم إضافة ${newStudents.length} طالب جديد مرتبين أبجدياً.`);
    }
  } else { alert(msg); }
}

function importFromCSV(text) {
  const warned = confirm(
    '⚠️ تنبيه — ملف CSV\n\n' +
    'ملف CSV يحتوي على البيانات الأساسية فقط.\n' +
    'البيانات التالية لا تُرفع إلا من ملف JSON:\n' +
    '• سجل الغياب التفصيلي\n• الملاحظات السلوكية\n• التقييمات والدرجات\n• الحصص المحفوظة\n\n' +
    'هل تريد المتابعة باستيراد CSV؟'
  );
  if (!warned) return;
  text = text.replace(/^\uFEFF/,'');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length <= 1) { alert('الملف فارغ'); return; }
  const delim = lines[0].includes(';') ? ';' : ',';

  const headers = lines[0].split(delim).map(h => h.replace(/"/g,'').trim());
  const absenceDateCols = [];
  headers.forEach((h, idx) => {
    const m = h.match(/^غياب_(\d{4}-\d{2}-\d{2})$/);
    if (m) absenceDateCols.push({ idx, date: m[1] });
  });

  let updated = 0;
  const newStudents = []; // طلاب في الملف غير موجودين في البرنامج

  for (let i = 1; i < lines.length; i++) {
    const row = smartSplitCSV(lines[i], delim);
    if (row.length < 2) continue;
    const clsName = row[0].replace(/"/g,'').trim();
    const stName  = row[1].replace(/"/g,'').trim();
    if (!clsName || !stName) continue;

    // الأعمدة الجديدة: 2=هاتف، 3=govUser، 4=govPass، 5=alifUser، 6=alifPass، 7=نقاط، 8=مشاركة، 9=حضور، 10=غياب
    // للتوافق مع الملفات القديمة: نكتشف إذا كان العمود 3 رقماً (ملف قديم) أم نصاً (ملف جديد)
    const col3 = (row[3]||'').replace(/"/g,'').trim();
    const isNewFormat = isNaN(parseInt(col3)) || col3 === '';
    let phone='', govUser='', govPass='', alifUser='', alifPass='', pts=0, part=0, pres=0, abs=0;

    if (isNewFormat) {
      // صيغة جديدة: هاتف، govUser، govPass، alifUser، alifPass، نقاط، مشاركة، حضور، غياب
      phone    = (row[2]||'').replace(/"/g,'').trim();
      govUser  = (row[3]||'').replace(/"/g,'').trim();
      govPass  = (row[4]||'').replace(/"/g,'').trim();
      alifUser = (row[5]||'').replace(/"/g,'').trim();
      alifPass = (row[6]||'').replace(/"/g,'').trim();
      pts  = parseInt(row[7])||0;
      part = parseInt(row[8])||0;
      pres = parseInt(row[9])||0;
      abs  = parseInt(row[10])||0;
    } else {
      // صيغة قديمة: هاتف، نقاط، مشاركة، حضور، غياب
      phone = (row[2]||'').replace(/"/g,'').trim();
      pts  = parseInt(row[3])||0;
      part = parseInt(row[4])||0;
      pres = parseInt(row[5])||0;
      abs  = parseInt(row[6])||0;
    }

    const absDates = [];
    if (absenceDateCols.length > 0) {
      absenceDateCols.forEach(col => {
        if (row[col.idx]?.trim() === '1') absDates.push(col.date);
      });
    }

    const cls = state.classes.find(c => c.name === clsName);
    const st  = cls?.students.find(s => s.name === stName);

    if (st) {
      st.points = pts; st.participation = part; st.present = pres; st.absent = abs;
      if (phone) st.parentPhone = phone;
      if (govUser || govPass) st.govAccount = { user: govUser, pass: govPass };
      if (alifUser || alifPass) st.alifAccount = { user: alifUser, pass: alifPass };
      if (absDates.length > 0) st.absenceDates = absDates;
      // ===== إصلاح: استعادة _savedDates من أعمدة الغياب =====
      if (absDates.length > 0 && cls) {
        if (!cls._savedDates) cls._savedDates = [];
        absDates.forEach(d => { if (!cls._savedDates.includes(d)) cls._savedDates.push(d); });
      }
      updated++;
    } else {
      newStudents.push({ className: clsName, name: stName, points: pts, participation: part, present: pres, absent: abs, absenceDates: absDates, parentPhone: phone,
        govAccount: (govUser||govPass)?{user:govUser,pass:govPass}:null,
        alifAccount: (alifUser||alifPass)?{user:alifUser,pass:alifPass}:null });
    }
  }

  save(); renderStudentList(); updateLeaderboard();
  let msg = `✅ تم تحديث بيانات ${updated} طالب.`;

  if (newStudents.length > 0 && !rosterManaged()) { // 🔒 في الوضع المركزي لا تُضاف طلاب من ملفات الاستيراد
    const byClass = {};
    newStudents.forEach(s => {
      if (!byClass[s.className]) byClass[s.className] = [];
      byClass[s.className].push(s.name);
    });
    let details = '';
    Object.entries(byClass).forEach(([cls, names]) => {
      details += `\n📚 ${cls} (${names.length} طالب):`;
      names.forEach(n => { details += `\n   • ${n}`; });
    });

    const answer = confirm(
      `${msg}\n\n` +
      `⚠️ وُجد ${newStudents.length} طالب في الملف غير مضافين في البرنامج:` +
      details +
      `\n\nهل تريد إضافتهم مع بياناتهم؟`
    );

    if (answer) {
      newStudents.forEach((ss, i) => {
        let cls = state.classes.find(c => c.name === ss.className);
        if (!cls) {
          cls = { id: Date.now() + i, name: ss.className, _savedDates: [], students: [] };
          state.classes.push(cls);
        }
        cls.students.push({
          id: Date.now() + i + 1000,
          name: ss.name,
          points: ss.points, present: ss.present, absent: ss.absent,
          participation: ss.participation, absenceDates: ss.absenceDates,
          _todayAtt: 'unmarked', _prevAtt: {},
          parentPhone: ss.parentPhone || '',
          govAccount: ss.govAccount || null,
          alifAccount: ss.alifAccount || null
        });
      });
      if (!state.activeClass) state.activeClass = state.classes[0]?.id;
      save();
      renderClassTabs(); renderStudentList(); renderClasses(); updateLeaderboard(); updateReportSelects();
      alert(`✅ تم إضافة ${newStudents.length} طالب جديد بنجاح.`);
    }
  } else {
    alert(updated > 0 ? msg : '⚠️ لم أجد أسماء مطابقة');
  }
}

// تقسيم سطر CSV مع دعم علامات الاقتباس
function smartSplitCSV(line, delim) {
  const result = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuote = !inQuote; }
    else if (line[i] === delim && !inQuote) { result.push(cur); cur = ''; }
    else { cur += line[i]; }
  }
  result.push(cur);
  return result;
}

// ===== EDIT NOTE =====
function editNote(studentId, noteIdx, studentName, parentPhone) {
  const cls = state.classes.find(c => c.students.some(st => st.id === studentId));
  const s = cls?.students.find(st => st.id === studentId);
  if (!s || !s.behaviorNotes?.[noteIdx]) return;
  const note = s.behaviorNotes[noteIdx];
  const isPos = note.type === 'positive';
  const list = isPos ? POSITIVE_NOTES : NEGATIVE_NOTES;
  const isCustom = !list.includes(note.text);

  openModal(`
    <div class="modal-title">✏️ تعديل الملاحظة — ${studentName}</div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <button id="enote-tab-pos" onclick="switchEditNoteTab('positive',${noteIdx})"
        style="flex:1;padding:8px;border-radius:8px;font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;cursor:pointer;border:${isPos?'2px solid var(--present);background:rgba(78,205,196,0.15);color:var(--present)':'1px solid var(--border-color);background:transparent;color:var(--text-muted)'}">
        🌟 إيجابية
      </button>
      <button id="enote-tab-neg" onclick="switchEditNoteTab('negative',${noteIdx})"
        style="flex:1;padding:8px;border-radius:8px;font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;cursor:pointer;border:${!isPos?'2px solid var(--absent);background:rgba(255,107,107,0.15);color:var(--absent)':'1px solid var(--border-color);background:transparent;color:var(--text-muted)'}">
        ⚠️ سلبية
      </button>
    </div>
    <div class="form-group">
      <label class="form-label">اختر الملاحظة</label>
      <select class="select" id="enote-select" onchange="onEditNoteSelectChange()">
        ${noteOptionsHTML(isPos, isCustom ? 'غير ذلك...' : note.text)}
        ${isCustom ? `<option value="غير ذلك..." selected>غير ذلك...</option>` : ''}
      </select>
    </div>
    <div class="form-group" id="enote-custom-group" style="display:${isCustom?'block':'none'}">
      <label class="form-label">اكتب الملاحظة</label>
      <textarea class="input" id="enote-custom-text" style="height:80px;resize:vertical" placeholder="أدخل الملاحظة هنا...">${isCustom?note.text:''}</textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="saveEditedNote(${studentId},${noteIdx})">💾 حفظ</button>
      ${parentPhone ? `<button class="btn btn-success" onclick="openWhatsApp('${parentPhone}','${studentName}')">📱 واتساب</button>
      <button class="btn btn-ghost" onclick="showCallQR('${parentPhone}','${studentName}')" style="color:#a29bfe;border-color:#a29bfe">📲 QR</button>` : ''}
      <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
    </div>
  `);
  window._editNoteType = note.type;
}

function switchEditNoteTab(type, idx) {
  window._editNoteType = type;
  const isPos = type === 'positive';
  const list = isPos ? POSITIVE_NOTES : NEGATIVE_NOTES;
  document.getElementById('enote-tab-pos').style.cssText = `flex:1;padding:8px;border-radius:8px;font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;cursor:pointer;border:${isPos?'2px solid var(--present);background:rgba(78,205,196,0.15);color:var(--present)':'1px solid var(--border-color);background:transparent;color:var(--text-muted)'}`;
  document.getElementById('enote-tab-neg').style.cssText = `flex:1;padding:8px;border-radius:8px;font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;cursor:pointer;border:${!isPos?'2px solid var(--absent);background:rgba(255,107,107,0.15);color:var(--absent)':'1px solid var(--border-color);background:transparent;color:var(--text-muted)'}`;
  const sel = document.getElementById('enote-select');
  sel.innerHTML = noteOptionsHTML(isPos);
  onEditNoteSelectChange();
}

function onEditNoteSelectChange() {
  const sel = document.getElementById('enote-select');
  const grp = document.getElementById('enote-custom-group');
  if (grp) grp.style.display = sel.value === 'غير ذلك...' ? 'block' : 'none';
}

function saveEditedNote(studentId, noteIdx) {
  const cls = state.classes.find(c => c.students.some(st => st.id === studentId));
  const s = cls?.students.find(st => st.id === studentId);
  if (!s || !s.behaviorNotes?.[noteIdx]) return;
  const sel = document.getElementById('enote-select');
  let text = sel.value === 'غير ذلك...' ? document.getElementById('enote-custom-text')?.value.trim() : sel.value;
  if (!text) return toast('أدخل نص الملاحظة', '⚠️');
  s.behaviorNotes[noteIdx].text = text;
  s.behaviorNotes[noteIdx].type = window._editNoteType || s.behaviorNotes[noteIdx].type;
  s.behaviorNotes[noteIdx].code = s.behaviorNotes[noteIdx].type === 'negative' ? marsadCodeOf(text) : '';
  s.behaviorNotes[noteIdx].date = new Date().toLocaleDateString('ar-EG', {numberingSystem:'latn'});
  save();
  closeModalForce();
  showStudentReport();
  toast('تم تعديل الملاحظة ✅', '✏️');
}

// ===== QR CALL =====
function showCallQR(phone, studentName) {
  if (!phone) return toast('لا يوجد رقم مسجل', '⚠️');
  const cleanPhone = phone.replace(/\D/g, '');
  const callUrl = `tel:+${cleanPhone}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=380x380&margin=10&data=${encodeURIComponent(callUrl)}`;
  openModal(`
    <div class="modal-title">📲 QR Code للاتصال — ${studentName}</div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">امسح الكود بالكاميرا للاتصال المباشر بولي الأمر</p>
    <div style="text-align:center;margin-bottom:14px">
      <img src="${qrUrl}" alt="QR Call" style="border-radius:12px;border:3px solid #a29bfe;width:170px;height:170px"/>
    </div>
    <div style="text-align:center;font-size:14px;font-weight:700;color:var(--accent);margin-bottom:14px">📞 ${phone}</div>
    <div class="modal-actions">
      <a href="${callUrl}" class="btn btn-primary" style="flex:1;text-align:center;text-decoration:none">📞 اتصال مباشر</a>
      <button class="btn btn-ghost" onclick="closeModalForce()">إغلاق</button>
    </div>
  `);
}

// ===== IMPORT NAMES WITH PHONES =====
function importNamesWithPhones(event) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      importNamesWithPhonesFromCSV(e.target.result);
    } catch(err) { alert('خطأ في القراءة: ' + err.message); }
    event.target.value = '';
  };
  reader.readAsText(file, 'UTF-8');
}

function importNamesWithPhonesFromCSV(text) {
  if (rosterGuard()) return; // 🔒 يُدار من الملف المركزي
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length <= 1) { alert('الملف فارغ أو يحتوي على سطر عنوان فقط'); return; }
  const delim = lines[0].includes(';') ? ';' : ',';

  let addedStudents = 0, updatedPhones = 0, skipped = 0, newClasses = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = smartSplitCSV(lines[i], delim);
    if (row.length < 2) continue;
    const clsName = row[0].replace(/"/g,'').trim();
    const stName  = row[1].replace(/"/g,'').trim();
    const phone   = row[2] ? row[2].replace(/"/g,'').trim() : '';
    if (!clsName || !stName) continue;

    let cls = state.classes.find(c => c.name === clsName);
    if (!cls) {
      cls = { id: Date.now() + newClasses, name: clsName, _savedDates: [], students: [] };
      state.classes.push(cls);
      newClasses++;
    }

    const exists = cls.students.find(s => s.name === stName);
    if (!exists) {
      cls.students.push({
        id: Date.now() + addedStudents + newClasses + 5000,
        name: stName,
        points: 0, present: 0, absent: 0, participation: 0,
        absenceDates: [], _todayAtt: 'unmarked', _prevAtt: {},
        parentPhone: phone, behaviorNotes: []
      });
      addedStudents++;
    } else {
      if (phone) { exists.parentPhone = phone; updatedPhones++; }
      else skipped++;
    }
  }

  if (!state.activeClass && state.classes.length > 0)
    state.activeClass = state.classes[0].id;

  state.classes.forEach(cls => { cls.students = sortStudentsAlpha(cls.students); });
  save(); renderClasses(); renderClassTabs(); renderStudentList(); updateLeaderboard(); updateReportSelects();

  let msg = `✅ تم الاستيراد:\n`;
  if (newClasses > 0) msg += `• ${newClasses} صف جديد\n`;
  if (addedStudents > 0) msg += `• ${addedStudents} طالب جديد\n`;
  if (updatedPhones > 0) msg += `• ${updatedPhones} رقم تم تحديثه`;
  if (skipped > 0) msg += `\n• تم تخطي ${skipped} اسم موجود بدون رقم`;
  msg += `\n\nتنسيق الملف: الصف, الاسم, الرقم`;
  alert(msg);
}

