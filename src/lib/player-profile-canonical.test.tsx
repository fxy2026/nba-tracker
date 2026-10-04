import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import index from "@/data/playerindex-2025-26.json";
import type { PlayerInfo } from "./api";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ locale: "en" as "en" | "zh", careerUnavailable: false }));
vi.mock("@/lib/historical-career-archive", async original => {
  const originalArchive = await original<typeof import("./historical-career-archive")>();
  return { ...originalArchive, getHistoricalCareerArchive: async (id: number) => state.careerUnavailable ? null : originalArchive.getHistoricalCareerArchive(id) };
});
vi.mock("@/lib/locale", () => ({ getLocale: async () => state.locale }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("./api")>(), getPlayerIndexSnapshot: async () => ({ players: index.resultSets[0].rowSet.map(r => ({ personId: r[0], lastName: r[1], firstName: r[2], slug: r[3], teamId: r[4], teamAbbr: r[9], teamCity: r[7], teamName: r[8], jersey: r[10], position: r[11], height: r[12], weight: r[13], college: r[14], country: r[15], draftYear: r[16], draftRound: r[17], draftNumber: r[18], fromYear: r[20], toYear: r[21], pts: r[22], reb: r[23], ast: r[24] } as PlayerInfo)), provenance: { source: "bundled-archive", season: "2025-26", stale: true, retrievedAt: null } }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="deferred-current-panel" /> }));
vi.mock("@/components/FavoriteButton", () => ({ default: () => <button>Favorite</button> }));
vi.mock("@/components/ShareButton", () => ({ default: () => <button>Share</button> }));
vi.mock("@/components/RecentVisitTracker", () => ({ default: () => null }));
vi.mock("@/components/PlayerHeadshot", () => ({ default: () => <span data-testid="headshot" /> }));
vi.mock("@/components/CountUpNumber", () => ({ default: ({ value }: { value: number }) => <span>{value}</span> }));
vi.mock("@/components/player/PlayerSeasonHeatmap", () => ({ default: ({ initialSelection }: { initialSelection: { season: string } }) => <div data-testid="shooting-explorer">{initialSelection.season}</div> }));
import Page, { generateMetadata } from "@/app/player/[id]/page";
import ArchivedPlayerProfile from "@/components/player/ArchivedPlayerProfile";
import { canonicalPlayerArchiveHref, playerShootingSelection } from "./player-profile-navigation";
function elements(node: ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node as React.ReactElement<Record<string, unknown>>, ...elements(node.props.children)];
}
const page = (id: number | string, query = {}) => Page({ params: Promise.resolve({ id: String(id) }), searchParams: Promise.resolve(query) });
beforeEach(() => { state.locale = "en"; state.careerUnavailable = false; });
describe("one canonical player home", () => {
  it.each([[201939, "Curry"], [977, "Kobe Bryant"], [15, "Eric Piatkowski"], [893, "Michael Jordan"], [1642850, "Sorber"], [901, "Otis Thorpe"], [76681, "Julius Erving"]])("server-renders genuine profile %s", async (id, name) => {
    const tree = await page(id); const html = renderToStaticMarkup(tree);
    expect(html).toContain(name); expect(html).toContain('id="shooting"'); expect(html).toContain('href="#shooting"');
    expect(html).toContain('id="career"'); expect(html).not.toContain("NEXT_NOT_FOUND");
    const metadata = await generateMetadata({ params: Promise.resolve({ id: String(id) }) });
    expect(metadata.alternates?.canonical).toBe(`/player/${id}`);
  });
  it.each(["en", "zh"] as const)("renders source-scoped archive-only biography without invented statistics (%s)", async locale => {
    state.locale = locale; const tree = await page(15); expect(tree.type).toBe(ArchivedPlayerProfile);
    const html = renderToStaticMarkup(tree);
    expect(html).toContain(locale === "zh" ? "此来源未收录个人资料" : "Biographical details");
    expect(html).toContain(locale === "zh" ? "不是生涯起止年份" : "not career dates");
    expect(html).toContain("1996-97"); expect(html).toContain("1994"); expect(html).toContain("2026-10-03");
    expect(html).not.toContain("PPG"); expect(html).not.toContain("0.0"); expect(html).not.toContain("undefined");
  });
  it("Jordan now gets a profile with six genuinely recorded shooting selections", async () => {
    const tree = await page(893); const html = renderToStaticMarkup(tree);
    expect(html).toContain("Michael Jordan"); expect(html).toContain('data-testid="shooting-explorer"');
    expect(tree.props.catalog).toHaveLength(6);
    expect(tree.props.initialSelection).toEqual({ playerId: 893, season: "2002-03", seasonType: "Regular Season" });
    expect(html).toContain("Existing curated career summary"); expect(html).toContain("30.1");
  });
  it.each(["en", "zh"] as const)("integrates Jordan season totals into the canonical page without hiding shot availability (%s)", async locale => {
    state.locale = locale;
    const tree = await page(893); const html = renderToStaticMarkup(tree);
    expect(tree.props.historicalCareer.rows).toHaveLength(28);
    expect(html).toContain('data-historical-career="893"');
    expect(html).toContain("1984-85"); expect(html).toContain("2002-03");
    expect(html).toContain('data-testid="shooting-explorer"');
    expect(tree.props.initialResource).toMatchObject({ status: "ready", data: { totals: { fgm: 679, fga: 1527 } } });
    expect(html).not.toContain(locale === "zh" ? "完整逐赛季生涯表暂未收录" : "A complete season-by-season career table has not been recorded");
    expect(html.indexOf('id="career"')).toBeLessThan(html.indexOf('id="shooting"'));
    expect(JSON.stringify(tree.props.historicalCareer)).not.toMatch(/evidenceSha256|publishedCareerTotals|sourceObservations/);
  });
  it.each([[76003, "Kareem Abdul-Jabbar", 38], [76375, "Wilt Chamberlain", 27]])("integrates early-era profile %s with genuine played rows", async (id, name, rowCount) => {
    const tree = await page(id); const html = renderToStaticMarkup(tree);
    expect(tree.props.historicalCareer.rows).toHaveLength(rowCount);
    expect(tree.props.historicalCareer.retrievalPrecision).toBe("approximate-minute");
    expect(html).toContain(name); expect(html).toContain(`data-historical-career="${id}"`);
    expect(html).toContain("categories not recorded at the time");
    expect(html).toContain("Missing records do not mean zero attempts");
    expect(html).not.toContain("A complete season-by-season career table has not been recorded");
  });
  it("retains the usable canonical profile when the historical archive fails validation or loading", async () => {
    state.careerUnavailable = true;
    const tree = await page(893); const html = renderToStaticMarkup(tree);
    expect(tree.props.historicalCareer).toBeNull();
    expect(html).toContain("Michael Jordan"); expect(html).toContain("Existing curated career summary");
    expect(html).toContain("A complete season-by-season career table has not been recorded");
    expect(html).not.toContain("data-historical-career");
    expect(html).toContain('data-testid="shooting-explorer"');
    expect(tree.props.catalog).toHaveLength(6);
  });
  it("preserves current rich stats props and places shooting before the long career table", async () => {
    const tree = await page(201939); const nodes = elements(tree);
    expect(nodes.filter(node => node.props.playerId === 201939 && node.props.playerName === "Stephen Curry" && node.props.teamTricode === "GSW")).toHaveLength(2);
    expect(nodes.findIndex(node => node.props.id === "shooting")).toBeLessThan(nodes.findIndex(node => node.props.id === "career"));
    expect(nodes.find(node => node.props.initialResource)?.props.initialResource).toMatchObject({ status: "ready", data: { totals: { fga: 799 } } });
  });
  it("a no-appearance indexed player is not assigned a played-season count or activity status", async () => {
    const html = renderToStaticMarkup(await page(1642850));
    expect(html).toContain("Indexed season starts"); expect(html).not.toMatch(/\d+ yrs|NBA seasons|>Active</);
  });
  it("supports a valid shooting deep link and projects only player-scoped catalog metadata", async () => {
    const tree = await page(977, { season: "2009-10", seasonType: "Playoffs" });
    expect(tree.props.initialSelection).toEqual({ playerId: 977, season: "2009-10", seasonType: "Playoffs" });
    expect(tree.props.catalog.every((entry: { playerId: number }) => entry.playerId === 977)).toBe(true);
    expect(JSON.stringify(tree.props.catalog)).not.toMatch(/sha256|sourceUrl|privateEvidence|fgm|fga/);
  });
  it.each(["999999999", "977junk", "0", "-1", "0977"])("unknown or malformed profile %s remains not-found", async id => { await expect(page(id)).rejects.toThrow("NEXT_NOT_FOUND"); });
  it("only preserves catalogued season/type pairs in legacy redirects", () => {
    const catalog = [{ playerId: 15, season: "2007-08", seasonType: "Regular Season" as const, availability: "available" as const }];
    expect(canonicalPlayerArchiveHref(15, catalog, { season: "2007-08" })).toBe("/player/15?season=2007-08&seasonType=Regular+Season#shooting");
    expect(canonicalPlayerArchiveHref(15, catalog, { season: "2025-26", next: "https://evil.test" })).toBe("/player/15#shooting");
    expect(playerShootingSelection(999, catalog)).toBeNull();
  });
});
