vi.mock("server-only", () => ({}));
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { getPlayerGameLogArchive } from "./player-game-log-archive";
import { getPlayerGameLogProfile } from "./player-game-log-profile";
import { parseEspnPlayerGameLog } from "./espn-player-game-log";
import { normalizePlayerGameLog, parseNbaPlayerGameLog } from "./player-game-log-data";
const raw = (name: string) => JSON.parse(gunzipSync(readFileSync(`src/data/player-game-log-archives/${name}.json.gz`)).toString());
const identity = { playerId: 2544, season: "2025-26", seasonType: "Regular Season" as const };
const now = "2026-10-05T07:00:00.000Z";
const nba = (overrides: Record<string, unknown> = {}) => { const r = { Player_ID: 2544, Game_ID: "0022500001", GAME_DATE: "OCT 21, 2025", MATCHUP: "LAL vs. GSW", WL: "W", MIN: 30, PTS: 20, REB: 8, AST: 6, ...overrides }; return { resultSets: [{ name: "PlayerGameLog", headers: Object.keys(r), rowSet: [Object.values(r)] }] }; };
describe("strict NBA identity and null-safe stats", () => {
  it("accepts real mixed-case ID header and keeps missing categories null", () => { const data = parseNbaPlayerGameLog(nba(), identity, now); expect(data?.rows[0]).toMatchObject({ date: "2025-10-21", pts: 20, stl: null, ftm: null, plusMinus: null }); });
  it.each([{Player_ID:201939},{Game_ID:"0042500001"},{Game_ID:"0022400001"},{GAME_DATE:"FEB 31, 2026"},{MIN:NaN},{PTS:-1}])("rejects cross-player/type/season or invalid numbers %j", change => expect(parseNbaPlayerGameLog(nba(change), identity, now)).toBeNull());
  it("rejects duplicate rows and wrong response identity", () => { const data = parseNbaPlayerGameLog(nba(), identity, now)!; expect(normalizePlayerGameLog({...data,rows:[...data.rows,...data.rows]},identity)).toBeNull(); expect(normalizePlayerGameLog(data,{...identity,playerId:1})).toBeNull(); });
});
describe("recorded ESPN source fixtures", () => {
  it.each([[2544,"2025-26",60,10],[2544,"2024-25",70,5],[201939,"2025-26",43,0],[201939,"2024-25",70,8],[893,"1997-98",82,21],[893,"2002-03",82,0],[977,"2015-16",62,0]] as const)("%s %s preserves actual counts and separate types", async (playerId,season,regular,playoffs) => { const reg = await getPlayerGameLogArchive(playerId,season,"Regular Season"), post = await getPlayerGameLogArchive(playerId,season,"Playoffs"); expect(reg?.rows).toHaveLength(regular); expect(post?.rows).toHaveLength(playoffs); expect(reg?.source.archived).toBe(true); expect(reg?.rows.every(row=>row.nbaGameId===null && row.id.startsWith("espn:") && row.plusMinus===null)).toBe(true); });
  it("flags Kobe's four missing games, never full season", async()=> { const data=await getPlayerGameLogArchive(977,"2015-16","Regular Season");expect(data).toMatchObject({coverage:"partial-source",expectedGames:66});expect(data?.rows.reduce((sum,row)=>sum+row.pts!,0)).toBe(1091); });
  it("excludes all-star, preseason and play-in; preserves an empty playoff response", () => { const data=parseEspnPlayerGameLog(raw('201939-2025-26'),{...identity,playerId:201939},'3975',now);expect(data?.rows).toHaveLength(43);expect(data?.rows.some(row=>row.date>'2026-04-13')).toBe(false); });
  it("rejects stale season filters, duplicated events, corrupt rows and signed plus-minus errors",()=> { const data=raw('2544-2025-26'); data.filters.find((f:{name:string})=>f.name==='season').value='2025';expect(parseEspnPlayerGameLog(data,identity,'1966',now)).toBeNull(); const signed=raw('2544-2025-26'); signed.names.push('plusMinus'); for(const group of signed.seasonTypes)for(const category of group.categories)for(const event of category.events??[])event.stats.push('-5');expect(parseEspnPlayerGameLog(signed,identity,'1966',now)?.rows[0].plusMinus).toBe(-5); });
  it("defaults to a recorded archive even after player index rolls over",async()=> { const profile=await getPlayerGameLogProfile(2544,{from:2003,to:2026},'2026-27');expect(profile.defaultSeason).toBe('2025-26');expect(profile.initialData?.rows).toHaveLength(60);expect(profile.seasons).toContain('2026-27'); });
});
