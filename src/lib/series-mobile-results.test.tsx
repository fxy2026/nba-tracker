import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ locale: "en", schedule: vi.fn(), boxScore: vi.fn() }));
vi.mock("@/lib/api", () => ({ getFullSchedule: runtime.schedule, getBoxScore: runtime.boxScore }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => runtime.locale }));
import SeriesPage from "@/app/series/[id]/page";

type Props = { children?: ReactNode; className?: string; [key: string]: unknown };
function nodes(tree: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return isValidElement<Props>(tree) ? [tree, ...nodes(tree.props.children)] : [];
}
function text(tree: ReactNode): string {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  return isValidElement<Props>(tree) ? text(tree.props.children) : "";
}
function baseClasses(node: ReactElement<Props>) { return (node.props.className ?? "").split(/\s+/).filter(token => !token.includes(":")); }
const scores = [[110, 100], [90, 105], [111, 115], [107, 106], [94, 90], [0, 0], [32, 30]];
function fixture() {
  return scores.map(([nykScore, sasScore], index) => {
    const nyk = { teamId: 1610612752, teamTricode: "NYK", teamCity: "New York", teamName: "Knicks", score: nykScore };
    const sas = { teamId: 1610612759, teamTricode: "SAS", teamCity: "San Antonio", teamName: "Spurs", score: sasScore };
    return {
      gameId: `004250040${index + 1}`, gameCode: `202606${String(3 + index * 2).padStart(2, "0")}/NYKSAS`,
      gameStatus: index === 5 ? 1 : index === 6 ? 2 : 3,
      gameStatusText: index === 3 ? "Final/OT" : index === 5 ? "Scheduled" : index === 6 ? "Q2" : "Final",
      homeTeam: index % 2 ? sas : nyk, awayTeam: index % 2 ? nyk : sas,
    };
  });
}
async function rows() {
  const tree = await SeriesPage({ params: Promise.resolve({ id: "004250040" }) });
  const section = nodes(tree).find(node => node.type === "section" && text(node).includes(runtime.locale === "zh" ? "逐场战果" : "Game by game"))!;
  return nodes(section).filter(node => String(node.props.href ?? "").startsWith("/game/"));
}
beforeEach(() => {
  runtime.locale = "en"; runtime.schedule.mockReset().mockResolvedValue([{ games: fixture() }]);
  runtime.boxScore.mockReset().mockResolvedValue(null);
});

describe("series mobile result layout contracts", () => {
  it.each(["en", "zh"].flatMap(locale => [320, 325, 375].map(width => ({ locale, width }))))(
    "separates metadata from the flexible score grid at $width px in $locale", async ({ locale, width }) => {
      runtime.locale = locale;
      const links = await rows(); expect(links).toHaveLength(7);
      for (const link of links) {
        const children = nodes(link.props.children);
        const scoreGrid = children.find(node => node.props.className?.includes("grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"))!;
        const meta = children.find(node => node.props.className?.includes("col-start-2 row-start-1"))!;
        expect(baseClasses(link)).toContain("grid"); expect(baseClasses(link)).toContain("min-h-11");
        expect(baseClasses(scoreGrid)).toEqual(expect.arrayContaining(["col-span-2", "row-start-2", "min-w-0", "gap-2"]));
        expect(baseClasses(meta)).toEqual(expect.arrayContaining(["row-start-1", "whitespace-nowrap"]));
        expect(children.some(node => baseClasses(node).includes("w-20") || baseClasses(node).includes("w-12"))).toBe(false);
        expect(link.props.className).toContain("sm:flex"); expect(scoreGrid.props.className).toContain("sm:flex"); expect(meta.props.className).toContain("sm:block");
        expect(children.filter(node => node.props.className?.includes("sm:w-20"))).toHaveLength(2);
        // Conservative numeric budget, not rendered glyph measurements: up to
        // 48px per three-digit score, a 9px separator and two 8px internal gaps.
        const scoreBudget = 48 * 2 + 9 + 8 * 2;
        const available = width - 32 /* page padding */ - 24 /* card padding */ - 2 /* borders */;
        const teamColumn = (available - scoreBudget - 2 * 8 /* grid gaps */) / 2;
        expect(teamColumn).toBeGreaterThanOrEqual(60);
      }
    },
  );

  it.each(["en", "zh"])("preserves game IDs, team order, home/away mapping, scores, winners and statuses in %s", async locale => {
    runtime.locale = locale;
    const links = await rows();
    for (const [index, link] of links.entries()) {
      expect(link.props.href).toBe(`/game/004250040${index + 1}`);
      const all = nodes(link);
      const teams = all.filter(node => node.type === "p" && ["NYK", "SAS"].includes(text(node)));
      expect(teams.map(text)).toEqual(["NYK", "SAS"]);
      const markers = all.filter(node => node.type === "p" && ["Home", "Away", "主", "客"].includes(text(node)));
      expect(markers.map(text)).toEqual(index % 2 ? (locale === "zh" ? ["客", "主"] : ["Away", "Home"]) : (locale === "zh" ? ["主", "客"] : ["Home", "Away"]));
      const scoreNodes = all.filter(node => node.type === "span" && node.props.className?.includes("text-2xl"));
      expect(scoreNodes.map(text)).toEqual(index < 5 ? scores[index].map(String) : ["—", "—"]);
      expect(scoreNodes.every(node => node.props.className?.includes("font-mono tabular-nums"))).toBe(true);
      const winningSide = scores[index][0] > scores[index][1] ? 0 : 1;
      expect(scoreNodes.filter(node => node.props.className?.includes("text-accent-amber"))).toEqual(index < 5 ? [scoreNodes[winningSide]] : []);
      expect(teams.filter(node => node.props.className?.includes("text-text-primary"))).toEqual(index < 5 ? [teams[winningSide]] : []);
      // This semantic assertion also passes against the old desktop-only row.
      const directChildren = link.props.children as ReactNode[];
      const meta = directChildren[directChildren.length - 1];
      expect(text(meta)).toBe(`06/${String(3 + index * 2).padStart(2, "0")}${index === 3 ? "OT" : ""}${index < 5 ? (locale === "zh" ? "最终" : "Final") : index === 5 ? (locale === "zh" ? "未开始" : "scheduled") : ""}`);
    }
    expect(runtime.schedule).toHaveBeenCalledOnce();
    expect(runtime.boxScore.mock.calls).toEqual(fixture().slice(0, 5).map(game => [game.gameId]));
  });
});
