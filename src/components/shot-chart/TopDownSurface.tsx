import { memo, useId } from "react";
import { COURT, courtLines, courtToSvg } from "./court-geometry";

/** A useful, fully vector fallback with the same regulation lines and origin. */
export default memo(function TopDownSurface() {
  const id = useId().replace(/:/g, "");
  return <g>
    <defs>
      <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#d7b98b"/><stop offset=".46" stopColor="#cba978"/><stop offset="1" stopColor="#b38a5a"/>
      </linearGradient>
      <linearGradient id={`${id}-paint`} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#263f50"/><stop offset="1" stopColor="#395668"/>
      </linearGradient>
      <pattern id={`${id}-boards`} width="40" height="180" patternUnits="userSpaceOnUse">
        <path d="M0 0V180 M20 0V180 M0 62H20 M20 136H40" stroke="#68492f" strokeOpacity=".18" strokeWidth=".65"/>
        <path d="M7 0V180 M13 0V180 M27 0V180 M33 0V180" stroke="#fff1d6" strokeOpacity=".10" strokeWidth=".6"/>
        <path d="M2 0H18V180H2Z" fill="#fff2d8" fillOpacity=".045"/>
      </pattern>
      <radialGradient id={`${id}-light`} cx=".3" cy=".15" r=".9">
        <stop stopColor="#fff0d0" stopOpacity=".2"/><stop offset="1" stopColor="#442712" stopOpacity=".06"/>
      </radialGradient>
    </defs>
    <rect x="1" y="5" width="538" height="505" rx="10" fill="#121f2a"/>
    <rect x="1" y="1" width="538" height="504" rx="10" fill="#263c4d" stroke="#7c8b92" strokeOpacity=".4"/>
    <rect x="20" y="20" width="500" height="470" fill={`url(#${id}-wood)`}/>
    <rect x="20" y="20" width="500" height="470" fill={`url(#${id}-boards)`}/>
    <rect x="190" y="20" width="160" height="190" fill={`url(#${id}-paint)`}/>
    <rect x="20" y="20" width="500" height="470" fill={`url(#${id}-light)`}/>
    <g fill="none" stroke="#f6eddb" strokeWidth="1.65" strokeLinejoin="round">
      {courtLines().map((line,i)=><polyline key={i} points={line.points.map(([x,y])=>courtToSvg(x,y).map(n=>Number(n.toFixed(2))).join(",")).join(" ")} strokeDasharray={line.dashed?"7 7":undefined}/>)}
    </g>
    <path d={`M239 ${courtToSvg(0,-1.25)[1]+2} h62`} stroke="#18232d" strokeOpacity=".35" strokeWidth="6"/>
    <path d={`M240 ${courtToSvg(0,-1.25)[1]} h60`} stroke="#edf7ff" strokeWidth="3"/>
    <circle cx="270" cy={courtToSvg(0,0)[1]} r="7.5" stroke="#f86e34" strokeWidth="2.5" fill="none"/>
    <text x="270" y={courtToSvg(0,COURT.midcourt)[1]+12} textAnchor="middle" fill="#b1bcc1" fontSize="7" fontFamily="sans-serif" letterSpacing="2.5">NBA TRACKER</text>
  </g>;
});
