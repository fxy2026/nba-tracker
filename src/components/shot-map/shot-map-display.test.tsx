import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
vi.mock('server-only',()=>({}));
import { loadHistoricalShotMap } from '@/lib/historical-shot-spatial';
import { loadHistoricalCourtArchive } from '@/lib/historical-shot-archive';
import type { SeasonShotMapDTO } from '@/lib/season-shot-map';
import type { SeasonHeatmapRendererDTO } from '@/lib/season-heatmap';
import RefinedShotExplorer from './RefinedShotExplorer';
import ShotMapCourt from './ShotMapCourt';
import { axialCenter, binColor, binDelta, displayPct, fgRate, hexPoints, hexRadius, projectShot, SHOT_MAP_PALETTE } from './shot-map-display';
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
 it('defaults to hex with true totals, compact legend and honest source scope',()=>{const html=explorer();expect(html).toContain('data-shot-map-view="hex"');for(const text of ['799','374','46.8%','39.3%','Area = attempts','fewer than 5 player or 20 league attempts','individual shots and league coverage are not fully verified','including this player']){expect(html).toContain(text);}expect(html).not.toContain('OFFICIAL AGGREGATES');});
 it('hides wrong-identity coordinate data and reports an error',()=>{const html=explorer({spatial:{status:'ready',data:{...data,playerId:99999}},aggregate:{status:'unavailable'}});expect(html).toContain('Unable to load this dataset');expect(html).not.toContain('data-bin-id=');expect(html).not.toContain('46.8%');});
 it('separates loading, unavailable, and error without turning any into zeros',()=>{for(const status of ['loading','unavailable','error'] as const){const html=explorer({spatial:{status},aggregate:{status:'unavailable'}});expect(html).not.toContain('data-bin-id=');expect(html).not.toContain('0 / 0 FG');expect(html).toContain(status==='loading'?'Loading the shot archive':status==='error'?'Unable to load this dataset':'This view is not available');}});
 it('zone view uses source categories with restrained fills and an accessible alternative list',()=>{const html=explorer({initialView:'zones'});expect(html).toContain('data-shot-map-view="zones"');expect((html.match(/data-zone-id=/g)??[]).length).toBe(12);expect(html).toContain('fill-opacity=".16"');expect(html).toContain('All zone statistics');expect(html).not.toContain('data-bin-id=');});
 it('keeps all geometry residuals and discrepancies separate from source BASIC zones',async()=>{
 const result=await loadHistoricalShotMap({playerId:201939,season:'2015-16',seasonType:'Regular Season'});if(result.status!=='ready')throw new Error('Missing2015');
 const html=explorer({selection:result.data,spatial:result,aggregate:{status:'unavailable'},datasets:[{...result.data,availability:'available'}]});
 expect(html).toContain('Located');expect(html).toContain('1,585');expect(html).toContain('1,596');expect(html).toContain('Backcourt');expect(html).toContain('2/11');expect(html).toContain('Archive totals differ');
 });
 it('supplies light default, explicit dark, reduced motion, readable type and 44px alternative hit targets',()=>{
 const css=readFileSync(new URL('./shot-map.module.css',import.meta.url),'utf8');expect(css).toContain("html[data-theme='dark']");expect(css).toContain('color-scheme:light');expect(css).not.toContain('html:not');expect(css).toContain('prefers-reduced-motion');expect(css).toContain('min-height:44px');
 const html=explorer();expect(html).toContain('Choose a shot location');expect(html).toContain('Previous location');expect(html).toContain('Next location');expect(html).toContain('aria-live="polite"');
 });
});
