import { readFileSync } from "node:fs";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ schedule: vi.fn(), locale: vi.fn() }));
vi.mock("@/lib/api", () => ({ getFullSchedule: mocks.schedule }));
vi.mock("@/lib/locale", () => ({ getLocale: mocks.locale }));
import SchedulePage from "@/app/schedule/page";

type HostProps = { children?: ReactNode; [key: string]: unknown };
function nodes(node: ReactNode): ReactElement<HostProps>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<HostProps>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
afterEach(() => vi.useRealTimers());
it.each(["en", "zh"])("uses the shared safe-area header offset for each schedule date in %s", async locale => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
  mocks.locale.mockResolvedValue(locale);
  const game = { gameId: "0022500961", gameStatus: 3, homeTeam: { teamTricode: "BOS" }, awayTeam: { teamTricode: "NYK" } };
  mocks.schedule.mockResolvedValue([
    { gameDate: "10/02/2026 00:00:00", games: [game] },
    { gameDate: "10/03/2026 00:00:00", games: [{ ...game, gameId: "0022500962" }] },
  ]);
  const tree = await SchedulePage({ searchParams: Promise.resolve({}) });
  const headings = nodes(tree).filter(node => String(node.props.className).split(" ").includes("sticky"));
  expect(headings).toHaveLength(2);
  expect(headings.every(node => String(node.props.className).includes("site-sticky-offset"))).toBe(true);
  expect(headings.every(node => !String(node.props.className).includes("top-16"))).toBe(true);
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  expect(css).toContain(".site-sticky-offset { top: var(--site-header-height); }");
  expect(css).toContain("--site-header-height: calc(3rem + env(safe-area-inset-top, 0px))");
  expect(css).toContain("--site-header-height: calc(4rem + env(safe-area-inset-top, 0px))");
});
