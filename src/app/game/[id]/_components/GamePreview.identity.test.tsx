import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoxScore, ScheduleGame } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";

const mocks = vi.hoisted(() => ({ schedule: vi.fn(), box: vi.fn(), players: vi.fn(), playByPlay: vi.fn() }));
vi.mock("@/lib/api", async (original) => ({
  ...await original<typeof import("@/lib/api")>(),
  getFullSchedule: mocks.schedule,
  getBoxScore: mocks.box,
  getPlayerIndex: mocks.players,
}));
vi.mock("@/lib/game-play-by-play", () => ({ getGamePlayByPlay: mocks.playByPlay }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));
import GamePage from "../page";
import GamePreview from "./GamePreview";

const teamCodes = Object.keys(TEAM_META);
const fullName = (code: string) => `${TEAM_META[code].city} ${TEAM_META[code].name}`;
const athleteName = (code: string) => `FIXTURE_${code}_ATHLETE`;
const withWhitespace = (name: string) => ` \t${name.toUpperCase().replaceAll(" ", "\t  \n")} \n`;
const injuryRow = (displayName: unknown, athlete = "FIXTURE_WRONG_ATHLETE") => ({
  displayName,
  injuries: [{ status: "Out", athlete: { displayName: athlete, position: { abbreviation: "F" } } }],
});
let payload: { injuries: unknown[] };

function previewTeam(code: string) {
  const meta = TEAM_META[code];
  return { tricode: code, teamId: meta.teamId, teamCity: meta.city, teamName: meta.name };
}

function previewProps(home = "LAC", away = "BOS"): Parameters<typeof GamePreview>[0] {
  return {
    gameId: "0022600999", gameTimeUTC: "2026-12-01T00:00:00Z",
    home: previewTeam(home), away: previewTeam(away), isZh: false,
  };
}

type ElementProps = { children?: ReactNode; className?: string };
function elements(node: ReactNode, predicate: (element: ReactElement<ElementProps>) => boolean): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap((child) => elements(child, predicate));
  if (!isValidElement<ElementProps>(node)) return [];
  return [...(predicate(node) ? [node] : []), ...elements(node.props.children, predicate)];
}

function injuryColumns(tree: ReactNode) {
  const grid = elements(tree, (element) => element.type === "div" && element.props.className === "grid grid-cols-1 sm:grid-cols-2 gap-4");
  expect(grid).toHaveLength(1);
  return (grid[0].props.children as ReactElement[]).map((child) => renderToStaticMarkup(child));
}

function expectOnlyTeam(html: string, code: string) {
  expect(html).toContain(fullName(code));
  expect(html).toContain(athleteName(code));
  expect(html).not.toContain("No injuries reported");
  expect(html).not.toContain("FIXTURE_WRONG_ATHLETE");
  for (const other of teamCodes.filter((team) => team !== code)) expect(html).not.toContain(athleteName(other));
}

