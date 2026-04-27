// Helper functions for localStorage-based favorites
export function getFavoriteTeams(): string[] {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem('fav_teams') || '[]');
}

export function toggleFavoriteTeam(tricode: string): string[] {
  const favs = getFavoriteTeams();
  const idx = favs.indexOf(tricode);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(tricode);
  localStorage.setItem('fav_teams', JSON.stringify(favs));
  return favs;
}

export function getFavoritePlayers(): number[] {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem('fav_players') || '[]');
}

export function toggleFavoritePlayer(id: number): number[] {
  const favs = getFavoritePlayers();
  const idx = favs.indexOf(id);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(id);
  localStorage.setItem('fav_players', JSON.stringify(favs));
  return favs;
}
