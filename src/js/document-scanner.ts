export interface Pt { x: number; y: number }
export type Quad = [Pt, Pt, Pt, Pt];
export type ScanMode = 'original' | 'magic' | 'gray' | 'bw';

const dist=(a:Pt,b:Pt)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function toGray(rgba:Uint8ClampedArray,n:number):Uint8Array{
 const g=new Uint8Array(n);
 for(let i=0;i<n;i++)g[i]=Math.round(.299*rgba[i*4]+.587*rgba[i*4+1]+.114*rgba[i*4+2]);
 return g;
}
export function orderQuad(points:Pt[]):Quad{
 if(points.length!==4)throw new Error('يلزم تحديد أربع زوايا');
 const cx=points.reduce((s,p)=>s+p.x,0)/4,cy=points.reduce((s,p)=>s+p.y,0)/4;
 const a=points.slice().sort((p,q)=>Math.atan2(p.y-cy,p.x-cx)-Math.atan2(q.y-cy,q.x-cx));
 let k=0;for(let i=1;i<4;i++)if(a[i].x+a[i].y<a[k].x+a[k].y)k=i;
 const q=[0,1,2,3].map(i=>a[(k+i)%4]) as Quad;
 if(!isValidQuad(q))throw new Error('ترتيب الزوايا غير صالح');
 return q;
}
export function insetQuad(q:Quad,px:number):Quad{
 const cx=q.reduce((s,p)=>s+p.x,0)/4,cy=q.reduce((s,p)=>s+p.y,0)/4;
 return q.map(p=>{const d=Math.hypot(p.x-cx,p.y-cy)||1,k=Math.min(1,Math.max(0,px)/d);return{x:p.x+(cx-p.x)*k,y:p.y+(cy-p.y)*k}}) as Quad;
}
export function outputSize(q:Quad,maxSide=3000){
 const w=Math.max(dist(q[0],q[1]),dist(q[3],q[2])),h=Math.max(dist(q[0],q[3]),dist(q[1],q[2]));
 const s=Math.min(1,maxSide/Math.max(w,h,1));
 return{w:Math.max(1,Math.round(w*s)),h:Math.max(1,Math.round(h*s))};
}
export function boxBlur(src:ArrayLike<number>,w:number,h:number,r:number):Float32Array{
 const tmp=new Float32Array(w*h),out=new Float32Array(w*h),pre=new Float64Array(Math.max(w,h)+1);
 for(let y=0;y<h;y++){pre[0]=0;for(let x=0;x<w;x++)pre[x+1]=pre[x]+src[y*w+x];for(let x=0;x<w;x++){const l=Math.max(0,x-r),z=Math.min(w-1,x+r);tmp[y*w+x]=(pre[z+1]-pre[l])/(z-l+1)}}
 for(let x=0;x<w;x++){pre[0]=0;for(let y=0;y<h;y++)pre[y+1]=pre[y]+tmp[y*w+x];for(let y=0;y<h;y++){const l=Math.max(0,y-r),z=Math.min(h-1,y+r);out[y*w+x]=(pre[z+1]-pre[l])/(z-l+1)}}
 return out;
}
export function otsu(gray:Uint8Array):number{
 const hist=new Float64Array(256);for(const v of gray)hist[v]++;
 const total=gray.length;let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];
 let wb=0,sb=0,best=-1,tBest=128;
 for(let t=0;t<256;t++){wb+=hist[t];if(!wb)continue;const wf=total-wb;if(!wf)break;sb+=t*hist[t];const d=sb/wb-(sum-sb)/wf,score=wb*wf*d*d;if(score>best){best=score;tBest=t}}
 return tBest;
}
function shrinkPlanes(rgba:Uint8ClampedArray,w:number,h:number,maxSide:number){
 const scale=Math.min(1,maxSide/Math.max(w,h)),sw=Math.max(1,Math.round(w*scale)),sh=Math.max(1,Math.round(h*scale));
 const gray=toGray(rgba,w*h),chroma=new Uint8Array(w*h);
 for(let i=0;i<w*h;i++){const r=rgba[i*4],g=rgba[i*4+1],b=rgba[i*4+2];chroma[i]=Math.max(r,g,b)-Math.min(r,g,b)}
 const og=new Uint8Array(sw*sh),oc=new Uint8Array(sw*sh);
 for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const x0=Math.floor(x*w/sw),x1=Math.max(x0+1,Math.floor((x+1)*w/sw)),y0=Math.floor(y*h/sh),y1=Math.max(y0+1,Math.floor((y+1)*h/sh));let sg=0,sc=0,n=0;for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){const i=yy*w+xx;sg+=gray[i];sc+=chroma[i];n++}og[y*sw+x]=sg/n;oc[y*sw+x]=sc/n}
 return{gray:og,chroma:oc,sw,sh,s:scale};
}
function biggestBlob(fg:Uint8Array,w:number,h:number){
 const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let best:number[]|null=null;
 for(let st=0;st<fg.length;st++){if(!fg[st]||seen[st])continue;let head=0,tail=0;queue[tail++]=st;seen[st]=1;
  while(head<tail){const i=queue[head++],x=i%w;if(x>0&&fg[i-1]&&!seen[i-1]){seen[i-1]=1;queue[tail++]=i-1}if(x<w-1&&fg[i+1]&&!seen[i+1]){seen[i+1]=1;queue[tail++]=i+1}if(i>=w&&fg[i-w]&&!seen[i-w]){seen[i-w]=1;queue[tail++]=i-w}if(i<w*(h-1)&&fg[i+w]&&!seen[i+w]){seen[i+w]=1;queue[tail++]=i+w}}
  if(!best||tail>best.length)best=Array.from(queue.subarray(0,tail));
 }
 if(!best)return null;const mask=new Uint8Array(w*h);for(const i of best)mask[i]=1;return{mask,area:best.length};
}
function fillHoles(mask:Uint8Array,w:number,h:number){
 const outside=new Uint8Array(w*h),stack:number[]=[];const push=(i:number)=>{if(!mask[i]&&!outside[i]){outside[i]=1;stack.push(i)}};
 for(let x=0;x<w;x++){push(x);push((h-1)*w+x)}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1)}
 while(stack.length){const i=stack.pop()!,x=i%w;if(x)push(i-1);if(x<w-1)push(i+1);if(i>=w)push(i-w);if(i<w*(h-1))push(i+w)}
 let area=0;for(let i=0;i<mask.length;i++)if(!outside[i]){mask[i]=1;area++}return area;
}
function hull(points:Pt[]):Pt[]{
 const p=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y);if(p.length<3)return p;
 const cross=(o:Pt,a:Pt,b:Pt)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x),lo:Pt[]=[],up:Pt[]=[];
 for(const q of p){while(lo.length>1&&cross(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q)}
 for(let i=p.length-1;i>=0;i--){const q=p[i];while(up.length>1&&cross(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q)}
 return lo.slice(0,-1).concat(up.slice(0,-1));
}
const areaPoly=(p:Pt[])=>Math.abs(p.reduce((s,a,i)=>s+a.x*p[(i+1)%p.length].y-p[(i+1)%p.length].x*a.y,0))/2;
function intersect(a:Pt,b:Pt,c:Pt,d:Pt):Pt|null{
 const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;if(Math.abs(den)<1e-8)return null;
 const t=((c.x-a.x)*sy-(c.y-a.y)*sx)/den;return{x:a.x+t*rx,y:a.y+t*ry};
}
function reduceQuad(poly:Pt[]):Pt[]|null{
 let p=poly.slice();if(p.length<4)return null;
 while(p.length>4){const n=p.length;let bi=-1,costBest=Infinity,xBest:Pt|null=null;
  for(let i=0;i<n;i++){const a=p[(i+n-1)%n],b=p[i],c=p[(i+1)%n],d=p[(i+2)%n],x=intersect(a,b,d,c);if(!x)continue;
   if((x.x-b.x)*(b.x-a.x)+(x.y-b.y)*(b.y-a.y)<0||(x.x-c.x)*(c.x-d.x)+(x.y-c.y)*(c.y-d.y)<0)continue;
   const cost=areaPoly([b,x,c]);if(cost<costBest){costBest=cost;bi=i;xBest=x}
  }
  if(bi<0||!xBest)return null;const rest:Pt[]=[];for(let k=2;k<=n-1;k++)rest.push(p[(bi+k)%n]);rest.push(xBest);p=rest;
 }
 return p;
}
function isValidQuad(q:Quad){
 let sign=0;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],c=q[(i+2)%4],z=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);if(Math.abs(z)<1e-5)return false;if(!sign)sign=Math.sign(z);else if(Math.sign(z)!==sign)return false}
 return areaPoly(q)>25;
}
function candidate(fg:Uint8Array,w:number,h:number){
 const b=biggestBlob(fg,w,h);if(!b)return null;const area=fillHoles(b.mask,w,h),frac=area/(w*h);if(frac<.1||frac>.985)return null;
 const edge:Pt[]=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(b.mask[i]&&(x===0||y===0||x===w-1||y===h-1||!b.mask[i-1]||!b.mask[i+1]||!b.mask[i-w]||!b.mask[i+w]))edge.push({x,y})}
 const ch=hull(edge),ha=areaPoly(ch),raw=reduceQuad(ch);if(!raw||ha<=0)return null;
 let q:Quad;try{q=orderQuad(raw)}catch{return null}
 q=q.map(p=>({x:clamp(p.x,0,w-1),y:clamp(p.y,0,h-1)})) as Quad;
 const qa=areaPoly(q),solidity=area/ha,minSide=Math.min(dist(q[0],q[1]),dist(q[1],q[2]),dist(q[2],q[3]),dist(q[3],q[0]));
 if(solidity<.8||qa/ha>1.2||!isValidQuad(q)||minSide<.1*Math.min(w,h))return null;
 let onBorder=0;for(let x=0;x<w;x++)onBorder+=b.mask[x]+b.mask[(h-1)*w+x];for(let y=0;y<h;y++)onBorder+=b.mask[y*w]+b.mask[y*w+w-1];
 const borderCover=onBorder/(2*(w+h));
 return{score:solidity-.3*Math.max(0,qa/ha-1)+.1*frac-.4*borderCover,area,quad:q};
}
export function detectDocument(rgba:Uint8ClampedArray,w:number,h:number):Quad|null{
 if(w<2||h<2||rgba.length<w*h*4)return null;
 const{gray,chroma,sw,sh,s}=shrinkPlanes(rgba,w,h,300),paper=new Uint8Array(sw*sh);
 for(let i=0;i<paper.length;i++)paper[i]=Math.max(0,Math.min(255,gray[i]-1.5*chroma[i]));
 let best:ReturnType<typeof candidate>=null;
 const consider=(plane:Uint8Array,t:number,light:boolean)=>{const fg=new Uint8Array(sw*sh);for(let i=0;i<fg.length;i++)fg[i]=light?+(plane[i]>t):+(plane[i]<=t);const c=candidate(fg,sw,sh);if(c&&(!best||c.score>best.score+.02||(Math.abs(c.score-best.score)<=.02&&c.area>best.area)))best=c};
 for(const[plane,both]of [[gray,true],[paper,false]] as const){const soft=boxBlur(plane,sw,sh,2),g=new Uint8Array(sw*sh);for(let i=0;i<g.length;i++)g[i]=soft[i];const ts=new Set<number>([otsu(g)]);for(let t=96;t<=240;t+=16)ts.add(t);for(const t of ts){consider(g,t,true);if(both)consider(g,t,false)}}
 return best?(best.quad.map(p=>({x:p.x/s,y:p.y/s})) as Quad):null;
}
export function homography(src:Quad,dst:Quad):number[]{
 const a:number[][]=[];for(let i=0;i<4;i++){const{x,y}=src[i],{x:u,y:v}=dst[i];a.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v])}
 for(let c=0;c<8;c++){let p=c;for(let r=c+1;r<8;r++)if(Math.abs(a[r][c])>Math.abs(a[p][c]))p=r;if(Math.abs(a[p][c])<1e-10)throw new Error('تعذر تصحيح المنظور: الزوايا متقاربة');[a[c],a[p]]=[a[p],a[c]];const z=a[c][c];for(let k=c;k<9;k++)a[c][k]/=z;for(let r=0;r<8;r++)if(r!==c){const f=a[r][c];for(let k=c;k<9;k++)a[r][k]-=f*a[c][k]}}
 const out=a.map((r,i)=>r[8]/r[i]).concat(1);if(!out.every(Number.isFinite))throw new Error('تحويل منظور غير صالح');return out;
}
export function warpPerspective(rgba:Uint8ClampedArray,w:number,h:number,q:Quad,outW:number,outH:number):Uint8ClampedArray{
 if(!isValidQuad(q)||outW<2||outH<2||outW*outH>16000000)throw new Error('أبعاد القص غير صالحة');
 const dst:Quad=[{x:0,y:0},{x:outW-1,y:0},{x:outW-1,y:outH-1},{x:0,y:outH-1}],H=homography(dst,q),out=new Uint8ClampedArray(outW*outH*4);
 for(let y=0;y<outH;y++)for(let x=0;x<outW;x++){const den=H[6]*x+H[7]*y+1;if(Math.abs(den)<1e-9)continue;const sx=clamp((H[0]*x+H[1]*y+H[2])/den,0,w-1),sy=clamp((H[3]*x+H[4]*y+H[5])/den,0,h-1),x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=sx-x0,fy=sy-y0,o=(y*outW+x)*4;
  for(let c=0;c<3;c++){const top=rgba[(y0*w+x0)*4+c]*(1-fx)+rgba[(y0*w+x1)*4+c]*fx,bot=rgba[(y1*w+x0)*4+c]*(1-fx)+rgba[(y1*w+x1)*4+c]*fx;out[o+c]=top*(1-fy)+bot*fy}out[o+3]=255}
 return out;
}
function maxFilter(src:Float32Array,w:number,h:number,r:number){
 const tmp=new Float32Array(w*h),out=new Float32Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let m=0;for(let k=Math.max(0,x-r);k<=Math.min(w-1,x+r);k++)m=Math.max(m,src[y*w+k]);tmp[y*w+x]=m}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let m=0;for(let k=Math.max(0,y-r);k<=Math.min(h-1,y+r);k++)m=Math.max(m,tmp[k*w+x]);out[y*w+x]=m}return out;
}
function paperLevel(ch:Float32Array,w:number,h:number){
 const s=Math.min(1,320/Math.max(w,h)),sw=Math.max(2,Math.round(w*s)),sh=Math.max(2,Math.round(h*s)),small=new Float32Array(sw*sh);
 for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const x0=Math.floor(x*w/sw),x1=Math.max(x0+1,Math.floor((x+1)*w/sw)),y0=Math.floor(y*h/sh),y1=Math.max(y0+1,Math.floor((y+1)*h/sh));let sum=0,n=0;for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){sum+=ch[yy*w+xx];n++}small[y*sw+x]=sum/n}
 const bg=boxBlur(maxFilter(small,sw,sh,3),sw,sh,4),out=new Float32Array(w*h);
 for(let y=0;y<h;y++){const fy=clamp((y+.5)*sh/h-.5,0,sh-1),y0=Math.floor(fy),y1=Math.min(sh-1,y0+1),ty=fy-y0;for(let x=0;x<w;x++){const fx=clamp((x+.5)*sw/w-.5,0,sw-1),x0=Math.floor(fx),x1=Math.min(sw-1,x0+1),tx=fx-x0;out[y*w+x]=(bg[y0*sw+x0]*(1-tx)+bg[y0*sw+x1]*tx)*(1-ty)+(bg[y1*sw+x0]*(1-tx)+bg[y1*sw+x1]*tx)*ty}}
 return out;
}
export function enhance(rgba:Uint8ClampedArray,w:number,h:number,mode:ScanMode,bwThreshold=.85):Uint8ClampedArray{
 if(mode==='original')return rgba.slice();const n=w*h,out=new Uint8ClampedArray(n*4);
 const flat=(ch:Float32Array,low:number)=>{const bg=paperLevel(ch,w,h),f=new Float32Array(n);for(let i=0;i<n;i++)f[i]=clamp(255*(Math.min(1,ch[i]/Math.max(bg[i],1))-low)/(1-low),0,255);return f};
 if(mode==='magic'){for(let c=0;c<3;c++){const ch=new Float32Array(n);for(let i=0;i<n;i++)ch[i]=rgba[i*4+c];const f=flat(ch,.45);for(let i=0;i<n;i++)out[i*4+c]=f[i]}}
 else{const gr=toGray(rgba,n),g=new Float32Array(n);for(let i=0;i<n;i++)g[i]=gr[i];if(mode==='gray'){const f=flat(g,.55);for(let i=0;i<n;i++)out[i*4]=out[i*4+1]=out[i*4+2]=f[i]}else{const bg=paperLevel(g,w,h);for(let i=0;i<n;i++){const v=g[i]/Math.max(bg[i],1)<bwThreshold?0:255;out[i*4]=out[i*4+1]=out[i*4+2]=v}}}
 for(let i=0;i<n;i++)out[i*4+3]=255;return out;
}
export function rotate90(rgba:Uint8ClampedArray,w:number,h:number,turns:number){const k=((turns%4)+4)%4;if(!k)return{rgba:rgba.slice(),w,h};const nw=k===2?w:h,nh=k===2?h:w,out=new Uint8ClampedArray(nw*nh*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const nx=k===1?h-1-y:k===2?w-1-x:y,ny=k===1?x:k===2?h-1-y:w-1-x;out.set(rgba.subarray((y*w+x)*4,(y*w+x)*4+4),(ny*nw+nx)*4)}return{rgba:out,w:nw,h:nh}}
