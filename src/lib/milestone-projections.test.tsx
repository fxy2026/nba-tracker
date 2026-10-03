import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { milestoneCandidates, findChasing } from "./milestone-projections";
const { snapshot, locale } = vi.hoisted(() => ({ snapshot: vi.fn(), locale: vi.fn() }));
vi.mock("@/lib/api", () => ({ getPlayerIndexSnapshot: snapshot }));
vi.mock("@/lib/locale", () => ({ getLocale: locale }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children) }));
vi.mock("@/components/PlayerHeadshot", () => ({ default: () => null }));
vi.mock("@/components/PageHeader", () => ({ default: ({ title, subtitle }: {title:string;subtitle?:string}) => createElement("header", {}, title, subtitle) }));
vi.mock("@/components/EmptyState", () => ({ default: ({ title, description }: {title:string;description?:string}) => createElement("aside", {}, title, description) }));
vi.mock("@/components/RelatedPages", () => ({ default: () => null }));
import Page from "@/app/milestones/page";
const base = {personId:99,firstName:"Audit",lastName:"Player",teamAbbr:"BOS",fromYear:"2001",toYear:"2020",pts:null,reb:10,ast:null};
const provenance = {source:"bundled-archive",season:"2020-21",stale:true,retrievedAt:null};
function seed(players:unknown[]) {snapshot.mockResolvedValue({players,provenance});}
const render = async () => renderToStaticMarkup(await Page());
beforeEach(()=>{snapshot.mockReset();locale.mockReset().mockResolvedValue("en");seed([base]);});

describe("metric-independent projection model",()=>{
 it("preserves null independently and distinguishes known zero",()=>{
  const [p]=milestoneCandidates([{...base,pts:0}]);
  expect(p).toMatchObject({ppg:0,estCareerPoints:0,rpg:10,estCareerRebs:14000,apg:null,estCareerAsts:null,seasons:20});
 });
 it.each([null,undefined,NaN,Infinity,-1,"10"])("rejects non-finite/non-number/negative metric %s without losing another metric",value=>{
  const [p]=milestoneCandidates([{...base,pts:value}]);
  expect(p.ppg).toBeNull();expect(p.estCareerPoints).toBeNull();expect(p.estCareerRebs).toBe(14000);
 });
 it.each([["2001junk","2020"],["2001","2020.5"],["2021","2020"],[null,"2020"],[2001,"2020"],["0000","2020"],[" 2001","2020"]])("rejects invalid/reversed year span %s / %s",(fromYear,toYear)=>{
  expect(milestoneCandidates([{...base,fromYear,toYear}])).toEqual([]);
 });
 it.each([["0001","2020"],["0099","2020"],["1900","2020"],["1945","2020"],["2020","2028"],["9998","9999"]])("rejects impossible NBA-era span %s / %s at fixed 2026",(fromYear,toYear)=>{
  expect(milestoneCandidates([{...base,fromYear,toYear}],2026)).toEqual([]);
 });
 it("preserves earliest NBA history and next-year season boundary",()=>{
  expect(milestoneCandidates([{...base,fromYear:"1946",toYear:"1946"}],2026)[0].seasons).toBe(1);
  expect(milestoneCandidates([{...base,fromYear:"2026",toYear:"2027"}],2026)[0].seasons).toBe(2);
 });
 it("selects nearest unmet tier regardless of original order, without mutating tiers",()=>{
  const candidates=milestoneCandidates([{...base,fromYear:"2020",toYear:"2020",pts:200}]);
  const tiers=[{value:30000,label:"30k"},{value:15000,label:"15k"},{value:10000,label:"10k"}];
  const [result]=findChasing(candidates,tiers,p=>p.estCareerPoints,p=>p.ppg);
  expect(result).toMatchObject({current:14000,threshold:{value:15000},needed:1000,gamesNeeded:5});
  expect(tiers.map(t=>t.value)).toEqual([30000,15000,10000]);
 });
 it.each([[9996,31.1,1],[9990,10,1],[9989,10,2],[8250,10,175]])("rounds positive remaining games upward: %s at %s",(current,average,games)=>{
  const p=milestoneCandidates([base]);
  const [result]=findChasing(p,[{value:10000,label:"10k"}],()=>current,()=>average);
  expect(result.gamesNeeded).toBe(games);
 });
 it.each([null,0,-1,NaN,Infinity])("does not estimate from unusable average %s",average=>{
  expect(findChasing(milestoneCandidates([base]),[{value:10000,label:"10k"}],()=>9996,()=>average)).toEqual([]);
 });
 it.each([10000,10001])("does not present reached tier %s as still needed",current=>{
  expect(findChasing(milestoneCandidates([base]),[{value:10000,label:"10k"}],()=>current,()=>10)).toEqual([]);
 });
 it("keeps positive subnormal remaining amount at one game and excludes beyond horizon",()=>{
  const p=milestoneCandidates([base]);
  expect(findChasing(p,[{value:Number.MIN_VALUE,label:"tiny"}],()=>0,()=>Number.MAX_VALUE)[0].gamesNeeded).toBe(1);
  expect(findChasing(p,[{value:10000,label:"10k"}],()=>8249,()=>10)).toEqual([]);
 });
 it("known zero yields no division-by-zero estimate",()=>{
  const p=milestoneCandidates([{...base,pts:0}]);
  expect(findChasing(p,[{value:10000,label:"10k"}],x=>x.estCareerPoints,x=>x.ppg)).toEqual([]);
 });
 it("skips reached tiers and rejects targets outside the horizon",()=>{
  const p=milestoneCandidates([{...base,fromYear:"2020",toYear:"2020",pts:1}]);
  expect(findChasing(p,[{value:70,label:"reached"},{value:10000,label:"too far"}],x=>x.estCareerPoints,x=>x.ppg)).toEqual([]);
 });
});

