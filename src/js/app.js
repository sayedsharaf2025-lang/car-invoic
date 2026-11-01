let tab='exp',ctx={},ME=null,busy=false,LOADED=false,shownKey='';
const VIEWS={exp:'viewExpenses',add:'viewAdd',log:'viewLog',manage:'viewManage',report:'viewReport',cars:'viewCars',carForm:'viewCarForm',carView:'viewCarView'};
const GROUP={exp:'exp',add:'exp',log:'exp',manage:'exp',report:'exp',cars:'cars',carForm:'cars',carView:'cars'};

const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const round2=n=>Math.round(n*100)/100;
const today=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
// Arabic-Indic digits / separators -> plain number string
const num=s=>String(s).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٫/g,'.').replace(/[٬,\s]/g,'');
const emptyBox=(icon,title,hint,btn,fn)=>`<div class="emptybox"><div class="ei">${icon}</div><b>${title}</b><p>${hint}</p>${btn?`<button class="go" onclick="${fn}">${btn}</button>`:''}</div>`;
const loadingHtml=()=>'<p class="empty">جاري التحميل…</p>';

function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',3200)}
function errMsg(e){
  const m=(e&&e.message)||String(e);
  if(/foreign key|violates foreign/i.test(m))return 'مينفعش الحذف: عليه حركات أو بيانات مرتبطة';
  if(/plate/i.test(m)&&/duplicate|unique/i.test(m))return 'رقم اللوحة ده موجود قبل كده';
  if(/duplicate|unique/i.test(m))return 'الاسم ده موجود قبل كده';
  if(/invalid login/i.test(m))return 'الإيميل أو كلمة السر غلط';
  if(/failed to fetch|network/i.test(m))return 'مفيش اتصال بالإنترنت';
  return 'حصل خطأ: '+m;
}
// Run an async action once at a time, with a toast on success/failure.
async function run(fn,ok){
  if(busy)return;busy=true;
  try{await fn();if(ok)toast(ok)}catch(e){console.error(e);toast(errMsg(e))}finally{busy=false}
}

function modal(html){$('#sheet').innerHTML=html;$('#modal').classList.add('open')}
function closeModal(){$('#modal').classList.remove('open')}

function go(t,c,replace){
  tab=t;ctx=c||{};
  history[replace?'replaceState':'pushState']({t,c:ctx},'');
  render();
}
window.addEventListener('popstate',e=>{if(e.state&&e.state.t){tab=e.state.t;ctx=e.state.c||{};render()}});

function render(){
  closeModal();
  const app=$('#app');
  if(!ME){app.innerHTML=viewLogin();document.body.classList.add('out');return}
  document.body.classList.remove('out');
  app.innerHTML=window[VIEWS[tab]]();
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===GROUP[tab]));
  const key=tab+(ctx.id||'');
  if(key!==shownKey){shownKey=key;scrollTo(0,0)}
}

/* ---------- auth ---------- */
function viewLogin(){
  return `<h1>دفتر النقدية</h1>
  <p class="empty" style="padding-top:0">سجّل دخولك عشان بياناتك تتحفظ وتبقى ليك لوحدك.</p>
  <label>الإيميل</label><input id="em" type="email" autocomplete="email" dir="ltr">
  <label>كلمة السر (6 حروف على الأقل)</label><input id="pw" type="password" autocomplete="current-password" dir="ltr">
  <button class="go" onclick="doLogin(false)">دخول</button>
  <button class="ghost wide" onclick="doLogin(true)">إنشاء حساب جديد</button>`;
}
async function doLogin(signup){
  const email=$('#em').value.trim(),password=$('#pw').value;
  if(!email||password.length<6)return toast('اكتب الإيميل وكلمة سر 6 حروف على الأقل');
  await run(async()=>{
    const r=ck(signup?await sb.auth.signUp({email,password}):await sb.auth.signInWithPassword({email,password}));
    if(!r.data.session)toast('تم إنشاء الحساب. لو طلب تأكيد، افتح الإيميل وبعدين سجّل دخول');
  });
}
async function logout(){if(confirm('تسجيل الخروج؟'))await sb.auth.signOut()}

async function loadAll(){
  await Promise.all([loadExpenses(),loadCars()]);
  LOADED=true;render();
}
function start(){LOADED=false;render();run(loadAll)}
function resetState(){LOADED=false;S={wallets:[],accounts:[],tx:[]};CARS=[];CDOCS={};URLS={}}

document.addEventListener('DOMContentLoaded',async()=>{
  history.replaceState({t:'exp',c:{}},'');
  document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>go(b.dataset.t));
  $('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};
  sb.auth.onAuthStateChange((ev,s)=>{
    const u=s&&s.user;
    if(u&&(!ME||ME.id!==u.id)){ME=u;setTimeout(start,0)}
    else if(!u&&ME){ME=null;resetState();tab='exp';ctx={};setTimeout(render,0)}
  });
  const {data}=await sb.auth.getSession();
  if(!data.session){ME=null;render()}
});
