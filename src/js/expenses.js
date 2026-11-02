let S={wallets:[],accounts:[],tx:[]},kind='d',F={a:'',w:'',m:'',q:''},lastW='',transferMode=false;
const TYPES={cash:'نقدي',visa:'فيزا',bank:'بنك'};
const ADJ_ACCOUNT='تسوية';
const typeName=t=>TYPES[t]||t;
const wById=id=>S.wallets.find(w=>w.id===id);
const aById=id=>S.accounts.find(a=>a.id===id);
const wName=id=>(wById(id)||{name:'(محذوفة)'}).name;
const aName=id=>(aById(id)||{name:'(محذوف)'}).name;
const txWalletDelta=(t,id)=>t.k==='t'?(t.w===id?-t.a:t.to===id?t.a:0):t.w===id?(t.k==='c'?t.a:-t.a):0;
const bal=w=>round2(S.tx.reduce((a,t)=>a+txWalletDelta(t,w.id),w.opening));
const sign=n=>n<0?'neg':'pos';
const opts=(arr,sel,all)=>(all?`<option value="">${all}</option>`:'')+arr.map(([v,l])=>`<option value="${esc(v)}"${v===sel?' selected':''}>${esc(l)}</option>`).join('');
const wOpts=(sel,all)=>opts(S.wallets.map(w=>[w.id,`${w.name} (${typeName(w.type)})`]),sel,all);
const aOpts=(sel,all)=>opts(S.accounts.map(a=>[a.id,a.name]),sel,all);

async function loadExpenses(){
  const [w,a,t]=await Promise.all([
    fetchAll(()=>sb.from('wallets').select('*').order('created_at').order('id')),
    fetchAll(()=>sb.from('accounts').select('*').order('created_at').order('id')),
    fetchAll(()=>sb.from('transactions').select('*').order('tx_date',{ascending:false}).order('created_at',{ascending:false}).order('id'))
  ]);
  S.wallets=w.map(x=>({id:x.id,name:x.name,type:x.type,opening:+x.opening_balance}));
  S.accounts=a.map(x=>({id:x.id,name:x.name}));
  S.tx=t.map(x=>({id:x.id,k:x.kind,w:x.wallet_id,to:x.to_wallet_id||null,ac:x.account_id,a:+x.amount,d:x.tx_date,n:x.note||'',source:x.source||'',adj:!!x.is_adjustment}));
}
async function reloadExp(){await loadExpenses();render()}

/* ---------- home ---------- */
function viewExpenses(){
  if(!LOADED)return loadingHtml();
  const total=round2(S.wallets.reduce((a,w)=>a+bal(w),0));
  let h=`<h1>المصاريف</h1>
  <div class="two"><button class="go" style="margin:0" onclick="go('add')">+ حركة جديدة</button><button class="ghost" onclick="go('log')">السجل</button>
  <button class="ghost wide" onclick="go('report')">التقارير الشهرية (دائن / مدين)</button></div>
  <button class="ghost wide" onclick="go('manage')">المحافظ والحسابات</button>
  <div class="total"><small>إجمالي الرصيد المتبقي</small><b class="num">${fmt(total)} ج.م</b></div>
  <h2>رصيد كل محفظة</h2>`;
  h+=S.wallets.length?S.wallets.map(w=>{const b=bal(w);return `<div class="row"><div>${esc(w.name)}<small>${typeName(w.type)}</small></div><div class="acts"><span class="num ${sign(b)}">${fmt(b)} ج.م</span><button class="ghost" onclick="adjustModal('${w.id}')">تسوية</button></div></div>`}).join('')
    :emptyBox('👛','لسه مفيش محافظ','ضيف أول محفظة (كاش أو فيزا أو بنك) وحط رصيدها الافتتاحي.','+ إضافة محفظة',"go('manage')");
  h+=`<h2>نسخة احتياطية</h2><div class="two"><button class="ghost" onclick="exportData()">تصدير JSON</button><button class="ghost" onclick="importData()">استيراد JSON</button></div>
  <button class="ghost wide" onclick="logout()">تسجيل الخروج (${esc(ME.email)})</button>`;
  return h;
}

