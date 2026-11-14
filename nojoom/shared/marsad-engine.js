/* shared/marsad-engine.js — محرّك استنتاج بنود مِرْصاد (مشترك بين نجوم مدرستي ولوحة التحكم)
   ------------------------------------------------------------------------------------------
   لكل طالب ولكل بند يُحسب مستوى: never «لا يظهر» / sometimes «أحياناً» / always «دائماً» من ثلاثة مصادر:
     1) الملاحظات السلبية المسجّلة (أقوى دليل) + أسباب الخصم السريعة (نصف وزن الملاحظة).
     2) الاستنتاج من البيانات: المشاركة، التقييمات، الخصومات، اتجاه النقاط، الغياب، التأخر.
     3) الملاحظات الإيجابية تُخفّف البنود المرتبطة بها فقط (كل ملاحظة إيجابية = نصف ملاحظة سلبية).
   ثم مراجعة المعلم: أي خانة عدّلها المعلم تُعتمد كما هي.
   لا يُستنتج شيء بدون بيانات كافية (أسابيع / تقييمات) — يبقى «لا يظهر» ولا يُخمَّن. */

const MRS = (() => {
  const STATEMENTS = {
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
  const CODES = Object.keys(STATEMENTS);
  const SHORT = {
    B01: 'الجدال', B02: 'الأكل', B03: 'النوم', B04: 'الخروج', B05: 'الغياب', B06: 'التأخر', B07: 'التحدث', B08: 'المقاطعة',
    B09: 'التعليمات', B10: 'الألفاظ', B11: 'العدوانية', B12: 'الرفض', B13: 'العبث', B14: 'الأجهزة', B15: 'الزي',
    A01: 'الأدوات', A02: 'الواجب', A03: 'المهارات', A04: 'المشاركة', A05: 'التركيز', A06: 'الأنشطة', A07: 'الاختبارات', A08: 'الدافعية'
  };
  const SUBJECT_CODES = {
    'التربية الاسلامية': 'ISL', 'التربية الإسلامية': 'ISL', 'اللغة العربية': 'ARB', 'الرياضيات': 'MTH', 'العلوم': 'SCI', 'اللغة الفرنسية': 'FRN',
    'الدراما': 'DRM', 'الفنون السمعية': 'AUD', 'الذكاء الاصطناعي والتكنولوجيا': 'AIT', 'اللغة الانجليزية': 'ENG', 'اللغة الإنجليزية': 'ENG',
    'التربية الرياضية': 'PE', 'الدراسات الاجتماعية': 'SST'
  };
  // نص الملاحظة السلبية (الجديدة والقديمة) ← رمز مرصاد — لملاحظات لا تحمل الرمز
  const TEXT_CODE = {
    'الجدال مع المعلم أثناء الحصة': 'B01', 'تناول الطعام داخل الصف دون إذن': 'B02', 'النوم أثناء الحصة': 'B03',
    'الخروج من الصف دون إذن': 'B04', 'التأخر عن الحصة': 'B06', 'التحدث مع الزملاء أثناء الشرح': 'B07',
    'مقاطعة المعلم أو التحدث دون استئذان': 'B08', 'عدم الالتزام بتعليمات المعلم والتوجيهات الصفية': 'B09',
    'استخدام ألفاظ غير لائقة مع الآخرين': 'B10', 'سلوك عدواني لفظي أو جسدي تجاه زملائه': 'B11',
    'رفض تنفيذ التعليمات أو المهام المطلوبة': 'B12', 'العبث بممتلكات المدرسة أو الآخرين': 'B13',
    'استخدام الأجهزة الإلكترونية دون إذن أو لغير التعلم': 'B14', 'عدم الالتزام بالزي أو المظهر المدرسي': 'B15',
    'عدم إحضار الكتب أو الأدوات المدرسية': 'A01', 'عدم إنجاز الواجب المنزلي': 'A02', 'ضعف في المهارات الأساسية للمادة': 'A03',
    'عدم المشاركة في الأنشطة والمناقشات الصفية': 'A04', 'عدم التركيز ومتابعة الشرح': 'A05', 'عدم إكمال الأنشطة والمهام الصفية': 'A06',
    'تدنٍّ في نتائج الاختبارات والتقييمات': 'A07', 'ضعف الاهتمام والدافعية للتعلم': 'A08',
    'التنمر (لفظي أو جسدي) على زملاءه': 'B11', 'تجاهل توجيهات المعلم': 'B09', 'التحدث بدون إذن ومقاطعة المعلم': 'B08',
    'الخروج من الصف بدون إذن': 'B04', 'غياب متكرر يستدعي المتابعة': 'B05', 'التأخر المتكرر عن الحصة': 'B06',
    'إهمال الواجبات والمهمات الدراسية': 'A02', 'عدم إحضار الأدوات أو الكتب': 'A01', 'اللعب داخل الصف أو إحداث فوضى': 'B09',
    'الانشغال بألعاب الحاسوب عن الحصة الدرسية': 'B14', 'النوم اثناء الحصة الدرسية': 'B03', 'الأكل اثناء الحصة': 'B02'
  };

  // الملاحظات الإيجابية بعد دمج المتشابه — وكل مجموعة تُخفّف بنود مرصاد المقابلة لها
  const POS_GROUPS = [
    { t: 'الانضباط والالتزام بالتعليمات ورفع اليد قبل التحدث', off: ['B07', 'B08', 'B09', 'B12'],
      old: ['سلوك مثالي يستحق الإشادة', 'التزام كامل بالحضور والانضباط', 'رفع اليد قبل التحدث'] },
    { t: 'تفاعل ومشاركة فعّالة في الدرس والأنشطة', off: ['A04', 'A05', 'A08'],
      old: ['تفاعل ممتاز وإجابات متميزة في الدرس', 'مشاركة فعّالة في الأنشطة الصفية', 'المبادرة والمشاركة في الأنشطة'] },
    { t: 'إنجاز الواجبات والمهام بدقة وإتقان', off: ['A02', 'A06'], old: ['إنجاز الواجبات بدقة واتقان'] },
    { t: 'إحضار الكتب والأدوات بانتظام', off: ['A01'], old: [] },
    { t: 'تحسّن ملحوظ في الأداء الأكاديمي', off: ['A03', 'A07', 'A08'], old: [] },
    { t: 'مساعدة الزملاء وروح التعاون والاحترام', off: ['B10', 'B11'], old: ['مساعدة الزملاء وروح التعاون'] },
    { t: 'الصدق والأمانة', off: ['B13'], old: [] },
    { t: 'الالتزام بالهدوء والخشوع أثناء الصلاة', off: [], old: [] },
    { t: 'النظافة الشخصية والمظهر المدرسي', off: ['B15'], old: ['النظافة الشخصية ونظافة المكان'] }
  ];
  const POS_INDEX = new Map();
  POS_GROUPS.forEach(g => { POS_INDEX.set(g.t, g); g.old.forEach(o => POS_INDEX.set(o, g)); });
  function posGroupOf(text) { return POS_INDEX.get(String(text || '').trim()) || null; }

  // أسباب الخصم السريعة (ضغطة واحدة بعد «خصم»)
  const DEDUCT_REASONS = [
    { code: 'B07', t: '🗣️ تحدّث' },
    { code: 'A05', t: '😶‍🌫️ عدم تركيز' },
    { code: 'A06', t: '📋 لم يكمل النشاط' },
    { code: 'A01', t: '🎒 بدون أدوات' },
    { code: 'A02', t: '📚 لم يحل الواجب' },
    { code: 'B09', t: '⚠️ لم يلتزم بالتعليمات' }
  ];

  const DEF = {
    noteSome: 1, noteAlways: 3,      // صافي الملاحظات السلبية للبند
    deductWeight: 0.5,               // سبب الخصم = نصف ملاحظة
    posOffset: 0.5,                  // كل ملاحظة إيجابية مرتبطة تخفّف نصف ملاحظة سلبية
    minWeeks: 3,                     // أقل عدد أسابيع بيانات للاستنتاج من البيانات
    minAssess: 2,                    // أقل عدد تقييمات لاستنتاج A07
    testSome: 65, testAlways: 50,    // متوسط التقييمات (%)
    partSome: 0.5, partAlways: 0.25, // مشاركة الطالب لكل حصة ÷ متوسط الصف
    absPctSome: 10, absPctAlways: 20,
    lateSome: 2, lateAlways: 4
  };
  const RANK = { never: 0, sometimes: 1, always: 2 };
  const LV = ['never', 'sometimes', 'always'];
  const LABEL = { never: 'لا يظهر', sometimes: 'أحياناً', always: 'دائماً' };
  const maxLv = (a, b) => RANK[a] >= RANK[b] ? a : b;
  const down = l => LV[Math.max(0, RANK[l] - 1)];

  function toISO(v) {
    if (!v) return '';
    if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
    const s = String(v).replace(/[‎‏؜]/g, '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
  }
  const noteISO = n => toISO(n.isoDate) || toISO(n.date);
  function noteCode(n) { return n.code || TEXT_CODE[String(n.text || '').trim()] || ''; }
  function weekKey(iso) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
  function studentKey(s) { return s.sid ? String(s.sid) : 'id:' + s.id; }
  function splitName(n) { const m = String(n || '').match(/^(.*?)\s*\(([^()]+)\)\s*$/); return m ? { name: m[1].trim(), sid: m[2].trim() } : { name: String(n || '').trim(), sid: '' }; }
  function lvByCount(x, some, always) { return x >= always ? 'always' : x >= some ? 'sometimes' : 'never'; }

  /* ---------- تحليل صف كامل ---------- */
  // cls: {id, name, _savedDates, students:[...نجوم مدرستي]}، assessments: state.assessments
  // opt: {from, to, cfg, absPct(student)->% أو null, review: {studentKey: {code: level}}}
  function analyzeClass(cls, assessments, opt) {
    opt = opt || {};
    const cfg = Object.assign({}, DEF, opt.cfg || {});
    const inR = d => !!d && (!opt.from || d >= opt.from) && (!opt.to || d <= opt.to);
    const saved = (cls._savedDates || []).map(toISO).filter(inR);
    const savedSet = new Set(saved);
    const weeks = new Set(saved.map(weekKey));
    const enoughWeeks = weeks.size >= cfg.minWeeks;
    const myAssess = (assessments || []).filter(a => (a.classIds || []).includes(cls.id) && a.maxScore);

    // 1) الأساسيات لكل طالب
    const base = (cls.students || []).map(s => {
      const absent = new Set((s.absenceDates || []).map(toISO).filter(d => savedSet.has(d)));
      const attended = saved.filter(d => !absent.has(d)).length;
      const part = {}, ded = {}, logPartW = {}, ptsW = {};
      (s.pointsLog || []).forEach(e => {
        const d = toISO(e.date); if (!inR(d)) return;
        if (e.type === 'participation') part[d] = (part[d] || 0) + (e.pts || 0);
        if (e.type === 'deduct') ded[d] = (ded[d] || 0) - (e.pts || 0);
        ptsW[weekKey(d)] = (ptsW[weekKey(d)] || 0) + (e.pts || 0);
      });
      Object.entries(s._dailyPart || {}).forEach(([d, n]) => { d = toISO(d); if (inR(d)) part[d] = Math.max(part[d] || 0, n || 0); });
      Object.entries(s._dailyDeduct || {}).forEach(([d, n]) => { d = toISO(d); if (inR(d)) ded[d] = Math.max(ded[d] || 0, n || 0); });
      const partTotal = Object.values(part).reduce((a, b) => a + b, 0);
      const dedTotal = Object.values(ded).reduce((a, b) => a + b, 0);
      // أسباب الخصم (لا تتجاوز عدد الخصومات في اليوم)
      const reasonsByDay = {};
      (s.deductReasons || []).forEach(r => { const d = toISO(r.date); if (inR(d) && r.code) (reasonsByDay[d] = reasonsByDay[d] || []).push(r.code); });
      const dedReasons = {};
      let reasoned = 0;
      Object.entries(reasonsByDay).forEach(([d, list]) => {
        const cap = Math.max(ded[d] || 0, list.length);   // خصم قديم بلا عداد: نقبل الأسباب كما هي
        list.slice(0, cap).forEach(c => { dedReasons[c] = (dedReasons[c] || 0) + 1; reasoned++; });
      });
      // الملاحظات
      const neg = {}, pos = {}, strengths = {}, other = [];
      (s.behaviorNotes || []).forEach(n => {
        const d = noteISO(n);
        if (d && !inR(d)) return;
        if (n.type === 'positive') {
          const g = posGroupOf(n.text);
          const label = g ? g.t : String(n.text || '').trim();
          if (label && label !== 'غير ذلك...') strengths[label] = (strengths[label] || 0) + 1;
          if (g) g.off.forEach(c => pos[c] = (pos[c] || 0) + 1);
          return;
        }
        const c = noteCode(n);
        if (c) neg[c] = (neg[c] || 0) + 1;
        else if (n.text && n.text !== 'غير ذلك...') other.push(String(n.text).trim());
      });
      const lates = (s.lateDates || []).map(toISO).filter(d => savedSet.has(d)).length;
      const scores = myAssess.map(a => {
        const v = a.scores ? (a.scores[s.id] ?? a.scores[String(s.id)]) : undefined;
        return v !== undefined && v !== '' && v !== null && !isNaN(parseFloat(v)) ? parseFloat(v) / a.maxScore * 100 : null;
      }).filter(v => v !== null);
      const wk = Object.keys(ptsW).sort();
      return { s, attended, absentN: absent.size, partTotal, partRate: attended ? partTotal / attended : 0, dedTotal, reasoned,
               dedRate: attended ? (dedTotal - reasoned) / attended : 0, dedReasons, neg, pos, strengths, other, lates, scores, ptsW, wk };
    });

    // متوسطات الصف (للمقارنة العادلة بين المواد)
    const withData = base.filter(b => b.attended >= 3);
    const avg = f => withData.length ? withData.reduce((a, b) => a + f(b), 0) / withData.length : 0;
    const classPart = avg(b => b.partRate);
    const classDed = avg(b => b.dedRate);
    const tracksPart = classPart >= 0.15;            // المعلم يسجّل المشاركات فعلاً في هذا الصف

    // 2) البنود لكل طالب
    return base.map(b => {
      const s = b.s, key = studentKey(s);
      const auto = {}, reasons = {}, kind = {};
      const why = (c, t) => (reasons[c] = reasons[c] ? reasons[c] + ' • ' + t : t);

      CODES.forEach(c => {
        auto[c] = 'never';
        // (أ) الملاحظات + أسباب الخصم − الإيجابية المرتبطة
        const E = (b.neg[c] || 0) + cfg.deductWeight * (b.dedReasons[c] || 0);
        if (E > 0) {
          const O = cfg.posOffset * (b.pos[c] || 0);
          const net = Math.max(0, E - O);
          const lv = lvByCount(net, cfg.noteSome, cfg.noteAlways);
          const parts = [];
          if (b.neg[c]) parts.push(`${b.neg[c]} ملاحظة`);
          if (b.dedReasons[c]) parts.push(`${b.dedReasons[c]} خصم بهذا السبب`);
          let t = parts.join(' + ');
          if (b.pos[c]) t += ` − ${b.pos[c]} إيجابية مرتبطة`;
          why(c, t + ` ⇐ ${LABEL[lv]}`);
          if (lv !== 'never') { auto[c] = lv; kind[c] = 'note'; }
        }
      });

      const setData = (c, lv, t) => {
        if (lv === 'never') return;
        if ((b.pos[c] || 0) >= 3) { lv = down(lv); t += ` (خُفّف: ${b.pos[c]} ملاحظات إيجابية مرتبطة)`; }
        why(c, t);
        if (RANK[lv] > RANK[auto[c]]) { auto[c] = lv; kind[c] = kind[c] === 'note' ? 'both' : 'data'; }
        else if (lv !== 'never' && kind[c] === 'note') kind[c] = 'both';
      };

      // B05 الغياب: نسبة من الأيام الدراسية (من لوحة التحكم للمدرسة كلها، أو من حصص هذا الصف)
      const absPct = typeof opt.absPct === 'function' ? opt.absPct(s) : null;
      const pctAbs = absPct !== null && absPct !== undefined ? absPct : (saved.length ? b.absentN / saved.length * 100 : 0);
      if (saved.length >= 5 || absPct != null) setData('B05', lvByCount(pctAbs, cfg.absPctSome, cfg.absPctAlways), `غياب ${Math.round(pctAbs)}% من الأيام`);
      // B06 التأخر
      setData('B06', lvByCount(b.lates + (b.neg.B06 || 0), cfg.lateSome, cfg.lateAlways), `تأخر ${b.lates + (b.neg.B06 || 0)} مرة`);

      // A07 نتائج التقييمات
      let a07 = 'never';
      if (b.scores.length >= cfg.minAssess) {
        const m = b.scores.reduce((x, y) => x + y, 0) / b.scores.length;
        a07 = m < cfg.testAlways ? 'always' : m < cfg.testSome ? 'sometimes' : 'never';
        if (a07 !== 'never') setData('A07', a07, `متوسط التقييمات ${Math.round(m)}% (${b.scores.length} تقييمات)`);
      }
      // A04 المشاركة مقارنة بالصف
      let a04 = 'never';
      if (enoughWeeks && tracksPart && b.attended >= 5) {
        const ratio = b.partRate / classPart;
        a04 = ratio < cfg.partAlways ? 'always' : ratio < cfg.partSome ? 'sometimes' : 'never';
        if (a04 !== 'never') setData('A04', a04, `مشاركة ${b.partRate.toFixed(2)} لكل حصة مقابل ${classPart.toFixed(2)} متوسط الصف`);
      }
      // A05 التركيز: خصومات بلا سبب أعلى بوضوح من الصف (يصل إلى «أحياناً» فقط)
      const genericDed = b.dedTotal - b.reasoned;
      if (enoughWeeks && genericDed >= 3 && b.dedRate >= Math.max(2 * classDed, 0.1))
        setData('A05', 'sometimes', `${genericDed} خصم (${b.dedRate.toFixed(2)} لكل حصة مقابل ${classDed.toFixed(2)} للصف)`);
      // اتجاه النقاط: آخر 3 أسابيع مقارنة بما قبلها
      let declining = false;
      if (b.wk.length >= cfg.minWeeks + 2) {
        const rec = b.wk.slice(-3), prev = b.wk.slice(0, -3);
        const ra = rec.reduce((a, k) => a + b.ptsW[k], 0) / rec.length, pa = prev.reduce((a, k) => a + b.ptsW[k], 0) / prev.length;
        declining = pa > 0 && ra < pa * 0.75;
      }
      // A08 الدافعية: مؤشر مركّب
      const ind = [];
      if (RANK[a04] >= 1) ind.push('مشاركة منخفضة');
      if (declining) ind.push('نقاط متراجعة آخر 3 أسابيع');
      if (['A01', 'A02', 'A06'].some(c => RANK[auto[c]] >= 1 && kind[c] !== 'data')) ind.push('ملاحظات الأدوات/الواجب/الأنشطة');
      if (RANK[a07] >= 1) ind.push('تقييمات منخفضة');
      if (ind.length >= 2) setData('A08', ind.length >= 3 ? 'always' : 'sometimes', 'مؤشرات: ' + ind.join('، '));
      // A03 المهارات الأساسية: اقتراح فقط عند تدنٍّ شديد ومستمر — يحتاج تأكيد المعلم
      const needsConfirm = {};
      if (a07 === 'always' && !b.neg.A03) { setData('A03', 'sometimes', 'اقتراح: تقييمات متدنية جداً — يحتاج تأكيد المعلم'); needsConfirm.A03 = true; }

      // 3) مراجعة المعلم
      const rv = (opt.review && opt.review[key]) || {};
      const answers = {}, overridden = {};
      CODES.forEach(c => {
        if (rv[c] && RANK[rv[c]] !== undefined) { answers[c] = rv[c]; overridden[c] = rv[c] !== auto[c]; }
        else answers[c] = auto[c];
      });
      const p = splitName(s.name);
      return {
        key, sid: s.sid || p.sid || '', name: p.name, auto, answers, overridden, reasons, kind, needsConfirm,
        strengths: Object.entries(b.strengths).map(([x, n]) => n > 1 ? `${x} (${n})` : x).join('، '),
        additionalNotes: b.other.join('، '),
        posCount: Object.values(b.strengths).reduce((a, n) => a + n, 0),
        negCount: Object.values(b.neg).reduce((a, n) => a + n, 0)
      };
    });
  }

  /* ---------- ملف classBatch بصيغة مرصاد ---------- */
  function buildBatch(o) {
    const m = String(o.className || '').match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!m || !o.rows || !o.rows.length) return null;
    const [, grade, section] = m;
    const subject = String(o.subject || '').split('،')[0].trim();
    const code = SUBJECT_CODES[subject] || 'SUBJ';
    const now = new Date();
    const statements = {};
    CODES.forEach(c => statements[c] = { ar: STATEMENTS[c][0], en: STATEMENTS[c][1] });
    const batch = {
      schemaVersion: '2.0', app: 'Marsad', type: 'classBatch',
      batchId: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'nj-' + Date.now() + Math.random()),
      exportedAt: now.toISOString(), exportedAtLocal: now.toLocaleString('en-GB', { hour12: false }), formLanguage: 'ar',
      source: { app: 'nojoom', note: 'مولّد من نجوم مدرستي (ملاحظات + استنتاج من البيانات + مراجعة المعلم)', from: o.from || '', to: o.to || '', file: o.file || '', reviewed: !!o.reviewed },
      teacher: { name: o.teacherName || '' }, subject: { name: subject, code },
      class: { grade, section, classCode: grade + '-' + section },
      scale: { note: 'answers are observation-frequency choices (never / sometimes / always), not a grade or a diagnosis.',
               values: [{ key: 'never', level: 0, labelAr: 'لا يظهر', labelEn: 'Not observed' }, { key: 'sometimes', level: 2, labelAr: 'أحياناً', labelEn: 'Sometimes' }, { key: 'always', level: 4, labelAr: 'دائماً', labelEn: 'Always' }] },
      statements,
      students: o.rows.map(r => ({
        id: r.sid || '', name: r.name, sourceEntry: r.sid ? `${r.name} (${r.sid})` : r.name,
        status: 'done', updatedAt: now.toISOString(), answers: r.answers, followUp: {},
        strengths: r.strengths || '', additionalNotes: r.additionalNotes || ''
      })),
      totals: { roster: o.rows.length, enteredStudents: o.rows.length, notObserved: 0, incomplete: 0, missingNames: [] }
    };
    const safeT = String(o.teacherName || 'teacher').replace(/[\\/:*?"<>|\s]+/g, '_');
    return { name: `${grade}${section}_${code}_${safeT}.json`, text: JSON.stringify(batch, null, 2), batch };
  }

  /* ---------- ZIP بدون ضغط (أسماء عربية UTF-8) ---------- */
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
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  return { STATEMENTS, CODES, SHORT, SUBJECT_CODES, TEXT_CODE, POS_GROUPS, DEDUCT_REASONS, DEF, LABEL, RANK, LV,
           posGroupOf, noteCode, toISO, studentKey, analyzeClass, buildBatch, makeZip, download };
})();
