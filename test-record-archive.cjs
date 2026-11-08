'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Archive=require('./dist/record-archive');

function parseCsv(source){
 assert.equal(source.charCodeAt(0),0xfeff,'CSV has an Excel-compatible Unicode BOM');
 const rows=[];let row=[],value='',quoted=false;
 for(let i=1;i<source.length;i++){
  const c=source[i];
  if(c==='"'){if(quoted&&source[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(!quoted&&c===','){row.push(value);value='';}
  else if(!quoted&&c==='\r'&&source[i+1]==='\n'){row.push(value);rows.push(row);row=[];value='';i++;}
  else value+=c;
 }
 assert(!quoted,'all quoted cells close');if(value||row.length){row.push(value);rows.push(row);}return rows;
}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}return(crc^0xffffffff)>>>0;}
function unzip(buffer){
 const bytes=Buffer.from(buffer),end=bytes.length-22;
 assert.equal(bytes.readUInt32LE(end),0x06054b50,'EOCD record exists at file end');
 assert.equal(bytes.readUInt16LE(end+4),0);assert.equal(bytes.readUInt16LE(end+6),0);
 const count=bytes.readUInt16LE(end+10),start=bytes.readUInt32LE(end+16),size=bytes.readUInt32LE(end+12);
 assert.equal(bytes.readUInt16LE(end+8),count);assert.equal(start+size,end,'central-directory length and offset match');
 const files=new Map();let at=start;
 for(let i=0;i<count;i++){
  assert.equal(bytes.readUInt32LE(at),0x02014b50,'central entry signature');
  assert.equal(bytes.readUInt16LE(at+8),0x0800,'UTF-8 filenames flag');
  assert.equal(bytes.readUInt16LE(at+10),0,'stored ZIP method');
  const crc=bytes.readUInt32LE(at+16),compressed=bytes.readUInt32LE(at+20),length=bytes.readUInt32LE(at+24),nameLength=bytes.readUInt16LE(at+28),extra=bytes.readUInt16LE(at+30),comment=bytes.readUInt16LE(at+32),offset=bytes.readUInt32LE(at+42);
  assert.equal(compressed,length,'no compression or silent truncation');
  const name=bytes.subarray(at+46,at+46+nameLength).toString('utf8');assert(!files.has(name),'ZIP entries are unique');
  assert.equal(bytes.readUInt32LE(offset),0x04034b50,'local entry signature');assert.equal(bytes.readUInt16LE(offset+6),0x0800);assert.equal(bytes.readUInt16LE(offset+8),0);
  assert.equal(bytes.readUInt32LE(offset+14),crc);assert.equal(bytes.readUInt32LE(offset+18),length);assert.equal(bytes.readUInt32LE(offset+22),length);
  const localNameLength=bytes.readUInt16LE(offset+26),localExtra=bytes.readUInt16LE(offset+28),localName=bytes.subarray(offset+30,offset+30+localNameLength).toString('utf8');assert.equal(localName,name);
  const dataAt=offset+30+localNameLength+localExtra,data=bytes.subarray(dataAt,dataAt+length);assert.equal(data.length,length);assert.equal(crc32(data),crc,'photo and JSON payload CRC validates');
  files.set(name,data);at+=46+nameLength+extra+comment;
 }
 assert.equal(at,start+size,'read all directory entries');return files;
}

(async()=>{
 const records=[
  {id:'事件一',participant:'P001',reactionMs:1234,reactionFlightSeconds:1.1,label:'拍照“完成”',detail:'第一行,带逗号\n第二行"引号"',before:{route:[[0,0],[12,5]],status:'photo'},after:{state:{battery:81.25,photoEvidence:[{checkpointId:'震旦'}]}},extra:{condition:'预测侧重',passed:true},zero:0,off:false,empty:null,negative:-2},
  {id:'二',participant:' =HYPERLINK("https://example.invalid")',detail:'@SUM(A1:A5)',newField:'后加入的字段',reactionFlightSeconds:4.5},
  {participant:'+CMD',detail:'\t=1+1',' =evil-column':'-formula',note:'\n+1'},
 ];
 const original=JSON.stringify(records),csv=Archive.csv(records),rows=parseCsv(csv),headers=rows[0],row=Object.fromEntries(headers.map((key,i)=>[key,rows[1][i]]));
 assert(headers.includes('reactionFlightSeconds'));assert(headers.includes('newField'));assert(headers.includes('extra'));assert(headers.includes("' =evil-column"),'untrusted headers cannot become formulas');
 assert.equal(row.detail,records[0].detail);assert.equal(row.participant,'P001');assert.equal(row.reactionFlightSeconds,'1.1');assert.equal(row.zero,'0');assert.equal(row.off,'false');assert.equal(row.empty,'');assert.equal(row.negative,'-2');
 assert.deepEqual(JSON.parse(row.before),records[0].before);assert.deepEqual(JSON.parse(row.after),records[0].after);assert.deepEqual(JSON.parse(row.extra),records[0].extra);
 const participant=headers.indexOf('participant'),detail=headers.indexOf('detail');assert(rows[2][participant].startsWith("' ="));assert.equal(rows[2][detail],"'@SUM(A1:A5)");assert.equal(rows[3][participant],"'+CMD");assert.equal(rows[3][detail],"'\t=1+1");
 for(const input of [undefined,[]])assert(parseCsv(Archive.csv(input))[0].includes('reactionFlightSeconds'),'empty record download retains schema headers');
 assert.throws(()=>Archive.csv([null]),/事件对象/);assert.throws(()=>Archive.csv({records:[]}),/事件对象/);

 const state={node:'N1',state:{battery:79.4,status:'complete'},route:[[0,0],[10,20]]},config={participant:'P001',condition:'projection'},stamp='2026-11-08T12:34:56.000Z';
 const png=new Uint8Array([137,80,78,71,13,10,26,10,0,1,2,3,255]),jpeg=new Uint8Array([255,216,255,224,10,20,30,0,255,217]);
 const photos=[
  {id:'../同一地点?/',trialId:'试次一',checkpointId:'震旦',image:new Blob([png],{type:'image/png'}),snapshot:{state:{battery:81.1,status:'photo'}},savedAt:stamp},
  {id:'../同一地点?/',trialId:'试次二',image:new Blob([png],{type:'image/png'}),snapshot:{route:[[1,2],[3,4]]}},
  {id:'CON',image:new Blob([jpeg],{type:'image/jpeg'}),snapshot:{label:'第二张“照片”'}},
  {id:'con',image:new Blob([jpeg],{type:'image/jpeg'})},
  {id:'missing-photo',status:'saved',snapshot:{reason:'记录存在，图像缺失'}},
  {id:'empty-photo',image:new Blob([],{type:'image/webp'}),snapshot:{status:'empty'}},
  {id:'unknown-format',image:new Blob([new Uint8Array([1,2,3])],{type:'image/unrecognized'}),snapshot:{source:'未知编码'}}
 ];
 const photoSnapshot=photos.map(({image,...metadata})=>metadata),archive=await Archive.create({records,photos,state,config,exportedAt:stamp});assert(archive instanceof Blob);assert.equal(archive.type,'application/zip');
 const files=unzip(await archive.arrayBuffer());
 assert.equal(files.size,10,'five JSON/CSV/state/config files and five actual images');
 const manifest=JSON.parse(files.get('records.json').toString());assert.equal(manifest.exportedAt,stamp);assert.equal(typeof manifest.schemaVersion,'string');assert.deepEqual(manifest.records,records);
 assert.equal(files.get('records.csv').toString(),csv);assert.deepEqual(JSON.parse(files.get('current-state.json')),state);assert.deepEqual(JSON.parse(files.get('session-config.json')),config);
 const photoManifest=JSON.parse(files.get('photo-records.json')),saved=photoManifest.photos;assert.equal(photoManifest.exportedAt,stamp);assert.equal(saved.length,photos.length);
 assert.equal(saved[0].id,photos[0].id);assert.deepEqual(saved[0].snapshot,photos[0].snapshot);assert.deepEqual(saved[1].snapshot,photos[1].snapshot);assert(!('image'in saved[0]),'metadata does not stringify Blob as an empty object');
 const actualNames=saved.filter(x=>x.file).map(x=>x.file);assert.equal(new Set(actualNames.map(x=>x.toLowerCase())).size,actualNames.length,'Windows case folding cannot overwrite photos');
 for(const file of actualNames){assert(/^photos\/photo-[a-zA-Z0-9_-]+\.[a-z]+$/.test(file));assert(!file.includes('..'));assert(files.has(file));}
 assert.deepEqual(files.get(saved[0].file),Buffer.from(png));assert.deepEqual(files.get(saved[2].file),Buffer.from(jpeg));assert(saved[2].file.endsWith('.jpg'));assert(saved[6].file.endsWith('.bin'));
 for(const index of [4,5]){assert.equal(saved[index].file,null);assert.equal(saved[index].exportStatus,'image-missing');assert(saved[index].exportReason);assert.deepEqual(saved[index].snapshot,photos[index].snapshot);}
 assert.equal(saved[0].exportStatus,'included');assert.equal(saved[0].imageMime,'image/png');assert.equal(JSON.stringify(records),original);assert.deepEqual(photos.map(({image,...metadata})=>metadata),photoSnapshot,'export leaves input records and snapshots untouched');

 const minimal=unzip(await(await Archive.create({exportedAt:stamp})).arrayBuffer());assert.deepEqual([...minimal.keys()],['records.json','records.csv','photo-records.json']);assert.deepEqual(JSON.parse(minimal.get('photo-records.json')).photos,[]);
 const legacyRaw='  {"旧记录": [损坏 JSON\n仍保留原文';
 const withRawLegacy=unzip(await(await Archive.create({legacy:legacyRaw,exportedAt:stamp})).arrayBuffer());assert.equal(withRawLegacy.get('legacy-backup.json').toString(),legacyRaw,'legacy strings preserve exact original data, including invalid JSON');
 const legacyObject={records:[{id:'旧版',state:{battery:72}}]};
 const withObjectLegacy=unzip(await(await Archive.create({legacy:legacyObject,exportedAt:stamp})).arrayBuffer());assert.deepEqual(JSON.parse(withObjectLegacy.get('legacy-backup.json')),legacyObject,'structured legacy backups serialize without losing data');
 await assert.rejects(Archive.create({exportedAt:'bad date'}),/导出时间/);await assert.rejects(Archive.create({photos:{}}),/照片记录/);await assert.rejects(Archive.create({photos:[null]}),/照片记录/);
 const changed={records:[{id:'live',after:{battery:82}}],photos:[{id:'capture',image:new Blob([png],{type:'image/png'}),snapshot:{battery:81}}],state:{battery:82},config:{participant:'initial'},exportedAt:stamp};
 const inFlight=Archive.create(changed);changed.records[0].after.battery=0;changed.photos[0].snapshot.battery=0;changed.state.battery=0;changed.config.participant='changed';
 const frozen=unzip(await(await inFlight).arrayBuffer());assert.equal(JSON.parse(frozen.get('records.json')).records[0].after.battery,82);assert.equal(JSON.parse(frozen.get('photo-records.json')).photos[0].snapshot.battery,81);assert.equal(JSON.parse(frozen.get('current-state.json')).battery,82);assert.equal(JSON.parse(frozen.get('session-config.json')).participant,'initial');

 const browser={window:{},TextEncoder,Blob,Uint32Array,Uint8Array,DataView,Date,Set};vm.createContext(browser);vm.runInContext(fs.readFileSync('dist/record-archive.js','utf8'),browser);
 assert.equal(typeof browser.window.RecordArchive?.create,'function');assert.equal(browser.window.RecordArchive.csv(records),csv);unzip(await(await browser.window.RecordArchive.create({records,photos:[],exportedAt:stamp})).arrayBuffer());
 console.log('PASS complete ZIP records/CSV/state/config/photos, CRC and Unicode directory validation, safe unique filenames, missing images, immutable snapshots and browser API');
 console.log('PASS CSV all fields including reactionFlightSeconds, nested states, multiline/quotes/Unicode, negative numbers and formula-safe text/headers');
})().catch(error=>{console.error(error);process.exitCode=1;});
