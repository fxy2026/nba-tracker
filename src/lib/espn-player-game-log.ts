import { normalizePlayerGameLog, PLAYER_LOG_STATS, type PlayerGameLogData, type PlayerLogRow, type PlayerLogStat } from "./player-game-log-data";
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const numeric = (value: unknown) => typeof value === "string" && /^(?:\d+(?:\.\d+)?)$/.test(value) ? Number(value) : value === null || value === undefined || value === "--" || value === "-" ? null : NaN;
const sourceDate = (value: unknown) => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
};
const tricode = (value: unknown) => typeof value === "string" ? ({ GS: "GSW", NY: "NYK", NO: "NOP", SA: "SAS", UTAH: "UTA", WSH: "WAS" }[value] ?? value) : null;
/** Athlete identity is bound by the verified endpoint mapping, never by a caller-supplied name. */
export function parseEspnPlayerGameLog(raw: unknown, identity: Pick<PlayerGameLogData, "playerId" | "season" | "seasonType">, espnId: string, retrievedAt: string, archived = false): PlayerGameLogData | null {
  if (!object(raw) || !Array.isArray(raw.filters)) return null;
  const season = raw.filters.filter(f => object(f) && f.name === "season");
  const league = raw.filters.filter(f => object(f) && f.name === "league");
  if (season.length !== 1 || season[0].value !== String(Number(identity.season.slice(0, 4)) + 1) || league.length !== 1 || league[0].value !== "nba") return null;
  // Some future seasons return filters only. Treat as a source empty response,
  // not evidence that a player did not appear in games.
  if (raw.seasonTypes === undefined && raw.events === undefined && raw.names === undefined) {
    return normalizePlayerGameLog({ ...identity, rows: [], source: { provider: "ESPN", url: `https://www.espn.com/nba/player/gamelog/_/id/${espnId}/type/nba/year/${Number(identity.season.slice(0, 4)) + 1}`, retrievedAt, archived }, coverage: "source-season" }, identity);
  }
  if (!Array.isArray(raw.names) || !raw.names.every(name => typeof name === "string") || new Set(raw.names).size !== raw.names.length || !Array.isArray(raw.seasonTypes) || !object(raw.events)) return null;
  const names = raw.names as string[];
  const expected = `${identity.season} ${identity.seasonType === "Playoffs" ? "Postseason" : identity.seasonType === "Pre Season" ? "Preseason" : "Regular Season"}`;
  const groups = raw.seasonTypes.filter(group => object(group) && group.displayName === expected);
  if (groups.length > 1) return null;
  const rows: PlayerLogRow[] = [];
  for (const group of groups) {
    if (!Array.isArray(group.categories)) return null;
    for (const category of group.categories) {
      if (!object(category)) return null;
      if (category.type !== "event") continue;
      if (!Array.isArray(category.events)) return null;
      for (const line of category.events) {
        if (!object(line) || typeof line.eventId !== "string" || !/^\d+$/.test(line.eventId) || !Array.isArray(line.stats) || line.stats.length !== names.length) return null;
        const event = raw.events[line.eventId];
        if (!object(event) || event.id !== line.eventId || !object(event.team) || !object(event.opponent)) return null;
        if (event.team.isAllStar === true || event.opponent.isAllStar === true) continue;
        if (event.team.isAllStar !== false || event.leagueAbbreviation !== "NBA" || !["vs", "@"].includes(String(event.atVs))) return null;
        const home = event.team.id === event.homeTeamId;
        if (!home && event.team.id !== event.awayTeamId || event.opponent.id !== (home ? event.awayTeamId : event.homeTeamId)) return null;
        const date = sourceDate(event.gameDate);
        if (!date) return null;
        // This championship is present in ESPN's regular group but does not
        // count toward NBA regular-season statistics. Never broaden by title alone.
        if (identity.playerId === 2544 && identity.season === "2023-24" && identity.seasonType === "Regular Season" && line.eventId === "401607495") {
          if (date !== "2023-12-09" || event.team.id !== "13" || event.opponent.id !== "11" || !home
            || event.eventNote !== "NBA In-Season Tournament Championship") return null;
          continue;
        }
        const statsByName = Object.fromEntries(names.map((name, index) => [name, (line.stats as unknown[])[index]]));
        // Non-appearance/DNP rows are not games played. Reject unknown text
        // rather than publishing it as a zero-minute statistical appearance.
        const stats = Object.fromEntries(PLAYER_LOG_STATS.map(key => [key, null])) as Record<PlayerLogStat, number | null>;
        const map: Partial<Record<PlayerLogStat, string>> = { min: "minutes", pts: "points", reb: "totalRebounds", ast: "assists", stl: "steals", blk: "blocks", tov: "turnovers", pf: "fouls", oreb: "offensiveRebounds", dreb: "defensiveRebounds", plusMinus: "plusMinus" };
        for (const [key, name] of Object.entries(map)) stats[key as PlayerLogStat] = key === "plusMinus" && typeof statsByName[name] === "string" && /^[+-]?\d+$/.test(statsByName[name] as string) ? Number(statsByName[name]) : numeric(statsByName[name]);
        for (const [field, made, attempted] of [["fieldGoalsMade-fieldGoalsAttempted", "fgm", "fga"], ["threePointFieldGoalsMade-threePointFieldGoalsAttempted", "fg3m", "fg3a"], ["freeThrowsMade-freeThrowsAttempted", "ftm", "fta"]] as const) {
          const rawPair = statsByName[field];
          if (rawPair === undefined || rawPair === null || rawPair === "--" || rawPair === "-") continue;
          const match = typeof rawPair === "string" ? /^(\d+)-(\d+)$/.exec(rawPair) : null;
          if (!match) return null;
          stats[made] = Number(match[1]); stats[attempted] = Number(match[2]);
        }
        const boxLink = Array.isArray(event.links) ? event.links.find(link => object(link) && Array.isArray(link.rel) && link.rel.includes("boxscore") && link.rel.includes("desktop") && typeof link.href === "string") : null;
        if (!boxLink || !/^https:\/\/www\.espn\.com\/nba\/boxscore\/_\/gameId\/\d+$/.test(boxLink.href) || !boxLink.href.endsWith(`/${line.eventId}`)) return null;
        rows.push({ id: `espn:${line.eventId}`, nbaGameId: null, date, team: tricode(event.team.abbreviation) as string, opponent: tricode(event.opponent.abbreviation) as string, home, wl: event.gameResult as "W" | "L", sourceUrl: boxLink.href, ...stats });
      }
    }
  }
  return normalizePlayerGameLog({ ...identity, rows, source: { provider: "ESPN", url: `https://www.espn.com/nba/player/gamelog/_/id/${espnId}/type/nba/year/${Number(identity.season.slice(0, 4)) + 1}`, retrievedAt, archived }, coverage: "source-season" }, identity);
}
