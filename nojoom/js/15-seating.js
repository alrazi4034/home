/* 15-seating.js — تاب أنماط الجلوس */

/* ===================== 🪑 تاب أنماط الجلوس ===================== */
const SX = { type:'classroom', swap:false, sel:null, excludeAbsent:true, zoom:{classroom:1, lab:0.6}, undo:[] };

function sxEsc(t){ return String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function sxCls(){ return state.classes.find(c=>c.id===state.activeClass) || state.classes[0] || null; }
function sxStore(){ if(!state.seating || typeof state.seating!=='object') state.seating={}; return state.seating; }
function sxDefault(type){
  return type==='lab' ? {layout:'u', seats:[], built:false}
                      : {layout:'pairs', rows:7, cols:4, groupSizes:[], seats:[], built:false};
}
function sxSlot(cls,type){
  const st=sxStore();
  if(!st[cls.name]) st[cls.name]={};
  if(!st[cls.name][type]) st[cls.name][type]=sxDefault(type);
  return st[cls.name][type];
}
function sxShuffleArr(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function sxIsGroups(slot){ return typeof slot.layout==='string' && slot.layout[0]==='g'; }

/* ---------- الهندسة والسعة ---------- */
function sxSizes(n,size){
  if(n<=0) return [];
  const g=Math.ceil(n/size), base=Math.floor(n/g), extra=n%g, out=[];
  for(let k=0;k<g;k++) out.push(base+(k<extra?1:0));
  return out;
}
function sxCapacity(slot,type){
  if(type==='lab') return 30;
  if(sxIsGroups(slot)) return (slot.groupSizes||[]).reduce((a,b)=>a+b,0);
  return (slot.rows||7)*(slot.cols||4);
}
function sxGeom(slot,type,n){
  if(type==='lab'){ slot.layout='u'; return 30; }
  if(!sxIsGroups(slot)){
    slot.rows=Math.max(1,slot.rows||7); slot.cols=Math.max(1,slot.cols||4);
    if(n>slot.rows*slot.cols) slot.rows=Math.min(20,Math.ceil(n/slot.cols));
    return slot.rows*slot.cols;
  }
  const size=parseInt(slot.layout.slice(1))||4;
  slot.groupSizes=sxSizes(n,size);
  return n;
}
/* مواقع الجيران (لتقييم التنوع) */
function sxEdges(slot,type){
  const E=[];
  if(type==='lab'){
    for(let i=0;i<29;i++) E.push([i,i+1,1]);
    for(let i=0;i<12;i++) E.push([i,29-i,0.3]);
    return E;
  }
  if(sxIsGroups(slot)){
    let off=0;
    (slot.groupSizes||[]).forEach(sz=>{
      for(let a=0;a<sz;a++) for(let b=a+1;b<sz;b++) E.push([off+a,off+b,1.5]);
      off+=sz;
    });
    return E;
  }
  const R=slot.rows,C=slot.cols,pairs=slot.layout==='pairs';
  for(let r=0;r<R;r++) for(let c=0;c<C;c++){
    const i=r*C+c;
    if(c+1<C) E.push([i,i+1, pairs ? (c%2===0?2:0.6) : 1]);
    if(r+1<R) E.push([i,i+C, pairs?0.8:1]);
  }
  return E;
}

/* ---------- الخلط الذكي ---------- */
function sxPct(pool){
  const arr=pool.slice().sort((a,b)=>(b.points||0)-(a.points||0));
  const pct={}, n=arr.length; let i=0;
  while(i<n){
    let j=i; while(j+1<n && (arr[j+1].points||0)===(arr[i].points||0)) j++;
    const avg=(i+j)/2;
    for(let k=i;k<=j;k++) pct[arr[k].id]= n>1 ? avg/(n-1) : 0;
    i=j+1;
  }
  return pct;
}
function sxOptimize(order,pct,edges,iters){
  const n=order.length, adj=Array.from({length:n},()=>[]);
  edges.forEach(([a,b,w])=>{ if(a<n&&b<n){ adj[a].push([b,w]); adj[b].push([a,w]); } });
  const idx=[]; order.forEach((s,i)=>{ if(s) idx.push(i); });
  if(idx.length<2) return order;
  const sc=(a,b)=>Math.min(Math.abs(a-b),0.6);
  const loc=i=>{ const vi=pct[order[i].id]; let t=0; for(const [j,w] of adj[i]){ if(order[j]) t+=w*sc(vi,pct[order[j].id]); } return t; };
  for(let t=0;t<iters;t++){
    const i=idx[Math.floor(Math.random()*idx.length)], j=idx[Math.floor(Math.random()*idx.length)];
    if(i===j) continue;
    const before=loc(i)+loc(j);
    let x=order[i]; order[i]=order[j]; order[j]=x;
    if(loc(i)+loc(j)<before){ x=order[i]; order[i]=order[j]; order[j]=x; }
  }
  return order;
}

function sxSnap(){
  const cls=sxCls(); if(!cls) return;
  SX.undo.push(JSON.stringify(sxSlot(cls,SX.type)));
  if(SX.undo.length>30) SX.undo.shift();
}
function sxUndo(){
  const cls=sxCls(); if(!cls||!SX.undo.length) return;
  const snap=JSON.parse(SX.undo.pop());
  const st=sxStore(); st[cls.name][SX.type]=snap;
  SX.sel=null; save(); sxRenderAll(); toast('تم التراجع','↩️');
}

function sxBuild(smart,silent,noSnap){
  const cls=sxCls(); if(!cls) return;
  const type=SX.type, slot=sxSlot(cls,type);
  let pool=cls.students.filter(s=>!SX.excludeAbsent || s._todayAtt!=='absent');
  if(!noSnap && slot.built) sxSnap();
  slot.built=true;
  if(!pool.length){
    slot.seats=[]; if(sxIsGroups(slot)) slot.groupSizes=[];
    SX.sel=null; save(); sxRenderAll();
    if(!silent) toast('لا يوجد طلاب لتوزيعهم','⚠️');
    return;
  }
  const total=pool.length;
  const cap=sxGeom(slot,type,pool.length);
  let trimmed=0;
  if(pool.length>cap){ trimmed=pool.length-cap; pool=sxShuffleArr(pool).slice(0,cap); }
  const pct=sxPct(pool), edges=sxEdges(slot,type);
  let order=new Array(cap).fill(null);

  if(sxIsGroups(slot)){
    const sizes=slot.groupSizes, groups=sizes.map(()=>[]);
    const list = smart
      ? pool.map(s=>({s,k:pct[s.id]+(Math.random()-0.5)*0.12})).sort((a,b)=>a.k-b.k).map(o=>o.s)
      : sxShuffleArr(pool);
    let g=0, dir=1;
    const step=()=>{ g+=dir; if(g>=sizes.length){ g=sizes.length-1; dir=-1; } else if(g<0){ g=0; dir=1; } };
    list.forEach(s=>{
      let guard=0;
      while(groups[g].length>=sizes[g] && guard++<sizes.length*3) step();
      groups[g].push(s); step();
    });
    order=[].concat(...groups);
  } else {
    const idxs = type==='lab'
      ? sxShuffleArr([...Array(cap).keys()]).slice(0,pool.length).sort((a,b)=>a-b)
      : [...Array(pool.length).keys()];
    const list=sxShuffleArr(pool);
    idxs.forEach((p,k)=>{ order[p]=list[k]; });
  }
  if(smart) sxOptimize(order,pct,edges,250*cap+2000);

  slot.seats=order.map(s=>s?{id:s.id,name:s.name}:null);
  SX.sel=null; save(); sxRenderAll();
  if(!silent){
    toast(smart?'🎲 تم الخلط الذكي حسب النقاط':'🔀 تم الخلط العشوائي','🪑');
    if(trimmed) setTimeout(()=>toast(`${trimmed} طالب لم يجدوا مقعداً (السعة ${cap}) — موجودون في قائمة غير الموزَّعين`,'⚠️'),900);
  }
}

/* ---------- مطابقة المقاعد مع الطلاب الحاليين ---------- */
function sxReconcile(cls,slot,type){
  const cap=sxCapacity(slot,type);
  let seats=Array.isArray(slot.seats)?slot.seats.slice(0,cap):[];
  while(seats.length<cap) seats.push(null);
  const used=new Set();
  seats=seats.map(r=>{
    if(!r) return null;
    const s=cls.students.find(x=>x.id===r.id) || cls.students.find(x=>x.name===r.name);
    if(!s || used.has(s.id)) return null;
    used.add(s.id); return {id:s.id,name:s.name};
  });
  slot.seats=seats; return used;
}

/* ---------- التبديل / النقل ---------- */
function sxToggleSwap(){
  SX.swap=!SX.swap; SX.sel=null; sxRenderAll();
  toast(SX.swap?'وضع التبديل مفعّل: اضغط الطالب الأول ثم الثاني':'تم إيقاف وضع التبديل','🔄');
}
function sxPick(i){
  const cls=sxCls(); if(!cls) return;
  const slot=sxSlot(cls,SX.type), sel=SX.sel;
  if(!sel){
    if(!slot.seats[i]){ toast('اضغط 🔄 على بطاقة طالب أولاً','⚠️'); return; }
    SX.sel={k:'seat',i}; sxRenderAll(); return;
  }
  if(sel.k==='seat'){
    if(sel.i===i){ SX.sel=null; sxRenderAll(); return; }
    sxSwapSeats(sel.i,i);
  } else if(sel.k==='pool'){
    sxPlaceFromPool(sel.id,i);
  }
}
function sxSwapSeats(a,b){
  const cls=sxCls(); const slot=sxSlot(cls,SX.type);
  if(a===b) return;
  sxSnap();
  const t=slot.seats[a]; slot.seats[a]=slot.seats[b]; slot.seats[b]=t;
  SX.sel=null; save(); sxRenderAll();
  toast(t && slot.seats[a] ? 'تم التبديل بين الطالبين' : 'تم نقل الطالب','🔁');
}
function sxPlaceFromPool(id,i){
  const cls=sxCls(); const slot=sxSlot(cls,SX.type);
  const s=cls.students.find(x=>x.id===id); if(!s) return;
  sxSnap();
  slot.seats[i]={id:s.id,name:s.name};
  SX.sel=null; save(); sxRenderAll();
  toast(`تم تجليس ${s.name}`,'🪑');
}
function sxPickPool(id){
  if(SX.sel && SX.sel.k==='seat'){
    // طالب محدد على مقعد ثم ضغط طالباً غير موزَّع => استبدال
    const cls=sxCls(); const slot=sxSlot(cls,SX.type);
    sxPlaceFromPool(id,SX.sel.i); return;
  }
  SX.sel = (SX.sel&&SX.sel.k==='pool'&&SX.sel.id===id) ? null : {k:'pool',id};
  sxRenderAll();
}
function sxUnseat(i){
  const cls=sxCls(); const slot=sxSlot(cls,SX.type);
  sxSnap(); slot.seats[i]=null; SX.sel=null; save(); sxRenderAll();
}
function sxDragStart(e,kind,val){ e.dataTransfer.setData('text/plain',kind+':'+val); e.dataTransfer.effectAllowed='move'; }
function sxDrop(e,i){
  e.preventDefault(); e.stopPropagation();
  const d=(e.dataTransfer.getData('text/plain')||'').split(':');
  if(d[0]==='seat') sxSwapSeats(parseInt(d[1]),i);
  else if(d[0]==='pool') sxPlaceFromPool(parseInt(d[1]),i);
}

/* ---------- أزرار الطالب على الطاولة ---------- */
function sxStu(id){ const cls=sxCls(); return cls ? cls.students.find(s=>s.id===id) : null; }
function sxDay(s){
  const log=s.pointsLog||[];
  const p=log.find(e=>e.date===sessionDate && e.type==='participation');
  const d=log.find(e=>e.date===sessionDate && e.type==='deduct');
  return {
    part:(p?p.pts:0)+((s._dailyPart||{})[sessionDate]||0),
    ded:(d?Math.abs(d.pts):0)+((s._dailyDeduct||{})[sessionDate]||0)
  };
}
function sxAtt(id){
  const cls=sxCls(); const s=sxStu(id); if(!s) return;
  const cur=s._todayAtt||'unmarked';
  s._todayAtt = cur==='unmarked' ? 'present' : cur==='present' ? 'absent' : 'unmarked';
  if (s._todayAtt !== 'present') s._todayLate = false;
  save(); updateSessionSummary(cls); sxRenderAll();
}
function sxPart(id){ const cls=sxCls(); if(!sxStu(id)) return; addParticipation(cls.id,id); sxRenderAll(); }
function sxDed(id){ const cls=sxCls(); if(!sxStu(id)) return; subtractPoint(cls.id,id); sxRenderAll(); }
function sxNote(id){
  const s=sxStu(id); if(!s) return;
  showAddNoteModal(id,s.name,s.parentPhone||'',()=>{ refreshAllPointsUI(id); sxRenderAll(); });
}
function sxAllPresent(){ markAllPresent(); sxRenderAll(); }
function sxSaveSession(){ saveSession(); sxRenderAll(); }

/* ---------- إعدادات النمط ---------- */
function sxSetClass(id){
  state.activeClass=id; SX.sel=null; SX.undo=[]; save();
  renderClassTabs(); renderStudentList(); sxRenderAll();
}
function sxSetType(t){ SX.type=t; SX.sel=null; SX.undo=[]; sxRenderAll(); }
function sxSetLayout(l){
  const cls=sxCls(); const slot=sxSlot(cls,SX.type);
  if(slot.layout===l) return;
  sxSnap(); slot.layout=l;
  sxBuild(true,true,true);
  toast('تم تغيير النمط وإعادة التوزيع — يمكنك التراجع ↩️','🪑');
}
function sxResize(dr,dc){
  const cls=sxCls(); const slot=sxSlot(cls,SX.type);
  const R=slot.rows, C=slot.cols;
  const nR=Math.min(20,Math.max(1,R+dr)), nC=Math.min(10,Math.max(1,C+dc));
  if(nR===R && nC===C) return;
  sxSnap();
  const old=slot.seats||[], seats=new Array(nR*nC).fill(null);
  for(let r=0;r<Math.min(R,nR);r++) for(let c=0;c<Math.min(C,nC);c++) seats[r*nC+c]=old[r*C+c]||null;
  slot.rows=nR; slot.cols=nC; slot.seats=seats;
  SX.sel=null; save(); sxRenderAll();
}
function sxToggleAbsent(v){ SX.excludeAbsent=!!v; }
function sxZoom(d){
  SX.zoom[SX.type]=Math.min(1.5,Math.max(0.4,Math.round((SX.zoom[SX.type]+d)*100)/100));
  const st=document.getElementById('sx-stage'); if(st) st.style.zoom=SX.zoom[SX.type];
  const z=document.getElementById('sx-zoomval'); if(z) z.textContent=Math.round(SX.zoom[SX.type]*100)+'%';
}
function sxClear(){
  const cls=sxCls(); const slot=sxSlot(cls,SX.type);
  if(!confirm('تفريغ جميع المقاعد؟ (يمكنك التراجع بعدها)')) return;
  sxSnap(); slot.seats=new Array(sxCapacity(slot,SX.type)).fill(null);
  SX.sel=null; save(); sxRenderAll();
}
function sxSaveLayout(){
  const cls=sxCls(); if(!cls) return;
  save();
  toast(`تم حفظ مخطط ${SX.type==='lab'?'المختبر':'القاعة الصفية'} للصف ${cls.name}`,'💾');
}
function sxPrint(){
  const cls=sxCls();
  const t=document.getElementById('sx-print-title');
  if(t && cls) t.textContent=`مخطط ${SX.type==='lab'?'مختبر الحاسوب':'الجلوس الصفي'} — الصف ${cls.name}`;
  document.body.classList.add('sx-printing');
  setTimeout(()=>{ window.print(); setTimeout(()=>document.body.classList.remove('sx-printing'),600); },120);
}

/* ---------- الرسم ---------- */
function sxSeatHTML(i,ref,cls,type){
  if(!ref){
    return `<div class="sx-seat empty ${SX.sel?'can-drop':''}" onclick="sxPick(${i})" ondragover="event.preventDefault()" ondrop="sxDrop(event,${i})"><span>＋ مقعد فارغ</span>${type==='lab'?`<small>🖥️ ${i+1}</small>`:''}</div>`;
  }
  const s=cls.students.find(x=>x.id===ref.id); if(!s) return '';
  const att=s._todayAtt||'unmarked', d=sxDay(s);
  const notes=s.behaviorNotes||[], last=notes[notes.length-1];
  const noteCls=last ? (last.type==='negative'?'neg':'pos') : '';
  const sel=SX.sel&&SX.sel.k==='seat'&&SX.sel.i===i;
  const attIcon=att==='present'?'✅':att==='absent'?'❌':'○';
  return `<div class="sx-seat ${att} ${sel?'sel':''}" draggable="true" ondragstart="sxDragStart(event,'seat',${i})" ondragover="event.preventDefault()" ondrop="sxDrop(event,${i})">
    <div class="sx-top">
      <button class="sx-sw ${sel?'on':''}" onclick="event.stopPropagation();sxPick(${i})" title="${sel?'إلغاء الاختيار':'تبديل — اضغط هنا ثم اضغط 🔄 طالب آخر'}">🔄</button>
      ${type==='lab'?`<span class="sx-no">🖥️${i+1}</span>`:''}
      <span class="sx-name">${sxEsc(s.name)}</span>
      <span class="sx-pts" title="مجموع النقاط">⭐${s.points||0}</span>
    </div>
    <div class="sx-ctl">
      <button class="sx-b att ${att}" onclick="sxAtt(${s.id})" title="الحضور — اضغط للتغيير">${attIcon}</button>
      <button class="sx-b part" onclick="sxPart(${s.id})" title="مشاركة +1 (مشاركات اليوم)">✋ <b>${d.part}</b></button>
      <button class="sx-b ded" onclick="sxDed(${s.id})" title="خصم نقطة (خصومات اليوم)">➖ <b>${d.ded}</b></button>
      <button class="sx-b note ${noteCls}" onclick="sxNote(${s.id})" title="${sxEsc(last?last.text:'إضافة ملاحظة')}">📝${notes.length?` <b>${notes.length}</b>`:''}</button>
    </div>
    <button class="sx-x" onclick="sxUnseat(${i})" title="إخراج من المقعد">✕</button>
  </div>`;
}

function sxStageHTML(cls,slot,type){
  const seat=i=>sxSeatHTML(i,slot.seats[i],cls,type);
  const front=`<div class="sx-front"><div class="sx-bb"><span>السبورة</span></div><div class="sx-tray"></div></div>`;
  let body='';
  if(type==='lab'){
    let cells='';
    for(let i=0;i<30;i++){
      let r,c;
      if(i<12){ r=i+1; c=1; } else if(i<18){ r=12; c=i-12+2; } else { r=12-(i-18); c=8; }
      cells+=`<div class="sx-desk" style="grid-row:${r};grid-column:${c}">${seat(i)}</div>`;
    }
    cells+=`<div class="sx-teacher" style="grid-row:1 / 4;grid-column:2 / 8">🧑‍🏫 مكتب المعلم</div>`;
    body=`<div class="sx-lab">${cells}</div>`;
  } else if(sxIsGroups(slot)){
    let off=0;
    body='<div class="sx-groups">'+(slot.groupSizes||[]).map((sz,g)=>{
      let seats='', tot=0, cnt=0;
      for(let k=0;k<sz;k++){
        const i=off+k, ref=slot.seats[i];
        seats+=seat(i);
        if(ref){ const s=cls.students.find(x=>x.id===ref.id); if(s){ tot+=(s.points||0); cnt++; } }
      }
      off+=sz;
      return `<div class="sx-gtable"><div class="sx-gtitle">مجموعة ${g+1} <small>· ${cnt} طلاب · متوسط ⭐${cnt?Math.round(tot/cnt):0}</small></div><div class="sx-ggrid">${seats}</div></div>`;
    }).join('')+'</div>';
  } else {
    const R=slot.rows, C=slot.cols, pairs=slot.layout==='pairs';
    let rows='';
    for(let r=0;r<R;r++){
      let desks='';
      if(pairs){
        for(let c=0;c<C;c+=2){
          let s=seat(r*C+c); if(c+1<C) s+=seat(r*C+c+1);
          desks+=`<div class="sx-desk">${s}</div>`;
        }
      } else {
        for(let c=0;c<C;c++) desks+=`<div class="sx-desk">${seat(r*C+c)}</div>`;
      }
      rows+=`<div class="sx-rowline"><span class="sx-rowtag">${r+1}</span><div class="sx-desks ${pairs?'pairs':'single'}">${desks}</div></div>`;
    }
    body=`<div class="sx-rows">${rows}</div>`;
  }
  return front+body+`<div class="sx-back-label">— مؤخرة القاعة —</div>`;
}

function sxRenderAll(){
  const host=document.getElementById('sx-controls'); if(!host) return;
  const stage=document.getElementById('sx-stage'), pool=document.getElementById('sx-pool');
  const cls=sxCls();
  if(!cls){
    host.innerHTML='<div class="empty-state"><div class="icon">🏫</div><p>أضف صفاً أولاً من تبويب إدارة الصفوف</p></div>';
    stage.innerHTML=''; pool.innerHTML=''; return;
  }
  const type=SX.type, slot=sxSlot(cls,type);
  if(!slot.built && cls.students.length){ sxBuild(true,true,true); return; }
  const used=sxReconcile(cls,slot,type);
  const cap=sxCapacity(slot,type);
  const present=cls.students.filter(s=>s._todayAtt==='present').length;
  const absent=cls.students.filter(s=>s._todayAtt==='absent').length;
  const seated=used.size;

  const clsChips=state.classes.map(c=>`<button class="flt-btn ${c.id===cls.id?'flt-btn-on':''}" onclick="sxSetClass(${c.id})">🏫 ${sxEsc(c.name)} <span style="opacity:.7;font-size:11px">(${c.students.length})</span></button>`).join('');
  const typeChips=[['classroom','🏫 قاعة صفية'],['lab','💻 مختبر حاسوب (U)']].map(([k,l])=>`<button class="flt-btn ${type===k?'flt-btn-on':''}" onclick="sxSetType('${k}')">${l}</button>`).join('');
  let layoutLine='';
  if(type==='classroom'){
    const L=[['pairs','👥 ثنائيات'],['single','🧍 فردي متباعد'],['g4','مجموعات ٤'],['g5','مجموعات ٥'],['g6','مجموعات ٦']];
    const chips=L.map(([k,l])=>`<button class="flt-btn ${slot.layout===k?'flt-btn-on':''}" onclick="sxSetLayout('${k}')">${l}</button>`).join('');
    const steppers = sxIsGroups(slot) ? '' : `
      <span class="sx-lbl" style="min-width:auto;margin-right:8px">الصفوف</span>
      <span class="sx-step"><button onclick="sxResize(-1,0)">−</button><b>${slot.rows}</b><button onclick="sxResize(1,0)">＋</button></span>
      <span class="sx-lbl" style="min-width:auto">الأعمدة</span>
      <span class="sx-step"><button onclick="sxResize(0,-1)">−</button><b>${slot.cols}</b><button onclick="sxResize(0,1)">＋</button></span>`;
    layoutLine=`<div class="sx-line"><span class="sx-lbl">🧩 النمط</span>${chips}${steppers}</div>`;
  } else {
    layoutLine=`<div class="sx-line"><span class="sx-hint">نمط U: 12 جهازاً على كل جانب + 6 أجهزة في الخلف = 30 جهازاً. الأرقام تسير حول الحرف U من الأمام يساراً.</span></div>`;
  }
  host.innerHTML=`
    <div class="sx-line"><span class="sx-lbl">🏫 الصف</span>${clsChips}</div>
    <div class="sx-line"><span class="sx-lbl">📐 نوع المكان</span>${typeChips}</div>
    ${layoutLine}
    <div class="sx-line">
      <button class="sx-act pri" onclick="sxBuild(true)" title="يوزّع الطلاب بحيث يجلس بجانب كل طالب زملاء بمستويات نقاط مختلفة">🎲 خلط ذكي حسب النقاط</button>
      <button class="sx-act" onclick="sxBuild(false)">🔀 خلط عشوائي</button>
      <button class="sx-act" onclick="sxUndo()" ${SX.undo.length?'':'disabled'}>↩️ تراجع</button>
      <button class="sx-act red" onclick="sxClear()">🗑️ تفريغ</button>
      <button class="sx-act grn" onclick="sxSaveLayout()">💾 حفظ المخطط</button>
      <button class="sx-act" onclick="sxPrint()">🖨️ طباعة</button>
      <span class="sx-step"><button onclick="sxZoom(-0.1)" title="تصغير">−</button><b id="sx-zoomval" style="min-width:40px">${Math.round(SX.zoom[type]*100)}%</b><button onclick="sxZoom(0.1)" title="تكبير">＋</button></span>
    </div>
    <div class="sx-line">
      <label class="sx-chk"><input type="checkbox" ${SX.excludeAbsent?'checked':''} onchange="sxToggleAbsent(this.checked)"> استبعاد الغائبين عند الخلط</label>
      <button class="sx-act" onclick="sxAllPresent()">✅ حضور الكل</button>
      <button class="sx-act pri" onclick="sxSaveSession()" title="يثبّت الحضور والمشاركات والخصومات في سجل الحصة">💾 حفظ الحصة</button>
      <span class="sx-sum">📅 ${sxEsc(sessionDate)} · حاضر <b>${present}</b> · غائب <b>${absent}</b> · جالس <b>${seated}</b> / ${cap}</span>
    </div>
    ${SX.sel&&SX.sel.k==='seat'?`<div class="sx-swapbar">🔄 تم اختيار <b>${sxEsc((sxStu(slot.seats[SX.sel.i]&&slot.seats[SX.sel.i].id)||{name:''}).name)}</b> — اضغط 🔄 على الطالب الثاني (أو مقعداً فارغاً) للتبديل</div>`:''}
    <div class="sx-hint">لتبديل طالبين: اضغط 🔄 على بطاقة الأول ثم 🔄 على بطاقة الثاني (أو اسحب وأفلت). ✋ مشاركة · ➖ خصم (أرقام اليوم) · ✅ حضور · 📝 ملاحظة · ⭐ مجموع النقاط. تُحفظ تغييرات المخطط تلقائياً لكل صف ولكل نوع مكان.</div>`;

  if(!cls.students.length){
    stage.innerHTML='<div class="empty-state"><div class="icon">👤</div><p>لا يوجد طلاب في هذا الصف</p></div>';
  } else if(cap===0){
    stage.innerHTML='<div class="empty-state"><div class="icon">🪑</div><p>لا يوجد طلاب موزَّعون — اضغط «خلط ذكي»</p></div>';
  } else {
    stage.innerHTML=sxStageHTML(cls,slot,type);
  }
  stage.classList.toggle('sx-swapmode',SX.swap);
  stage.style.zoom=SX.zoom[type];

  const rest=cls.students.filter(s=>!used.has(s.id));
  pool.innerHTML=`<div class="sx-lbl" style="min-width:auto">🪑 غير موزَّعين على المقاعد (${rest.length})</div>`+
    (rest.length
      ? `<div class="sx-pool-chips">${rest.map(s=>`<button class="sx-chip ${s._todayAtt==='absent'?'abs':''} ${SX.sel&&SX.sel.k==='pool'&&SX.sel.id===s.id?'sel':''}" draggable="true" ondragstart="sxDragStart(event,'pool',${s.id})" onclick="sxPickPool(${s.id})">${sxEsc(s.name)}${s._todayAtt==='absent'?' ❌':''} <span style="opacity:.7">⭐${s.points||0}</span></button>`).join('')}</div>
         <div class="sx-hint" style="margin-top:8px">اضغط اسماً ثم مقعداً (فارغاً أو مشغولاً للاستبدال)، أو اسحبه إلى المقعد.</div>`
      : `<div class="sx-hint" style="margin-top:6px">جميع الطلاب موزَّعون ✅</div>`);
}
function sxInit(){ SX.sel=null; sxRenderAll(); }
