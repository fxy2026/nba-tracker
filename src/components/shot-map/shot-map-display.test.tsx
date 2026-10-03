import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
vi.mock('server-only',()=>({}));
import { loadHistoricalShotMap } from '@/lib/historical-shot-spatial';
import { loadHistoricalCourtArchive } from '@/lib/historical-shot-archive';
import type { SeasonShotMapDTO } from '@/lib/season-shot-map';
import type { SeasonHeatmapRendererDTO } from '@/lib/season-heatmap';
import RefinedShotExplorer from './RefinedShotExplorer';
import ShotMapCourt, { ShotMapLegend } from './ShotMapCourt';
import { axialCenter, binColor, binDelta, displayPct, fgRate, hexPoints, hexRadius, projectShot, SHOT_MAP_PALETTE, SHOT_MAP_ZONE_PALETTE } from './shot-map-display';
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
 it.each(['en','zh'] as const)('starts every view with no empty panel or location chooser (%s)',locale=>{
  for(const view of ['hex','density','zones'] as const){
   const html=explorer({locale,initialView:view});
   expect(html).not.toContain('<aside');
   for(const removed of ['Start with a spot','EXPLORE THE COURT','cell selector','controls below','Choose a shot location','Previous location','Next location','从一处投篮开始','探索球场','选择器','选择投篮位置','上一个位置','下一个位置'])expect(html).not.toContain(removed);
   expect(html).toContain(locale==='en'?'Escape closes':'Escape 关闭');
  }
 });
 it('restores zone colors without altering Hex colors, unknown-reference behavior, or exact ±3 pp boundaries',()=>{
  expect(SHOT_MAP_PALETTE).toEqual({below:'#6c93a2',near:'#c6c3b9',above:'#c3836e',neutral:'#d7d8d4'});
  expect(SHOT_MAP_ZONE_PALETTE).toEqual({below:'#55adce',near:'#e6ca46',above:'#e98232',neutral:'#d7d8d4'});
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
 it('keeps low-sample, zero and missing-reference zones gray with all source geometry and counts intact',()=>{
  const before=JSON.stringify(zones),modified=structuredClone(zones);
  modified.zones[0]={...modified.zones[0],fgm:24,fga:24};
  modified.zones[1]={...modified.zones[1],fgm:0,fga:0};
  modified.zones[2]={...modified.zones[2],fgm:50,fga:100,leagueAverage:null};
  const html=renderToStaticMarkup(<ShotMapCourt data={data} zones={modified} view="zones" locale="en" selected={null} onSelect={()=>{}}/>);
  for(const row of modified.zones.slice(0,3))expect(html.match(new RegExp(`<path[^>]*data-zone-id="${row.id}"[^>]*>`))?.[0]).toContain('fill="var(--map-zone-neutral, #d7d8d4)"');
  expect(JSON.stringify(zones)).toBe(before);
 });

 it('defaults to hex with true totals, compact legend and honest source scope',()=>{const html=explorer();expect(html).toContain('data-shot-map-view="hex"');for(const text of ['799','374','46.8%','39.3%','Area = attempts','fewer than 5 player or 20 league attempts','individual shots and league coverage are not fully verified','including this player']){expect(html).toContain(text);}expect(html).not.toContain('OFFICIAL AGGREGATES');});
 it('hides wrong-identity coordinate data and reports an error',()=>{const html=explorer({spatial:{status:'ready',data:{...data,playerId:99999}},aggregate:{status:'unavailable'}});expect(html).toContain('Unable to load this dataset');expect(html).not.toContain('data-bin-id=');expect(html).not.toContain('46.8%');});
 it('separates loading, unavailable, and error without turning any into zeros',()=>{for(const status of ['loading','unavailable','error'] as const){const html=explorer({spatial:{status},aggregate:{status:'unavailable'}});expect(html).not.toContain('data-bin-id=');expect(html).not.toContain('0 / 0 FG');expect(html).toContain(status==='loading'?'Loading the shot archive':status==='error'?'Unable to load this dataset':'This view is not available');}});
 it('zone view uses source categories with the restored orange/yellow/blue palette and an accessible statistics list',()=>{const html=explorer({initialView:'zones'});expect(html).toContain('data-shot-map-view="zones"');expect((html.match(/data-zone-id=/g)??[]).length).toBe(12);expect(html).toContain('fill-opacity=".82"');expect(html).toContain('Yellow = within ±3 pp');for(const color of ['#e98232','#e6ca46','#55adce'])expect(html).toContain(color);expect(html).toContain('All zone statistics');expect(html).not.toContain('data-bin-id=');});
 it('keeps all geometry residuals and discrepancies separate from source BASIC zones',async()=>{
 const result=await loadHistoricalShotMap({playerId:201939,season:'2015-16',seasonType:'Regular Season'});if(result.status!=='ready')throw new Error('Missing2015');
 const html=explorer({selection:result.data,spatial:result,aggregate:{status:'unavailable'},datasets:[{...result.data,availability:'available'}]});
 expect(html).toContain('Located');expect(html).toContain('1,585');expect(html).toContain('1,596');expect(html).toContain('Backcourt');expect(html).toContain('2/11');expect(html).toContain('Archive totals differ');
 });
 it('supplies light default, explicit dark, reduced motion, readable type and 44px alternative hit targets',()=>{
 const css=readFileSync(new URL('./shot-map.module.css',import.meta.url),'utf8');expect(css).toContain("html[data-theme='dark']");expect(css).toContain('color-scheme:light');expect(css).not.toContain('html:not');expect(css).toContain('prefers-reduced-motion');expect(css).toContain('min-height:44px');
 const html=explorer();expect(html).not.toContain('Choose a shot location');expect(html).not.toContain('Previous location');expect(html).not.toContain('Next location');expect(html).toContain('aria-live="polite"');expect(css).toContain('max-width:720px');expect(css).toContain('.closeDetail');
 });
});
