const BUCKET='car-docs';
const DOCS=[['car_license','رخصة السيارة'],['driver_license','رخصة القيادة'],['entity_license','رخصة الشركة / الجهة']];
const DOC_LABEL=Object.fromEntries(DOCS);
// The 15 columns, in the exact order of the import file. Single source for form, details, PDF and import.
const FIELDS=[
  ['plate','رقم لوحة السيارة'],['brand','الماركة'],['model_year','الموديل'],['vehicle_type','نوع السيارة'],
  ['chassis_no','رقم الشاسيه'],['engine_no','رقم الموتور'],['traffic_dept','إدارة / جهة المرور'],['owner_company','الشركة المالكة'],
  ['license_expiry','تاريخ نهاية الترخيص','date'],['license_status','حالة الترخيص الجارية'],['license_supervisor','مشرف التراخيص'],
  ['driver','السائق المكلف'],['fire_extinguisher','حالة طفاية الحريق'],['insurance_status','موقف بيانات التأمين'],['notes','ملاحظات إضافية','area']
];
const MAXLEN={plate:30,model_year:20,notes:1000};
const SOON_DAYS=30,PAGE=100;
let CARS=[],CDOCS={},URLS={},urlsAt=0,carQ='',carFilter='',carLimit=PAGE,pend={},searchT=0;

const carTitle=c=>[c.brand,c.vehicle_type,c.model_year].filter(Boolean).join(' ')||c.plate;
// ASCII-only file names: safest for Android file URIs and for WhatsApp/Drive
const fileBase=c=>'car_'+(String(c.plate).replace(/[^A-Za-z0-9]+/g,'')||c.id.slice(0,8));
// search normalisation: digits, alef/yaa/taa-marbuta variants, diacritics, separators
const sn=s=>String(s==null?'':s).toLowerCase().replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ً-ْ]/g,'').replace(/[-_.]/g,' ');

const startOfToday=()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate())};
function daysLeft(iso){if(!iso)return null;const [y,m,d]=iso.split('-').map(Number);return Math.round((new Date(y,m-1,d)-startOfToday())/864e5)}
// Pre-compute search text + expiry once per load so typing in the search box stays instant with 80+ cars.
function prepare(c){
  c._h=sn(FIELDS.filter(f=>f[0]!=='notes').map(f=>c[f[0]]||'').join(' '));
  c._hc=c._h.replace(/\s+/g,'');
  c._d=daysLeft(c.license_expiry);
  c._warn=c._d!==null&&c._d<=SOON_DAYS;
}
function expiryBadge(c){
  if(!c._warn)return '';
  const d=c._d;
  return `<span class="badge red">${d<0?`منتهي من ${-d} يوم`:d===0?'ينتهي النهارده':`ينتهي خلال ${d} يوم`}</span>`;
}
function carMatch(c,tokens){return tokens.every(x=>c._h.includes(x)||c._hc.includes(x))}

async function loadCars(){
  const [cars,docs]=await Promise.all([
    fetchAll(()=>sb.from('cars').select('*').order('created_at',{ascending:false}).order('id')),
    fetchAll(()=>sb.from('car_documents').select('*').order('id'))
  ]);
  cars.forEach(prepare);
  CARS=cars;CDOCS={};
  docs.forEach(d=>{(CDOCS[d.car_id]=CDOCS[d.car_id]||{})[d.doc_type]=d});
}
// Images live in a private bucket: show them through short-lived signed URLs.
async function ensureUrls(carId){
  if(Date.now()-urlsAt>50*60e3){URLS={};urlsAt=Date.now()}
  const paths=Object.values(CDOCS[carId]||{}).map(d=>d.path).filter(p=>!URLS[p]);
  if(!paths.length)return;
  const r=ck(await sb.storage.from(BUCKET).createSignedUrls(paths,3600));
  r.data.forEach(x=>{if(x.signedUrl)URLS[x.path]=x.signedUrl});
}
async function dl(path){return ck(await sb.storage.from(BUCKET).download(path)).data}

