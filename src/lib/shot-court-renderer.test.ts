import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createCourtRenderer } from "@/components/shot-chart/court-renderer";
import type { CourtShot } from "@/lib/court-shots";
const gpu=vi.hoisted(()=>({render:vi.fn(),dispose:vi.fn(),setPixelRatio:vi.fn(),setSize:vi.fn()}));
vi.mock("three",async(importOriginal)=>{
  const actual=await importOriginal<typeof import("three")>();
  return {...actual,WebGLRenderer:class {
    render=gpu.render;dispose=gpu.dispose;setPixelRatio=gpu.setPixelRatio;setSize=gpu.setSize;setClearColor=vi.fn();
  }};
});
const shot: CourtShot={eventId:1,personId:1,playerName:"Unit test",teamId:1,teamTricode:"TST",period:1,clock:"PT01M00.00S",result:"Made",value:2,xFeet:-4,yFeet:-1.2};
let callbacks:Map<number,FrameRequestCallback>,nextId:number;
let bounds={width:343,height:350};
const canvas={getBoundingClientRect:()=>bounds} as HTMLCanvasElement;
function flush(){const queue=[...callbacks.entries()];callbacks.clear();for(const [,callback] of queue)callback(0);}
function currentScene():THREE.Scene{return gpu.render.mock.calls.at(-1)![0];}
function currentCamera():THREE.PerspectiveCamera{return gpu.render.mock.calls.at(-1)![1];}
function floorTexture():THREE.Texture {
  const floor=currentScene().children.find(o=>o instanceof THREE.Mesh&&o.geometry instanceof THREE.PlaneGeometry) as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshStandardMaterial>;
  return floor.material.map!;
}
beforeEach(()=>{
  vi.clearAllMocks();callbacks=new Map();nextId=1;bounds={width:343,height:350};
  vi.stubGlobal("window",{devicePixelRatio:3});
  vi.stubGlobal("requestAnimationFrame",(cb:FrameRequestCallback)=>{const id=nextId++;callbacks.set(id,cb);return id;});
  vi.stubGlobal("cancelAnimationFrame",(id:number)=>callbacks.delete(id));
  vi.stubGlobal("document",{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true})})});
});
afterEach(()=>vi.unstubAllGlobals());
describe("Three court renderer lifecycle and projection (GPU stubbed)",()=>{
  it("fits the entire half court and backboard at narrow and desktop widths",()=>{
    const controller=createCourtRenderer(canvas,vi.fn());
    for(const [width,height] of [[288,350],[343,350],[800,440],[1200,500]]) {
      bounds={width,height};controller.resize();controller.reset();flush();
      for(const xyz of [[-27,0,-7.25],[27,0,-7.25],[-27,0,43.75],[27,0,43.75],[0,13.25,-1.25]]) {
        const p=new THREE.Vector3(xyz[0],xyz[1],xyz[2]).project(currentCamera());
        expect(Math.abs(p.x)).toBeLessThan(.97);expect(Math.abs(p.y)).toBeLessThan(.97);
      }
    }controller.dispose();
  });
  it("projects real positions through the exact rendered camera after rotation and top-down",()=>{
    const onFrame=vi.fn(),controller=createCourtRenderer(canvas,onFrame);controller.resize();controller.setShots([shot]);flush();
    const check=()=>{
      const expected=new THREE.Vector3(shot.xFeet,.12,shot.yFeet).project(currentCamera());
      const frame=onFrame.mock.calls.at(-1)![0];
      expect(frame.points[0].x).toBeCloseTo((expected.x+1)*bounds.width/2);
      expect(frame.points[0].y).toBeCloseTo((1-expected.y)*bounds.height/2);expect(frame.points[0].eventId).toBe(shot.eventId);
    };
    check();controller.orbit(.5,.1);flush();check();controller.top();flush();check();
    const initial=currentCamera().position.clone();controller.zoom(.9);flush();expect(currentCamera().position.distanceTo(new THREE.Vector3(0,0,18))).toBeLessThan(initial.distanceTo(new THREE.Vector3(0,0,18)));controller.dispose();
  });
  it("coalesces frames and consumes no continuous animation loop",()=>{
    const controller=createCourtRenderer(canvas,vi.fn());controller.resize();controller.setShots([shot]);controller.orbit(.2);controller.zoom(1.1);
    expect(callbacks.size).toBe(1);flush();expect(gpu.render).toHaveBeenCalledTimes(1);expect(callbacks.size).toBe(0);
    controller.dispose();
  });
  it("caps and refreshes device pixel ratio",()=>{
    const controller=createCourtRenderer(canvas,vi.fn());expect(gpu.setPixelRatio).toHaveBeenLastCalledWith(1.5);
    vi.stubGlobal("window",{devicePixelRatio:1});controller.resize();expect(gpu.setPixelRatio).toHaveBeenLastCalledWith(1);controller.dispose();
  });
  it("releases replaced textures once and does not retain a growing texture history",()=>{
    const controller=createCourtRenderer(canvas,vi.fn());controller.resize();flush();
    const old=vi.spyOn(floorTexture(),"dispose");controller.setTheme(true);flush();expect(old).toHaveBeenCalledTimes(1);
    const next=vi.spyOn(floorTexture(),"dispose");controller.setTheme(false);flush();expect(next).toHaveBeenCalledTimes(1);
    const final=vi.spyOn(floorTexture(),"dispose");controller.dispose();controller.dispose();
    expect(old).toHaveBeenCalledTimes(1);expect(next).toHaveBeenCalledTimes(1);expect(final).toHaveBeenCalledTimes(1);expect(gpu.dispose).toHaveBeenCalledTimes(1);
  });
  it("cancels pending frames and disposes every geometry and material exactly once",()=>{
    const controller=createCourtRenderer(canvas,vi.fn());controller.resize();flush();
    const resources=new Set<THREE.BufferGeometry|THREE.Material>();
    currentScene().traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])resources.add(m);}});
    const spies=[...resources].map(r=>vi.spyOn(r,"dispose"));controller.orbit(.1);expect(callbacks.size).toBe(1);
    controller.dispose();controller.resize();controller.setTheme(true);controller.dispose();expect(callbacks.size).toBe(0);spies.forEach(spy=>expect(spy).toHaveBeenCalledTimes(1));
  });
  it("cleans up a renderer if texture initialization fails",()=>{
    vi.stubGlobal("document",{createElement:()=>({getContext:()=>null})});
    expect(()=>createCourtRenderer(canvas,vi.fn())).toThrow("Court texture unavailable");expect(gpu.dispose).toHaveBeenCalledTimes(1);
  });
});
