import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import schedule from "@/data/schedule-2025-26.json";
import memDet from "@/data/verified-shot-charts/0022500961.json";
import nykSas from "@/data/verified-shot-charts/0042500405.json";
import lalHou from "@/data/verified-shot-charts/0042500173.json";
import { LocaleProvider } from "@/components/LocaleProvider";
import ShotChartExplorer from "@/components/ShotChartExplorer";
import { EMPTY_FILTERS, filterCourtShots, formatCourtClock } from "@/components/shot-chart/court-geometry";
import { getVerifiedShotChart, validateReviewedShotChart, reviewedShotClockSeconds, type ShotChartGameIdentity } from "./verified-shot-chart-archive";
import { reviewedShotGames } from "./verified-shot-chart-allowlist";
import { summarizeCourtShots } from "./court-shots";

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const games = schedule.dates.flatMap(date => date.games);
const cases = [memDet, nykSas, lalHou];
const keys = ["fieldGoalsMade", "fieldGoalsAttempted", "threePointersMade", "threePointersAttempted"] as const;
const getGame = (id: string) => games.find(game => game.gameId === id)!;
const sha = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const expected = [
  { id: "0022500961", total: 181, periods: [46, 45, 43, 47], negative: 4, origin: 6 },
  { id: "0042500405", total: 173, periods: [43, 45, 46, 39], negative: 10, origin: 7 },
  { id: "0042500173", total: 177, periods: [47, 36, 39, 40, 15], negative: 6, origin: 7 },
];

