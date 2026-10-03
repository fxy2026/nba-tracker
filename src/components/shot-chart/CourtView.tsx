"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowLeft, ArrowRight, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { CourtShot } from "@/lib/court-shots";
import { COURT, courtLines, courtToSvg, nearestShot, type ProjectedShot } from "./court-geometry";
import type { CourtCopy } from "./court-copy";
import type { CourtFrame, CourtRenderer } from "./court-renderer";
import styles from "./shot-court.module.css";

function ShotMark({made,selected,x,y}: {made:boolean;selected:boolean;x:number;y:number}) {
  return <g transform={`translate(${x} ${y})`}>
    {selected && <circle r="10" fill="none" stroke="#fff" strokeWidth="2.5" />}
    {made ? <circle r="4.6" fill="#16a984" stroke="#f3fffa" strokeWidth="1.3" /> : <path d="M-3.5-3.5 3.5 3.5 M-3.5 3.5 3.5-3.5" fill="none" stroke="#ef654f" strokeWidth="2.4" strokeLinecap="round" style={{paintOrder:"stroke",filter:"drop-shadow(0 0 1px #fff)"}} />}
  </g>;
}

export default function CourtView({shots, selectedId, onSelect, copy}: {shots:readonly CourtShot[]; selectedId:number|null;onSelect:(id:number)=>void;copy:CourtCopy}) {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const rendererRef=useRef<CourtRenderer|null>(null);
  const shotsRef=useRef(shots);
  const [frame,setFrame]=useState<CourtFrame|null>(null);
  const [state,setState]=useState<"loading"|"ready"|"fallback">("loading");
  const [view,setView]=useState<"3d"|"top">("3d");
  const [attempt,setAttempt]=useState(0);
  const drag=useRef<{id:number;x:number;y:number;lastX:number;lastY:number;moved:boolean;touch:boolean}|null>(null);
  const updateFrame=useCallback((next:CourtFrame)=>setFrame(next),[]);
  useEffect(()=>{shotsRef.current=shots;rendererRef.current?.setShots(shots);},[shots]);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    let cancelled=false, instance:CourtRenderer|null=null, resize:ResizeObserver|undefined, theme:MutationObserver|undefined;
    const lost=(event:Event)=>{event.preventDefault();cleanup();setFrame(null);setState("fallback");};
    const resizeCourt=()=>rendererRef.current?.resize();
    const cleanup=()=>{
      canvas.removeEventListener("webglcontextlost",lost);window.removeEventListener("resize",resizeCourt);
      resize?.disconnect();theme?.disconnect();instance?.dispose();
      if(rendererRef.current===instance)rendererRef.current=null;instance=null;
    };
    canvas.addEventListener("webglcontextlost",lost);
    window.addEventListener("resize",resizeCourt);
    import("./court-renderer").then(({createCourtRenderer})=>{
      if(cancelled)return;
      const renderer=createCourtRenderer(canvas,updateFrame);instance=renderer;rendererRef.current=renderer;
      renderer.setShots(shotsRef.current);
      renderer.setTheme(document.documentElement.dataset.theme==="light");renderer.resize();
      resize=new ResizeObserver(()=>renderer.resize());resize.observe(canvas);
      theme=new MutationObserver(()=>renderer.setTheme(document.documentElement.dataset.theme==="light"));
      theme.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
      setState("ready");
    }).catch(()=>{cleanup();if(!cancelled){setState("fallback");setFrame(null);}});
    return ()=>{cancelled=true;cleanup();};
  },[attempt,updateFrame]);
  const fallback=state!=="ready";
  const width=fallback?540:frame?.width??540, height=fallback?510:frame?.height??510;
  const points:ProjectedShot[]=fallback?shots.map(s=>{const[x,y]=courtToSvg(s.xFeet,s.yFeet);return {eventId:s.eventId,x,y,visible:true};}):frame?.points??[];
  const byId=new Map(shots.map(s=>[s.eventId,s]));
  const onDown=(e:PointerEvent<SVGSVGElement>)=>{
    if(e.button!==0)return;
    drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,touch:e.pointerType==="touch"};
  };
  const onMove=(e:PointerEvent<SVGSVGElement>)=>{
    const d=drag.current;if(!d||d.id!==e.pointerId||fallback)return;
    const dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(!d.moved&&Math.hypot(dx,dy)<6)return;
    // A vertical touch gesture belongs to the document, never to this chart.
    if(d.touch&&!d.moved&&Math.abs(dy)>Math.abs(dx)){drag.current=null;return;}
    d.moved=true;e.currentTarget.setPointerCapture(e.pointerId);
    rendererRef.current?.orbit(-(e.clientX-d.lastX)*.007,d.touch?0:(e.clientY-d.lastY)*.004);
    d.lastX=e.clientX;d.lastY=e.clientY;setView("3d");
  };
  const onUp=(e:PointerEvent<SVGSVGElement>)=>{
    const d=drag.current;drag.current=null;
    if(!d||d.id!==e.pointerId||d.moved||Math.hypot(e.clientX-d.x,e.clientY-d.y)>6)return;
    const rect=e.currentTarget.getBoundingClientRect();
    // SVG fallback uses meet letterboxing; project the pointer into the same viewport.
    const scale=Math.min(rect.width/width,rect.height/height);
    const x=(e.clientX-rect.left-(rect.width-width*scale)/2)/scale;
    const y=(e.clientY-rect.top-(rect.height-height*scale)/2)/scale;
    const pickingOrder=selectedId===null?points:[...points.filter(p=>p.eventId!==selectedId),...points.filter(p=>p.eventId===selectedId)];
    const id=nearestShot(pickingOrder,x,y,22/scale);if(id!==null)onSelect(id);
  };
  function changeView(mode:"3d"|"top"){setView(mode);if(mode==="top")rendererRef.current?.top();else rendererRef.current?.reset();}
  return <div className={styles.visual}>
    <div className={styles.toolbar} aria-label={copy.view}>
      <div className={styles.viewModes}>
        <button type="button" aria-pressed={view==="3d"&&!fallback} disabled={fallback} onClick={()=>changeView("3d")}>{copy.three}</button>
        <button type="button" aria-pressed={view==="top"||fallback} disabled={fallback} onClick={()=>changeView("top")}>{copy.top}</button>
      </div>
      <div className={styles.cameraButtons}>
        <button type="button" disabled={fallback} aria-label={copy.rotateLeft} title={copy.rotateLeft} onClick={()=>{rendererRef.current?.orbit(-.25);setView("3d");}}><ArrowLeft size={16}/></button>
        <button type="button" disabled={fallback} aria-label={copy.rotateRight} title={copy.rotateRight} onClick={()=>{rendererRef.current?.orbit(.25);setView("3d");}}><ArrowRight size={16}/></button>
        <button type="button" disabled={fallback} aria-label={copy.zoomOut} title={copy.zoomOut} onClick={()=>rendererRef.current?.zoom(1.12)}><ZoomOut size={16}/></button>
        <button type="button" disabled={fallback} aria-label={copy.zoomIn} title={copy.zoomIn} onClick={()=>rendererRef.current?.zoom(1/1.12)}><ZoomIn size={16}/></button>
        <button type="button" disabled={fallback} aria-label={copy.reset} title={copy.reset} onClick={()=>changeView("3d")}><RotateCcw size={16}/></button>
      </div>
    </div>
    <div className={styles.viewport} data-court-state={state}>
      <canvas key={attempt} ref={canvasRef} className={styles.canvas} aria-hidden="true" style={{visibility:fallback?"hidden":"visible"}} />
      <svg className={styles.overlay} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${copy.view}. ${shots.length} ${copy.attempts}. ${copy.legend}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={()=>{drag.current=null;}}>
        <title>{copy.view}</title><desc>{copy.normalized} {copy.legend}</desc>
        {fallback&&<g>
          <rect width="540" height="510" rx="5" fill="#bd945f"/>
          <rect x="190" y={courtToSvg(0,COURT.baseline)[1]} width="160" height="190" fill="#344c60"/>
          <g fill="none" stroke="#f7ead3" strokeWidth="1.5">{courtLines().map((line,i)=><polyline key={i} points={line.points.map(([x,y])=>courtToSvg(x,y).join(",")).join(" ")} strokeDasharray={line.dashed?"7 7":undefined}/>)}</g>
          <path d={`M240 ${courtToSvg(0,-1.25)[1]} h60`} stroke="#f8fafc" strokeWidth="3"/>
          <circle cx="270" cy={courtToSvg(0,0)[1]} r="7.5" stroke="#f86e34" strokeWidth="2.5" fill="none"/>
        </g>}
        {points.map(p=>{const s=byId.get(p.eventId);return s&&p.visible&&<ShotMark key={p.eventId} made={s.result==="Made"} selected={false} x={p.x} y={p.y}/>;})}
        {points.filter(p=>p.eventId===selectedId&&p.visible).map(p=><ShotMark key={`selected-${p.eventId}`} made={byId.get(p.eventId)?.result==="Made"} selected x={p.x} y={p.y}/>)}
      </svg>
      {shots.length===0&&<p className={styles.noShots}>{copy.noShots}</p>}
    </div>
    <div className={styles.hint}>{state==="loading"?copy.loading:state==="fallback"?<><span>{copy.fallback}</span><button type="button" onClick={()=>{setState("loading");setView("3d");setAttempt(n=>n+1);}}>{copy.retry}</button></>:copy.help}</div>
  </div>;
}