/* ---------- balance reconciliation ---------- */
function adjustModal(id){
  const w=wById(id),b=bal(w);
  modal(`<h2>تسوية رصيد: ${esc(w.name)}</h2>
  <p class="muted">الرصيد في التطبيق: <b class="num ${sign(b)}">${fmt(b)} ج.م</b></p>
  <label>الرصيد الفعلي دلوقتي</label><input id="ar" type="text" inputmode="decimal" dir="ltr">
  <p class="muted">التطبيق هيسجّل الفرق تلقائيًا كحركة "تسوية".</p>
  <button class="go" onclick="doAdjust('${id}')">تسوية</button>`);
  setTimeout(()=>$('#ar')&&$('#ar').focus(),50);
}
async function doAdjust(id){
  const w=wById(id),real=parseFloat(num($('#ar').value));
  if(!isFinite(real))return toast('اكتب الرصيد الفعلي');
  const diff=round2(real-bal(w));
  if(diff===0){closeModal();return toast('مفيش فرق، الرصيد مظبوط')}
  await run(async()=>{
    let acc=S.accounts.find(a=>a.name===ADJ_ACCOUNT);
    if(!acc){const r=ck(await sb.from('accounts').insert({name:ADJ_ACCOUNT}).select().single());acc={id:r.data.id,name:ADJ_ACCOUNT}}
    ck(await sb.from('transactions').insert({wallet_id:id,account_id:acc.id,kind:diff>0?'c':'d',amount:Math.abs(diff),tx_date:today(),note:'تسوية رصيد',is_adjustment:true}));
    await reloadExp();
  },`تم تسجيل فرق ${fmt(Math.abs(diff))} ج.م`);
}

/* ---------- add transaction ---------- */
function viewAdd(){
  if(!LOADED)return loadingHtml();
  if(!S.wallets.length||!S.accounts.length)
    return `<h1>حركة جديدة</h1>`+emptyBox('📒','محتاج محفظة وحساب الأول','لازم تضيف محفظة واحدة وحساب واحد على الأقل قبل تسجيل أي حركة.','المحافظ والحسابات',"go('manage')");
  kind='d';transferMode=false;
  return `<h1>حركة مالية جديدة</h1>
  <div class="two seg"><button id="kd" class="ghost on" onclick="setKind('d')">صرف</button><button id="kc" class="ghost" onclick="setKind('c')">قبض / إيداع</button></div>
  <button class="ghost wide" onclick="setTransferMode()">⇄ تحويل بين محفظتين</button>
  <label>المحفظة</label><select id="fw">${wOpts(lastW)}</select>
  <div id="toWalletBox" hidden><label>إلى محفظة</label><select id="tw">${wOpts('')}</select></div>
  <div id="accountBox"><label>الحساب / البند</label><select id="fa">${aOpts('')}</select></div>
  <label>المبلغ</label><input id="am" type="text" inputmode="decimal" dir="ltr" placeholder="0.00">
  <label>التاريخ</label><input id="dt" type="date" value="${today()}">
  <label>مصدر الأموال / الجهة</label><input id="src" maxlength="120" placeholder="عميل، مورد، جهة، أو مصدر التمويل">
  <label>ملاحظة</label>
  <div class="inrow"><input id="nt" maxlength="120" placeholder="اكتب أو اتكلم"><button id="mic" class="mic" type="button" onclick="dictate()" aria-label="إدخال صوتي">🎤</button></div>
  <button class="go" onclick="saveTx()">حفظ</button>
  <button class="ghost wide" onclick="history.back()">إلغاء</button>`;
}
function setKind(k){transferMode=false;kind=k;$('#kd').classList.toggle('on',k==='d');$('#kc').classList.toggle('on',k==='c');$('#toWalletBox').hidden=true;$('#accountBox').hidden=false}
function setTransferMode(){transferMode=true;$('#toWalletBox').hidden=false;$('#accountBox').hidden=true;$('#kd').classList.remove('on');$('#kc').classList.remove('on')}
async function dictate(){
  const b=$('#mic');b.classList.add('rec');
  try{
    const t=await listen();
    if(t){const n=$('#nt');n.value=((n.value?n.value+' ':'')+t).slice(0,120)}
  }catch(e){toast((e&&e.message)||'الصوت مش متاح')}
  finally{b.classList.remove('rec')}
}
async function saveTx(){
  const wallet_id=$('#fw').value,to_wallet_id=transferMode?$('#tw').value:null,account_id=transferMode?null:$('#fa').value,amount=Number(num($('#am').value)),tx_date=$('#dt').value||today(),note=$('#nt').value.trim().slice(0,120),source=$('#src').value.trim().slice(0,120);
  if(!wallet_id)return toast('اختار المحفظة');
  if(!(Number.isFinite(amount)&&amount>0))return toast('اكتب مبلغ صحيح أكبر من صفر');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(tx_date))return toast('اختار تاريخ صحيح');
  if(transferMode&&(!to_wallet_id||to_wallet_id===wallet_id))return toast('اختار محفظتين مختلفتين');
  if(!transferMode&&!account_id)return toast('اختار الحساب');
  await run(async()=>{
    ck(await sb.from('transactions').insert({wallet_id,to_wallet_id,account_id,kind:transferMode?'t':kind,amount:round2(amount),tx_date,note,source}));
    lastW=wallet_id;await loadExpenses();go('exp',null,true);
  },'تم الحفظ');
}

