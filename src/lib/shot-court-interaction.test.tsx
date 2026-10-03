import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/components/LocaleProvider";
import ShotChartExplorer from "@/components/ShotChartExplorer";
import { COURT, courtLines, courtToSvg, EMPTY_FILTERS, filterCourtShots, formatCourtClock, nearestShot } from "@/components/shot-chart/court-geometry";
import type { CourtShot, VerifiedShotChart } from "@/lib/court-shots";
import fs from "node:fs";
import path from "node:path";
const shot=(overrides:Partial<CourtShot>={}):CourtShot=>({eventId:20,personId:1,playerName:"Test Player",teamId:10,teamTricode:"AAA",period:1,clock:"PT11M11.00S",result:"Made",value:2,xFeet:-1.6,yFeet:1.1,...overrides});
const shots=[shot(),shot({eventId:22,personId:2,teamId:11,teamTricode:"BBB",period:2,result:"Missed",value:3,xFeet:22.4,yFeet:-1.2})];
const chart:VerifiedShotChart={gameId:"test-only",coordinateSystem:"nba-legacy-basket-feet",home:{teamId:10,teamTricode:"AAA",score:2},away:{teamId:11,teamTricode:"BBB",score:0},shots,coverage:{mapped:2,total:2,complete:true},source:{label:"NBA official game charts",url:"https://www.nba.com/",retrievedAt:"2026-10-03"}};
describe("3D shot court geometry and interaction",()=>{
  it("keeps NBA basket-relative left/right and negative behind-rim positions",()=>{
    const hoop=courtToSvg(0,0),left=courtToSvg(-12,8),right=courtToSvg(12,8),behind=courtToSvg(0,-1.2);
    expect(left[0]).toBeLessThan(hoop[0]);expect(right[0]).toBeGreaterThan(hoop[0]);expect(behind[1]).toBeLessThan(hoop[1]);
    expect(courtToSvg(35,55)[0]).toBeGreaterThan(540); // no clamping
    expect(COURT.hoopHeight).toBe(10);expect(COURT.right-COURT.left).toBe(50);
    expect(COURT.midcourt-COURT.baseline).toBe(47);
  });
  it("uses matching NBA three-point arc and corner joins",()=>{
    const lines=courtLines();const rightCorner=lines[6].points.at(-1)!;const arcStart=lines[7].points[0];
    expect(rightCorner[0]).toBeCloseTo(arcStart[0]);expect(rightCorner[1]).toBeCloseTo(arcStart[1]);
    expect(Math.hypot(...arcStart)).toBeCloseTo(23.75);
  });
  it("combines team, player, period, and result without mutating original points",()=>{
    expect(filterCourtShots(shots,EMPTY_FILTERS)).toEqual(shots);
    expect(filterCourtShots(shots,{teamId:"11",personId:"2",period:"2",result:"Missed"})).toEqual([shots[1]]);
    expect(filterCourtShots(shots,{...EMPTY_FILTERS,period:"4"})).toEqual([]);
    expect(shots[1].yFeet).toBe(-1.2);
  });
  it("picks the closest visible marker within a screen-space target",()=>{
    const points=[{eventId:20,x:30,y:40,visible:true},{eventId:22,x:37,y:40,visible:true},{eventId:24,x:38,y:40,visible:false}];
    expect(nearestShot(points,38,40)).toBe(22);expect(nearestShot([...points,{eventId:99,x:30,y:40,visible:true}],30,40)).toBe(99);expect(nearestShot(points,100,100)).toBeNull();
    expect(nearestShot(points,30,63)).toBeNull();
  });
  it("formats the source ISO game clock without claiming wall time",()=>{
    expect(formatCourtClock("PT11M11.00S")).toBe("11:11");expect(formatCourtClock("PT00M03.50S")).toBe("0:03.5");expect(formatCourtClock("0:05")).toBe("0:05");expect(formatCourtClock("PT00M03.95S")).toBe("0:03.95");
  });
  it("server-renders useful filters, source, coverage, and top-down points before WebGL",()=>{
    const html=renderToStaticMarkup(<LocaleProvider initialLocale="en"><ShotChartExplorer data={chart}/></LocaleProvider>);
    expect(html).toContain("Both teams");expect(html).toContain("All players");expect(html).toContain("2/2");expect(html).toContain("NBA official game charts");
    expect(html).toContain("not ball flight");expect(html).toContain("Browse every shot");expect(html).toContain("data-court-state=\"loading\"");expect(html).toContain("Solid circles: made. Crosses: missed.");
    expect(html).not.toContain("PT11M");
  });
  it("provides Chinese controls and explicit normalization copy",()=>{
    const html=renderToStaticMarkup(<LocaleProvider initialLocale="zh"><ShotChartExplorer data={chart}/></LocaleProvider>);
    expect(html).toContain("3D 球场");expect(html).toContain("两队统一朝向同一篮筐");expect(html).toContain("查看逐次投篮");
  });
  it("keeps server archives outside client imports and lazy-loads Three",()=>{
    const view=fs.readFileSync(path.resolve("src/components/shot-chart/CourtView.tsx"),"utf8");
    const renderer=fs.readFileSync(path.resolve("src/components/shot-chart/court-renderer.ts"),"utf8");
    expect(view).toContain('import("./court-renderer")');expect(view).toContain('webglcontextlost');expect(view).toContain('}).catch(()=>{cleanup();');expect(view).toContain('new ResizeObserver');
    expect(renderer).toContain('powerPreference:"low-power"');expect(renderer).toContain('window.devicePixelRatio || 1,1.5');
    expect(renderer).not.toContain('setAnimationLoop');expect(renderer).not.toContain('https://');
    for(const file of [view,renderer,fs.readFileSync(path.resolve("src/components/ShotChartExplorer.tsx"),"utf8")]) expect(file).not.toMatch(/from ["'][^"']*(?:archive|src\/data)/);
  });
});
