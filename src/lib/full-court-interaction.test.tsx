import Select from "@/components/ui/Select";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode, type ReactElement } from "react";
import ShotChartExplorer from "@/components/ShotChartExplorer";
import ComparisonCourtView from "@/components/shot-chart/ComparisonCourtView";
import { courtCopy } from "@/components/shot-chart/court-copy";
import { comparisonToSvg, projectComparisonShot } from "@/components/shot-chart/comparison-geometry";
import { getVerifiedShotChart } from "./verified-shot-chart-archive";
import type { CourtShot } from "./court-shots";
import schedule from "@/data/schedule-2025-26.json";
const harness=vi.hoisted(()=>({states:[] as unknown[],refs:[] as {current:unknown}[],index:0,refIndex:0,locale:"en" as "en"|"zh",imports:0,create:vi.fn()}));
// Standalone handler harness; real shared-context coverage is separate.
vi.mock("@/components/GamePeriodProvider", () => ({ useLinkedGamePeriod: () => null }));
vi.mock("react",async original=>({...await original<typeof import("react")>(),
  useState:(initial:unknown)=>{const i=harness.index++;if(!(i in harness.states))harness.states[i]=initial;return [harness.states[i],(next:unknown)=>{harness.states[i]=typeof next==="function"?next(harness.states[i]):next;}];},
  useMemo:(fn:()=>unknown)=>fn(),useRef:(initial:unknown)=>{const i=harness.refIndex++;return harness.refs[i]??(harness.refs[i]={current:initial});},
}));
vi.mock("@/components/LocaleProvider",()=>({useLocale:()=>({locale:harness.locale})}));
vi.mock("@/components/shot-chart/court-renderer",()=>{harness.imports++;return {createCourtRenderer:harness.create};});
interface Props {children?:ReactNode;onClick?:()=>void;onValueChange?:(value:string)=>void;onChange?:(event:{target:{value:string}})=>void;[key:string]:unknown}
function elements(node:ReactNode,type:unknown):ReactElement<Props>[] {if(Array.isArray(node))return node.flatMap(child=>elements(child,type));if(!isValidElement<Props>(node))return [];return [...(node.type===type?[node]:[]),...elements(node.props.children,type)];}
function text(node:ReactNode):string {if(typeof node==="string"||typeof node==="number")return String(node);if(Array.isArray(node))return node.map(text).join("");return isValidElement<Props>(node)?text(node.props.children):"";}
const game=schedule.dates.flatMap(date=>date.games).find(game=>game.gameId==="0042500173")!;
const data=getVerifiedShotChart(game)!;
function render(){harness.index=0;harness.refIndex=0;return ShotChartExplorer({data});}
function click(tree:ReactNode,label:string){elements(tree,"button").find(button=>text(button)===label)!.props.onClick!();}
function change(tree:ReactNode,label:string,value:string){elements(tree,Select).find(select=>select.props["aria-label"]===label)!.props.onValueChange!(value);}
function court(tree:ReactNode){return elements(tree,ComparisonCourtView)[0].props;}
beforeEach(()=>{harness.states=[];harness.refs=[];harness.index=0;harness.refIndex=0;harness.locale="en";harness.create.mockClear();});
afterEach(()=>vi.unstubAllGlobals());

