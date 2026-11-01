// Professional in-app document camera for vehicle documents.
// Uses the Capacitor 6 compatible camera-preview plugin. Supabase upload remains in cars.js.
const CameraPreviewPlugin=()=>((window.Capacitor||{}).Plugins||{}).CameraPreview||null;
let proCameraBlobUrl=null,proCameraFlash='off',proCameraModes=[];
function cameraOverlayHtml(){
  return `<section id="pro-camera" role="dialog" aria-modal="true" aria-label="كاميرا المستندات">
    <header class="pc-top"><button class="pc-icon" onclick="proCameraCancel()" aria-label="إغلاق">✕</button><span>تصوير مستند السيارة</span><button class="pc-icon" id="pc-flash" onclick="proCameraToggleFlash()" aria-label="الفلاش">⚡</button></header>
    <div class="pc-hint" id="pc-hint">ضع المستند داخل الإطار واجعل الهاتف موازيًا له</div>
    <div class="pc-guide" id="pc-guide"><i></i><i></i><i></i><i></i><div class="pc-guide-label">إطار المستند</div></div>
    <div class="pc-review" id="pc-review" hidden><img id="pc-review-img" alt="معاينة المستند"></div>
    <footer class="pc-bottom">
      <div class="pc-tools" id="pc-tools"><span>جودة عالية</span><span>•</span><span>محاذاة المستند</span><span>•</span><span>تقريب باللمس</span></div>
      <div class="pc-actions" id="pc-actions"><button class="pc-cancel" onclick="proCameraCancel()">إلغاء</button><button class="pc-shutter" id="pc-shutter" onclick="proCameraCapture()"><span></span></button><button class="pc-flip" onclick="proCameraFlip()">↻</button></div>
      <div class="pc-review-actions" id="pc-review-actions" hidden><button class="pc-cancel" onclick="proCameraRetake()">إعادة التصوير</button><button class="pc-accept" onclick="proCameraAccept()">استخدام الصورة</button></div>
      <div class="pc-status" id="pc-status">جارٍ تشغيل الكاميرا…</div>
    </footer>
  </section>`;
}
function proCameraSetStatus(s){const el=document.getElementById('pc-status');if(el)el.textContent=s}
async function proCameraStart(){
  const cp=CameraPreviewPlugin();if(!cp)throw new Error('إضافة الكاميرا الاحترافية غير مثبتة في هذا الإصدار');
  const root=document.getElementById('pro-camera');
  await cp.start({position:'rear',width:Math.round(window.innerWidth),height:Math.round(window.innerHeight),x:0,y:0,toBack:true,storeToFile:false,enableZoom:true,disableAudio:true,lockAndroidOrientation:false});
  try{const f=await cp.getSupportedFlashModes();proCameraModes=f.result||[]}catch{proCameraModes=[]}
  const flash=document.getElementById('pc-flash');if(flash)flash.hidden=!proCameraModes.length;
  proCameraSetStatus('حرّك الهاتف حتى يصبح المستند داخل الإطار');
  return true;
}
async function proCameraStop(){const cp=CameraPreviewPlugin();if(cp){try{await cp.stop()}catch{}}}
function proCameraCleanup(){
  document.body.classList.remove('cam-active');
  const el=document.getElementById('pro-camera');if(el)el.remove();
  if(proCameraBlobUrl){URL.revokeObjectURL(proCameraBlobUrl);proCameraBlobUrl=null}
  proCameraFlash='off';proCameraModes=[];
}
let proCameraResolve=null,proCameraBusy=false;
function captureDocumentImage(){
  const cp=CameraPreviewPlugin();
  if(!isNative()||!cp)return pickImage();
  if(proCameraResolve)return Promise.reject(new Error('الكاميرا مفتوحة بالفعل'));
  return new Promise(async(resolve)=>{
    proCameraResolve=resolve;proCameraBusy=false;
    document.body.insertAdjacentHTML('beforeend',cameraOverlayHtml());
    document.body.classList.add('cam-active');
    try{await proCameraStart()}catch(e){
      proCameraCleanup();proCameraResolve=null;
      // Keep the existing Capacitor camera as a safe fallback if the live preview is unavailable.
      try{resolve(await pickImage())}catch(err){toast(errMsg(err));resolve(null)}
    }
  });
}
async function proCameraCapture(){
  if(proCameraBusy)return;proCameraBusy=true;
  const cp=CameraPreviewPlugin(),btn=document.getElementById('pc-shutter');
  if(btn)btn.disabled=true;
  try{
    proCameraSetStatus('جارٍ التقاط الصورة بأعلى جودة…');
    const result=await cp.capture({quality:100});
    const raw=String(result.value||'').replace(/^data:image\\/[^;]+;base64,/,'');
    if(!raw)throw new Error('لم يتم التقاط صورة');
    const blob=b64ToBlob(raw,'image/jpeg');
    await proCameraStop();
    if(proCameraBlobUrl)URL.revokeObjectURL(proCameraBlobUrl);
    proCameraBlobUrl=URL.createObjectURL(blob);
    const img=document.getElementById('pc-review-img');img.src=proCameraBlobUrl;
    document.getElementById('pc-review').hidden=false;
    document.getElementById('pc-guide').hidden=true;
    document.getElementById('pc-tools').hidden=true;
    document.getElementById('pc-actions').hidden=true;
    document.getElementById('pc-review-actions').hidden=false;
    proCameraSetStatus('راجع وضوح الصورة قبل الحفظ');
  }catch(e){proCameraSetStatus('تعذر التصوير: '+(e.message||'حاول مرة أخرى'))}
  finally{proCameraBusy=false;if(btn)btn.disabled=false}
}
async function proCameraRetake(){
  document.getElementById('pc-review').hidden=true;
  document.getElementById('pc-guide').hidden=false;
  document.getElementById('pc-tools').hidden=false;
  document.getElementById('pc-actions').hidden=false;
  document.getElementById('pc-review-actions').hidden=true;
  if(proCameraBlobUrl){URL.revokeObjectURL(proCameraBlobUrl);proCameraBlobUrl=null}
  try{await proCameraStart()}catch(e){proCameraSetStatus('تعذر إعادة تشغيل الكاميرا: '+e.message)}
}
function proCameraAccept(){
  if(!proCameraBlobUrl||!proCameraResolve)return;
  fetch(proCameraBlobUrl).then(r=>r.blob()).then(blob=>{
    const done=proCameraResolve;proCameraResolve=null;proCameraCleanup();done(blob);
  }).catch(()=>proCameraSetStatus('تعذر تجهيز الصورة'));
}
async function proCameraCancel(){
  const done=proCameraResolve;proCameraResolve=null;
  await proCameraStop();proCameraCleanup();if(done)done(null);
}
async function proCameraToggleFlash(){
  const cp=CameraPreviewPlugin();if(!cp)return;
  const modes=proCameraModes;
  const next=proCameraFlash==='torch'?'off':(modes.includes('torch')?'torch':modes.includes('on')?'on':'off');
  try{await cp.setFlashMode(next);proCameraFlash=next;const b=document.getElementById('pc-flash');if(b)b.classList.toggle('active',next!=='off')}catch{proCameraSetStatus('الفلاش غير متاح على هذا الجهاز')}
}
async function proCameraFlip(){
  const cp=CameraPreviewPlugin();try{await cp.flip()}catch(e){proCameraSetStatus('تعذر تبديل الكاميرا')}
}
