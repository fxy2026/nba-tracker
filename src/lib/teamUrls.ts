// CDN URL builders for NBA team logos and player headshots.
export function teamLogoUrl(teamId: number | string, size: "L" | "M" | "S" = "L"): string {
  return `https://cdn.nba.com/logos/nba/${teamId}/global/${size}/logo.svg`;
}

export function playerHeadshotUrl(personId: number | string, dimensions: "1040x760" | "260x190" = "1040x760"): string {
  return `https://cdn.nba.com/headshots/nba/latest/${dimensions}/${personId}.png`;
}
