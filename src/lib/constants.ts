// CURRENT_SEASON is derived from the clock (UTC): Oct 1 rolls to the new season;
// Jul-Sep still return the just-finished season, because offseason queries against
// leagueleaders/playergamelog must target the completed season.
// SEASON_START / SEASON_END / PLAYOFFS_END are display-only fallbacks (SeasonProgress
// phase bar) — still updated by hand once per season.
export function currentSeason(date: Date = new Date()): string {
  const startYear = date.getUTCMonth() >= 9 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  const endYY = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endYY}`;
}
export const CURRENT_SEASON = currentSeason();
export const SEASON_START = "2025-10-21";
export const SEASON_END = "2026-04-12";
export const PLAYOFFS_END = "2026-06-21";
// Estimated 2026-27 tip-off — the CDN has not published the 2026-27 schedule
// yet. Drives the offseason home-hero countdown and doubles as its upper
// guard bound (the hero auto-hides once now passes this date). Update to the
// real opening date once the schedule publishes; UI labels it "预计/est." until then.
export const NEXT_SEASON_START_ESTIMATE = "2026-10-20";
