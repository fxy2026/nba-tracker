import { readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveRobots, resolveSitemap } from "next/dist/build/webpack/loaders/metadata/resolve-route-data";
import registry from "@/data/player-identity/official-all-player-identities.compact.json";
import playerIndex from "@/data/playerindex-2025-26.json";
import schedule from "@/data/schedule-2025-26.json";
import aliases from "@/data/archive-game-aliases.json";
import { ALL_TIME_LEADERS } from "./allTimeLeaders";
import { GAME_DECADES, SEASON_DECADES } from "./decades";
import { TEAM_META } from "./teams";

vi.mock("server-only", () => ({}));
// These modules contain live fallbacks. Enumeration must not import them,
// even if a particular fallback would happen to return a local value today.
vi.mock("@/lib/api", () => { throw new Error("Sitemap must not load the live API module"); });
vi.mock("@/lib/player-identity-server", () => { throw new Error("Sitemap must not load optional profile data"); });
import sitemap, { dynamic } from "@/app/sitemap";
import robots from "@/app/robots";
import { getSitemapGameCatalog, sitemapGameCatalog } from "./sitemap-catalog";

const BASE = "https://nba.xpy.me";
const paths = () => sitemap().map(entry => new URL(entry.url).pathname);
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("search-engine sitemap", () => {
  it("is complete, deterministic and network-free with upstream APIs unavailable", () => {
    const fetch = vi.fn(() => { throw new Error("No upstream requests permitted"); });
    vi.stubGlobal("fetch", fetch);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T00:00:00Z"));
    const first = sitemap();
    vi.setSystemTime(new Date("2026-11-04T00:00:00Z"));
    expect(sitemap()).toEqual(first);
    expect(fetch).not.toHaveBeenCalled();
    expect(dynamic).toBe("error");
    expect(first.length).toBeGreaterThan(6600);
    expect(first.every(entry => entry.lastModified === undefined)).toBe(true);
  });

  it("covers all 5,238 canonical registry profiles and every bundled identity source", () => {
    const ids = new Set(registry.rows.map(row => row[0]));
    const profiles = paths().filter(path => path.startsWith("/player/"));
    expect(profiles).toHaveLength(5238);
    expect(new Set(profiles)).toEqual(new Set([...ids].map(id => `/player/${id}`)));
    const catalog = JSON.parse(gunzipSync(readFileSync("src/data/historical-shot-archive/player-season-catalog.json.gz")).toString());
    // Fail visibly if a new local identity source outgrows the registry.
    const otherIds = [
      ...playerIndex.resultSets[0].rowSet.map(row => Number(row[0])),
      ...ALL_TIME_LEADERS.map(player => player.personId),
      ...Object.keys(catalog.players).map(Number),
    ];
    expect(otherIds.filter(id => !ids.has(id))).toEqual([]);
    expect(profiles).not.toContain("/player/0");
  });

  it("advertises exactly the concrete local games and completed playoff series", () => {
    const catalog = getSitemapGameCatalog();
    // Current archive: 1,230 regular + 85 playoff + 6 play-in + 1 Cup final.
    expect(catalog.games).toHaveLength(1322);
    expect(catalog.seriesIds).toHaveLength(15);
    const urls = paths();
    expect(urls.filter(path => path.startsWith("/game/"))).toEqual(catalog.games.map(game => `/game/${game.id}`));
    expect(urls.filter(path => path.startsWith("/series/"))).toEqual(catalog.seriesIds.map(id => `/series/${id}`));
    for (const alias of Object.keys(aliases)) expect(urls).not.toContain(`/game/${alias}`);
    expect(catalog.games.every(game => game.finished)).toBe(true);
  });

  it("deduplicates identities and rejects placeholders, exhibitions and unsupported teams", () => {
    const example = schedule.dates.flatMap(day => day.games).find(game => game.gameId.startsWith("002"))!;
    const final = { ...example, gameId: "0042600101", gameStatus: 3 };
    const rows = [
      final, final,
      { ...final, gameStatus: 1 },
      { ...final, gameId: "0042600102", ifNecessary: true, gameStatus: 1 },
      { ...final, gameId: "0042600103", ifNecessary: true, gameStatus: 3 },
      { ...final, gameId: "0042600111", gameStatus: 1 },
      { ...final, gameId: "0022600001", gameStatus: 1 },
      { ...final, gameId: "0022600002", gameStatus: 2 },
      { ...final, gameId: "0012600001" },
      { ...final, gameId: "0032600001" },
      { ...final, gameId: "1522600001" },
      { ...final, gameId: "9401810012" },
      { ...final, gameId: "planned-2026-27-1" },
      { ...final, gameId: "0022600003", homeTeam: { teamId: 0, teamTricode: "TBD" } },
      { ...final, gameId: "0022600004", homeTeam: final.awayTeam },
      { ...final, gameId: "0022600005", gameStatus: 0 },
    ];
    const result = sitemapGameCatalog([{ games: rows }]);
    expect(result.games.map(game => game.id)).toEqual(["0022600001", "0022600002", "0042600101", "0042600103", "0042600111"]);
    expect(result.games.find(game => game.id === final.gameId)?.finished).toBe(true);
    expect(result.seriesIds).toEqual(["004260010"]);
  });

  it("lists current team canonicals and only populated decade landing pages", () => {
    const urls = paths();
    expect(urls.filter(path => path.startsWith("/team/"))).toEqual(Object.keys(TEAM_META).map(code => `/team/${code}`));
    expect(urls.filter(path => path.startsWith("/team/"))).toHaveLength(30);
    expect(urls.filter(path => path.startsWith("/iconic-games/"))).toEqual(GAME_DECADES.map(decade => `/iconic-games/${decade}`));
    expect(urls.filter(path => path.startsWith("/iconic-seasons/"))).toEqual(SEASON_DECADES.map(decade => `/iconic-seasons/${decade}`));
    expect(urls).not.toContain("/iconic-games/1970s");
  });

  it("keeps real public hubs and excludes personalized, noindex and alternate routes", () => {
    const urls = paths();
    expect(urls).toContain("/shot-archive");
    // These root pages are real browse/tool landings, not query permutations.
    for (const path of ["/search", "/compare", "/lab", "/lab/career-arc", "/lab/game-impact", "/lab/explore"]) expect(urls).toContain(path);
    for (const path of ["/favorites", "/admin", "/offline", "/legends/893", "/shot-archive/893", "/player/893/gamelog"]) expect(urls).not.toContain(path);
    const hubs = urls.filter(path => !/^\/(?:player|team|game|series)\//.test(path) && !/^\/iconic-(?:games|seasons)\//.test(path));
    for (const path of hubs) {
      const file = `src/app${path === "/" ? "" : path}/page.tsx`;
      expect(existsSync(file), path).toBe(true);
      expect(readFileSync(file, "utf8"), path).not.toMatch(/robots:\s*\{[^}]*index:\s*false/);
    }
  });

  it("serializes one valid-size root sitemap with unique absolute canonical URLs", () => {
    const entries = sitemap();
    const urls = entries.map(entry => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      const parsed = new URL(url);
      expect(parsed.origin).toBe(BASE);
      expect(parsed.search).toBe("");
      expect(parsed.hash).toBe("");
    }
    const xml = resolveSitemap(entries);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.match(/<loc>/g)).toHaveLength(entries.length);
    expect(xml).not.toContain("<lastmod>");
    // A growing catalog must be split before violating the protocol limits.
    expect(entries.length).toBeLessThanOrEqual(50_000);
    expect(Buffer.byteLength(xml, "utf8")).toBeLessThanOrEqual(50 * 1024 * 1024);
  });

  it("publishes sitemap discovery while allowing public rendering assets", () => {
    const text = resolveRobots(robots());
    expect(text).toContain(`Sitemap: ${BASE}/sitemap.xml`);
    expect(text).toContain("Allow: /");
    expect(text).toContain("Disallow: /api/");
    expect(text).toContain("Disallow: /admin$");
    expect(text).toContain("Disallow: /admin/");
    expect(text).toContain("Disallow: /?date=");
    expect(text).not.toContain("Disallow: /_next/");
  });
});
