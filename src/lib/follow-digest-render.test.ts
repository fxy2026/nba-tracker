import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { TeamCard as StripCard } from "@/components/FollowStrip";
import { TeamCard, PlayerCard } from "@/app/favorites/FavoritesDashboard";
import { buildTeamDigests } from "./follow-digest";
import type { PlayerDigest } from "./follow-digest-types";
it.each([true,false])("labels exact historical season in both team surfaces: zh=%s",(isZh)=>{
 const team=buildTeamDigests([],["BOS"])[0];
 for(const html of [renderToStaticMarkup(createElement(StripCard,{team,isZh})),renderToStaticMarkup(createElement(TeamCard,{team,isZh,delay:0,onRemove:()=>{},injuries:[],news:[]}))]) {
  expect(html).toContain("2025-26");expect(html).toContain(isZh ? "存档":"archive");expect(html).toContain(isZh?"暂无已知赛程":"No scheduled game available");expect(html).not.toContain("Offseason");
 }
});
it.each([true,false])("preserves zero averages with provenance and current-team uncertainty: zh=%s",(isZh)=>{
 const player:PlayerDigest={personId:1,name:"Test Player",teamTricode:"BOS",teamId:1610612738,lastLine:null,nextGame:null,seasonAvg:{pts:0,reb:0,ast:0},provenance:{source:"bundled-archive",season:"2025-26",stale:false,retrievedAt:null},currentTeamKnown:false};
 const html=renderToStaticMarkup(createElement(PlayerCard,{player,isZh,delay:0,onRemove:()=>{}}));
 expect(html).toContain("2025-26");expect(html).toContain(isZh?"存档快照":"archived snapshot");expect(html).toContain(isZh?"当前球队待确认":"Current team unconfirmed");expect(html).toContain("0.0");
 expect(renderToStaticMarkup(createElement(PlayerCard,{player:{...player,seasonAvg:null},isZh,delay:0,onRemove:()=>{}}))).not.toContain("0.0");
});
it("missing current and historical records render unavailable instead of invented zeroes",()=>{
 const team=buildTeamDigests([],["BOS"],null)[0];
 const html=renderToStaticMarkup(createElement(StripCard,{team,isZh:false}));expect(html).toContain("—");expect(html).not.toContain("0-0");
});

it("current index cannot relabel a historical appearance as current season", () => {
 const player:PlayerDigest={personId:1,name:"Test Player",teamTricode:"BOS",teamId:1610612738,nextGame:null,seasonAvg:{pts:0,reb:0,ast:0},provenance:{source:"nba-cdn",season:"2026-27",stale:false,retrievedAt:null},currentTeamKnown:true,lastLine:{gameId:"0022500001",season:"2025-26",dateUTC:"2026-04-11T00:00:00Z",opponentTricode:"NYK",home:true,win:true,min:20,pts:12,reb:3,ast:4,stl:0,blk:0,fgm:5,fga:10,tpm:2,tpa:4}};
 const html=renderToStaticMarkup(createElement(PlayerCard,{player,isZh:false,delay:0,onRemove:()=>{}}));
 expect(html).toContain("2026-27 · NBA player index");expect(html).toContain("2025-26 · ");expect(html).toContain("Latest available appearance");
});
