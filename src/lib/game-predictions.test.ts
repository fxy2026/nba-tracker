import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildPredictions, MIN_PREDICTION_GAMES } from "./game-predictions";
import { scheduleForSeason } from "./games";
import { getTranslations } from "@/locales";
import type { ScheduleDate, ScheduleGame } from "./api";
const { current, full, locale } = vi.hoisted(() => ({ current: vi.fn(), full: vi.fn(), locale: vi.fn() }));
vi.mock("@/lib/api", () => ({ getCurrentSeasonSchedule: current, getFullSchedule: full, getScheduleAge: () => null, formatDate: () => "2026-11-20" }));
vi.mock("@/lib/locale", () => ({ getLocale: locale }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: getTranslations("en") }) }));
function game(n: number, options: { season?: string; status?: number; away?: string; homeScore?: number; awayScore?: number; date?: string; type?: string } = {}): ScheduleDate {
 const date=options.date??`2026-11-${String(n+1).padStart(2,"0")}`;
 const team={teamName:"",teamCity:"",teamSlug:"",wins:0,losses:0,seed:0};
 return {gameDate:`${date.slice(5,7)}/${date.slice(8,10)}/${date.slice(0,4)} 00:00:00`,games:[{
  gameId:`${options.type??"002"}${options.season??"26"}${String(n).padStart(5,"0")}`,gameStatus:options.status??3,gameStatusText:"",gameCode:"",gameDateTimeUTC:`${date}T12:00:00Z`,
  homeTeam:{...team,teamId:1610612738,teamTricode:"BOS",score:options.homeScore??100},awayTeam:{...team,teamId:1610612752,teamTricode:options.away??"NYK",score:options.awayScore??90}
 } as ScheduleGame]};
}
const history=(n=10)=>Array.from({length:n},(_,i)=>game(i));
const upcoming=game(100,{status:1,date:"2026-11-21"});
const scoped=(data:ScheduleDate[])=>scheduleForSeason(data,"2026-27");
beforeEach(()=>{current.mockReset();full.mockReset();full.mockImplementation(()=>{throw Error("unscoped");});locale.mockResolvedValue("en");});
describe("sample-gated heuristic",()=>{
 it("returns no invented games for empty schedule",()=>expect(buildPredictions([],"2026-11-20")).toEqual([]));
 it.each([0,1,9])("withholds estimates for %s recorded games",n=>{
  const p=buildPredictions([...history(n),upcoming],"2026-11-20")[0];
  expect(p).toMatchObject({qualified:false,homeSamples:n,awaySamples:n});
  expect(p).not.toHaveProperty("edgeScore");expect(p).not.toHaveProperty("spread");expect(p).not.toHaveProperty("predictedWinner");
 });
 it("does not borrow history from the archive",()=>{
  const old=Array.from({length:10},(_,i)=>game(i,{season:"25",date:`2026-01-${String(i+1).padStart(2,"0")}`}));
  expect(buildPredictions(scoped([...old,upcoming]),"2026-11-20")[0]).toMatchObject({qualified:false,homeSamples:0,awaySamples:0});
 });
 it("withholds a one-sided sample even when one team has enough data",()=>{
  const one=Array.from({length:10},(_,i)=>game(i,{away:"LAL"}));
  expect(buildPredictions([...one,upcoming],"2026-11-20")[0]).toMatchObject({qualified:false,homeSamples:10,awaySamples:0});
 });
 it("preserves the existing qualified formula at the explicit threshold",()=>{
  expect(MIN_PREDICTION_GAMES).toBe(10);
  const p=buildPredictions([...history(),upcoming],"2026-11-20")[0];expect(p.qualified).toBe(true);
  if(!p.qualified)throw Error("expected qualified");
  expect(p.homeForm).toMatchObject({wins:10,losses:0,last10Pct:1,pf:100,pa:90,pd:10});
  expect(p.predictedWinner).toBe("home");expect(p.edgeScore).toBe(0.95);expect(p.spread).toBe(27);
 });
 it("never reaches threshold with duplicates, invalid finals, playoffs, preseason or future finals",()=>{
  const data=[...history(9),game(0),game(11,{homeScore:NaN}),game(12,{awayScore:Infinity}),game(13,{homeScore:90,awayScore:90}),game(14,{type:"004"}),game(15,{type:"001"}),game(16,{date:"2026-11-25"}),upcoming];
  expect(buildPredictions(data,"2026-11-20")[0]).toMatchObject({qualified:false,homeSamples:9,awaySamples:9});
 });
 it.each([[100,90],[90,100],[100,99],[500,1]])("keeps qualified scores finite and bounded: %s/%s",(homeScore,awayScore)=>{
  const data=Array.from({length:10},(_,i)=>game(i,{homeScore,awayScore}));
  const p=buildPredictions([...data,upcoming],"2026-11-20")[0];if(!p.qualified)throw Error("expected qualified");
  expect(p.edgeScore).toBeGreaterThanOrEqual(0.51);expect(p.edgeScore).toBeLessThanOrEqual(0.95);expect(Number.isFinite(p.spread)).toBe(true);
 });
 it("preserves seven-day selection, includes existing upcoming game types, and deduplicates",()=>{
  const selected=[game(101,{status:1,date:"2026-11-20",type:"001"}),game(102,{status:1,date:"2026-11-27",type:"006"})];
  const excluded=[game(103,{status:1,date:"2026-11-19"}),game(104,{status:1,date:"2026-11-28"}),game(105,{status:2,date:"2026-11-21"})];
  expect(buildPredictions([...selected,...excluded,...selected],"2026-11-20").map(p=>p.game.gameId)).toEqual(selected.map(d=>d.games[0].gameId));
 });
});
it.each(["en","zh"])("real page shows unavailable forecast and sample rule in %s",async language=>{
 locale.mockResolvedValue(language);current.mockResolvedValue([upcoming]);const {default:Page}=await import("@/app/game-predictor/page");
 const html=renderToStaticMarkup(await Page());expect(html).toContain(language==="en"?"Insufficient data":"样本不足");
 expect(html).not.toContain("56");expect(html).not.toContain("locks");expect(html).not.toContain("稳胆");expect(html).not.toContain("confident");expect(full).not.toHaveBeenCalled();
});
it("qualified page labels score as heuristic rather than probability",async()=>{
 current.mockResolvedValue([...history(),upcoming]);const {default:Page}=await import("@/app/game-predictor/page");const html=renderToStaticMarkup(await Page());
 expect(html).toContain("heuristic score");expect(html).toContain("not calibrated win probabilities");expect(html).not.toContain("% confident");
});

it.each([[100,90,"BOS"],[90,100,"NYK"]])("qualified margin is positive for model lean %s/%s",async(homeScore,awayScore,lean)=>{
 current.mockResolvedValue([...Array.from({length:10},(_,i)=>game(i,{homeScore:Number(homeScore),awayScore:Number(awayScore)})),upcoming]);
 const {default:Page}=await import("@/app/game-predictor/page");const html=renderToStaticMarkup(await Page());
 const text=html.replace(/<[^>]+>/g,""); expect(text).toContain(`Model lean${lean}`);expect(text).toMatch(/Estimated margin\+\d+\.\d pts/);
});
