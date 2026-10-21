import * as T from 'three';

// Repeating, metre-scaled surface detail for the exported perimeter blockouts.
// No added meshes, network textures, or changes to the collision geometry.
export function createPerimeterFacadeStyler(renderer){
 const materials=new Map();
 const texture=draw=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=256;draw(canvas.getContext('2d'));const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return map};
 // Quiet blue-grey glazing and continuous floor bands, without heavy window frames.
 const facades=[0,1].map(style=>texture(ctx=>{
  ctx.fillStyle=style?'#a9afad':'#929fa3';ctx.fillRect(0,0,256,256);
  const glazing=ctx.createLinearGradient(0,0,256,0);
  glazing.addColorStop(0,style?'#7c9097':'#7a929d');
  glazing.addColorStop(.45,style?'#8a9ca1':'#8fa4ac');
  glazing.addColorStop(1,style?'#7e9299':'#7d959f');
  for(let floor=0;floor<4;floor++){
   const y=floor*64,top=style?18:6,height=style?29:45;
   ctx.fillStyle=glazing;ctx.fillRect(0,y+top,256,height);
   ctx.fillStyle=style?'#9da8a9':'#a0adb1';
   const spacing=style?128:32,width=style?5:1;
   for(let x=0;x<256;x+=spacing)ctx.fillRect(x,y+top,width,height);
   ctx.fillStyle=style?'#909c9e':'#7f9198';ctx.fillRect(0,y+top+height,256,1);
   ctx.fillStyle=style?'#a0a8a7':'#87989e';ctx.fillRect(0,y+61,256,2);
  }
 }));
 const roof=texture(ctx=>{ctx.fillStyle='#7e8582';ctx.fillRect(0,0,256,256);for(let i=0;i<256;i+=64){ctx.fillStyle='#747e7a';ctx.fillRect(i,0,1,256);ctx.fillRect(0,i,256,1);ctx.fillStyle='#868f89';ctx.fillRect(i+2,0,1,256);ctx.fillRect(0,i+2,256,1);}});
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
  material.customProgramCacheKey=()=> 'perimeter-facades-v2';materials.set(key,material);return material;
 }
 return mesh=>{
  // These source IDs are the simple surrounding blocks, not the detailed landmarks.
  const id=Number(/^source_(\d+)_/.exec(mesh.name)?.[1]);
  if(!(id>=6187&&id<=6211))return false;
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(m=>materialFor(m,id%2)):materialFor(mesh.material,id%2);
  return true;
 };
}
