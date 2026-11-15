/* 11-certificate.js — شهادات التقدير */

// ===== CERTIFICATE =====
function showCertificate(btn) {
  const studentId = parseInt(btn.dataset.sid);
  const rank = parseInt(btn.dataset.rank);
  let foundStudent = null, foundClass = null;
  for (const cls of state.classes) {
    const s = cls.students.find(st => st.id === studentId);
    if (s) { foundStudent = s; foundClass = cls; break; }
  }
  if (!foundStudent) return toast('لم يُعثر على الطالب', '⚠️');
  const s = foundStudent;
  const cls = foundClass;
  const info = getSchoolInfo();
  const schoolTitle = info.schoolName || document.getElementById('school-title').textContent;
  const subject     = info.subject || '';
  const teacher     = info.teacher || '';
  const principal   = info.principal || '';
  const today = new Date().toLocaleDateString('ar-EG',{ year: 'numeric', month: 'long', day: 'numeric',numberingSystem:'latn'});
  const rankLabel = rank === 1 ? 'المركز الأول' : rank === 2 ? 'المركز الثاني' : rank === 3 ? 'المركز الثالث' : `المركز ${rank}`;
  const total = (s.present||0) + (s.absent||0);
  const attPct = total > 0 ? Math.round((s.present/total)*100) : 0;

  // رسالة واتساب
  const waMsg = `شهادة تقدير\n\nتشهد إدارة ${schoolTitle}\nبأن الطالب/ة: *${s.name}*\nقد أحرز ${rankLabel} في مادة ${subject}\n\nالنقاط: ${s.points} | الحضور: ${attPct}%\n\nبتاريخ: ${today}\nتهانينا ونتمنى المزيد من التفوق.`;
  const waLink = s.parentPhone ? `https://wa.me/${s.parentPhone.replace(/\D/g,'')}?text=${encodeURIComponent(waMsg)}` : null;
  const waQrUrl = waLink ? `https://api.qrserver.com/v1/create-qr-code/?size=380x380&margin=10&data=${encodeURIComponent(waLink)}` : null;

  // بناء HTML الشهادة بحجم A4
  const certInnerHTML = buildCertHTML(s, cls, schoolTitle, subject, teacher, principal, today, rankLabel, attPct);

  openModal(`
    <div class="modal-title" style="margin-bottom:10px">🏅 شهادة تقدير — ${s.name}</div>
    <div style="border-radius:10px;border:2px solid rgba(200,150,12,0.4);background:linear-gradient(135deg,#f8f4e8,#fdf9ee);overflow:hidden;display:inline-flex;align-items:flex-start;justify-content:center;padding:4px;box-sizing:border-box">
      ${certInnerHTML}
    </div>
    <div class="modal-actions" style="flex-wrap:wrap;gap:8px;margin-top:12px">
      <button onclick="printCertificate()" class="btn btn-primary btn-sm">🖨️ طباعة / PDF</button>
      ${waLink ? `<button onclick="window.open('${waLink}','_blank')" class="btn btn-success btn-sm">📱 ارسال واتساب</button>` : ''}
      ${waQrUrl ? `<button onclick="showCertWaQR('${waQrUrl}')" class="btn btn-ghost btn-sm" style="color:#a29bfe;border-color:#a29bfe">📲 QR واتساب</button>` : ''}
      <button onclick="sendCertByEmail(${studentId})" class="btn btn-ghost btn-sm" style="color:#5fd8e8;border-color:#5fd8e8">📧 إيميل</button>
      <button class="btn btn-ghost btn-sm" onclick="closeModalForce()">إغلاق</button>
    </div>
  `);
  document.getElementById('modal-content')?.classList.add('cert-modal');
}