/* ---------- list + search ---------- */
function viewCars(){
  if(!LOADED)return loadingHtml();
  if(!CARS.length)return `<h1>السيارات</h1>`+emptyBox('🚗','لسه مفيش سيارات','اضغط "+ سيارة" لإضافة أول سيارة، أو "استيراد ملف" لإدخال قائمة كاملة من ملف CSV أو JSON.','+ إضافة أول سيارة',"go('carForm')")
    +`<button class="ghost wide" onclick="importModal()">📥 استيراد ملف (CSV / JSON)</button>`;
  const warn=CARS.filter(c=>c._warn).length;
  return `<h1>السيارات (${CARS.length})</h1>
  <input id="cq" type="search" placeholder="🔍 ابحث برقم اللوحة أو الماركة أو السائق" value="${esc(carQ)}" oninput="onCarSearch(this.value)">
  <div class="two" style="margin-top:8px"><button class="go" style="margin:0" onclick="go('carForm')">+ سيارة</button><button class="ghost" onclick="importModal()">📥 استيراد ملف</button></div>
  ${warn?`<div class="chips"><button id="chipw" class="chip${carFilter==='warn'?' on':''}" onclick="toggleWarn()">⚠ ترخيص منتهي / قريب (${warn})</button></div>`:''}
  <div id="carList">${carListHtml()}</div>`;
}
function onCarSearch(v){carQ=v;carLimit=PAGE;clearTimeout(searchT);searchT=setTimeout(renderCarList,120)}
function toggleWarn(){carFilter=carFilter?'':'warn';carLimit=PAGE;$('#chipw').classList.toggle('on',!!carFilter);renderCarList()}
function moreCars(){carLimit+=PAGE;renderCarList()}
function renderCarList(){const l=$('#carList');if(l)l.innerHTML=carListHtml()}
function carListHtml(){
  const tokens=sn(carQ).split(/\s+/).filter(Boolean);
  const list=CARS.filter(c=>(!carFilter||c._warn)&&carMatch(c,tokens));
  if(!list.length)return '<p class="empty">مفيش نتيجة للبحث ده.</p>';
  let h=list.slice(0,carLimit).map(c=>
    `<div class="card-item tap" onclick="openCar('${c.id}')"><b>${esc(carTitle(c))}</b> <span class="plate">${esc(c.plate)}</span>${expiryBadge(c)}<small>${c.driver?esc(c.driver)+' · ':''}${esc(c.owner_company||'')}${(CDOCS[c.id]?' · 📎'+Object.keys(CDOCS[c.id]).length:'')}</small></div>`).join('');
  if(list.length>carLimit)h+=`<button class="ghost wide" onclick="moreCars()">عرض المزيد (${list.length-carLimit})</button>`;
  return h;
}
async function openCar(id){await run(async()=>{await ensureUrls(id);go('carView',{id})})}

