/** Retrieval metadata does not assert when NBA last updated a roster or statistic. */
export interface PlayerIndexProvenance {
  source: "nba-cdn" | "bundled-archive";
  season: string | null;
  stale: boolean;
  retrievedAt: string | null;
}

export function playerIndexLabel(meta: PlayerIndexProvenance, locale: string): string {
  const zh = locale === "zh";
  const season = meta.season ?? (zh ? "赛季未注明" : "season unspecified");
  const source = meta.source === "bundled-archive"
    ? (zh ? "存档快照" : "archived snapshot")
    : meta.stale ? (zh ? "NBA 缓存快照（刷新暂不可用）" : "NBA cached snapshot (refresh unavailable)")
    : (zh ? "NBA 球员索引" : "NBA player index");
  return `${season} · ${source}`;
}

export function playerIndexStat(value: unknown, decimals = 1): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(decimals) : "—";
}
