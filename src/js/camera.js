// Enhanced in-app document camera. Keeps the existing Supabase upload contract: returns a JPEG Blob.
const CameraPreviewPlugin=()=>((window.Capacitor||{}).Plugins||{}).CameraPreview||null;
let proCameraBlobUrl=null,proCameraFlash='off',proCameraModes=[],proCameraResolve=null,proCameraBusy=false;
let pcOriginal=null,pcRotation=0,pcEnhance=true,pcGray=false,pcBW=false,pcCrop=0,pcZoom=1,pcMaxZoom=1,pcEditingCorners=false;
let pcScanResult=null,pcDetectedCorners=null,pcCornerEditor=null;
let pcPerspective=false,pcCorners=[[.08,.08],[.92,.08],[.92,.92],[.08,.92]],pcDrag=-1;
function cameraOverlayHtml(){return `<section id="pro-camera" role="dialog" aria-modal="true" aria-label="كاميرا المستندات">
<header class="pc-top"><button class="pc-icon" onclick="proCameraCancel()" aria-label="إغلاق">✕</button><span>ماسح مستندات السيارة</span><button class="pc-icon" id="pc-flash" onclick="proCameraToggleFlash()" aria-label="الفلاش">⚡</button></header>
<div class="pc-hint" id="pc-hint">ضع الورقة كاملة داخل الإطار؛ سيكتشف التطبيق حدودها ويصحح ميلها تلقائيًا</div>
<div class="pc-guide" id="pc-guide"><i></i><i></i><i></i><i></i><div class="pc-guide-label">حافظ على ظهور أركان المستند</div></div>
<div class="pc-review" id="pc-review" hidden><div class="pc-crop-stage"><canvas id="pc-canvas"></canvas><svg id="pc-corners" class="pc-corners" viewBox="0 0 1000 1000" preserveAspectRatio="none"><polygon id="pc-poly" points="80,80 920,80 920,920 80,920"></polygon><circle data-corner="0" cx="80" cy="80" r="24"></circle><circle data-corner="1" cx="920" cy="80" r="24"></circle><circle data-corner="2" cx="920" cy="920" r="24"></circle><circle data-corner="3" cx="80" cy="920" r="24"></circle></svg></div></div>
<div class="pc-bottom">
<div class="pc-live-tools" id="pc-live-tools"><button onclick="proCameraZoom(-1)">− تقريب</button><span id="pc-zoom-label">1×</span><button onclick="proCameraZoom(1)">+ تقريب</button><span class="pc-tip">ثبّت الهاتف وتجنب الظلال</span></div>
<div class="pc-edit-tools" id="pc-edit-tools" hidden>
<div class="pc-edit-row"><button onclick="proCameraRotate()">↻ تدوير</button><button id="pc-enhance" class="selected" onclick="proCameraToggleEnhance()">تحسين الوضوح</button><button id="pc-gray" onclick="proCameraToggleGray()">رمادي</button><button id="pc-bw" onclick="proCameraToggleBW()">أبيض وأسود</button></div>
<label>قص الحواف <input id="pc-crop" type="range" min="0" max="15" value="0" oninput="proCameraSetCrop(this.value)"></label>
<div class="pc-edit-row"><button id="pc-auto-detect" onclick="proCameraAutoDetect()">اكتشاف الورقة تلقائيًا</button><button id="pc-edit-detected" onclick="proCameraEditDetectedCorners()" hidden>تعديل الأركان يدويًا</button><button id="pc-perspective" onclick="proCameraTogglePerspective()">تصحيح المنظور</button><button onclick="proCameraResetCorners()">إعادة ضبط الأركان</button></div><div class="pc-edit-note" id="pc-corner-note">اسحب الدوائر الأربع لتحديد أركان الورقة بدقة</div></div>
<div class="pc-actions" id="pc-actions"><button class="pc-cancel" onclick="proCameraCancel()">إلغاء</button><button class="pc-shutter" id="pc-shutter" onclick="proCameraCapture()"><span></span></button><button class="pc-flip" onclick="proCameraFlip()">↻</button></div>
<div class="pc-review-actions" id="pc-review-actions" hidden><button class="pc-cancel" onclick="proCameraRetake()">إعادة التصوير</button><button class="pc-accept" onclick="proCameraAccept()">استخدام الصورة</button></div>
<div class="pc-status" id="pc-status">جارٍ تشغيل الكاميرا…</div></div></section>`;}
function proCameraSetStatus(s){const e=document.getElementById('pc-status');if(e)e.textContent=s}
async function proCameraStart(){
 const cp=CameraPreviewPlugin();if(!cp)throw Error('إضافة الكاميرا غير متاحة');
 await cp.start({position:'rear',width:innerWidth,height:innerHeight,x:0,y:0,toBack:true,storeToFile:false,enableZoom:true,disableAudio:true,lockAndroidOrientation:false});
 try{const f=await cp.getSupportedFlashModes();proCameraModes=f.result||[]}catch{proCameraModes=[]}
 const flash=document.getElementById('pc-flash');if(flash){flash.hidden=false;flash.textContent='LED';flash.title=proCameraModes.length?'تشغيل فلاش LED':'جرّب تشغيل فلاش LED';}
 try{const z=await cp.getMaxZoom();pcMaxZoom=Number(z.maxZoom||z.value||1)||1}catch{pcMaxZoom=1}
 pcZoom=1;proCameraSetStatus('وجّه الكاميرا لتظهر الورقة كاملة؛ المحاذاة ستتم تلقائيًا بعد التصوير');
}
async function proCameraStop(){const cp=CameraPreviewPlugin();if(cp)try{await cp.stop()}catch{}}
function proCameraCleanup(){document.body.classList.remove('cam-active');document.getElementById('pro-camera')?.remove();if(proCameraBlobUrl)URL.revokeObjectURL(proCameraBlobUrl);proCameraBlobUrl=null;pcOriginal=null;pcScanResult=null;pcDetectedCorners=null;pcEditingCorners=false;if(pcCornerEditor){pcCornerEditor.destroy();pcCornerEditor=null}proCameraFlash='off';proCameraModes=[]}
function captureDocumentImage(){
 const cp=CameraPreviewPlugin();if(!isNative()||!cp)return pickImage();
 if(proCameraResolve)return Promise.reject(Error('الكاميرا مفتوحة بالفعل'));
 return new Promise(async resolve=>{proCameraResolve=resolve;proCameraBusy=false;document.body.insertAdjacentHTML('beforeend',cameraOverlayHtml());document.body.classList.add('cam-active');
 try{await proCameraStart()}catch(e){proCameraCleanup();proCameraResolve=null;try{resolve(await pickImage())}catch(err){toast(errMsg(err));resolve(null)}}});
}
async function proCameraZoom(dir){const cp=CameraPreviewPlugin();if(!cp)return;const next=Math.max(1,Math.min(pcMaxZoom,pcZoom+(dir*.5)));try{await cp.setZoom({zoom:next});pcZoom=next;document.getElementById('pc-zoom-label').textContent=next.toFixed(1)+'×'}catch{proCameraSetStatus('التقريب غير مدعوم في هذا الهاتف')}}
async function proCameraCapture(){
 if(proCameraBusy)return;proCameraBusy=true;const btn=document.getElementById('pc-shutter');if(btn)btn.disabled=true;
 try{proCameraSetStatus('جارٍ التقاط الصورة الأصلية…');const cp=CameraPreviewPlugin(),r=await cp.capture({quality:100});const raw=String(r.value||r.base64String||'').replace(/^data:[^,]*;base64,/i,'');if(!raw)throw Error('لم يتم التقاط صورة');
 const blob=b64ToBlob(raw,'image/jpeg');pcOriginal=await proCameraLoadImage(blob);pcScanResult=null;pcDetectedCorners=null;pcRotation=0;pcEnhance=true;pcGray=false;pcBW=false;pcCrop=0;pcPerspective=false;pcEditingCorners=false;pcCorners=[[.08,.08],[.92,.08],[.92,.92],[.08,.92]];await proCameraStop();
 document.getElementById('pc-review').hidden=false;document.getElementById('pc-guide').hidden=true;document.getElementById('pc-live-tools').hidden=true;document.getElementById('pc-actions').hidden=true;document.getElementById('pc-edit-tools').hidden=false;document.getElementById('pc-review-actions').hidden=false;
 await proCameraAutoDetect();
 }catch(e){proCameraSetStatus('تعذر التصوير: '+(e.message||'حاول مرة أخرى'))}
 finally{proCameraBusy=false;if(btn)btn.disabled=false}
}
function proCameraLoadImage(blob){return new Promise((resolve,reject)=>{const u=URL.createObjectURL(blob),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);resolve(im)};im.onerror=()=>{URL.revokeObjectURL(u);reject(Error('تعذر قراءة الصورة'))};im.src=u})}
async function proCameraRender(){
 if(!pcOriginal)return;
 const im=pcScanResult||pcOriginal,rot=((pcRotation%360)+360)%360,swap=rot===90||rot===270;
 const w=swap?im.height:im.width,h=swap?im.width:im.height;
 const work=document.createElement('canvas');work.width=w;work.height=h;
 let ctx=work.getContext('2d',{alpha:false,willReadFrequently:true});
 ctx.save();ctx.translate(w/2,h/2);ctx.rotate(rot*Math.PI/180);ctx.drawImage(im,-im.width/2,-im.height/2);ctx.restore();
 if(pcPerspective&&!pcEditingCorners){const warped=pcPerspectiveCanvas(work);work.width=warped.width;work.height=warped.height;ctx=work.getContext('2d',{alpha:false,willReadFrequently:true});ctx.drawImage(warped,0,0)}
 if(pcCrop){const cut=Math.round(Math.min(work.width,work.height)*pcCrop/100),cw=Math.max(1,work.width-2*cut),ch=Math.max(1,work.height-2*cut),tmp=document.createElement('canvas');tmp.width=cw;tmp.height=ch;tmp.getContext('2d').drawImage(work,cut,cut,cw,ch,0,0,cw,ch);work.width=cw;work.height=ch;ctx=work.getContext('2d',{alpha:false,willReadFrequently:true});ctx.drawImage(tmp,0,0)}
 if(Math.max(work.width,work.height)>2800){const scale=2800/Math.max(work.width,work.height),nw=Math.max(1,Math.round(work.width*scale)),nh=Math.max(1,Math.round(work.height*scale)),tmp=document.createElement('canvas');tmp.width=nw;tmp.height=nh;tmp.getContext('2d',{alpha:false}).drawImage(work,0,0,nw,nh);work.width=nw;work.height=nh;ctx=work.getContext('2d',{alpha:false,willReadFrequently:true});ctx.drawImage(tmp,0,0)}
 const iw=work.width,ih=work.height;
 if(pcEnhance||pcGray||pcBW){
  const scanner=window.DocumentScanner;
  if(!scanner||typeof scanner.enhance!=='function')throw Error('محرك تحسين المستند غير محمل');
  const frame=ctx.getImageData(0,0,iw,ih),mode=pcBW?'bw':(pcGray?'gray':(pcEnhance?'magic':'original'));
  frame.data.set(scanner.enhance(frame.data,iw,ih,mode));
  ctx.putImageData(frame,0,0);
 }
 const c=document.getElementById('pc-canvas');c.width=iw;c.height=ih;c.getContext('2d',{alpha:false}).drawImage(work,0,0);
 const stage=document.querySelector('.pc-crop-stage');if(stage){stage.style.width='auto';stage.style.aspectRatio='auto'}
 if(proCameraBlobUrl)URL.revokeObjectURL(proCameraBlobUrl);
 const out=await new Promise(res=>c.toBlob(res,'image/jpeg',.97));if(!out)throw Error('فشل تجهيز الصورة');proCameraBlobUrl=URL.createObjectURL(out);
 const e=document.getElementById('pc-enhance'),g=document.getElementById('pc-gray'),b=document.getElementById('pc-bw');if(e)e.classList.toggle('selected',pcEnhance);if(g)g.classList.toggle('selected',pcGray);if(b)b.classList.toggle('selected',pcBW);
 proCameraUpdateCorners();
}
async function proCameraRetake(){pcOriginal=null;pcScanResult=null;pcDetectedCorners=null;pcEditingCorners=false;if(pcCornerEditor){pcCornerEditor.destroy();pcCornerEditor=null}document.getElementById('pc-review').hidden=true;document.getElementById('pc-guide').hidden=false;document.getElementById('pc-live-tools').hidden=false;document.getElementById('pc-actions').hidden=false;document.getElementById('pc-edit-tools').hidden=true;document.getElementById('pc-review-actions').hidden=true;const editBtn=document.getElementById('pc-edit-detected');if(editBtn)editBtn.hidden=true;if(proCameraBlobUrl)URL.revokeObjectURL(proCameraBlobUrl);proCameraBlobUrl=null;try{await proCameraStart()}catch(e){proCameraSetStatus('تعذر إعادة تشغيل الكاميرا')}}
async function proCameraRotate(){pcRotation=(pcRotation+90)%360;if(pcPerspective)pcCorners=pcCorners.map(([x,y])=>[1-y,x]);proCameraUpdateCorners();await proCameraRender()}
async function proCameraToggleEnhance(){pcEnhance=!pcEnhance;if(pcEnhance){pcGray=false;pcBW=false}await proCameraRender()}
async function proCameraToggleGray(){pcGray=!pcGray;if(pcGray){pcEnhance=false;pcBW=false}await proCameraRender()}
async function proCameraToggleBW(){pcBW=!pcBW;if(pcBW){pcEnhance=false;pcGray=false}await proCameraRender()}
async function proCameraSetCrop(v){pcCrop=Number(v)||0;await proCameraRender()}
async function proCameraAccept(){if(!proCameraResolve)return;try{if(pcEditingCorners){pcEditingCorners=false;const e=document.getElementById('pc-corners'),b=document.getElementById('pc-perspective');if(e)e.style.display='none';if(b)b.textContent='تصحيح المنظور';await proCameraRender()}if(!proCameraBlobUrl)throw Error('الصورة غير جاهزة');const response=await fetch(proCameraBlobUrl),blob=await response.blob();const done=proCameraResolve;proCameraResolve=null;proCameraCleanup();done(blob)}catch(e){proCameraSetStatus('تعذر تجهيز الصورة للحفظ: '+(e.message||''))}}
async function proCameraCancel(){const done=proCameraResolve;proCameraResolve=null;await proCameraStop();proCameraCleanup();if(done)done(null)}
async function proCameraToggleFlash(){const cp=CameraPreviewPlugin();if(!cp)return;const canTorch=proCameraModes.includes('torch');const next=proCameraFlash!=='off'?'off':(canTorch?'torch':(proCameraModes.includes('on')?'on':'torch'));try{await cp.setFlashMode({flashMode:next});proCameraFlash=next;const b=document.getElementById('pc-flash');if(b){b.classList.toggle('active',next!=='off');b.textContent=next==='off'?'LED':'LED ✓'}proCameraSetStatus(next==='off'?'تم إيقاف فلاش LED':'تم تشغيل فلاش LED')}catch(e){proCameraSetStatus('تعذر تشغيل فلاش LED من الهاتف؛ تحقق من صلاحية الكاميرا والفلاش')}}
async function proCameraFlip(){try{await CameraPreviewPlugin().flip()}catch{proCameraSetStatus('تعذر تبديل الكاميرا')}}