/* ---------- details ---------- */
function viewCarView(){
  const c=CARS.find(x=>x.id===ctx.id);
  if(!c)return `<p class="empty">السيارة مش موجودة.</p><button class="ghost wide" onclick="go('cars')">رجوع</button>`;
  const d=CDOCS[c.id]||{};
  const kv=FIELDS.map(([k,l])=>{
    let v=c[k]?esc(c[k]):'—';
    if(k==='license_expiry'&&c[k])v=`<span dir="ltr">${esc(c[k])}</span>${expiryBadge(c)}`;
    return `<div class="kv"><span>${l}</span><b>${v}</b></div>`;
  }).join('');
  return `<h1>${esc(carTitle(c))} <span class="plate">${esc(c.plate)}</span></h1>
  <div class="card-item">${kv}</div>
  <button class="go" onclick="shareCarPdf('${c.id}')">📄 مشاركة PDF (البيانات + كل الصور)</button>
  <div class="two" style="margin-top:8px"><button class="ghost" onclick="go('carForm',{id:'${c.id}'})">تعديل</button><button class="ghost danger" onclick="delCar('${c.id}')">حذف السيارة</button></div>
  <h2>المستندات</h2>
  ${DOCS.map(([t,l])=>{
    const doc=d[t];
    if(!doc)return `<div class="card-item"><b>${l}</b><p class="muted" style="margin:6px 0 0">لا توجد صورة</p></div>`;
    return `<div class="card-item"><b>${l}</b>
      <img class="doc-img" src="${esc(URLS[doc.path]||'')}" alt="${l}" loading="lazy" onclick="viewDoc('${t}')">
      <div class="two" style="margin-top:8px"><button class="ghost" onclick="shareDoc('${t}')">مشاركة الصورة</button><button class="ghost danger" onclick="delDoc('${t}')">حذف</button></div></div>`;
  }).join('')}
  <button class="ghost wide" onclick="go('cars')">← كل السيارات</button>`;
}
function viewDoc(t){
  const doc=(CDOCS[ctx.id]||{})[t];
  if(doc)modal(`<h2>${DOC_LABEL[t]}</h2><img class="doc-full" src="${esc(URLS[doc.path]||'')}" alt="${DOC_LABEL[t]}">`);
}
async function shareDoc(t){
  const c=CARS.find(x=>x.id===ctx.id),doc=(CDOCS[ctx.id]||{})[t];
  if(!doc)return;
  await run(async()=>{
    toast('جاري تجهيز الصورة…');
    const blob=await dl(doc.path);
    await shareFile(blob,`${fileBase(c)}_${t}.jpg`,`${DOC_LABEL[t]} - ${c.plate}`);
  });
}
async function delDocRow(doc){
  ck(await sb.from('car_documents').delete().eq('id',doc.id));
  await sb.storage.from(BUCKET).remove([doc.path]); // best effort: the row is already gone
}
async function delDoc(t){
  const doc=(CDOCS[ctx.id]||{})[t];
  if(!doc||!confirm(`حذف صورة "${DOC_LABEL[t]}"؟`))return;
  await run(async()=>{await delDocRow(doc);await loadCars();render()},'تم الحذف');
}
async function delCar(id){
  const c=CARS.find(x=>x.id===id);
  if(!c||!confirm(`حذف السيارة "${c.plate}" وكل مستنداتها؟`))return;
  await run(async()=>{
    const paths=Object.values(CDOCS[id]||{}).map(d=>d.path);
    ck(await sb.from('cars').delete().eq('id',id)); // documents rows cascade
    if(paths.length)await sb.storage.from(BUCKET).remove(paths);
    await loadCars();go('cars',null,true);
  },'تم حذف السيارة');
}