function buildCertHTML(s, cls, schoolTitle, subject, teacher, principal, today, rankLabel, attPct) {
  // الشهادة A4 أفقي: 1123×794
  // نعرضها بـ scale(0.34) داخل wrapper بالحجم المحسوب
  const CERT_W = 1123, CERT_H = 794, SCALE = 0.34;
  const dispW = Math.round(CERT_W * SCALE); // ~382px
  const dispH = Math.round(CERT_H * SCALE); // ~270px
  return `<div data-cert-wrap title="اضغط لعرض الشهادة بملء الشاشة" style="width:${dispW}px;height:${dispH}px;overflow:hidden;flex-shrink:0;position:relative;cursor:zoom-in">
  <div id="cert-preview" dir="rtl" style="
    width:${CERT_W}px; height:${CERT_H}px;
    background: linear-gradient(160deg, #fdfcf5 0%, #fffef7 35%, #faf6e8 65%, #fdf9ee 100%);
    border: 7px double #c8960c;
    padding: 0;
    text-align: center;
    font-family: Tajawal, sans-serif;
    position: absolute; top:0; right:0;
    box-sizing: border-box;
    display: flex; flex-direction: column; align-items: center; justify-content: space-between;
    transform-origin: top right;
    transform: scale(${SCALE});
    overflow: hidden;
  ">
    <!-- خلفية زخرفية خفيفة -->
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 20% 50%, rgba(200,150,12,0.05) 0%, transparent 55%),radial-gradient(ellipse at 80% 50%, rgba(180,120,20,0.05) 0%, transparent 55%);pointer-events:none"></div>
    <!-- زخارف الأركان -->
    <div style="position:absolute;top:18px;right:18px;width:62px;height:62px;border-top:5px solid #c8960c;border-right:5px solid #c8960c;opacity:0.85"></div>
    <div style="position:absolute;top:18px;left:18px;width:62px;height:62px;border-top:5px solid #c8960c;border-left:5px solid #c8960c;opacity:0.85"></div>
    <div style="position:absolute;bottom:18px;right:18px;width:62px;height:62px;border-bottom:5px solid #c8960c;border-right:5px solid #c8960c;opacity:0.85"></div>
    <div style="position:absolute;bottom:18px;left:18px;width:62px;height:62px;border-bottom:5px solid #c8960c;border-left:5px solid #c8960c;opacity:0.85"></div>
    <!-- إطار داخلي -->
    <div style="position:absolute;inset:32px;border:1.5px solid rgba(200,150,12,0.25);pointer-events:none"></div>

    <!-- الجزء العلوي: البسملة والعنوان -->
    <div style="padding:28px 70px 0;width:100%;box-sizing:border-box">
      <div style="font-size:13px;letter-spacing:6px;color:#a07010;opacity:0.85;margin-bottom:12px">بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ</div>
      <div style="font-size:46px;font-weight:900;color:#78350f;letter-spacing:4px;text-shadow:0 2px 10px rgba(120,53,15,0.15);line-height:1.1;margin-bottom:10px">شـهـادة تـقـديـر</div>
      <div style="width:280px;height:3px;background:linear-gradient(90deg,transparent,#c8960c,transparent);margin:0 auto 14px"></div>
      <div style="font-size:16px;color:#4a3728;font-weight:700;margin-bottom:4px">${schoolTitle}</div>
      ${principal ? `<div style="font-size:13px;color:#7a6a5a;margin-bottom:0">بإشراف: ${principal}</div>` : ''}
    </div>

    <!-- الجزء الأوسط: اسم الطالب والإنجاز -->
    <div style="padding:0 70px;width:100%;box-sizing:border-box">
      <div style="font-size:18px;color:#5a4a3a;margin-bottom:14px;line-height:1.6">تشهد إدارة المدرسة بأن الطالب/ة</div>
      <div style="font-size:42px;font-weight:900;color:#78350f;line-height:1.15;text-shadow:0 1px 8px rgba(120,53,15,0.18);margin-bottom:8px">${s.name}</div>
      <div style="font-size:18px;color:#a09080;font-weight:600;margin-bottom:18px">${cls ? cls.name : ''}</div>
      <div style="width:120px;height:2px;background:linear-gradient(90deg,transparent,rgba(120,53,15,0.25),transparent);margin:0 auto 18px"></div>
      <div style="font-size:20px;color:#3a2a1a;margin-bottom:10px;line-height:1.6">قد أحرز <strong style="color:#b45309;font-size:22px">${rankLabel}</strong></div>
      <div style="font-size:20px;color:#4a3a2a;margin-bottom:22px;line-height:1.6">في مادة <strong style="color:#1a0f00;font-size:22px">${subject || 'التدريس'}</strong></div>
      <!-- إحصائيات -->
      <div style="display:flex;justify-content:center;gap:40px;background:rgba(200,150,12,0.07);border:1.5px solid rgba(200,150,12,0.2);border-radius:18px;padding:16px 55px;display:inline-flex">
        <div style="text-align:center">
          <div style="font-size:34px;font-weight:900;color:#b45309;line-height:1">${s.points}</div>
          <div style="font-size:12px;color:#8a7a6a;margin-top:5px;font-weight:600">النقاط</div>
        </div>
        <div style="width:1.5px;background:rgba(120,53,15,0.18);margin:4px 0"></div>
        <div style="text-align:center">
          <div style="font-size:34px;font-weight:900;color:#0a7060;line-height:1">${attPct}%</div>
          <div style="font-size:12px;color:#8a7a6a;margin-top:5px;font-weight:600">الحضور</div>
        </div>
        <div style="width:1.5px;background:rgba(120,53,15,0.18);margin:4px 0"></div>
        <div style="text-align:center">
          <div style="font-size:34px;font-weight:900;color:#5b21b6;line-height:1">${s.participation}</div>
          <div style="font-size:12px;color:#8a7a6a;margin-top:5px;font-weight:600">مشاركة</div>
        </div>
      </div>
    </div>

    <!-- الجزء السفلي: التوقيعات والتاريخ -->
    <div style="padding:0 70px 22px;width:100%;box-sizing:border-box;margin-top:auto">
      <div style="display:flex;justify-content:space-between;width:100%;margin-bottom:18px">
        <div style="text-align:center;min-width:160px">
          <div style="width:140px;height:1.5px;background:rgba(120,53,15,0.3);margin:0 auto 10px"></div>
          <div style="font-size:13px;color:#7a6a5a;font-weight:600">مدير/ة المدرسة</div>
          ${principal ? `<div style="font-size:12px;color:#5a4a3a;margin-top:5px;font-weight:700">${principal}</div>` : ''}
        </div>
        <div style="text-align:center;min-width:160px">
          <div style="width:140px;height:1.5px;background:rgba(120,53,15,0.3);margin:0 auto 10px"></div>
          <div style="font-size:13px;color:#7a6a5a;font-weight:600">المعلم</div>
          ${teacher ? `<div style="font-size:12px;color:#5a4a3a;margin-top:5px;font-weight:700">${teacher}</div>` : ''}
        </div>
      </div>
      <div style="border-top:1.5px solid rgba(200,150,12,0.22);padding-top:12px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:12px;color:#b0a090">مادة: ${subject||'—'} | معلم: ${teacher||'—'}</div>
        <div style="font-size:11px;color:#b0a090">تاريخ الإصدار: ${today} | صدرت بواسطة برنامج نجوم مدرستي</div>
      </div>
    </div>
  </div>
  </div>`; // end cert-preview + outer wrapper
}

