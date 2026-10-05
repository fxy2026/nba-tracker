import Link from "next/link";
import { ArrowUpRight, ChevronDown, GitCompareArrows } from "lucide-react";
import type { StatContext } from "@/lib/player-profile-stats";
import styles from "./player-mobile.module.css";

export interface MobileProfileMetric {
  label: string;
  abbreviation: string;
  value: number | null;
  context: StatContext | null;
}

/** Static snapshot presentation: no second data request or animated counter. */
export default function PlayerMobileSummary({ playerId, locale, source, metrics }: {
  playerId: number; locale: "en" | "zh"; source: string; metrics: readonly MobileProfileMetric[];
}) {
  const zh = locale === "zh";
  return <section className={styles.summary} aria-label={zh ? "常规赛场均数据" : "Regular-season averages"}>
    <div className={styles.summaryHeading}><h2>{zh ? "赛季场均" : "Season averages"}</h2><span>{zh ? "常规赛" : "Regular season"}</span></div>
    <dl className={styles.primaryMetrics}>{metrics.map(metric => <div key={metric.abbreviation}>
      <dt>{metric.label}<span>{metric.abbreviation}</span></dt>
      <dd>{metric.value === null ? "—" : metric.value.toFixed(1)}</dd>
    </div>)}</dl>
    <details className={styles.summaryDisclosure}>
      <summary>{zh ? "数据来源与样本对比" : "Source & sample comparison"}<ChevronDown size={15} aria-hidden="true" /></summary>
      <div className={styles.summaryNotes}>
        <p>{source} · {zh ? "球队归属和场均数据以该快照为准" : "Team affiliation and averages reflect this snapshot"}</p>
        <dl className={styles.comparisonMetrics}>{metrics.map(metric => <div key={metric.abbreviation}>
          <dt>{metric.label}</dt>
          <dd>{metric.context ? <>
            <strong>{zh ? `${metric.context.cohortSize} 人中第 ${metric.context.rank}` : `#${metric.context.rank} of ${metric.context.cohortSize}`}</strong>
            <span>{zh ? "样本均值" : "Sample avg"} {metric.context.sampleAvg.toFixed(1)} · P{metric.context.percentile}</span>
            {metric.context.delta !== null && <span>{zh ? "与样本均值之差" : "Difference from sample avg"} {metric.context.delta >= 0 ? "+" : ""}{metric.context.delta.toFixed(0)}%</span>}
          </> : "—"}</dd>
        </div>)}</dl>
        <p>{zh
          ? "对比口径：按本球员索引已记录的场均值，各项仅纳入场均得分大于 0 且该项有记录的球员。样本均值按球员等权计算，不设出场数或上场时间门槛。名次为严格高于该值的人数加 1；P 为样本中严格低于该值的人数占比（百分比四舍五入）。同值并列。"
          : "Comparison basis: recorded per-game values in this player index, with positive PPG and a known value for each stat. Sample averages weight players equally, with no games-played or minutes minimum. Rank is 1 + the number strictly higher; P is the rounded percentage of the sample strictly below. Ties share rank and P."}</p>
      </div>
    </details>
    <Link href={`/compare?p1=${playerId}`} className={styles.compareAction}><span><GitCompareArrows size={16} />{zh ? "对比此球员" : "Compare this player"}</span><ArrowUpRight size={16} aria-hidden="true" /></Link>
  </section>;
}
