'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { HeatmapIdentity, HeatmapSeasonType, SeasonHeatmapDisplayRow, SeasonHeatmapRendererDTO } from '@/lib/season-heatmap';
import type { SeasonShotMapDTO, SeasonShotMapResource, ShotMapBin, ShotMapResidualReason } from '@/lib/season-shot-map';
import type { SeasonHeatmapDatasetMetadata, SeasonHeatmapResource } from '../SeasonHeatmapExplorer';
import { sameIdentity, zoneName } from '../season-heatmap/season-heatmap-display';
import ShotMapCourt, { binKey, ShotMapLegend } from './ShotMapCourt';
import { axialCenter, binDelta, countFormat, displayPct, fgRate, type ShotMapView } from './shot-map-display';
import styles from './shot-map.module.css';
import Select from '../ui/Select';
export type SpatialResource = SeasonShotMapResource | {status:'loading'};
interface Props {
 player:{id:number;name:string;secondaryName?:string;teamLabel?:string}; locale:'en'|'zh'; datasets:readonly SeasonHeatmapDatasetMetadata[];
 selection:HeatmapIdentity; aggregate:SeasonHeatmapResource; spatial:SpatialResource;
 onChoose:(selection:HeatmapIdentity)=>void; onRetry:()=>void; initialView?:ShotMapView;
}
export default function RefinedShotExplorer(props:Props) {
 const id=useId(),zh=props.locale==='zh', {selection,player,datasets,onChoose}=props;
 const [view,setView]=useState<ShotMapView>(props.initialView??'hex');
 const seasons=[...new Set(datasets.filter(d=>d.playerId===player.id).map(d=>d.season))].sort().reverse();
 const data=props.spatial.status==='ready'&&sameIdentity(props.spatial.data,selection)?props.spatial.data:null;
 const zones=props.aggregate.status==='ready'&&sameIdentity(props.aggregate.data,selection)?props.aggregate.data:null;
 const totals=data?.totals??zones?.totals, threes=data?.totals??zones?.archive;
 const typeName=(type:HeatmapSeasonType)=>type==='Playoffs'?(zh?'季后赛':'Playoffs'):(zh?'常规赛':'Regular season');
 return <section className={styles.explorer} lang={zh?'zh-CN':'en'} aria-labelledby={`${id}-title`} data-refined-shot-explorer="true">
   <header className={styles.header}><div><span className={styles.eyebrow}>{zh?'球员投篮档案':'PLAYER SHOT ARCHIVE'}</span><h2 id={`${id}-title`}>{zh?'投篮分布':'Shot distribution'}</h2><p className={styles.subtitle}>{player.name} · {selection.season.replace('-','–')} · {typeName(selection.seasonType)}</p></div>
    <div className={styles.filters}><Select className={styles.seasonSelect} value={selection.season} aria-label={zh?'赛季':'Season'} onValueChange={season=>onChoose({...selection,season})} options={seasons.map(season=>({value:season,label:season}))}/>
    <div className={styles.segments} role="group" aria-label={zh?'赛季类型':'Season type'}>{(['Regular Season','Playoffs'] as const).map(type=><button type="button" key={type} aria-pressed={selection.seasonType===type} onClick={()=>onChoose({...selection,seasonType:type})}>{typeName(type)}</button>)}</div></div>
   </header>
   <div className={styles.stats} aria-label={zh?'档案统计':'Archive statistics'}>
    <Stat label={zh?'档案出手':'Archived attempts'} value={totals?countFormat(totals.fga,props.locale):'—'} note={totals?`${countFormat(totals.fgm,props.locale)} ${zh?'命中':'made'}`:' '}/>
    <Stat label={zh?'投篮命中率':'Field-goal percentage'} value={totals?displayPct(fgRate(totals)):'—'} note={totals?`${totals.fgm} / ${totals.fga} FG`:' '}/>
    <Stat label={zh?'三分命中率':'Three-point percentage'} value={threes?displayPct(threes.fg3a?threes.fg3m/threes.fg3a:null):'—'} note={threes?`${threes.fg3m} / ${threes.fg3a} 3P`:' '}/>
   </div>
   <div className={styles.toolbar}><div className={styles.modes} role="group" aria-label={zh?'图表视图':'Chart view'}>{(['hex','density','zones'] as const).map(mode=><button type="button" key={mode} aria-pressed={view===mode} onClick={()=>setView(mode)}><ModeIcon mode={mode}/>{mode==='hex'?(zh?'六边形':'Hexagons'):mode==='density'?(zh?'出手密度':'Frequency'):(zh?'球场分区':'Zones')}</button>)}</div><span className={styles.toolbarNote}>{zh?'点击球场，查看细节':'Tap the court to explore'}</span></div>
   <ChartPanel key={`${selection.playerId}:${selection.season}:${selection.seasonType}:${view}`} {...props} data={data} zones={zones} view={view} />
 </section>;
}
function Stat({label,value,note}:{label:string;value:string;note:string}) {return <div className={styles.stat}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;}
function ModeIcon({mode}:{mode:ShotMapView}) {return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">{mode==='hex'?<path d="M10 2L17 6V14L10 18L3 14V6Z"/>:mode==='density'?<><circle cx="10" cy="10" r="7" opacity=".3"/><circle cx="10" cy="10" r="4" opacity=".65"/><circle cx="10" cy="10" r="1"/></>:<><rect x="3" y="2" width="14" height="16" rx="1"/><path d="M7 18V12H13V18M3 9A7 7 0 0 1 17 9"/></>}</svg>;}
function ChartPanel({data,zones,view,locale,spatial,aggregate,onRetry,selection}:Props&{data:SeasonShotMapDTO|null;zones:SeasonHeatmapRendererDTO|null;view:ShotMapView}) {
 const zh=locale==='zh',id=useId(),detailsId=`${id}-details`,[selected,setSelected]=useState<string|null>(null);
 const courtRef=useRef<SVGSVGElement>(null),detailRef=useRef<HTMLElement>(null);
 const resolution=data?.resolutions.find(r=>r.id==='fine'); const bins=resolution?.bins??[];
 const selectedBin=bins.find(bin=>binKey(bin)===selected)??null;
 const rows=zones?[...zones.zones,...zones.residuals]:[]; const selectedZone=rows.find(row=>row.id===selected)??null;
 const active=view==='zones'?zones:data,resource=view==='zones'?aggregate:spatial;
 const selectedRow=view==='zones'?selectedZone:selectedBin;
 useEffect(()=>{if(selectedRow)detailRef.current?.scrollIntoView({block:'nearest'});},[selectedRow]);
 const announcement=selectedRow?`${view==='zones'&&selectedZone?zoneName(selectedZone.id,locale):(zh?'投篮位置':'Shot location')}: ${displayPct(fgRate(selectedRow))}, ${selectedRow.fgm} / ${selectedRow.fga}`:'';
 function dismiss(){setSelected(null);courtRef.current?.focus();}
 if(!active){const wrong=resource.status==='ready',status=wrong?'error':resource.status;return <div className={styles.state} aria-busy={status==='loading'} role={status==='error'?'alert':'status'}>
   <h3>{status==='loading'?(zh?'正在载入投篮记录':'Loading the shot archive'):status==='error'?(zh?'暂时无法载入':'Unable to load this dataset'):(zh?'这个赛季暂无此项数据':'This view is not available for this season')}</h3>
   <p>{status==='loading'?(zh?'正在读取所选球员、赛季与赛事类型的真实记录。':'Retrieving the selected player, season and season type.'):status==='error'?(zh?'请重试。未能验证的数据不会显示。':'Please retry. Unverified or mismatched data will not be displayed.'):(view==='zones'?(zh?'未收录不代表零次出手。':'Missing records do not mean zero attempts.'):(zh?'坐标记录暂不可用，可切换「球场分区」查看已有汇总。未收录不代表零次出手。':'Shot coordinates are unavailable. The Zones view may have aggregate records. Missing records do not mean zero attempts.'))}</p>
   {status==='error'&&<button type="button" onClick={onRetry}>{zh?'重新加载':'Retry'}</button>}
  </div>;}
 return <>
   <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
   <div className={styles.layout}><div className={styles.visual}><div className={styles.courtWrap}><ShotMapCourt data={data} zones={zones} view={view} locale={locale} selected={selected} onSelect={setSelected} detailsId={selectedRow?detailsId:undefined} courtRef={courtRef}/></div><ShotMapLegend view={view} locale={locale}/>
    <p className={styles.microcopy}>{view==='density'?(zh?'当前选区内的相对出手频率平滑估计；包含篮下，不表示命中率。':'Relative smoothed attempt frequency within this selection, including the rim. Not FG%.'):view==='zones'?(zh?'橙色高于、黄色接近、蓝色低于同赛季联盟档案参考（±3 个百分点）。球员少于 25 次、联盟少于 20 次出手或缺少参考为灰色。内部分界为示意。':'Orange: above, yellow: within ±3 pp, blue: below the same-season league archive reference. Gray: fewer than 25 player or 20 league attempts, or no reference. Internal dividers are illustrative.'):(zh?'同赛季、同类型的同格联盟档案参考。球员 <5 次或联盟 <20 次出手：灰色。':'Same-cell, same-season/type league archive reference. Gray: fewer than 5 player or 20 league attempts.')}</p>
    {data&&view!=='zones'&&<div className={styles.residual}><span>{zh?'可定位':'Located'} {countFormat(data.plotted.fga,locale)} / {countFormat(data.totals.fga,locale)} {zh?'次出手':'attempts'}</span>{data.residuals.filter(r=>r.fga>0).map(r=><span key={r.reason}>{residualLabel(r.reason,zh)} {r.fgm}/{r.fga}</span>)}</div>}
   </div>{selectedRow&&<aside ref={detailRef} id={detailsId} className={styles.detail} aria-label={zh?'投篮详情':'Shot details'} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();dismiss();}}}>
    <button type="button" className={styles.closeDetail} title={zh?'关闭详情':'Close details'} aria-label={zh?'关闭详情':'Close details'} onClick={dismiss}><span aria-hidden="true">×</span></button>
    {view==='zones'&&selectedZone?<ZoneDetail row={selectedZone} zones={zones!} locale={locale}/>:selectedBin?<BinDetail bin={selectedBin} data={data!} locale={locale}/>:null}
   </aside>}</div>
   <Coverage data={view==='zones'?zones:data} locale={locale}/>
   {view==='zones'&&zones&&<details className={styles.scope}><summary>{zh?'全部分区统计':'All zone statistics'}<span>{zones.zones.length}</span></summary><div className={styles.zoneList}>{rows.map(row=><button type="button" key={row.id} aria-pressed={selected===row.id} aria-controls={selectedRow?detailsId:undefined} onClick={()=>setSelected(row.id)}><span>{zoneName(row.id,locale)}</span><span>{displayPct(fgRate(row))} · {row.fgm}/{row.fga}</span></button>)}</div></details>}
   <details className={styles.scope}><summary>{zh?'数据范围与读图方法':'Data scope & reading guide'}</summary>
    {data&&view!=='zones'?<>
      <p>{zh?`六边形来自原始逐次投篮坐标，分箱半径为 ${resolution?.radius===25?'2.5':'4'} 英尺。面积与本图单格出手数成正比；最大格为 ${Math.max(0,...bins.map(b=>b.fga))} 次。边界格保持原中心，虚线轮廓保留被裁切小格的可见性。`:`Hexagons are aggregated from original shot coordinates at a ${(resolution?.radius??25)/10}-foot cell radius. Area is proportional to attempts within this selection (largest cell: ${Math.max(0,...bins.map(b=>b.fga))}). Edge cells keep their true centers; dashed outlines preserve visibility when their scaled glyph is clipped.`}</p>
      <p>{zh?'效率颜色使用单格实际命中率，与所选赛季和赛事类型的同格联盟档案命中数÷出手数比较，包含本球员。中性色带为 ±3 个百分点。球员少于 5 次或联盟少于 20 次出手时不着色；不做命中率平滑，不代表统计显著性。':'Efficiency colors compare actual cell FG% to weighted same-cell league archive counts, for the selected season and type, including this player. The neutral band is ±3 percentage points. Color is suppressed below 5 player or 20 league attempts. FG% is not smoothed, and color does not imply statistical significance.'}</p>
      <p>{zh?'同格可能包含两分和三分，命中率不是每次出手得分。详情保留明确投篮类型、两分/三分次数和每次出手得分。出手密度视图仅对分箱出手数作平滑估计（高斯标准差 1.8 英尺），不使用命中信息；按本选区最大格归一化，不可跨赛季比较颜色深浅。':'A cell can contain both twos and threes: FG% is not points per attempt. Details retain explicit shot types, 2P/3P counts and points per attempt. Frequency smooths binned attempts only with a 1.8-foot Gaussian standard deviation and never uses makes. It is normalized to this selection’s largest cell, so intensity is not comparable across seasons.'}</p>
      <p>{zh?`图内 ${data.plotted.fgm}/${data.plotted.fga} + 图外 ${data.totals.fgm-data.plotted.fgm}/${data.totals.fga-data.plotted.fga} = 档案 ${data.totals.fgm}/${data.totals.fga}（命中/出手）。后场、无效和缺失坐标不分配到图内。`:`Plotted ${data.plotted.fgm}/${data.plotted.fga} + outside/unlocated ${data.totals.fgm-data.plotted.fgm}/${data.totals.fga-data.plotted.fga} = archive ${data.totals.fgm}/${data.totals.fga} (makes/attempts). Backcourt, invalid and missing coordinates are never placed inside the chart.`}</p>
      <p>{zh?'联盟档案范围':'League archive scope'}: {data.reference.scope.season} · {selection.seasonType==='Playoffs'?(zh?'季后赛':'Playoffs'):(zh?'常规赛':'Regular season')} · {data.reference.scope.from} – {data.reference.scope.to}. {data.reference.scope.leagueFgm}/{data.reference.scope.leagueFga} FG. {zh?'档案来源的联盟覆盖完整性未独立核验；并非 NBA 页面 LA。坐标比例已与来源距离及左右标签核对，未逐球对照官方事件。':'Complete league archive coverage is not independently verified; this is not NBA-displayed LA. Coordinate scale is checked against source distances and left/right labels, not individual official events.'}</p>
     </>:zones&&<><p>{zh?'分区按来源 BASIC/AREA 类别汇总；限制区、油漆区和三分线使用真实 NBA 比例。内部方向分界为示意，不能当作逐球坐标边界。':'Zones aggregate source BASIC/AREA categories. Restricted area, lane and three-point lines use regulation proportions; internal direction dividers are illustrative.'}</p><p>{zh?`分区 ${zones.coverage.normalZoneAttempts} + 后场或分类残差 ${zones.coverage.residualAttempts} = 档案 ${zones.coverage.seasonAttemptDenominator} 次出手。三分只按明确投篮类型统计。`:`Mapped zones ${zones.coverage.normalZoneAttempts} + backcourt/classification residuals ${zones.coverage.residualAttempts} = ${zones.coverage.seasonAttemptDenominator} archive attempts. Three-pointers use explicit shot type.`}</p></>}
    {(view==='zones'?zones?.source:data?.source)&&<p><a href={(view==='zones'?zones?.source:data?.source)?.url} target="_blank" rel="noreferrer">{zh?'固定版本来源档案':'Pinned source archive'}</a> · {zh?'来源日期':'Source date'} {(view==='zones'?zones?.source:data?.source)?.capturedAtUtc?.slice(0,10)??'—'} UTC</p>}
    {(view==='zones'?zones?.archive:data?.archive)&&<ArchiveNotes data={(view==='zones'?zones?.archive:data?.archive)!} locale={locale}/>}
   </details>
 </>;
}
function BinDetail({bin,data,locale}:{bin:ShotMapBin;data:SeasonShotMapDTO;locale:'en'|'zh'}) { const zh=locale==='zh',delta=binDelta(bin,bin.league),[x,y]=axialCenter(bin.q,bin.r,25),low=bin.fga<5||bin.league.fga<20; return <>
 <div className={styles.detailTop}><span className={styles.detailLabel}>{zh?'坐标分箱':'SPATIAL CELL'}</span>{low&&<span className={styles.badge}>{zh?'小样本':'Small sample'}</span>}</div><h3>{x<-.5?(zh?'左侧':'Left'):x>.5?(zh?'右侧':'Right'):(zh?'中路':'Center')} · {(Math.hypot(x,y)/10).toFixed(1)} {zh?'英尺':'ft'}</h3>
 <div className={styles.detailMain}>{displayPct(fgRate(bin))}</div><p className={styles.detailCaption}>{zh?'实际投篮命中率':'Actual field-goal percentage'}</p><dl>
 <Row label={zh?'命中 / 出手':'Made / attempts'} value={`${bin.fgm} / ${bin.fga}`}/><Row label={zh?'档案出手占比':'Archive shot share'} value={displayPct(data.totals.fga?bin.fga/data.totals.fga:null)}/>
 <Row label={zh?'两分命中 / 出手':'2P made / attempts'} value={`${bin.fgm-bin.fg3m} / ${bin.fga-bin.fg3a}`}/><Row label={zh?'三分命中 / 出手':'3P made / attempts'} value={`${bin.fg3m} / ${bin.fg3a}`}/>
 <Row label={zh?'每次出手得分':'Points / attempt'} value={bin.fga?((2*bin.fgm+bin.fg3m)/bin.fga).toFixed(2):'—'}/><Row label={zh?'同格联盟档案':'Same-cell league archive'} value={displayPct(fgRate(bin.league))} note={`${bin.league.fgm} / ${bin.league.fga}`}/>
 <Row label={zh?'与联盟参考之差':'Difference from reference'} value={delta===null?'—':`${delta>0?'+':''}${(delta*100).toFixed(1)} ${zh?'百分点':'pp'}`}/></dl>
 {low&&<p className={styles.microcopy}>{zh?'少于 5 次球员出手或 20 次联盟出手，使用灰色。保留实际统计，不据此判断稳定能力。':'Below 5 player or 20 league attempts: shown in gray. Exact counts are retained, but this does not establish stable shooting ability.'}</p>}
 <p className={styles.microcopy}>{zh?'距离为分箱中心距篮筐，并非每次投篮的精确距离。':'Distance is from the bin center to the rim, not each shot’s exact distance.'}</p>
 </>;}
