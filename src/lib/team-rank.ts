import { TEAM_META, type TeamMeta } from "./teams";

/**
 * Compute a team's rank within its conference, sorted by win pct desc.
 * Returns 1-indexed rank, or 0 if the team has no games yet.
 *
 * `teamRecordMap` should be the league-wide W/L map built from a single
 * schedule pass (so we don't re-iterate the entire schedule per team).
 */
export function conferenceRank(
  team: TeamMeta,
  teamRecordMap: Record<string, { w: number; l: number }>,
): number {
  const conferenceTeams = Object.values(TEAM_META).filter((tm) => tm.conference === team.conference);
  const ranked = conferenceTeams
    .map((tm) => {
      const rec = teamRecordMap[tm.tricode] || { w: 0, l: 0 };
      return { tricode: tm.tricode, winPct: rec.w + rec.l > 0 ? rec.w / (rec.w + rec.l) : 0 };
    })
    .sort((a, b) => b.winPct - a.winPct);
  return ranked.findIndex((tm) => tm.tricode === team.tricode) + 1;
}