/* ---------- add / edit single car ---------- */
function viewCarForm(){
  pend={};
  const c=ctx.id?CARS.find(x=>x.id===ctx.id):null;
  const d=c?(CDOCS[c.id]||{}):{};
  const inputs=FIELDS.map(([k,l,t])=>{
    const v=c&&c[k]!=null?c[k]:'';
    if(t==='area')return `<label>${l}</label><textarea id="f-${k}" maxlength="1000">${esc(v)}</textarea>`;
    return `<label>${l}${k==='plate'?' *':''}</label><input id="f-${k}" ${t==='date'?'type="date"':''} maxlength="${MAXLEN[k]||200}" value="${esc(v)}">`;
  }).join('');
  return `<h1>${c?'تعديل السيارة':'سيارة جديدة'}</h1>
  ${inputs}
  <h2>المستندات (صور)</h2>
  ${DOCS.map(([t,l])=>{
    const url=d[t]?URLS[d[t].path]:'';
    return `<div class="card-item"><b>${l}</b>
      <img class="img-preview" id="pv-${t}" alt="" ${url?`src="${esc(url)}" style="display:block"`:''}>
      <div class="two" style="margin-top:8px"><button class="ghost" type="button" onclick="pickDoc('${t}')">📷 ${d[t]?'استبدال':'اختيار صورة'}</button><button class="ghost danger" type="button" onclick="clearDoc('${t}')">إزالة</button></div></div>`;
  }).join('')}
  <button class="go" onclick="saveCar()">حفظ</button>
  <button class="ghost wide" onclick="history.back()">إلغاء</button>`;
}
async function pickDoc(t){
  try{
    const blob=await (typeof captureDocumentImage==='function'?captureDocumentImage():pickImage());
    if(!blob)return;
    pend[t]=blob;
    const pv=$('#pv-'+t);pv.src=URL.createObjectURL(blob);pv.style.display='block';
  }catch(e){toast(errMsg(e))}
}
function clearDoc(t){
  const had=ctx.id&&(CDOCS[ctx.id]||{})[t];
  if(had)pend[t]='remove';else delete pend[t];
  const pv=$('#pv-'+t);pv.removeAttribute('src');pv.style.display='none';
}
async function compressCarDocument(blob){
  if(!(blob instanceof Blob))throw new Error('ملف الصورة غير صالح');
  const compress=window.imageCompression;
  if(typeof compress!=='function')throw new Error('مكتبة ضغط الصور غير متاحة؛ لم يتم رفع الصورة');
  const input=new File([blob],'car-document.jpg',{type:blob.type||'image/jpeg',lastModified:Date.now()});
  return await compress(input,{maxWidthOrHeight:2560,maxSizeMB:1.5,useWebWorker:false,fileType:'image/jpeg',initialQuality:0.94});
}
async function saveCar(){
  const row={};
  FIELDS.forEach(([k,,t])=>{const v=$('#f-'+k).value.trim();row[k]=t==='date'?(v||null):v});
  if(!row.plate)return toast('اكتب رقم اللوحة');
  await run(async()=>{
    let id=ctx.id;
    if(id)ck(await sb.from('cars').update(row).eq('id',id));
    else{const r=ck(await sb.from('cars').insert(row).select().single());id=ctx.id=r.data.id} // a retry after a failed upload edits this car
    const old=CDOCS[id]||{};
    for(const [t] of DOCS){
      const p=pend[t];
      if(!p)continue;
      if(p==='remove'){if(old[t])await delDocRow(old[t]);delete pend[t];continue}
      const compressed=await compressCarDocument(p);
      const path=`${WORKSPACE_ID}/${id}/${t}-${Date.now()}.jpg`;
      ck(await sb.storage.from(BUCKET).upload(path,compressed,{contentType:'image/jpeg'}));
      ck(await sb.from('car_documents').upsert({car_id:id,doc_type:t,path},{onConflict:'car_id,doc_type'}));
      if(old[t])await sb.storage.from(BUCKET).remove([old[t].path]);
      delete pend[t];
    }
    await loadCars();await ensureUrls(id);
    go('carView',{id},true);
  },'تم الحفظ');
}

/* ---------- bulk import (CSV / JSON) ---------- */
function importModal(){
  modal(`<h2>استيراد سيارات من ملف</h2>
  <p class="muted">ملف CSV أو JSON بالأعمدة دي بالترتيب ده بالظبط (آخر عمود اختياري). السطر الأول ممكن يكون عناوين.</p>
  <ol class="cols">${FIELDS.map(f=>`<li>${f[1]}${f[2]==='date'?' <span dir="ltr">(YYYY-MM-DD)</span>':''}</li>`).join('')}</ol>
  <p class="muted">لو رقم اللوحة موجود قبل كده، بياناته بتتحدّث بدل ما تتكرر.</p>
  <button class="go" onclick="pickImportFile()">اختيار الملف</button>`);
}

