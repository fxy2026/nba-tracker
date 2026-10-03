/** Serializable, deliberately limited archive projection. No current-roster claims. */
export interface ScatterArchiveRow {
  PLAYER_ID: number;
  PLAYER: string;
  TEAM: string;
  PTS: number;
  REB: number;
  AST: number;
}
export interface ScatterArchive {
  season: string | null;
  total: number;
  omitted: number;
  rows: ScatterArchiveRow[];
}
