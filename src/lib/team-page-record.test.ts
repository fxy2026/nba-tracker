import { isValidElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
const { schedule } = vi.hoisted(()=>({schedule:vi.fn()}));
vi.mock("@/lib/api", async original=>({...await original<typeof import("./api")>(),getCurrentSeasonSchedule:schedule,getPlayerIndexSnapshot:async()=>({players:[],provenance:{source:"bundled-archive",season:"2025-26",stale:true,retrievedAt:null}}),getScheduleAge:()=>null}));
vi.mock("next/og",()=>({ImageResponse:class {constructor(public element:ReactNode){}}}));
vi.mock("@/lib/locale",()=>({getLocale:async()=>"en"}));
import Image from "@/app/team/[tricode]/opengraph-image";
import Page from "@/app/team/[tricode]/page";
import TeamStatsPanel from "@/app/team/[tricode]/_components/TeamStatsPanel";
import TeamScheduleCard from "@/app/team/[tricode]/_components/TeamScheduleCard";
import TeamTrendsPanel from "@/app/team/[tricode]/_components/TeamTrendsPanel";
import TeamHero from "@/app/team/[tricode]/_components/TeamHero";
function hero(node:ReactNode):Record<string,unknown>|null {
 if(Array.isArray(node))return node.map(hero).find(Boolean)??null;
 if(!isValidElement<Record<string,unknown>>(node))return null;
 return node.type===TeamHero?node.props:hero(node.props.children as ReactNode);
}
const game=(homeScore:unknown=100,awayScore:unknown=90)=>({gameId:"0022600001",gameStatus:3,gameDateTimeUTC:"2026-10-21T00:00:00Z",homeTeam:{teamTricode:"BOS",teamId:1610612738,score:homeScore},awayTeam:{teamTricode:"NYK",teamId:1610612752,score:awayScore}});
beforeEach(()=>schedule.mockResolvedValue([]));
it("actual page passes no rank for empty current schedule",async()=>{expect(hero(await Page({params:Promise.resolve({tricode:"BOS"})}))).toMatchObject({confRank:0,wins:0,losses:0});});
it.each([[null,90],[NaN,90],[100,100],[-1,90]])("invalid final scores %j/%j cannot form a record",async(a,b)=>{schedule.mockResolvedValue([{gameDate:"10/21/2026",games:[game(a,b)]}]);expect(hero(await Page({params:Promise.resolve({tricode:"BOS"})}))).toMatchObject({confRank:0,wins:0,losses:0,gamesPlayed:0});});
it("valid page record and rank remain intact",async()=>{schedule.mockResolvedValue([{gameDate:"10/21/2026",games:[game()]}]);expect(hero(await Page({params:Promise.resolve({tricode:"BOS"})}))).toMatchObject({confRank:1,wins:1,losses:0,gamesPlayed:1});});

function text(node:ReactNode):string {
 if(Array.isArray(node))return node.map(text).join("");
 if(typeof node === "string" || typeof node === "number")return String(node);
 return isValidElement<{children?:ReactNode}>(node)?text(node.props.children):"";
}
async function ogText(){return text((await Image({params:Promise.resolve({tricode:"BOS"})}) as unknown as {element:ReactNode}).element);}
it("OG empty data has truthful unavailable label, not a numerical record",async()=>{const content=await ogText();expect(content).toContain("No completed regular-season data available");expect(content).not.toContain("0-0");});
it("OG ignores invalid/tied finals just like the team header",async()=>{schedule.mockResolvedValue([{gameDate:"10/21/2026",games:[game(null,90),game(100,100)]}]);expect(await ogText()).toContain("No completed regular-season data available");});
it("OG preserves a valid record and correctly formats a perfect winning percentage",async()=>{schedule.mockResolvedValue([{gameDate:"10/21/2026",games:[game()]}]);const content=await ogText();expect(content).toContain("1-0");expect(content).toContain("1.000");expect(content).not.toContain(".1000");});

function propsOf(node:ReactNode, type:unknown):Record<string,unknown>[] {
 if(Array.isArray(node))return node.flatMap(child=>propsOf(child,type));if(!isValidElement<Record<string,unknown>>(node))return[];return[...(node.type===type?[node.props]:[]),...propsOf(node.props.children as ReactNode,type)];
}
it('regular statistics exclude preseason/playoffs but retain every actual recent game link',async()=>{
 schedule.mockResolvedValue([{gameDate:'10/21/2026',games:[game(),{...game(200,180),gameId:'0012600001'},{...game(50,40),gameId:'0042600101'}]}]);
 const page=await Page({params:Promise.resolve({tricode:'BOS'})});expect(hero(page)).toMatchObject({wins:1,losses:0,gamesPlayed:1,ppg:'100.0',oppPpg:'90.0',homeWins:1,homeLosses:0,awayWins:0,awayLosses:0,w10:1,l10:0,streakDisplay:'W1',playoffWins:1,playoffLosses:0});
 expect(propsOf(page,TeamStatsPanel)[0].recentGames).toHaveLength(1);expect(propsOf(page,TeamTrendsPanel)[0].recentGames).toHaveLength(1);expect(propsOf(page,TeamScheduleCard).find(p=>p.mode==='recent')!.games).toHaveLength(3);
});
it('preseason/playoff-only data cannot create regular averages or form',async()=>{
 schedule.mockResolvedValue([{gameDate:'10/21/2026',games:[{...game(200,180),gameId:'0012600001'},{...game(50,40),gameId:'0042600101'}]}]);
 const page=await Page({params:Promise.resolve({tricode:'BOS'})});expect(hero(page)).toMatchObject({wins:0,losses:0,gamesPlayed:0,w10:0,l10:0,streakDisplay:'-',playoffWins:1});expect(propsOf(page,TeamStatsPanel)[0].recentGames).toEqual([]);expect(propsOf(page,TeamScheduleCard).find(p=>p.mode==='recent')!.games).toHaveLength(2);
});
it('regular losses and away split preserve genuine zero wins',async()=>{
 const away={...game(100,90),gameId:'0022600002',homeTeam:{...game().homeTeam,teamTricode:'NYK'},awayTeam:{...game().awayTeam,teamTricode:'BOS'}};
 schedule.mockResolvedValue([{gameDate:'10/22/2026',games:[away]}]);expect(hero(await Page({params:Promise.resolve({tricode:'BOS'})}))).toMatchObject({wins:0,losses:1,gamesPlayed:1,ppg:'90.0',oppPpg:'100.0',homeWins:0,homeLosses:0,awayWins:0,awayLosses:1,w10:0,l10:1,streakDisplay:'L1'});
});