describe("three reviewed archives, exact source records and fail-closed contexts", () => {
  it("preserves all original and newly reviewed factual file bytes", () => {
    expect(sha("src/data/verified-shot-charts/0022500961.json")).toBe("e300d7e7f03e8c6aebe6264a3446b46eda8e7fba946373f9df2e943ea637a717");
    expect(sha("src/data/verified-shot-charts/0042500405.json")).toBe("a95e6a3331e698c76d98e03ecbe84d69e7f5c2061a5598a9c47196ece8165e34");
    expect(sha("src/data/verified-shot-charts/0042500173.json")).toBe("1890e9838a8d0c6249f9393ad609fffea211f68864b157b14240a14e167a76d3");
  });
  it.each(expected)("retains every record and period for $id", ({ id, total, periods, negative, origin }) => {
    const raw = cases.find(record => record.game.gameId === id)!;
    const data = getVerifiedShotChart(getGame(id))!;
    expect(data.coverage).toEqual({ mapped: total, total, complete: true });
    expect(periods.map((_, index) => data.shots.filter(shot => shot.period === index + 1).length)).toEqual(periods);
    expect(new Set(data.shots.map(shot => shot.eventId)).size).toBe(total);
    expect(data.shots.filter(shot => shot.yFeet < 0)).toHaveLength(negative);
    expect(data.shots.filter(shot => shot.xFeet === 0 && shot.yFeet === 0)).toHaveLength(origin);
    for (const [index, source] of raw.shots.entries()) {
      const player = raw.players.find(row => row.personId === source.personId)!;
      expect(data.shots[index]).toEqual({ eventId: source.actionNumber, personId: source.personId, playerName: player.name,
        teamId: source.teamId, teamTricode: source.teamTricode, period: source.period, clock: source.clock,
        result: source.shotResult, value: source.shotValue, xFeet: source.xLegacy / 10, yFeet: source.yLegacy / 10 });
    }
    for (const player of raw.players) {
      expect(summarizeCourtShots(data.shots.filter(shot => shot.personId === player.personId))).toMatchObject({
        made: player.fieldGoalsMade, attempted: player.fieldGoalsAttempted, threesMade: player.threePointersMade, threesAttempted: player.threePointersAttempted });
    }
    expect(Object.keys(data.home).sort()).toEqual(["score", "teamId", "teamTricode"]);
    expect(JSON.stringify(data)).not.toMatch(/xLegacy|shotDistance|scoreHome|description|freeThrows|factsSha256/);
  });
  it.each(cases)("rejects every edited shot field for $game.gameId", raw => {
    const game = getGame(raw.game.gameId);
    for (let index = 0; index < raw.shots.length; index++) {
      for (const key of Object.keys(raw.shots[index])) {
        const altered = copy(raw);
        const row = altered.shots[index] as Record<string, unknown>;
        row[key] = typeof row[key] === "number" ? Number(row[key]) + 1 : `${row[key]} changed`;
        expect(validateReviewedShotChart(altered, game), `shot ${index} ${key}`).toBeNull();
      }
    }
  });
  it.each(cases)("rejects every edited roster field and structural edit for $game.gameId", raw => {
    const game = getGame(raw.game.gameId);
    for (let index = 0; index < raw.players.length; index++) {
      for (const key of Object.keys(raw.players[index])) {
        const altered = copy(raw);
        const row = altered.players[index] as Record<string, unknown>;
        row[key] = typeof row[key] === "number" ? Number(row[key]) + 1 : `${row[key]} changed`;
        expect(validateReviewedShotChart(altered, game), `player ${index} ${key}`).toBeNull();
      }
    }
    for (const changed of [{ ...raw, shots: raw.shots.slice(1) }, { ...raw, shots: [...raw.shots, raw.shots[0]] },
      { ...raw, shots: [...raw.shots].reverse() }, { ...raw, players: raw.players.slice(1) },
      { ...raw, schemaVersion: 2 }, { ...raw, extra: true }, { ...raw, shots: null }, null]) expect(validateReviewedShotChart(changed, game)).toBeNull();
    for (const other of cases.filter(record => record !== raw)) expect(validateReviewedShotChart(other, game)).toBeNull();
  });
  it.each(cases)("reconciles every period with official free throws and final for $game.gameId", raw => {
    const data = getVerifiedShotChart(getGame(raw.game.gameId))!;
    const pin = reviewedShotGames[raw.game.gameId as keyof typeof reviewedShotGames];
    const points = JSON.parse(readFileSync(`src/data/official-period-scores/${raw.game.gameId}.json`, "utf8"));
    for (const side of ["home", "away"] as const) {
      expect(pin[side].periods.map(period => period.points)).toEqual(points[side].periodPoints);
      expect(pin[side].periods.reduce((sum, period) => sum + period.points, 0)).toBe(pin[side].score);
      for (const [index, period] of pin[side].periods.entries()) {
        const rows = data.shots.filter(shot => shot.teamId === pin[side].teamId && shot.period === index + 1);
        expect(rows.reduce((sum, shot) => sum + (shot.result === "Made" ? shot.value : 0), 0) + period.freeThrowsMade).toBe(period.points);
      }
    }
  });
  it.each(cases)("rejects every defined current game/team/shooting/period/player conflict for $game.gameId", raw => {
    const game = getGame(raw.game.gameId);
    const pin = reviewedShotGames[raw.game.gameId as keyof typeof reviewedShotGames];
    for (const [key, value] of Object.entries({ gameId: "unreviewed", gameCode: `${game.gameCode}x`, gameStatus: 2,
      gameDateTimeUTC: "2026-01-01T00:00:00Z", gameTimeUTC: "2026-01-01T00:00:00Z" })) {
      expect(getVerifiedShotChart({ ...game, [key]: value })).toBeNull();
    }
    expect(getVerifiedShotChart({ ...game, gameDateTimeUTC: undefined })).toBeNull();
    for (const side of ["home", "away"] as const) {
      const teamKey = `${side}Team` as const;
      const team = game[teamKey];
      for (const [key, value] of Object.entries({ teamId: 0, teamTricode: "BAD", score: 999 })) {
        expect(getVerifiedShotChart({ ...game, [teamKey]: { ...team, [key]: value } })).toBeNull();
      }
      for (const key of [...keys, "freeThrowsMade", "points"]) for (const value of [999, null, "0", NaN]) {
        expect(getVerifiedShotChart({ ...game, [teamKey]: { ...team, statistics: { [key]: value } } })).toBeNull();
      }
      const periods = pin[side].periods.map((period, index) => ({ period: index + 1, periodType: index < 4 ? "REGULAR" : "OVERTIME", score: period.points }));
      const context: ShotChartGameIdentity = { ...game, [teamKey]: { ...team, periods } };
      expect(getVerifiedShotChart(context)).not.toBeNull();
      for (let index = 0; index < periods.length; index++) for (const key of ["period", "score", "periodType"] as const) {
        const altered = copy(periods); Object.assign(altered[index], { [key]: key === "periodType" ? "INVALID" : 999 });
        expect(getVerifiedShotChart({ ...game, [teamKey]: { ...team, periods: altered } })).toBeNull();
      }
      for (const bad of [null, {}, periods.slice(1), [...periods, periods[0]]]) expect(getVerifiedShotChart({ ...game, [teamKey]: { ...team, periods: bad } })).toBeNull();
      const players = raw.players.filter(player => player.teamId === team.teamId).map(player => ({ personId: player.personId,
        name: player.name, teamId: player.teamId, teamTricode: player.teamTricode, statistics: Object.fromEntries(keys.map(key => [key, player[key]])) }));
      expect(getVerifiedShotChart({ ...game, [teamKey]: { ...team, players } })).not.toBeNull();
      for (let index = 0; index < players.length; index++) {
        for (const key of ["personId", "name", "teamId", "teamTricode"] as const) {
          const altered = copy(players); Object.assign(altered[index], { [key]: typeof players[index][key] === "number" ? 999 : "INVALID" });
          expect(getVerifiedShotChart({ ...game, [teamKey]: { ...team, players: altered } })).toBeNull();
        }
        for (const key of keys) {
          const altered = copy(players); altered[index].statistics[key] += 1;
          expect(getVerifiedShotChart({ ...game, [teamKey]: { ...team, players: altered } })).toBeNull();
        }
      }
      for (const bad of [null, {}, [...players, players[0]]]) expect(getVerifiedShotChart({ ...game, [teamKey]: { ...team, players: bad } })).toBeNull();
    }
  });
  it("only enables three reviewed games, with all other 84 official-period games unavailable", () => {
    const ids = readdirSync("src/data/official-period-scores").filter(file => file.endsWith(".json")).map(file => file.slice(0, -5));
    expect(ids).toHaveLength(87);
    const available = ids.filter(id => getVerifiedShotChart(getGame(id)) !== null);
    expect(available.sort()).toEqual(expected.map(row => row.id).sort());
    for (const id of ["constructor", "__proto__", "toString", "0042500999"]) expect(getVerifiedShotChart({ ...getGame("0042500173"), gameId: id })).toBeNull();
  });
});

