import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import playerIndex from "@/data/playerindex-2025-26.json";
import { currentSeason } from "@/lib/constants";

const state = vi.hoisted(() => ({ locale: "en" as "en" | "zh", profile: null as unknown }));
vi.mock("@/lib/player-profile-loader", () => ({ getPlayerProfileContext: async () => state.profile }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => state.locale }));
vi.mock("@/lib/player-identity", () => ({ parsePlayerId: (value: string) => Number(value) }));
vi.mock("@/lib/api", () => ({ getPlayerHeadshotUrl: (id: number) => `https://example.com/player/${id}.png` }));
vi.mock("@/lib/player-career-archive", () => ({ getReviewedCareerArchive: async () => null }));
vi.mock("@/lib/historical-career-archive", () => ({ getHistoricalCareerArchive: async () => null }));
vi.mock("@/lib/player-game-log-profile", () => ({ getPlayerGameLogProfile: async () => null }));
vi.mock("@/lib/season-heatmap-catalog-server", () => ({ getPlayerSeasonHeatmapCatalog: async () => [], loadPlayerSeasonHeatmapArchive: async () => null }));
vi.mock("@/lib/player-profile-navigation", () => ({ playerShootingSelection: () => null }));
vi.mock("@/lib/playerAccolades", () => ({ getAccolades: () => null }));
vi.mock("@/lib/allTimeLeaders", () => ({ ALL_TIME_LEADERS: [] }));
vi.mock("@/lib/iconicSeasons", () => ({ ICONIC_SEASONS: [] }));
vi.mock("@/lib/iconicGames", () => ({ ICONIC_GAMES: [] }));
vi.mock("@/lib/dates", () => ({ formatGameDate: () => "" }));
vi.mock("@/locales", () => ({ getTranslations: () => ({ playerDetail: {} }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/image", () => ({ default: (props: { src: string; alt: string }) => createElement("img", { src: props.src, alt: props.alt }) }));
vi.mock("next/link", () => ({ default: (props: { href: string; children: ReactNode }) => createElement("a", { href: props.href }, props.children) }));
vi.mock("@/components/player/PlayerProfilePanels", () => ({
  default: ({ header, children }: { header: ReactNode; children: ReactNode }) => createElement("main", null, header, children),
  PlayerProfilePart: ({ children }: { children: ReactNode }) => children,
  PlayerDesktopOnly: ({ children }: { children: ReactNode }) => children,
  PlayerDeferred: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/player/player-mobile.module.css", () => ({ default: {} }));
vi.mock("@/components/player/PlayerSeasonStats", () => ({ default: () => null }));
vi.mock("@/components/player/PlayerMobileSummary", () => ({ default: () => null }));
vi.mock("@/components/player/ArchivedPlayerProfile", () => ({ default: () => null }));
vi.mock("@/components/player/PlayerOptionalDetails", () => ({ default: () => null }));
vi.mock("@/components/FavoriteButton", () => ({ default: () => null }));
vi.mock("@/components/ShareButton", () => ({ default: () => null }));
vi.mock("@/components/Breadcrumbs", () => ({ default: () => null }));
vi.mock("@/components/RelatedPages", () => ({ default: () => null }));
vi.mock("@/components/RecentVisitTracker", () => ({ default: () => null }));
vi.mock("@/components/PlayerHeadshot", () => ({ default: () => null }));
vi.mock("@/components/CountUpNumber", () => ({ default: () => null }));

import PlayerPage, { generateMetadata } from "@/app/player/[id]/page";

const rows = playerIndex.resultSets[0].rowSet;
function playerFromRow(row: typeof rows[number]) {
  return { personId: row[0], lastName: row[1], firstName: row[2], slug: row[3], teamId: row[4], teamCity: row[7], teamName: row[8], teamAbbr: row[9], jersey: row[10], position: row[11], height: row[12], weight: row[13], college: row[14], country: row[15], draftYear: row[16], draftRound: row[17], draftNumber: row[18], fromYear: row[20], toYear: row[21], pts: row[22], reb: row[23], ast: row[24] };
}
function selectPlayer(id: number, overrides = {}, provenance = {}) {
  const player = { ...playerFromRow(rows.find(row => row[0] === id)!), ...overrides };
  state.profile = { snapshot: { players: [player], provenance: { source: "bundled-archive", season: "2025-26", stale: true, retrievedAt: null, ...provenance } }, identity: { id, name: `${player.firstName} ${player.lastName}`, href: `/player/${id}` } };
  return { params: Promise.resolve({ id: String(id) }) };
}
function structuredData(node: ReactNode): Record<string, unknown> | null {
  if (!isValidElement(node)) return null;
  const props = node.props as { type?: string; dangerouslySetInnerHTML?: { __html: string }; children?: ReactNode };
  if (props.type === "application/ld+json") return JSON.parse(props.dangerouslySetInnerHTML!.__html);
  for (const child of Array.isArray(props.children) ? props.children : [props.children]) {
    const data = structuredData(child);
    if (data) return data;
  }
  return null;
}
beforeEach(() => { state.locale = "en"; });

describe("player profile team identity", () => {
  it.each([
    ["en", "Team not listed in this snapshot"],
    ["zh", "此快照未列出球队"],
  ] as const)("uses an honest %s fallback for Chris Paul in metadata and both headers", async (locale, label) => {
    state.locale = locale;
    const params = selectPlayer(101108);
    const metadata = await generateMetadata(params);
    expect(metadata.title).toBe(`Chris Paul — ${label}`);
    expect(metadata.description).toContain(label);
    expect(metadata.description).not.toContain("null");
    const page = await PlayerPage(params);
    const html = renderToStaticMarkup(page);
    expect(html.split(label).length - 1).toBe(2);
    expect(html).not.toContain('href="/team/null"');
    expect(html).not.toContain("/logos/nba/0/");
    expect(html).not.toContain("null null");
    expect(structuredData(page)).not.toHaveProperty("affiliation");
  });
  it("preserves a listed team, links, and logos without asserting archived affiliation as current", async () => {
    const params = selectPlayer(2544);
    const metadata = await generateMetadata(params);
    expect(metadata.title).toBe("LeBron James — Los Angeles Lakers");
    const page = await PlayerPage(params);
    const html = renderToStaticMarkup(page);
    expect(html).toContain('href="/team/LAL"');
    expect(html).toContain("/logos/nba/1610612747/");
    expect(html).toContain("Los Angeles Lakers");
    expect(structuredData(page)).not.toHaveProperty("affiliation");
  });
  it.each([
    [{ teamCity: null, teamName: "Lakers" }, "Lakers"],
    [{ teamCity: "Los Angeles", teamName: null }, "Los Angeles"],
    [{ teamCity: "  ", teamName: " Lakers " }, "Lakers"],
    [{ teamCity: undefined, teamName: undefined, teamAbbr: null, teamId: 0 }, "Team not listed in this snapshot"],
  ])("does not interpolate missing partial team fields", async (overrides, label) => {
    const params = selectPlayer(2544, overrides);
    expect((await generateMetadata(params)).title).toBe(`LeBron James — ${label}`);
    const html = renderToStaticMarkup(await PlayerPage(params));
    expect(html).toContain(label);
    expect(html).not.toMatch(/null null|undefined undefined/);
  });
  it("does not invent structured team affiliation for a fresh index with no team name", async () => {
    const params = selectPlayer(2544, { teamCity: null, teamName: null }, { source: "nba-cdn", stale: false, season: currentSeason() });
    expect(structuredData(await PlayerPage(params))).not.toHaveProperty("affiliation");
  });
  it("preserves supported fresh structured affiliation with a partial team name", async () => {
    const params = selectPlayer(2544, { teamCity: null }, { source: "nba-cdn", stale: false, season: currentSeason() });
    expect(structuredData(await PlayerPage(params))?.affiliation).toEqual({ "@type": "SportsTeam", name: "Lakers", url: "https://nba.xpy.me/team/LAL" });
  });
  it("renders a meaningful team label for all 57 unassigned archive entries", async () => {
    const unassigned = rows.filter(row => !row[7] && !row[8]);
    expect(unassigned).toHaveLength(57);
    for (const row of unassigned) {
      const params = selectPlayer(Number(row[0]));
      expect((await generateMetadata(params)).title).toBe(`${row[2]} ${row[1]} — Team not listed in this snapshot`);
      const html = renderToStaticMarkup(await PlayerPage(params));
      expect(html.split("Team not listed in this snapshot").length - 1).toBe(2);
      expect(html).not.toContain('href="/team/null"');
      expect(html).not.toContain("/logos/nba/0/");
    }
  });
});