async function proCameraTogglePerspective(){
 const e=document.getElementById('pc-corners'),b=document.getElementById('pc-perspective');
 if(pcEditingCorners){pcEditingCorners=false;pcPerspective=true;if(e)e.style.display='none';if(b){b.textContent='تصحيح المنظور';b.classList.add('selected')}await proCameraRender();proCameraSetStatus('تم تطبيق تصحيح المنظور. راجع الصورة قبل الحفظ.');return}
 pcPerspective=!pcPerspective;if(e)e.style.display='none';if(b){b.textContent='تصحيح المنظور';b.classList.toggle('selected',pcPerspective)}await proCameraRender();
 proCameraSetStatus(pcPerspective?'تم تفعيل تصحيح المنظور':'تم إيقاف تصحيح المنظور');
}
function proCameraResetCorners(){pcCorners=[[0,0],[1,0],[1,1],[0,1]];pcPerspective=true;pcEditingCorners=true;const e=document.getElementById('pc-corners'),b=document.getElementById('pc-perspective');if(e)e.style.display='block';if(b){b.textContent='تطبيق تصحيح المنظور';b.classList.add('selected')}proCameraUpdateCorners();proCameraRender()}
function proCameraUpdateCorners(){const p=document.getElementById('pc-poly');if(!p)return;p.setAttribute('points',pcCorners.map(v=>String(v[0]*1000)+','+String(v[1]*1000)).join(' '));document.querySelectorAll('#pc-corners circle').forEach((c,i)=>{c.setAttribute('cx',pcCorners[i][0]*1000);c.setAttribute('cy',pcCorners[i][1]*1000)})}
(function(){document.addEventListener('pointerdown',e=>{const n=e.target.closest?.('#pc-corners circle');if(!n||!pcPerspective)return;pcDrag=Number(n.dataset.corner);e.preventDefault()});document.addEventListener('pointermove',e=>{if(pcDrag<0||!pcPerspective)return;const svg=document.getElementById('pc-corners'),r=svg.getBoundingClientRect();const next=pcCorners.map(p=>p.slice());next[pcDrag]=[Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];if(pcValidCorners(next)){pcCorners=next;proCameraUpdateCorners()}});document.addEventListener('pointerup',()=>{pcDrag=-1})})();
function pcValidCorners(points){
 if(!Array.isArray(points)||points.length!==4)return false;let sign=0,area=0;
 for(let i=0;i<4;i++){const a=points[i],b=points[(i+1)%4],d=points[(i+2)%4],cross=(b[0]-a[0])*(d[1]-b[1])-(b[1]-a[1])*(d[0]-b[0]);if(Math.abs(cross)<.00001)return false;if(!sign)sign=Math.sign(cross);else if(Math.sign(cross)!==sign)return false;area+=a[0]*b[1]-b[0]*a[1]}
 return Math.abs(area)>.01;
}
function pcPerspectiveCanvas(source){
 const scanner=window.DocumentScanner;if(!scanner)throw Error('محرك تصحيح المنظور غير محمل');
 const q=pcCorners.map(v=>({x:v[0]*(source.width-1),y:v[1]*(source.height-1)}));
 const size=scanner.outputSize(q,2800),ctx0=source.getContext('2d',{willReadFrequently:true}),input=ctx0.getImageData(0,0,source.width,source.height);
 const pixels=scanner.warpPerspective(input.data,source.width,source.height,q,size.w,size.h);
 const out=document.createElement('canvas');out.width=size.w;out.height=size.h;
 const ctx=out.getContext('2d',{alpha:false});const frame=ctx.createImageData(size.w,size.h);frame.data.set(pixels);ctx.putImageData(frame,0,0);return out;
}
async function proCameraAutoDetect(){
 if(!pcOriginal)return false;
 const scanner=window.DocumentScanner;
 if(!scanner||typeof scanner.detectDocument!=='function'){pcCorners=[[0,0],[1,0],[1,1],[0,1]];pcPerspective=true;pcEditingCorners=false;const edit=document.getElementById('pc-edit-detected');if(edit)edit.hidden=false;await proCameraRender();proCameraSetStatus('محرك الاكتشاف غير محمل؛ يمكنك تحديد الزوايا يدويًا.');return false}
 proCameraSetStatus('جارٍ اكتشاف حدود الورقة…');
 try{
  const maxSide=1400,scale=Math.min(1,maxSide/Math.max(pcOriginal.width,pcOriginal.height));
  const sw=Math.max(2,Math.round(pcOriginal.width*scale)),sh=Math.max(2,Math.round(pcOriginal.height*scale));
  const sample=document.createElement('canvas');sample.width=sw;sample.height=sh;
  const sc=sample.getContext('2d',{willReadFrequently:true});sc.drawImage(pcOriginal,0,0,sw,sh);
  const found=scanner.detectDocument(sc.getImageData(0,0,sw,sh).data,sw,sh);
  pcScanResult=null;pcDetectedCorners=found;
  if(found&&found.length===4){
   pcCorners=found.map(p=>[Math.max(0,Math.min(1,p.x/sw)),Math.max(0,Math.min(1,p.y/sh))]);
   pcPerspective=true;pcEditingCorners=false;
   proCameraSetStatus('تم اكتشاف حدود الورقة. يمكنك سحب الزوايا الأربع لتعديل القص قبل الحفظ.');
  }else{
   pcCorners=[[0,0],[1,0],[1,1],[0,1]];pcPerspective=true;
   proCameraSetStatus('لم يتم تحديد حدود الورقة بدقة؛ الصورة كاملة محفوظة. اسحب الزوايا الأربع يدويًا.');
  }
  const edit=document.getElementById('pc-edit-detected');if(edit){edit.hidden=false;edit.textContent='تعديل الأركان يدويًا'}
  const perspective=document.getElementById('pc-perspective');if(perspective)perspective.classList.add('selected');
  const overlay=document.getElementById('pc-corners');if(overlay)overlay.style.display='none';
  await proCameraRender();proCameraUpdateCorners();
  return !!found;
 }catch(e){
  pcScanResult=null;pcDetectedCorners=null;pcCorners=[[0,0],[1,0],[1,1],[0,1]];pcPerspective=true;
  const edit=document.getElementById('pc-edit-detected');if(edit)edit.hidden=false;
  try{await proCameraRender()}catch{}
  proCameraSetStatus('تعذر الاكتشاف التلقائي؛ يمكنك تحديد الزوايا يدويًا. '+(e.message||''));
  return false;
 }
}
function proCameraEditDetectedCorners(){
 pcPerspective=true;pcEditingCorners=true;
 const overlay=document.getElementById('pc-corners'),button=document.getElementById('pc-perspective');
 if(overlay)overlay.style.display='block';
 if(button){button.classList.add('selected');button.textContent='تطبيق تصحيح المنظور'}
 proCameraUpdateCorners();proCameraRender();
 proCameraSetStatus('اسحب الدوائر الأربع إلى حواف الورقة، ثم اضغط تطبيق تصحيح المنظور.');
}
// The four draggable crop handles are positioned over the review canvas.
