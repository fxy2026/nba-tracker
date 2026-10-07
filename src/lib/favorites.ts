// Helper functions for localStorage-based favorites
export function getFavoriteTeams(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('fav_teams') || '[]'); }
  catch { return []; }
}

// Null means the change was not saved; callers must retain their current UI.
export function toggleFavoriteTeam(tricode: string): string[] | null {
  const favs = getFavoriteTeams();
  const idx = favs.indexOf(tricode);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(tricode);
  try { localStorage.setItem('fav_teams', JSON.stringify(favs)); }
  catch { return null; }
  return favs;
}

export function getFavoritePlayers(): number[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('fav_players') || '[]'); }
  catch { return []; }
}

export function toggleFavoritePlayer(id: number): number[] | null {
  const favs = getFavoritePlayers();
  const idx = favs.indexOf(id);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(id);
  try { localStorage.setItem('fav_players', JSON.stringify(favs)); }
  catch { return null; }
  return favs;
}
