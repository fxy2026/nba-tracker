import { careerSourceUrl, type PlayerCareerProvenance } from "@/lib/player-career-provenance";

export default function PlayerCareerSource({ provenance, isZh }: { provenance?: PlayerCareerProvenance; isZh: boolean }) {
  if (!provenance) {
    return <p className="text-xs text-text-secondary">{isZh
      ? "此常规赛生涯数据未附来源及获取时间。"
      : "Source and retrieval time are unavailable for this regular-season career response."}</p>;
  }
  if (provenance.source === "nba-com") {
    const captured = provenance.capturedAt.replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
    const c = provenance.coverage;
    return <div className="text-xs text-text-secondary space-y-1">
      <p>{isZh ? "常规赛生涯数据来源：" : "Regular-season career source: "}
        <a href={careerSourceUrl(provenance)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          {isZh ? "NBA.com（已存档网页快照）" : "NBA.com (archived page snapshot)"}
        </a>
      </p>
      <p>{isZh ? "网页采集时间：" : "Page captured: "}<time dateTime={provenance.capturedAt}>{captured}</time></p>
      <p>{isZh ? `已存档范围：${c.firstSeason} 至 ${c.lastSeason}，${c.seasonCount} 个赛季（${c.rowCount} 行）。`
        : `Archived coverage: ${c.firstSeason} to ${c.lastSeason}, ${c.seasonCount} seasons (${c.rowCount} rows).`}</p>
      <p>{isZh ? "实时来源暂不可用或返回的历史不完整。显示固定日期的快照，可能缺少后续更新；采集时间不是本 API 获取时间，也不是数据源的最后更新时间。"
        : "Live sources are unavailable or returned incomplete history. This dated snapshot may miss later updates; its capture time is not API retrieval or the source's last-update time."}</p>
    </div>;
  }
  const source = provenance.source === "nba-stats" ? "NBA Stats" : isZh ? "ESPN（备用来源）" : "ESPN (fallback)";
  const timestamp = provenance.retrievedAt.replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
  return (
    <div className="text-xs text-text-secondary space-y-1">
      <p>{isZh ? "常规赛生涯数据来源：" : "Regular-season career source: "}
        <a href={careerSourceUrl(provenance)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{source}</a>
      </p>
      <p>{isZh ? "本 API 获取时间：" : "Retrieved by this API: "}<time dateTime={provenance.retrievedAt}>{timestamp}</time></p>
      <p>{isZh
        ? "获取时可能使用缓存；此时间不代表赛季或比赛日期，也不是数据源的最后更新时间。"
        : "Retrieval may use cached data. This is not a season/game date or the source's last-update time."}</p>
    </div>
  );
}
