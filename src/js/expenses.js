let S={wallets:[],accounts:[],tx:[]},AID={},kind='d',fA='',fW='',fM='',fQ='';
const $=s=>document.querySelector(s);
const fmt=n=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const bal=w=>S.tx.filter(t=>t.w===w.id).reduce((a,t)=>a+(t.k==='c'?t.a:-t.a),w.opening);
const sign=n=>n<0?'neg':'pos';
const typeName=t=>t==='visa'?'فيزا':'نقدي';
const wName=id=>(S.wallets.find(w=>w.id===id)||{name:'(محذوفة)'}).name;
const ck=r=>{if(r.error)throw r.error;return r};
const opts=(arr,sel,all)=>(all?`<option value="">${all}</option>`:'')+arr.map(([v,l])=>`<option value="${esc(v)}"${v===sel?' selected':''}>${esc(l)}</option>`).join('');
const wOpts=(sel,all)=>opts(S.wallets.map(w=>[w.id,`${w.name} (${typeName(w.type)})`]),sel,all);
const aOpts=(sel,all)=>opts(S.accounts.map(a=>[a,a]),sel,all);

async function loadExpenses(){
  const [w,a,t]=await Promise.all([sb.from('wallets').select('*').order('created_at'),sb.from('accounts').select('*').order('created_at'),sb.from('transactions').select('*').order('created_at')]);
  [w,a,t].forEach(ck);
  S.wallets=w.data.map(x=>({id:x.id,name:x.name,type:x.type,opening:+x.opening}));
  AID={};const nm={};S.accounts=a.data.map(x=>{AID[x.name]=x.id;nm[x.id]=x.name;return x.name});
  S.tx=t.data.map(x=>({id:x.id,k:x.kind,w:x.wallet_id,acc:nm[x.account_id],a:+x.amount,d:x.tx_date,n:x.note||''}));
}
async function after_exp(){await loadExpenses();render();}

function viewExpenses(){
  return `<h1>المصاريف</h1><div class="two" style="margin-bottom:8px"><button class="ghost" onclick="go('add')">+ حركة جديدة</button><button class="ghost" onclick="go('log')">السجل</button></div><div id="expBody">${renderExpBody()}</div>`;
}
function renderExpBody(){
  const total=S.wallets.reduce((a,w)=>a+bal(w),0);
  let h=`<div class="total"><small>إجمالي الرصيد المتبقي</small><b class="num">${fmt(total)} ج.م</b></div><h2>رصيد كل محفظة</h2>`;
  h+=S.wallets.map(w=>{const b=bal(w);return `<div class="row"><div>${esc(w.name)}<small>${typeName(w.type)}</small></div><span class="num ${sign(b)}">${fmt(b)} ج.م</span></div>`}).join('');
  return h;
}
