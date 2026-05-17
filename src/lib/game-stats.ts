import type { BoxScoreTeam, ShotAction } from "@/lib/api";

// Top scorer / assist man for a team — returns null when no one played
export function getTopScorer(team: BoxScoreTeam) {
  const played = team.players.filter((p) => p.played === "1");
  if (played.length === 0) return null;
  return played.reduce((best, p) => (p.statistics.points > best.statistics.points ? p : best));
}

export function getTopAssist(team: BoxScoreTeam) {
  const played = team.players.filter((p) => p.played === "1");
  if (played.length === 0) return null;
  return played.reduce((best, p) => (p.statistics.assists > best.statistics.assists ? p : best));
}

// Double-doubles + triple-doubles for a team (>=2 / >=3 categories with 10+)
export function getSpecialPerformances(team: BoxScoreTeam) {
  return team.players
    .filter((p) => {
      if (p.played !== "1") return false;
      const s = p.statistics;
      const doubleDigits = [s.points, s.reboundsTotal, s.assists, s.steals, s.blocks].filter((v) => v >= 10).length;
      return doubleDigits >= 2;
    })
    .map((p) => {
      const s = p.statistics;
      const doubleDigits = [s.points, s.reboundsTotal, s.assists, s.steals, s.blocks].filter((v) => v >= 10).length;
      return { name: p.nameI, isTriple: doubleDigits >= 3, pts: s.points, reb: s.reboundsTotal, ast: s.assists };
    });
}

// Approximate largest lead from cumulative period scores (no second-by-second
// data, so leads inside a quarter aren't visible)
export function getLargestLead(team: BoxScoreTeam, opponent: BoxScoreTeam) {
  let teamTotal = 0;
  let oppTotal = 0;
  let maxLead = 0;
  for (let i = 0; i < team.periods.length; i++) {
    teamTotal += team.periods[i]?.score || 0;
    oppTotal += opponent.periods[i]?.score || 0;
    const lead = teamTotal - oppTotal;
    if (lead > maxLead) maxLead = lead;
  }
  return maxLead;
}

// Longest unanswered scoring run (in points) inferred from made-shot order
export function getBiggestRun(shots: ShotAction[]) {
  if (shots.length === 0) return null;
  const madeShots = shots
    .filter((s) => s.shotResult === "Made")
    .sort((a, b) => {
      if (a.period !== b.period) return a.period - b.period;
      // clock counts down inside a period (12:00 -> 0:00) so reverse compare
      return (b.clock || "").localeCompare(a.clock || "");
    });
  let bestRun = { team: "", points: 0, period: 0 };
  let currentTeam = "";
  let currentPoints = 0;
  let currentPeriod = 0;
  for (const shot of madeShots) {
    const teamKey = shot.teamTricode;
    const is3 = shot.subType?.toLowerCase().includes("3pt") || shot.shotDistance > 22;
    const pts = is3 ? 3 : 2;
    if (teamKey === currentTeam) {
      currentPoints += pts;
    } else {
      if (currentPoints > bestRun.points) {
        bestRun = { team: currentTeam, points: currentPoints, period: currentPeriod };
      }
      currentTeam = teamKey;
      currentPoints = pts;
      currentPeriod = shot.period;
    }
  }
  if (currentPoints > bestRun.points) {
    bestRun = { team: currentTeam, points: currentPoints, period: currentPeriod };
  }
  if (bestRun.points < 4) return null;
  const qLabel = bestRun.period <= 4 ? `Q${bestRun.period}` : `OT${bestRun.period - 4}`;
  return { teamTricode: bestRun.team, points: bestRun.points, qLabel };
}

// AST/TO ratio for a team (formatted to 2 decimals; "-" when no turnovers)
export function getAstToRatio(team: BoxScoreTeam) {
  let ast = 0;
  let to = 0;
  for (const p of team.players) {
    if (p.played !== "1") continue;
    ast += p.statistics.assists;
    to += p.statistics.turnovers;
  }
  return to > 0 ? (ast / to).toFixed(2) : "-";
}

