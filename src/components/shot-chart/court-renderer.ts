// Lazy browser-only Three.js renderer. Three.js is MIT licensed; see
// docs/3d-shot-court.md. No external assets, models, textures, or CDN requests.
import * as THREE from "three";
import { COURT, FLOOR, courtLines, type ProjectedShot } from "./court-geometry";
import type { CourtShot } from "@/lib/court-shots";

export interface CourtRenderer {
  setShots(shots: readonly CourtShot[]): void;
  setTheme(light: boolean): void;
  orbit(dx: number, dy?: number): void;
  zoom(factor: number): void;
  top(): void;
  reset(): void;
  resize(): void;
  dispose(): void;
}
export interface CourtFrame { width: number; height: number; points: ProjectedShot[] }

function courtTexture(light: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1536; canvas.height = 1440;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Court texture unavailable");
  const sx = canvas.width / (FLOOR.right-FLOOR.left), sy = canvas.height/(FLOOR.front-FLOOR.back);
  const x = (n:number) => (n-FLOOR.left)*sx, y = (n:number) => (n-FLOOR.back)*sy;
  ctx.fillStyle = light ? "#ca9b63" : "#b4834e"; ctx.fillRect(0,0,canvas.width,canvas.height);
  // Deterministic original parquet. This texture is decoration, never data.
  for (let row=0; row<54; row++) {
    const width=canvas.width/54, hue=32+(row%4), l=(light?64:56)+(Math.sin(row*2.7)*3);
    ctx.fillStyle=`hsl(${hue} 48% ${l}%)`; ctx.fillRect(row*width,0,width,canvas.height);
    ctx.strokeStyle="rgba(63,37,18,.11)"; ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(row*width,0);ctx.lineTo(row*width,canvas.height);ctx.stroke();
    for(let segment=0;segment<6;segment++) {
      const h=((segment+(row%3)/3)*canvas.height/5)%canvas.height;
      ctx.beginPath();ctx.moveTo(row*width,h);ctx.lineTo((row+1)*width,h);ctx.stroke();
    }
    for(let grain=0;grain<3;grain++) {
      ctx.strokeStyle="rgba(99,58,25,.055)";ctx.beginPath();
      for(let q=0;q<=30;q++) {
        const px=(row+(grain+1)/4)*width+Math.sin(q*.4+row)*2;
        if(q===0) ctx.moveTo(px,0);else ctx.lineTo(px,q*canvas.height/30);
      }ctx.stroke();
    }
  }
  ctx.fillStyle="rgba(24,54,76,.82)";
  ctx.fillRect(x(-8),y(COURT.baseline),16*sx,(COURT.freeThrow-COURT.baseline)*sy);
  // Perimeter band intentionally uses an original, unbranded treatment.
  ctx.fillStyle="#21374b";
  ctx.fillRect(0,0,canvas.width,y(COURT.baseline));
  ctx.fillRect(0,y(COURT.midcourt),canvas.width,canvas.height-y(COURT.midcourt));
  ctx.fillRect(0,0,x(COURT.left),canvas.height);
  ctx.fillRect(x(COURT.right),0,canvas.width-x(COURT.right),canvas.height);
  ctx.strokeStyle="#f8ecd5";ctx.lineWidth=sx*.13;ctx.lineJoin="round";
  for (const line of courtLines()) {
    ctx.setLineDash(line.dashed?[sx*.7,sx*.7]:[]);ctx.beginPath();
    line.points.forEach(([px,py],i) => i===0?ctx.moveTo(x(px),y(py)):ctx.lineTo(x(px),y(py)));ctx.stroke();
  }
  ctx.setLineDash([]);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace; texture.anisotropy=4;
  return texture;
}

