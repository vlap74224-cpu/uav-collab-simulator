/* Local research-record exports. No storage access or external dependencies. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RecordArchive=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const columns=['wallTimeMs','simRate','operationSource','simTime','reactionFlightSeconds','planVersion','eventId','eventPhase','id','version','timestamp','sessionId','participant','condition','satDisplayMode','visibleSatLevels','trialId','node','obstacleSubtype','destination','goalDeferred','type','label','detail','reactionMs','before','after','stimulus','rationale'];
 const encoder=new TextEncoder(),MAX32=0xffffffff;
 const crcTable=Uint32Array.from({length:256},(_,index)=>{let n=index;for(let bit=0;bit<8;bit++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 function crc32(bytes){let sum=MAX32;for(const byte of bytes)sum=crcTable[(sum^byte)&255]^(sum>>>8);return(sum^MAX32)>>>0;}
 function recordRows(records){
  if(!Array.isArray(records)||records.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw Error('记录必须为事件对象列表');
  return records;
 }
 function csvCell(value){
  let text=value===null||value===undefined?'':typeof value==='object'?JSON.stringify(value):String(value);
  // Protect both data and user-defined column names when opened in a spreadsheet.
  if(typeof value==='string'&&(/^[\s\uFEFF]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text)))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
 }
 function csv(records=[]){
  const rows=recordRows(records),keys=new Set(columns);
  for(const row of rows)for(const key of Object.keys(row))keys.add(key);
  const fields=[...keys];
  return '\uFEFF'+fields.map(csvCell).join(',')+'\r\n'+rows.map(row=>fields.map(key=>csvCell(Object.prototype.hasOwnProperty.call(row,key)?row[key]:undefined)).join(',')).join('\r\n');
 }
 function dosTime(date){
  const year=Math.max(1980,Math.min(2107,date.getUTCFullYear()));
  return {time:(date.getUTCHours()<<11)|(date.getUTCMinutes()<<5)|Math.floor(date.getUTCSeconds()/2),date:((year-1980)<<9)|((date.getUTCMonth()+1)<<5)|date.getUTCDate()};
 }
 function header(size){const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)};}
 async function zip(files,date){
  if(files.length>0xffff)throw Error('记录文件过多，请分会话下载');
  const local=[],central=[],stamp=dosTime(date);let offset=0,centralSize=0;
  for(const file of files){
   const name=encoder.encode(file.name),bytes=typeof file.data==='string'?encoder.encode(file.data):new Uint8Array(await file.data.arrayBuffer()),size=bytes.byteLength;
   if(name.length>0xffff||size>MAX32||offset+30+name.length+size>MAX32)throw Error('备份超过 ZIP 容量限制，请分会话下载');
   const checksum=crc32(bytes),a=header(30),b=header(46);
   a.view.setUint32(0,0x04034b50,true);a.view.setUint16(4,20,true);a.view.setUint16(6,0x0800,true);a.view.setUint16(8,0,true);
   a.view.setUint16(10,stamp.time,true);a.view.setUint16(12,stamp.date,true);a.view.setUint32(14,checksum,true);a.view.setUint32(18,size,true);a.view.setUint32(22,size,true);a.view.setUint16(26,name.length,true);
   b.view.setUint32(0,0x02014b50,true);b.view.setUint16(4,20,true);b.view.setUint16(6,20,true);b.view.setUint16(8,0x0800,true);b.view.setUint16(10,0,true);
   b.view.setUint16(12,stamp.time,true);b.view.setUint16(14,stamp.date,true);b.view.setUint32(16,checksum,true);b.view.setUint32(20,size,true);b.view.setUint32(24,size,true);b.view.setUint16(28,name.length,true);b.view.setUint32(42,offset,true);
   local.push(a.bytes,name,bytes);central.push(b.bytes,name);offset+=30+name.length+size;centralSize+=46+name.length;
  }
  if(offset+centralSize+22>MAX32)throw Error('备份超过 ZIP 容量限制，请分会话下载');
  const end=header(22);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,files.length,true);end.view.setUint16(10,files.length,true);end.view.setUint32(12,centralSize,true);end.view.setUint32(16,offset,true);
  return new Blob([...local,...central,end.bytes],{type:'application/zip'});
 }
 const extensions={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/avif':'avif','image/heic':'heic','image/heif':'heif'};
 function photoName(photo,index,mime,used){
  const id=String(photo.id??photo.imageKey??index+1).replace(/[^a-zA-Z0-9_-]/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||String(index+1),base='photos/photo-'+id,extension=extensions[mime]||'bin';
  let suffix=1,name=base+'.'+extension;
  while(used.has(name.toLowerCase()))name=base+'-'+(++suffix)+'.'+extension;
  used.add(name.toLowerCase());return name;
 }
 async function create({records=[],photos=[],state=null,config=null,legacy=null,exportedAt}={}){
  recordRows(records);if(!Array.isArray(photos))throw Error('照片记录必须为列表');
  const date=new Date(exportedAt??Date.now());if(!Number.isFinite(date.getTime()))throw Error('导出时间格式无效');
  const exported=date.toISOString(),json=value=>JSON.stringify(value,null,2),files=[
   {name:'records.json',data:json({schemaVersion:'3.1.0',exportedAt:exported,records})},
   {name:'records.csv',data:csv(records)},
  ];
  if(state!==null&&state!==undefined)files.push({name:'current-state.json',data:json(state)});
  if(config!==null&&config!==undefined)files.push({name:'session-config.json',data:json(config)});
  if(legacy!==null&&legacy!==undefined)files.push({name:'legacy-backup.json',data:typeof legacy==='string'?legacy:json(legacy)});
  const used=new Set(),metadata=[];
  for(let i=0;i<photos.length;i++){
   const photo=photos[i];if(!photo||typeof photo!=='object')throw Error('照片记录格式无效');
   const {image,...entry}=photo,available=image&&typeof image.arrayBuffer==='function'&&Number.isFinite(image.size)&&image.size>0,mime=typeof image?.type==='string'?image.type.toLowerCase().split(';')[0].trim():'';
   const name=available?photoName(photo,i,mime,used):null;
   metadata.push({...entry,file:name,imageMime:mime||null,exportStatus:available?'included':'image-missing',...(!available?{exportReason:'本条记录没有可导出的照片文件，保留元数据与场景快照'}:{})});
   if(available)files.push({name,data:image});
  }
  // Serialize snapshots before asynchronous Blob reads so one download has one
  // coherent snapshot even if the caller's active flight continues updating.
  files.push({name:'photo-records.json',data:json({schemaVersion:'1.0.0',exportedAt:exported,photos:metadata})});
  return zip(files,date);
 }
 return Object.freeze({csv,create});
});