beforeEach(() => {
  payload = { injuries: [] };
  mocks.schedule.mockReset().mockResolvedValue([]);
  mocks.box.mockReset().mockResolvedValue(null);
  mocks.players.mockReset().mockResolvedValue([]);
  mocks.playByPlay.mockReset().mockResolvedValue({ actions: [], shots: [] });
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    expect(url).toBe("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries");
    return Response.json(payload);
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("GamePreview injury team identity", () => {
  it.each(teamCodes)("selects only %s from all 30 canonical full names in both columns", async (code) => {
    payload.injuries = teamCodes.map((team) => injuryRow(fullName(team), athleteName(team)));
    const opponent = teamCodes[(teamCodes.indexOf(code) + 1) % teamCodes.length];
    const columns = injuryColumns(await GamePreview(previewProps(code, opponent)));
    expectOnlyTeam(columns[0], opponent);
    expectOnlyTeam(columns[1], code);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each(teamCodes)("normalizes case and whitespace for the full %s name", async (code) => {
    payload.injuries = [injuryRow(withWhitespace(fullName(code)), athleteName(code))];
    const opponent = code === "BOS" ? "ATL" : "BOS";
    const columns = injuryColumns(await GamePreview(previewProps(code, opponent)));
    expectOnlyTeam(columns[1], code);
    expect(columns[0]).toContain("No injuries reported");
  });

  it.each(["Los Angeles Clippers", withWhitespace("Los Angeles Clippers")])("accepts the known Clippers alias %j", async (name) => {
    payload.injuries = [injuryRow(name, athleteName("LAC"))];
    expectOnlyTeam(injuryColumns(await GamePreview(previewProps()))[1], "LAC");
  });

  it.each([
    ["LAC", "LAL"], ["LAC", "ORL"], ["LAC", "POR"], ["LAC", "CLE"], ["BKN", "CHA"],
  ])("does not assign %s injuries from a %s-only response", async (target, other) => {
    payload.injuries = [injuryRow(fullName(other), athleteName(other))];
    const columns = injuryColumns(await GamePreview(previewProps(target, other)));
    expectOnlyTeam(columns[0], other);
    expect(columns[1]).toContain("No injuries reported");
    expect(columns[1]).not.toContain(athleteName(other));
  });

  it.each([
    ["LAC", "LAL"], ["LAC", "ORL"], ["LAC", "POR"], ["LAC", "CLE"], ["BKN", "CHA"],
  ])("keeps %s and %s separate regardless of payload order", async (target, other) => {
    const rows = [injuryRow(fullName(other), athleteName(other)), injuryRow(fullName(target), athleteName(target))];
    for (const order of [rows, [...rows].reverse()]) {
      payload.injuries = order;
      const columns = injuryColumns(await GamePreview(previewProps(target, other)));
      expectOnlyTeam(columns[0], other);
      expectOnlyTeam(columns[1], target);
    }
  });

  it.each([
    "", "LA", "Los Angeles", "Clippers", "Lakers", "Nets", "Lakers Clippers",
    "Hornets Nets", "Unknown Netsville", "Los Angeles Lakers Clippers",
    "Los Angeles Clippers Reserves", "Brooklyn Nets Charlotte Hornets",
  ])("rejects incomplete, unknown, or ambiguous team name %j", async (name) => {
    payload.injuries = [injuryRow(name)];
    for (const props of [previewProps("LAC", "LAL"), previewProps("BKN", "CHA")]) {
      for (const column of injuryColumns(await GamePreview(props))) {
        expect(column).toContain("No injuries reported");
        expect(column).not.toContain("FIXTURE_WRONG_ATHLETE");
      }
    }
  });

  it.each([undefined, null, 42, true, {}, ["LA Clippers"]].map((value) => [value]))("ignores malformed displayName %j without hiding a later valid row", async (name) => {
    payload.injuries = [injuryRow(name)];
    let columns = injuryColumns(await GamePreview(previewProps()));
    expect(columns[1]).toContain("No injuries reported");
    expect(columns[1]).not.toContain("FIXTURE_WRONG_ATHLETE");
    payload.injuries.push(injuryRow("LA Clippers", athleteName("LAC")));
    columns = injuryColumns(await GamePreview(previewProps()));
    expectOnlyTeam(columns[1], "LAC");
  });

  it("handles absent and unknown teams without choosing an unrelated row", async () => {
    payload.injuries = [injuryRow("Boston Celtics", athleteName("BOS"))];
    const props = previewProps();
    props.home = { tricode: "UNK", teamId: 0, teamCity: "Unknown", teamName: "Team" };
    const columns = injuryColumns(await GamePreview(props));
    expectOnlyTeam(columns[0], "BOS");
    expect(columns[1]).toContain("No injuries reported");
    expect(columns[1]).not.toContain(athleteName("BOS"));
    payload.injuries = [];
    expect(injuryColumns(await GamePreview(previewProps())).every((column) => column.includes("No injuries reported"))).toBe(true);
  });

  it("preserves athlete filtering and successful injury rendering", async () => {
    const valid = injuryRow("LA Clippers", athleteName("LAC"));
    payload.injuries = [{ ...valid, injuries: [
      { status: "IGNORED_MISSING_ATHLETE" },
      { status: "IGNORED_EMPTY_ATHLETE", athlete: {} },
      { status: "IGNORED_EMPTY_NAME", athlete: { displayName: "" } },
      ...valid.injuries,
    ] }];
    const column = injuryColumns(await GamePreview(previewProps()))[1];
    expectOnlyTeam(column, "LAC");
    expect(column).toContain("Out");
    expect(column).toContain(">F</span>");
    expect(column).not.toContain("IGNORED_");
  });
});

// These synthetic upcoming fixtures exercise actual route composition and the
// awaited preview output, not a live provider or a browser/RSC integration.
describe.each(["schedule fallback", "box-score shell"])("upcoming route %s", (branch) => {
  it.each([
    ["LAC", "LAL"], ["BKN", "CHA"],
  ])("preserves %s/%s injury identity with absent and reordered rows", async (home, away) => {
    const props = previewProps(home, away);
    const scheduleTeam = (code: string) => {
      const team = previewTeam(code);
      return { ...team, teamTricode: code, teamSlug: "", score: 0 };
    };
    const upcoming: ScheduleGame = {
      gameId: props.gameId, gameStatus: 1, gameStatusText: "Scheduled",
      gameCode: `20261201/${away}${home}`, gameDateTimeUTC: props.gameTimeUTC,
      homeTeam: scheduleTeam(home), awayTeam: scheduleTeam(away),
    };
    const box: BoxScore = {
      ...upcoming, gameTimeUTC: upcoming.gameDateTimeUTC,
      arena: { arenaName: "Fixture Arena", arenaCity: "Fixture City" },
      homeTeam: { ...upcoming.homeTeam, players: [], periods: [], statistics: {} },
      awayTeam: { ...upcoming.awayTeam, players: [], periods: [], statistics: {} },
    };
    mocks.schedule.mockResolvedValue([{ gameDate: "12/01/2026 00:00:00", games: [upcoming] }]);
    mocks.box.mockResolvedValue(branch === "box-score shell" ? box : null);
    const awayRow = injuryRow(fullName(away), athleteName(away));
    const homeRow = injuryRow(fullName(home), athleteName(home));
    for (const order of [[awayRow], [awayRow, homeRow], [homeRow, awayRow]]) {
      payload.injuries = order;
      const tree = await GamePage({ params: Promise.resolve({ id: upcoming.gameId }) });
      const previews = elements(tree, (element) => element.type === GamePreview);
      expect(previews).toHaveLength(1);
      expect(previews[0].props).toMatchObject({ home: props.home, away: props.away });
      const columns = injuryColumns(await GamePreview(previews[0].props as Parameters<typeof GamePreview>[0]));
      expectOnlyTeam(columns[0], away);
      if (order.length === 1) {
        expect(columns[1]).toContain("No injuries reported");
        expect(columns[1]).not.toContain(athleteName(away));
      } else {
        expectOnlyTeam(columns[1], home);
      }
    }
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(mocks.schedule).toHaveBeenCalledTimes(branch === "box-score shell" ? 3 : 6);
    expect(mocks.box).toHaveBeenCalledTimes(3);
    expect(mocks.players).not.toHaveBeenCalled();
    expect(mocks.playByPlay).not.toHaveBeenCalled();
  });
});
