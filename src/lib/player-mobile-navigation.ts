/** Public URL contract for the phone profile; desktop keeps its section layout. */
export const PLAYER_PANELS = ["data", "shooting", "honors", "career", "games", "news", "details"] as const;
export type PlayerPanel = typeof PLAYER_PANELS[number];
export function playerPanelFromLocation(search: string, hash = "", available: readonly PlayerPanel[] = PLAYER_PANELS): PlayerPanel {
  const legacy: Record<string, PlayerPanel> = { "#overview": "data", "#shooting": "shooting", "#career": "career", "#honors": "honors" };
  const requested = legacy[hash] ?? new URLSearchParams(search).get("panel");
  return available.find(panel => panel === requested) ?? "data";
}
export function playerPanelHref(href: string, panel: PlayerPanel): string {
  const url = new URL(href, "https://nba.xpy.me");
  url.searchParams.set("panel", panel);
  url.hash = "";
  return `${url.pathname}${url.search}`;
}
export function playerSeasonHref(href: string, season: string, seasonType: string): string {
  const url = new URL(href, "https://nba.xpy.me");
  url.searchParams.set("season", season);
  url.searchParams.set("seasonType", seasonType);
  return `${url.pathname}${url.search}${url.hash}`;
}
