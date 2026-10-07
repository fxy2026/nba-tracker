import { Children, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FollowDigest, PlayerDigest, TeamDigest } from "./follow-digest-types";
import en from "@/locales/en";
import zh from "@/locales/zh";

const h = vi.hoisted(() => ({
  cursor: 0, slots: [] as unknown[], effects: [] as (() => void)[],
  locale: "en", toast: vi.fn(), fetcher: vi.fn(), setItem: vi.fn(),
}));
// Exercise the actual handlers/effects with mocked browser storage and transport.
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => { const i = h.cursor++; if (!(i in h.slots)) h.slots[i] = initial; return [h.slots[i], (v: unknown) => { h.slots[i] = typeof v === "function" ? v(h.slots[i]) : v; }]; },
  useRef: (initial: unknown) => { const i = h.cursor++; if (!(i in h.slots)) h.slots[i] = { current: initial }; return h.slots[i]; },
  useCallback: (fn: unknown) => fn,
  useEffect: (run: () => void | (() => void), deps: unknown[]) => { const i = h.cursor++; const old = h.slots[i] as { deps: unknown[]; cleanup?: () => void } | undefined; if (!old || deps.some((d, j) => !Object.is(d, old.deps[j]))) h.effects.push(() => { old?.cleanup?.(); h.slots[i] = { deps, cleanup: run() }; }); },
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: h.locale, t: h.locale === "zh" ? zh : en }) }));
vi.mock("@/components/ToastProvider", () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock("@/components/TeamLogo", () => ({ default: () => null }));
vi.mock("@/components/PlayerHeadshot", () => ({ default: () => null }));
import FavoritesDashboard from "@/app/favorites/FavoritesDashboard";
import FavoriteButton from "@/components/FavoriteButton";
import { getFavoriteTeams, getFavoritePlayers, toggleFavoriteTeam, toggleFavoritePlayer } from "./favorites";

const team: TeamDigest = { tricode: "LAL", name: "Lakers", teamId: 1, city: "Los Angeles", primaryColor: "#123456", conference: "West", wins: 40, losses: 20, recordSeason: "2025-26", conferenceRank: 3, streak: "W1", lastGame: null, nextGame: null, archived: true };
const player: PlayerDigest = { personId: 23, name: "Test Player", teamTricode: "LAL", teamId: 1, lastLine: null, nextGame: null, seasonAvg: null, provenance: null, currentTeamKnown: false };
const initial: FollowDigest = { teams: [team], players: [player] };
let storage: Map<string, string>;
function nodes(node: ReactNode): { type: unknown; props: Record<string, unknown> }[] { const out: { type: unknown; props: Record<string, unknown> }[] = []; Children.forEach(node, c => { if (isValidElement<Record<string, unknown>>(c)) { out.push(c); out.push(...nodes(c.props.children as ReactNode)); } }); return out; }
function render(component = () => FavoritesDashboard()) { h.cursor = 0; const tree = component(); h.effects.splice(0).forEach(f => f()); return tree; }
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function unmount() { for (const slot of h.slots) (slot as { cleanup?: () => void } | undefined)?.cleanup?.(); }
const warning = (locale: string) => locale === "zh" ? "无法保存关注更改，请检查浏览器存储后重试。" : "Couldn't save your follow changes. Check browser storage and try again.";

beforeEach(() => {
  Object.assign(h, { cursor: 0, slots: [], effects: [], locale: "en" });
  h.toast.mockReset(); h.fetcher.mockReset(); h.setItem.mockReset();
  storage = new Map([["fav_teams", '["LAL"]'], ["fav_players", "[23]"]]);
  h.setItem.mockImplementation((key: string, value: string) => storage.set(key, value));
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: h.setItem });
  h.fetcher.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.startsWith("/api/follow-digest") ? { teams: getFavoriteTeams().includes("LAL") ? initial.teams : [], players: getFavoritePlayers().includes(23) ? initial.players : [] } : { data: [] } }));
  vi.stubGlobal("fetch", h.fetcher);
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });

