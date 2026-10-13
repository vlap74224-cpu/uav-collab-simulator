(function(root){
'use strict';
const lat=47.3971,lng=8.5455,metersAtEquator=40075016.686;
function grid(z){const n=2**z;return{x:(lng+180)/360*n,y:(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n,size:metersAtEquator*Math.cos(lat*Math.PI/180)/n}}
function requests(state,pitch){
 const heading=state.heading*Math.PI/180,reach=Math.min(260,Math.max(35,state.altitude/Math.tan(pitch*Math.PI/180))),focus={x:state.x-450+Math.sin(heading)*reach,y:state.y-330-Math.cos(heading)*reach},tiles=[];
 for(const [z,radius,priority] of [[20,3,0],[19,4,100],[17,3,200]]){const g=grid(z),center=z===17?{x:state.x-450,y:state.y-330}:focus,cx=Math.floor(g.x+center.x/g.size),cy=Math.floor(g.y+center.y/g.size);
  for(let x=cx-radius;x<=cx+radius;x++)for(let y=cy-radius;y<=cy+radius;y++)tiles.push({key:`${z}/${x}/${y}`,z,x,y,size:g.size,worldX:(x+.5-g.x)*g.size,worldY:(y+.5-g.y)*g.size,priority:priority+Math.hypot(x-cx,y-cy)});
 }return tiles.sort((a,b)=>a.priority-b.priority);
}
const api={grid,requests};if(typeof module!=='undefined')module.exports=api;else root.ViewTiles=api;
})(typeof window!=='undefined'?window:globalThis);
