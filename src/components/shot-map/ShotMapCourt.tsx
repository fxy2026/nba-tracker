import { useId, type KeyboardEvent, type MouseEvent } from 'react';
import type { SeasonShotMapDTO, ShotMapBin } from '@/lib/season-shot-map';
import type { SeasonHeatmapRendererDTO } from '@/lib/season-heatmap';
import { courtBasicGeometry } from '@/lib/season-heatmap-court-geometry';
import { zoneName } from '../season-heatmap/season-heatmap-display';
import { axialCenter, binColor, displayPct, fgRate, hexPoints, hexRadius, projectShot, SHOT_MAP_PALETTE, SHOT_MAP_VIEWBOX, type ShotMapView } from './shot-map-display';
import styles from './shot-map.module.css';
export const binKey = (bin: Pick<ShotMapBin,'q'|'r'>) => `${bin.q}:${bin.r}`;
export function CourtMarkings() {
  const cornerY = 417.5 - Math.sqrt(237.5 ** 2 - 220 ** 2);
  return <g pointerEvents="none" aria-hidden="true" data-court-markings="regulation-50-by-47-feet" className={styles.courtLine}>
    <rect x="-250" y="0" width="500" height="470" />
    <path d="M-80 470V280H80V470" />
    <path d={`M-220 470V${cornerY}A237.5 237.5 0 0 1 220 ${cornerY}V470`} />
    <path d="M-60 280A60 60 0 0 1 60 280" />
    <path d="M-60 280A60 60 0 0 0 60 280" strokeDasharray="5 6" strokeOpacity=".55" />
    <path d="M-40 430V417.5A40 40 0 0 1 40 417.5V430" />
    <path d="M-60 0A60 60 0 0 0 60 0" strokeOpacity=".6" />
    <g className={styles.hoop}><path d="M-30 430H30" strokeWidth="2.5" /><circle cx="0" cy="417.5" r="7.5" /></g>
  </g>;
}
interface Props { data: SeasonShotMapDTO | null; zones: SeasonHeatmapRendererDTO | null; view: ShotMapView; locale: 'en'|'zh'; selected: string | null; onSelect: (key:string)=>void; detailsId:string }
/** Exact precomputed coordinate cells. No source-zone totals are converted into points. */
export default function ShotMapCourt({data,zones,view,locale,selected,onSelect,detailsId}:Props) {
  const uid=useId().replace(/:/g,''), clip=`${uid}-frame`, densityFilter=`${uid}-density`, zh=locale==='zh';
  const resolution=data?.resolutions.find(r=>r.id==='fine'), bins=resolution?.bins??[], radius=resolution?.radius??25;
  const max=Math.max(0,...bins.map(bin=>bin.fga));
  const points=bins.map(bin=>{ const [sx,sy]=axialCenter(bin.q,bin.r,radius); const [x,y]=projectShot(sx,sy); return {bin,x,y,edge:sx < -250 || sx > 250 || sy < -52.5 || sy > 417.5}; });
  function click(event:MouseEvent<SVGSVGElement>) {
    if(view==='zones'||!points.length)return;
    const bounds=event.currentTarget.getBoundingClientRect();
    const x=(event.clientX-bounds.left)*540/bounds.width-270, y=(event.clientY-bounds.top)*510/bounds.height-20;
    if(x < -250 || x > 250 || y < 0 || y > 470)return;
    const nearest=points.reduce((best,p)=>Math.hypot(p.x-x,p.y-y)<Math.hypot(best.x-x,best.y-y)?p:best);
    // A minimum 44 CSS-pixel target around observed cells; distant empty court stays empty.
    if(Math.hypot(nearest.x-x,nearest.y-y)<=Math.max(radius,22*540/bounds.width)) onSelect(binKey(nearest.bin));
  }
  function keydown(event:KeyboardEvent<SVGSVGElement>) {
    if(view==='zones'||!points.length)return;
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Enter',' '].includes(event.key))return;
    event.preventDefault();
    const current=points.find(p=>binKey(p.bin)===selected);
    if(event.key==='Home'||!current){onSelect(binKey(points[0].bin));return;}
    if(event.key==='End'){onSelect(binKey(points[points.length-1].bin));return;}
    const axis=event.key==='ArrowLeft'?[-1,0]:event.key==='ArrowRight'?[1,0]:event.key==='ArrowUp'?[0,-1]:event.key==='ArrowDown'?[0,1]:null;
    if(!axis)return;
    const candidates=points.filter(p=>(p.x-current.x)*axis[0]+(p.y-current.y)*axis[1]>.5);
    const next=candidates.sort((a,b)=>{
      const score=(p:typeof current)=>{const dx=p.x-current.x,dy=p.y-current.y; const along=dx*axis[0]+dy*axis[1]; return Math.hypot(dx,dy)+2*Math.abs(dx*axis[1]-dy*axis[0])/Math.max(along,1)*radius;};
      return score(a)-score(b);
    })[0];
    if(next)onSelect(binKey(next.bin));
  }
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={SHOT_MAP_VIEWBOX} className={styles.court} role="group" tabIndex={view==='zones'?undefined:0}
    aria-labelledby={`${uid}-title`} aria-describedby={`${uid}-desc`} aria-controls={detailsId} onClick={click} onKeyDown={keydown}
    data-shot-map-view={view} data-spatial-geometry={data?.geometryVersion}>
    <title id={`${uid}-title`}>{`${zh?'逐次投篮坐标分布':'Shot-coordinate distribution'} · ${data?.season??zones?.season??''}`}</title>
    <desc id={`${uid}-desc`}>{view==='density'?(zh?'颜色仅表示平滑后的分箱出手频率估计，不代表命中率。':'Color estimates smoothed binned attempt frequency, not shooting percentage.'):view==='zones'?(zh?'来源球场分区示意。点击或键盘选择查看真实统计。':'Illustrative source court categories. Select a zone for its exact statistics.'):(zh?'六边形面积表示出手次数，颜色对比同格档案联盟命中率。点击附近格子，或使用方向键和下方选择器查看。':'Hex area represents attempts; color compares same-cell archive league FG%. Tap a nearby cell, or use arrow keys and the cell selector.')}</desc>
    <defs><clipPath id={clip}><rect x="-250" y="0" width="500" height="470" /></clipPath><filter id={densityFilter} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation="18" /></filter></defs>
    <rect x="-270" y="-20" width="540" height="510" rx="12" fill="var(--map-court, #fafaf7)" />
    {view==='zones'&&zones&&<g transform="translate(-250 470) scale(.8333333333 -.8333333333)">{courtBasicGeometry.map(geometry=>{
      const row=zones.zones.find(z=>z.id===geometry.id); if(!row)return null;
      const league=row.leagueAverage?.provenance==='weighted-archive-counts-not-official-displayed-LA'?{fgm:row.leagueAverage.leagueFgm??0,fga:row.leagueAverage.leagueFga??0,fg3m:0,fg3a:0}:null;
      const color=row.fga<25?SHOT_MAP_PALETTE.neutral:binColor({fgm:row.fgm,fga:row.fga,fg3m:row.fg3m??0,fg3a:row.fg3a??0},league);
      return <path key={row.id} d={geometry.pathD} fill={color===SHOT_MAP_PALETTE.neutral?"var(--map-neutral, #d7d8d4)":color} fillOpacity={selected===row.id?'.42':'.16'} fillRule="evenodd" className={styles.zone} role="button" tabIndex={0} aria-pressed={selected===row.id} aria-controls={detailsId}
        aria-label={`${zoneName(row.id,locale)}: ${displayPct(fgRate(row))}, ${row.fgm}/${row.fga}`} data-zone-id={row.id}
        onClick={event=>{event.stopPropagation();onSelect(row.id);}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(row.id);}}}/>;
    })}</g>}
    {view==='density'&&<g clipPath={`url(#${clip})`}><g filter={`url(#${densityFilter})`} data-density-bandwidth="18-source-units-1.8-feet">{points.map(({bin,x,y})=><circle key={binKey(bin)} cx={x} cy={y} r={radius*.95} fill="var(--map-density, #789a97)" fillOpacity={max?bin.fga/max:0} data-density-attempts={bin.fga}/>)}</g></g>}
    {view==='hex'&&<g clipPath={`url(#${clip})`}>{points.map(({bin,x,y,edge})=><g key={binKey(bin)} data-bin-id={binKey(bin)} data-bin-fga={bin.fga} data-bin-center={`${x},${y}`}>
      {edge&&<polygon data-edge-cell="true" points={hexPoints(x,y,radius)} fill="none" stroke="var(--map-line, #abb3aa)" strokeWidth="1" strokeDasharray="2 2"/>}
      <polygon points={hexPoints(x,y,hexRadius(bin.fga,max,radius))} fill={binColor(bin,bin.league)===SHOT_MAP_PALETTE.neutral?"var(--map-neutral, #d7d8d4)":binColor(bin,bin.league)} className={selected===binKey(bin)?styles.selectedHex:styles.hex}/>
    </g>)}</g>}
    <CourtMarkings />
    {selected&&view!=='zones'&&points.filter(p=>binKey(p.bin)===selected).map(({bin,x,y})=><g key="selected" clipPath={`url(#${clip})`} pointerEvents="none"><polygon points={hexPoints(x,y,radius)} fill="none" stroke="var(--map-focus, #477c84)" strokeWidth="2" strokeDasharray="3 3"/><title>{`${bin.fgm}/${bin.fga}`}</title></g>)}
  </svg>;
}
export function ShotMapLegend({view,locale}:{view:ShotMapView;locale:'en'|'zh'}) { const zh=locale==='zh';return <div className={styles.legend}>
  {view==='density'?<div className={styles.legendColors}><span>{zh?'出手频率':'Shot frequency'}</span><span>{zh?'低':'Low'}</span><span className={styles.swatches}>{[.15,.35,.6,.85].map(opacity=><i key={opacity} style={{background:'var(--map-density, #789a97)',opacity}}/>)}</span><span>{zh?'高':'High'}</span></div>:<div className={styles.legendColors}><span>{zh?'低于':'Below'}</span><span className={styles.swatches}>{[SHOT_MAP_PALETTE.below,SHOT_MAP_PALETTE.near,SHOT_MAP_PALETTE.above].map(color=><i key={color} style={{background:color}}/>)}</span><span>{zh?'高于联盟参考':'Above reference'}</span></div>}
  {view==='hex'&&<span className={styles.legendSize}><svg viewBox="0 0 46 19" aria-hidden="true"><polygon points={hexPoints(7,10,3)} fill="#bec5be"/><polygon points={hexPoints(21,10,5)} fill="#bec5be"/><polygon points={hexPoints(38,10,8)} fill="#bec5be"/></svg>{zh?'面积 = 出手量':'Area = attempts'}</span>}
  {view==='zones'&&<span>{zh?'点击分区查看':'Select a zone'}</span>}
</div>;}
