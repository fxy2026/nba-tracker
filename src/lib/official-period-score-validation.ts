import manifest from "@/data/official-period-scores-manifest.json";

// A separate team-period contract, never an NBA BoxScore or play-by-play.
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

type CaptureTimestampStatus = "explicit-original-download-capture-record" |
  "retrieval-or-reverification-ambiguous" | "not-recorded-in-reviewed-local-evidence";

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
    pageCount: 1 | 19;
    periodLabelsAsPrinted: string[];
    verifiedOn: string;
    // The original five Finals retain their exact legacy metadata. Expansion
    // records distinguish verification from nullable original capture evidence.
    verifiedAt?: string;
    originalPdfCapturedAt?: string | null;
    originalPdfCaptureTimestampStatus?: CaptureTimestampStatus;
  };
  home: OfficialPeriodTeam;
  away: OfficialPeriodTeam;
}

interface ReviewedIdentity {
  gameCode: string;
  gameDate: string;
  season: string;
  gameStatus: number;
  source: { reportUrl: string; reportSha256: string; page: number; pageCount: number; periodLabelsAsPrinted: string[] };
  home: { teamId: number; teamTricode: string; reportedFinalScore: number };
  away: { teamId: number; teamTricode: string; reportedFinalScore: number };
}
const reviewed: Record<string, ReviewedIdentity> = manifest.games;
const originalFinals = new Set(["0042500401", "0042500402", "0042500403", "0042500404", "0042500405"]);
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const date = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const timestamp = (value: unknown): value is string =>
  typeof value === "string" && date(value.slice(0, 10)) &&
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) &&
  Number.isFinite(Date.parse(value));

export function validateOfficialPeriodScores(raw: unknown, game: PeriodScoreGameIdentity): OfficialPeriodScores | null {
  if (!object(raw) || !object(game) || !object(game.homeTeam) || !object(game.awayTeam) ||
    typeof game.gameId !== "string" || !Object.hasOwn(reviewed, game.gameId) ||
    !exactKeys(raw, ["schemaVersion", "kind", "gameId", "gameCode", "gameDate", "season", "gameStatus", "source", "away", "home"]) ||
    game.gameStatus !== 3 || raw.gameStatus !== 3 || raw.schemaVersion !== 1 ||
    raw.kind !== "official-reported-period-scores" || raw.gameId !== game.gameId ||
    raw.season !== "2025-26" || raw.gameCode !== game.gameCode || !date(raw.gameDate)) return null;

  const identity = reviewed[game.gameId];
  if (raw.gameCode !== identity.gameCode || raw.gameDate !== identity.gameDate ||
    raw.season !== identity.season || raw.gameStatus !== identity.gameStatus) return null;

  // gameCode carries the official local date; UTC tipoff can be a day later.
  const dateCode = raw.gameDate.replaceAll("-", "");
  const teams = `${game.awayTeam.teamTricode}${game.homeTeam.teamTricode}`;
  if (raw.gameCode !== `${dateCode}/${teams}` || game.homeTeam.teamId === game.awayTeam.teamId ||
    game.homeTeam.teamTricode === game.awayTeam.teamTricode) return null;

  const source = raw.source;
  const isLegacy = originalFinals.has(game.gameId);
  const sourceKeys = ["publisher", "reportUrl", "reportSha256", "page", "pageCount", "periodLabelsAsPrinted", "verifiedOn"];
  if (!isLegacy) sourceKeys.push("verifiedAt", "originalPdfCapturedAt", "originalPdfCaptureTimestampStatus");
  // MEM–DET is the sole gamebook exception, page 1 only. The reviewed manifest
  // also binds its exact original PDF hash, never another gamebook or page.
  const isGamebook = game.gameId === "0022500961";
  if (!object(source) || !exactKeys(source, sourceKeys) || source.publisher !== "NBA" || source.page !== 1 ||
    source.pageCount !== (isGamebook ? 19 : 1) ||
    source.reportUrl !== `https://statsdmz.nba.com/pdfs/${dateCode}/${dateCode}_${teams}${isGamebook ? "_book" : ""}.pdf` ||
    source.reportUrl !== identity.source.reportUrl || source.reportSha256 !== identity.source.reportSha256 ||
    source.page !== identity.source.page || source.pageCount !== identity.source.pageCount ||
    !date(source.verifiedOn) || source.verifiedOn < raw.gameDate ||
    !Array.isArray(source.periodLabelsAsPrinted)) return null;

  const labels = source.periodLabelsAsPrinted;
  if (labels.length < 4 || labels.length > 6 || labels.length !== identity.source.periodLabelsAsPrinted.length ||
    !Array.from(labels).every((label, index) => label === (index < 4 ? String(index + 1) : `OT${index - 3}`) &&
      label === identity.source.periodLabelsAsPrinted[index])) return null;

  if (!isLegacy) {
    if (!timestamp(source.verifiedAt) || source.verifiedAt.slice(0, 10) !== source.verifiedOn) return null;
    if (source.originalPdfCaptureTimestampStatus === "explicit-original-download-capture-record") {
      if (!timestamp(source.originalPdfCapturedAt) || source.originalPdfCapturedAt.slice(0, 10) < raw.gameDate ||
        Date.parse(source.originalPdfCapturedAt) > Date.parse(source.verifiedAt)) return null;
    } else if (!["retrieval-or-reverification-ambiguous", "not-recorded-in-reviewed-local-evidence"].includes(String(source.originalPdfCaptureTimestampStatus)) ||
      source.originalPdfCapturedAt !== null) return null;
  }

  for (const side of ["home", "away"] as const) {
    const team = raw[side];
    const expected = game[`${side}Team`];
    const canonical = identity[side];
    if (!object(team) || !exactKeys(team, ["teamId", "teamTricode", "periodPoints", "reportedFinalScore"]) ||
      !count(team.teamId) || team.teamId === 0 || team.teamId !== expected.teamId || team.teamId !== canonical.teamId ||
      typeof team.teamTricode !== "string" || !/^[A-Z]{3}$/.test(team.teamTricode) ||
      team.teamTricode !== expected.teamTricode || team.teamTricode !== canonical.teamTricode ||
      !count(team.reportedFinalScore) || team.reportedFinalScore !== expected.score || team.reportedFinalScore !== canonical.reportedFinalScore ||
      !Array.isArray(team.periodPoints) || team.periodPoints.length !== labels.length ||
      !Array.from(team.periodPoints).every(count) ||
      team.periodPoints.reduce((sum, points) => sum + points, 0) !== expected.score) return null;
  }

  const scores = raw as unknown as OfficialPeriodScores;
  // An overtime game must be tied after regulation and every non-final OT.
  for (let boundary = 4; boundary < labels.length; boundary++) {
    if (scores.home.periodPoints.slice(0, boundary).reduce((sum, points) => sum + points, 0) !==
      scores.away.periodPoints.slice(0, boundary).reduce((sum, points) => sum + points, 0)) return null;
  }
  if (scores.home.reportedFinalScore === scores.away.reportedFinalScore) return null;
  return scores;
}
