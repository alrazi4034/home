/* 06-marsad.js — تحويل ملاحظات نجوم مدرستي إلى ملفات برنامج مِرْصاد
   - لكل معلم × صف يُنشأ ملف classBatch (نفس صيغة Marsad_input) يقرؤه marsad_result مباشرة.
   - كل بند = عدد مرات تسجيل الملاحظة في المدى: لا شيء → «لا يظهر»، ثم «أحياناً»، ثم «دائماً».
   - B05 (تكرار الغياب) يُحسب من نسبة أيام غياب الطالب إلى الأيام الدراسية (النموذج + نجوم مدرستي) في نفس المدى.
   - B06 (تكرار التأخر) يُحسب من حالة «متأخر» في حضور نجوم مدرستي (مع أي ملاحظة تأخر قديمة).
   - الملاحظات الإيجابية تذهب إلى «نقاط القوة»، والملاحظات الأخرى (غير ذلك) إلى «ملاحظات إضافية».
   - الناتج ملف ZIP واحد للمدرسة: يُفك ثم تُختار ملفاته (أو المجلد) في برنامج النتائج. */

const MARSAD_SCHEMA = '2.0';
const MARSAD_STATEMENTS = {
  B01: ['يميل الطالب إلى كثرة الجدال مع المعلم أثناء الحصة.', 'Tends to argue frequently with the teacher during class.'],
  B02: ['يتناول الطعام داخل الصف دون إذن أو عذر.', 'Eats in class without permission or excuse.'],
  B03: ['يكثر من النوم أثناء الحصة.', 'Often sleeps during class.'],
  B04: ['يخرج من الصف دون إذن المعلم.', "Leaves the classroom without the teacher's permission."],
  B05: ['يتكرر غياب الطالب عن المدرسة.', 'Is frequently absent from school.'],
  B06: ['يتكرر تأخر الطالب عن الحصص الدراسية.', 'Is frequently late to classes.'],
  B07: ['يتحدث مع زملائه بصورة متكررة أثناء الشرح.', 'Frequently talks with classmates during the explanation.'],
  B08: ['يقاطع المعلم أو يتحدث دون استئذان.', 'Interrupts the teacher or speaks without permission.'],
  B09: ['لا يلتزم بتعليمات المعلم والتوجيهات الصفية.', "Does not follow the teacher's instructions and classroom directions."],
  B10: ['يستخدم ألفاظاً غير لائقة في التعامل مع الآخرين.', 'Uses inappropriate language when dealing with others.'],
  B11: ['يظهر سلوكاً عدوانياً لفظياً أو جسدياً تجاه زملائه.', 'Shows verbal or physical aggression toward classmates.'],
  B12: ['يرفض تنفيذ التعليمات أو المهام المطلوبة منه.', 'Refuses to carry out requested instructions or tasks.'],
  B13: ['يتكرر منه العبث بممتلكات المدرسة أو ممتلكات الآخرين.', "Frequently tampers with school property or others' belongings."],
  B14: ['يستخدم الأجهزة الإلكترونية دون إذن أو في غير الأغراض التعليمية.', 'Uses electronic devices without permission or for non-educational purposes.'],
  B15: ['يتكرر منه عدم الالتزام بالزي المدرسي أو المظهر المدرسي المعتمد.', 'Frequently does not comply with the approved school uniform or appearance.'],
  A01: ['لا يحضر الكتب أو الأدوات المدرسية بصورة منتظمة.', 'Does not regularly bring books or school supplies.'],
  A02: ['لا ينجز الواجبات المنزلية بصورة منتظمة.', 'Does not complete homework regularly.'],
  A03: ['يعاني من ضعف في المهارات الأساسية للمادة (القراءة، الكتابة، الحساب).', "Shows weakness in the subject's basic skills (reading, writing, arithmetic)."],
  A04: ['لا يشارك في الأنشطة والمناقشات الصفية.', 'Does not participate in class activities and discussions.'],
  A05: ['لا يستطيع التركيز ومتابعة الشرح لفترات مناسبة.', 'Cannot focus and follow the explanation for suitable periods.'],
  A06: ['يتكرر منه عدم إكمال الأنشطة والمهام الصفية.', 'Frequently does not complete class activities and tasks.'],
  A07: ['يظهر تدنياً ملحوظاً في نتائج الاختبارات والتقييمات.', 'Shows a noticeable decline in test and assessment results.'],
  A08: ['لا يظهر اهتماماً أو دافعية كافية للتعلم.', 'Does not show sufficient interest or motivation to learn.']
};
const MARSAD_CODES = Object.keys(MARSAD_STATEMENTS);
// ملاحظات نجوم مدرستي (الجديدة والقديمة) ورمزها في مرصاد — لملفات لا تحمل الرمز
const MARSAD_TEXT_CODE = {
  'الجدال مع المعلم أثناء الحصة': 'B01', 'تناول الطعام داخل الصف دون إذن': 'B02', 'النوم أثناء الحصة': 'B03',
  'الخروج من الصف دون إذن': 'B04', 'التأخر عن الحصة': 'B06', 'التحدث مع الزملاء أثناء الشرح': 'B07',
  'مقاطعة المعلم أو التحدث دون استئذان': 'B08', 'عدم الالتزام بتعليمات المعلم والتوجيهات الصفية': 'B09',
  'استخدام ألفاظ غير لائقة مع الآخرين': 'B10', 'سلوك عدواني لفظي أو جسدي تجاه زملائه': 'B11',
  'رفض تنفيذ التعليمات أو المهام المطلوبة': 'B12', 'العبث بممتلكات المدرسة أو الآخرين': 'B13',
  'استخدام الأجهزة الإلكترونية دون إذن أو لغير التعلم': 'B14', 'عدم الالتزام بالزي أو المظهر المدرسي': 'B15',
  'عدم إحضار الكتب أو الأدوات المدرسية': 'A01', 'عدم إنجاز الواجب المنزلي': 'A02', 'ضعف في المهارات الأساسية للمادة': 'A03',
  'عدم المشاركة في الأنشطة والمناقشات الصفية': 'A04', 'عدم التركيز ومتابعة الشرح': 'A05', 'عدم إكمال الأنشطة والمهام الصفية': 'A06',
  'تدنٍّ في نتائج الاختبارات والتقييمات': 'A07', 'ضعف الاهتمام والدافعية للتعلم': 'A08',
  // القديمة
  'التنمر (لفظي أو جسدي) على زملاءه': 'B11', 'تجاهل توجيهات المعلم': 'B09', 'التحدث بدون إذن ومقاطعة المعلم': 'B08',
  'الخروج من الصف بدون إذن': 'B04', 'غياب متكرر يستدعي المتابعة': 'B05', 'التأخر المتكرر عن الحصة': 'B06',
  'إهمال الواجبات والمهمات الدراسية': 'A02', 'عدم إحضار الأدوات أو الكتب': 'A01', 'اللعب داخل الصف أو إحداث فوضى': 'B09',
  'الانشغال بألعاب الحاسوب عن الحصة الدرسية': 'B14', 'النوم اثناء الحصة الدرسية': 'B03', 'الأكل اثناء الحصة': 'B02'
};
const MARSAD_SUBJECT_CODES = {
  'التربية الاسلامية': 'ISL', 'اللغة العربية': 'ARB', 'الرياضيات': 'MTH', 'العلوم': 'SCI', 'اللغة الفرنسية': 'FRN', 'الدراما': 'DRM',
  'الفنون السمعية': 'AUD', 'الذكاء الاصطناعي والتكنولوجيا': 'AIT', 'اللغة الانجليزية': 'ENG', 'التربية الرياضية': 'PE', 'الدراسات الاجتماعية': 'SST'
};
const MARSAD_DEFAULTS = { noteSome: 1, noteAlways: 3, absPctSome: 10, absPctAlways: 20, lateSome: 2, lateAlways: 4 };   // الغياب: نسبة مئوية من الأيام الدراسية
function marsadCfg() { return Object.assign({}, MARSAD_DEFAULTS, SETTINGS.marsad || {}); }
function noteCode(n) { return n.code || MARSAD_TEXT_CODE[String(n.text || '').trim()] || ''; }
function levelKey(count, some, always) { return count >= always ? 'always' : count >= some ? 'sometimes' : 'never'; }

