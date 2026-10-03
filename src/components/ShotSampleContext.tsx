import { getAbsoluteZoneColor } from "@/lib/shot-zones";

/** The request URL is the same one used by the fetcher, so this description
 * follows the API's actual schedule-versus-player-log routing. Neither route
 * verifies a complete player season, even when loaded equals the denominator. */
export function ShotSampleCoverage({ requestUrl, games, isZh }: {
  requestUrl: string;
  games?: { loaded: number; total: number };
  isZh: boolean;
}) {
  const params = new URLSearchParams(requestUrl.split("?")[1] ?? "");
  const usesTeamSchedule = !params.has("season");
  const partial = games !== undefined && games.loaded < games.total;
  return (
    <div className="mb-3 rounded-lg border border-border bg-bg-secondary/60 px-3 py-2.5 text-xs text-text-secondary" data-shot-coverage={partial ? "partial-sample" : "available-sample"}>
      <p className="font-semibold text-text-primary">
        {partial
          ? (isZh ? "部分比赛样本" : "Partial game sample")
          : (isZh ? "可用比赛样本" : "Available-game sample")}
        {games && <span className="ml-2 font-normal tabular-nums">{isZh ? `已载入 ${games.loaded} / ${games.total} 场比赛数据` : `${games.loaded} / ${games.total} game feeds loaded`}</span>}
      </p>
      <p className="mt-1 leading-relaxed">
        {isZh ? "最多使用最近 30 场比赛。" : "Uses at most the 30 most recent games. "}
        {usesTeamSchedule
          ? (isZh
            ? `分母为 ${params.get("team") ?? ""} 当前球队赛程中的已结束比赛数，不是球员的完整赛季出场数。`
            : `The denominator counts completed games on the current ${params.get("team") ?? "team"} schedule, not the player's full-season appearances. `)
          : (isZh
            ? "分母为所选球员比赛日志返回的比赛数。"
            : "The denominator counts games returned by the selected player game log. ")}
        {isZh ? "完整赛季投篮覆盖尚未核实。" : "Full-season shot coverage is not verified."}
      </p>
    </div>
  );
}

export function AbsoluteShotLegend({ isZh }: { isZh: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mb-2 text-[10px] text-text-secondary" aria-label={isZh ? "样本区域命中率色标" : "Sample zone FG percentage scale"}>
      <span>{isZh ? "样本区域命中率" : "Sample zone FG%"}</span>
      {[0, 50, 100].map(pct => (
        <span key={pct} className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm" style={{ background: getAbsoluteZoneColor(pct) }} />{pct}%
        </span>
      ))}
    </div>
  );
}
