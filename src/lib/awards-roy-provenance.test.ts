import { beforeEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CURRENT_SEASON } from "./constants";
import { getTranslations } from "@/locales";
const state=vi.hoisted(()=>({index:0,values:[] as unknown[]}));
vi.mock("react",async original=>({...await original<typeof import("react")>(),useState:()=>[state.values[state.index++],vi.fn()],useEffect:()=>{},useMemo:(fn:()=>unknown)=>fn()}));
vi.mock("@/components/LocaleProvider",()=>({useLocale:()=>({locale:"en",t:getTranslations("en")})}));
import AwardsRaceClient from "@/app/awards-race/AwardsRaceClient";
const provenance={source:"nba-cdn",season:CURRENT_SEASON,stale:false,retrievedAt:null};
const indexPlayer={personId:1,firstName:"Rookie",lastName:"One",fromYear:CURRENT_SEASON.slice(0,4),toYear:CURRENT_SEASON.slice(0,4),draftYear:null};
const row={PLAYER_ID:1,PLAYER:"Rookie One",TEAM:"BOS",GP:20,MIN:25,PTS:10,REB:3,AST:2,STL:1,BLK:1,FG_PCT:.5,FG3_PCT:.3,EFF:10};
beforeEach(()=>{state.index=0;});
function render(meta:unknown,players:unknown[]=[indexPlayer],stats:unknown[]=[row,{...row,PLAYER_ID:2,PLAYER:"Veteran Two",PTS:50}]){
 state.values=[stats,{players,provenance:meta},false,"roy"];return renderToStaticMarkup(createElement(AwardsRaceClient,{mvpSeasons:[]}));
}
it.each([null,{...provenance,season:"2025-26"},{...provenance,stale:true},{...provenance,source:"bundled-archive"}])("ROY fails closed for %j rather than ranking veterans",meta=>{
 const html=render(meta);expect(html).toContain("Current-season rookie cohort unavailable");expect(html).not.toContain('/player/2');expect(html).not.toContain('/player/1');
});
it("empty current cohort also fails closed",()=>{const html=render(provenance,[]);expect(html).toContain("Current-season rookie cohort unavailable");expect(html).not.toContain('/player/2');});
it("validated cohort restricts rankings to exact IDs",()=>{const html=render(provenance);expect(html).toContain('/player/1');expect(html).not.toContain('/player/2');expect(html).toContain("heuristic ranking, not official eligibility");});
it("missing averages do not rank as zero and expose unavailable statistics",()=>{const html=render(provenance,[indexPlayer],[{...row,REB:null}]);expect(html).not.toContain('/player/1');expect(html).toContain("Statistics required for this ranking are unavailable");expect(html).toContain("Retry");expect(html).not.toContain("No qualifying players yet");});
it("known games below twenty retain the site qualification rule",()=>{const html=render(provenance,[indexPlayer],[{...row,GP:19}]);expect(html).not.toContain('/player/1');expect(html).toContain("site sample rule");expect(html).not.toContain("Statistics required for this ranking are unavailable");});
