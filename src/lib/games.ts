// gameId prefix predicates — the NBA encodes game type in first 3 digits.
// 001 = preseason, 002 = regular season, 003 = all-star, 004 = playoffs, 005 = play-in
export function isPreseason(gameId: string): boolean { return gameId.startsWith("001"); }
export function isRegular(gameId: string): boolean { return gameId.startsWith("002"); }
export function isAllStar(gameId: string): boolean { return gameId.startsWith("003"); }
export function isPlayoff(gameId: string): boolean { return gameId.startsWith("004"); }
export function isPlayIn(gameId: string): boolean { return gameId.startsWith("005"); }
// Exclude exhibitions (preseason + all-star — both contain non-NBA teams)
export function isCountedSeason(gameId: string): boolean {
  return !isPreseason(gameId) && !isAllStar(gameId);
}

export function winPct(wins: number, losses: number): number {
  const total = wins + losses;
  return total > 0 ? wins / total : 0;
}
