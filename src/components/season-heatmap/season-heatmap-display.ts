import type { Advanced14ZoneId } from "@/lib/season-heatmap-geometry";
import type { HeatmapIdentity, SeasonHeatmapDisplayRow, SeasonHeatmapRendererDTO } from "@/lib/season-heatmap";

export type HeatmapMode = "reference" | "percentage" | "volume";
export type HeatmapLocale = "en" | "zh";
export const LOW_SAMPLE_ATTEMPTS = 25;
export const REFERENCE_BAND_PP = 3;
export const HEATMAP_COLORS = { above: "#e98232", near: "#e6ca46", below: "#55adce", neutral: "#c0c7ce", lightBlue: "#97cfdf", ink: "#202326" } as const;

/** Display-only layout. Source IDs, classifications and aggregates stay unchanged. */
export const displayPositions: Record<Advanced14ZoneId, readonly [number, number]> = {
  "center-under-8": [300, 119], "left-8-16": [157, 67], "center-8-16": [300, 186], "right-8-16": [443, 67],
  "left-16-24": [81, 128], "left-center-16-24": [162, 266], "center-16-24": [300, 273], "right-center-16-24": [438, 266], "right-16-24": [519, 128],
  "left-24-plus": [18, 58], "left-center-24-plus": [87, 420], "center-24-plus": [300, 430], "right-center-24-plus": [513, 420], "right-24-plus": [582, 58],
};
export const schematicStrips = [
  { name: "left", x: 0, width: 68.3, scale: 68 / 36, translate: 0 },
  { name: "middle", x: 67.7, width: 464.6, scale: 464 / 528, translate: 68 - 36 * 464 / 528 },
  { name: "right", x: 531.7, width: 68.3, scale: 68 / 36, translate: 532 - 564 * 68 / 36 },
] as const;
export function displayX(x: number): number { return x <= 36 ? x * 68 / 36 : x >= 564 ? 532 + (x - 564) * 68 / 36 : 68 + (x - 36) * 464 / 528; }
export function datasetKey(id: HeatmapIdentity): string { return `${id.playerId}:${id.season}:${id.seasonType}`; }
export function sameIdentity(a: HeatmapIdentity, b: HeatmapIdentity): boolean { return datasetKey(a) === datasetKey(b); }
export function percent(value: number | null): string { return value === null ? "—" : `${(value * 100).toFixed(1)}%`; }
export function rate(row: SeasonHeatmapDisplayRow): string { return row.fga === 0 || row.fgPct === null ? "—" : `${row.fgPctDisplay}%`; }
export function share(row: SeasonHeatmapDisplayRow): string { return `${row.attemptShareDisplay ?? (row.attemptShare * 100).toFixed(1)}%`; }
export function referenceDifference(row: SeasonHeatmapDisplayRow, benchmark: SeasonHeatmapRendererDTO["benchmark"]): number | null {
  if (!benchmark || !row.leagueAverage || row.fga === 0 || row.fgPctDisplay === null) return null;
  // Deliberately compare the two one-decimal source displays, not a recomputed LA.
  return (Math.round(Number(row.fgPctDisplay) * 10) - Math.round(Number(row.leagueAverage.displayedPct) * 10)) / 10;
}
export function zoneColor(row: SeasonHeatmapDisplayRow, mode: HeatmapMode, benchmark: SeasonHeatmapRendererDTO["benchmark"]): string {
  if (row.fga === 0) return HEATMAP_COLORS.neutral;
  if (mode === "reference") {
    const delta = referenceDifference(row, benchmark);
    return delta === null ? HEATMAP_COLORS.neutral : delta > REFERENCE_BAND_PP ? HEATMAP_COLORS.above : delta < -REFERENCE_BAND_PP ? HEATMAP_COLORS.below : HEATMAP_COLORS.near;
  }
  const value = mode === "percentage" ? row.fgPct : row.attemptShare;
  if (value === null) return HEATMAP_COLORS.neutral;
  if (mode === "volume") return value >= 0.15 ? HEATMAP_COLORS.above : value >= 0.05 ? HEATMAP_COLORS.near : HEATMAP_COLORS.below;
  return value >= 0.6 ? HEATMAP_COLORS.above : value >= 0.45 ? HEATMAP_COLORS.near : value >= 0.3 ? HEATMAP_COLORS.lightBlue : HEATMAP_COLORS.below;
}
const names: Record<SeasonHeatmapDisplayRow["id"], readonly [string, string]> = {
  "center-under-8": ["Center · under 8 ft", "中路 · 8 英尺内"], "left-8-16": ["Left · 8–16 ft", "左侧 · 8–16 英尺"],
  "center-8-16": ["Center · 8–16 ft", "中路 · 8–16 英尺"], "right-8-16": ["Right · 8–16 ft", "右侧 · 8–16 英尺"],
  "left-16-24": ["Left · 16–24 ft", "左侧 · 16–24 英尺"], "left-center-16-24": ["Left center · 16–24 ft", "左中路 · 16–24 英尺"],
  "center-16-24": ["Center · 16–24 ft", "中路 · 16–24 英尺"], "right-center-16-24": ["Right center · 16–24 ft", "右中路 · 16–24 英尺"],
  "right-16-24": ["Right · 16–24 ft", "右侧 · 16–24 英尺"], "left-24-plus": ["Left · 24+ ft", "左侧 · 24 英尺以上"],
  "left-center-24-plus": ["Left center · 24+ ft", "左中路 · 24 英尺以上"], "center-24-plus": ["Center · 24+ ft", "中路 · 24 英尺以上"],
  "right-center-24-plus": ["Right center · 24+ ft", "右中路 · 24 英尺以上"], "right-24-plus": ["Right · 24+ ft", "右侧 · 24 英尺以上"],
  backcourt: ["Back Court", "后场"], unclassified: ["Unclassified", "未分类"],
};
export function zoneName(id: SeasonHeatmapDisplayRow["id"], locale: HeatmapLocale): string { return names[id][locale === "zh" ? 1 : 0]; }
export const copy = {
  en: {
    archive: "PLAYER SHOT ARCHIVE", preview: "PRIVATE PREVIEW", verified: "OFFICIAL AGGREGATES", source: "NBA source chart", sourceDate: "Source observed", season: "Season", type: "Season type", regular: "Regular season", playoffs: "Playoffs", title: "Season heatmap",
    reference: "NBA reference", percentage: "FG%", volume: "Shot share", mode: "Color by", above: "Above reference", near: "Within ±3 pp", below: "Below reference", neutral: "No comparison",
    hint: "Select a zone for details", read: "FG% · made / attempts", shareRead: "Share of all season attempts · made / attempts", low: "* Fewer than 25 attempts", lowDetail: "Small sample: fewer than 25 attempts. Descriptive color, not statistical significance.",
    benchmark: "Reference colors compare NBA-displayed LA for the selected source chart. The ±3 percentage-point band is this product’s rule; exact league filters and denominators are not independently verified.",
    noBaseline: "NBA reference is unavailable for one or more zones; those zones are neutral. Absolute FG% and shot share remain available.",
    schematic: "Schematic zones; corners widened for legibility. Source classifications and counts are unchanged.",
    loading: "Loading this season’s data…", unavailable: "This season and season type are not available in this archive.", error: "This dataset could not be loaded.", wrong: "The supplied dataset does not match this player and selection.", retry: "Retry", empty: "No season datasets are supplied.",
    details: "Zone details", fg: "Field-goal percentage", made: "Made / attempts", attempts: "Season shot share", la: "NBA-displayed LA", difference: "Difference from displayed LA", missing: "Unavailable", none: "No attempts", residual: "Outside the 14 mapped zones", residualNote: "Retained in season totals and shot-share denominators. No spatial placement or shot type inferred.",
    full: "Full-season aggregates reconciled", partial: "Source totals only; independent season totals unverified", point: "Aggregate data only; raw shot points are not part of this dataset.", allZones: "All zone statistics", total: "Season total", coverage: "Coverage", pp: "pp", known: "Only supplied seasons are listed.",
  },
  zh: {
    archive: "球员投篮档案", preview: "私人预览", verified: "官方汇总", source: "NBA 来源图表", sourceDate: "来源观察日期", season: "赛季", type: "赛季类型", regular: "常规赛", playoffs: "季后赛", title: "赛季投篮热图",
    reference: "NBA 参考", percentage: "命中率", volume: "出手占比", mode: "颜色依据", above: "高于参考", near: "±3 百分点内", below: "低于参考", neutral: "暂无对比",
    hint: "选择分区查看详情", read: "命中率 · 命中 / 出手", shareRead: "占全赛季出手比例 · 命中 / 出手", low: "* 少于 25 次出手", lowDetail: "小样本：少于 25 次出手。颜色仅为描述，不代表统计显著性。",
    benchmark: "颜色对照所选来源图表展示的 NBA LA。±3 个百分点为本图规则；联盟基准的精确筛选及分母尚未独立核验。",
    noBaseline: "部分或全部分区缺少 NBA 参考，使用中性色。仍可查看实际命中率和出手占比。",
    schematic: "分区示意；底角显示加宽以便阅读，来源分类与统计数据不变。",
    loading: "正在加载该赛季数据…", unavailable: "此档案暂未提供该赛季与赛季类型的数据。", error: "该数据集加载失败。", wrong: "提供的数据与所选球员、赛季或类型不一致。", retry: "重试", empty: "尚未提供赛季数据。",
    details: "分区详情", fg: "投篮命中率", made: "命中 / 出手", attempts: "全赛季出手占比", la: "NBA 页面 LA", difference: "与页面 LA 之差", missing: "暂无", none: "无出手", residual: "14 个映射分区以外", residualNote: "计入全赛季总数及出手占比分母；不推断空间位置或投篮类型。",
    full: "全赛季汇总已对账", partial: "仅与来源总数一致；尚无独立赛季总数核验", point: "仅含汇总数据；本数据集不包含逐次投篮坐标。", allZones: "全部分区统计", total: "全赛季合计", coverage: "数据覆盖", pp: "百分点", known: "仅列出已提供的赛季。",
  },
} as const;
