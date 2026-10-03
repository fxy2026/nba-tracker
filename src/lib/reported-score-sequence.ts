/** Factual printed score observations, deliberately separate from PlayAction. */
export interface ReportedScoreRow {
  period: number;
  clockAsPrinted: string;
  homeScore: number;
  awayScore: number;
  sourcePage: number;
}

/** The report does not print clocks on its period-end score summaries. */
export interface ReportedPeriodEnd {
  period: number;
  homeScore: number;
  awayScore: number;
  sourcePage: number;
}

export interface ReportedScoreFacts {
  reportedScoreRows: ReportedScoreRow[];
  reportedPeriodEnds: ReportedPeriodEnd[];
}

export interface ReportedScoreSequence extends ReportedScoreFacts {
  kind: "official-gamebook-reported-score-sequence";
  gameId: string;
  gameDate: string;
  home: { teamId: number; teamTricode: string; score: number };
  away: { teamId: number; teamTricode: string; score: number };
  source: { url: string; sha256: string; pageCount: number };
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const periodRowCounts = [33, 30, 29, 32];
const periodPages = [[9, 10], [11, 12], [14, 15], [17, 18, 19]];
const endpointPages = [10, 12, 15, 19];

// Used for validation only. Never replace the exact source clock with this value.
function clockSeconds(clock: unknown): number | null {
  if (typeof clock !== "string" || !/^(?:\d{2}:[0-5]\d|:[0-5]\d\.\d)$/.test(clock)) return null;
  const [minutes, seconds] = clock.split(":");
  const value = Number(minutes || "0") * 60 + Number(seconds);
  return value <= 720 ? value : null;
}

/** Strict bounded schema. Content authenticity is checked separately by hash. */
export function validateReportedScoreFacts(raw: unknown): ReportedScoreFacts | null {
  if (!object(raw) || !exactKeys(raw, ["reportedScoreRows", "reportedPeriodEnds"]) ||
    !Array.isArray(raw.reportedScoreRows) || raw.reportedScoreRows.length !== 124 ||
    !Array.isArray(raw.reportedPeriodEnds) || raw.reportedPeriodEnds.length !== 4) return null;
  let offset = 0;
  let previousHome = 0;
  let previousAway = 0;
  for (let index = 0; index < 4; index++) {
    const period = index + 1;
    const endpoint = raw.reportedPeriodEnds[index];
    if (!object(endpoint) || !exactKeys(endpoint, ["period", "homeScore", "awayScore", "sourcePage"]) ||
      endpoint.period !== period || endpoint.sourcePage !== endpointPages[index] ||
      !count(endpoint.homeScore) || !count(endpoint.awayScore)) return null;
    let previousClock = 720;
    let previousPage = periodPages[index][0];
    for (let rowIndex = 0; rowIndex < periodRowCounts[index]; rowIndex++) {
      const row = raw.reportedScoreRows[offset + rowIndex];
      if (!object(row) || !exactKeys(row, ["period", "clockAsPrinted", "homeScore", "awayScore", "sourcePage"]) ||
        row.period !== period || !count(row.sourcePage) || !periodPages[index].includes(row.sourcePage) ||
        row.sourcePage < previousPage || !count(row.homeScore) || !count(row.awayScore) ||
        row.homeScore < previousHome || row.awayScore < previousAway) return null;
      const clock = clockSeconds(row.clockAsPrinted);
      if (clock === null || clock > previousClock) return null;
      // The three printed opening possession rows carry the prior end score.
      if (index > 0 && rowIndex === 0 && (row.clockAsPrinted !== "12:00" ||
        row.homeScore !== previousHome || row.awayScore !== previousAway)) return null;
      previousHome = row.homeScore;
      previousAway = row.awayScore;
      previousClock = clock;
      previousPage = row.sourcePage;
    }
    if (endpoint.homeScore !== previousHome || endpoint.awayScore !== previousAway) return null;
    offset += periodRowCounts[index];
  }
  if (previousHome !== 126 || previousAway !== 110) return null;
  // Return only schema-approved facts. No descriptions, provider IDs or events.
  return structuredClone(raw) as unknown as ReportedScoreFacts;
}