function showCertWaQR(qrUrl) {
  openModal(`
    <div class="modal-title">QR واتساب — شهادة التقدير</div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">امسح الكود لإرسال رسالة الشهادة لولي الأمر</p>
    <div style="text-align:center;margin-bottom:14px">
      <img src="${qrUrl}" style="border-radius:12px;border:3px solid #25d366;width:170px;height:170px"/>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModalForce()">اغلاق</button>
    </div>
  `);
}

function sendCertByEmail(studentId) {
  let s = null, cls = null;
  for (const c of state.classes) {
    const found = c.students.find(st => st.id === studentId);
    if (found) { s = found; cls = c; break; }
  }
  if (!s) return;

  // الأولوية: إيميل محفوظ → بريد الحساب الوزاري (إذا كان يحتوي @) → فارغ
  const govUser = s.govAccount?.user || '';
  const savedEmail = s.email || (govUser.includes('@') ? govUser : '');

  openModal(`
    <div class="modal-title">ارسال شهادة PDF بالإيميل</div>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px">
      سيتم فتح تطبيق البريد الإلكتروني مع رسالة جاهزة.<br>
      يمكنك طباعة الشهادة كـ PDF ثم إرفاقها.
    </p>
    <div class="form-group">
      <label class="form-label">البريد الإلكتروني للطالب / ولي الأمر</label>
      <input class="input" id="m-email" type="email" value="${savedEmail}" placeholder="stum202000000@moe.sch.ae" dir="ltr"/>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="doSendCertEmail(${studentId})">فتح البريد</button>
      <button class="btn btn-ghost" onclick="closeModalForce()">إلغاء</button>
    </div>
  `);
}