describe("actual milestones page SSR",()=>{
 it.each(["en","zh"])("positive remaining four never renders zero games (%s)",async lang=>{
  locale.mockResolvedValue(lang);
  seed([{...base,fromYear:"2020",toYear:"2020",pts:142.8,reb:null}]);
  const html=await render();
  expect(html).toContain(lang==="zh"?"约 1 场":"~1 games");
  expect(html).not.toContain(lang==="zh"?"约 0 场":"~0 games");
  expect(html).toContain(lang==="zh"?"每赛季 70 场":"70 games per season");
  expect(html).toContain(lang==="zh"?"不是实际生涯累计":"not actual career totals");
 });
 it.each(["en","zh"])("null PTS retains known rebounding target with source and visible model (%s)",async lang=>{
  locale.mockResolvedValue(lang);
  const html=await render();
  expect(html).toContain("Audit");expect(html).toContain("2020-21");
  expect(html).toContain(lang==="zh"?"存档快照":"archived snapshot");
  expect(html).toContain(lang==="zh"?"篮板里程碑投影":"Projected rebounding milestones");
  expect(html).toContain(lang==="zh"?"约 100 场":"~100 games");
  expect(html).toContain(lang==="zh"?"每赛季 70 场":"70 games per season");
  expect(html).toContain(lang==="zh"?"不是实际生涯累计":"not actual career totals");
  expect(html.indexOf(lang==="zh"?"模型假设":"Model assumption")).toBeLessThan(html.indexOf("Audit"));
  expect(html).not.toContain("last-season");expect(html).not.toContain("NaN");
 });
 it("independently retains assist projection with missing points and rebounds",async()=>{
  seed([{...base,reb:null,ast:5.5}]);
  const html=await render();expect(html).toContain("Projected assist milestones");expect(html).toContain("~55 games");
 });
 it("actual page chooses 15k rather than descending-list 30k target",async()=>{
  seed([{...base,fromYear:"2020",toYear:"2020",pts:200,reb:null}]);
  const html=await render();expect(html).toContain("Projected toward 15,000 pts");expect(html).not.toContain("Projected toward 30,000 pts");
 });
 it.each(["en","zh"])("explains no usable metrics and invalid years (%s)",async lang=>{
  locale.mockResolvedValue(lang);
  seed([{...base,reb:null},{...base,fromYear:"bad"}]);
  const html=await render();expect(html).toContain(lang==="zh"?"暂无可用投影数据":"No usable projection data");
  expect(html).not.toContain("Audit");expect(html).not.toContain("NaN");
 });
 it.each([0,1])("known %s is usable but has no nearby target",async pts=>{
  seed([{...base,fromYear:"2020",toYear:"2020",pts,reb:null}]);
  const html=await render();expect(html).toContain("No nearby projected targets");expect(html).not.toContain("No usable projection data");
 });
 it("empty snapshot keeps source and explains no player data",async()=>{
  seed([]);const html=await render();expect(html).toContain("2020-21");expect(html).toContain("No player data");
 });
 it("fetch failure is recoverable and never creates zero projections",async()=>{
  snapshot.mockRejectedValue(new Error("offline"));const html=await render();expect(html).toContain("Player source unavailable");expect(html).toContain("No player data");
 });
});
