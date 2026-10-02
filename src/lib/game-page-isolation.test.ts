import { beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";
import BoxScoreSection from "@/app/game/[id]/_components/BoxScoreSection";
const { getBoxScore, getGamePlayByPlay } = vi.hoisted(() => ({ getBoxScore: vi.fn(), getGamePlayByPlay: vi.fn() }));
vi.mock("@/lib/api", async (original) => ({ ...await original<typeof import("./api")>(), getBoxScore, getPlayerIndex: async () => [] }));
vi.mock("@/lib/game-play-by-play", async (original) => ({ ...await original<typeof import("./game-play-by-play")>(), getGamePlayByPlay }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));

beforeEach(() => { getBoxScore.mockReset(); getGamePlayByPlay.mockReset(); });
it("the actual game page returns both basic box table fallbacks before optional PBP resolves", async () => {
  const team = { teamId: 1610612765, teamTricode: "DET", teamName: "Pistons", teamCity: "Detroit", score: 126, players: [], periods: [], statistics: {} };
  getBoxScore.mockResolvedValue({ gameId: "0022500961", gameCode: "20260313/MEMDET", gameStatus: 3, gameStatusText: "Final", gameTimeUTC: "2026-03-13T23:30:00Z", arena: { arenaName: "Arena", arenaCity: "Detroit" }, homeTeam: team, awayTeam: { ...team, teamTricode: "MEM", score: 110 } });
  getGamePlayByPlay.mockReturnValue(new Promise(() => {}));
  const { default: GamePage } = await import("@/app/game/[id]/page");
  let rendered: ReactNode;
  void GamePage({ params: Promise.resolve({ id: "0022500961" }) }).then((value) => { rendered = value; });
  await vi.waitFor(() => expect(rendered).toBeDefined());
  const tables: { team: { score: number }; shots: unknown[] }[] = [];
  function visit(node: ReactNode) {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!isValidElement<{ children?: ReactNode; fallback?: ReactNode; team: { score: number }; shots: unknown[] }>(node)) return;
    if (node.type === BoxScoreSection) tables.push(node.props);
    visit(node.props.children); visit(node.props.fallback);
  }
  visit(rendered);
  expect(tables.map((t) => t.team.score)).toEqual([110, 126]);
  expect(tables.every((t) => t.shots.length === 0)).toBe(true);
  expect(getGamePlayByPlay).toHaveBeenCalledTimes(1);
});