/** Owns every GPU resource and renders only after changes, never an idle loop. */
export function createCourtRenderer(canvas: HTMLCanvasElement, onFrame: (frame:CourtFrame)=>void): CourtRenderer {
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:"low-power"});
  const materials:THREE.Material[]=[], geometries:THREE.BufferGeometry[]=[];
  const textures=new Set<THREE.Texture>();
  const release=()=>{geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());textures.clear();renderer.dispose();};
  try {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000,0);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(38,1,.1,400);
  const target=new THREE.Vector3(0,0,18);
  let theta=.34, elevation=.88, zoomScale=1, width=1,height=1, light=false;
  let disposed=false, pending=0, shots:readonly CourtShot[]=[];
  function material(color:string,options:THREE.MeshStandardMaterialParameters={}) {
    const m=new THREE.MeshStandardMaterial({color,roughness:.65,metalness:0,...options});materials.push(m);return m;
  }
  function mesh(geometry:THREE.BufferGeometry,mat:THREE.Material,position:[number,number,number]) {
    geometries.push(geometry);const m=new THREE.Mesh(geometry,mat);m.position.set(...position);scene.add(m);return m;
  }
  const hemi=new THREE.HemisphereLight(0xffffff,0x617185,2.5);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffedda,2.2);sun.position.set(-25,60,30);scene.add(sun);
  const slab=material("#243549");
  mesh(new THREE.BoxGeometry(54,.8,51),slab,[0,-.48,18.25]);
  const floorMaterial=material("#ffffff",{map:courtTexture(false),roughness:.76});textures.add(floorMaterial.map!);
  const floor=mesh(new THREE.PlaneGeometry(54,51),floorMaterial,[0,-.07,18.25]);floor.rotation.x=-Math.PI/2;
  const metal=material("#dde8ef",{roughness:.4,metalness:.3});
  const navy=material("#24384e");
  const orange=material("#ff702c",{roughness:.4,metalness:.25});
  const glass=material("#c6e7f2",{transparent:true,opacity:.23,roughness:.2,depthWrite:false,side:THREE.DoubleSide});
  // Rim center is at (0,10,0). No fabricated shot height or flight path.
  mesh(new THREE.BoxGeometry(.28,12.3,.32),navy,[0,6.05,-4]);
  mesh(new THREE.BoxGeometry(.25,.3,2.8),metal,[0,11.8,-2.65]);
  mesh(new THREE.BoxGeometry(6,3.5,.13),glass,[0,11.5,-1.25]);
  const frameParts:[number,number,number,number,number,number][]=[
    [6,.1,.2,0,9.75,-1.25],[6,.1,.2,0,13.25,-1.25],[.1,3.5,.2,-3,11.5,-1.25],[.1,3.5,.2,3,11.5,-1.25],
    [2,.085,.19,0,10.15,-1.15],[2,.085,.19,0,11.65,-1.15],[.085,1.5,.19,-1,10.9,-1.15],[.085,1.5,.19,1,10.9,-1.15],
  ];
  frameParts.forEach(([w,h,d,x,y,z])=>mesh(new THREE.BoxGeometry(w,h,d),metal,[x,y,z]));
  mesh(new THREE.BoxGeometry(.2,.15,.6),orange,[0,10,-.94]);
  const rim=mesh(new THREE.TorusGeometry(.75,.07,8,48),orange,[0,10,0]);rim.rotation.x=Math.PI/2;
  const netMaterial=new THREE.LineBasicMaterial({color:0xe8eef5,transparent:true,opacity:.65});materials.push(netMaterial);
  const netPoints:number[]=[];
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6,b=a+Math.PI/6;
    netPoints.push(Math.cos(a)*.73,9.94,Math.sin(a)*.73,Math.cos(b)*.42,8.6,Math.sin(b)*.42);
    netPoints.push(Math.cos(a)*.73,9.94,Math.sin(a)*.73,Math.cos(a-Math.PI/6)*.42,8.6,Math.sin(a-Math.PI/6)*.42);
  }
  const netGeometry=new THREE.BufferGeometry();netGeometry.setAttribute("position",new THREE.Float32BufferAttribute(netPoints,3));geometries.push(netGeometry);scene.add(new THREE.LineSegments(netGeometry,netMaterial));
  const projected=new THREE.Vector3();
  function render() {
    pending=0;if(disposed)return;
    const aspect=width/height;
    // Fit the entire half court at default zoom, including 320px phones.
    const halfFov=Math.atan(Math.tan(THREE.MathUtils.degToRad(19))*Math.min(1,aspect));
    const distance=(38/Math.sin(halfFov))*1.03*zoomScale;
    const horizontal=Math.cos(elevation)*distance;
    camera.position.set(Math.sin(theta)*horizontal,Math.sin(elevation)*distance,18+Math.cos(theta)*horizontal);
    camera.lookAt(target);camera.updateMatrixWorld();renderer.render(scene,camera);
    onFrame({width,height,points:shots.map(s=>{
      projected.set(s.xFeet,.12,s.yFeet).project(camera);
      return {eventId:s.eventId,x:(projected.x+1)*width/2,y:(1-projected.y)*height/2,visible:projected.z>-1&&projected.z<1&&Math.abs(projected.x)<1.06&&Math.abs(projected.y)<1.06};
    })});
  }
  function invalidate(){if(!disposed&&!pending)pending=requestAnimationFrame(render);}
  function resize(){if(disposed)return;renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();invalidate();}
  return {
    setShots(next){shots=next;invalidate();},
    setTheme(next){if(disposed||next===light)return;light=next;if(floorMaterial.map){floorMaterial.map.dispose();textures.delete(floorMaterial.map);}floorMaterial.map=courtTexture(light);textures.add(floorMaterial.map);floorMaterial.needsUpdate=true;invalidate();},
    orbit(dx,dy=0){theta+=dx;elevation=THREE.MathUtils.clamp(elevation+dy,.5,Math.PI/2-.001);invalidate();},
    zoom(factor){zoomScale=THREE.MathUtils.clamp(zoomScale*factor,.72,1.55);invalidate();},
    top(){theta=0;elevation=Math.PI/2-.001;zoomScale=1;invalidate();},
    reset(){theta=.34;elevation=.88;zoomScale=1;invalidate();},
    resize,
    dispose(){if(disposed)return;disposed=true;if(pending)cancelAnimationFrame(pending);scene.clear();release();},
  };
  } catch(error) { release(); throw error; }
}
