import { isPlayoff } from "@/lib/games";
import { TEAM_META } from "@/lib/teams";

export interface SeriesTeam {
  tricode: string;
  teamId: number;
  teamCity: string;
  teamName: string;
  wins: number;
  seed: number;
}

export interface Series {
  id: string;
  gameIdSample: string; // any game's gameId from this series — used to derive round
  team1: SeriesTeam;
  team2: SeriesTeam;
  totalGames: number;
  conference: "East" | "West" | "Finals";
  round: number;
  seriesIndex: number; // index within round, used for bracket layout ordering
  results: ("T1" | "T2")[];
  isProjected?: boolean; // true if this is a placeholder for an upcoming series
  // For partial projections (one team known, other TBD): the unknown side carries candidates
  team1Candidates?: SeriesTeam[]; // if set, team1 is TBD with these as possible winners
  team2Candidates?: SeriesTeam[]; // if set, team2 is TBD with these as possible winners
}

export function getConference(tricode1: string, tricode2: string): "East" | "West" | "Finals" {
  const t1 = TEAM_META[tricode1];
  const t2 = TEAM_META[tricode2];
  if (!t1 || !t2) return "East";
  if (t1.conference !== t2.conference) return "Finals";
  return t1.conference as "East" | "West";
}

/**
 * Parse round from NBA playoff gameId.
 * Format: `004` + 2-digit season + `00` + 1-digit round + 1-digit series + 1-digit game
 * Example: "0042500201" → round=2, series=0, game=1 (R2, East series 0, Game 1)
 * Rounds: 1=R1 (8 series), 2=R2/Semis (4 series), 3=ConfFinals (2 series), 4=Finals (1 series)
 */
export function parseGameId(gameId: string): { round: number; seriesIndex: number; game: number } {
  if (!isPlayoff(gameId) || gameId.length < 10) return { round: 0, seriesIndex: 0, game: 0 };
  const round = parseInt(gameId.charAt(7)) || 0;
  const seriesIndex = parseInt(gameId.charAt(8)) || 0;
  const game = parseInt(gameId.charAt(9)) || 0;
  return { round, seriesIndex, game };
}

export function winnerOf(s: Series): SeriesTeam | null {
  if (s.team1.wins === 4) return s.team1;
  if (s.team2.wins === 4) return s.team2;
  return null;
}

export function isOnChampionPath(s: Series, allSeries: Series[]): boolean {
  const champion = allSeries.find((x) => x.conference === "Finals" && winnerOf(x));
  if (!champion) return false;
  const championTri = winnerOf(champion)!.tricode;
  const winner = winnerOf(s);
  return winner?.tricode === championTri;
}

// Returns either the winner (if decided) or the list of candidate teams from a series.
// For a R1 series in progress, candidates are team1 + team2. For a projected R1 series
// with candidates, it bubbles them up.
export function winnerOrCandidates(s: Series | undefined): { winner: SeriesTeam | null; candidates: SeriesTeam[] } {
  if (!s) return { winner: null, candidates: [] };
  const w = winnerOf(s);
  if (w) return { winner: w, candidates: [w] };
  const t1Cands = s.team1Candidates && s.team1Candidates.length > 0 ? s.team1Candidates : (s.team1.tricode ? [s.team1] : []);
  const t2Cands = s.team2Candidates && s.team2Candidates.length > 0 ? s.team2Candidates : (s.team2.tricode ? [s.team2] : []);
  return { winner: null, candidates: [...t1Cands, ...t2Cands] };
}

export function makeProjectedFull(
  round: number,
  seriesIndex: number,
  conference: "East" | "West" | "Finals",
  teamA: SeriesTeam,
  teamB: SeriesTeam,
): Series {
  const codes = [teamA.tricode, teamB.tricode].sort();
  const [t1, t2] = teamA.tricode === codes[0] ? [teamA, teamB] : [teamB, teamA];
  return {
    id: `projected-R${round}S${seriesIndex}-${codes.join("-")}`,
    gameIdSample: "",
    team1: { ...t1, wins: 0 },
    team2: { ...t2, wins: 0 },
    totalGames: 0,
    conference,
    round,
    seriesIndex,
    results: [],
    isProjected: true,
  };
}

