"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, List, X } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import type { VerifiedShotChart } from "@/lib/court-shots";
import ComparisonCourtView from "./shot-chart/ComparisonCourtView";
import { courtCopy } from "./shot-chart/court-copy";
import { formatCourtClock } from "./shot-chart/court-geometry";
import { compareCourtShots, comparisonColor, EMPTY_COMPARISON_FILTERS, type ComparisonFilters, type CourtFocus } from "./shot-chart/comparison-geometry";
import styles from "./shot-chart/shot-court.module.css";

export default function ShotChartExplorer({data}:{data:VerifiedShotChart}) {
  const {locale}=useLocale(), copy=courtCopy[locale], isZh=locale==="zh";
  const [filters,setFilters]=useState<ComparisonFilters>(EMPTY_COMPARISON_FILTERS);
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const [showList,setShowList]=useState(false);
  const [focus,setFocus]=useState<CourtFocus>("full");
  const comparison=useMemo(()=>compareCourtShots(data,filters),[data,filters]);
  const shots=focus==="full"?comparison.shots:comparison[focus].shots;
  const selected=shots.find(s=>s.eventId===selectedId);
  const sameSpot=selected?shots.filter(s=>s.teamId===selected.teamId&&s.xFeet===selected.xFeet&&s.yFeet===selected.yFeet):[];
  const selectedIndex=selected?shots.indexOf(selected):-1;
  const players=useMemo(()=>Object.fromEntries((["away","home"] as const).map(side=>[side,Array.from(new Map(data.shots.filter(s=>s.teamId===data[side].teamId).map(s=>[s.personId,s])).values()).sort((a,b)=>a.playerName.localeCompare(b.playerName))])),[data]);
  const periods=useMemo(()=>Array.from(new Set(data.shots.map(s=>s.period))).sort((a,b)=>a-b),[data.shots]);
  const awayColor=comparisonColor(data.away.teamTricode,"away"),homeColor=comparisonColor(data.home.teamTricode,"home");
  const periodLabel=(n:number)=>n>4?`${copy.overtime}${n-4}`:isZh?`第 ${n} 节`:`Q${n}`;
  function changeFilter(key:keyof ComparisonFilters,value:string){setFilters(old=>({...old,[key]:value}));setSelectedId(null);}
  function clear(){setFilters(EMPTY_COMPARISON_FILTERS);setSelectedId(null);}
  const active=Object.values(filters).some(value=>value!=="all");
  return <div className={styles.explorer}>
    <div className={styles.comparisonHeader}>
      <div><span className={styles.comparisonEyebrow}>SHOT ATLAS</span><p>{copy.compareTeams}</p></div>
      <div className={styles.sharedFilters}>
        <label><span className={styles.srOnly}>{copy.period}</span><select aria-label={copy.period} value={filters.period} onChange={event=>changeFilter("period",event.target.value)}><option value="all">{copy.allPeriods}</option>{periods.map(period=><option key={period} value={period}>{periodLabel(period)}</option>)}</select></label>
        <label><span className={styles.srOnly}>{copy.outcome}</span><select aria-label={copy.outcome} value={filters.result} onChange={event=>changeFilter("result",event.target.value)}><option value="all">{copy.allResults}</option><option value="Made">{copy.made}</option><option value="Missed">{copy.missed}</option></select></label>
        {active&&<button type="button" className={styles.comparisonClear} onClick={clear}>{copy.clear}</button>}
      </div>
    </div>
    <div className={styles.teamComparison}>
      {(["away","home"] as const).map(side=>{const team=data[side],summary=comparison[side].summary,teamColor=side==="away"?awayColor:homeColor;return <div key={side} className={styles.teamComparisonCard} style={{"--team-color":teamColor} as CSSProperties}>
        <div className={styles.teamComparisonTitle}><span className={styles.teamIdentity}><i/>{team.teamTricode}</span><span>{side==="away"?copy.away:copy.home}</span></div>
        <label className={styles.comparisonPlayer}><span className={styles.srOnly}>{team.teamTricode} {copy.player}</span><select aria-label={`${team.teamTricode} ${copy.player}`} value={filters[side==="away"?"awayPlayer":"homePlayer"]} onChange={event=>changeFilter(side==="away"?"awayPlayer":"homePlayer",event.target.value)}><option value="all">{copy.allPlayers}</option>{players[side].map(player=><option key={player.personId} value={player.personId}>{player.playerName}</option>)}</select></label>
        <div className={styles.teamShooting} aria-label={`${team.teamTricode} ${copy.summary}`} aria-live="polite"><strong>{summary.attempted?`${(summary.made/summary.attempted*100).toFixed(1)}`:"—"}<small>{summary.attempted?"%":""}</small></strong><span>{summary.attempted?copy.fg:copy.noAttempts}<b>{summary.made} / {summary.attempted}</b></span></div>
        <div className={styles.shootingTrack} aria-hidden="true"><i style={{width:`${summary.attempted?summary.made/summary.attempted*100:0}%`}}/></div>
      </div>;})}
    </div>
    <div className={styles.comparisonControls}>
      <div className={styles.focusModes} role="group" aria-label={copy.focusView}>
        <button type="button" aria-pressed={focus==="full"} onClick={()=>setFocus("full")}>{focus==="full"?copy.fullCourt:copy.backFull}</button>
        <button type="button" aria-pressed={focus==="away"} onClick={()=>setFocus("away")}>{data.away.teamTricode} {copy.halfCourt}</button>
        <button type="button" aria-pressed={focus==="home"} onClick={()=>setFocus("home")}>{data.home.teamTricode} {copy.halfCourt}</button>
      </div>
      <div className={styles.comparisonLegend}><span><i/> {copy.made}</span><span><i className={styles.hollowDot}/> {copy.missed}</span></div>
    </div>
    <div className={styles.comparisonCount} aria-live="polite"><span>{copy.shown}: {shots.length} {copy.shotsLabel}{filters.period!=="all"?` · ${periodLabel(Number(filters.period))}`:""}{filters.result!=="all"?` · ${filters.result==="Made"?copy.made:copy.missed}`:""}</span><span>{copy.fgScope}</span></div>
    <ComparisonCourtView key={focus} shots={shots} selectedId={selected?.eventId??null} onSelect={setSelectedId} focus={focus} away={data.away} home={data.home} awayColor={awayColor} homeColor={homeColor} copy={copy}/>
    <div className={`${styles.selection} ${selected?styles.hasSelection:""}`} aria-live="polite" aria-atomic="true">
      {selected?<>
        <div className={styles.selectionMain}>
          <span className={styles.comparisonResult}>{selected.result==="Made"?"●":"○"} {selected.result==="Made"?copy.made:copy.missed}</span>
          <strong>{selected.playerName}</strong><span>{selected.teamTricode} · {periodLabel(selected.period)} · {formatCourtClock(selected.clock)} · {selected.value}{isZh?" 分":" PT"}</span>
          <span className={styles.position}>{copy.coordinates}: {Math.abs(selected.xFeet).toFixed(1)} {copy.feet} {selected.xFeet<0?copy.left:selected.xFeet>0?copy.right:copy.center} · {Math.abs(selected.yFeet).toFixed(1)} {copy.feet} {selected.yFeet<0?copy.behind:copy.towards}</span>
          {selected&&sameSpot.length>1&&<button className={styles.sameSpot} type="button" onClick={()=>setSelectedId(sameSpot[(sameSpot.findIndex(s=>s.eventId===selected.eventId)+1)%sameSpot.length].eventId)}>{copy.sameSpot} {sameSpot.findIndex(s=>s.eventId===selected.eventId)+1}/{sameSpot.length} · {copy.nextAtSpot}</button>}
        </div>
        <div className={styles.selectionActions}>
          <button type="button" aria-label={copy.previous} disabled={selectedIndex<=0} onClick={()=>setSelectedId(shots[selectedIndex-1].eventId)}><ArrowLeft size={17}/></button>
          <button type="button" aria-label={copy.next} disabled={selectedIndex>=shots.length-1} onClick={()=>setSelectedId(shots[selectedIndex+1].eventId)}><ArrowRight size={17}/></button>
          <button type="button" aria-label={copy.close} onClick={()=>setSelectedId(null)}><X size={17}/></button>
        </div>
      </>:<p>{copy.select}</p>}
    </div>
    <div className={styles.footer}>
      <p><a href={data.source.url} target="_blank" rel="noreferrer">{copy.source}</a> · {data.coverage.mapped}/{data.coverage.total} {copy.coverage}</p>
      <button type="button" aria-expanded={showList} onClick={()=>setShowList(!showList)}><List size={16}/>{copy.showList} ({shots.length})</button>
    </div>
    <p className={styles.provenance}>{copy.standardized}</p>
    {showList&&<div className={styles.shotList}>
      <p>{copy.listHint}</p>
      {shots.length===0?<p>{copy.noShots}</p>:<ol aria-label={copy.list}>{shots.map(s=><li key={s.eventId}><button type="button" aria-pressed={selectedId===s.eventId} onClick={()=>setSelectedId(s.eventId)}><span className={styles.comparisonResult}>{s.result==="Made"?"●":"○"} {s.result==="Made"?copy.made:copy.missed}</span><strong>{s.playerName}</strong><span>{s.teamTricode} · {periodLabel(s.period)} · {formatCourtClock(s.clock)} · {s.value}{isZh?" 分":" PT"}</span></button></li>)}</ol>}
    </div>}
  </div>;
}
