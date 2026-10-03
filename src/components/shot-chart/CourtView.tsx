"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { ArrowLeft, ArrowRight, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { CourtShot } from "@/lib/court-shots";
import { courtToSvg, formatCourtClock, nearestShot, type ProjectedShot } from "./court-geometry";
import type { CourtCopy } from "./court-copy";
import type { CourtFrame, CourtRenderer } from "./court-renderer";
import TopDownSurface from "./TopDownSurface";
import styles from "./shot-court.module.css";

const ShotMark=memo(function ShotMark({made,selected,x,y}: {made:boolean;selected:boolean;x:number;y:number}) {
  return <g transform={`translate(${x} ${y})`} opacity={selected?1:.85}>
    {selected && <><circle r="13" fill="#fff" fillOpacity=".22"/><circle r="8.5" fill="none" stroke="#fff" strokeWidth="2"/></>}
    {made ? <circle r={selected?4.5:3} fill="#07836c" stroke="#f4fff9" strokeWidth={selected?1.3:.75} /> : <path d={selected?"M-3.5-3.5 3.5 3.5 M-3.5 3.5 3.5-3.5":"M-2.2-2.2 2.2 2.2 M-2.2 2.2 2.2-2.2"} fill="none" stroke="#bf513a" strokeWidth={selected?2.2:1.65} strokeLinecap="round" />}
  </g>;
});

