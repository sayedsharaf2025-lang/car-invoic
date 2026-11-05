let tab='exp',ctx={},ME=null,PROFILE=null,WORKSPACE_ID=null,SCREEN_KEYS=[],USER_ROWS=[],SELECTED_USER='',busy=false,LOADED=false,shownKey='';
const VIEWS={exp:'viewExpenses',add:'viewAdd',log:'viewLog',manage:'viewManage',report:'viewReport',cars:'viewCars',carForm:'viewCarForm',carView:'viewCarView',settings:'viewSettings'};
const GROUP={exp:'exp',add:'exp',log:'exp',manage:'exp',report:'exp',cars:'cars',carForm:'cars',carView:'cars',settings:'settings'};
const SCREEN_LIST=[['exp','المصاريف'],['add','حركة جديدة'],['log','السجل'],['manage','المحافظ والحسابات'],['report','التقارير'],['cars','السيارات']];
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const round2=n=>Math.round(n*100)/100;
const today=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const num=s=>String(s).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٫/g,'.').replace(/[٬,\\s]/g,'');
const emptyBox=(icon,title,hint,btn,fn)=>`<div class="emptybox"><div class="ei">${icon}</div><b>${title}</b><p>${hint}</p>${btn?`<button class="go" onclick="${fn}">${btn}</button>`:''}</div>`;
const loadingHtml=()=>'<p class="empty">جاري التحميل…</p>';
function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',3200)}
function errMsg(e){const m=(e&&e.message)||String(e);if(/foreign key|violates foreign/i.test(m))return 'مينفعش الحذف: عليه حركات أو بيانات مرتبطة';if(/plate/i.test(m)&&/duplicate|unique/i.test(m))return 'رقم اللوحة ده موجود قبل كده';if(/duplicate|unique/i.test(m))return 'الاسم ده موجود قبل كده';if(/invalid login/i.test(m))return 'الإيميل أو كلمة السر غلط';if(/failed to fetch|network/i.test(m))return 'مفيش اتصال بالإنترنت';if(/row-level security|permission denied/i.test(m))return 'الحساب غير معتمد أو مش مسموح له بالعملية دي';return 'حصل خطأ: '+m}
async function run(fn,ok){if(busy)return;busy=true;try{await fn();if(ok)toast(ok)}catch(e){console.error(e);toast(errMsg(e))}finally{busy=false}}
function modal(html){$('#sheet').innerHTML=html;$('#modal').classList.add('open')}
function closeModal(){$('#modal').classList.remove('open')}
function isAdmin(){return !!PROFILE&&PROFILE.role==='admin'&&PROFILE.status==='approved'}
function hasScreen(k){return isAdmin()||SCREEN_KEYS.includes(k)}
function go(t,c,replace){if(t!=='settings'&&!hasScreen(t)){toast('الشاشة دي مش ضمن صلاحيات حسابك');return}if(t==='settings'&&!isAdmin()){toast('الإعدادات متاحة للمدير فقط');return}tab=t;ctx=c||{};history[replace?'replaceState':'pushState']({t,c:ctx},'');render()}
window.addEventListener('popstate',e=>{if(e.state&&e.state.t){tab=e.state.t;ctx=e.state.c||{};render()}});
function render(){
 closeModal();const app=$('#app');
 if(!ME){app.innerHTML=viewLogin();document.body.classList.add('out');return}
 document.body.classList.remove('out');
 if(!PROFILE){app.innerHTML=loadingHtml();return}
 if(PROFILE.status!=='approved'){app.innerHTML=viewPending();document.body.classList.add('out');return}
 if(tab==='settings'&&!isAdmin())tab='exp';
 if(tab!=='settings'&&!hasScreen(tab)){const first=SCREEN_LIST.find(x=>hasScreen(x[0]));if(!first){app.innerHTML='<h1>لا توجد شاشات متاحة</h1><p class="empty">المدير لم يحدد لك صلاحيات مشاهدة الشاشات بعد.</p><button class="ghost wide" onclick="logout()">تسجيل الخروج</button>';document.querySelectorAll('nav button').forEach(b=>b.hidden=true);return}tab=first[0];ctx={}}
 app.innerHTML=window[VIEWS[tab]]?window[VIEWS[tab]]():'<p class="empty">الشاشة غير موجودة</p>';
 document.querySelectorAll('nav button').forEach(b=>{const k=b.dataset.t;b.hidden=k==='settings'?!isAdmin():!hasScreen(k);b.classList.toggle('on',k===GROUP[tab])});
 const key=tab+(ctx.id||'');if(key!==shownKey){shownKey=key;scrollTo(0,0)}
}
function viewLogin(){return `<h1>دفتر النقدية</h1><p class="empty" style="padding-top:0">سجّل دخولك لمتابعة بياناتك. إنشاء الحساب الجديد يحتاج موافقة المدير قبل استخدام التطبيق.</p><label>الإيميل</label><input id="em" type="email" autocomplete="email" dir="ltr"><label>كلمة السر (6 حروف على الأقل)</label><input id="pw" type="password" autocomplete="current-password" dir="ltr"><button class="go" onclick="doLogin(false)">دخول</button><button class="ghost wide" onclick="doLogin(true)">طلب إنشاء حساب</button>`}
function viewPending(){const s=PROFILE.status;const msg=s==='pending'?'طلب تسجيلك وصل للمدير ولسه مستني الموافقة.':s==='rejected'?'تم رفض طلب التسجيل. تواصل مع المدير لو محتاج مراجعة.':'تم إيقاف الحساب مؤقتًا بواسطة المدير.';return `<h1>حالة الحساب</h1><div class="card-item"><b>${esc(PROFILE.email)}</b><p>${msg}</p></div><button class="ghost wide" onclick="logout()">تسجيل الخروج</button>`}
async function doLogin(signup){
 const email=$('#em').value.trim(),password=$('#pw').value;if(!email||password.length<6)return toast('اكتب الإيميل وكلمة سر 6 حروف على الأقل');
 await run(async()=>{if(signup){const r=ck(await sb.auth.signUp({email,password}));if(r.data.user&&!r.data.session)toast('تم إرسال طلب التسجيل. أكّد بريدك ثم انتظر موافقة المدير.');else if(r.data.session)toast('تم إنشاء الحساب. حسابك الآن بانتظار موافقة المدير.')}else ck(await sb.auth.signInWithPassword({email,password}))});
}
async function logout(){if(confirm('تسجيل الخروج؟'))await sb.auth.signOut()}
async function loadProfile(){
 const {data,error}=await sb.from('app_users').select('*').eq('user_id',ME.id).maybeSingle();if(error)throw error;PROFILE=data;
 if(!PROFILE){PROFILE={user_id:ME.id,email:ME.email,status:'pending',role:'user'};return}
 WORKSPACE_ID=PROFILE.workspace_owner_id||null;
 if(PROFILE.status==='approved'){
  const {data:p,error:pe}=await sb.from('user_screen_permissions').select('screen_key').eq('user_id',ME.id);if(pe)throw pe;SCREEN_KEYS=(p||[]).map(x=>x.screen_key);
  if(isAdmin())SCREEN_KEYS=SCREEN_LIST.map(x=>x[0]);
 }
}
async function loadAll(){await loadProfile();if(PROFILE.status==='approved'){const finance=SCREEN_KEYS.some(k=>['exp','add','log','manage','report'].includes(k));const jobs=[];if(finance)jobs.push(loadExpenses());else S={wallets:[],accounts:[],tx:[]};if(hasScreen('cars'))jobs.push(loadCars());else{CARS=[];CDOCS={};URLS={}}if(isAdmin()){const {data,error}=await sb.from('app_users').select('*').order('created_at',{ascending:false});if(error)throw error;USER_ROWS=data||[]}await Promise.all(jobs);LOADED=true}render()}
function start(){LOADED=false;PROFILE=null;WORKSPACE_ID=null;SCREEN_KEYS=[];render();run(loadAll)}
function resetState(){LOADED=false;PROFILE=null;WORKSPACE_ID=null;SCREEN_KEYS=[];USER_ROWS=[];S={wallets:[],accounts:[],tx:[]};CARS=[];CDOCS={};URLS={}}
function viewSettings(){
 if(!isAdmin())return '<p class="empty">الإعدادات متاحة للمدير فقط.</p>';
 const pending=USER_ROWS.filter(u=>u.status==='pending');
 return `<h1>الإعدادات وإدارة المستخدمين</h1><p class="muted">الموافقة على الحسابات وتحديد الشاشات المسموح لكل مستخدم بمشاهدتها.</p>
 <h2>طلبات التسجيل الجديدة (${pending.length})</h2>
 ${pending.map(u=>`<div class="card-item"><b>${esc(u.email)}</b><small class="muted">${esc(u.created_at||'')}</small><div class="two"><button class="go" onclick="adminSetStatus('${u.user_id}','approved')">موافقة</button><button class="ghost danger" onclick="adminSetStatus('${u.user_id}','rejected')">رفض</button></div></div>`).join('')||'<p class="empty">لا توجد طلبات معلقة.</p>'}
 <h2>كل المستخدمين</h2>${USER_ROWS.map(u=>`<div class="row"><div><b>${esc(u.email)}</b><small>${u.role==='admin'?'مدير رئيسي':u.status==='approved'?'معتمد':u.status==='pending'?'بانتظار الموافقة':u.status==='rejected'?'مرفوض':'موقوف'}</small></div><div class="acts">${u.role==='admin'?'':`<button class="ghost" onclick="editUserPermissions('${u.user_id}')">الشاشات</button>`}</div></div>`).join('')}
 <button class="ghost wide" onclick="loadAdminUsers()">تحديث القائمة</button>`;
}
async function loadAdminUsers(){if(!isAdmin())return;await run(async()=>{const {data,error}=await sb.from('app_users').select('*').order('created_at',{ascending:false});if(error)throw error;USER_ROWS=data||[];render()},'تم تحديث المستخدمين')}
async function adminSetStatus(id,status){if(!isAdmin()||id===ME.id)return toast('لا يمكن تعديل حساب المدير الرئيسي');const msg=status==='approved'?'الموافقة على المستخدم؟':'تأكيد تغيير حالة المستخدم؟';if(!confirm(msg))return;await run(async()=>{const patch={status,approved_at:status==='approved'?new Date().toISOString():null};const {error}=await sb.from('app_users').update(patch).eq('user_id',id);if(error)throw error;await loadAdminUsers()},'تم تحديث حالة المستخدم')}
async function editUserPermissions(id){
 if(!isAdmin())return;SELECTED_USER=id;
 await run(async()=>{const {data,error}=await sb.from('user_screen_permissions').select('screen_key').eq('user_id',id);if(error)throw error;const chosen=new Set((data||[]).map(x=>x.screen_key));const u=USER_ROWS.find(x=>x.user_id===id);modal(`<h2>صلاحيات الشاشات</h2><p class="muted">${esc(u?.email||'')}</p>${SCREEN_LIST.map(([k,l])=>`<label class="permission-row"><input type="checkbox" data-screen="${k}" ${chosen.has(k)?'checked':''}> ${l}</label>`).join('')}<button class="go" onclick="saveUserPermissions()">حفظ الصلاحيات</button>`)});
}
async function saveUserPermissions(){if(!isAdmin()||!SELECTED_USER)return;const ids=[...document.querySelectorAll('[data-screen]:checked')].map(x=>x.dataset.screen);await run(async()=>{const del=await sb.from('user_screen_permissions').delete().eq('user_id',SELECTED_USER);if(del.error)throw del.error;if(ids.length){const ins=await sb.from('user_screen_permissions').insert(ids.map(screen_key=>({user_id:SELECTED_USER,screen_key})));if(ins.error)throw ins.error}closeModal();toast('تم حفظ صلاحيات الشاشات')})}
document.addEventListener('DOMContentLoaded',async()=>{
 history.replaceState({t:'exp',c:{}},'');document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>go(b.dataset.t));$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};
 sb.auth.onAuthStateChange((ev,s)=>{const u=s&&s.user;if(u&&(!ME||ME.id!==u.id)){ME=u;setTimeout(start,0)}else if(!u&&ME){ME=null;resetState();tab='exp';ctx={};setTimeout(render,0)}else if(u&&ME&&ev==='TOKEN_REFRESHED'){ME=u}});
 const {data,error}=await sb.auth.getSession();if(error)console.error(error);if(data.session){ME=data.session.user;start()}else{ME=null;render()}
});
