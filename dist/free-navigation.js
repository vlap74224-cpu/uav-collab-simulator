(function(root){
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function resolve(text,places){const q=text.trim().replace(/\s/g,'').toLowerCase();if(!q)return null;const matches=places.filter(p=>[p.name,p.shortName].filter(Boolean).some(n=>n.replace(/\s/g,'').toLowerCase()===q));if(matches.length===1)return matches[0];const partial=places.filter(p=>[p.name,p.shortName].filter(Boolean).some(n=>n.toLowerCase().includes(q)));return partial.length===1?partial[0]:null}
async function plan({origin,target,bounds,clearance,collision,active=()=>true}){
 const started=Date.now(),cache=new Map();let deadline=Date.now()+8;
 async function yieldWork(){if(!active())throw Error('已取消规划');if(Date.now()-started>20000)throw Error('暂未找到可用航线，请调整位置或高度后重试');if(Date.now()>=deadline){await new Promise(r=>setTimeout(r,0));deadline=Date.now()+8}}
 function inBounds(p){return p[0]>=bounds.minX&&p[0]<=bounds.maxX&&p[1]>=bounds.minY&&p[1]<=bounds.maxY}
 async function clear(p){if(!inBounds(p))return false;const k=p.join(',');if(!cache.has(k)){await yieldWork();cache.set(k,clearance(p)>26)}return cache.get(k)}
 async function safe(a,b){if(!inBounds(a)||!inBounds(b)||collision(a,b))return false;const n=Math.max(1,Math.ceil(distance(a,b)/8));for(let i=0;i<=n;i++)if(!await clear([a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]))return false;return true}
 if(!await clear(origin))throw Error('当前位置距障碍物过近，请先手动移到开阔处');
 const goals=[];
 // Keep a safe user-selected point; otherwise propose nearby open space.
 if(!target.height&&await clear(target.point))goals.push(target.point);
 else for(const radius of target.height?[40,65,100,145,200,260]:[24,48,72,100,145,200,260])for(let i=0;i<24;i++){const angle=i*Math.PI/12,p=[target.point[0]+radius*Math.cos(angle),target.point[1]+radius*Math.sin(angle)];if(await clear(p))goals.push(p)}
 if(!goals.length)throw Error('AI 已检查目标周边 260 米，当前高度没有安全停靠位置，请调整高度后重试');
 goals.sort((a,b)=>distance(target.point,a)-distance(target.point,b)||distance(origin,a)-distance(origin,b));
 for(const g of goals)if(await safe(origin,g))return [origin,g];
 const heuristic=p=>Math.min(...goals.map(g=>distance(p,g))),open=[{p:origin,g:0,f:heuristic(origin),parent:null}],best=new Map([['0,0',0]]),closed=new Set(),spacing=24;
 while(open.length&&closed.size<8000){await yieldWork();open.sort((a,b)=>b.f-a.f);const node=open.pop(),key=node.p.join(',');if(closed.has(key))continue;closed.add(key);
 for(const goal of goals.filter(g=>distance(node.p,g)<spacing*2))if(await safe(node.p,goal)){const path=[goal];for(let n=node;n;n=n.parent)path.unshift(n.p);const smooth=[origin];let i=0;while(i<path.length-1){let j=path.length-1;while(j>i+1&&!await safe(path[i],path[j]))j--;smooth.push(path[j]);i=j}return smooth}
 for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const p=[node.p[0]+dx*spacing,node.p[1]+dy*spacing],k=p.join(','),g=node.g+Math.hypot(dx,dy)*spacing;if(closed.has(k)||g>=(best.get(k)??Infinity)||!await safe(node.p,p))continue;best.set(k,g);open.push({p,g,f:g+heuristic(p),parent:node})}
 }
 throw Error('当前高度未找到安全航线，请调整高度或更换目的地');
}
const api={resolve,plan};if(typeof module!=='undefined')module.exports=api;else root.FreeNavigation=api;
})(typeof window!=='undefined'?window:globalThis);
