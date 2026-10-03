import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerIdentity } from "./player-identity";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  locale: "en", seasonType: "Regular Season", loading: true, error: false,
  index: 0, setSeasonType: vi.fn(),
}));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: vi.fn(),
  useMemo: (calculate: () => unknown) => calculate(),
  useState: () => {
    const index = state.index++;
    return [[state.seasonType, null, state.loading, state.error, 0][index], index === 0 ? state.setSeasonType : vi.fn()];
  },
}));
vi.mock("@/components/LocaleProvider", () => ({
  useLocale: () => ({
    locale: state.locale,
    t: { statsPage: { regularSeason: "Regular Season", playoffs: "Playoffs" }, playerStats: {}, common: {} },
  }),
}));
import ArchivedPlayerProfile from "@/components/player/ArchivedPlayerProfile";
import PlayerGameLog from "@/components/player/PlayerGameLog";

type Props = { children?: ReactNode; [key: string]: unknown };
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (isValidElement<Props>(node)) return text(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}
const player: PlayerIdentity = {
  id: 999999, name: "Identity only", aliases: [], sources: ["all-time-registry"],
  href: "/player/999999", teamLabel: null, teamAbbr: null, position: null,
  indexProvenance: null, shotCoverage: null,
};
beforeEach(() => {
  Object.assign(state, { locale: "en", seasonType: "Regular Season", loading: true, error: false, index: 0 });
  state.setSeasonType.mockClear();
});

describe.each(["en", "zh"] as const)("archived profile navigation in %s", locale => {
  it.each(["ready", "error"] as const)("labels identity-only availability honestly with %s archive status", shotArchiveStatus => {
    const tree = ArchivedPlayerProfile({ player: { ...player, shotArchiveStatus }, locale, catalog: [], initialSelection: null, initialResource: null });
    const all = nodes(tree);
    const nav = all.find(node => node.type === "nav")!;
    const links = nodes(nav).filter(node => node.type === "a");
    expect(links.map(link => link.props.href)).toEqual(["#overview", "#shooting"]);
    expect(text(links[1])).toBe(locale === "zh" ? "数据可用情况" : "Data availability");
    expect(all.filter(node => node.props.id === "shooting")).toHaveLength(1);
    expect(all.filter(node => node.props.id === "career")).toHaveLength(1);
    expect(all.find(node => node.props.id === "shooting")?.props.role).toBe("status");
  });
  it.each([true, false])("preserves rich-profile navigation for selection present: %s", selected => {
    const tree = ArchivedPlayerProfile({
      player: { ...player, id: selected ? player.id : 893 }, locale, catalog: [],
      initialSelection: selected ? { playerId: player.id, season: "2000-01", seasonType: "Regular Season" } : null,
      initialResource: null,
    });
    const nav = nodes(tree).find(node => node.type === "nav")!;
    expect(nodes(nav).filter(node => node.type === "a").map(node => node.props.href)).toEqual(["#overview", "#shooting", "#career"]);
  });
});

describe("mobile game log states", () => {
  it("contains the five fixed-width loading tiles in a local horizontal scroller", () => {
    const all = nodes(PlayerGameLog({ playerId: 2544 }));
    const strip = all.find(node => nodes(node.props.children).filter(child => String(child.props.className).includes("w-32")).length === 5 && String(node.props.className).includes("flex gap-2"));
    expect(strip).toBeDefined();
    expect(String(strip!.props.className)).toContain("overflow-x-auto");
  });
  it.each(["Regular Season", "Playoffs"])("exposes selected %s state and mobile touch targets through loading, error and empty states", seasonType => {
    for (const [loading, error] of [[true, false], [false, true], [false, false]]) {
      Object.assign(state, { seasonType, loading, error, index: 0 });
      const all = nodes(PlayerGameLog({ playerId: 2544 }));
      const group = all.find(node => node.props.role === "group")!;
      expect(group.props["aria-label"]).toBe("Season type");
      const buttons = nodes(group).filter(node => node.type === "button");
      expect(buttons).toHaveLength(2);
      for (const button of buttons) {
        expect(button.props.type).toBe("button");
        expect(button.props["aria-pressed"]).toBe(text(button) === seasonType);
        expect(button.props.className).toContain("min-h-11 sm:min-h-0");
      }
      (buttons[1].props.onClick as () => void)();
      expect(state.setSeasonType).toHaveBeenLastCalledWith("Playoffs");
    }
  });
});