// Total team fouls from individual lines (the team statistics block doesn't
// always agree with the per-player sum)
export function getTeamFouls(team: BoxScoreTeam) {
  let fouls = 0;
  for (const p of team.players) if (p.played === "1") fouls += p.statistics.foulsPersonal;
  return fouls;
}

// Hero player: weighted box-score formula (PTS + 1.2 REB + 1.5 AST) across both teams
export function getGameHero(homeTeam: BoxScoreTeam, awayTeam: BoxScoreTeam) {
  const allPlayed = [...homeTeam.players, ...awayTeam.players].filter((p) => p.played === "1");
  if (allPlayed.length === 0) return null;
  return allPlayed.reduce((best, p) => {
    const score = p.statistics.points + p.statistics.reboundsTotal * 1.2 + p.statistics.assists * 1.5;
    const bestScore = best.statistics.points + best.statistics.reboundsTotal * 1.2 + best.statistics.assists * 1.5;
    return score > bestScore ? p : best;
  });
}

// Number of times the lead flipped (not counting ties), from cumulative period scores
export function getLeadChanges(homeTeam: BoxScoreTeam, awayTeam: BoxScoreTeam) {
  let leadChanges = 0;
  let homeCum = 0;
  let awayCum = 0;
  let prevLeader: "home" | "away" | "tie" = "tie";
  for (let i = 0; i < homeTeam.periods.length; i++) {
    homeCum += homeTeam.periods[i]?.score || 0;
    awayCum += awayTeam.periods[i]?.score || 0;
    const leader = homeCum > awayCum ? "home" : awayCum > homeCum ? "away" : "tie";
    if (leader !== "tie" && leader !== prevLeader && prevLeader !== "tie") {
      leadChanges++;
    }
    if (leader !== "tie") prevLeader = leader;
  }
  return leadChanges;
}

// Best player in the highest-scoring quarter (FG points only — FTs not in shot data)
export function getQuarterMvp(shots: ShotAction[]) {
  if (shots.length === 0) return null;
  const quarterScoring: Record<number, Record<string, { name: string; pts: number }>> = {};
  for (const shot of shots) {
    if (shot.shotResult !== "Made") continue;
    const period = shot.period;
    if (!quarterScoring[period]) quarterScoring[period] = {};
    if (!quarterScoring[period][shot.personId]) {
      quarterScoring[period][shot.personId] = { name: shot.playerNameI, pts: 0 };
    }
    const is3 = shot.subType?.toLowerCase().includes("3pt") || shot.shotDistance > 22;
    quarterScoring[period][shot.personId].pts += is3 ? 3 : 2;
  }
  let bestQuarter = 0;
  let bestQuarterTotal = 0;
  for (const [q, players] of Object.entries(quarterScoring)) {
    const total = Object.values(players).reduce((s, p) => s + p.pts, 0);
    if (total > bestQuarterTotal) {
      bestQuarterTotal = total;
      bestQuarter = parseInt(q);
    }
  }
  if (bestQuarter === 0) return null;
  const qPlayers = quarterScoring[bestQuarter];
  let mvpName = "";
  let mvpPts = 0;
  for (const p of Object.values(qPlayers)) {
    if (p.pts > mvpPts) {
      mvpPts = p.pts;
      mvpName = p.name;
    }
  }
  if (!mvpName) return null;
  const qLabel = bestQuarter <= 4 ? `Q${bestQuarter}` : `OT${bestQuarter - 4}`;
  return { name: mvpName, pts: mvpPts, qLabel };
}

// Pace (FG-style label + per-quarter rate)
export function getPaceLabel(homeTeam: BoxScoreTeam, awayTeam: BoxScoreTeam) {
  const totalPoints = homeTeam.score + awayTeam.score;
  const numPeriods = Math.max(homeTeam.periods?.length || 4, 4);
  const pacePerQ = numPeriods > 0 ? totalPoints / numPeriods : 0;
  const label = pacePerQ > 55 ? "Fast Pace" : pacePerQ < 45 ? "Slow" : "Normal";
  const color =
    pacePerQ > 55
      ? "text-success bg-success/10"
      : pacePerQ < 45
      ? "text-accent-amber bg-accent-amber/10"
      : "text-text-secondary bg-bg-hover";
  return { label, color, pacePerQ };
}
