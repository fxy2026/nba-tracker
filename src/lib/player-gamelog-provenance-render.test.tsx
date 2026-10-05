import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerInfo } from "./api";
import type { PlayerIndexProvenance } from "./player-index-provenance";

const { snapshot, locale, gameLog, notFound } = vi.hoisted(() => ({
  snapshot: vi.fn(),
  locale: vi.fn(),
  gameLog: vi.fn<(props: { playerId: number; playerName: string }) => null>(() => null),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("@/lib/api", () => ({
  getPlayerIndexSnapshot: snapshot,
  getPlayerHeadshotUrl: (id: number) => `https://cdn.nba.com/headshots/${id}.png`,
}));
vi.mock("@/lib/player-profile-loader", () => ({ getPlayerProfileContext: async (id: string) => {
  const value = await snapshot();
  const player = value.players.find((row: PlayerInfo) => row.personId === Number(id));
  return player ? { snapshot: value, identity: { id: player.personId, name: `${player.firstName} ${player.lastName}`, sourceYears: { from: Number(player.fromYear), to: Number(player.toYear) } } } : null;
} }));
vi.mock("@/lib/player-game-log-profile", () => ({ getPlayerGameLogProfile: async () => ({ seasons: ["2025-26", "2026-27"], initialData: null, defaultSeason: "2025-26" }) }));
vi.mock("@/lib/locale", () => ({ getLocale: locale }));
vi.mock("@/lib/constants", () => ({ CURRENT_SEASON: "2026-27" }));
vi.mock("@/components/player/PlayerGameLog", () => ({ default: gameLog }));
vi.mock("next/navigation", () => ({ notFound }));

import GameLogPage, { generateMetadata } from "@/app/player/[id]/gamelog/page";

const lebron: PlayerInfo = {
  personId: 2544, firstName: "LeBron", lastName: "James", slug: "lebron-james",
  teamId: 1610612747, teamAbbr: "LAL", teamCity: "Los Angeles", teamName: "Lakers",
  jersey: "23", position: "F", height: "6-9", weight: "250", college: "", country: "USA",
  draftYear: 2003, draftRound: 1, draftNumber: 1, fromYear: "2003", toYear: "2025",
  pts: 24.4, reb: 7.8, ast: 8.2,
};
const giannis: PlayerInfo = {
  ...lebron, personId: 203507, firstName: "Giannis", lastName: "Antetokounmpo",
  slug: "giannis-antetokounmpo", teamId: 1610612749, teamAbbr: "MIL",
  teamCity: "Milwaukee", teamName: "Bucks",
};
const archived: PlayerIndexProvenance = {
  source: "bundled-archive", season: "2025-26", stale: true, retrievedAt: null,
};
const params = (id = "2544") => ({ params: Promise.resolve({ id }) });
const paragraphs = (html: string) => [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((match) => match[1]);

beforeEach(() => {
  vi.clearAllMocks();
  locale.mockResolvedValue("en");
  snapshot.mockResolvedValue({ players: [lebron, giannis], provenance: archived });
  // This header must use the existing snapshot accessor, never another provider.
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected provider request"); }));
});
afterEach(() => vi.unstubAllGlobals());

describe.each(["en", "zh"] as const)("game-log affiliation provenance in %s", (language) => {
  beforeEach(() => locale.mockResolvedValue(language));
  const teamPrefix = language === "zh" ? "球队归属：" : "Team affiliation: ";
  const logHeading = language === "zh" ? "比赛日志 · 已收录赛季" : "Game log · Recorded seasons";

  it.each([lebron, giannis])("keeps $teamName's archived affiliation separate from the current log", async (player) => {
    const html = renderToStaticMarkup(await GameLogPage(params(String(player.personId))));
    const text = paragraphs(html);
    expect(text).toContain(logHeading);
    expect(text).toContain(`${teamPrefix}2025-26 · ${language === "zh" ? "存档快照" : "archived snapshot"}`);
    expect(text.find((line) => line.startsWith(teamPrefix))).not.toContain("2026-27");
    expect(html).toContain(`${player.teamCity} ${player.teamName}`);
    expect(html).toContain(`href="/team/${player.teamAbbr}"`);
    expect(html).toContain(`href="/player/${player.personId}"`);
    expect(gameLog.mock.calls[0]?.[0]).toEqual({
      playerId: player.personId, playerName: `${player.firstName} ${player.lastName}`,
      seasons: ["2025-26", "2026-27"], initialData: null, defaultSeason: "2025-26", initialSearch: "",
    });
    expect(snapshot).toHaveBeenCalledExactlyOnceWith();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { season: "2026-27", stale: false },
    { season: "2025-26", stale: false },
    { season: null, stale: false },
    { season: "2025-26", stale: true },
    { season: null, stale: true },
  ])("retains declared NBA season and refresh state: %j", async ({ season, stale }) => {
    snapshot.mockResolvedValue({
      players: [lebron],
      provenance: { source: "nba-cdn", season, stale, retrievedAt: "2026-10-03T00:00:00Z" },
    });
    const html = renderToStaticMarkup(await GameLogPage(params()));
    const seasonLabel = season ?? (language === "zh" ? "赛季未注明" : "season unspecified");
    const sourceLabel = stale
      ? (language === "zh" ? "NBA 缓存快照（刷新暂不可用）" : "NBA cached snapshot (refresh unavailable)")
      : (language === "zh" ? "NBA 球员索引" : "NBA player index");
    expect(paragraphs(html)).toContain(logHeading);
    expect(paragraphs(html)).toContain(`${teamPrefix}${seasonLabel} · ${sourceLabel}`);
    expect(html).not.toContain("2026-10-03T00:00:00Z");
    expect(snapshot).toHaveBeenCalledExactlyOnceWith();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not infer an unspecified archive season from the log season", async () => {
    snapshot.mockResolvedValue({ players: [lebron], provenance: { ...archived, season: null } });
    const html = renderToStaticMarkup(await GameLogPage(params()));
    expect(paragraphs(html)).toContain(logHeading);
    expect(paragraphs(html)).toContain(`${teamPrefix}${language === "zh" ? "赛季未注明 · 存档快照" : "season unspecified · archived snapshot"}`);
  });

  it("describes recorded selectable seasons without promising a complete current season", async () => {
    const metadata = await generateMetadata(params());
    expect(metadata.title).toBe(language === "zh"
      ? "LeBron James 比赛日志 — 已收录赛季逐场数据"
      : "LeBron James Game Log — Recorded Seasons");
    expect(metadata.description).toBe(language === "zh"
      ? "LeBron James 已收录赛季的逐场得分、篮板、助攻、投篮、抢断、盖帽与月度拆分；来源和缺失范围分别标注。"
      : "LeBron James recorded game logs, shooting, rebounds, assists and monthly splits with source and coverage labels.");
    expect(metadata.openGraph?.title).toBe(metadata.title);
    expect(metadata.openGraph?.description).toBe(metadata.description);
    expect(metadata.alternates?.canonical).toBe("/player/2544/gamelog");
    expect(snapshot).toHaveBeenCalledExactlyOnceWith();
  });
});

it("still qualifies a displayed team logo when its abbreviation is unavailable", async () => {
  snapshot.mockResolvedValue({ players: [{ ...lebron, teamAbbr: "" }], provenance: archived });
  const html = renderToStaticMarkup(await GameLogPage(params()));
  expect(paragraphs(html)).toContain("Team affiliation: 2025-26 · archived snapshot");
  expect(html).not.toContain('href="/team/"');
});

it("does not invent a team or team label for a player without affiliation", async () => {
  snapshot.mockResolvedValue({ players: [{ ...lebron, teamAbbr: "", teamId: 0, teamCity: "", teamName: "" }], provenance: archived });
  const html = renderToStaticMarkup(await GameLogPage(params()));
  expect(paragraphs(html)).toContain("Game log · Recorded seasons");
  expect(html).not.toContain("Team affiliation:");
  expect(html).not.toContain('href="/team/');
});

it.each(["not-a-player", "999999"])("preserves not-found and empty metadata behavior for %s", async (id) => {
  await expect(GameLogPage(params(id))).rejects.toThrow("NEXT_NOT_FOUND");
  expect(notFound).toHaveBeenCalledTimes(1);
  expect(snapshot).toHaveBeenCalledTimes(id === "not-a-player" ? 0 : 1);
  expect(gameLog).not.toHaveBeenCalled();
  vi.clearAllMocks();
  await expect(generateMetadata(params(id))).resolves.toEqual({});
  expect(notFound).not.toHaveBeenCalled();
  expect(snapshot).toHaveBeenCalledTimes(id === "not-a-player" ? 0 : 1);
});

it("preserves snapshot error propagation rather than inventing data", async () => {
  const error = new Error("snapshot unavailable");
  snapshot.mockRejectedValue(error);
  await expect(GameLogPage(params())).rejects.toBe(error);
  await expect(generateMetadata(params())).rejects.toBe(error);
  expect(notFound).not.toHaveBeenCalled();
  expect(gameLog).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