/* ---------- بناء الملفات ---------- */
function buildMarsadBatches(from, to) {
  const cfg = marsadCfg();
  // أيام غياب كل طالب في المدى (كل المصادر، كل الصفوف)
  const miss = computeMissing(from, to, '');
  const abs = computeAbsence(from, to, '', miss);
  const absPct = new Map(), nDays = miss.days.length;
  abs.students.forEach(s => absPct.set(s.sid || 'n:' + normName(s.name), nDays ? s.dayCount / nDays * 100 : 0));

  const now = new Date();
  const statements = {};
  MARSAD_CODES.forEach(c => statements[c] = { ar: MARSAD_STATEMENTS[c][0], en: MARSAD_STATEMENTS[c][1] });
  const files = [], stats = { students: 0, flagged: {}, skipped: [] };
  MARSAD_CODES.forEach(c => stats.flagged[c] = { sometimes: 0, always: 0 });

  MODEL.files.teachers.forEach(t => {
    const ct = MODEL.teachers.get(t.key);
    const subject = (t.subject || (ct && ct.subjects[0]) || '').split('،')[0].trim();
    const code = MARSAD_SUBJECT_CODES[subject] || 'SUBJ';
    t.classes.forEach(c => {
      const m = String(c.name).match(/^(\d+)\s*\/\s*(\d+)$/);
      if (!m) { stats.skipped.push(t.name + ' — ' + c.name); return; }
      const [ , grade, section] = m;
      const students = c.students.map(s => {
        const counts = {}, strengths = {}, other = [];
        (s.noteList || []).forEach(n => {
          if (n.date && (n.date < from || n.date > to)) return;
          if (n.type === 'positive') { if (n.text && n.text !== 'غير ذلك...') strengths[n.text] = (strengths[n.text] || 0) + 1; return; }
          const k = noteCode(n);
          if (k && k !== 'B05') counts[k] = (counts[k] || 0) + 1;   // B06 القديمة تُجمع مع التأخر
          else if (!k && n.text) other.push(n.text);
        });
        const lates = (s.lateDates || []).filter(d => { const x = toISO(d); return x >= from && x <= to; }).length;
        const answers = {};
        MARSAD_CODES.forEach(k => {
          answers[k] = k === 'B05'
            ? levelKey(absPct.get(s.sid || 'n:' + normName(s.name)) || 0, cfg.absPctSome, cfg.absPctAlways)
            : k === 'B06'
            ? levelKey((counts.B06 || 0) + lates, cfg.lateSome, cfg.lateAlways)
            : levelKey(counts[k] || 0, cfg.noteSome, cfg.noteAlways);
          if (answers[k] !== 'never') stats.flagged[k][answers[k]]++;
        });
        stats.students++;
        return {
          id: s.sid || '', name: s.name, sourceEntry: s.sid ? `${s.name} (${s.sid})` : s.name,
          status: 'done', updatedAt: now.toISOString(), answers, followUp: {},
          strengths: Object.entries(strengths).map(([x, n]) => n > 1 ? `${x} (${n})` : x).join('، '),
          additionalNotes: other.join('، ')
        };
      });
      if (!students.length) return;
      const batch = {
        schemaVersion: MARSAD_SCHEMA, app: 'Marsad', type: 'classBatch', batchId: (crypto.randomUUID ? crypto.randomUUID() : 'nj-' + Date.now() + Math.random()),
        exportedAt: now.toISOString(), exportedAtLocal: now.toLocaleString('en-GB', { hour12: false }), formLanguage: 'ar',
        source: { app: 'nojoom', note: 'مولّد من ملاحظات نجوم مدرستي', from, to, file: t.file },
        teacher: { name: t.name }, subject: { name: subject, code },
        class: { grade, section, classCode: grade + '-' + section },
        scale: { note: 'answers are observation-frequency choices (never / sometimes / always), not a grade or a diagnosis.',
                 values: [{ key: 'never', level: 0, labelAr: 'لا يظهر', labelEn: 'Not observed' }, { key: 'sometimes', level: 2, labelAr: 'أحياناً', labelEn: 'Sometimes' }, { key: 'always', level: 4, labelAr: 'دائماً', labelEn: 'Always' }] },
        statements, students,
        totals: { roster: students.length, enteredStudents: students.length, notObserved: 0, incomplete: 0, missingNames: [] }
      };
      const safeT = t.name.replace(/[\\/:*?"<>|\s]+/g, '_');
      files.push({ name: `${grade}${section}_${code}_${safeT}.json`, text: JSON.stringify(batch, null, 2), teacher: t.name, cls: c.name, n: students.length });
    });
  });
  stats.days = nDays;
  return { files, stats, cfg };
}

/* ---------- ملف ZIP (بدون ضغط، بأسماء عربية UTF-8) ---------- */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  let offset = 0;
  files.forEach(f => {
    const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(h.buffer, name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.push(c.buffer, name);
    offset += 30 + name.length + data.length;
  });
  const cdSize = central.reduce((n, b) => n + (b.byteLength || b.length), 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
  return new Blob(parts.concat(central, [e.buffer]), { type: 'application/zip' });
}

/* ---------- الواجهة ---------- */
function openMarsadExport() {
  if (!MODEL || !MODEL.files.teachers.length) {
    return openModal(`<h2>🧭 تصدير إلى مرصاد</h2><div style="line-height:2">اربط «مجلد ملفات المعلمين» أولاً — الملاحظات السلوكية تُقرأ من ملفات نجوم مدرستي.</div>
      <div class="actions"><button class="btn" onclick="closeModal()">إغلاق</button></div>`);
  }
  const cfg = marsadCfg();
  const from = LAST.from, to = LAST.to;
  const r = buildMarsadBatches(from, to);
  const top = MARSAD_CODES.map(c => ({ c, s: r.stats.flagged[c].sometimes, a: r.stats.flagged[c].always }))
    .filter(x => x.s + x.a).sort((x, y) => (y.a * 2 + y.s) - (x.a * 2 + x.s));
  openModal(`<h2>🧭 تصدير ملاحظات نجوم مدرستي إلى مرصاد</h2>
    <div class="muted" style="line-height:1.9;font-size:12.5px;margin-bottom:10px">
      المدى: <b>${from}</b> إلى <b>${to}</b> (من الفلتر). يُنشأ ملف لكل معلم × صف بصيغة مرصاد، ويُجمع في ملف ZIP واحد للمدرسة.
      فُكّ الملف ثم اختر ملفاته (أو مجلده) في <b>marsad_result</b>.</div>
    <div class="card"><h3>قواعد التحويل</h3>
      <div class="row">ملاحظة سلبية مسجّلة: <label>«أحياناً» من <input type="number" min="1" style="width:56px" id="mr-ns" value="${cfg.noteSome}"> مرة</label>
        <label>«دائماً» من <input type="number" min="1" style="width:56px" id="mr-na" value="${cfg.noteAlways}"> مرات</label></div>
      <div class="row">B05 تكرار الغياب — نسبة أيام الغياب من ${r.stats.days} يوم دراسي: <label>«أحياناً» من <input type="number" min="1" max="100" style="width:56px" id="mr-as" value="${cfg.absPctSome}">%</label>
        <label>«دائماً» من <input type="number" min="1" max="100" style="width:56px" id="mr-aa" value="${cfg.absPctAlways}">%</label>
      </div>
      <div class="row">B06 تكرار التأخر (مرات «متأخر» في الحضور): <label>«أحياناً» من <input type="number" min="1" style="width:56px" id="mr-ls" value="${cfg.lateSome}"></label>
        <label>«دائماً» من <input type="number" min="1" style="width:56px" id="mr-la" value="${cfg.lateAlways}"></label>
        <button class="btn sm" onclick="saveMarsadCfg()">↻ تطبيق</button></div>
      <div class="muted" style="font-size:12px">البند غير المسجّل = «لا يظهر». الملاحظات الإيجابية → نقاط القوة. «غير ذلك» → ملاحظات إضافية.</div>
    </div>
    <div class="kpis">${kpi(r.files.length, 'ملف (معلم × صف)', 'star')}${kpi(r.stats.students, 'سجل طالب')}${kpi(top.reduce((n, x) => n + x.a, 0), 'بند «دائماً»', 'bad')}${kpi(top.reduce((n, x) => n + x.s, 0), 'بند «أحياناً»', 'warn')}</div>
    <div class="card"><h3>البنود المرصودة</h3>
      ${top.length ? `<div class="tbl-wrap" style="max-height:260px"><table><thead><tr><th>البند</th><th class="num">أحياناً</th><th class="num">دائماً</th></tr></thead><tbody>
        ${top.map(x => `<tr><td style="white-space:normal"><b>${x.c}</b> ${esc(MARSAD_STATEMENTS[x.c][0])}</td><td class="num">${x.s}</td><td class="num" style="color:var(--bad);font-weight:800">${x.a}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="muted">لا توجد ملاحظات سلبية أو غياب يتجاوز الحد في هذا المدى.</div>'}
      ${r.stats.skipped.length ? `<div class="muted" style="font-size:12px;margin-top:6px">تم تخطي صفوف بأسماء غير قياسية: ${r.stats.skipped.map(esc).join('، ')}</div>` : ''}
    </div>
    <div class="actions"><button class="btn primary" onclick="downloadMarsadZip()" ${r.files.length ? '' : 'disabled'}>📦 تنزيل ملف مرصاد (ZIP)</button><button class="btn" onclick="closeModal()">إغلاق</button></div>`);
}
function saveMarsadCfg() {
  const v = id => Math.max(1, parseInt(document.getElementById(id).value, 10) || 1);
  SETTINGS.marsad = { noteSome: v('mr-ns'), noteAlways: Math.max(v('mr-ns'), v('mr-na')), absPctSome: v('mr-as'), absPctAlways: Math.max(v('mr-as'), v('mr-aa')),
    lateSome: v('mr-ls'), lateAlways: Math.max(v('mr-ls'), v('mr-la')) };
  saveSettings();
  openMarsadExport();
}
function downloadMarsadZip() {
  const r = buildMarsadBatches(LAST.from, LAST.to);
  if (!r.files.length) return toast('لا توجد ملفات');
  const blob = makeZip(r.files);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `مرصاد_من_نجوم_مدرستي_${LAST.from}_${LAST.to}.zip`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`تم تنزيل ${r.files.length} ملف مرصاد ✅`);
}
