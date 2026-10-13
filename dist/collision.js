(function(root){
const radius=1.5;
const buildings=[];
function boxHit(a,b,box,r=radius){let near=0,far=1;for(const [k,lo,hi] of [['x',box.x-box.w/2-r,box.x+box.w/2+r],['y',box.y-box.d/2-r,box.y+box.d/2+r],['z',-r,box.h+r]]){const delta=b[k]-a[k];if(Math.abs(delta)<1e-9){if(a[k]<lo||a[k]>hi)return null;continue}let t0=(lo-a[k])/delta,t1=(hi-a[k])/delta;if(t0>t1)[t0,t1]=[t1,t0];near=Math.max(near,t0);far=Math.min(far,t1);if(near>far)return null}return near;}
function sphereHit(a,b,c,d,r=radius*2){const p=[a.x-c.x,a.y-c.y,a.z-c.z],v=[b.x-a.x-d.x+c.x,b.y-a.y-d.y+c.y,b.z-a.z-d.z+c.z],A=v.reduce((n,x)=>n+x*x,0),B=2*p.reduce((n,x,i)=>n+x*v[i],0),D=p.reduce((n,x)=>n+x*x,0)-r*r;if(D<=0)return 0;if(A<1e-12)return null;const disc=B*B-4*A*D;if(disc<0)return null;const t=(-B-Math.sqrt(disc))/(2*A);return t>=0&&t<=1?t:null;}
function detect(a,b,targetA,targetB){let hit=null;const add=(t,label)=>{if(t!==null&&(!hit||t<hit.t))hit={t,label}};buildings.forEach((box,i)=>add(boxHit(a,b,box),'建筑 '+(i+1)));if(targetA&&targetB)add(sphereHit(a,b,targetA,targetB),'移动无人机');if(b.z<radius)add(a.z<=radius?0:(a.z-radius)/(a.z-b.z),'地面');return hit;}
const api={radius,buildings,boxHit,sphereHit,detect};if(typeof module!=='undefined')module.exports=api;else root.Collision=api;
})(typeof window!=='undefined'?window:globalThis);

