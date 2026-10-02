import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { currentSeason } from "./constants";
import { playerIndexLabel } from "./player-index-provenance";
const { snapshot, locale } = vi.hoisted(()=>({snapshot:vi.fn(),locale:vi.fn()}));
vi.mock("@/lib/api",()=>({getPlayerIndexSnapshot:snapshot}));
vi.mock("@/lib/locale",()=>({getLocale:locale}));
import Position from "@/app/by-position/page";
import Country from "@/app/by-country/page";
import Draft from "@/app/draft-classes/page";
const views=[{name:"position",render:Position},{name:"country",render:Country},{name:"draft",render:Draft}];
const player={personId:42,firstName:"Archive",lastName:"Player",teamAbbr:"BOS",country:"USA",position:"G",height:"6-4",draftYear:2020,draftNumber:12,draftRound:1,pts:10,reb:3,ast:2};
const archive={source:"bundled-archive" as const,season:"2025-26",stale:true,retrievedAt:null};
beforeEach(()=>{vi.clearAllMocks();locale.mockResolvedValue("en");snapshot.mockResolvedValue({players:[player],provenance:archive});});
for(const view of views){
 it.each(["en","zh"] as const)(`${view.name}: archived source and useful player navigation in %s`,async(language)=>{locale.mockResolvedValue(language);const html=renderToStaticMarkup(await view.render());expect(html).toContain(playerIndexLabel(archive,language));expect(html).toContain('/player/42');expect(html).not.toContain('last season');expect(html).not.toContain('上赛季');expect(html).not.toContain('Active players');expect(snapshot).toHaveBeenCalledTimes(1);});
 it.each([{source:"nba-cdn" as const,season:currentSeason(),stale:false,retrievedAt:null},{source:"nba-cdn" as const,season:null,stale:false,retrievedAt:null},{source:"nba-cdn" as const,season:"2024-25",stale:true,retrievedAt:null}])(`${view.name}: preserves declared source metadata %j`,async(provenance)=>{snapshot.mockResolvedValue({players:[player],provenance});const html=renderToStaticMarkup(await view.render());expect(html).toContain(playerIndexLabel(provenance,"en"));expect(html).not.toContain('last season');});
 it.each(["en","zh"] as const)(`${view.name}: missing averages keep unranked navigation without invented zeros in %s`,async(language)=>{locale.mockResolvedValue(language);snapshot.mockResolvedValue({players:[{...player,pts:null,reb:undefined,ast:null}],provenance:archive});const html=renderToStaticMarkup(await view.render());expect(html).toContain('/player/42');expect(html).toContain(language==="zh"?'场均数据不完整':'Incomplete averages');expect(html.replace(/<[^>]*>/g, '')).not.toContain('0.0');expect(html).not.toContain('NaN');});
 it(`${view.name}: real zero averages remain eligible and visible`,async()=>{snapshot.mockResolvedValue({players:[{...player,pts:0,reb:0,ast:0}],provenance:archive});const html=renderToStaticMarkup(await view.render());expect(html).toContain('/player/42');expect(html).toContain('0.0');expect(html).not.toContain('Incomplete averages');});
 it(`${view.name}: failure has a safe unavailable state`,async()=>{snapshot.mockRejectedValue(new Error('offline'));expect(renderToStaticMarkup(await view.render())).toContain('Player source unavailable');});
}
it("draft unknown pick does not become an undrafted or active-roster claim",async()=>{snapshot.mockResolvedValue({players:[{...player,draftNumber:null}],provenance:archive});const html=renderToStaticMarkup(await Draft());expect(html).toContain('Pick unspecified');expect(html).not.toContain('Undrafted');expect(html).not.toContain('still active');expect(html).toContain('/draft/2026');});
it("country preserves named non-US groups and known PPG even when other averages are absent",async()=>{snapshot.mockResolvedValue({players:[{...player,country:'France',reb:null}],provenance:archive});const html=renderToStaticMarkup(await Country());expect(html).toContain('France');expect(html).toContain('10.0');expect(html).toContain('Incomplete averages');});