// minimal RFC-4180 CSV parser: quotes, escaped quotes, newlines inside quotes, auto delimiter (, ; tab)
function parseCsv(t){
  if(t.charCodeAt(0)===0xFEFF)t=t.slice(1);
  const head=t.slice(0,t.search(/[\r\n]|$/));
  const dl=[',',';','\t'].map(c=>[c,head.split(c).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const rows=[];let row=[],f='',q=false;
  for(let i=0;i<t.length;i++){
    const ch=t[i];
    if(q){if(ch==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=ch}
    else if(ch==='"')q=true;
    else if(ch===dl){row.push(f);f=''}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&t[i+1]==='\n')i++;row.push(f);f='';rows.push(row);row=[]}
    else f+=ch;
  }
  if(f!==''||row.length){row.push(f);rows.push(row)}
  return rows.filter(r=>r.some(c=>String(c).trim()!==''));
}
async function readText(file){
  const buf=await file.arrayBuffer();
  try{return new TextDecoder('utf-8',{fatal:true}).decode(buf)}
  catch{return new TextDecoder('windows-1256').decode(buf)} // Arabic Excel "CSV" exports
}
function parseDate(s){
  s=num(s||'');
  let m=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/),y,mo,d;
  if(m){y=+m[1];mo=+m[2];d=+m[3]}
  else if((m=s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))){d=+m[1];mo=+m[2];y=+m[3]}
  else return null;
  const dt=new Date(y,mo-1,d);
  if(dt.getFullYear()!==y||dt.getMonth()!==mo-1||dt.getDate()!==d)return null;
  return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
