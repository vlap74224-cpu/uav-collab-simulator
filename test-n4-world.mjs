import {registerHooks,createRequire} from 'node:module';import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';
registerHooks({resolve(s,c,next){if(s==='three')return{url:new URL('./dist/vendor/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(s,c)}});
const T=await import('./dist/vendor/three.module.min.js'),{MeshBVH}=await import('./dist/vendor/three-mesh-bvh.module.js'),require=createRequire(import.meta.url),C=require('./dist/core.js'),Sequence=require('./dist/sequence.js'),colliders=[];
for(const file of JSON.parse(fs.readFileSync('dist/assets/model-parts.json','utf8'))){const bytes=fs.readFileSync('dist/assets/'+file),jsonSize=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonSize).toString()),bin=bytes.subarray(28+jsonSize);
 const accessor=id=>{const a=gltf.accessors[id],view=gltf.bufferViews[a.bufferView],ctor={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array}[a.componentType],width={SCALAR:1,VEC3:3}[a.type],offset=(view.byteOffset||0)+(a.byteOffset||0);return new ctor(bin.buffer,bin.byteOffset+offset,a.count*width)};
 for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(accessor(primitive.attributes.POSITION),3));if(primitive.indices!==undefined)geometry.setIndex(new T.BufferAttribute(accessor(primitive.indices),1));geometry.computeBoundingBox();colliders.push({box:geometry.boundingBox,bvh:new MeshBVH(geometry,{maxLeafTris:12})})}
}
console.log('COLLIDERS',colliders.length);
function clearance(p){const q=new T.Vector3(p.x-450,p.z,p.y-330);let distance=Infinity;const sorted=colliders.map(c=>({c,d:c.box.distanceToPoint(q)})).sort((a,b)=>a.d-b.d);for(const {c,d} of sorted){if(d>distance)break;const hit=c.bvh.closestPointToPoint(q,{},0,distance);if(hit)distance=Math.min(distance,hit.distance)}return{distance:Math.max(0,distance-1.5)}}
function collision(a,b){const pa=new T.Vector3(a.x-450,a.z,a.y-330),pb=new T.Vector3(b.x-450,b.z,b.y-330),line=new T.Line3(pa,pb),box=new T.Box3().setFromPoints([pa,pb]).expandByScalar(1.5);for(const c of colliders){if(!box.intersectsBox(c.box))continue;if(c.bvh.shapecast({intersectsBounds:b=>b.intersectsBox(box),intersectsTriangle:tri=>tri.closestPointToSegment(line)<=1.5}))return {label:'building'}}return null}

const m=Sequence.make(2,Sequence.points[2].point,82);
function scan(route){return route.slice(1).map((b,i)=>{const a=route[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);let min=Infinity,point;for(let j=0;j<=n;j++){const t=j/n,p={x:a[0]+t*(b[0]-a[0]),y:a[1]+t*(b[1]-a[1]),z:60},d=clearance(p).distance;if(d<min){min=d;point=p}}return{segment:i+1,min,point,hit:collision({x:a[0],y:a[1],z:60},{x:b[0],y:b[1],z:60})}})}

const segments=scan(m.route);for(const segment of segments){assert(segment.min>25,'N4 must stay green with margin: '+JSON.stringify(segment));assert.equal(segment.hit,null,'N4 segment must not collide')}
assert.deepEqual(C.validate(m.route,m,60,12),[]);
const Traffic=require('./dist/traffic.js'),target=Traffic.create(m.route[0],m.destination.point,12,m.route),cross=C.sample(m.route,.5),traffic=Traffic.position(target,target.crossTime);assert(Math.hypot(cross.x-traffic.x,cross.y-traffic.y)<.01,'N4 dynamic crossing must follow revised route');
console.log('PASS N4 full mesh clearance and dynamic crossing',JSON.stringify({minimum:Math.min(...segments.map(x=>x.min)),segments}));
