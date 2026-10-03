import { memo, useId } from "react";
import { courtLines } from "./court-geometry";
import { comparisonToSvg } from "./comparison-geometry";

/** Static, memoized regulation geometry. All decoration is original vector art. */
export default memo(function FullCourtSurface({ awayColor, homeColor, awayName, homeName }: { awayColor: string; homeColor: string; awayName: string; homeName: string }) {
  const id = useId().replace(/:/g, "");
  return <g aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-maple`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ead5ae"/><stop offset=".52" stopColor="#ddbe8c"/><stop offset="1" stopColor="#cfa872"/></linearGradient>
      <pattern id={`${id}-planks`} width="180" height="40" patternUnits="userSpaceOnUse">
        <path d="M0 0H180 M0 20H180 M55 0V20 M140 20V40" fill="none" stroke="#67462b" strokeOpacity=".14" strokeWidth=".8"/>
        <path d="M0 4H180 M0 13H180 M0 24H180 M0 35H180" stroke="#fff7df" strokeOpacity=".15" strokeWidth=".7"/>
        <path d="M0 1H180V19H0Z" fill="#fff3d8" fillOpacity=".055"/>
      </pattern>
      <linearGradient id={`${id}-light`}><stop stopColor="#fff9df" stopOpacity=".12"/><stop offset="1" stopColor="#fff9df" stopOpacity="0"/></linearGradient>
    </defs>
    <rect x="5" y="5" width="990" height="550" rx="15" fill="#24343f"/>
    <rect x="30" y="30" width="940" height="500" fill={`url(#${id}-maple)`}/>
    <rect x="30" y="30" width="940" height="500" fill={`url(#${id}-planks)`}/>
    <rect x="30" y="200" width="190" height="160" fill={awayColor} fillOpacity=".12"/>
    <rect x="780" y="200" width="190" height="160" fill={homeColor} fillOpacity=".12"/>
    <rect x="30" y="30" width="940" height="500" fill={`url(#${id}-light)`}/>
    <g fill="none" stroke="#33434a" strokeOpacity=".57" strokeWidth="1.55" strokeLinejoin="round">
      {(["away", "home"] as const).flatMap(side => courtLines().map((line, i) => <polyline key={`${side}-${i}`} points={line.points.map(([x,y]) => comparisonToSvg(x,y,side).map(n=>Number(n.toFixed(3))).join(",")).join(" ")} strokeDasharray={line.dashed?"5 6":undefined}/>))}
    </g>
    {(["away", "home"] as const).map(side => {
      const [x,y] = comparisonToSvg(0,0,side);
      const boardX = comparisonToSvg(0,-1.25,side)[0];
      return <g key={side}><path d={`M${boardX} ${y-30}v60`} stroke="#f9f4e8" strokeWidth="4"/><circle cx={x} cy={y} r="7.5" stroke="#a7432a" strokeWidth="2.7" fill="none"/></g>;
    })}
    <circle cx="500" cy="280" r="48" fill="#dfc296" fillOpacity=".9"/>
    <path d="M489 267v26m0-26 22 26v-26" fill="none" stroke="#34434c" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="500" y="313" textAnchor="middle" fill="#34434c" fontSize="7.5" fontFamily="sans-serif" fontWeight="700" letterSpacing="1.6">NBA TRACKER</text>
    <text x="250" y="20" textAnchor="middle" fill="#d5dfe1" fontSize="9" fontFamily="sans-serif" letterSpacing="2.4">{awayName}</text>
    <text x="750" y="20" textAnchor="middle" fill="#d5dfe1" fontSize="9" fontFamily="sans-serif" letterSpacing="2.4">{homeName}</text>
    <path d="M34 545H240" stroke={awayColor} strokeWidth="2.5"/><path d="M760 545H966" stroke={homeColor} strokeWidth="2.5"/>
    <text x="500" y="546" textAnchor="middle" fill="#bdc8cc" fontSize="7.5" fontFamily="sans-serif" letterSpacing="2">STANDARDIZED SHOT COMPARISON</text>
  </g>;
});