/* ---------- log ---------- */
function viewLog(){
  if(!LOADED)return loadingHtml();
  return `<h1>السجل</h1>
  <label>بحث في الملاحظات</label><input id="fq" value="${esc(F.q)}" oninput="F.q=this.value;renderLog()">
  <div class="two"><div><label>الشهر</label><input id="fm" type="month" value="${esc(F.m)}" onchange="F.m=this.value;renderLog()"></div>
  <div><label>الحساب</label><select onchange="F.a=this.value;renderLog()">${aOpts(F.a,'كل الحسابات')}</select></div></div>
  <label>المحفظة</label><select onchange="F.w=this.value;renderLog()">${wOpts(F.w,'كل المحافظ')}</select>
  <button class="ghost wide" onclick="F={a:'',w:'',m:'',q:''};render()">مسح الفلاتر</button>
  <div id="logList">${logHtml()}</div>`;
}
function renderLog(){const l=$('#logList');if(l)l.innerHTML=logHtml()}
function logHtml(){
  const q=F.q.trim().toLowerCase();
  const list=S.tx.filter(t=>(!F.a||t.ac===F.a)&&(!F.w||t.w===F.w||t.to===F.w)&&(!F.m||t.d.slice(0,7)===F.m)&&(!q||[t.n,t.source,aName(t.ac),wName(t.w),wName(t.to)].join(' ').toLowerCase().includes(q)));
  const dr=round2(list.reduce((a,t)=>t.k==='d'?a+t.a:a,0)),cr=round2(list.reduce((a,t)=>t.k==='c'?a+t.a:a,0)),net=round2(cr-dr),transfers=list.filter(t=>t.k==='t').length;
  let h=`<div class="row sum"><div class="sumgrid"><span>مدين<b class="num neg">${fmt(dr)}</b></span><span>دائن<b class="num pos">${fmt(cr)}</b></span><span>الصافي<b class="num ${sign(net)}">${fmt(net)}</b></span><span>تحويلات<b class="num">${transfers}</b></span></div></div>`;
  if(!list.length)return h+(S.tx.length?'<p class="empty">مفيش حركات مطابقة.</p>':emptyBox('🧾','لسه مفيش حركات','أول حركة تسجلها هتظهر هنا.','+ حركة جديدة',"go('add')"));
  const MAX=300;
  h+=list.slice(0,MAX).map(t=>`<div class="row"><div>${t.k==='t'?'تحويل بين المحافظ':esc(aName(t.ac))}${t.n?' — '+esc(t.n):''}<small>${esc(t.d)} · ${esc(wName(t.w))}${t.k==='t'?' ← '+esc(wName(t.to)):''}${t.source?' · المصدر: '+esc(t.source):''}</small></div><div class="acts"><span class="num ${t.k==='c'||(t.k==='t'&&t.to===F.w)?'pos':t.k==='t'?'':'neg'}">${t.k==='t'?'⇄ ':t.k==='c'?'+':'−'}${fmt(t.a)}</span><button class="ghost" onclick="editTx('${t.id}')">تعديل</button><button class="x" onclick="delTx('${t.id}')" aria-label="حذف">✕</button></div></div>`).join('');
  if(list.length>MAX)h+=`<p class="empty">معروض أحدث ${MAX} حركة من ${list.length} (الإجماليات لكل الحركات المطابقة).</p>`;
  return h;
}
async function delTx(id){
  if(!confirm('حذف الحركة دي؟'))return;
  await run(async()=>{ck(await sb.from('transactions').delete().eq('id',id));await loadExpenses();renderLog()},'تم الحذف');
}

