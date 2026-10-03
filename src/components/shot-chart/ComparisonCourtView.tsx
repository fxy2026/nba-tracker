"use client";

import { memo, useMemo, useRef, useState, type PointerEvent } from "react";
import type { CourtShot, CourtShotTeam } from "@/lib/court-shots";
import { formatCourtClock, nearestShot } from "./court-geometry";
import { comparisonViewBox, keyboardShotId, projectComparisonShot, type CourtFocus } from "./comparison-geometry";
import type { CourtCopy } from "./court-copy";
import FullCourtSurface from "./FullCourtSurface";
import TopDownSurface from "./TopDownSurface";
import styles from "./shot-court.module.css";

const ComparisonMark = memo(function ComparisonMark({ shot, x, y, color, selected = false }: { shot: CourtShot; x: number; y: number; color: string; selected?: boolean }) {
  return <g transform={`translate(${x} ${y})`} data-shot-id={selected ? undefined : shot.eventId}>
    {selected && <><circle r="10" fill="#fff7e7" fillOpacity=".8"/><circle r="8" stroke="#142f3b" strokeWidth="1.8" fill="none"/></>}
    <circle className={styles.comparisonGlyph} r={selected ? 4.3 : 3.7} fill={shot.result === "Made" ? color : "#ead2a8"} fillOpacity={shot.result === "Made" ? .92 : .85} stroke={color} strokeWidth={shot.result === "Made" ? .65 : 1.6}/>
  </g>;
});

export default function ComparisonCourtView({ shots, selectedId, onSelect, focus, away, home, awayColor, homeColor, copy }: {
  shots: readonly CourtShot[]; selectedId: number | null; onSelect: (id: number | null) => void; focus: CourtFocus;
  away: CourtShotTeam; home: CourtShotTeam; awayColor: string; homeColor: string; copy: CourtCopy;
}) {
  const [hovered, setHovered] = useState<{ id: number; x: number; y: number } | null>(null);
  const press = useRef<{ id: number; x: number; y: number } | null>(null);
  const points = useMemo(() => shots.map(shot => { const [x,y] = projectComparisonShot(shot,away.teamId,focus); return { eventId: shot.eventId, x, y, visible: true }; }),[shots,away.teamId,focus]);
  const view = useMemo(() => comparisonViewBox(points.map(p=>[p.x,p.y]),focus),[points,focus]);
  const byId = useMemo(() => new Map(shots.map(shot=>[shot.eventId,shot])),[shots]);
  const color = (shot: CourtShot) => shot.teamId === away.teamId ? awayColor : homeColor;
  const marks = useMemo(() => points.map(point => { const shot=byId.get(point.eventId)!; return <ComparisonMark key={shot.eventId} shot={shot} x={point.x} y={point.y} color={shot.teamId===away.teamId?awayColor:homeColor}/>; }),[points,byId,away.teamId,awayColor,homeColor]);
  const hoverShot = hovered ? byId.get(hovered.id) : undefined;
  const periodLabel = (period: number) => period > 4 ? `${copy.overtime}${period-4}` : copy.quarter === "第" ? `第 ${period} 节` : `Q${period}`;
  function hit(event: PointerEvent<SVGSVGElement>) {
    const rect=event.currentTarget.getBoundingClientRect();
    const scale=Math.min(rect.width/view.width,rect.height/view.height);
    const x=(event.clientX-rect.left-(rect.width-view.width*scale)/2)/scale+view.x;
    const y=(event.clientY-rect.top-(rect.height-view.height*scale)/2)/scale+view.y;
    // Selected point takes ties, but keyboard/list navigation reaches overlaps.
    const order=selectedId===null?points:[...points.filter(p=>p.eventId!==selectedId),...points.filter(p=>p.eventId===selectedId)];
    return nearestShot(order,x,y,(event.pointerType==="touch"?22:10)/scale);
  }
  return <div className={`${styles.comparisonVisual} ${focus!=="full"?styles.focusVisual:""}`}>
    <div className={styles.comparisonViewport} data-court-state="flat" data-court-focus={focus} style={{aspectRatio:`${view.width} / ${view.height}`}}>
      <svg className={styles.comparisonOverlay} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="group" tabIndex={0} aria-label={`${copy.view}. ${shots.length} ${copy.attempts}. ${copy.comparisonLegend} ${copy.keyboardHelp}`}
        onKeyDown={event=>{const id=keyboardShotId(shots,selectedId,event.key);if(id!==undefined){event.preventDefault();setHovered(null);onSelect(id);}}}
        onPointerDown={event=>{if(event.button===0)press.current={id:event.pointerId,x:event.clientX,y:event.clientY};}}
        onPointerMove={event=>{if(event.pointerType==="touch"||press.current)return;const id=hit(event),rect=event.currentTarget.getBoundingClientRect();setHovered(old=>id===null?null:old?.id===id?old:{id,x:Math.min(Math.max(8,event.clientX-rect.left+12),Math.max(8,rect.width-220)),y:Math.max(8,event.clientY-rect.top-76)});}}
        onPointerUp={event=>{const down=press.current;press.current=null;if(!down||down.id!==event.pointerId||Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)return;const id=hit(event);if(id!==null){onSelect(id);setHovered(null);}}}
        onPointerLeave={()=>{press.current=null;setHovered(null);}} onPointerCancel={()=>{press.current=null;setHovered(null);}}>
        <title>{focus==="full"?copy.fullCourt:copy.halfCourt}</title><desc>{copy.standardized} {copy.comparisonLegend}</desc>
        {focus==="full"?<FullCourtSurface awayColor={awayColor} homeColor={homeColor} awayName={away.teamTricode} homeName={home.teamTricode}/>:<TopDownSurface/>}
        {marks}
        {points.filter(point=>point.eventId===selectedId||point.eventId===hovered?.id).map(point=>{const shot=byId.get(point.eventId)!;return <ComparisonMark key={`active-${shot.eventId}`} shot={shot} x={point.x} y={point.y} color={color(shot)} selected/>;})}
      </svg>
      {hoverShot&&hovered&&<div className={styles.hoverCard} role="tooltip" style={{left:hovered.x,top:hovered.y}}><strong>{hoverShot.playerName}</strong><span>{hoverShot.teamTricode} · {periodLabel(hoverShot.period)} · {formatCourtClock(hoverShot.clock)} · {hoverShot.value}{copy.quarter === "第" ? " 分" : " PT"}</span><span>{hoverShot.result==="Made"?"●":"○"} {hoverShot.result==="Made"?copy.made:copy.missed}</span></div>}
      {shots.length===0&&<p className={styles.noShots}>{copy.noShots}</p>}
    </div>
    <div className={styles.comparisonHint}><span>{copy.flatHelp}</span><span>{focus==="full"?copy.focusHint:copy.halfHint}</span></div>
  </div>;
}
