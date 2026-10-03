import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import schedule from "@/data/schedule-2025-26.json";
import { LocaleProvider } from "@/components/LocaleProvider";
import ShotChartExplorer from "@/components/ShotChartExplorer";
import { comparisonFeet, comparisonToSvg, comparisonViewBox, compareCourtShots, EMPTY_COMPARISON_FILTERS, keyboardShotId, projectComparisonShot } from "@/components/shot-chart/comparison-geometry";
import { courtToSvg, courtLines } from "@/components/shot-chart/court-geometry";
import { getVerifiedShotChart } from "./verified-shot-chart-archive";
const games=schedule.dates.flatMap(date=>date.games);
const charts=["0022500961","0042500405","0042500173","0042500401","0042500402","0042500403","0042500404"].map(id=>getVerifiedShotChart(games.find(game=>game.gameId===id)!)!);

describe("full-court standardized rigid transform",()=>{
  it("maps baskets, baselines, sidelines and midcourt exactly in regulation feet",()=>{
    expect(comparisonFeet(0,0,"away")).toEqual([5.25,25]);expect(comparisonFeet(0,0,"home")).toEqual([88.75,25]);
    expect(comparisonFeet(25,-5.25,"away")).toEqual([0,0]);expect(comparisonFeet(-25,-5.25,"away")).toEqual([0,50]);
    expect(comparisonFeet(25,-5.25,"home")).toEqual([94,50]);expect(comparisonFeet(-25,-5.25,"home")).toEqual([94,0]);
    expect(comparisonFeet(0,41.75,"away")).toEqual([47,25]);expect(comparisonFeet(0,41.75,"home")).toEqual([47,25]);
    expect(comparisonToSvg(0,0,"away")).toEqual([82.5,280]);expect(comparisonToSvg(0,0,"home")).toEqual([917.5,280]);
  });
  it("preserves negative y, origin, long heaves and distances without clamping or jitter",()=>{
    for(const side of ["away","home"] as const)for(const [x,y] of [[0,0],[-22.4,-1.2],[22.4,-1.2],[35,55],[-30,-8]]){
      const [px,py]=comparisonFeet(x,y,side);const [hx,hy]=comparisonFeet(0,0,side);
      expect(Math.hypot(px-hx,py-hy)).toBeCloseTo(Math.hypot(x,y));
      const inverse=side==="away"?[25-py,px-5.25]:[py-25,88.75-px];expect(inverse[0]).toBeCloseTo(x);expect(inverse[1]).toBeCloseTo(y);
    }
    expect(comparisonFeet(0,-1.2,"away")[0]).toBe(4.05);
    expect(comparisonFeet(0,-1.2,"home")[0]).toBe(89.95);
    const view=comparisonViewBox([[-30,580],[1040,-20]],"full");
    expect(view).toEqual({x:-40,y:-30,width:1090,height:620});
  });
  it("rotates the same geometry used by shot coordinates, including the three-point join",()=>{
    const lines=courtLines();
    for(const side of ["away","home"] as const){
      const join=comparisonToSvg(...lines[6].points.at(-1)!,side),arc=comparisonToSvg(...lines[7].points[0],side);
      expect(join[0]).toBeCloseTo(arc[0]);expect(join[1]).toBeCloseTo(arc[1]);
    }
  });
  it.each(charts)("preserves every one of $coverage.total source shots and makes both teams independently filterable",data=>{
    const before=JSON.stringify(data),all=compareCourtShots(data,EMPTY_COMPARISON_FILTERS);
    expect(all.shots).toEqual(data.shots);expect(all.away.shots.length+all.home.shots.length).toBe(data.coverage.total);
    for(const side of ["away","home"] as const){
      const rows=data.shots.filter(shot=>shot.teamId===data[side].teamId);
      expect(all[side].summary.attempted).toBe(rows.length);expect(all[side].summary.made).toBe(rows.filter(shot=>shot.result==="Made").length);
      for(const shot of rows){
        expect(projectComparisonShot(shot,data.away.teamId,"full")).toEqual(comparisonToSvg(shot.xFeet,shot.yFeet,side));
        expect(projectComparisonShot(shot,data.away.teamId,side)).toEqual(courtToSvg(shot.xFeet,shot.yFeet));
      }
    }
    const awayPlayer=all.away.shots[0].personId,homePlayer=all.home.shots[0].personId;
    const filters={awayPlayer:String(awayPlayer),homePlayer:String(homePlayer),period:"1",result:"Made"};
    const made=compareCourtShots(data,filters),both=compareCourtShots(data,{...filters,result:"all"});
    expect(made.away.summary).toEqual(both.away.summary);expect(made.home.summary).toEqual(both.home.summary);
    expect(made.shots.every(shot=>shot.result==="Made"&&shot.period===1&&[awayPlayer,homePlayer].includes(shot.personId))).toBe(true);
    expect(JSON.stringify(data)).toBe(before);
  });
  it("keeps exact per-team OT counts and honest all-result FG when only makes are shown",()=>{
    const data=charts[2];const all=compareCourtShots(data,{...EMPTY_COMPARISON_FILTERS,period:"5"});
    const made=compareCourtShots(data,{...EMPTY_COMPARISON_FILTERS,period:"5",result:"Made"});
    expect(all.shots).toHaveLength(15);expect(made.shots).toHaveLength(5);
    expect(made.away.summary).toEqual(all.away.summary);expect(made.home.summary).toEqual(all.home.summary);
    expect(all.away.summary.attempted+all.home.summary.attempted).toBe(15);
    expect(all.away.summary.made+all.home.summary.made).toBe(5);
    expect(compareCourtShots(data,{...EMPTY_COMPARISON_FILTERS,period:"99"}).away.summary).toMatchObject({made:0,attempted:0});
  });
  it("keyboard browsing reaches every record including exact overlaps and clears safely",()=>{
    const shots=charts[0].shots;let id:number|null=null;
    for(const shot of shots){id=keyboardShotId(shots,id,"ArrowRight")!;expect(id).toBe(shot.eventId);}
    expect(keyboardShotId(shots,id,"ArrowRight")).toBe(id);expect(keyboardShotId(shots,id,"Home")).toBe(shots[0].eventId);
    expect(keyboardShotId(shots,null,"End")).toBe(shots.at(-1)!.eventId);expect(keyboardShotId(shots,id,"Escape")).toBeNull();
    expect(keyboardShotId([],null,"ArrowRight")).toBeUndefined();expect(keyboardShotId(shots,id,"Tab")).toBeUndefined();
  });
  it.each(["en","zh"] as const)("SSR contains all points, dual selectors, focus and source disclosure without any rendering engine (%s)",locale=>{
    const data=charts[2],html=renderToStaticMarkup(<LocaleProvider initialLocale={locale}><ShotChartExplorer data={data}/></LocaleProvider>);
    expect((html.match(/data-shot-id=/g)||[])).toHaveLength(177);
    expect(html).toContain('data-court-focus="full"');expect(html).toContain('tabindex="0"');expect(html).toContain('viewBox="0 0 1000 560"');
    expect(html).toContain('aria-label="LAL '+(locale==="en"?"Player":"球员")+'"');expect(html).toContain('aria-label="HOU '+(locale==="en"?"Player":"球员")+'"');
    expect(html).toContain(`role="combobox" aria-label="${locale === "en" ? "Period" : "节次"}"`); // OT option labels/selection are covered by the component-handler suite.
    expect(html).not.toContain("Q5");
    expect(html).toContain(locale==="en"?"not actual attacking direction":"不代表比赛实际进攻方向");expect(html).toContain(data.source.url);
    expect(html).toContain(locale==="en"?"Hollow circles":"空心圆");expect(html).not.toContain("<canvas");
    for(const file of ["src/components/ShotChartExplorer.tsx","src/components/shot-chart/ComparisonCourtView.tsx","src/components/shot-chart/FullCourtSurface.tsx","src/components/shot-chart/comparison-geometry.ts"]){
      const source=readFileSync(file,"utf8");expect(source).not.toMatch(/(?:from|import\()[^\n]*(?:three|court-renderer|\/CourtView["'])/);expect(source).not.toMatch(/getContext|requestAnimationFrame|setAnimationLoop/);
    }
  });
});
