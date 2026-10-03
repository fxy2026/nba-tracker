import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SeasonHeatmapArchiveResource, SeasonHeatmapCatalogEntry } from "@/lib/season-heatmap";

type ArchivedPlayer = { playerId: number; name: string; firstSeason: string; lastSeason: string; datasetCount: number };
type SearchResult = { status: "ready"; players: ArchivedPlayer[]; total: number; page: number; pageSize: number; seasonCount: number; archiveCount: number } | { status: "error" };
const state = vi.hoisted(() => ({
  locale: "en" as "en" | "zh",
  search: { status: "error" } as SearchResult,
  player: null as ArchivedPlayer | null,
  catalog: [] as (SeasonHeatmapCatalogEntry & { privateEvidence?: string })[],
  resource: { status: "error" } as SeasonHeatmapArchiveResource,
  searchPlayers: vi.fn(), getPlayer: vi.fn(), getCatalog: vi.fn(), loadArchive: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/locale", () => ({ getLocale: async () => state.locale }));
vi.mock("@/lib/historical-shot-archive", () => ({
  searchHistoricalShotPlayers: (...args: unknown[]) => { state.searchPlayers(...args); return Promise.resolve(state.search); },
  getHistoricalShotPlayer: (...args: unknown[]) => { state.getPlayer(...args); return Promise.resolve(state.player); },
}));
vi.mock("@/lib/season-heatmap-catalog-server", () => ({
  getPlayerSeasonHeatmapCatalog: (...args: unknown[]) => { state.getCatalog(...args); return Promise.resolve(state.catalog); },
  loadPlayerSeasonHeatmapArchive: (...args: unknown[]) => { state.loadArchive(...args); return Promise.resolve(state.resource); },
}));
vi.mock("@/components/player/PlayerSeasonHeatmap", () => ({ default: () => <div data-testid="season-heatmap" /> }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

import Directory from "./page";
import PlayerPage from "./[id]/page";

function elements(node: ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node as React.ReactElement<Record<string, unknown>>, ...elements(node.props.children)];
}
const directory = (query: { q?: string | string[]; page?: string | string[] } = {}) => Directory({ searchParams: Promise.resolve(query) });
const playerPage = (id = "977") => PlayerPage({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  state.locale = "en";
  state.player = { playerId: 977, name: "Kobe Bryant", firstSeason: "2005-06", lastSeason: "2015-16", datasetCount: 20 };
  state.search = { status: "ready", players: [state.player], total: 1, page: 1, pageSize: 48, seasonCount: 21, archiveCount: 42 };
  state.catalog = [
    { playerId: 977, season: "2015-16", seasonType: "Regular Season", availability: "available", privateEvidence: "do-not-serialize" },
    { playerId: 977, season: "2014-15", seasonType: "Regular Season", availability: "available" },
  ];
  state.resource = { status: "error" };
});

describe("historical shot archive directory", () => {
  it.each(["en", "zh"] as const)("renders source-scoped coverage and dedicated historical-player links (%s)", async locale => {
    state.locale = locale;
    const page = await directory();
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Kobe Bryant");
    expect(html).toContain('href="/shot-archive/977"');
    expect(html).toContain("2005–2025");
    expect(html).not.toContain("1996–2025");
    expect(html).toContain(locale === "zh" ? "并不表示零次出手" : "never zero attempts");
    expect(html).toContain(locale === "zh" ? "可能不完整" : "may be incomplete");
    expect(html).toContain(locale === "zh" ? "对应来源、赛季及赛事类型" : "corresponding source, season, and season type");
    const link = elements(page).find(node => node.props.href === "/shot-archive/977");
    expect(link?.props.prefetch).toBe(false);
    expect(state.searchPlayers).toHaveBeenCalledExactlyOnceWith("", 1);
    expect(state.loadArchive).not.toHaveBeenCalled();
  });

  it("uses a GET search form and safely encodes query-preserving pagination", async () => {
    if (state.search.status !== "ready") throw new Error("Invalid fixture");
    state.search.total = 140; state.search.page = 2;
    const page = await directory({ q: "  O'Neal & <M>  ", page: "2" });
    const nodes = elements(page), html = renderToStaticMarkup(page);
    expect(state.searchPlayers).toHaveBeenCalledExactlyOnceWith("O'Neal & <M>", 2);
    expect(nodes.find(node => node.type === "form")?.props).toMatchObject({ method: "get", action: "/shot-archive", role: "search" });
    expect(nodes.find(node => node.props.name === "q")?.props).toMatchObject({ defaultValue: "O'Neal & <M>", maxLength: 100 });
    expect(nodes.some(node => node.props.name === "page")).toBe(false);
    expect(nodes.find(node => node.props.rel === "prev")?.props.href).toBe("/shot-archive?q=O%27Neal+%26+%3CM%3E");
    expect(nodes.find(node => node.props.rel === "next")?.props.href).toBe("/shot-archive?q=O%27Neal+%26+%3CM%3E&page=3");
    expect(html).toContain("&lt;M&gt;");
    expect(html).not.toContain("<M>");
  });

  it.each(["-1", "0", "Infinity", "2junk", "9007199254740992", ["1", "2"]])("normalizes invalid page input %s", async page => {
    await directory({ q: ["Kobe", "Curry"], page });
    expect(state.searchPlayers).toHaveBeenCalledExactlyOnceWith("", 1);
  });

  it("caps search input and renders only the server-provided result page", async () => {
    if (state.search.status !== "ready") throw new Error("Invalid fixture");
    state.search.total = 1000;
    state.search.players = Array.from({ length: 48 }, (_, i) => ({ playerId: i + 1, name: `Archived Player ${i + 1}`, firstSeason: "2005-06", lastSeason: "2006-07", datasetCount: 2 }));
    const nodes = elements(await directory({ q: "a".repeat(150) }));
    expect(state.searchPlayers).toHaveBeenCalledExactlyOnceWith("a".repeat(100), 1);
    expect(nodes.filter(node => typeof node.props.href === "string" && /^\/shot-archive\/\d+$/.test(node.props.href))).toHaveLength(48);
    expect(state.getCatalog).not.toHaveBeenCalled();
    expect(state.loadArchive).not.toHaveBeenCalled();
  });

  it("offers only forward navigation on the first page and backward on the last", async () => {
    if (state.search.status !== "ready") throw new Error("Invalid fixture");
    state.search.total = 96;
    const first = elements(await directory());
    expect(first.some(node => node.props.rel === "prev")).toBe(false);
    expect(first.find(node => node.props.rel === "next")?.props.href).toBe("/shot-archive?page=2");
    state.search.page = 2;
    const last = elements(await directory({ page: "2" }));
    expect(last.find(node => node.props.rel === "prev")?.props.href).toBe("/shot-archive");
    expect(last.some(node => node.props.rel === "next")).toBe(false);
  });

  it("separates no matches from a failed archive load", async () => {
    state.search = { status: "ready", players: [], total: 0, page: 1, pageSize: 48, seasonCount: 21, archiveCount: 42 };
    const empty = renderToStaticMarkup(await directory({ q: "unlisted" }));
    expect(empty).toContain("No matching archived players");
    expect(empty).not.toContain("directory pagination");
    state.search = { status: "error" };
    const error = renderToStaticMarkup(await directory({ q: "Kobe", page: "2" }));
    expect(error).toContain('role="alert"');
    expect(error).toContain("loading error, not an absence");
    expect(error).toContain('href="/shot-archive?q=Kobe&amp;page=2"');
    expect(error).not.toContain("No matching archived players");
    expect(error).not.toContain("Archived players</dt>");
  });
});

describe("historical player shot page", () => {
  it.each(["en", "zh"] as const)("loads a historical identity without consulting the active player index (%s)", async locale => {
    state.locale = locale;
    const page = await playerPage();
    const html = renderToStaticMarkup(page);
    const panel = elements(page).find(node => node.props.initialResource)!;
    expect(state.getPlayer).toHaveBeenCalledExactlyOnceWith(977);
    expect(state.getCatalog).toHaveBeenCalledExactlyOnceWith(977);
    expect(state.loadArchive).toHaveBeenCalledExactlyOnceWith({ playerId: 977, season: "2015-16", seasonType: "Regular Season" });
    expect(panel.props.player).toEqual({ id: 977, name: "Kobe Bryant" });
    expect(panel.props.locale).toBe(locale);
    expect(panel.props.initialSelection).toEqual({ playerId: 977, season: "2015-16", seasonType: "Regular Season" });
    expect(panel.props.initialResource).toEqual({ status: "error" });
    expect(panel.props.datasets).toEqual(state.catalog.map(({ playerId, season, seasonType, availability }) => ({ playerId, season, seasonType, availability })));
    expect(JSON.stringify(panel.props)).not.toMatch(/privateEvidence|do-not-serialize|biography|teamLabel|fromYear|toYear/);
    expect(html).toContain("Kobe Bryant");
    expect(html).toContain(locale === "zh" ? "并非球员生涯起止年份" : "not the player&#x27;s career");
  });

  it("never seeds another player's identity or a private catalog field", async () => {
    state.catalog.unshift({ playerId: 201939, season: "2025-26", seasonType: "Regular Season", availability: "available", privateEvidence: "private" });
    const panel = elements(await playerPage()).find(node => node.props.initialResource)!;
    expect(panel.props.datasets).toHaveLength(2);
    expect(state.loadArchive).toHaveBeenCalledExactlyOnceWith({ playerId: 977, season: "2015-16", seasonType: "Regular Season" });
    expect(JSON.stringify(panel.props)).not.toContain("201939");
  });

  it("renders unavailable when a listed player's catalog has no loadable entry", async () => {
    state.catalog = [];
    const page = await playerPage();
    expect(elements(page).some(node => node.props.initialResource)).toBe(false);
    expect(renderToStaticMarkup(page)).toContain("does not mean zero attempts");
    expect(state.loadArchive).not.toHaveBeenCalled();
  });

  it.each(["abc", "977junk", "-977", "0", "0977", "9007199254740992"])("rejects malformed player identity %s before loading", async id => {
    await expect(playerPage(id)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(state.getPlayer).not.toHaveBeenCalled();
    expect(state.getCatalog).not.toHaveBeenCalled();
  });

  it("returns not found for an unknown historical player without loading shot data", async () => {
    state.player = null;
    await expect(playerPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(state.getCatalog).not.toHaveBeenCalled();
    expect(state.loadArchive).not.toHaveBeenCalled();
  });
});
