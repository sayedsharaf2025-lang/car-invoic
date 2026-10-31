// Native bridge helpers (Capacitor) with browser fallbacks, so the app also works in a normal browser.
const CAPP=window.Capacitor||{};
const isNative=()=>!!(CAPP.isNativePlatform&&CAPP.isNativePlatform());
const plug=n=>(CAPP.Plugins&&CAPP.Plugins[n])||null;

function blobToB64(b){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(b)})}
function b64ToBlob(b64,type){const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type})}

// Downscale a picture and re-encode as JPEG (keeps uploads and PDFs small).
async function shrink(blob,max=1600,q=.8){
  const url=URL.createObjectURL(blob);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('الصورة مش مفهومة'));i.src=url});
    const s=Math.min(1,max/Math.max(img.width,img.height));
    const c=document.createElement('canvas');
    c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(r,'image/jpeg',q));
  }finally{URL.revokeObjectURL(url)}
}

function pickFile(accept){
  return new Promise(res=>{
    const i=document.createElement('input');i.type='file';i.accept=accept;
    i.onchange=()=>res(i.files[0]||null);i.oncancel=()=>res(null);i.click();
  });
}

// Camera (native prompt: camera / gallery) -> JPEG blob, or null if cancelled.
async function pickImage(){
  const cam=plug('Camera');
  if(isNative()&&cam){
    try{
      const p=await cam.getPhoto({quality:80,width:1600,resultType:'base64',source:'PROMPT',saveToGallery:false,
        promptLabelHeader:'صورة المستند',promptLabelPhoto:'من المعرض',promptLabelPicture:'الكاميرا',promptLabelCancel:'إلغاء'});
      return b64ToBlob(p.base64String,'image/'+(p.format||'jpeg'));
    }catch(e){
      if(/cancel/i.test((e&&e.message)||String(e)))return null;
      // any other camera failure: fall through to the file chooser
    }
  }
  const f=await pickFile('image/*');
  return f?await shrink(f):null;
}

// Native share sheet (WhatsApp, Drive...) via Filesystem + Share. Browser: Web Share, then plain download.
async function shareFile(blob,name,title){
  const fs=plug('Filesystem'),sh=plug('Share');
  try{
    if(isNative()&&fs&&sh){
      const data=await blobToB64(blob);
      const w=await fs.writeFile({path:name,data,directory:'CACHE'});
      await sh.share({title,dialogTitle:title,files:[w.uri]});
      return;
    }
    const file=new File([blob],name,{type:blob.type});
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title});return}
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1e4);
  }catch(e){
    if(/cancel|abort/i.test((e&&(e.message||e.name))||''))return; // user closed the share sheet
    throw e;
  }
}

// Speech to text, Egyptian Arabic.
async function listen(){
  const sr=plug('SpeechRecognition');
  if(isNative()&&sr){
    const av=await sr.available();
    if(!av.available)throw new Error('التعرف على الصوت مش متاح على الجهاز ده');
    let p=await sr.checkPermissions();
    if(p.speechRecognition!=='granted'){
      p=await sr.requestPermissions();
      if(p.speechRecognition!=='granted')throw new Error('لازم تسمح باستخدام المايك');
    }
    const r=await sr.start({language:'ar-EG',maxResults:1,prompt:'اتكلم دلوقتي...',partialResults:false,popup:true});
    return (r&&r.matches&&r.matches[0])||'';
  }
  const W=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!W)throw new Error('الإدخال الصوتي مش مدعوم هنا');
  return new Promise((res,rej)=>{
    const r=new W();r.lang='ar-EG';
    r.onresult=e=>res(e.results[0][0].transcript);
    r.onerror=e=>rej(new Error(e.error==='not-allowed'?'لازم تسمح باستخدام المايك':'مسمعتش حاجة'));
    r.onend=()=>res('');
    r.start();
  });
}
