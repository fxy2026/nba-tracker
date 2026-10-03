import { Children, isValidElement, type ReactNode } from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { CareerSeason } from '@/app/lab/career-arc/types';
import type { TeamTrajectory } from './team-trajectory';
const runtime = vi.hoisted(() => ({ cursor:0, slots:[] as unknown[], effects:[] as (()=>void|(()=>void))[] }));
vi.mock('react',async original=>({...await original<typeof import('react')>(),
 memo:(fn:unknown)=>fn,
 useState:(initial:unknown)=>{const i=runtime.cursor++;return[i in runtime.slots?runtime.slots[i]:initial,(value:unknown)=>{runtime.slots[i]=value;}];},
 useMemo:(fn:()=>unknown)=>fn(),
 useEffect:(fn:()=>void)=>{runtime.effects.push(fn);},
}));
vi.mock('@/components/LocaleProvider',()=>({useLocale:()=>({locale:'en'})}));
import CareerTrendChart from '@/app/lab/career-arc/CareerTrendChart';
import TrajectoryChart from '@/app/lab/team-trajectory/TrajectoryChart';
import TakeoverChart from '@/app/lab/game-impact/TakeoverChart';
import { useChartWidth } from './use-chart-width';
type Node={type:unknown;props:Record<string,unknown>};
function nodes(node:ReactNode):Node[]{const out:Node[]=[];Children.forEach(node,c=>{if(isValidElement<Record<string,unknown>>(c)){out.push(c);out.push(...nodes(c.props.children as ReactNode));}});return out;}
function render(fn:()=>ReactNode){runtime.cursor=0;runtime.effects=[];return nodes(fn());}
const seasons=Array.from({length:23},(_,i)=>({SEASON_ID:`${2003+i}-${String(4+i).padStart(2,'0')}`,TEAM_ABBREVIATION:'LAL',PTS:i+1,REB:i/2,AST:3,FG_PCT:.5,MIN:30} as CareerSeason));
const career=(selectedIndex=21)=>CareerTrendChart({seasons,metric:'PTS',onMetricChange:vi.fn(),selectedIndex,onSelectIndex:vi.fn(),isZh:false});
const teams=[{tricode:'BOS',conference:'East',city:'Boston',name:'Celtics',primaryColor:'#008800',points:[{game:1,wins:1,losses:0,winPct:1,pointDiff:5},{game:82,wins:60,losses:22,winPct:60/82,pointDiff:300}]}] as TeamTrajectory[];
const trajectory=()=>TrajectoryChart({trajectories:teams,maxGames:82});
const takeover=()=>TakeoverChart({series:[{personId:1,name:'Player',teamTricode:'BOS',color:'#008800',total:30,points:[0,10,20,30]}],steps:4,quarterStarts:[{index:1,label:'Q2'},{index:2,label:'Q3'},{index:3,label:'Q4'}]});
beforeEach(()=>{runtime.cursor=0;runtime.slots=[];runtime.effects=[];});
afterEach(()=>vi.unstubAllGlobals());
it('observes conditional SVG attachment, ignores zero sizes, and disconnects on cleanup',()=>{
 const observe=vi.fn(),disconnect=vi.fn();let resize!:(e:{contentRect:{width:number}}[])=>void;
 vi.stubGlobal('ResizeObserver',class{constructor(fn:typeof resize){resize=fn;}observe=observe;disconnect=disconnect;});
 const RenderHook=()=>{runtime.cursor=0;runtime.effects=[];return useChartWidth(600);};
 let chart=RenderHook();expect(runtime.effects[0]()).toBeUndefined();
 const svg={} as SVGSVGElement;chart.ref(svg);chart=RenderHook();const cleanup=runtime.effects[0]() as ()=>void;expect(observe).toHaveBeenCalledWith(svg);
 resize([{contentRect:{width:261}}]);expect(RenderHook().width).toBe(261);resize([{contentRect:{width:0}}]);expect(RenderHook().width).toBe(261);
 cleanup();expect(disconnect).toHaveBeenCalledOnce();chart.ref(null);RenderHook();expect(runtime.effects[0]()).toBeUndefined();
});
it.each([261,328,440])('career preserves every point, readable labels and noncolliding selected-season labels at %ipx',width=>{
 runtime.slots=[null,width];const mobile=render(()=>career());
 expect(mobile.find(n=>n.type==='svg')?.props.viewBox).toBe(`0 0 ${width} 240`);
 expect(mobile.filter(n=>n.type==='text').every(n=>[11,12].includes(Number(n.props.fontSize)))).toBe(true);
 const labels=mobile.filter(n=>n.type==='text'&&n.props.y===232);expect(labels.some(n=>n.props.children===seasons[21].SEASON_ID)).toBe(true);
 for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++)expect(Math.abs(Number(labels[i].props.x)-Number(labels[j].props.x))).toBeGreaterThanOrEqual(52);
 expect(mobile.filter(n=>n.type==='rect')).toHaveLength(23);
 expect(mobile.filter(n=>n.type==='button').every(n=>String(n.props.className).includes('min-h-11'))).toBe(true);
 runtime.slots=[null,900];const desktop=render(()=>career());expect(desktop.find(n=>n.type==='svg')?.props.viewBox).toBe('0 0 600 200');
 const dots=(list:Node[])=>list.filter(n=>n.type==='circle'&&n.props.onClick);
 expect(dots(mobile)).toHaveLength(23);
 dots(mobile).forEach((p,i)=>{const d=dots(desktop)[i];expect((Number(p.props.cx)-42)/(width-42-24)).toBeCloseTo((Number(d.props.cx)-38)/(600-38-14));expect((Number(p.props.cy)-16)/(240-16-32)).toBeCloseTo((Number(d.props.cy)-16)/(200-16-28));});
});
it('trajectory preserves paths and domain endpoints, avoids80/82collision and clears hover on resize',()=>{
 runtime.slots=['winPct','all','BOS',null,null,261];let mobile=render(trajectory);
 expect(mobile.find(n=>n.type==='svg')?.props.viewBox).toBe('0 0 261 300');
 expect(mobile.filter(n=>n.type==='text').map(n=>n.props.children)).toContain('100%');
 const xt=mobile.filter(n=>n.type==='text'&&n.props.y===292);expect(xt.map(n=>n.props.children)).toContain(82);expect(xt.map(n=>n.props.children)).not.toContain(80);expect(xt.length).toBeGreaterThan(2);
 const svg=mobile.find(n=>n.type==='svg')!;(svg.props.onPointerDown as (e:unknown)=>void)({clientX:245,clientY:16+254*(1-60/82),currentTarget:{getBoundingClientRect:()=>({left:0,top:0,width:261,height:300})}});
 mobile=render(trajectory);expect(runtime.slots[3]).toMatchObject({game:82,wins:60,losses:22});
 runtime.slots[5]=900;const desktop=render(trajectory);runtime.effects[1]();expect(runtime.slots[3]).toBeNull();
 expect(desktop.find(n=>n.type==='svg')?.props.viewBox).toBe('0 0 720 320');
 expect(mobile.filter(n=>n.type==='path')).toHaveLength(desktop.filter(n=>n.type==='path').length);
 expect(mobile.filter(n=>n.type==='button').every(n=>String(n.props.className).includes('min-h-11'))).toBe(true);
});
it('takeover retains all scoring steps and tap mapping across mobile and desktop',()=>{
 for(const width of [261,900]){
 runtime.slots=[null,null,width];let tree=render(takeover);const mobile=width<480,w=mobile?width:760,h=mobile?280:360;
 const svg=tree.find(n=>n.type==='svg')!;expect(svg.props.viewBox).toBe(`0 0 ${w} ${h}`);
 expect(tree.filter(n=>n.type==='path')[0].props.d).toEqual(expect.stringMatching(/^M.* L.* L.* L/));
 if(mobile)expect(tree.filter(n=>n.type==='text').every(n=>n.props.fontSize===12)).toBe(true);
 (svg.props.onPointerDown as(e:unknown)=>void)({clientX:34+(w-50)*2/3,currentTarget:{getBoundingClientRect:()=>({left:0,width:w})}});expect(runtime.slots[0]).toBe(2);
 tree=render(takeover);expect(tree.filter(n=>n.type==='circle')).toHaveLength(2);
 }
});
it('localized late period labels fit inside the SVG without hiding boundaries',()=>{
 runtime.slots=[null,null,261];const quarterStarts=[{index:1,label:'第2节'},{index:2,label:'第3节'},{index:3,label:'加时1'},{index:4,label:'加时2'}];
 const tree=render(()=>TakeoverChart({series:[{personId:1,name:'Player',teamTricode:'BOS',color:'#080',total:4,points:[0,1,2,3,4]}],steps:5,quarterStarts}));
 const labels=tree.filter(n=>n.type==='text'&&n.props.y===272);
 labels.forEach(n=>{expect(Number(n.props.x)-18).toBeGreaterThanOrEqual(0);expect(Number(n.props.x)+18).toBeLessThanOrEqual(261);});
 for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++)expect(Math.abs(Number(labels[i].props.x)-Number(labels[j].props.x))).toBeGreaterThanOrEqual(44);
 expect(tree.filter(n=>n.type==='line'&&n.props.strokeDasharray==='3,3')).toHaveLength(4);
});
