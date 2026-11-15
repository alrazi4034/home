/* shared/student-report.js — تقرير الطالب لولي الأمر (A4، جاهز للطباعة)
   مشترك بين نجوم مدرستي (مادة المعلم) ولوحة التحكم (كل المواد). */
const SRPT = (() => {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toISO = v => {
    if (!v) return '';
    const s = String(v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
  };
  const fmt = d => d ? d.slice(8) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '';
  const DAY = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const dayName = d => DAY[new Date(d + 'T12:00:00').getDay()];
  const bare = n => String(n || '').replace(/\s*\([^()]*\)\s*$/, '').trim();

  /* بيانات مادة واحدة من ملف نجوم مدرستي: cls (الصف كاملاً) + st (الطالب) + assessments */
  function fromNojoom(cls, st, assessments, o) {
    o = o || {};
    const inR = d => !!d && (!o.from || d >= o.from) && (!o.to || d <= o.to);
    const saved = (cls._savedDates || []).map(toISO).filter(inR);
    const S = new Set(saved);
    const absent = (st.absenceDates || []).map(toISO).filter(d => S.has(d));
    const late = (st.lateDates || []).map(toISO).filter(d => S.has(d) && !absent.includes(d));
    let part = 0;
    (st.pointsLog || []).forEach(e => { const d = toISO(e.date); if (e.type === 'participation' && inR(d)) part += (+e.pts || 0); });
    Object.entries(st._dailyPart || {}).forEach(([d, n]) => { if (inR(toISO(d))) part += (+n || 0); });
    const pos = [], neg = [];
    (st.behaviorNotes || []).forEach(n => {
      const d = toISO(n.isoDate) || toISO(n.date);
      if (d && !inR(d)) return;
      const t = String(n.text || '').trim(); if (!t || t === 'غير ذلك...') return;
      (n.type === 'positive' ? pos : neg).push({ text: t, date: d });
    });
    const grades = (assessments || []).filter(a => (a.classIds || []).includes(cls.id) && a.maxScore && (!a.date || inR(toISO(a.date))))
      .map(a => { const v = a.scores ? a.scores[st.id] ?? a.scores[String(st.id)] : undefined; return { name: a.name, max: +a.maxScore, score: v === '' || v == null || isNaN(parseFloat(v)) ? null : parseFloat(v), date: toISO(a.date) }; })
      .filter(g => g.score != null).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return { subject: o.subject || '', teacher: o.teacher || '', cls: cls.name, sessions: saved.length, absent, late, part, points: st.points || 0, pos, neg, grades };
  }

  const pct = (a, b) => b ? Math.round(a / b * 100) : null;
  function group(list) {     // [{text,date,subject}] ⇐ [{text, n, subjects}]
    const m = new Map();
    list.forEach(x => { const g = m.get(x.text) || { text: x.text, n: 0, subjects: new Set(), last: '' }; g.n++; if (x.subject) g.subjects.add(x.subject); if (x.date > g.last) g.last = x.date; m.set(x.text, g); });
    return [...m.values()].sort((a, b) => b.n - a.n);
  }

  /* r: {student:{name,sid,cls}, school:{name,principal}, from, to, subjects:[fromNojoom...], single:bool} */
  function html(r) {
    const S = r.subjects.filter(x => x.sessions || x.pos.length || x.neg.length || x.grades.length);
    const sessions = S.reduce((a, x) => a + x.sessions, 0), absN = S.reduce((a, x) => a + x.absent.length, 0);
    const att = pct(sessions - absN, sessions);
    const absDays = [...new Set(S.flatMap(x => x.absent))].sort();
    const lateN = S.reduce((a, x) => a + x.late.length, 0);
    const part = S.reduce((a, x) => a + x.part, 0);
    const pos = S.flatMap(x => x.pos.map(p => Object.assign({ subject: x.subject }, p)));
    const neg = S.flatMap(x => x.neg.map(p => Object.assign({ subject: x.subject }, p)));
    const allG = S.flatMap(x => x.grades.map(g => g.score / g.max * 100));
    const avgG = allG.length ? Math.round(allG.reduce((a, b) => a + b, 0) / allG.length) : null;
    const lvl = v => v == null ? '' : v >= 90 ? 'ممتاز' : v >= 80 ? 'جيد جداً' : v >= 65 ? 'جيد' : v >= 50 ? 'مقبول' : 'يحتاج دعماً';
    const col = v => v == null ? '#6b7280' : v >= 80 ? '#15803d' : v >= 65 ? '#2563eb' : v >= 50 ? '#b45309' : '#b91c1c';
    const kpi = (v, l, c, sub) => `<div class="k"><b style="color:${c || '#1e3a5f'}">${v}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const multi = !r.single && S.length > 1;
    const subjRow = x => {
      const a = pct(x.sessions - x.absent.length, x.sessions);
      const g = x.grades.length ? Math.round(x.grades.reduce((s, y) => s + y.score / y.max * 100, 0) / x.grades.length) : null;
      return `<tr><td class="n">${esc(x.subject || '—')}<small>${esc(x.teacher || '')}</small></td><td>${x.sessions ? `${a}%<small>${x.absent.length} غياب${x.late.length ? ' · ' + x.late.length + ' تأخر' : ''}</small>` : '—'}</td>
        <td>${x.part}</td><td class="ok">${x.pos.length}</td><td class="${x.neg.length ? 'warn' : ''}">${x.neg.length}</td><td style="color:${col(g)}">${g == null ? '—' : g + '%<small>' + lvl(g) + '</small>'}</td></tr>`;
    };
    const gp = group(pos), gn = group(neg);
    const noteList = (g, cls) => g.map(x => `<li class="${cls}"><span>${esc(x.text)}</span><em>${x.n > 1 ? '×' + x.n : ''}${multi && x.subjects.size ? ' · ' + [...x.subjects].map(esc).join('، ') : ''}</em></li>`).join('');
    const gradesHtml = S.filter(x => x.grades.length).map(x => `<div class="gs"><h4>${esc(x.subject || 'التقييمات')}</h4><table class="g"><tr>${x.grades.map(g => `<th>${esc(g.name)}${g.date ? `<small>${fmt(g.date).slice(0, 5)}</small>` : ''}</th>`).join('')}</tr><tr>${x.grades.map(g => `<td style="color:${col(g.score / g.max * 100)}">${g.score}<small>من ${g.max}</small></td>`).join('')}</tr></table></div>`).join('');
    const absList = absDays.map(d => { const subs = S.filter(x => x.absent.includes(d)).map(x => x.subject).filter(Boolean); return `<span class="ab">${dayName(d)} ${fmt(d).slice(0, 5)}${multi && subs.length ? ` <small>(${subs.map(esc).join('، ')})</small>` : ''}</span>`; }).join('');
    const today = new Date(); const tStr = fmt(new Date(today - today.getTimezoneOffset() * 6e4).toISOString().slice(0, 10));
    return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تقرير ${esc(bare(r.student.name))}</title>
<style>
@page{size:A4;margin:11mm}
*{box-sizing:border-box}body{font-family:Tajawal,'Segoe UI',Tahoma,sans-serif;color:#1f2937;margin:0;font-size:12.5px;line-height:1.6;background:#fff}
.hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #1e3a5f;padding-bottom:8px;margin-bottom:10px}
.hd h1{margin:0;font-size:22px;color:#1e3a5f}.hd .sc{font-size:12px;color:#475569}.hd .dt{text-align:left;font-size:11.5px;color:#475569}
.st{display:flex;gap:18px;flex-wrap:wrap;background:#f1f5f9;border-radius:10px;padding:9px 14px;margin-bottom:10px;font-size:13.5px}.st b{color:#0f172a}
.ks{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.k{border:1px solid #e2e8f0;border-radius:10px;padding:8px;text-align:center}.k b{display:block;font-size:22px;line-height:1.2}.k span{font-size:11.5px;color:#475569}.k small{display:block;font-size:10.5px;color:#64748b}
h3{font-size:14.5px;color:#1e3a5f;margin:12px 0 6px;border-right:4px solid #1e3a5f;padding-right:8px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:5px 6px;text-align:center}th{background:#f8fafc;font-size:11.5px;color:#334155}
td small,th small{display:block;font-size:10px;color:#64748b;font-weight:400}td.n{text-align:right;font-weight:700}
td.ok{color:#15803d;font-weight:700}td.warn{color:#b45309;font-weight:700}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
ul{list-style:none;margin:0;padding:0}li{display:flex;justify-content:space-between;gap:8px;border-radius:8px;padding:5px 9px;margin-bottom:4px}
li.p{background:#ecfdf5;border:1px solid #bbf7d0}li.m{background:#fffbeb;border:1px solid #fde68a}li em{font-style:normal;font-size:11px;color:#64748b;white-space:nowrap}
.empty{color:#64748b;font-size:12px;padding:6px}
.gs{margin-bottom:6px;break-inside:avoid}.gs h4{margin:4px 0;font-size:12.5px}table.g td{font-weight:800;font-size:13px}
.ab{display:inline-block;background:#fef2f2;border:1px solid #fecaca;border-radius:7px;padding:2px 8px;margin:2px;font-size:11.5px}
.sig{display:flex;justify-content:space-between;margin-top:26px;font-size:12px;color:#334155}.sig div{text-align:center;width:30%}.sig div i{display:block;border-top:1px solid #94a3b8;margin-top:28px;padding-top:4px;font-style:normal}
.note{font-size:10.5px;color:#64748b;margin-top:10px;text-align:center}
.tb{display:flex;justify-content:flex-start;gap:6px;margin:0 0 10px}.tb button{font-family:inherit;padding:7px 14px;border-radius:8px;border:1px solid #1e3a5f;background:#1e3a5f;color:#fff;cursor:pointer}
@media print{.tb{display:none}}
</style></head><body>
<div class="tb"><button onclick="print()">🖨️ طباعة / PDF</button></div>
<div class="hd"><div><h1>تقرير متابعة الطالب</h1><div class="sc">${esc(r.school && r.school.name || '')}${r.single && S[0] ? ' — مادة ' + esc(S[0].subject) : ''}</div></div>
  <div class="dt">الفترة: ${fmt(r.from) || '—'} — ${fmt(r.to) || '—'}<br>تاريخ التقرير: ${tStr}</div></div>
<div class="st"><span>الطالب: <b>${esc(bare(r.student.name))}</b></span><span>الصف: <b>${esc(r.student.cls || (S[0] && S[0].cls) || '')}</b></span>${r.student.sid ? `<span>رقم الطالب: <b>${esc(r.student.sid)}</b></span>` : ''}${multi ? `<span>المواد: <b>${S.length}</b></span>` : ''}</div>
<div class="ks">
  ${kpi(att == null ? '—' : att + '%', 'نسبة الحضور', att == null ? '' : att >= 95 ? '#15803d' : att >= 85 ? '#b45309' : '#b91c1c', `${absDays.length} يوم غياب${lateN ? ' · ' + lateN + ' تأخر' : ''}`)}
  ${kpi(part, 'مشاركة في الحصص', '#2563eb')}
  ${kpi(pos.length, 'ملاحظة إيجابية', '#15803d', neg.length ? neg.length + ' ملاحظة للمتابعة' : 'لا ملاحظات للمتابعة')}
  ${kpi(avgG == null ? '—' : avgG + '%', 'متوسط التقييمات', col(avgG), lvl(avgG))}
</div>
${multi ? `<h3>📚 ملخص المواد</h3><table><tr><th style="text-align:right">المادة</th><th>الحضور</th><th>المشاركات</th><th>إيجابية</th><th>للمتابعة</th><th>التقييمات</th></tr>${S.map(subjRow).join('')}</table>` : ''}
<div class="cols">
  <div><h3>🌟 نقاط القوة</h3>${gp.length ? `<ul>${noteList(gp, 'p')}</ul>` : '<div class="empty">لا توجد ملاحظات إيجابية مسجلة في هذه الفترة.</div>'}</div>
  <div><h3>📌 جوانب تحتاج متابعة</h3>${gn.length ? `<ul>${noteList(gn, 'm')}</ul>` : '<div class="empty">لا توجد ملاحظات تستدعي المتابعة 👏</div>'}</div>
</div>
${gradesHtml ? `<h3>📝 نتائج التقييمات</h3>${gradesHtml}` : ''}
${absDays.length ? `<h3>📅 أيام الغياب</h3><div>${absList}</div>` : ''}
<div class="sig"><div><i>${r.single ? 'معلم المادة' : 'المرشد الأكاديمي'}</i></div><div><i>إدارة المدرسة</i></div><div><i>ولي الأمر</i></div></div>
<div class="note">نشكر تعاونكم، ونأمل متابعة الطالب في المنزل وتعزيز نقاط قوته. — نجوم مدرستي</div>
</body></html>`;
  }
  function open(r) {
    const w = window.open('', '_blank');
    if (!w) { alert('اسمح بالنوافذ المنبثقة لعرض التقرير'); return; }
    w.document.write(html(r)); w.document.close();
  }
  return { fromNojoom, html, open, toISO, bare };
})();
if (typeof module !== 'undefined') module.exports = SRPT;
