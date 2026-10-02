import { Children, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { FollowDigest, TeamDigest } from "./follow-digest-types";
const h = vi.hoisted(() => ({ cursor: 0, slots: [] as unknown[], effects: [] as (() => void)[], locale: "en", teams: ["LAL", "BOS"], fetcher: vi.fn(), digest: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => { const i = h.cursor++; if (!(i in h.slots)) h.slots[i] = initial; return [h.slots[i], (v: unknown) => { h.slots[i] = typeof v === "function" ? v(h.slots[i]) : v; }]; },
  useRef: (initial: unknown) => { const i = h.cursor++; if (!(i in h.slots)) h.slots[i] = { current: initial }; return h.slots[i]; },
  useCallback: (fn: unknown) => fn,
  useEffect: (run: () => void | (() => void), deps: unknown[]) => { const i = h.cursor++; const old = h.slots[i] as { deps: unknown[]; cleanup?: () => void } | undefined; if (!old || deps.some((d, j) => !Object.is(d, old.deps[j]))) h.effects.push(() => { old?.cleanup?.(); h.slots[i] = { deps, cleanup: run() }; }); },
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: h.locale }) }));
vi.mock("@/components/TeamLogo", () => ({ default: () => null }));
vi.mock("@/components/PlayerHeadshot", () => ({ default: () => null }));
vi.mock("@/lib/favorites", () => ({ getFavoriteTeams: () => h.teams, getFavoritePlayers: () => [], toggleFavoriteTeam: (tri: string) => h.teams.filter(t => t !== tri), toggleFavoritePlayer: () => [] }));
import FavoritesDashboard from "@/app/favorites/FavoritesDashboard";
const team = (tricode: string, name: string): TeamDigest => ({ tricode, name, teamId: 1, city: tricode === "LAL" ? "Los Angeles" : "Boston", primaryColor: "#123456", conference: "West", wins: 40, losses: 20, recordSeason: "2025-26", conferenceRank: 3, streak: "W1", lastGame: null, nextGame: null, archived: true });
const initial: FollowDigest = { teams: [team("LAL", "Lakers"), team("BOS", "Celtics")], players: [] };
function nodes(node: ReactNode): { type: unknown; props: Record<string, unknown> }[] { const out: { type: unknown; props: Record<string, unknown> }[] = []; Children.forEach(node, c => { if (isValidElement<Record<string, unknown>>(c)) { out.push(c); out.push(...nodes(c.props.children as ReactNode)); } }); return out; }
// Execute the actual component and its dependency-change effects deterministically.
function render() { h.cursor = 0; const tree = FavoritesDashboard(); h.effects.splice(0).forEach(f => f()); return tree; }
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
const ok = (data: unknown) => ({ ok: true, json: async () => data });
function unmount() { for (const slot of h.slots) (slot as { cleanup?: () => void } | undefined)?.cleanup?.(); }
beforeEach(() => {
  h.cursor = 0; h.slots = []; h.effects = []; h.locale = "en"; h.teams = ["LAL", "BOS"]; h.fetcher.mockReset(); h.digest.mockReset();
  h.fetcher.mockImplementation((url: string) => url.startsWith("/api/follow-digest") ? h.digest() : Promise.resolve(ok({ data: [] })));
  vi.stubGlobal("fetch", h.fetcher);
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });

it.each(["en", "zh"])("keeps cached cards after a failed refresh and actual retry replaces them without news/injury fanout in %s", async language => {
  h.locale = language;
  h.digest.mockResolvedValueOnce(ok(initial)).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(ok({ teams: [team("LAL", "Recovered Lakers")], players: [] }));
  render(); render(); await settle(); let tree = render();
  const boston = nodes(tree).find(n => (n.props.team as TeamDigest | undefined)?.tricode === "BOS")!;
  (boston.props.onRemove as () => void)(); render(); await settle(); tree = render();
  const html = renderToStaticMarkup(tree);
  expect(html).toContain("Lakers"); expect(html).not.toContain("Celtics");
  expect(html).toContain(language === "zh" ? "仍显示上次加载的动态" : "Showing the last loaded feed");
  expect(html).toContain("2025-26");
  const sideCalls = h.fetcher.mock.calls.filter(([url]) => !String(url).startsWith("/api/follow-digest")).length;
  const retry = nodes(tree).find(n => n.type === "button" && n.props.children === (language === "zh" ? "重试" : "Retry"))!;
  (retry.props.onClick as () => void)(); render(); await settle(); tree = render();
  const recovered = renderToStaticMarkup(tree); expect(recovered).toContain("Recovered Lakers"); expect(recovered).not.toContain("Showing the last loaded feed"); expect(recovered).not.toContain("刷新失败");
  expect(h.digest).toHaveBeenCalledTimes(3);
  expect(h.fetcher.mock.calls.filter(([url]) => !String(url).startsWith("/api/follow-digest")).length).toBe(sideCalls);
});
it("initial failure has an actionable retry and preserved follows", async () => {
  h.digest.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(ok(initial));
  render(); render(); await settle(); let tree = render();
  expect(renderToStaticMarkup(tree)).toContain("Couldn&#x27;t load your feed");
  const retry = nodes(tree).find(n => n.type === "button" && n.props.children === "Retry")!;
  (retry.props.onClick as () => void)(); render(); await settle(); tree = render();
  expect(renderToStaticMarkup(tree)).toContain("Lakers"); expect(renderToStaticMarkup(tree)).toContain("Celtics");
  expect(h.teams).toEqual(["LAL", "BOS"]); expect(h.digest).toHaveBeenCalledTimes(2);
});