// file text -> array of value arrays
function tableFromFile(name,text){
  if(/\.json$/i.test(name)||/^\s*[\[{]/.test(text)){
    let j=JSON.parse(text);
    if(!Array.isArray(j))j=Object.values(j).find(Array.isArray);
    if(!Array.isArray(j))throw new Error('ملف JSON لازم يحتوي على قائمة سيارات');
    return j.map(it=>Array.isArray(it)?it:(it&&typeof it==='object'?(it.plate!==undefined?FIELDS.map(f=>it[f[0]]):Object.values(it)):[]));
  }
  return parseCsv(text);
}
function buildRows(table){
  let rows=table;
  if(rows.length&&/لوحة|plate/i.test(String(rows[0][0]||'')))rows=rows.slice(1); // header line
  const byPlate=new Map();let skipped=0,badDates=0;
  for(const r of rows){
    const cells=FIELDS.map((_,i)=>String(r[i]==null?'':r[i]).trim());
    if(!cells[0]){skipped++;continue}
    const o={};
    FIELDS.forEach(([k,,t],i)=>{
      let v=cells[i];
      if(t==='date'){const p=parseDate(v);if(v&&!p)badDates++;v=p}
      else v=v.slice(0,MAXLEN[k]||200);
      o[k]=v;
    });
    byPlate.set(o.plate,o); // duplicate plates inside the file: last one wins
  }
  return {rows:[...byPlate.values()],skipped,badDates,dupInFile:rows.length-skipped-byPlate.size};
}
async function pickImportFile(){
  const f=await pickFile('.csv,.json,text/csv,application/json,text/plain,*/*');
  if(!f)return;
  await run(async()=>{
    let res;
    try{res=buildRows(tableFromFile(f.name,await readText(f)))}
    catch(e){return toast('الملف مش مفهوم: '+e.message)}
    if(!res.rows.length)return toast('مفيش سيارات صالحة في الملف (رقم اللوحة مطلوب)');
    const have=new Set(CARS.map(c=>c.plate));
    const upd=res.rows.filter(r=>have.has(r.plate)).length,add=res.rows.length-upd;
    if(!confirm(`هيتم استيراد ${res.rows.length} سيارة: ${add} جديدة${upd?` و${upd} تحديث لسيارات موجودة`:''}. نكمل؟`))return;
    const CH=200;
    for(let i=0;i<res.rows.length;i+=CH){
      toast(`جاري الاستيراد… ${Math.min(i+CH,res.rows.length)}/${res.rows.length}`);
      const chunk=res.rows.slice(i,i+CH).map(r=>({...r,user_id:WORKSPACE_ID}));
      ck(await sb.from('cars').upsert(chunk,{onConflict:'user_id,plate'}));
    }
    await loadCars();carQ='';carFilter='';carLimit=PAGE;
    render();
    const notes=[];
    if(res.skipped)notes.push(`${res.skipped} صف بدون رقم لوحة اتخطّى`);
    if(res.dupInFile)notes.push(`${res.dupInFile} صف مكرر داخل الملف`);
    if(res.badDates)notes.push(`${res.badDates} تاريخ مش بصيغة YYYY-MM-DD اتسجّل فاضي`);
    modal(`<h2>✅ تم الاستيراد</h2><p><b>${res.rows.length}</b> سيارة (${add} جديدة${upd?`، ${upd} متحدّثة`:''}).</p>${notes.length?`<p class="muted">${notes.join('<br>')}</p>`:''}<button class="go" onclick="closeModal()">تمام</button>`);
  });
}

/* ---------- PDF: all car fields + all document images ---------- */
// Arabic text is drawn on a canvas (the browser shapes/orders RTL correctly, jsPDF cannot),
// then each canvas page is placed in the PDF as an image.
async function buildCarPdf(car,items){
  try{await Promise.all([document.fonts.load(`600 30px Cairo`),document.fonts.load(`800 30px Cairo`)])}catch{}
  const W=1240,H=1754,M=90,FONT='Cairo, Tahoma, sans-serif',INK='#10303a',MUTED='#5b7279',ACC='#0e7c86',LBL=360;
  const pages=[],urls=[];let x,y;
  const page=()=>{
    const c=document.createElement('canvas');c.width=W;c.height=H;
    x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);
    x.direction='rtl';x.textAlign='right';x.textBaseline='top';
    pages.push(c);y=M;
  };
  const load=blob=>new Promise((res,rej)=>{const u=URL.createObjectURL(blob);urls.push(u);const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('صورة تالفة'));i.src=u});
  const wrap=(text,maxW)=>{
    const lines=[];let cur='';
    for(const w of String(text).split(/\s+/)){const t=cur?cur+' '+w:w;if(cur&&x.measureText(t).width>maxW){lines.push(cur);cur=w}else cur=t}
    if(cur)lines.push(cur);return lines.length?lines:['—'];
  };
  try{
    page();
    x.fillStyle=INK;x.font=`800 50px ${FONT}`;x.fillText('بيانات السيارة',W-M,y);y+=86;
    x.fillStyle=ACC;x.fillRect(M,y,W-2*M,4);y+=28;
    for(const [k,l] of FIELDS){
      x.font=`800 31px ${FONT}`;
      const lines=wrap(car[k]||'—',W-2*M-LBL-20);
      if(y+lines.length*46>H-M)page();
      x.font=`600 29px ${FONT}`;x.fillStyle=MUTED;x.fillText(l+':',W-M,y);
      x.font=`800 31px ${FONT}`;x.fillStyle=INK;
      lines.forEach((ln,i)=>x.fillText(ln,W-M-LBL,y+i*46));
      y+=lines.length*46+8;
    }
    y+=24;
    for(const it of items){
      const img=await load(it.blob);
      const s=Math.min((W-2*M)/img.width,720/img.height),w=img.width*s,h=img.height*s;
      if(y+70+h>H-M)page();
      x.fillStyle=INK;x.font=`800 38px ${FONT}`;x.fillText(it.label,W-M,y);y+=68;
      const px=(W-w)/2;
      x.drawImage(img,px,y,w,h);
      x.strokeStyle='#d5e0de';x.lineWidth=2;x.strokeRect(px,y,w,h);
      y+=h+64;
    }
    const {jsPDF}=window.jspdf;
    const pdf=new jsPDF({unit:'mm',format:'a4',orientation:'portrait'});
    pages.forEach((c,i)=>{if(i)pdf.addPage();pdf.addImage(c.toDataURL('image/jpeg',.88),'JPEG',0,0,210,297)});
    return pdf.output('blob');
  }finally{urls.forEach(u=>URL.revokeObjectURL(u))}
}
async function shareCarPdf(id){
  const c=CARS.find(x=>x.id===id);if(!c)return;
  await run(async()=>{
    toast('جاري تجهيز الـ PDF…');
    const d=CDOCS[id]||{},items=[];
    for(const [t,l] of DOCS)if(d[t])items.push({label:l,blob:await dl(d[t].path)});
    const pdf=await buildCarPdf(c,items);
    await shareFile(pdf,`${fileBase(c)}.pdf`,`${carTitle(c)} - ${c.plate}`);
  });
}
