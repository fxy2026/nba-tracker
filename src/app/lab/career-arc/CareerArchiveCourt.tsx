"use client";

import type { SeasonHeatmapDisplayRow, SeasonHeatmapRendererDTO } from "@/lib/season-heatmap";
import ShotMapCourt, { ShotMapLegend } from "@/components/shot-map/ShotMapCourt";
import { Coverage, ZoneDetail } from "@/components/shot-map/RefinedShotExplorer";
import { ArchiveContext } from "@/components/SeasonHeatmapExplorer";
import { zoneName } from "@/components/season-heatmap/season-heatmap-display";
import styles from "@/components/shot-map/shot-map.module.css";

interface Props {
  data: SeasonHeatmapRendererDTO; locale: "en" | "zh";
  selectedId: SeasonHeatmapDisplayRow["id"] | null;
  onSelect: (id: string | null) => void; onDismissDetails: () => void; detailsId: string;
}
/** Aggregate-only composition: the canonical warm court receives the validated
 * BASIC/AREA DTO directly. No coordinates, alternate selectors or spatial load. */
export default function CareerArchiveCourt({ data, locale, selectedId, onSelect, onDismissDetails, detailsId }: Props) {
  const zh = locale === "zh";
  const selected = [...data.zones, ...data.residuals].find(row => row.id === selectedId) ?? null;
  return <>
    <Coverage data={data} locale={locale} />
    <p className={styles.toolbarNote}>{zh ? "来源球场分区 · 点击分区查看详情" : "Source court zones · Tap a zone for details"}</p>
    <div className={`${styles.layout} ${styles.zoneLayout}`} data-click-details="true" onKeyDown={event => {
      if (event.key === "Escape" && selected) { event.stopPropagation(); onDismissDetails(); }
    }}>
      <div className={`${styles.visual} ${styles.zoneVisual}`}>
        <div className={styles.courtWrap}>
          <ShotMapCourt data={null} zones={data} view="zones" locale={locale} selected={selectedId}
            onSelect={id => id === null ? onDismissDetails() : onSelect(id)} detailsId={selected ? detailsId : undefined} />
        </div>
        <ShotMapLegend view="zones" locale={locale} />
        <p className={styles.microcopy}>{zh
          ? "颜色对比同赛季、同类型的同分区联盟档案参考；五档为展示分档，并非 NBA 官方阈值。灰色表示无出手或无有效参考。小样本颜色不稳定。"
          : "Colors compare the same-zone, same-season/type league archive reference. Five presentation bins, not official NBA thresholds. Gray means no attempts or no valid reference. Small-sample colors are uncertain."}</p>
      </div>
      {selected && <aside data-heatmap-details="true" id={detailsId} className={styles.detail} aria-label={zh ? "投篮详情" : "Shot details"} aria-live="polite">
        <button type="button" className={styles.closeDetail} onClick={onDismissDetails} aria-label={zh ? "关闭详情" : "Close details"} title={zh ? "关闭详情" : "Close details"}><span aria-hidden="true">×</span></button>
        <ZoneDetail row={selected} zones={data} locale={locale} />
      </aside>}
    </div>
    {data.residuals.length > 0 && <div className={styles.residual} aria-label={zh ? "未映射出手" : "Unmapped attempts"}>
      <span>{zh ? "后场与分类残差，不分配到球场" : "Backcourt/classification residuals stay off court"}</span>
      {data.residuals.map(row => <button type="button" key={row.id} data-list-zone={row.id} aria-pressed={selectedId === row.id}
        aria-controls={selected ? detailsId : undefined} onClick={() => onSelect(row.id)}>
        {zoneName(row.id, locale)} · {row.fgm}/{row.fga}
      </button>)}
    </div>}
    <details className={styles.scope}>
      <summary>{zh ? "档案来源、覆盖与读图说明" : "Archive sources, coverage & reading guide"}</summary>
      <ArchiveContext data={data} locale={locale} />
      <p>{zh ? "来源 BASIC/AREA 类别汇总；球场比例为 NBA 标准，内部方向分界仅作示意，不是逐球坐标边界。" : "Aggregated source BASIC/AREA categories. Court proportions follow NBA dimensions; internal direction dividers are illustrative, not individual shot-coordinate boundaries."}</p>
      <p>{zh ? "分区出手" : "Mapped attempts"} {data.coverage.normalZoneAttempts} + {zh ? "未映射出手" : "unmapped attempts"} {data.coverage.residualAttempts} = {data.coverage.seasonAttemptDenominator}. {zh ? "残差和官方核验缺口不会分配到球场分区。" : "Residuals and official-control gaps are never assigned to court zones."}</p>
      {data.source && <p><a href={data.source.url} target="_blank" rel="noreferrer">{zh ? "固定版本来源档案" : "Pinned source archive"}</a> · {zh ? "原始下载日期" : "Original download"}: {data.source.capturedAtUtc?.slice(0, 10) ?? data.source.observedAtWindowUtc?.[0].slice(0, 10) ?? "—"} UTC</p>}
      {data.archive && <p>{zh ? "档案整体比赛日期" : "Archive-wide game dates"}: {data.archive.sourceCoverage.from} – {data.archive.sourceCoverage.to} · {zh ? "来源元数据核验日期" : "Source metadata observed"}: {data.archive.metadataObservedAtUtc.slice(0, 10)} UTC</p>}
      {data.benchmark?.kind === "weighted-archive-counts-not-official-displayed-LA" && <p>{zh ? "联盟参考范围" : "League reference period"}: {data.benchmark.season} · {zh ? "常规赛" : "Regular Season"} · {data.benchmark.from} – {data.benchmark.to}. {data.benchmark.shotBearingGames} {zh ? "场有投篮记录的比赛" : "shot-bearing games"}; {data.benchmark.leagueFgm} / {data.benchmark.leagueFga} {zh ? "联盟命中 / 出手" : "league makes / attempts"}. {zh ? "联盟完整覆盖未独立核验，并非 NBA 页面 LA。" : "Complete league coverage is not independently verified; this is not NBA-displayed LA."}</p>}
    </details>
  </>;
}
