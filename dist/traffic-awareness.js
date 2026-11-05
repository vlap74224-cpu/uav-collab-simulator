/* Numeric camera projection and HUD layout; independent of Three.js and the DOM. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.TrafficAwareness=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const degrees=180/Math.PI,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const contains=(a,b)=>a.left<=b.left&&a.right>=b.right&&a.top<=b.top&&a.bottom>=b.bottom;
  const inset=(r,p)=>({left:r.left+p,top:r.top+p,right:r.right-p,bottom:r.bottom-p});
  const rect=(x,y,w,h)=>({left:x,top:y,right:x+w,bottom:y+h});
  const valid=r=>r&&r.right>r.left&&r.bottom>r.top;

  // World axes: x east, y altitude, z south. Camera basis vectors are unit vectors.
  function projectTarget({target,origin,referenceOrigin=origin,right,up,forward,fovY,aspect,viewport,near=.8,far=Infinity}){
    const delta={x:target.x-origin.x,y:target.y-origin.y,z:target.z-origin.z};
    const referenceDelta={x:target.x-referenceOrigin.x,y:target.y-referenceOrigin.y,z:target.z-referenceOrigin.z};
    const distance=Math.hypot(referenceDelta.x,referenceDelta.y,referenceDelta.z),x=dot(delta,right),y=dot(delta,up),depth=dot(delta,forward);
    const tangent=Math.tan(fovY/degrees/2),ndcX=depth>1e-6?x/(depth*tangent*aspect):null,ndcY=depth>1e-6?y/(depth*tangent):null;
    const azimuth=Math.atan2(x,depth)*degrees,elevation=Math.atan2(y,Math.hypot(x,depth))*degrees;
    const bearing=(Math.atan2(referenceDelta.x,-referenceDelta.z)*degrees+360)%360;
    const screenX=ndcX===null?null:viewport.left+(ndcX+1)*(viewport.right-viewport.left)/2;
    const screenY=ndcY===null?null:viewport.top+(1-ndcY)*(viewport.bottom-viewport.top)/2;
    const behind=depth<0,inFrustum=depth>=near&&depth<=far&&Math.abs(ndcX)<=1&&Math.abs(ndcY)<=1;
    return{distance,bearing,azimuth,elevation,depth,behind,inFrustum,screenX,screenY,ndcX,ndcY};
  }

  // Keep maximal empty rectangles instead of assuming a fixed tablet rail width.
  function visibleSceneBounds(viewport,obstacles=[],padding=8,minimum={width:204,height:72}){
    let free=[inset(viewport,padding)].filter(r=>r.right-r.left>=minimum.width&&r.bottom-r.top>=minimum.height);
    for(const obstacle of obstacles.filter(valid)){
      const block={left:obstacle.left-padding,top:obstacle.top-padding,right:obstacle.right+padding,bottom:obstacle.bottom+padding};
      const next=[];
      for(const area of free){
        if(!overlaps(area,block)){next.push(area);continue;}
        next.push({left:area.left,top:area.top,right:Math.min(area.right,block.left),bottom:area.bottom});
        next.push({left:Math.max(area.left,block.right),top:area.top,right:area.right,bottom:area.bottom});
        next.push({left:area.left,top:area.top,right:area.right,bottom:Math.min(area.bottom,block.top)});
        next.push({left:area.left,top:Math.max(area.top,block.bottom),right:area.right,bottom:area.bottom});
      }
      const candidates=next.filter(r=>r.right-r.left>=minimum.width&&r.bottom-r.top>=minimum.height);
      free=candidates.filter((r,i)=>!candidates.some((other,j)=>i!==j&&contains(other,r)&&(j<i||!contains(r,other))));
    }
    return free.sort((a,b)=>(b.right-b.left)*(b.bottom-b.top)-(a.right-a.left)*(a.bottom-a.top))[0]||null;
  }

  function relativeDirection({azimuth,elevation}){
    const a=Math.abs(azimuth),side=azimuth<0?'左':'右';
    const horizontal=a>=170?'后方':a>110?side+'后方':a>70?side+'侧':a>15?side+'前方':'前方';
    return horizontal+(Math.abs(elevation)>20?(elevation>0?' · 上方':' · 下方'):'');
  }

  function layoutTarget({projection,viewport,obstacles=[],ringDiameter=42,labelSize={width:184,height:44},edgeSize={width:204,height:72}}){
    if(!projection||!Number.isFinite(projection.distance))return{mode:'hidden'};
    const p=projection,diameter=Math.max(38,ringDiameter),radius=diameter/2,usable=inset(viewport,8);
    const clear=box=>contains(usable,box)&&!obstacles.some(r=>overlaps(box,r));
    const ring=rect(p.screenX-radius,p.screenY-radius,diameter,diameter);
    if(p.inFrustum&&clear(ring)){
      const w=labelSize.width,h=labelSize.height,gap=8;
      const candidates=[rect(p.screenX-w/2,p.screenY+radius+gap,w,h),rect(p.screenX-w/2,p.screenY-radius-gap-h,w,h),rect(p.screenX+radius+gap,p.screenY-h/2,w,h),rect(p.screenX-radius-gap-w,p.screenY-h/2,w,h)];
      const label=candidates.find(clear);
      // The ring is never clamped: an in-view marker is the actual projection.
      if(label)return{mode:'target',x:p.screenX,y:p.screenY,diameter,label,projection:p};
    }
    const bounds=visibleSceneBounds(viewport,obstacles,8,edgeSize);
    if(!bounds)return{mode:'hidden',projection:p};
    const cx=(bounds.left+bounds.right)/2,cy=(bounds.top+bounds.bottom)/2;
    let dx,dy;
    if(p.depth>0){dx=p.screenX-cx;dy=p.screenY-cy;}
    else if(p.behind){
      // Dividing by negative depth would mirror a rear target into the scene.
      dx=p.azimuth<0?-1:1;dy=-Math.tan(clamp(p.elevation,-75,75)/degrees);
    }
    else{dx=Math.sin(p.azimuth/degrees);dy=-Math.sin(p.elevation/degrees);}
    if(Math.hypot(dx,dy)<1e-6){dx=p.azimuth<0?-1:1;dy=0;}
    const rx=Math.max(0,(bounds.right-bounds.left-edgeSize.width)/2),ry=Math.max(0,(bounds.bottom-bounds.top-edgeSize.height)/2);
    const scale=Math.min(Math.abs(dx)>1e-9?rx/Math.abs(dx):Infinity,Math.abs(dy)>1e-9?ry/Math.abs(dy):Infinity);
    const reason=p.behind?'相机后方':!p.inFrustum?'相机视角外':obstacles.some(r=>overlaps(ring,r))?'面板遮挡':'画面边缘';
    return{mode:'edge',x:cx+dx*scale,y:cy+dy*scale,width:edgeSize.width,height:edgeSize.height,angle:Math.atan2(dy,dx)*degrees,direction:relativeDirection(p),reason,bounds,projection:p};
  }
  return{projectTarget,visibleSceneBounds,layoutTarget,relativeDirection};
});
