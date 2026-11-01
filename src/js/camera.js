// Enhanced in-app document camera. Keeps the existing Supabase upload contract: returns a JPEG Blob.
const CameraPreviewPlugin=()=>((window.Capacitor||{}).Plugins||{}).CameraPreview||null;
let proCameraBlobUrl=null,proCameraFlash='off',proCameraModes=[],proCameraResolve=null,proCameraBusy=false;
let pcOriginal=null,pcRotation=0,pcEnhance=true,pcGray=false,pcCrop=0,pcZoom=1,pcMaxZoom=1;
function cameraOverlayHtml(){return `<section id="pro-camera" role="dialog" aria-modal="true" aria-label="كاميرا المستندات">
<header class="pc-top"><button class="pc-icon" onclick="proCameraCancel()" aria-label="إغلاق">✕</button><span>ماسح مستندات السيارة</span><button class="pc-icon" id="pc-flash" onclick="proCameraToggleFlash()" aria-label="الفلاش">⚡</button></header>
<div class="pc-hint" id="pc-hint">ضع المستند كاملًا داخل الإطار واجعل الهاتف موازيًا له</div>
<div class="pc-guide" id="pc-guide"><i></i><i></i><i></i><i></i><div class="pc-guide-label">حافظ على ظهور أركان المستند</div></div>
<div class="pc-review" id="pc-review" hidden><canvas id="pc-canvas"></canvas></div>
<div class="pc-bottom">
<div class="pc-live-tools" id="pc-live-tools"><button onclick="proCameraZoom(-1)">− تقريب</button><span id="pc-zoom-label">1×</span><button onclick="proCameraZoom(1)">+ تقريب</button><span class="pc-tip">ثبّت الهاتف وتجنب الظلال</span></div>
<div class="pc-edit-tools" id="pc-edit-tools" hidden>
<div class="pc-edit-row"><button onclick="proCameraRotate()">↻ تدوير</button><button id="pc-enhance" class="selected" onclick="proCameraToggleEnhance()">تحسين الوضوح</button><button id="pc-gray" onclick="proCameraToggleGray()">أبيض وأسود</button></div>
<label>قص الحواف <input id="pc-crop" type="range" min="0" max="15" value="0" oninput="proCameraSetCrop(this.value)"></label>
<div class="pc-edit-note">راجع النص والأركان قبل اعتماد الصورة</div></div>
<div class="pc-actions" id="pc-actions"><button class="pc-cancel" onclick="proCameraCancel()">إلغاء</button><button class="pc-shutter" id="pc-shutter" onclick="proCameraCapture()"><span></span></button><button class="pc-flip" onclick="proCameraFlip()">↻</button></div>
<div class="pc-review-actions" id="pc-review-actions" hidden><button class="pc-cancel" onclick="proCameraRetake()">إعادة التصوير</button><button class="pc-accept" onclick="proCameraAccept()">استخدام الصورة</button></div>
<div class="pc-status" id="pc-status">جارٍ تشغيل الكاميرا…</div></div></section>`;}
function proCameraSetStatus(s){const e=document.getElementById('pc-status');if(e)e.textContent=s}
async function proCameraStart(){
 const cp=CameraPreviewPlugin();if(!cp)throw Error('إضافة الكاميرا غير متاحة');
 await cp.start({position:'rear',width:innerWidth,height:innerHeight,x:0,y:0,toBack:true,storeToFile:false,enableZoom:true,disableAudio:true,lockAndroidOrientation:false});
 try{const f=await cp.getSupportedFlashModes();proCameraModes=f.result||[]}catch{proCameraModes=[]}
 const flash=document.getElementById('pc-flash');if(flash)flash.hidden=!proCameraModes.length;
 try{const z=await cp.getMaxZoom();pcMaxZoom=Number(z.maxZoom||z.value||1)||1}catch{pcMaxZoom=1}
 pcZoom=1;proCameraSetStatus('اقترب من المستند مع إظهار الأركان الأربعة');
}
async function proCameraStop(){const cp=CameraPreviewPlugin();if(cp)try{await cp.stop()}catch{}}
function proCameraCleanup(){document.body.classList.remove('cam-active');document.getElementById('pro-camera')?.remove();if(proCameraBlobUrl)URL.revokeObjectURL(proCameraBlobUrl);proCameraBlobUrl=null;pcOriginal=null;proCameraFlash='off';proCameraModes=[]}
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
 const blob=b64ToBlob(raw,'image/jpeg');pcOriginal=await proCameraLoadImage(blob);pcRotation=0;pcEnhance=true;pcGray=false;pcCrop=0;await proCameraStop();
 document.getElementById('pc-review').hidden=false;document.getElementById('pc-guide').hidden=true;document.getElementById('pc-live-tools').hidden=true;document.getElementById('pc-actions').hidden=true;document.getElementById('pc-edit-tools').hidden=false;document.getElementById('pc-review-actions').hidden=false;
 await proCameraRender();proCameraSetStatus('الصورة جاهزة للمراجعة والتحسين');
 }catch(e){proCameraSetStatus('تعذر التصوير: '+(e.message||'حاول مرة أخرى'))}
 finally{proCameraBusy=false;if(btn)btn.disabled=false}
}
function proCameraLoadImage(blob){return new Promise((resolve,reject)=>{const u=URL.createObjectURL(blob),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);resolve(im)};im.onerror=()=>{URL.revokeObjectURL(u);reject(Error('تعذر قراءة الصورة'))};im.src=u})}
async function proCameraRender(){
 if(!pcOriginal)return;const im=pcOriginal,rot=((pcRotation%360)+360)%360,swap=rot===90||rot===270;
 const w=swap?im.height:im.width,h=swap?im.width:im.height,cut=Math.round(Math.min(w,h)*pcCrop/100),cw=Math.max(1,w-2*cut),ch=Math.max(1,h-2*cut);
 const c=document.getElementById('pc-canvas');c.width=cw;c.height=ch;const x=c.getContext('2d',{alpha:false});
 x.save();x.translate(w/2,h/2);x.rotate(rot*Math.PI/180);x.drawImage(im,-im.width/2,-im.height/2);x.restore();
 if(pcCrop){const data=x.getImageData(cut,cut,cw,ch);c.width=cw;c.height=ch;x.putImageData(data,0,0)}
 if(pcEnhance||pcGray){const d=x.getImageData(0,0,cw,ch),a=d.data;for(let i=0;i<a.length;i+=4){let lum=.299*a[i]+.587*a[i+1]+.114*a[i+2];if(pcGray){let v=lum>155?255:lum<95?0:Math.round((lum-95)*4.25);a[i]=a[i+1]=a[i+2]=v}else if(pcEnhance){const v=Math.max(0,Math.min(255,(lum-128)*1.22+138));const ratio=lum? v/lum:1;a[i]=Math.min(255,a[i]*ratio);a[i+1]=Math.min(255,a[i+1]*ratio);a[i+2]=Math.min(255,a[i+2]*ratio)}}x.putImageData(d,0,0)}
 if(proCameraBlobUrl)URL.revokeObjectURL(proCameraBlobUrl);const out=await new Promise(res=>c.toBlob(res,'image/jpeg',.94));if(!out)throw Error('فشل تجهيز الصورة');proCameraBlobUrl=URL.createObjectURL(out);
 const e=document.getElementById('pc-enhance'),g=document.getElementById('pc-gray');if(e)e.classList.toggle('selected',pcEnhance);if(g)g.classList.toggle('selected',pcGray);
}
async function proCameraRetake(){pcOriginal=null;document.getElementById('pc-review').hidden=true;document.getElementById('pc-guide').hidden=false;document.getElementById('pc-live-tools').hidden=false;document.getElementById('pc-actions').hidden=false;document.getElementById('pc-edit-tools').hidden=true;document.getElementById('pc-review-actions').hidden=true;if(proCameraBlobUrl)URL.revokeObjectURL(proCameraBlobUrl);proCameraBlobUrl=null;try{await proCameraStart()}catch(e){proCameraSetStatus('تعذر إعادة تشغيل الكاميرا')}}
async function proCameraRotate(){pcRotation=(pcRotation+90)%360;await proCameraRender()}
async function proCameraToggleEnhance(){pcEnhance=!pcEnhance;await proCameraRender()}
async function proCameraToggleGray(){pcGray=!pcGray;if(pcGray)pcEnhance=false;await proCameraRender()}
async function proCameraSetCrop(v){pcCrop=Number(v)||0;await proCameraRender()}
async function proCameraAccept(){if(!proCameraBlobUrl||!proCameraResolve)return;try{const response=await fetch(proCameraBlobUrl),blob=await response.blob();const done=proCameraResolve;proCameraResolve=null;proCameraCleanup();done(blob)}catch{proCameraSetStatus('تعذر تجهيز الصورة للحفظ')}}
async function proCameraCancel(){const done=proCameraResolve;proCameraResolve=null;await proCameraStop();proCameraCleanup();if(done)done(null)}
async function proCameraToggleFlash(){const cp=CameraPreviewPlugin(),next=proCameraFlash==='torch'?'off':(proCameraModes.includes('torch')?'torch':proCameraModes.includes('on')?'on':'off');try{await cp.setFlashMode(next);proCameraFlash=next;document.getElementById('pc-flash')?.classList.toggle('active',next!=='off')}catch{proCameraSetStatus('الفلاش غير متاح على هذا الجهاز')}}
async function proCameraFlip(){try{await CameraPreviewPlugin().flip()}catch{proCameraSetStatus('تعذر تبديل الكاميرا')}}