export function makeProjectedPartial(
  round: number,
  seriesIndex: number,
  conference: "East" | "West" | "Finals",
  knownTeam: SeriesTeam,
  candidates: SeriesTeam[],
  knownOnLeft: boolean,
): Series {
  const empty: SeriesTeam = { tricode: "", teamId: 0, teamCity: "", teamName: "", wins: 0, seed: 0 };
  const t1 = knownOnLeft ? knownTeam : empty;
  const t2 = knownOnLeft ? empty : knownTeam;
  return {
    id: `projected-partial-R${round}S${seriesIndex}-${knownTeam.tricode}`,
    gameIdSample: "",
    team1: { ...t1, wins: 0 },
    team2: { ...t2, wins: 0 },
    totalGames: 0,
    conference,
    round,
    seriesIndex,
    results: [],
    isProjected: true,
    team1Candidates: knownOnLeft ? undefined : candidates,
    team2Candidates: knownOnLeft ? candidates : undefined,
  };
}

/**
 * Project placeholder series for future rounds based on already-decided winners.
 * Two modes per series:
 *  - FULL projection: both feeders have winners → both teams pre-filled
 *  - PARTIAL projection: only one feeder has a winner → that team is set, the
 *    other side shows the two candidates from the unfinished feeder series
 *
 * Cascades R1 → R2 → R3 → Finals. Partial projections in earlier rounds become
 * inputs to even more partial projections later (the candidates list grows).
 *
 * Standard NBA bracket pairing:
 *  - R1 series 0,1 → R2 series 0 (East top)
 *  - R1 series 2,3 → R2 series 1 (East bottom)
 *  - R1 series 4,5 → R2 series 2 (West top)
 *  - R1 series 6,7 → R2 series 3 (West bottom)
 *  - R2 series 0,1 → R3 series 0 (East ConfFinal)
 *  - R2 series 2,3 → R3 series 1 (West ConfFinal)
 *  - R3 series 0,1 → R4 series 0 (Finals)
 */
export function projectFutureSeries(actual: Series[]): Series[] {
  const out: Series[] = [...actual];
  const findInOut = (round: number, seriesIndex: number) =>
    out.find((s) => s.round === round && s.seriesIndex === seriesIndex);

  const project = (
    round: number,
    seriesIndex: number,
    conference: "East" | "West" | "Finals",
    feederA: Series | undefined,
    feederB: Series | undefined,
  ) => {
    if (findInOut(round, seriesIndex)) return;
    const a = winnerOrCandidates(feederA);
    const b = winnerOrCandidates(feederB);
    if (a.winner && b.winner) {
      out.push(makeProjectedFull(round, seriesIndex, conference, a.winner, b.winner));
    } else if (a.winner && b.candidates.length > 0) {
      out.push(makeProjectedPartial(round, seriesIndex, conference, a.winner, b.candidates, true));
    } else if (b.winner && a.candidates.length > 0) {
      out.push(makeProjectedPartial(round, seriesIndex, conference, b.winner, a.candidates, false));
    }
    // both unknown: skip (we don't have enough info to show anything useful)
  };

  // NBA standard pairing: 1v8 winner meets 4v5 winner (top quarter), 2v7 winner
  // meets 3v6 winner (bottom quarter). The series indices follow seed pattern
  // 0=1v8, 1=2v7, 2=3v6, 3=4v5, so:
  //   R2.0 (East top) = R1.0 (1v8) + R1.3 (4v5)
  //   R2.1 (East bottom) = R1.1 (2v7) + R1.2 (3v6)
  // West mirrors with offset 4.
  const r2Pairings: { r2Idx: number; r1A: number; r1B: number; conf: "East" | "West" }[] = [
    { r2Idx: 0, r1A: 0, r1B: 3, conf: "East" },
    { r2Idx: 1, r1A: 1, r1B: 2, conf: "East" },
    { r2Idx: 2, r1A: 4, r1B: 7, conf: "West" },
    { r2Idx: 3, r1A: 5, r1B: 6, conf: "West" },
  ];
  for (const p of r2Pairings) {
    project(2, p.r2Idx, p.conf, findInOut(1, p.r1A), findInOut(1, p.r1B));
  }

  const r3Pairings: { r3Idx: number; r2A: number; r2B: number; conf: "East" | "West" }[] = [
    { r3Idx: 0, r2A: 0, r2B: 1, conf: "East" },
    { r3Idx: 1, r2A: 2, r2B: 3, conf: "West" },
  ];
  for (const p of r3Pairings) {
    project(3, p.r3Idx, p.conf, findInOut(2, p.r2A), findInOut(2, p.r2B));
  }

  project(4, 0, "Finals", findInOut(3, 0), findInOut(3, 1));

  return out;
}