/* ---------- wallets & accounts management ---------- */
function viewManage(){
  if(!LOADED)return loadingHtml();
  return `<h1>المحافظ والحسابات</h1>
  <h2>المحافظ</h2>
  ${S.wallets.map(w=>`<div class="row"><div>${esc(w.name)}<small>${typeName(w.type)} · افتتاحي ${fmt(w.opening)} ج.م</small></div><div class="acts"><button class="ghost" onclick="walletModal('${w.id}')">تعديل</button><button class="x" onclick="delWallet('${w.id}')" aria-label="حذف">✕</button></div></div>`).join('')||emptyBox('👛','لسه مفيش محافظ','اضغط "+ محفظة جديدة" لإضافة أول محفظة.')}
  <button class="ghost wide" onclick="walletModal()">+ محفظة جديدة</button>
  <h2>الحسابات</h2>
  ${S.accounts.map(a=>`<div class="row"><div>${esc(a.name)}</div><div class="acts"><button class="ghost" onclick="accountModal('${a.id}')">تعديل</button><button class="x" onclick="delAccount('${a.id}')" aria-label="حذف">✕</button></div></div>`).join('')||emptyBox('🗂️','لسه مفيش حسابات','اضغط "+ حساب جديد" (مثل: مصاريف البيت، فواتير...).')}
  <button class="ghost wide" onclick="accountModal()">+ حساب جديد</button>`;
}
function walletModal(id){
  const w=id?wById(id):{name:'',type:'cash',opening:0};
  modal(`<h2>${id?'تعديل محفظة':'محفظة جديدة'}</h2>
  <label>الاسم</label><input id="wn" maxlength="80" value="${esc(w.name)}">
  <label>النوع</label><select id="wt">${opts(Object.entries(TYPES),w.type)}</select>
  <label>الرصيد الافتتاحي</label><input id="wo" type="text" inputmode="decimal" dir="ltr" value="${w.opening}" ${id?"disabled":""}><small class="muted">${id?"الرصيد الافتتاحي ثابت للحفاظ على رصيد المحفظة الحالي.":"رصيد بداية المحفظة فقط."}</small>
  <button class="go" onclick="saveWallet(${id?`'${id}'`:''})">حفظ</button>`);
}
async function saveWallet(id){
  const name=$('#wn').value.trim(),type=$('#wt').value,opening_balance=parseFloat(num($('#wo').value||'0'));
  if(!name)return toast('اكتب اسم المحفظة');
  if(!isFinite(opening_balance))return toast('الرصيد الافتتاحي مش صحيح');
  await run(async()=>{
    const row=id?{name,type}:{name,type,opening_balance};
    ck(id?await sb.from('wallets').update(row).eq('id',id):await sb.from('wallets').insert(row));
    await reloadExp();
  },'تم الحفظ');
}
async function delWallet(id){
  if(!confirm(`حذف المحفظة "${wName(id)}"؟`))return;
  await run(async()=>{ck(await sb.from('wallets').delete().eq('id',id));await reloadExp()},'تم الحذف');
}
function accountModal(id){
  const a=id?aById(id):{name:''};
  modal(`<h2>${id?'تعديل حساب':'حساب جديد'}</h2>
  <label>الاسم</label><input id="an" maxlength="80" value="${esc(a.name)}">
  <button class="go" onclick="saveAccount(${id?`'${id}'`:''})">حفظ</button>`);
}
async function saveAccount(id){
  const name=$('#an').value.trim();
  if(!name)return toast('اكتب اسم الحساب');
  await run(async()=>{
    ck(id?await sb.from('accounts').update({name}).eq('id',id):await sb.from('accounts').insert({name}));
    await reloadExp();
  },'تم الحفظ');
}
async function delAccount(id){
  if(!confirm(`حذف الحساب "${aName(id)}"؟`))return;
  await run(async()=>{ck(await sb.from('accounts').delete().eq('id',id));await reloadExp()},'تم الحذف');
}