function doSendCertEmail(studentId) {
  const email = document.getElementById('m-email')?.value.trim();
  if (!email) return toast('أدخل البريد الإلكتروني', '⚠️');

  // حفظ الإيميل
  for (const c of state.classes) {
    const s = c.students.find(st => st.id === studentId);
    if (s) { s.email = email; save(); break; }
  }

  const info = getSchoolInfo();
  const schoolTitle = info.schoolName || document.getElementById('school-title').textContent;
  const subject = info.subject || '';
  const today = new Date().toLocaleDateString('ar-EG',{ year:'numeric', month:'long', day:'numeric',numberingSystem:'latn'});

  let s = null;
  for (const c of state.classes) { const f = c.students.find(st=>st.id===studentId); if(f){s=f;break;} }
  if (!s) return;

  const subject_line = encodeURIComponent(`شهادة تقدير - ${s.name}`);
  const body = encodeURIComponent(
    `شهادة تقدير\n\nتشهد إدارة ${schoolTitle}\nبأن الطالب/ة: ${s.name}\n\nالنقاط: ${s.points} | الحضور المسجل: ${s.present} يوم\n\nبتاريخ: ${today}\n\nملاحظة: يرجى فتح الشهادة من المرفق أو طباعتها من البرنامج.`
  );
  window.open(`mailto:${email}?subject=${subject_line}&body=${body}`, '_blank');
  closeModalForce();
  toast('تم فتح تطبيق البريد', '📧');
}

