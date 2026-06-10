// Shared shapes + pure builders for /team-stats: turns the schedule-derived
// standings pass and the stats.nba.com leaguedashteamstats payload into one
// ranked-board shape, so the page renders both sources identically — and can
// drop the upstream boards alone when stats.nba.com is unreachable.
import type { StandingsRow } from "@/lib/standings-splits";
import { TEAM_META } from "@/lib/teams";

export type ScheduleCategoryKey = "PTS" | "OPP_PTS" | "NET";
export type UpstreamCategoryKey =
  | "FG_PCT" | "FG3_PCT" | "FT_PCT" | "REB" | "AST" | "TOV" | "STL" | "BLK";
export type CategoryKey = ScheduleCategoryKey | UpstreamCategoryKey;

export interface BoardCategory {
  key: CategoryKey;
  zh: string;
  en: string;
  /** schedule = computed from cached final scores; upstream = stats.nba.com */
  source: "schedule" | "upstream";
  /** false → ascending sort, the leader has the LOWEST value (失分 / 失误) */
  higherIsBetter: boolean;
  format: "decimal" | "pct" | "signed";
}

export const CATEGORIES: readonly BoardCategory[] = [
  { key: "PTS", zh: "得分", en: "Points", source: "schedule", higherIsBetter: true, format: "decimal" },
  { key: "OPP_PTS", zh: "失分", en: "Points Allowed", source: "schedule", higherIsBetter: false, format: "decimal" },
  { key: "NET", zh: "净胜分", en: "Point Diff", source: "schedule", higherIsBetter: true, format: "signed" },
  { key: "FG_PCT", zh: "投篮命中率", en: "FG%", source: "upstream", higherIsBetter: true, format: "pct" },
  { key: "FG3_PCT", zh: "三分命中率", en: "3P%", source: "upstream", higherIsBetter: true, format: "pct" },
  { key: "FT_PCT", zh: "罚球命中率", en: "FT%", source: "upstream", higherIsBetter: true, format: "pct" },
  { key: "REB", zh: "篮板", en: "Rebounds", source: "upstream", higherIsBetter: true, format: "decimal" },
  { key: "AST", zh: "助攻", en: "Assists", source: "upstream", higherIsBetter: true, format: "decimal" },
  { key: "TOV", zh: "失误", en: "Turnovers", source: "upstream", higherIsBetter: false, format: "decimal" },
  { key: "STL", zh: "抢断", en: "Steals", source: "upstream", higherIsBetter: true, format: "decimal" },
  { key: "BLK", zh: "盖帽", en: "Blocks", source: "upstream", higherIsBetter: true, format: "decimal" },
];

export interface TeamBoardRow {
  teamId: number;
  tricode: string;
  value: number;
  detailZh: string;
  detailEn: string;
}

export type ScheduleBoards = Record<ScheduleCategoryKey, TeamBoardRow[]>;
export type UpstreamBoards = Record<UpstreamCategoryKey, TeamBoardRow[]>;

function ranked(rows: TeamBoardRow[], higherIsBetter: boolean): TeamBoardRow[] {
  return [...rows].sort(
    (a, b) => (higherIsBetter ? b.value - a.value : a.value - b.value) || a.tricode.localeCompare(b.tricode)
  );
}

/** PPG / OPPG / net boards from the one-pass standings computation — no upstream dependency. */
export function buildScheduleBoards(rows: StandingsRow[]): ScheduleBoards {
  const pts: TeamBoardRow[] = [];
  const opp: TeamBoardRow[] = [];
  const net: TeamBoardRow[] = [];
  for (const r of rows) {
    const gp = r.wins + r.losses;
    if (gp === 0) continue;
    const base = { teamId: r.teamId, tricode: r.tricode };
    pts.push({ ...base, value: r.ppg, detailZh: `${gp} 场 · 场均失 ${r.oppg.toFixed(1)} 分`, detailEn: `${gp} GP · ${r.oppg.toFixed(1)} allowed` });
    opp.push({ ...base, value: r.oppg, detailZh: `${gp} 场 · 场均得 ${r.ppg.toFixed(1)} 分`, detailEn: `${gp} GP · ${r.ppg.toFixed(1)} scored` });
    net.push({ ...base, value: r.diff, detailZh: `场均得 ${r.ppg.toFixed(1)} · 失 ${r.oppg.toFixed(1)}`, detailEn: `${r.ppg.toFixed(1)} for · ${r.oppg.toFixed(1)} against` });
  }
  return { PTS: ranked(pts, true), OPP_PTS: ranked(opp, false), NET: ranked(net, true) };
}

const TRICODE_BY_ID = new Map(Object.values(TEAM_META).map((m) => [m.teamId, m.tricode] as const));

