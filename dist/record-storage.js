(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.RecordStorage=api.create({storage:root.localStorage});
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const keys=Object.freeze({data:'uav-collab-v1',legacy:'uav-before-lujiazui-v4',config:'uav-research-config-v1',control:'uav-record-control-v1'});
 function create({storage,now=()=>Date.now(),id=()=>crypto.randomUUID()}={}){
  let busy=false;
  const control=()=>JSON.parse(storage.getItem(keys.control)||'null');
  function lease(){const c=control();return Object.freeze({generation:c?.generation||'initial',available:!c||c.phase==='ready'});}
  function current(token){try{const c=control();return !!token?.available&&(!c||c.phase==='ready')&&token.generation===(c?.generation||'initial');}catch{return false;}}
  function read(){
   const c=control();if(c?.phase==='clearing')return null;
   const raw=storage.getItem(keys.data);if(!raw)return null;
   const data=JSON.parse(raw);
   if(c?.phase==='ready'&&data.recordGeneration!==c.generation){storage.removeItem(keys.data);return null;}
   return data;
  }
  async function clear({clearPhotos}={}){
   if(busy)throw Error('正在清空，请稍候');
   if(typeof clearPhotos!=='function')throw Error('照片清空功能尚未就绪');
   busy=true;const generation=id();
   try{
    const marker=JSON.stringify({generation,phase:'clearing',at:now()});
    try{storage.setItem(keys.control,marker);}catch(error){
     if(error.name!=='QuotaExceededError'&&error.code!==22&&error.code!==1014)throw error;
     // A full event store must not prevent its own explicitly requested clear.
     storage.removeItem(keys.legacy);storage.removeItem(keys.data);storage.setItem(keys.control,marker);
    }
    await clearPhotos();
    storage.removeItem(keys.data);storage.removeItem(keys.legacy);
    storage.setItem(keys.control,JSON.stringify({generation,phase:'ready',at:now()}));
    return {generation};
   }catch(error){
    try{storage.setItem(keys.control,JSON.stringify({generation,phase:'failed',at:now()}));}catch{}
    throw error;
   }finally{busy=false;}
  }
  return Object.freeze({keys,lease,current,read,clear});
 }
 return Object.freeze({keys,create});
});
