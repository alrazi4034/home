/* 16-qr-zoom.js — تكبير الـ QR بالضغط عليه (ملء الشاشة) */

/* ===== تكبير الـ QR بالضغط عليه (ملء الشاشة) وإرجاعه بالضغط مرة ثانية ===== */
function qrCloseFull(){ var o=document.getElementById('qr-full-ov'); if(o) o.remove(); }
document.addEventListener('click', function(e){
  var t = e.target;
  if(!t || !t.matches) return;
  if(t.matches('img[src*="api.qrserver.com"]') && !t.closest('#qr-full-ov')){
    e.preventDefault(); e.stopPropagation();
    qrCloseFull();
    var ov = document.createElement('div');
    ov.id = 'qr-full-ov';
    ov.title = 'اضغط للعودة للحجم الطبيعي';
    ov.innerHTML = '<img alt="QR" src="' + t.src.replace(/size=\d+x\d+/, 'size=800x800') + '">';
    ov.addEventListener('click', qrCloseFull);
    document.body.appendChild(ov);
  }
}, true);
document.addEventListener('keydown', function(e){ if(e.key === 'Escape') qrCloseFull(); });