describe("dual-team selection and focus controls",()=>{
  it.each(["en","zh"] as const)("keeps independent players, period and result through all focus switches (%s)",locale=>{
    harness.locale=locale;const copy=courtCopy[locale];
    const away=data.shots.find(s=>s.teamId===data.away.teamId)!,home=data.shots.find(s=>s.teamId===data.home.teamId)!;
    let tree=render();change(tree,`${data.away.teamTricode} ${copy.player}`,String(away.personId));tree=render();change(tree,`${data.home.teamTricode} ${copy.player}`,String(home.personId));tree=render();
    change(tree,copy.period,"1");tree=render();change(tree,copy.outcome,"Missed");tree=render();
    const full=court(tree).shots as CourtShot[];
    for(const [side,team] of [["away",data.away],["home",data.home]] as const){
      click(tree,`${team.teamTricode} ${copy.halfCourt}`);tree=render();expect(court(tree).focus).toBe(side);
      expect((court(tree).shots as CourtShot[]).every(shot=>shot.teamId===team.teamId&&shot.period===1&&shot.result==="Missed")).toBe(true);
      expect(elements(tree,Select).find(select=>select.props["aria-label"]===`${data.away.teamTricode} ${copy.player}`)!.props.value).toBe(String(away.personId));
      expect(elements(tree,Select).find(select=>select.props["aria-label"]===`${data.home.teamTricode} ${copy.player}`)!.props.value).toBe(String(home.personId));
    }
    click(tree,copy.backFull);tree=render();expect(court(tree).focus).toBe("full");expect(court(tree).shots).toEqual(full);
    const focusButtons=elements(tree,"button").filter(button=>[copy.fullCourt,`${data.away.teamTricode} ${copy.halfCourt}`,`${data.home.teamTricode} ${copy.halfCourt}`].includes(text(button)));
    expect(focusButtons.map(button=>button.props["aria-pressed"])).toEqual([true,false,false]);
    click(tree,copy.clear);tree=render();expect(court(tree).shots).toHaveLength(177);
  });
  it("keeps FG independent of outcome filtering, shows the actual dot count, and handles zero shots",()=>{
    let tree=render();const summaries=elements(tree,"div").filter(node=>String(node.props["aria-label"]).endsWith("Filtered shooting")).map(node=>text(node));
    change(tree,"Result","Made");tree=render();expect(elements(tree,"div").filter(node=>String(node.props["aria-label"]).endsWith("Filtered shooting")).map(node=>text(node))).toEqual(summaries);
    expect(text(tree)).toContain(`Shown: ${(court(tree).shots as CourtShot[]).length} shots`);
    change(tree,"Period","99");tree=render();expect(court(tree).shots).toHaveLength(0);expect(text(tree)).not.toContain("NaN");expect(text(tree)).toContain("—No attempts0 / 0");
  });
  it("selected detail, same-location navigation and keyboard-accessible list stay truthful",()=>{
    let tree=render();const overlapping=data.shots.find(shot=>data.shots.filter(other=>other.teamId===shot.teamId&&other.xFeet===shot.xFeet&&other.yFeet===shot.yFeet).length>1)!;
    (court(tree).onSelect as (id:number)=>void)(overlapping.eventId);tree=render();expect(text(tree)).toContain(overlapping.playerName);expect(text(tree)).toContain("Shots at this spot");
    click(tree,`Browse every shot (177)`);tree=render();expect(elements(tree,"li")).toHaveLength(177);
    const same=elements(tree,"button").find(button=>text(button).includes("Next at this spot"))!;same.props.onClick!();tree=render();expect(court(tree).selectedId).not.toBe(overlapping.eventId);
    change(tree,"Period","5");tree=render();expect(court(tree).selectedId).toBeNull();expect(elements(tree,"li")).toHaveLength(15);expect(text(tree)).toContain("OT1");
  });
});

