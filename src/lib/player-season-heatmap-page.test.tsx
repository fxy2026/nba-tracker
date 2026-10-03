import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ id: 201939, locale: "en" }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => state.locale }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("./api")>(), getPlayerIndexSnapshot: async () => ({
  players: [{ personId: state.id, firstName: "Stephen", lastName: "Curry", teamId: 1610612744, teamAbbr: "GSW", teamCity: "Golden State", teamName: "Warriors", jersey: "30", position: "G", fromYear: "2009", toYear: "2025", pts: null, reb: null, ast: null }],
  provenance: { source: "bundled-archive", season: "2025-26", stale: true, retrievedAt: null },
}) }));
import Page from "@/app/player/[id]/page";
function elements(node: ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node as React.ReactElement<Record<string, unknown>>, ...elements(node.props.children)];
}

describe("player-page verified season heatmap integration", () => {
  it.each(["en", "zh"])("seeds current Curry counts and only two registered regular seasons (%s)", async locale => {
    state.id = 201939; state.locale = locale;
    const nodes = elements(await Page({ params: Promise.resolve({ id: "201939" }) }));
    const panel = nodes.find(node => node.props.initialResource)!;
    expect(panel).toBeDefined();
    expect(panel.props.locale).toBe(locale);
    expect(panel.props.initialSelection).toEqual({ playerId: 201939, season: "2025-26", seasonType: "Regular Season" });
    expect(panel.props.initialResource).toMatchObject({ status: "ready", data: { status: "verified-aggregate", totals: { fgm: 374, fga: 799 } } });
    expect(panel.props.datasets).toEqual([
      { playerId: 201939, season: "2025-26", seasonType: "Regular Season", availability: "available" },
      { playerId: 201939, season: "2015-16", seasonType: "Regular Season", availability: "available" },
    ]);
    expect(nodes.filter(node => node.props.fromYear !== undefined)).toHaveLength(0);
    // Career / advanced stats still receive the same player and team props.
    expect(nodes.filter(node => node.props.playerId === 201939 && node.props.playerName === "Stephen Curry" && node.props.teamTricode === "GSW")).toHaveLength(2);
    expect(JSON.stringify(panel.props)).not.toMatch(/evidenceSha256|factsSha256|review|publicationStatus|rawPointCoverage|sourceOrder|pathD/);
  });
  it.each([2544, 203999, 977])("retains the existing partial legacy component for unsupported player %s", async id => {
    state.id = id;
    const nodes = elements(await Page({ params: Promise.resolve({ id: String(id) }) }));
    expect(nodes.some(node => node.props.initialResource !== undefined)).toBe(false);
    const panel = nodes.find(node => node.props.fromYear !== undefined)!;
    expect(panel.props).toMatchObject({ playerId: id, teamTricode: "GSW", fromYear: "2009", toYear: "2025" });
    expect(panel.key).toBe(`${id}:2009:2025`);
  });
});