/* ---------- backup & restore ---------- */
async function exportData(){
  await run(async()=>{
    const data={app:'cashbook',version:2,exported_at:new Date().toISOString(),
      wallets:S.wallets.map(w=>({name:w.name,type:w.type,opening_balance:w.opening})),
      accounts:S.accounts.map(a=>a.name),
      transactions:S.tx.map(t=>({wallet:S.wallets.findIndex(w=>w.id===t.w),to_wallet:S.wallets.findIndex(w=>w.id===t.to),account:t.ac?aName(t.ac):'',kind:t.k,amount:t.a,date:t.d,note:t.n,source:t.source||'',adjustment:t.adj}))};
    const blob=new Blob([JSON.stringify(data,null,1)],{type:'application/json'});
    await shareFile(blob,`cashbook-backup-${today()}.json`,'نسخة احتياطية - دفتر النقدية');
  });
}
async function importData(){
  const f=await pickFile('.json,application/json');
  if(!f)return;
  let d;
  try{d=JSON.parse(await f.text())}catch{return toast('الملف مش صالح')}
  if(!d||!Array.isArray(d.wallets)||!Array.isArray(d.accounts)||!Array.isArray(d.transactions))return toast('الملف ده مش نسخة احتياطية صحيحة');
  if(!confirm(`استيراد ${d.wallets.length} محفظة و${d.transactions.length} حركة؟\nالموجود مش هيتمسح، والحركات المكررة بتتخطى.`))return;
  await run(async()=>{
    // wallets: match by name+type, create the rest
    const wmap=[];
    for(const w of d.wallets){
      const name=String(w.name||'').trim().slice(0,80),type=TYPES[w.type]?w.type:'cash';
      if(!name){wmap.push(null);continue}
      let ex=S.wallets.find(x=>x.name===name&&x.type===type);
      if(!ex){
        const ob=parseFloat(w.opening_balance!=null?w.opening_balance:w.opening);
        const r=ck(await sb.from('wallets').insert({name,type,opening_balance:isFinite(ob)?ob:0}).select().single());
        ex={id:r.data.id,name,type,opening:+r.data.opening_balance};S.wallets.push(ex);
      }
      wmap.push(ex.id);
    }
    // accounts by name
    const amap={};S.accounts.forEach(a=>amap[a.name]=a.id);
    const accNames=new Set(d.accounts.concat(d.transactions.map(t=>t.account)).map(x=>String(x||'').trim().slice(0,80)).filter(Boolean));
    for(const name of accNames)if(!amap[name]){const r=ck(await sb.from('accounts').insert({name}).select().single());amap[name]=r.data.id}
    // transactions, skipping ones that already exist
    const key=(w,a,k,amt,dt,n)=>[w,a,k,round2(amt),dt,n].join('|');
    const have={};S.tx.forEach(t=>{const k=key(t.w,t.k==='t'?t.to:t.ac,t.k,t.a,t.d,t.n);have[k]=(have[k]||0)+1});
    const rows=[];let skipped=0;
    for(const t of d.transactions){
      const w=wmap[t.wallet],to=t.kind==='t'?wmap[t.to_wallet]:null,a=t.kind==='t'?null:amap[String(t.account||'').trim()],amt=+t.amount,note=String(t.note||'').slice(0,120);
      if(!w||!(amt>0)||!['c','d','t'].includes(t.kind)||(t.kind==='t'?(!to||to===w):!a)||!/^\d{4}-\d{2}-\d{2}$/.test(t.date)){skipped++;continue}
      const k=key(w,a||to,t.kind,amt,t.date,note);
      if(have[k]>0){have[k]--;skipped++;continue}
      rows.push({wallet_id:w,to_wallet_id:to,account_id:a,kind:t.kind,amount:round2(amt),tx_date:t.date,note,source:String(t.source||'').slice(0,120),is_adjustment:!!t.adjustment});
    }
    for(let i=0;i<rows.length;i+=200)ck(await sb.from('transactions').insert(rows.slice(i,i+200)));
    await reloadExp();
    toast(`تم استيراد ${rows.length} حركة${skipped?` (تخطّي ${skipped})`:''}`);
  });
}


