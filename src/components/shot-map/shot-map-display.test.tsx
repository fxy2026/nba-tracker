import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
vi.mock('server-only',()=>({}));
import { loadHistoricalShotMap } from '@/lib/historical-shot-spatial';
import { loadHistoricalCourtArchive } from '@/lib/historical-shot-archive';
import type { SeasonShotMapDTO } from '@/lib/season-shot-map';
import type { SeasonHeatmapDisplayRow, SeasonHeatmapRendererDTO } from '@/lib/season-heatmap';
import { courtBasicGeometry, courtBasicStatisticalDividers } from '@/lib/season-heatmap-court-geometry';
import RefinedShotExplorer from './RefinedShotExplorer';
import ShotMapCourt, { ShotMapLegend } from './ShotMapCourt';
import CareerArchiveCourt from '@/app/lab/career-arc/CareerArchiveCourt';
import { axialCenter, binColor, binDelta, displayPct, fgRate, hexPoints, hexRadius, projectShot, zoneColor, zoneBand, zoneReference, SHOT_MAP_PALETTE, SHOT_MAP_ZONE_PALETTE } from './shot-map-display';
let data:SeasonShotMapDTO,zones:SeasonHeatmapRendererDTO;
beforeAll(async()=>{
 const spatial=await loadHistoricalShotMap({playerId:201939,season:'2025-26',seasonType:'Regular Season'});
 const aggregate=await loadHistoricalCourtArchive({playerId:201939,season:'2025-26',seasonType:'Regular Season'});
 if(spatial.status!=='ready'||aggregate.status!=='ready')throw new Error('Real source fixture unavailable');data=spatial.data;zones=aggregate.data;
});
const count=(fgm:number,fga:number)=>({fgm,fga,fg3m:0,fg3a:0});
function explorer(overrides:Partial<Parameters<typeof RefinedShotExplorer>[0]>={}) {return renderToStaticMarkup(<RefinedShotExplorer player={{id:201939,name:'Stephen Curry'}} locale="en" datasets={[{...data,availability:'available'}]} selection={data} spatial={{status:'ready',data}} aggregate={{status:'ready',data:zones}} onChoose={()=>{}} onRetry={()=>{}} {...overrides}/>);}
describe('exact spatial encoding',()=>{
 it('uses unwarped regulation frame and source axial centers',()=>{expect(projectShot(0,0)).toEqual([0,417.5]);expect(projectShot(-250,-52.5)).toEqual([-250,470]);expect(projectShot(250,417.5)).toEqual([250,0]);expect(axialCenter(1,0,25)).toEqual([25*Math.sqrt(3),0]);});
 it('scales area linearly with attempts, never inventing volume or infinity',()=>{expect(hexRadius(4,100,25)**2/hexRadius(1,100,25)**2).toBeCloseTo(4);expect(hexRadius(0,0,25)).toBe(0);expect(hexPoints(0,0,5).split(' ')).toHaveLength(6);});
 it('uses actual local FG difference, with explicitly neutral low samples and unknown reference',()=>{
 expect(binDelta(count(3,5),count(10,20))).toBeCloseTo(.1);expect(binColor(count(3,5),count(10,20))).toBe(SHOT_MAP_PALETTE.above);
 expect(binColor(count(1,5),count(10,20))).toBe(SHOT_MAP_PALETTE.below);expect(binColor(count(5,10),count(10,20))).toBe(SHOT_MAP_PALETTE.near);
 expect(binColor(count(53,100),count(50,100))).toBe(SHOT_MAP_PALETTE.near);expect(binColor(count(47,100),count(50,100))).toBe(SHOT_MAP_PALETTE.near);
 expect(binColor(count(4,4),count(10,20))).toBe(SHOT_MAP_PALETTE.neutral);expect(binColor(count(9,10),count(18,19))).toBe(SHOT_MAP_PALETTE.neutral);expect(binColor(count(9,10),null)).toBe(SHOT_MAP_PALETTE.neutral);
 expect(displayPct(fgRate(count(0,0)))).toBe('—');
 });
 it('renders exactly actual occupied bins without per-cell numeric labels',()=>{
 const svg=renderToStaticMarkup(<ShotMapCourt data={data} zones={zones} view="hex" locale="en" selected={null} onSelect={()=>{}} detailsId="details"/>);
 expect((svg.match(/data-bin-id=/g)??[]).length).toBe(data.resolutions[0].bins.length);expect(svg).not.toMatch(/<text|textLength|lengthAdjust/);expect(svg).toContain('regulation-50-by-47-feet');expect(svg).toContain('tabindex="0"');expect(svg).toContain('aria-controls="details"');
 });
 it('retains occupied edge-cell centers and gives clipped cells an outline',()=>{
 const test={...data,resolutions:[{id:'fine' as const,radius:25 as const,bins:[[-6,0],[6,0],[1,-2],[-5,11]].map(([q,r])=>({q,r,...count(0,1),league:count(10,20)}))}]};
 const svg=renderToStaticMarkup(<ShotMapCourt data={test} zones={null} view="hex" locale="en" selected={null} onSelect={()=>{}} detailsId="details"/>);
 expect((svg.match(/data-bin-id=/g)??[]).length).toBe(4);expect((svg.match(/data-edge-cell="true"/g)??[]).length).toBe(3);expect(svg).toContain(String(-150*Math.sqrt(3)));expect(svg).toContain('492.5');
 });
 it('frequency rendering depends only on attempts, never makes or the league baseline',()=>{
 const changed=structuredClone(data);for(const res of changed.resolutions)for(const bin of res.bins){bin.fgm=0;bin.fg3m=0;bin.league.fgm=0;}
 const render=(input:SeasonShotMapDTO)=>renderToStaticMarkup(<ShotMapCourt data={input} zones={null} view="density" locale="en" selected={null} onSelect={()=>{}} detailsId="details"/>);
 expect(render(data)).toBe(render(changed));expect(render(data)).toContain('not shooting percentage');expect(render(data)).toContain('18-source-units-1.8-feet');
 });
});
describe('refined product states and provenance',()=>{
 it.each(['en','zh'] as const)('names aggregate-only zones accurately without spatial data (%s)',locale=>{
  const title=`${locale==='en'?'Source-zone aggregate distribution':'来源分区汇总分布'} · ${zones.season}`;
  const description=locale==='en'?'Illustrative source court categories.':'来源球场分区示意。';
  const renders=[
   renderToStaticMarkup(<ShotMapCourt data={null} zones={zones} view="zones" locale={locale} selected={null} onSelect={()=>{}}/>),
   explorer({locale,initialView:'zones',spatial:{status:'unavailable'}}),
   renderToStaticMarkup(<CareerArchiveCourt data={zones} locale={locale} selectedId={null} onSelect={()=>{}} onDismissDetails={()=>{}} detailsId="career-details"/>),
  ];
  for(const html of renders){
   expect(html).toContain(`>${title}</title>`);
   expect(html).toContain(description);
   expect(html).not.toContain(locale==='en'?'Shot-coordinate distribution':'逐次投篮坐标分布');
   expect(html).not.toContain('data-spatial-geometry');
   expect(html).not.toContain('data-bin-id');
   expect((html.match(/data-zone-id=/g)??[])).toHaveLength(12);
   const svg=html.match(/<svg[^>]*data-shot-map-view="zones"[^>]*>/)?.[0];
   const titleId=svg?.match(/aria-labelledby="([^"]+)"/)?.[1];
   const descriptionId=svg?.match(/aria-describedby="([^"]+)"/)?.[1];
   expect(titleId).toBeTruthy();expect(descriptionId).toBeTruthy();
   expect(html).toContain(`<title id="${titleId}">${title}</title>`);
   expect(html).toContain(`<desc id="${descriptionId}">${description}`);
  }
 });
 it.each(['en','zh'] as const)('retains spatial court names, years and mode-specific descriptions (%s)',locale=>{
  for(const view of ['hex','density'] as const){
   const html=renderToStaticMarkup(<ShotMapCourt data={data} zones={zones} view={view} locale={locale} selected={null} onSelect={()=>{}}/>);
   expect(html).toContain(`>${locale==='en'?'Shot-coordinate distribution':'逐次投篮坐标分布'} · ${data.season}</title>`);
   expect(html).toContain(view==='density'?(locale==='en'?'not shooting percentage':'不代表命中率'):(locale==='en'?'Hex area represents attempts':'六边形面积表示出手次数'));
  }
 });
 it.each(['en','zh'] as const)('starts every view with no empty panel or location chooser (%s)',locale=>{
  for(const view of ['hex','density','zones'] as const){
   const html=explorer({locale,initialView:view});
   expect(html).not.toContain('<aside');
   for(const removed of ['Start with a spot','EXPLORE THE COURT','cell selector','controls below','Choose a shot location','Previous location','Next location','从一处投篮开始','探索球场','选择器','选择投篮位置','上一个位置','下一个位置'])expect(html).not.toContain(removed);
   expect(html).toContain(locale==='en'?'Escape closes':'Escape 关闭');
  }
 });
 it('adds five zone colors without altering Hex colors or its exact ±3 pp boundaries',()=>{
  expect(SHOT_MAP_PALETTE).toEqual({below:'#6c93a2',near:'#c6c3b9',above:'#c3836e',neutral:'#d7d8d4'});
  expect(SHOT_MAP_ZONE_PALETTE).toEqual({farBelow:'#5b879e',below:'#a2c4d0',near:'#e5d28a',above:'#edc6a2',farAbove:'#d58e63',neutral:'#d7d8d4'});
  for(const [made,expected] of [[54,'above'],[53,'near'],[47,'near'],[46,'below']] as const){
   expect(binColor(count(made,100),count(50,100),SHOT_MAP_ZONE_PALETTE)).toBe(SHOT_MAP_ZONE_PALETTE[expected]);
   expect(binColor(count(made,100),count(50,100))).toBe(SHOT_MAP_PALETTE[expected]);
  }
  expect(binColor(count(0,0),count(50,100),SHOT_MAP_ZONE_PALETTE)).toBe(SHOT_MAP_ZONE_PALETTE.neutral);
  expect(binColor(count(90,100),null,SHOT_MAP_ZONE_PALETTE)).toBe(SHOT_MAP_ZONE_PALETTE.neutral);
  expect(binColor(count(90,100),count(15,19),SHOT_MAP_ZONE_PALETTE)).toBe(SHOT_MAP_ZONE_PALETTE.neutral);
  const hex=renderToStaticMarkup(<ShotMapLegend view="hex" locale="en"/>),density=renderToStaticMarkup(<ShotMapLegend view="density" locale="en"/>);
  for(const color of [SHOT_MAP_ZONE_PALETTE.above,SHOT_MAP_ZONE_PALETTE.near,SHOT_MAP_ZONE_PALETTE.below]){expect(hex).not.toContain(color);expect(density).not.toContain(color);}
 });
 it('colors real small-sample zones using exact same-zone counts and preserves geometry and raw data',()=>{
  const before=JSON.stringify(zones);
  const html=renderToStaticMarkup(<ShotMapCourt data={data} zones={zones} view="zones" locale="en" selected={null} onSelect={()=>{}}/>);
  for(const [id,fgm,fga,leagueFgm,leagueFga,band] of [['midrange-center',8,17,2018,4718,'above'],['midrange-left',13,23,2393,5819,'farAbove']] as const){
   const row=zones.zones.find(zone=>zone.id===id)!;
   expect([row.fgm,row.fga]).toEqual([fgm,fga]);
   expect(zoneReference(row)).toEqual({fgm:leagueFgm,fga:leagueFga});
   expect(zoneColor(row)).toBe(SHOT_MAP_ZONE_PALETTE[band]);
   const path=html.match(new RegExp(`<path[^>]*data-zone-id="${id}"[^>]*>`))?.[0];
   expect(path).toContain(`fill="var(--map-zone-${band}, ${SHOT_MAP_ZONE_PALETTE[band]})"`);expect(path).toContain(`data-zone-band="${band}"`);
   expect(path).toContain(`${fgm}/${fga}`);
  }
  for(const geometry of courtBasicGeometry){
   const path=html.match(new RegExp(`<path[^>]*data-zone-id="${geometry.id}"[^>]*>`))?.[0];
   expect(path).toContain(`d="${geometry.pathD}"`);
  }
  expect(html).not.toMatch(/<text|textLength|lengthAdjust/);
  expect(JSON.stringify(zones)).toBe(before);
 });
 it('colors even one-attempt and small league samples without using rounded percentages',()=>{
  const row=(fgm:number,fga:number,leagueFgm:number,leagueFga:number):SeasonHeatmapDisplayRow=>({...zones.zones[0],fgm,fga,leagueAverage:{displayedPct:'99.9',provenance:'weighted-archive-counts-not-official-displayed-LA',leagueFgm,leagueFga}});
  for(const [made,attempts,leagueMade,leagueAttempts,color] of [[1,1,1,2,'farAbove'],[0,1,1,2,'farBelow'],[1,2,1,2,'near'],[13,23,9,19,'above'],[53,100,50,100,'near'],[47,100,50,100,'near'],[5301,10000,50,100,'above'],[4699,10000,50,100,'below']] as const){
   expect(zoneColor(row(made,attempts,leagueMade,leagueAttempts))).toBe(SHOT_MAP_ZONE_PALETTE[color]);
  }
  expect(binColor(count(1,1),count(1,2))).toBe(SHOT_MAP_PALETTE.neutral);
  expect(binColor(count(13,23),count(9,19))).toBe(SHOT_MAP_PALETTE.neutral);
 });
 it.each([
  [3999,10000,'farBelow'],[40,100,'below'],[4001,10000,'below'],
  [4699,10000,'below'],[47,100,'near'],[4701,10000,'near'],
  [5299,10000,'near'],[53,100,'near'],[5301,10000,'above'],
  [5999,10000,'above'],[60,100,'above'],[6001,10000,'farAbove'],
 ] as const)('assigns exact ±3 / ±10 pp bin endpoint: %i/%i to %s',(fgm,fga,band)=>{
  const row={...zones.zones[0],fgm,fga,leagueAverage:{displayedPct:'0.0',provenance:'weighted-archive-counts-not-official-displayed-LA' as const,leagueFgm:50,leagueFga:100}};
  expect(zoneBand(row)).toBe(band);expect(zoneColor(row)).toBe(SHOT_MAP_ZONE_PALETTE[band]);
 });
 it('compares very large safe integer counts without cross-product rounding',()=>{
  const size=100_000_000_000_000;
  for(const [numerator,band] of [[40,'below'],[47,'near'],[53,'near'],[60,'above']] as const){
   const row={...zones.zones[0],fgm:numerator*size,fga:100*size,leagueAverage:{displayedPct:'50.0',provenance:'weighted-archive-counts-not-official-displayed-LA' as const,leagueFgm:50,leagueFga:100}};
   // Stay within safe source integer limits while products are far beyond them.
   row.fgm/=2;row.fga/=2;
   expect(zoneBand(row)).toBe(band);
  }
 });
 it.each(['en','zh'] as const)('labels all five presentation bins and units unambiguously (%s)',locale=>{
  const legend=renderToStaticMarkup(<ShotMapLegend view="zones" locale={locale}/>);
  for(const [band,color] of Object.entries(SHOT_MAP_ZONE_PALETTE).filter(([key])=>key!=='neutral')){
   expect(legend).toContain(`data-zone-legend-band="${band}"`);expect(legend).toContain(color);
  }
  expect(legend).toContain(locale==='en'?'vs same-zone league archive · pp':'同分区联盟档案 · 百分点');
  for(const range of ['&lt; −10','−10 ≤ Δ &lt; −3','−3 ≤ Δ ≤ +3','+3 &lt; Δ ≤ +10','&gt; +10'])expect(legend).toContain(range);
  const html=explorer({locale,initialView:'zones'});
  expect(html).toContain(locale==='en'?'Five presentation bins, not official NBA thresholds':'五档颜色仅为展示分档，并非 NBA 官方阈值');
 });
 it('draws clean statistical dividers with exact existing endpoints, distinct from regulation markings',()=>{
  const sameColor={...zones,zones:zones.zones.map(row=>({...row,fgm:1,fga:1,leagueAverage:{displayedPct:'50.0',provenance:'weighted-archive-counts-not-official-displayed-LA' as const,leagueFgm:1,leagueFga:2}}))};
  const html=renderToStaticMarkup(<ShotMapCourt data={data} zones={sameColor} view="zones" locale="en" selected={null} onSelect={()=>{}}/>);
  expect((html.match(/data-zone-id=/g)??[]).length).toBe(12);
  expect((html.match(/data-zone-divider=/g)??[]).length).toBe(8);
  for(const path of courtBasicStatisticalDividers)expect(html.split(`d="${path}"`).length-1).toBe(1);
  expect(html).toContain('pointer-events="none" aria-hidden="true" transform=');
  expect(html).not.toContain('data-zone-court-halo="true"');
  expect(html).toContain('vector-effect="non-scaling-stroke"');
  const css=readFileSync(new URL('./shot-map.module.css',import.meta.url),'utf8');
  expect(css).not.toContain('stroke-dasharray:4 3');expect(css).toContain('stroke-width:1.2');expect(css).toContain('stroke-width:2');
  expect(css).toContain('--map-zone-divider:#fffcf6');expect(css).toContain('--map-zone-divider:#273238');
  expect(css).not.toContain('stroke-opacity:.35');
 });
 it('scopes the compact court and side legend to zones and shares theme-aware colors across map and legend',()=>{
  const zoneHtml=explorer({initialView:'zones'});
  expect(zoneHtml).toContain('zoneLayout');expect(zoneHtml).toContain('zoneVisual');
  for(const view of ['hex','density'] as const){const html=explorer({initialView:view});expect(html).not.toContain('zoneLayout');expect(html).not.toContain('zoneVisual');}
  const legend=renderToStaticMarkup(<ShotMapLegend view="zones" locale="en"/>);
  for(const band of ['farBelow','below','near','above','farAbove'] as const)expect(legend).toContain(`var(--map-zone-${band}, ${SHOT_MAP_ZONE_PALETTE[band]})`);
  const css=readFileSync(new URL('./shot-map.module.css',import.meta.url),'utf8');
  expect(css).toContain('minmax(0,540px)');expect(css).toContain('@media(max-width:800px)');
  expect(css).not.toMatch(/\.zone[^{}]*\{[^}]*filter:/);
 });
 it('draws the selected zone outline above markings without changing its metric color or adding a hit target',()=>{
  const id='midrange-center';
  const html=renderToStaticMarkup(<ShotMapCourt data={data} zones={zones} view="zones" locale="en" selected={id} onSelect={()=>{}}/>);
  expect((html.match(/data-zone-id=/g)??[]).length).toBe(12);
  expect((html.match(/data-selected-zone-outline=/g)??[]).length).toBe(1);
  expect(html.indexOf('data-selected-zone-outline')).toBeGreaterThan(html.indexOf('data-court-markings'));
  expect(html).not.toContain('fill-opacity=');
 });
 it('keeps zero, missing and invalid reference zones gray rather than guessing from displayed percentages',()=>{
  const base=zones.zones[0];
  const references:SeasonHeatmapDisplayRow['leagueAverage'][]=[null,{displayedPct:'50.0',provenance:'source-displayed-unverified-scope'},...[[0,0],[1,-1],[-1,20],[21,20],[NaN,20],[1,Infinity],[1.5,20]].map(([leagueFgm,leagueFga])=>({displayedPct:'50.0',provenance:'weighted-archive-counts-not-official-displayed-LA' as const,leagueFgm,leagueFga}))];
  for(const leagueAverage of references){
   const row={...base,fgm:8,fga:17,leagueAverage};
   expect(zoneReference(row)).toBeNull();
   expect(zoneColor(row)).toBe(SHOT_MAP_ZONE_PALETTE.neutral);
   const html=renderToStaticMarkup(<ShotMapCourt data={data} zones={{...zones,zones:[row]}} view="zones" locale="en" selected={null} onSelect={()=>{}}/>);
   expect(html).toContain('fill="var(--map-zone-neutral, #d7d8d4)"');
  }
  for(const [fgm,fga] of [[0,0],[1,-1],[-1,1],[2,1],[NaN,10],[1,Infinity]])expect(zoneColor({...base,fgm,fga})).toBe(SHOT_MAP_ZONE_PALETTE.neutral);
 });
 it('leaves hex and density rendering unchanged when zone sample sizes or references change',()=>{
  const changed={...zones,zones:zones.zones.map(row=>({...row,fgm:0,fga:1,leagueAverage:null}))};
  for(const view of ['hex','density'] as const){
   const render=(input:SeasonHeatmapRendererDTO)=>renderToStaticMarkup(<ShotMapCourt data={data} zones={input} view={view} locale="en" selected={null} onSelect={()=>{}}/>);
   expect(render(changed)).toBe(render(zones));
  }
 });
 it.each(['en','zh'] as const)('explains gray and uncertain small samples accurately in %s',locale=>{
  const html=explorer({locale,initialView:'zones'});
  expect(html).toContain(locale==='en'?'Gray: no attempts or no valid reference. Small-sample colors are uncertain.':'灰色表示无出手或无有效参考；小样本颜色不稳定。');
  expect(html).not.toContain('Gray: fewer than 25');
  expect(html).not.toContain('球员少于 25 次、联盟少于 20 次出手或缺少参考为灰色');
 });

 it('defaults to hex with true totals, compact legend and honest source scope',()=>{const html=explorer();expect(html).toContain('data-shot-map-view="hex"');for(const text of ['799','374','46.8%','39.3%','Area = attempts','fewer than 5 player or 20 league attempts','individual shots and league coverage are not fully verified','including this player']){expect(html).toContain(text);}expect(html).not.toContain('OFFICIAL AGGREGATES');});
 it('hides wrong-identity coordinate data and reports an error',()=>{const html=explorer({spatial:{status:'ready',data:{...data,playerId:99999}},aggregate:{status:'unavailable'}});expect(html).toContain('Unable to load this dataset');expect(html).not.toContain('data-bin-id=');expect(html).not.toContain('46.8%');});
 it('separates loading, unavailable, and error without turning any into zeros',()=>{for(const status of ['loading','unavailable','error'] as const){const html=explorer({spatial:{status},aggregate:{status:'unavailable'}});expect(html).not.toContain('data-bin-id=');expect(html).not.toContain('0 / 0 FG');expect(html).toContain(status==='loading'?'Loading the shot archive':status==='error'?'Unable to load this dataset':'This view is not available');}});
 it('zone view uses source categories with the restored orange/yellow/blue palette and an accessible statistics list',()=>{const html=explorer({initialView:'zones'});expect(html).toContain('data-shot-map-view="zones"');expect((html.match(/data-zone-id=/g)??[]).length).toBe(12);expect(html).not.toContain('fill-opacity=".82"');expect(html).toContain('Five presentation bins, not official NBA thresholds');for(const color of Object.values(SHOT_MAP_ZONE_PALETTE).filter(color=>color!==SHOT_MAP_ZONE_PALETTE.neutral))expect(html).toContain(color);expect(html).toContain('All zone statistics');expect(html).not.toContain('data-bin-id=');});
 it('keeps all geometry residuals and discrepancies separate from source BASIC zones',async()=>{
 const result=await loadHistoricalShotMap({playerId:201939,season:'2015-16',seasonType:'Regular Season'});if(result.status!=='ready')throw new Error('Missing2015');
 const html=explorer({selection:result.data,spatial:result,aggregate:{status:'unavailable'},datasets:[{...result.data,availability:'available'}]});
 expect(html).toContain('Located');expect(html).toContain('1,585');expect(html).toContain('1,596');expect(html).toContain('Backcourt');expect(html).toContain('2/11');expect(html).toContain('Archive totals differ');
 });
 it('supplies light default, explicit dark, reduced motion, readable type and 44px alternative hit targets',()=>{
 const css=readFileSync(new URL('./shot-map.module.css',import.meta.url),'utf8');expect(css).toContain("html[data-theme='dark']");expect(css).toContain('color-scheme:light');expect(css).not.toContain('html:not');expect(css).toContain('prefers-reduced-motion');expect(css).toContain('min-height:44px');
 const html=explorer();expect(html).not.toContain('Choose a shot location');expect(html).not.toContain('Previous location');expect(html).not.toContain('Next location');expect(html).toContain('aria-live="polite"');expect(css).toContain('max-width:720px');expect(css).toContain('.closeDetail');
 });
 it.each(['en','zh'] as const)('provides readable compact mobile statistics without deleting full metric names (%s)',locale=>{
  const html=explorer({locale,initialView:'zones',player:{id:201939,name:'Shai Gilgeous-Alexander / Alexander-Walker'}});
  expect(html).toContain('Shai Gilgeous-Alexander / Alexander-Walker');
  for(const label of locale==='en'?['Archived attempts','Field-goal percentage','Three-point percentage']:['档案出手','投篮命中率','三分命中率'])expect(html).toContain(`title="${label}"`);
  for(const label of locale==='en'?['Attempts','FG%','3P%']:['出手','命中率','三分命中率'])expect(html).toContain(`>${label}</abbr>`);
  expect(html).toContain('799');expect(html).toContain('46.8%');expect(html).toContain('39.3%');
 });
 it('keeps mobile controls, legends and details wrap-safe with readable minimum type and touch sizes',()=>{
  const css=readFileSync(new URL('./shot-map.module.css',import.meta.url),'utf8');
  const mobile=css.slice(css.indexOf('@media(max-width:700px)'));
  expect(mobile).toContain('grid-template-columns:minmax(88px,.9fr) minmax(0,1.4fr)');
  expect(mobile).toContain('min-height:52px');expect(mobile).toContain('min-height:44px');expect(mobile).toContain('min-height:48px');
  expect(mobile).toContain('.detail dl { grid-template-columns:minmax(0,1fr); }');
  expect(mobile).toContain('.modes svg { display:none; }');
  expect(mobile).toContain('font-size:11px; white-space:normal; text-align:center;');
  expect(mobile).not.toContain('font-size:9px');expect(mobile).not.toContain('overflow-x:hidden');
  // Static breakpoint sizing contracts only, not a browser-layout assertion.
  for(const viewport of [320,360,390,430]){
   const content=viewport-2*16-2*12-2;
   const season=(content-8)*.9/2.3;
   const segment=((content-8)*1.4/2.3-8)/2;
   expect(season).toBeGreaterThan(90);expect(segment).toBeGreaterThan(70);
   expect((content-8-6)/3).toBeGreaterThan(80);
   expect((content-20)/5).toBeGreaterThan(48);
  }
 });

});
