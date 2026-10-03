import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import type { CourtShot } from "@/lib/court-shots";
import CourtView from "@/components/shot-chart/CourtView";
import { courtCopy } from "@/components/shot-chart/court-copy";

// A small hook/commit harness verifies the lazy-load boundary without a GPU or
// browser. It does not stand in for the release's browser interaction checks.
const harness=vi.hoisted(()=>({states:[] as unknown[],refs:[] as {current:unknown}[],effects:[] as (()=>void|(()=>void))[],stateIndex:0,refIndex:0,imports:0,create:vi.fn()}));
vi.mock("react",async original=>{
  const actual=await original<typeof import("react")>();
  return {...actual,
    useState:(initial:unknown)=>{const i=harness.stateIndex++;if(!(i in harness.states))harness.states[i]=typeof initial==="function"?initial():initial;return [harness.states[i],(next:unknown)=>{harness.states[i]=typeof next==="function"?next(harness.states[i]):next;}];},
    useRef:(initial:unknown)=>{const i=harness.refIndex++;return harness.refs[i]??(harness.refs[i]={current:initial});},
    useCallback:(fn:unknown)=>fn,
    useMemo:(fn:()=>unknown)=>fn(),
    useEffect:(effect:()=>void|(()=>void))=>harness.effects.push(effect),
  };
});
vi.mock("@/components/shot-chart/court-renderer",()=>{harness.imports++;return {createCourtRenderer:harness.create};});
interface Props {children?:ReactNode;onClick?:()=>void;ref?:{current:unknown};[key:string]:unknown}
function elements(node:ReactNode,type:string):ReactElement<Props>[] {
  if(Array.isArray(node))return node.flatMap(n=>elements(n,type));
  if(!isValidElement<Props>(node))return [];
  return [...(node.type===type?[node]:[]),...elements(node.props.children,type)];
}
function render(shots:CourtShot[]=[],onSelect=vi.fn()){harness.stateIndex=0;harness.refIndex=0;harness.effects=[];return CourtView({shots,selectedId:null,onSelect,copy:courtCopy.en});}
const controller=()=>({setShots:vi.fn(),setTheme:vi.fn(),resize:vi.fn(),dispose:vi.fn(),orbit:vi.fn(),zoom:vi.fn(),top:vi.fn(),reset:vi.fn()});
let instance:ReturnType<typeof controller>,listeners:Map<string,(event:Event)=>void>;
const canvas={addEventListener:(name:string,fn:(event:Event)=>void)=>listeners.set(name,fn),removeEventListener:(name:string)=>listeners.delete(name)};
beforeEach(()=>{
  harness.states=[];harness.refs=[];harness.effects=[];harness.create.mockReset();instance=controller();harness.create.mockReturnValue(instance);listeners=new Map();
  vi.stubGlobal("window",{addEventListener:vi.fn(),removeEventListener:vi.fn()});
  vi.stubGlobal("document",{documentElement:{dataset:{}}});
  vi.stubGlobal("ResizeObserver",class{observe=vi.fn();disconnect=vi.fn();});
  vi.stubGlobal("MutationObserver",class{observe=vi.fn();disconnect=vi.fn();});
});
afterEach(()=>vi.unstubAllGlobals());
async function settle(){await vi.dynamicImportSettled();await Promise.resolve();}
describe("top-down-first renderer loading",()=>{
  it("default mount has no canvas and never requests a Three renderer",async()=>{
    const importsBefore=harness.imports,tree=render();
    expect(elements(tree,"canvas")).toHaveLength(0);for(const effect of harness.effects)effect();await settle();
    expect(harness.imports).toBe(importsBefore);expect(harness.create).not.toHaveBeenCalled();
    expect(elements(tree,"button").find(b=>b.props.children===courtCopy.en.top)?.props["aria-pressed"]).toBe(true);
  });
  it.each([{width:320,height:313},{width:343,height:430}])("maps actual touch positions through the SVG origin and letterboxing (%s)",rect=>{
    const shot:CourtShot={eventId:22,personId:2,playerName:"Test only",teamId:11,teamTricode:"TST",period:1,clock:"PT01M00.00S",result:"Made",value:3,xFeet:22.4,yFeet:2.2};
    const decoy={...shot,eventId:23,yFeet:shot.yFeet+.9};
    const selected=vi.fn(),tree=render([shot,decoy],selected),svg=elements(tree,"svg")[0];
    const scale=Math.min(rect.width/540,rect.height/528);
    const clientX=20+(rect.width-540*scale)/2+(shot.xFeet+27)*10*scale;
    const clientY=35+(rect.height-528*scale)/2+((shot.yFeet+7.25)*10+9)*scale;
    const event={button:0,pointerId:1,pointerType:"touch",clientX,clientY,currentTarget:{getBoundingClientRect:()=>({...rect,left:20,top:35})}};
    (svg.props.onPointerDown as (e:unknown)=>void)(event);(svg.props.onPointerUp as (e:unknown)=>void)(event);
    expect(selected).toHaveBeenCalledExactlyOnceWith(22);
  });
  it("clears a flat-view pointer press when it leaves before releasing",()=>{
    const tree=render(),svg=elements(tree,"svg")[0];
    (svg.props.onPointerDown as (e:unknown)=>void)({button:0,pointerId:1,pointerType:"mouse",clientX:40,clientY:40});
    expect(harness.refs[3].current).not.toBeNull();
    (svg.props.onPointerLeave as (e:unknown)=>void)({pointerId:1,currentTarget:{hasPointerCapture:()=>false}});
    expect(harness.refs[3].current).toBeNull();
  });
  it("loads only after the optional 3D action and disposes when leaving it",async()=>{
    let tree=render();elements(tree,"button").find(b=>b.props.children===courtCopy.en.three)!.props.onClick!();
    tree=render();const canvases=elements(tree,"canvas");expect(canvases).toHaveLength(1);canvases[0].props.ref!.current=canvas;
    harness.effects[0]();const cleanup=harness.effects[1]();await settle();
    expect(harness.create).toHaveBeenCalledTimes(1);expect(instance.setShots).toHaveBeenCalledWith([]);expect(instance.resize).toHaveBeenCalledTimes(1);
    tree=render();const readyAttempt=harness.states[3];elements(tree,"button").find(b=>b.props.children===courtCopy.en.three)!.props.onClick!();expect(harness.states[3]).toBe(readyAttempt);expect(harness.create).toHaveBeenCalledTimes(1);
    elements(tree,"button").find(b=>b.props.children===courtCopy.en.top)!.props.onClick!();if(typeof cleanup==="function")cleanup();tree=render();
    expect(elements(tree,"canvas")).toHaveLength(0);expect(instance.dispose).toHaveBeenCalledTimes(1);expect(listeners.size).toBe(0);
  });
  it("failed optional setup returns to a useful flat view and frees the instance",async()=>{
    let tree=render();elements(tree,"button").find(b=>b.props.children===courtCopy.en.three)!.props.onClick!();tree=render();elements(tree,"canvas")[0].props.ref!.current=canvas;
    vi.stubGlobal("ResizeObserver",class{constructor(){throw new Error("observer setup failed");}});
    harness.effects[1]();await settle();tree=render();
    expect(elements(tree,"div").some(n=>n.props["data-court-state"]==="fallback")).toBe(true);expect(instance.dispose).toHaveBeenCalledTimes(1);
    expect(elements(tree,"svg")).toHaveLength(1);expect(listeners.size).toBe(0);
  });
});
