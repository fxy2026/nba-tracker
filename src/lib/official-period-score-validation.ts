// A separate team-period contract, never an NBA BoxScore or play-by-play.
// The reviewed scope contains exactly four regulation periods per Finals game.
export interface PeriodScoreGameIdentity {
  gameId: string;
  gameCode: string;
  gameStatus: number;
  homeTeam: { teamId: number; teamTricode: string; score: number };
  awayTeam: { teamId: number; teamTricode: string; score: number };
}

interface OfficialPeriodTeam {
  teamId: number;
  teamTricode: string;
  periodPoints: number[];
  reportedFinalScore: number;
}

export interface OfficialPeriodScores {
  schemaVersion: 1;
  kind: "official-reported-period-scores";
  gameId: string;
  gameCode: string;
  gameDate: string;
  season: "2025-26";
  gameStatus: 3;
  source: {
    publisher: "NBA";
    reportUrl: string;
    reportSha256: string;
    page: 1;
    pageCount: 1;
    periodLabelsAsPrinted: string[];
    verifiedOn: string;
  };
  home: OfficialPeriodTeam;
  away: OfficialPeriodTeam;
}

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const date = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function validateOfficialPeriodScores(raw: unknown, game: PeriodScoreGameIdentity): OfficialPeriodScores | null {
  if (!object(raw) || game.gameStatus !== 3 || raw.gameStatus !== 3 ||
    raw.schemaVersion !== 1 || raw.kind !== "official-reported-period-scores" ||
    raw.gameId !== game.gameId || !/^004250040[1-5]$/.test(game.gameId) ||
    raw.season !== "2025-26" || raw.gameCode !== game.gameCode || !date(raw.gameDate)) return null;

  // gameCode carries the official local game date; the UTC tipoff can be a day later.
  const dateCode = raw.gameDate.replaceAll("-", "");
  const teams = `${game.awayTeam.teamTricode}${game.homeTeam.teamTricode}`;
  if (raw.gameCode !== `${dateCode}/${teams}` || game.homeTeam.teamId === game.awayTeam.teamId ||
    game.homeTeam.teamTricode === game.awayTeam.teamTricode) return null;

  const source = raw.source;
  if (!object(source) || source.publisher !== "NBA" || source.page !== 1 || source.pageCount !== 1 ||
    source.reportUrl !== `https://statsdmz.nba.com/pdfs/${dateCode}/${dateCode}_${teams}.pdf` ||
    typeof source.reportSha256 !== "string" || !/^[0-9a-f]{64}$/.test(source.reportSha256) ||
    !date(source.verifiedOn) || source.verifiedOn < raw.gameDate ||
    !Array.isArray(source.periodLabelsAsPrinted) || source.periodLabelsAsPrinted.length !== 4 ||
    !["1", "2", "3", "4"].every((label, i) => (source.periodLabelsAsPrinted as unknown[])[i] === label)) return null;

  for (const side of ["home", "away"] as const) {
    const team = raw[side];
    const expected = game[`${side}Team`];
    if (!object(team) || !count(team.teamId) || team.teamId === 0 || team.teamId !== expected.teamId ||
      typeof team.teamTricode !== "string" || !/^[A-Z]{3}$/.test(team.teamTricode) || team.teamTricode !== expected.teamTricode ||
      !count(team.reportedFinalScore) || team.reportedFinalScore !== expected.score ||
      !Array.isArray(team.periodPoints) || team.periodPoints.length !== source.periodLabelsAsPrinted.length ||
      !Array.from(team.periodPoints).every(count) ||
      team.periodPoints.reduce((sum, points) => sum + points, 0) !== expected.score) return null;
  }
  return raw as unknown as OfficialPeriodScores;
}