function printCertificate() {
  const cert = document.getElementById('cert-preview');
  if (!cert) return;
  const clone = cert.cloneNode(true);
  clone.style.transform = 'none';
  clone.style.margin = '0';
  clone.style.width = '297mm';
  clone.style.height = '210mm';
  clone.style.minHeight = '210mm';
  clone.style.padding = '15mm 20mm';
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
    <title>شهادة تقدير</title>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap" rel="stylesheet">
    <style>
      @page { size: A4 landscape; margin: 0; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; background: white; font-family: Tajawal, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      #cert-print { width:297mm; height:210mm; }
    </style>
    </head><body>
    <div id="cert-print">${clone.outerHTML}</div>
    <script>
      window.onload = function() {
        const el = document.querySelector('#cert-print > div');
        if (el) el.style.cssText += ';transform:none!important;margin:0!important;width:297mm!important;height:210mm!important;min-height:210mm!important;padding:15mm 20mm!important;border-radius:0!important;border-width:5px!important;';
        setTimeout(()=>window.print(), 700);
      }
    <\/script></body></html>`);
  win.document.close();
}



/* ===== شهادة تقدير لملاحظة إيجابية ===== */
function showNoteCertificate(studentId, noteIdx) {
  let s = null, cls = null;
  for (const c of state.classes) { const x = c.students.find(st => st.id === studentId); if (x) { s = x; cls = c; break; } }
  if (!s) return toast('لم يُعثر على الطالب', '⚠️');
  const n = (s.behaviorNotes || [])[noteIdx];
  if (!n || n.type !== 'positive') return;
  const info = getSchoolInfo();
  const today = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', numberingSystem: 'latn' });
  const html = buildNoteCertHTML(s, cls, n, info, today);
  const waMsg = `شهادة تقدير 🌟\n\nيسعدنا إبلاغكم بأن الطالب: *${s.name.replace(/\s*\([^()]*\)\s*$/, '')}*\nحصل على شهادة تقدير في مادة ${info.subject || ''}\nتقديراً لـ: ${n.text}\n\n${info.schoolName || ''}`;
  const waLink = s.parentPhone ? `https://wa.me/${s.parentPhone.replace(/\D/g, '')}?text=${encodeURIComponent(waMsg)}` : null;
  openModal(`
    <div class="modal-title" style="margin-bottom:10px">🏅 شهادة تقدير — ${s.name}</div>
    <div style="border-radius:10px;border:2px solid rgba(46,125,110,0.4);background:#f2f8f5;overflow:hidden;display:inline-flex;align-items:flex-start;justify-content:center;padding:4px;box-sizing:border-box">${html}</div>
    <div class="modal-actions" style="flex-wrap:wrap;gap:8px;margin-top:12px">
      <button onclick="printCertificate()" class="btn btn-primary btn-sm">🖨️ طباعة / PDF</button>
      <button onclick="certFullscreen()" class="btn btn-ghost btn-sm">⛶ ملء الشاشة</button>
      ${waLink ? `<button onclick="window.open('${waLink}','_blank')" class="btn btn-success btn-sm">📱 ارسال واتساب</button>` : ''}
      <button class="btn btn-ghost btn-sm" onclick="closeModalForce()">إغلاق</button>
    </div>`);
  document.getElementById('modal-content')?.classList.add('cert-modal');
}

function buildNoteCertHTML(s, cls, note, info, today) {
  const CERT_W = 1123, CERT_H = 794, SCALE = 0.34;
  const name = String(s.name).replace(/\s*\([^()]*\)\s*$/, '');
  const ndate = note.date ? String(note.date) : '';
  const g = (window.MRS && MRS.posGroupOf) ? MRS.posGroupOf(note.text) : null;
  const icon = ((g ? g.t : String(note.text || '')).match(/^\p{Extended_Pictographic}/u) || [])[0] || '🌟';
  return `<div data-cert-wrap title="اضغط لعرض الشهادة بملء الشاشة" style="width:${Math.round(CERT_W * SCALE)}px;height:${Math.round(CERT_H * SCALE)}px;overflow:hidden;flex-shrink:0;position:relative;cursor:zoom-in">
  <div id="cert-preview" dir="rtl" style="width:${CERT_W}px;height:${CERT_H}px;position:absolute;top:0;right:0;box-sizing:border-box;transform-origin:top right;transform:scale(${SCALE});
    font-family:Tajawal,sans-serif;text-align:center;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:space-between;
    background:radial-gradient(circle at 85% 15%,rgba(46,160,130,.10),transparent 40%),radial-gradient(circle at 10% 90%,rgba(230,170,40,.12),transparent 45%),linear-gradient(160deg,#fbfdfb,#f3f9f6 55%,#fdfbf2);
    border:10px solid #1f6f5c;outline:3px solid #d8a72c;outline-offset:-22px">
    <div style="position:absolute;top:0;left:0;width:170px;height:170px;background:linear-gradient(135deg,#1f6f5c 0 50%,transparent 50%);opacity:.95"></div>
    <div style="position:absolute;bottom:0;right:0;width:170px;height:170px;background:linear-gradient(315deg,#1f6f5c 0 50%,transparent 50%);opacity:.95"></div>
    <div style="position:absolute;top:26px;left:26px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,#f6d36b,#d8a72c 70%);box-shadow:0 0 0 6px rgba(255,255,255,.7),0 6px 18px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;font-size:58px">${icon}</div>
    <div style="padding:46px 120px 0;width:100%;box-sizing:border-box;position:relative">
      <div style="font-size:14px;letter-spacing:6px;color:#2e7d6e;margin-bottom:8px">بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ</div>
      <div style="font-size:52px;font-weight:900;color:#1f6f5c;letter-spacing:3px;line-height:1.1">شهادة تقدير</div>
      <div style="font-size:18px;color:#a77d12;font-weight:800;margin-top:6px;letter-spacing:2px">✦ تميّز وسلوك إيجابي ✦</div>
      <div style="font-size:16px;color:#3c4a46;font-weight:700;margin-top:10px">${info.schoolName || ''}</div>
    </div>
    <div style="padding:0 120px;width:100%;box-sizing:border-box;position:relative">
      <div style="font-size:19px;color:#4a5a55;margin-bottom:10px">يسرّنا أن نقدّم هذه الشهادة للطالب</div>
      <div style="font-size:46px;font-weight:900;color:#13453a;line-height:1.15;margin-bottom:6px">${name}</div>
      <div style="font-size:17px;color:#7d8c87;font-weight:700;margin-bottom:16px">${cls ? 'الصف ' + cls.name : ''}${info.subject ? ' — مادة ' + info.subject : ''}</div>
      <div style="display:inline-block;background:#fff;border:2px solid #d8a72c;border-radius:18px;padding:16px 40px;box-shadow:0 4px 14px rgba(31,111,92,.12);max-width:760px">
        <div style="font-size:15px;color:#a77d12;font-weight:800;margin-bottom:4px">تقديراً لـ</div>
        <div style="font-size:30px;font-weight:900;color:#1f6f5c;line-height:1.35">${note.text}</div>
      </div>
      <div style="font-size:17px;color:#4a5a55;margin-top:14px">متمنّين له دوام التميّز والتألق 🌟</div>
    </div>
    <div style="padding:0 190px 58px;width:100%;box-sizing:border-box;display:flex;justify-content:space-between;align-items:flex-end;position:relative">
      <div style="text-align:center;min-width:180px"><div style="width:160px;height:1.5px;background:#1f6f5c;opacity:.4;margin:0 auto 8px"></div>
        <div style="font-size:13px;color:#5a6a65;font-weight:700">المعلم</div><div style="font-size:14px;color:#13453a;font-weight:800;margin-top:3px">${info.teacher || ''}</div></div>
      <div style="font-size:12px;color:#8a9a95">${ndate ? 'تاريخ الملاحظة: ' + ndate + ' | ' : ''}تاريخ الإصدار: ${today}<br>نجوم مدرستي</div>
      <div style="text-align:center;min-width:180px"><div style="width:160px;height:1.5px;background:#1f6f5c;opacity:.4;margin:0 auto 8px"></div>
        <div style="font-size:13px;color:#5a6a65;font-weight:700">مدير/ة المدرسة</div><div style="font-size:14px;color:#13453a;font-weight:800;margin-top:3px">${info.principal || ''}</div></div>
    </div>
  </div></div>`;
}

/* ===== عرض الشهادة بملء الشاشة (اضغط عليها، واضغط مرة ثانية للعودة) ===== */
function certCloseFull() { const o = document.getElementById('cert-full-ov'); if (o) o.remove(); }
function certFullscreen() {
  const cert = document.getElementById('cert-preview'); if (!cert) return;
  certCloseFull();
  const ov = document.createElement('div');
  ov.id = 'cert-full-ov'; ov.title = 'اضغط للعودة';
  ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;cursor:zoom-out';
  const k = Math.min(window.innerWidth * 0.97 / 1123, window.innerHeight * 0.97 / 794);
  const box = document.createElement('div');
  box.style.cssText = `width:${1123 * k}px;height:${794 * k}px;position:relative;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6)`;
  const clone = cert.cloneNode(true); clone.removeAttribute('id');
  clone.style.transform = `scale(${k})`; clone.style.transformOrigin = 'top right'; clone.style.right = '0'; clone.style.top = '0';
  box.appendChild(clone); ov.appendChild(box);
  ov.addEventListener('click', certCloseFull);
  document.body.appendChild(ov);
  try { ov.requestFullscreen && ov.requestFullscreen().catch(() => {}); } catch (e) {}
}
document.addEventListener('click', function (e) {
  const w = e.target && e.target.closest && e.target.closest('[data-cert-wrap]');
  if (w && !e.target.closest('#cert-full-ov')) { e.preventDefault(); e.stopPropagation(); certFullscreen(); }
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') certCloseFull(); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) certCloseFull(); });