export default function CourtView({shots, selectedId, onSelect, copy}: {shots:readonly CourtShot[]; selectedId:number|null;onSelect:(id:number)=>void;copy:CourtCopy}) {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const rendererRef=useRef<CourtRenderer|null>(null);
  const shotsRef=useRef(shots);
  const [frame,setFrame]=useState<CourtFrame|null>(null);
  const [state,setState]=useState<"flat"|"loading"|"ready"|"fallback">("flat");
  const [enable3D,setEnable3D]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const [hovered,setHovered]=useState<{id:number;x:number;y:number}|null>(null);
  const drag=useRef<{id:number;x:number;y:number;lastX:number;lastY:number;moved:boolean;touch:boolean}|null>(null);
  const updateFrame=useCallback((next:CourtFrame)=>setFrame(next),[]);
  useEffect(()=>{shotsRef.current=shots;rendererRef.current?.setShots(shots);},[shots]);
  useEffect(()=>{
    // Top-down is the complete default product. No import, WebGL probe or GPU
    // allocation happens until the user explicitly chooses the optional view.
    if(!enable3D)return;
    const canvas=canvasRef.current;if(!canvas)return;
    let cancelled=false, instance:CourtRenderer|null=null, resize:ResizeObserver|undefined, theme:MutationObserver|undefined;
    const lost=(event:Event)=>{event.preventDefault();cleanup();setFrame(null);setState("fallback");};
    const resizeCourt=()=>rendererRef.current?.resize();
    const cleanup=()=>{
      canvas.removeEventListener("webglcontextlost",lost);window.removeEventListener("resize",resizeCourt);
      resize?.disconnect();theme?.disconnect();instance?.dispose();
      if(rendererRef.current===instance)rendererRef.current=null;instance=null;
    };
    canvas.addEventListener("webglcontextlost",lost);window.addEventListener("resize",resizeCourt);
    import("./court-renderer").then(({createCourtRenderer})=>{
      if(cancelled)return;
      const renderer=createCourtRenderer(canvas,updateFrame);instance=renderer;rendererRef.current=renderer;
      renderer.setShots(shotsRef.current);renderer.setTheme(document.documentElement.dataset.theme==="light");renderer.resize();
      resize=new ResizeObserver(()=>renderer.resize());resize.observe(canvas);
      theme=new MutationObserver(()=>renderer.setTheme(document.documentElement.dataset.theme==="light"));
      theme.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});setState("ready");
    }).catch(()=>{cleanup();if(!cancelled){setState("fallback");setFrame(null);}});
    return ()=>{cancelled=true;cleanup();};
  },[attempt,enable3D,updateFrame]);
  const flat=state!=="ready";
  const width=flat?540:frame?.width??540, height=flat?528:frame?.height??510;
  const originY=flat?-9:0;
  const points:ProjectedShot[]=useMemo(()=>flat?shots.map(s=>{const[x,y]=courtToSvg(s.xFeet,s.yFeet);return {eventId:s.eventId,x,y,visible:true};}):frame?.points??[],[flat,shots,frame]);
  const byId=useMemo(()=>new Map(shots.map(s=>[s.eventId,s])),[shots]);
  const markerLayer=useMemo(()=>points.map(p=>{const s=byId.get(p.eventId);return s&&p.visible&&<ShotMark key={p.eventId} made={s.result==="Made"} selected={false} x={p.x} y={p.y}/>;}),[points,byId]);
  const hoverShot=hovered?byId.get(hovered.id):undefined;
  function localPoint(e:PointerEvent<SVGSVGElement>){
    const rect=e.currentTarget.getBoundingClientRect();
    const scale=Math.min(rect.width/width,rect.height/height);
    return {x:(e.clientX-rect.left-(rect.width-width*scale)/2)/scale,y:(e.clientY-rect.top-(rect.height-height*scale)/2)/scale+originY,scale,rect};
  }
  function hit(e:PointerEvent<SVGSVGElement>){
    const p=localPoint(e);
    const order=selectedId===null?points:[...points.filter(point=>point.eventId!==selectedId),...points.filter(point=>point.eventId===selectedId)];
    return nearestShot(order,p.x,p.y,(e.pointerType==="touch"?22:11)/p.scale);
  }
  const onDown=(e:PointerEvent<SVGSVGElement>)=>{
    if(e.button!==0)return;
    drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,touch:e.pointerType==="touch"};
  };
  const onMove=(e:PointerEvent<SVGSVGElement>)=>{
    const d=drag.current;
    if(!d){
      if(e.pointerType!=="touch"){
        const id=hit(e),rect=e.currentTarget.getBoundingClientRect();
        setHovered(old=>id===null?null:old?.id===id?old:{id,x:Math.min(Math.max(12,e.clientX-rect.left+14),Math.max(12,rect.width-224)),y:Math.max(12,e.clientY-rect.top-72)});
      }
      return;
    }
    if(d.id!==e.pointerId||flat)return;
    const dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(!d.moved&&Math.hypot(dx,dy)<6)return;
    if(d.touch&&!d.moved&&Math.abs(dy)>Math.abs(dx)){drag.current=null;return;}
    d.moved=true;setHovered(null);e.currentTarget.setPointerCapture(e.pointerId);
    rendererRef.current?.orbit(-(e.clientX-d.lastX)*.007,d.touch?0:(e.clientY-d.lastY)*.004);
    d.lastX=e.clientX;d.lastY=e.clientY;
  };
  const onUp=(e:PointerEvent<SVGSVGElement>)=>{
    const d=drag.current;drag.current=null;
    if(!d||d.id!==e.pointerId||d.moved||Math.hypot(e.clientX-d.x,e.clientY-d.y)>6)return;
    const id=hit(e);if(id!==null){onSelect(id);setHovered(null);}
  };
  function open3D(){if(state==="ready"||state==="loading")return;setHovered(null);setState("loading");setFrame(null);setEnable3D(true);setAttempt(n=>n+1);}
  function topDown(){setEnable3D(false);setState("flat");setFrame(null);setHovered(null);}
  return <div className={`${styles.visual} ${flat?styles.flatVisual:""}`}>
    <div className={styles.toolbar} aria-label={copy.view}>
      <div className={styles.viewModes}>
        <button type="button" aria-pressed={flat} onClick={topDown}>{copy.top}</button>
        <button type="button" aria-pressed={!flat} disabled={state==="loading"} onClick={open3D}>{copy.three}</button>
      </div>
      {!flat&&<>
        <div className={styles.cameraButtons}>
          <button type="button" aria-label={copy.rotateLeft} title={copy.rotateLeft} onClick={()=>rendererRef.current?.orbit(-.25)}><ArrowLeft size={16}/></button>
          <button type="button" aria-label={copy.rotateRight} title={copy.rotateRight} onClick={()=>rendererRef.current?.orbit(.25)}><ArrowRight size={16}/></button>
          <button type="button" aria-label={copy.zoomOut} title={copy.zoomOut} onClick={()=>rendererRef.current?.zoom(1.12)}><ZoomOut size={16}/></button>
          <button type="button" aria-label={copy.zoomIn} title={copy.zoomIn} onClick={()=>rendererRef.current?.zoom(1/1.12)}><ZoomIn size={16}/></button>
        </div>
        <button className={styles.resetView} type="button" aria-label={copy.reset} title={copy.reset} onClick={()=>rendererRef.current?.reset()}><RotateCcw size={15}/></button>
      </>}
      {flat&&<span className={styles.courtCaption}>{copy.recordedPositions}</span>}
    </div>
    <div className={styles.viewport} data-court-state={state}>
      {enable3D&&<canvas key={attempt} ref={canvasRef} className={styles.canvas} aria-hidden="true" style={{visibility:flat?"hidden":"visible"}}/>}
      <svg className={styles.overlay} viewBox={`0 ${originY} ${width} ${height}`} role="img" aria-label={`${copy.view}. ${shots.length} ${copy.attempts}. ${copy.legend}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={e=>{setHovered(null);if(flat||!e.currentTarget.hasPointerCapture(e.pointerId))drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;setHovered(null);}}>
        <title>{copy.view}</title><desc>{copy.normalized} {copy.legend}</desc>
        {flat&&<TopDownSurface/>}
        {markerLayer}
        {points.filter(p=>(p.eventId===selectedId||p.eventId===hovered?.id)&&p.visible).map(p=><ShotMark key={`selected-${p.eventId}`} made={byId.get(p.eventId)?.result==="Made"} selected x={p.x} y={p.y}/>)}
      </svg>
      {hoverShot&&hovered&&<div className={styles.hoverCard} role="tooltip" style={{left:hovered.x,top:hovered.y}}><strong>{hoverShot.playerName}</strong><span>{hoverShot.teamTricode} · {hoverShot.period>4?`${copy.overtime}${hoverShot.period-4}`:`Q${hoverShot.period}`} · {formatCourtClock(hoverShot.clock)} · {hoverShot.value}PT</span><span className={hoverShot.result==="Made"?styles.resultMade:styles.resultMissed}>{hoverShot.result==="Made"?"●":"×"} {hoverShot.result==="Made"?copy.made:copy.missed}</span></div>}
      {shots.length===0&&<p className={styles.noShots}>{copy.noShots}</p>}
    </div>
    <div className={styles.hint}>{state==="loading"?copy.loading:state==="fallback"?<><span>{copy.fallback}</span><button type="button" onClick={open3D}>{copy.retry}</button></>:state==="flat"?copy.flatHelp:copy.help}</div>
  </div>;
}
