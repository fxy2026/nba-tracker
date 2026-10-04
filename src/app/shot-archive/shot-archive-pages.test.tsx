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
vi.mock("@/lib/player-identity-server", () => ({ resolvePlayerIdentity: async (id: string) => parsePlayerId(id) !== null && state.player ? { id: state.player.playerId } : null }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); }, permanentRedirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); } }));

import Directory from "./page";
import { GET as redirectPlayer } from "./[id]/route";
import { parsePlayerId } from "@/lib/player-identity";

function elements(node: ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node as React.ReactElement<Record<string, unknown>>, ...elements(node.props.children)];
}
const directory = (query: { q?: string | string[]; page?: string | string[] } = {}) => Directory({ searchParams: Promise.resolve(query) });
const playerPage = (id = "977", query = "") => redirectPlayer(new Request(`https://nba.xpy.me/shot-archive/${id}${query}`), { params: Promise.resolve({ id }) });

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
    expect(html).toContain('href="/player/977#shooting"');
    expect(html).toContain("1996–2025");
    expect(html).not.toContain("2005–2025");
    expect(html).toContain(locale === "zh" ? "并不表示零次出手" : "never zero attempts");
    expect(html).toContain(locale === "zh" ? "可能不完整" : "may be incomplete");
    expect(html).toContain(locale === "zh" ? "对应来源、赛季及赛事类型" : "corresponding source, season, and season type");
    const link = elements(page).find(node => node.props.href === "/player/977#shooting");
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
    expect(nodes.filter(node => typeof node.props.href === "string" && /^\/player\/\d+#shooting$/.test(node.props.href))).toHaveLength(48);
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

describe("legacy historical shot links", () => {
  it("returns an actual HTTP 308 to the canonical player shooting section", async () => {
    const response = await playerPage();
    expect(response.status).toBe(308); expect(response.headers.get("location")).toBe("https://nba.xpy.me/player/977#shooting");
    expect(state.loadArchive).not.toHaveBeenCalled();
  });
  it("preserves a valid season selection without forwarding other query fields", async () => {
    const response = await playerPage("977", "?season=2014-15&seasonType=Regular+Season&next=https://untrusted.test");
    expect(response.status).toBe(308); expect(response.headers.get("location")).toBe("https://nba.xpy.me/player/977?season=2014-15&seasonType=Regular+Season#shooting");
  });
  it("discards repeated query selections", async () => {
    expect((await playerPage("977", "?season=2014-15&season=2015-16&seasonType=Playoffs")).headers.get("location")).toBe("https://nba.xpy.me/player/977#shooting");
  });
  it.each(["abc", "977junk", "-977", "0", "0977", "9007199254740992"])("rejects malformed player identity %s before loading", async id => {
    expect((await playerPage(id)).status).toBe(404); expect(state.getCatalog).not.toHaveBeenCalled();
  });
  it("returns not found for unknown players", async () => {
    state.player = null;
    expect((await playerPage()).status).toBe(404); expect(state.getCatalog).not.toHaveBeenCalled();
  });
});