const REQUIRED_HEADERS = [
  "TEAM_ID", "GP", "FGM", "FGA", "FG_PCT", "FG3M", "FG3A", "FG3_PCT",
  "FTM", "FTA", "FT_PCT", "OREB", "DREB", "REB", "AST", "TOV", "STL", "BLK",
] as const;

/**
 * Parse a leaguedashteamstats (PerMode=PerGame) payload into ranked boards.
 * Header-driven so column order doesn't matter; returns null on any
 * unexpected shape so callers can fall back to the schedule boards alone.
 */
export function parseUpstreamBoards(data: unknown): UpstreamBoards | null {
  const d = data as {
    resultSets?: { headers?: unknown[]; rowSet?: unknown[][] }[];
    resultSet?: { headers?: unknown[]; rowSet?: unknown[][] };
  } | null;
  const rs = d?.resultSets?.[0] ?? d?.resultSet;
  if (!Array.isArray(rs?.headers) || !Array.isArray(rs?.rowSet)) return null;

  const idx = new Map<string, number>();
  rs.headers.forEach((h, i) => {
    if (typeof h === "string") idx.set(h, i);
  });
  if (REQUIRED_HEADERS.some((h) => !idx.has(h))) return null;

  const boards: UpstreamBoards = { FG_PCT: [], FG3_PCT: [], FT_PCT: [], REB: [], AST: [], TOV: [], STL: [], BLK: [] };
  for (const row of rs.rowSet) {
    if (!Array.isArray(row)) continue;
    const num = (h: string) => {
      const v = Number(row[idx.get(h)!]);
      return Number.isFinite(v) ? v : 0;
    };
    const teamId = num("TEAM_ID");
    const tricode = TRICODE_BY_ID.get(teamId);
    if (!tricode) continue; // skip non-NBA entrants defensively

    const base = { teamId, tricode };
    const f1 = (h: string) => num(h).toFixed(1);
    const gp = num("GP");
    const astTo = num("TOV") > 0 ? (num("AST") / num("TOV")).toFixed(2) : "—";

    boards.FG_PCT.push({ ...base, value: num("FG_PCT"), detailZh: `命中 ${f1("FGM")} · 出手 ${f1("FGA")}`, detailEn: `${f1("FGM")} made · ${f1("FGA")} att` });
    boards.FG3_PCT.push({ ...base, value: num("FG3_PCT"), detailZh: `命中 ${f1("FG3M")} · 出手 ${f1("FG3A")}`, detailEn: `${f1("FG3M")} made · ${f1("FG3A")} att` });
    boards.FT_PCT.push({ ...base, value: num("FT_PCT"), detailZh: `命中 ${f1("FTM")} · 出手 ${f1("FTA")}`, detailEn: `${f1("FTM")} made · ${f1("FTA")} att` });
    boards.REB.push({ ...base, value: num("REB"), detailZh: `前场 ${f1("OREB")} · 后场 ${f1("DREB")}`, detailEn: `${f1("OREB")} off · ${f1("DREB")} def` });
    boards.AST.push({ ...base, value: num("AST"), detailZh: `助攻失误比 ${astTo}`, detailEn: `AST/TO ${astTo}` });
    boards.TOV.push({ ...base, value: num("TOV"), detailZh: `助攻失误比 ${astTo}`, detailEn: `AST/TO ${astTo}` });
    boards.STL.push({ ...base, value: num("STL"), detailZh: `出战 ${gp} 场`, detailEn: `${gp} GP` });
    boards.BLK.push({ ...base, value: num("BLK"), detailZh: `出战 ${gp} 场`, detailEn: `${gp} GP` });
  }
  if (boards.FG_PCT.length === 0) return null;

  for (const c of CATEGORIES) {
    if (c.source !== "upstream") continue;
    const k = c.key as UpstreamCategoryKey;
    boards[k] = ranked(boards[k], c.higherIsBetter);
  }
  return boards;
}

export function formatBoardValue(value: number, format: BoardCategory["format"]): string {
  if (format === "pct") return `${(value * 100).toFixed(1)}%`;
  if (format === "signed") return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
  return value.toFixed(1);
}

export function leagueAverage(rows: TeamBoardRow[]): number {
  if (rows.length === 0) return 0;
  return rows.reduce((s, r) => s + r.value, 0) / rows.length;
}

/**
 * Index in a ranked board where the league-average marker belongs: the first
 * row on the "worse than average" side. rows.length when no row is worse.
 */
export function averageInsertIndex(rows: TeamBoardRow[], higherIsBetter: boolean, avg: number): number {
  const i = rows.findIndex((r) => (higherIsBetter ? r.value < avg : r.value > avg));
  return i === -1 ? rows.length : i;
}
