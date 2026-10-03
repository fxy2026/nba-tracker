"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, List, SlidersHorizontal, X } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { summarizeCourtShots, type VerifiedShotChart } from "@/lib/court-shots";
import CourtView from "./shot-chart/CourtView";
import { courtCopy } from "./shot-chart/court-copy";
import { EMPTY_FILTERS, filterCourtShots, formatCourtClock, type ShotFilters } from "./shot-chart/court-geometry";
import styles from "./shot-chart/shot-court.module.css";

export default function ShotChartExplorer({data}:{data:VerifiedShotChart}) {
  const {locale}=useLocale(), copy=courtCopy[locale], isZh=locale==="zh";
  const [filters,setFilters]=useState<ShotFilters>(EMPTY_FILTERS);
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const [showList,setShowList]=useState(false);
  const [showFilters,setShowFilters]=useState(false);
  const shots=useMemo(()=>filterCourtShots(data.shots,filters),[data.shots,filters]);
  const summary=summarizeCourtShots(shots);
  const selected=shots.find(s=>s.eventId===selectedId);
  const sameSpot=selected?shots.filter(s=>s.xFeet===selected.xFeet&&s.yFeet===selected.yFeet):[];
  const selectedIndex=selected?shots.indexOf(selected):-1;
  const players=useMemo(()=>Array.from(new Map(data.shots.filter(s=>filters.teamId==="all"||String(s.teamId)===filters.teamId).map(s=>[s.personId,s])).values()).sort((a,b)=>a.playerName.localeCompare(b.playerName)),[data.shots,filters.teamId]);
  const periods=Array.from(new Set(data.shots.map(s=>s.period))).sort((a,b)=>a-b);
  const periodLabel=(n:number)=>n>4?`${copy.overtime}${n-4}`:isZh?`第 ${n} 节`:`Q${n}`;
  function changeFilter(key:keyof ShotFilters,value:string){setFilters(old=>({...old,[key]:value,...(key==="teamId"?{personId:"all"}:{})}));setSelectedId(null);}
  function clear(){setFilters(EMPTY_FILTERS);setSelectedId(null);}
  const active=Object.values(filters).some(v=>v!=="all");
  return <div className={styles.explorer}>
    <div className={styles.explorerHeader}>
      <div className={styles.teamTabs} role="group" aria-label={copy.team}>
        <button type="button" aria-pressed={filters.teamId==="all"} onClick={()=>changeFilter("teamId","all")}>{copy.allTeams}</button>
        {[data.away,data.home].map(t=><button key={t.teamId} type="button" aria-pressed={filters.teamId===String(t.teamId)} onClick={()=>changeFilter("teamId",String(t.teamId))}>{t.teamTricode}</button>)}
      </div>
      <button className={styles.filterToggle} type="button" aria-expanded={showFilters} onClick={()=>setShowFilters(!showFilters)}><SlidersHorizontal size={15}/>{showFilters?copy.hideFilters:copy.filters}{active&&<span className={styles.filterActive}/>}</button>
    </div>
    <div className={styles.playerRow}>
      <label className={styles.playerSelect}><span className={styles.srOnly}>{copy.player}</span><select aria-label={copy.player} value={filters.personId} onChange={e=>changeFilter("personId",e.target.value)}><option value="all">{copy.allPlayers}</option>{players.map(p=><option key={p.personId} value={p.personId}>{p.playerName}</option>)}</select></label>
      <div className={styles.summary} aria-label={copy.summary} aria-live="polite"><strong>{summary.made}<span>/</span>{summary.attempted}</strong><span>{summary.attempted?`${(summary.made/summary.attempted*100).toFixed(1)}%`:"—"} {copy.fg}</span></div>
    </div>
    {showFilters&&<div className={styles.filters}>
      <label>{copy.period}<select value={filters.period} onChange={e=>changeFilter("period",e.target.value)}><option value="all">{copy.allPeriods}</option>{periods.map(p=><option key={p} value={p}>{periodLabel(p)}</option>)}</select></label>
      <label>{copy.outcome}<select value={filters.result} onChange={e=>changeFilter("result",e.target.value)}><option value="all">{copy.allResults}</option><option value="Made">{copy.made}</option><option value="Missed">{copy.missed}</option></select></label>
      {active&&<button type="button" className={styles.clearFilters} onClick={clear}>{copy.clear}</button>}
    </div>}
    <div className={styles.legend}><span><i className={styles.madeDot}/> {copy.made}</span><span><i className={styles.missCross}>×</i> {copy.missed}</span><span className={styles.filteredCount}>{shots.length} {copy.shotsLabel}{filters.period!=="all"?` · ${periodLabel(Number(filters.period))}`:""}{filters.result!=="all"?` · ${filters.result==="Made"?copy.made:copy.missed}`:""}</span></div>
    <CourtView shots={shots} selectedId={selected?.eventId??null} onSelect={setSelectedId} copy={copy}/>
    <div className={`${styles.selection} ${selected?styles.hasSelection:""}`} aria-live="polite" aria-atomic="true">
      {selected?<>
        <div className={styles.selectionMain}>
          <span className={selected.result==="Made"?styles.resultMade:styles.resultMissed}>{selected.result==="Made"?"●":"×"} {selected.result==="Made"?copy.made:copy.missed}</span>
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
    <p className={styles.provenance}>{copy.normalized}</p>
    {showList&&<div className={styles.shotList}>
      <p>{copy.listHint}</p>
      {shots.length===0?<p>{copy.noShots}</p>:<ol aria-label={copy.list}>{shots.map(s=><li key={s.eventId}><button type="button" aria-pressed={selectedId===s.eventId} onClick={()=>setSelectedId(s.eventId)}><span className={s.result==="Made"?styles.resultMade:styles.resultMissed}>{s.result==="Made"?"●":"×"} {s.result==="Made"?copy.made:copy.missed}</span><strong>{s.playerName}</strong><span>{s.teamTricode} · {periodLabel(s.period)} · {formatCourtClock(s.clock)} · {s.value}{isZh?" 分":" PT"}</span></button></li>)}</ol>}
    </div>}
  </div>;
}
