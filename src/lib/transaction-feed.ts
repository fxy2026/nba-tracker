// Home and the default timeline must address the same upstream cache entry.
// Keep the full default feed here; the home hero takes its first five rows.
export const DEFAULT_TRANSACTION_LIMIT = 150;

export function transactionFeedUrl(limit = DEFAULT_TRANSACTION_LIMIT): string {
  return `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/transactions?limit=${limit}`;
}
