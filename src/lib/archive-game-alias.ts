/** Independently verified identity, not a general synthetic-ID conversion.
 * Official April 24 LAL–HOU final: scripts/archive-data/schedule-identity-corrections.json.
 */
export function resolveArchiveGameId(id: string): string {
  return id === "9401869400" ? "0042500173" : id;
}
