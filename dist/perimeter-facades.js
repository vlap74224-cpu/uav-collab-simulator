import * as T from 'three';

// Repeating, metre-scaled surface detail for the exported perimeter blockouts.
// No added meshes, network textures, or changes to the collision geometry.
export function createPerimeterFacadeStyler(renderer){
 const materials=new Map();
 const texture=draw=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=256;draw(canvas.getContext('2d'));const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return map};
 const facades=[0,1].map(style=>texture(ctx=>{
  ctx.fillStyle=style?'#a7a294':'#8f9da2';ctx.fillRect(0,0,256,256);
  for(let floor=0;floor<4;floor++)for(let bay=0;bay<4;bay++){
   const x=bay*64,y=floor*64,inset=style?15:5,w=64-inset*2,h=style?36:43;
   // A shallow painted reveal and varied blue-grey glazing are enough at flight distance.
   ctx.fillStyle='#5b6568';ctx.fillRect(x+inset-2,y+9,w+4,h+4);
   ctx.fillStyle=['#45616e','#536e79','#3d5967','#617d87'][(bay+floor*3+style)%4];ctx.fillRect(x+inset,y+11,w,h);
   ctx.fillStyle='rgba(197,216,219,.22)';ctx.fillRect(x+inset+2,y+13,w-4,4);
   ctx.fillStyle='#a5b1b3';ctx.fillRect(x+31,y+11,2,h);
   ctx.fillStyle='rgba(27,39,43,.25)';ctx.fillRect(x+inset,y+11,w,2);
   ctx.fillStyle=style?'#8a887e':'#6c7d83';ctx.fillRect(x,y+59,64,3);
   ctx.fillStyle=style?'#c1bdb0':'#aab7bb';ctx.fillRect(x,y+62,64,2);
  }
 }));
 const roof=texture(ctx=>{ctx.fillStyle='#7e8582';ctx.fillRect(0,0,256,256);for(let i=0;i<256;i+=64){ctx.fillStyle='#626c69';ctx.fillRect(i,0,2,256);ctx.fillRect(0,i,256,2);ctx.fillStyle='#969d98';ctx.fillRect(i+2,0,1,256);ctx.fillRect(0,i+2,256,1);}});
 function materialFor(original,style){
  const key=original.uuid+':'+style;if(materials.has(key))return materials.get(key);
  const material=original.clone();material.color.set('#ffffff');material.metalness=.05;material.roughness=.82;material.flatShading=true;
  material.onBeforeCompile=shader=>{
   shader.uniforms.perimeterWall={value:facades[style]};shader.uniforms.perimeterRoof={value:roof};
   const varying='varying vec3 vPerimeterPosition;\n';
   shader.vertexShader=varying+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vPerimeterPosition=(modelMatrix*vec4(position,1.0)).xyz;`);
   shader.fragmentShader=varying+'uniform sampler2D perimeterWall;\nuniform sampler2D perimeterRoof;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec3 perimeterNormal=normalize(cross(dFdx(vPerimeterPosition),dFdy(vPerimeterPosition)));
    float perimeterSide=step(abs(perimeterNormal.x)+0.02,abs(perimeterNormal.z));
    vec2 perimeterUV=vec2(mix(vPerimeterPosition.z,vPerimeterPosition.x,perimeterSide),vPerimeterPosition.y)/vec2(12.0,13.6);
    vec3 perimeterWallColour=texture2D(perimeterWall,perimeterUV).rgb;
    vec3 perimeterRoofColour=texture2D(perimeterRoof,vPerimeterPosition.xz/24.0).rgb;
    diffuseColor.rgb*=mix(perimeterWallColour,perimeterRoofColour,smoothstep(0.65,0.9,abs(perimeterNormal.y)));`);
  };
  material.customProgramCacheKey=()=> 'perimeter-facades-v1';materials.set(key,material);return material;
 }
 return mesh=>{
  // These source IDs are the simple surrounding blocks, not the detailed landmarks.
  const id=Number(/^source_(\d+)_/.exec(mesh.name)?.[1]);
  if(!(id>=6187&&id<=6211))return false;
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(m=>materialFor(m,id%2)):materialFor(mesh.material,id%2);
  return true;
 };
}
