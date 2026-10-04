import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { currentSeason } from "./constants";
import { getTranslations } from "@/locales";
const {snapshot,locale}=vi.hoisted(()=>({snapshot:vi.fn(),locale:vi.fn()}));
vi.mock("@/lib/api",()=>({getPlayerIndexSnapshot:snapshot}));
vi.mock("@/lib/locale",()=>({getLocale:locale}));
vi.mock("@/components/LocaleProvider",()=>({useLocale:()=>({locale:"en",t:getTranslations("en")})}));
const year=currentSeason().slice(0,4);
const player={personId:1,firstName:"First",lastName:"Year",fromYear:year,toYear:year,draftYear:null,draftRound:null,draftNumber:null,teamAbbr:"BOS",college:"",country:"",pts:0,reb:0,ast:0};
const provenance={source:"nba-cdn",season:currentSeason(),stale:false,retrievedAt:null};
beforeEach(()=>{snapshot.mockReset();locale.mockResolvedValue("en");});
async function render(players:unknown[],meta:unknown=provenance){snapshot.mockResolvedValue({players,provenance:meta});const {default:Page}=await import("@/app/rookie-watch/page");return renderToStaticMarkup(await Page());}
it("describes conditional heuristic cohort rankings in metadata", async () => {
 const { metadata } = await import("@/app/rookie-watch/page");
 expect(metadata.title).toBe("Rookie Watch");
 expect(metadata.description).toBe("First- and second-year NBA cohorts ranked by a heuristic production score when supported current-season data is available.");
 expect(snapshot).not.toHaveBeenCalled();
});
it.each([{...provenance,source:"bundled-archive",season:"2025-26"},{...provenance,stale:true},{...provenance,season:null}])("does not relabel old/stale/unknown snapshot as current rookie ranking",async meta=>{
 const html=await render([player],meta);expect(html).toContain("Current-season rookie cohort unavailable");expect(html).not.toContain('/player/1');expect(snapshot).toHaveBeenCalledOnce();
});
it("empty cohort is unavailable without selecting a past draft class",async()=>{
 const html=await render([{...player,fromYear:"2025",draftYear:2025,pts:20}]);expect(html).toContain("Older draft classes are not substituted");
});
it("keeps real zero averages and supported first/second-year cohorts",async()=>{
 const html=await render([player,{...player,personId:2,firstName:"Second",fromYear:String(Number(year)-1),pts:10},{...player,personId:3,firstName:"Missing",ast:null}]);
 expect(html).toContain('/player/1');expect(html).toContain('/player/2');expect(html).not.toContain('/player/3');expect(html).toContain('0.0');expect(html).toContain("heuristic composite");
});
it("ranks lower scorers first when rebounds and assists lift their heuristic score in both cohorts", async () => {
 const secondYear = String(Number(year) - 1);
 const html = await render([
  { ...player, personId: 11, pts: 22, reb: 2, ast: 1 },
  { ...player, personId: 12, pts: 12, reb: 8, ast: 6 },
  { ...player, personId: 21, fromYear: secondYear, pts: 24, reb: 1, ast: 2 },
  { ...player, personId: 22, fromYear: secondYear, pts: 10, reb: 10, ast: 7 },
 ]);
 const rankedIds = [...html.matchAll(/href="\/player\/(\d+)"/g)].map((match) => Number(match[1]));
 expect(rankedIds).toEqual([12, 11, 22, 21]);
 expect(html).toContain("heuristic composite: PPG + RPG×1.2 + APG×1.5");
 expect(snapshot).toHaveBeenCalledOnce();
});
it("renders Chinese unavailable copy and actual old source season",async()=>{
 locale.mockResolvedValue("zh");const html=await render([player],{...provenance,source:"bundled-archive",season:"2025-26"});expect(html).toContain("本赛季新秀名单暂不可用");expect(html).toContain("2025-26 · 存档快照");
});