describe("reviewed overtime clocks, presentation and source provenance", () => {
  it.each([1, 2, 3, 4])("limits regulation period %s to exactly 720 seconds", period => {
    expect(reviewedShotClockSeconds("PT12M00.00S", period)).toBe(720);
    for (const clock of ["PT12M00.01S", "PT12M59.00S", "PT13M00.00S", "PT00M60.00S", "12:00", null]) expect(reviewedShotClockSeconds(clock, period)).toBeNull();
  });
  it("allows only period 5 with a 300-second maximum; never 12-minute overtime", () => {
    expect(reviewedShotClockSeconds("PT05M00.00S", 5)).toBe(300);
    expect(reviewedShotClockSeconds("PT00M00.00S", 5)).toBe(0);
    for (const clock of ["PT05M00.01S", "PT05M01.00S", "PT06M00.00S", "PT12M00.00S"]) expect(reviewedShotClockSeconds(clock, 5)).toBeNull();
    for (const period of [0, -1, 1.5, 6, NaN]) expect(reviewedShotClockSeconds("PT04M00.00S", period)).toBeNull();
    const data = getVerifiedShotChart(getGame("0042500173"))!;
    const overtime = filterCourtShots(data.shots, { ...EMPTY_FILTERS, period: "5" });
    expect(overtime).toHaveLength(15);
    for (const shot of overtime) expect(reviewedShotClockSeconds(shot.clock, shot.period)).toBeLessThanOrEqual(300);
    expect(summarizeCourtShots(overtime)).toMatchObject({ made: 5, attempted: 15, threesMade: 2, threesAttempted: 8 });
    expect(formatCourtClock(overtime[0].clock)).toBe("4:09");
  });
  it.each(["en", "zh"] as const)("renders exact coverage and top-down-first without initial Three (%s)", locale => {
    const data = getVerifiedShotChart(getGame("0042500173"))!;
    const html = renderToStaticMarkup(<LocaleProvider initialLocale={locale}><ShotChartExplorer data={data} /></LocaleProvider>);
    expect(html).not.toContain('<option value="5">'); // Extra filters start closed.
    expect(html).not.toContain("Q5");
    expect(html).toContain("177/177");
    expect(html).toContain('data-court-state="flat"');
    expect(html).not.toContain("<canvas");
    expect(html).toContain(data.source.url);
    const finalData = getVerifiedShotChart(getGame("0042500405"))!;
    const finalHtml = renderToStaticMarkup(<LocaleProvider initialLocale={locale}><ShotChartExplorer data={finalData} /></LocaleProvider>);
    expect(finalHtml).toContain("173/173");
    expect(finalHtml).not.toContain('<option value="5">');
  });
  it("retains the actual chart capture times and separates local game date from UTC tipoff", () => {
    const finals = getVerifiedShotChart(getGame("0042500405"))!;
    const overtime = getVerifiedShotChart(getGame("0042500173"))!;
    expect(finals.source).toMatchObject({ url: "https://www.nba.com/game/nyk-vs-sas-0042500405/game-charts", retrievedAt: "2026-10-03T06:22:28.352889+00:00" });
    expect(overtime.source).toMatchObject({ url: "https://www.nba.com/game/lal-vs-hou-0042500173/game-charts", retrievedAt: "2026-10-03T06:22:32.965745+00:00" });
    expect(getGame("0042500405").gameCode).toBe("20260613/NYKSAS");
    expect(getGame("0042500405").gameDateTimeUTC).toBe("2026-06-14T00:30:00Z");
    expect(getGame("0042500173").gameCode).toBe("20260424/LALHOU");
    expect(getGame("0042500173").gameDateTimeUTC).toBe("2026-04-25T00:00:00Z");
  });
});
