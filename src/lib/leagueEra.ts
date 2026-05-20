// League-wide single-season averages — used to put individual stats in era
// context ("30 PPG in a 25-PPG-league era is +5"). Sourced from Basketball-
// Reference's league-totals tables; hand-curated for the seasons that any
// iconic snapshot or legend in our dataset overlaps with.
//
// Coverage is sparse on purpose: only seasons referenced elsewhere need
// entries. Lookup falls back gracefully when a year is missing.

export interface LeagueEra {
  // First year of the season — matches IconicSeason.seasonYear
  year: number;
  // Display label "1995-96"
  season: string;
  // League per-game averages (one team)
  ppg: number;
  // Possessions per 48
  pace: number;
  // League True Shooting %, 0-1
  ts: number;
}

export const LEAGUE_ERA: LeagueEra[] = [
  { year: 1961, season: "1961-62", ppg: 118.8, pace: 125.5, ts: 0.477 },
  { year: 1969, season: "1969-70", ppg: 116.7, pace: 117.7, ts: 0.498 },
  { year: 1976, season: "1976-77", ppg: 106.5, pace: 106.5, ts: 0.523 },
  { year: 1979, season: "1979-80", ppg: 109.3, pace: 103.1, ts: 0.541 },
  { year: 1984, season: "1984-85", ppg: 110.8, pace: 102.1, ts: 0.541 },
  { year: 1985, season: "1985-86", ppg: 110.2, pace: 102.1, ts: 0.541 },
  { year: 1986, season: "1986-87", ppg: 109.9, pace: 100.8, ts: 0.541 },
  { year: 1987, season: "1987-88", ppg: 108.2, pace: 99.6, ts: 0.541 },
  { year: 1992, season: "1992-93", ppg: 105.3, pace: 96.8, ts: 0.534 },
  { year: 1993, season: "1993-94", ppg: 101.5, pace: 95.1, ts: 0.522 },
  { year: 1995, season: "1995-96", ppg: 99.5, pace: 91.8, ts: 0.527 },
  { year: 1999, season: "1999-00", ppg: 97.5, pace: 93.1, ts: 0.520 },
  { year: 2002, season: "2002-03", ppg: 95.1, pace: 91.0, ts: 0.519 },
  { year: 2003, season: "2003-04", ppg: 93.4, pace: 90.1, ts: 0.516 },
  { year: 2005, season: "2005-06", ppg: 97.0, pace: 90.5, ts: 0.539 },
  { year: 2006, season: "2006-07", ppg: 98.7, pace: 91.9, ts: 0.541 },
  { year: 2007, season: "2007-08", ppg: 99.9, pace: 92.4, ts: 0.541 },
  { year: 2009, season: "2009-10", ppg: 100.4, pace: 92.7, ts: 0.541 },
  { year: 2014, season: "2014-15", ppg: 100.0, pace: 93.9, ts: 0.534 },
  { year: 2015, season: "2015-16", ppg: 102.7, pace: 95.8, ts: 0.541 },
  { year: 2016, season: "2016-17", ppg: 105.6, pace: 96.4, ts: 0.553 },
  { year: 2017, season: "2017-18", ppg: 106.3, pace: 97.3, ts: 0.561 },
  { year: 2018, season: "2018-19", ppg: 111.2, pace: 100.0, ts: 0.560 },
  { year: 2019, season: "2019-20", ppg: 111.8, pace: 100.3, ts: 0.566 },
  { year: 2020, season: "2020-21", ppg: 112.1, pace: 99.2, ts: 0.572 },
  { year: 2023, season: "2023-24", ppg: 114.2, pace: 99.6, ts: 0.578 },
];

const BY_YEAR: Record<number, LeagueEra> = Object.fromEntries(LEAGUE_ERA.map((e) => [e.year, e]));

// Return the league snapshot for that season — or the nearest known year
// when the exact one isn't in the dataset (rare for our use case).
export function getLeagueEra(seasonStartYear: number): LeagueEra | null {
  if (BY_YEAR[seasonStartYear]) return BY_YEAR[seasonStartYear];
  let best: LeagueEra | null = null;
  let bestDiff = Infinity;
  for (const e of LEAGUE_ERA) {
    const d = Math.abs(e.year - seasonStartYear);
    if (d < bestDiff) { best = e; bestDiff = d; }
  }
  return bestDiff <= 3 ? best : null;
}

// True Shooting % from raw shooting splits. Uses the standard formula:
//   TS = PTS / (2 * (FGA + 0.44 * FTA))
// We don't carry FGA/FTA in IconicSeason, so approximate from PPG and the
// shooting splits when caller provides them. Returns null when inputs
// can't ground the calc.
export function approxTsPct(args: { ppg: number; fgPct?: number; tpPct?: number; ftPct?: number; tpRate?: number; ftRate?: number }): number | null {
  // The "exact" TS% needs raw FGA + FTA. Without those we can't compute
  // truthfully. Callers should fall back to displaying eFG-ish or skipping.
  const { fgPct, ftPct } = args;
  if (fgPct === undefined || ftPct === undefined) return null;
  // Very rough eFG ≈ FG% + 0.5 * 3P-rate * 3P%. We don't have 3P-rate, so
  // we approximate TS% as a weighted blend of FG% and FT% — only useful
  // as a crude comparison band, not a precise number.
  return fgPct * 0.85 + ftPct * 0.15;
}