function Row({label,value,note}:{label:string;value:string;note?:string}) {return <div><dt>{label}</dt><dd>{value}{note&&<small>{note}</small>}</dd></div>;}
function ZoneDetail({row,zones,locale}:{row:SeasonHeatmapDisplayRow;zones:SeasonHeatmapRendererDTO;locale:'en'|'zh'}) {const zh=locale==='zh';return <><span className={styles.detailLabel}>{zh?'来源分区':'SOURCE ZONE'}</span><h3>{zoneName(row.id,locale)}</h3><div className={styles.detailMain}>{displayPct(fgRate(row))}</div><p className={styles.detailCaption}>{zh?'实际命中率':'Actual FG%'}</p><dl><Row label={zh?'命中 / 出手':'Made / attempts'} value={`${row.fgm} / ${row.fga}`}/><Row label={zh?'档案出手占比':'Archive shot share'} value={displayPct(zones.totals.fga?row.fga/zones.totals.fga:null)}/><Row label={zh?'三分命中 / 出手':'3P made / attempts'} value={`${row.fg3m??'—'} / ${row.fg3a??'—'}`}/><Row label={zh?'联盟档案参考':'League archive reference'} value={row.leagueAverage?`${row.leagueAverage.displayedPct}%`:'—'}/></dl>{row.fga<25&&<p className={styles.microcopy}>{zh?'少于 25 次出手，请谨慎解读。':'Fewer than 25 attempts; interpret cautiously.'}</p>}</>;}
function residualLabel(reason:ShotMapResidualReason,zh:boolean) {return ({'missing-coordinate':zh?'缺失坐标':'Missing coordinates','nonfinite-coordinate':zh?'非有限坐标':'Nonfinite coordinates','invalid-coordinate':zh?'无效坐标':'Invalid coordinates','out-of-court':zh?'界外坐标':'Out-of-court','backcourt':zh?'后场':'Backcourt','coordinate-shot-type-conflict':zh?'三分坐标与投篮类型冲突':'Recorded 3P at rim'})[reason];}
function Coverage({data,locale}:{data:SeasonShotMapDTO|SeasonHeatmapRendererDTO|null;locale:'en'|'zh'}) {const zh=locale==='zh',archive=data?.archive;if(!archive)return null;const control=archive.officialControl;return <p className={styles.coverage} data-archive-coverage={archive.coverageStatus}>
 {archive.coverageStatus==='official-shooting-totals-match'?(zh?'档案四项投篮总数与官方核验值一致；不代表逐球或联盟覆盖已完整核验。':'All four shooting totals match the official control; individual shots and league coverage are not fully verified.'):archive.coverageStatus==='official-shooting-totals-mismatch'?(zh?`档案与官方总数不一致。档案 ${data!.totals.fgm}/${data!.totals.fga}，官方 ${control?.fgm}/${control?.fga}；缺口不补到球场中。`:`Archive totals differ from the official control: ${data!.totals.fgm}/${data!.totals.fga} vs ${control?.fgm}/${control?.fga}. The gap is not filled into the court.`):(zh?'当前为来源档案记录，尚未与官方赛季总数对账，不宣称完整赛季覆盖。':'Source archive records; not reconciled to official season totals. Full-season completeness is not claimed.')}
 </p>;}
function ArchiveNotes({data,locale}:{data:NonNullable<SeasonHeatmapRendererDTO['archive']>;locale:'en'|'zh'}) {const zh=locale==='zh';return <><p>{zh?'档案整体日期范围':'Archive-wide date range'}: {data.sourceCoverage.from} – {data.sourceCoverage.to}. {zh?'有投篮记录的比赛':'Shot-bearing games'}: {data.shotBearingGames}; {zh?'官方出场数':'Official GP'}: {data.officialGp??'—'}. {zh?'有投篮记录的比赛数不等同于出场数；可能不含零出手比赛。':'Shot-bearing games are not GP; zero-attempt games can be absent.'}</p>{data.officialControl&&<p><a href={data.officialControl.url} target="_blank" rel="noreferrer">{zh?'官方投篮总数核验来源':'Official shooting-total control'}</a>: {data.officialControl.fgm}/{data.officialControl.fga} FG · {data.officialControl.fg3m}/{data.officialControl.fg3a} 3P · {data.officialControl.capturedAtUtc.slice(0,10)} UTC</p>}</>;}
