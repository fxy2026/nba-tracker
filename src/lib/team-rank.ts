import { TEAM_META, type TeamMeta } from "./teams";

/** Finished games must provide a real winner before they can create W/L. */
export function validFinalScore(home: unknown, away: unknown): boolean {
  return typeof home === "number" && typeof away === "number"
    && Number.isSafeInteger(home) && Number.isSafeInteger(away)
    && home >= 0 && away >= 0 && home !== away;
}

/** A zero-win played record is valid; absent, malformed or unplayed is not. */
export function hasPlayedRecord(record: { w: number; l: number } | undefined): boolean {
  return !!record && Number.isSafeInteger(record.w) && Number.isSafeInteger(record.l)
    && record.w >= 0 && record.l >= 0 && record.w + record.l > 0;
}

/**
 * Compute a team's rank within its conference, sorted by win pct desc.
 * Returns 1-indexed rank among teams with valid played records, or 0 otherwise.
 * Equal percentages retain existing TEAM_META order; no official tiebreak claim.
 *
 * `teamRecordMap` should be the league-wide W/L map built from a single
 * schedule pass (so we don't re-iterate the entire schedule per team).
 */
export function conferenceRank(
  team: TeamMeta,
  teamRecordMap: Record<string, { w: number; l: number }>,
): number {
  if (!hasPlayedRecord(teamRecordMap[team.tricode])) return 0;
  const conferenceTeams = Object.values(TEAM_META).filter((tm) => tm.conference === team.conference && hasPlayedRecord(teamRecordMap[tm.tricode]));
  const ranked = conferenceTeams
    .map((tm) => {
      const rec = teamRecordMap[tm.tricode];
      return { tricode: tm.tricode, winPct: rec.w / (rec.w + rec.l) };
    })
    .sort((a, b) => b.winPct - a.winPct);
  return ranked.findIndex((tm) => tm.tricode === team.tricode) + 1;
}