describe("flat-only pointer and keyboard court",()=>{
  const shot:CourtShot={eventId:22,personId:2,playerName:"Coordinate fixture",teamId:data.away.teamId,teamTricode:data.away.teamTricode,period:1,clock:"PT01M00.00S",result:"Made",value:3,xFeet:22.4,yFeet:-1.2};
  const renderView=(shots:CourtShot[],focus:"full"|"away"="full",onSelect=vi.fn())=>{harness.index=0;harness.refIndex=0;return ComparisonCourtView({shots,focus,onSelect,selectedId:null,away:data.away,home:data.home,awayColor:"#552583",homeColor:"#CE1141",copy:courtCopy[harness.locale]});};
  it.each([{width:320,height:180,focus:"full"},{width:343,height:430,focus:"full"},{width:343,height:430,focus:"away"}] as const)("uses the exact SVG viewbox and letterboxing for narrow touch targets (%s)",({width,height,focus})=>{
    const onSelect=vi.fn(),tree=renderView([shot,{...shot,eventId:23,yFeet:shot.yFeet+1}],focus,onSelect),svg=elements(tree,"svg")[0];
    const [vx,vy,vw,vh]=String(svg.props.viewBox).split(" ").map(Number),scale=Math.min(width/vw,height/vh);
    const [x,y]=projectComparisonShot(shot,data.away.teamId,focus);
    if(focus==="full")expect([x,y]).toEqual(comparisonToSvg(shot.xFeet,shot.yFeet,"away"));
    const event={button:0,pointerId:1,pointerType:"touch",clientX:20+(width-vw*scale)/2+(x-vx)*scale,clientY:35+(height-vh*scale)/2+(y-vy)*scale,currentTarget:{getBoundingClientRect:()=>({width,height,left:20,top:35})}};
    (svg.props.onPointerDown as (e:unknown)=>void)(event);(svg.props.onPointerUp as (e:unknown)=>void)(event);expect(onSelect).toHaveBeenCalledExactlyOnceWith(22);
  });
  it("never loads an engine and routes arrows/Escape through the actual SVG key handler",async()=>{
    const before=harness.imports,onSelect=vi.fn(),getContext=vi.fn();vi.stubGlobal("HTMLCanvasElement",{prototype:{getContext}});
    const tree=renderView([shot],"full",onSelect),svg=elements(tree,"svg")[0];
    expect(elements(tree,"canvas")).toHaveLength(0);expect(svg.props.tabIndex).toBe(0);expect(svg.props["aria-label"]).toContain("arrow keys");
    for(const key of ["ArrowRight","Escape"]){const preventDefault=vi.fn();(svg.props.onKeyDown as (e:unknown)=>void)({key,preventDefault});expect(preventDefault).toHaveBeenCalledOnce();}
    expect(onSelect.mock.calls).toEqual([[22],[null]]);await vi.dynamicImportSettled();expect(harness.imports).toBe(before);expect(harness.create).not.toHaveBeenCalled();expect(getContext).not.toHaveBeenCalled();
  });
  it.each(["en","zh"] as const)("localizes hover period and source shot value (%s)",locale=>{
    harness.locale=locale;let tree=renderView([shot]);const svg=elements(tree,"svg")[0],[x,y]=comparisonToSvg(shot.xFeet,shot.yFeet,"away");
    (svg.props.onPointerMove as (e:unknown)=>void)({pointerType:"mouse",clientX:x,clientY:y,currentTarget:{getBoundingClientRect:()=>({width:1000,height:560,left:0,top:0})}});
    tree=renderView([shot]);const tooltip=elements(tree,"div").find(div=>div.props.role==="tooltip")!;
    expect(text(tooltip)).toContain(locale==="zh"?"第 1 节":"Q1");expect(text(tooltip)).toContain(locale==="zh"?"3 分":"3 PT");expect(text(tooltip)).toContain("1:00");
  });
  it("does not select after a vertical scroll, pointer cancellation or pointer leaving",()=>{
    const onSelect=vi.fn(),tree=renderView([shot],"full",onSelect),svg=elements(tree,"svg")[0];
    const event={button:0,pointerId:1,pointerType:"touch",clientX:25,clientY:25};
    (svg.props.onPointerDown as (e:unknown)=>void)(event);(svg.props.onPointerUp as (e:unknown)=>void)({...event,clientY:80});
    (svg.props.onPointerDown as (e:unknown)=>void)(event);(svg.props.onPointerCancel as ()=>void)();(svg.props.onPointerUp as (e:unknown)=>void)(event);
    (svg.props.onPointerDown as (e:unknown)=>void)(event);(svg.props.onPointerLeave as ()=>void)();(svg.props.onPointerUp as (e:unknown)=>void)(event);expect(onSelect).not.toHaveBeenCalled();
  });
});