describe("favorite storage failures", () => {
  it.each(["QuotaExceededError", "SecurityError"])("reports rejected %s writes without pretending a team or player was saved", name => {
    h.setItem.mockImplementation(() => { throw new DOMException("Storage rejected", name); });
    expect(toggleFavoriteTeam("LAL")).toBeNull();
    expect(toggleFavoritePlayer(23)).toBeNull();
    expect(getFavoriteTeams()).toEqual(["LAL"]);
    expect(getFavoritePlayers()).toEqual([23]);
    expect(toggleFavoriteTeam("BOS")).toBeNull();
    expect(toggleFavoritePlayer(30)).toBeNull();
    expect(getFavoriteTeams()).toEqual(["LAL"]);
    expect(getFavoritePlayers()).toEqual([23]);
  });

  it("continues returning the persisted arrays on successful add/remove", () => {
    expect(toggleFavoriteTeam("BOS")).toEqual(["LAL", "BOS"]);
    expect(toggleFavoriteTeam("LAL")).toEqual(["BOS"]);
    expect(toggleFavoritePlayer(30)).toEqual([23, 30]);
    expect(toggleFavoritePlayer(23)).toEqual([30]);
    expect(getFavoriteTeams()).toEqual(["BOS"]);
    expect(getFavoritePlayers()).toEqual([30]);
  });

  it.each(["en", "zh"].flatMap(locale => ["team", "player"].map(type => ({ locale, type: type as "team" | "player" }))))("keeps the $type dashboard card after a rejected unfollow and recovers on retry in $locale", async ({ locale, type }) => {
    h.locale = locale;
    render(); render(); await settle(); let tree = render();
    const match = (node: { props: Record<string, unknown> }) => type === "team" ? !!node.props.team : !!node.props.player;
    const card = nodes(tree).find(match)!;
    const calls = h.fetcher.mock.calls.length;
    h.setItem.mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    (card.props.onRemove as () => void)(); tree = render();
    expect(nodes(tree).filter(match)).toHaveLength(1);
    await settle(); tree = render();
    expect(nodes(tree).filter(match)).toHaveLength(1);
    expect(renderToStaticMarkup(tree)).toContain(type === "team" ? "Lakers" : "Test Player");
    expect(h.fetcher).toHaveBeenCalledTimes(calls);
    expect(nodes(tree).find(node => node.props.role === "alert")?.props.children).toBe(warning(locale));
    expect(getFavoriteTeams()).toEqual(["LAL"]); expect(getFavoritePlayers()).toEqual([23]);
    h.setItem.mockImplementation((key: string, value: string) => storage.set(key, value));
    (nodes(tree).find(match)!.props.onRemove as () => void)(); render(); await settle(); tree = render();
    expect(nodes(tree).filter(match)).toHaveLength(0);
    expect(nodes(tree).some(node => node.props.role === "alert")).toBe(false);
    expect(type === "team" ? getFavoriteTeams() : getFavoritePlayers()).toEqual([]);
  });

  it.each(["en", "zh"].flatMap(locale => ["team", "player"].flatMap(type => [false, true].map(existing => ({ locale, type: type as "team" | "player", existing })))))("keeps $type button truthful on failed existing=$existing toggle and retries in $locale", ({ locale, type, existing }) => {
    h.locale = locale;
    const key = type === "team" ? "fav_teams" : "fav_players";
    storage.set(key, existing ? (type === "team" ? '["LAL"]' : "[23]") : "[]");
    const component = () => FavoriteButton({ type, id: type === "team" ? "LAL" : 23 });
    render(component); let button = render(component);
    const originalLabel = button.props["aria-label"];
    h.setItem.mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    button.props.onClick(); button = render(component);
    expect(button.props["aria-label"]).toBe(originalLabel);
    expect(h.toast).toHaveBeenCalledExactlyOnceWith(warning(locale), "warning");
    h.setItem.mockImplementation((k: string, value: string) => storage.set(k, value));
    button.props.onClick(); button = render(component);
    expect(button.props["aria-label"]).not.toBe(originalLabel);
    expect(type === "team" ? getFavoriteTeams().includes("LAL") : getFavoritePlayers().includes(23)).toBe(!existing);
    const t = locale === "zh" ? zh : en;
    expect(h.toast).toHaveBeenLastCalledWith(existing ? t.favorite.removed : t.favorite.added);
  });
});
