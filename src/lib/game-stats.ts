import type { BoxScoreTeam, PlayerStats, ShotAction } from "@/lib/api";

// Numeric minutes from the CDN's ISO-8601 duration ("PT34M12.00S" -> 34.2)
export function minutesFromIso(minutes: string): number {
  const match = /PT(\d+)M([\d.]+)S/.exec(minutes || "");
  if (!match) return 0;
  return parseInt(match[1], 10) + parseFloat(match[2]) / 60;
}

// Hollinger Game Score — the standard single-number read on a box score line
export function gameScore(s: PlayerStats["statistics"]): number {
  return (
    s.points +
    0.4 * s.fieldGoalsMade -
    0.7 * s.fieldGoalsAttempted -
    0.4 * (s.freeThrowsAttempted - s.freeThrowsMade) +
    0.7 * s.reboundsOffensive +
    0.3 * s.reboundsDefensive +
    s.steals +
    0.7 * s.assists +
    0.7 * s.blocks -
    0.4 * s.foulsPersonal -
    s.turnovers
  );
}

// Hupu-style 0-10 grade, one decimal: 5.0 is a neutral night, 7.0 a solid
// starter line (GmSc 10), 9.0 a star night (GmSc 20). Stints under 15 minutes
// regress toward 5.0 so a 3-minute garbage-time line can't spike the scale.
export function scoreToGrade(gs: number, minutes: number): number {
  const weight = Math.min(Math.max(minutes, 0), 15) / 15;
  const grade = 5 + (gs / 5) * weight;
  return Math.round(Math.min(10, Math.max(0, grade)) * 10) / 10;
}

// Color band for a 0-10 grade (Hupu palette: gold star night, green good,
// neutral average, red rough outing)
export function gradeColorClass(grade: number): string {
  if (grade >= 9) return "text-accent-amber bg-accent-amber/10";
  if (grade >= 7) return "text-success bg-success/10";
  if (grade >= 5) return "text-text-secondary bg-bg-hover";
  return "text-danger bg-danger/10";
}

// 本场最佳: highest grade across both rosters (raw Game Score breaks ties)
export function getPlayerOfTheGame(homeTeam: BoxScoreTeam, awayTeam: BoxScoreTeam) {
  let best: { name: string; personId: number; teamTricode: string; grade: number; gameScore: number } | null = null;
  for (const team of [awayTeam, homeTeam]) {
    for (const p of team.players) {
      if (p.played !== "1") continue;
      const mins = minutesFromIso(p.statistics.minutes);
      if (mins <= 0) continue;
      const gs = gameScore(p.statistics);
      const grade = scoreToGrade(gs, mins);
      if (!best || grade > best.grade || (grade === best.grade && gs > best.gameScore)) {
        best = { name: p.nameI, personId: p.personId, teamTricode: team.teamTricode, grade, gameScore: gs };
      }
    }
  }
  return best;
}

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
