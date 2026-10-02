// Explicitly verified external NBA reports. Do not infer URLs for other games
// or copy the report contents into the site's data archive.
const reports: Readonly<Record<string, string>> = {
  "0022500340": "https://statsdmz.nba.com/pdfs/20251205/20251205_DENATL.pdf",
  "0022500961": "https://statsdmz.nba.com/pdfs/20260313/20260313_MEMDET_book.pdf",
};

export function getOfficialGameReport(gameId: string): string | null {
  return Object.prototype.hasOwnProperty.call(reports, gameId) ? reports[gameId] : null;
}
