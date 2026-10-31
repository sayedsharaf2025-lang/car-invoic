let tab='exp';
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',2800)}
function go(t){tab=t;render()}
function render(){
  const views={exp:'viewExpenses',cars:'viewCars'};
  document.getElementById('app').innerHTML=window[views[tab]]();
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));
  if(typeof window['after_'+tab]==='function')window['after_'+tab]();
  scrollTo(0,0);
}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>go(b.dataset.t));
document.addEventListener('DOMContentLoaded',()=>render());