function viewReport(){
 const m=F.m||today().slice(0,7);
 return '<h1>التقارير الشهرية</h1><label>الشهر</label><input id="rm" type="month" value="'+esc(m)+'" onchange="F.m=this.value;renderReport()">'+
 '<div class="two seg"><button class="ghost '+(!F.w?'on':'')+'" onclick="F.w=\'\';render()">تقرير الحساب</button><button class="ghost '+(F.w?'on':'')+'" onclick="F.w=\'all\';render()">تقرير المحفظة</button></div>'+
 '<label>'+(F.w?'المحفظة':'الحساب')+'</label><select id="rsel" onchange="F.'+(F.w?'w':'a')+'=this.value;renderReport()">'+(F.w?wOpts(F.w==='all'?'':F.w,'اختار المحفظة'):aOpts(F.a,'اختار الحساب'))+'</select><div id="reportBody">'+reportHtml(m)+'</div>';
}
function renderReport(){const m=$('#rm')?$('#rm').value:F.m||today().slice(0,7);F.m=m;const el=$('#reportBody');if(el)el.innerHTML=reportHtml(m)}
function reportMonthEnd(m){const y=Number(m.slice(0,4)),mo=Number(m.slice(5,7)),d=new Date(y,mo,0).getDate();return m+'-'+String(d).padStart(2,'0')}
function reportHtml(m){
 const walletMode=!!F.w,isW=walletMode&&F.w!=='all',id=isW?F.w:F.a;if(walletMode&&F.w==='all')return '<p class="empty">اختار المحفظة لعرض التقرير.</p>';if(!id||id==='all')return '<p class="empty">اختار محفظة أو حساب لعرض التقرير.</p>';
 const start=m+'-01',end=reportMonthEnd(m),month=S.tx.filter(t=>t.d>=start&&t.d<=end);
 let opening=0,credit=0,debit=0,rows=[];
 if(isW){const w=wById(id);if(!w)return '<p class="empty">المحفظة غير موجودة.</p>';opening=w.opening+S.tx.filter(t=>t.d<start).reduce((v,t)=>v+txWalletDelta(t,id),0);rows=month.filter(t=>t.w===id||t.to===id);credit=rows.reduce((v,t)=>v+(t.k==='c'&&t.w===id?t.a:t.k==='t'&&t.to===id?t.a:0),0);debit=rows.reduce((v,t)=>v+(t.k==='d'&&t.w===id?t.a:t.k==='t'&&t.w===id?t.a:0),0);}
 else{rows=month.filter(t=>t.ac===id&&t.k!=='t');opening=S.tx.filter(t=>t.d<start&&t.ac===id&&t.k!=='t').reduce((v,t)=>v+(t.k==='c'?t.a:-t.a),0);credit=rows.reduce((v,t)=>v+(t.k==='c'?t.a:0),0);debit=rows.reduce((v,t)=>v+(t.k==='d'?t.a:0),0);}
 opening=round2(opening);credit=round2(credit);debit=round2(debit);const closing=round2(opening+credit-debit),name=isW?wName(id):aName(id);
 let h='<div class="card-item"><b>'+esc(name)+' — '+esc(m)+'</b><div class="kv"><span>رصيد أول المدة</span><b class="num">'+fmt(opening)+' ج.م</b></div><div class="kv"><span>الدائن (داخل)</span><b class="num pos">'+fmt(credit)+' ج.م</b></div><div class="kv"><span>المدين (خارج)</span><b class="num neg">'+fmt(debit)+' ج.م</b></div><div class="kv"><b>رصيد آخر المدة</b><b class="num">'+fmt(closing)+' ج.م</b></div></div>'+
 '<div class="two"><button class="ghost" onclick="exportReport(\''+m+'\',\''+id+'\','+isW+')">تصدير Excel</button><button class="ghost" onclick="printReport()">طباعة / PDF</button></div><h2>تفاصيل الحركات ('+rows.length+')</h2>';
 if(!rows.length)return h+'<p class="empty">لا توجد حركات خلال الشهر.</p>';
 return h+rows.sort((a,b)=>a.d.localeCompare(b.d)).map(t=>{const dir=t.k==='t'?(t.to===id?'دائن تحويل':'مدين تحويل'):t.k==='c'?'دائن':'مدين';const amount=(t.k==='t'?(t.to===id?'+':'−'):t.k==='c'?'+':'−')+fmt(t.a);return '<div class="row"><div>'+dir+' · '+esc(t.n||(t.k==='t'?'تحويل بين المحافظ':''))+'<small>'+esc(t.d)+' · '+esc(t.source||(t.k==='t'?'تحويل داخلي':aName(t.ac)))+'</small></div><b class="num '+(dir.startsWith('دائن')?'pos':'neg')+'">'+amount+'</b></div>'}).join('');
}
async function exportReport(m,id,isW){
 const start=m+'-01',end=reportMonthEnd(m),rows=S.tx.filter(t=>t.d>=start&&t.d<=end&&(isW?(t.w===id||t.to===id):t.ac===id));
 const data=[['التاريخ','النوع','المحفظة','المحفظة المستقبلة','الحساب','مصدر الأموال','البيان','المبلغ']];
 rows.forEach(t=>data.push([t.d,t.k==='t'?'تحويل':t.k==='c'?'دائن':'مدين',wName(t.w),t.to?wName(t.to):'',t.ac?aName(t.ac):'',t.source||'',t.n,t.a]));
 const csv='\uFEFF'+data.map(r=>r.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 await shareFile(new Blob([csv],{type:'text/csv;charset=utf-8'}),'report-'+m+'.csv','تقرير '+m);
}
function printReport(){window.print()}


/* ---------- safe transaction editing ---------- */
function editTx(id){
  const t=S.tx.find(x=>x.id===id);if(!t)return toast('الحركة غير موجودة');
  modal('<h2>تعديل الحركة المالية</h2>'+
    '<label>نوع الحركة</label><select id="etk" onchange="toggleEditKind()">'+opts([['d','صرف'],['c','قبض / إيداع'],['t','تحويل بين المحافظ']],t.k)+'</select>'+
    '<label>من محفظة</label><select id="etw">'+wOpts(t.w)+'</select>'+
    '<div id="editToBox" '+(t.k==='t'?'':'hidden')+'><label>إلى محفظة</label><select id="etto">'+wOpts(t.to||'')+'</select></div>'+
    '<div id="editAccountBox" '+(t.k==='t'?'hidden':'')+'><label>الحساب / البند</label><select id="eta">'+aOpts(t.ac||'')+'</select></div>'+
    '<label>المبلغ</label><input id="etam" type="text" inputmode="decimal" dir="ltr" value="'+fmt(t.a)+'">'+
    '<label>التاريخ</label><input id="etd" type="date" value="'+esc(t.d)+'">'+
    '<label>مصدر الأموال / الجهة</label><input id="ets" maxlength="120" value="'+esc(t.source||'')+'">'+
    '<label>البيان</label><input id="etn" maxlength="120" value="'+esc(t.n||'')+'">'+
    '<button class="go" onclick="saveEditTx(\''+id+'\')">حفظ التعديلات</button>');
}
function toggleEditKind(){
 const transfer=$('#etk').value==='t';$('#editToBox').hidden=!transfer;$('#editAccountBox').hidden=transfer;
}
async function saveEditTx(id){
 const k=$('#etk').value,wallet_id=$('#etw').value,to_wallet_id=k==='t'?$('#etto').value:null,account_id=k==='t'?null:$('#eta').value;
 const amount=Number(num($('#etam').value)),tx_date=$('#etd').value,source=$('#ets').value.trim().slice(0,120),note=$('#etn').value.trim().slice(0,120);
 if(!['d','c','t'].includes(k))return toast('نوع الحركة غير صحيح');
 if(!(Number.isFinite(amount)&&amount>0))return toast('اكتب مبلغ صحيح أكبر من صفر');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(tx_date))return toast('اختار تاريخ صحيح');
 if(k==='t'&&(!to_wallet_id||to_wallet_id===wallet_id))return toast('اختار محفظتين مختلفتين');
 if(k!=='t'&&!account_id)return toast('اختار الحساب');
 await run(async()=>{
   ck(await sb.from('transactions').update({wallet_id,to_wallet_id,account_id,kind:k,amount:round2(amount),tx_date,note,source}).eq('id',id));
   await loadExpenses();renderLog();
 },'تم تعديل الحركة');
}
