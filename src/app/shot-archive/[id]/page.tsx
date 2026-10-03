import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Database, Target } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import PlayerSeasonHeatmap from "@/components/player/PlayerSeasonHeatmap";
import { getHistoricalShotPlayer } from "@/lib/historical-shot-archive";
import { getPlayerSeasonHeatmapCatalog, loadPlayerSeasonHeatmapArchive } from "@/lib/season-heatmap-catalog-server";
import { getLocale } from "@/lib/locale";
import styles from "../shot-archive.module.css";

export const metadata: Metadata = {
  title: "Player · Historical Shot Archive",
  description: "Explore available archived player-season shooting heatmaps and their source coverage.",
};

interface ArchivePlayerPageProps { params: Promise<{ id: string }> }

export default async function HistoricalShotPlayerPage({ params }: ArchivePlayerPageProps) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  const playerId = Number(id);
  const [player, locale] = await Promise.all([getHistoricalShotPlayer(playerId), getLocale()]);
  if (!player) notFound();
  const isZh = locale === "zh";
  const catalog = await getPlayerSeasonHeatmapCatalog(playerId);
  // Keep the client boundary player-scoped and metadata-only. Never pass the
  // directory, source artifacts, or complete aggregate archives to the browser.
  const datasets = catalog.filter(entry => entry.playerId === playerId).map(entry => ({
    playerId: entry.playerId, season: entry.season, seasonType: entry.seasonType, availability: entry.availability,
  }));
  const entry = datasets.find(dataset => dataset.availability === "available");
  const initialSelection = entry ? { playerId: entry.playerId, season: entry.season, seasonType: entry.seasonType } : null;
  const initialResource = initialSelection ? await loadPlayerSeasonHeatmapArchive(initialSelection) : null;

  return <div className={styles.page} lang={isZh ? "zh-CN" : "en"}>
    <Link href="/shot-archive" className={styles.backLink}><ArrowLeft size={15} aria-hidden="true" />{isZh ? "全部历史投篮档案" : "All historical shot archives"}</Link>
    <PageHeader eyebrow={isZh ? "球员投篮档案" : "Player shot archive"} icon={Target} title={player.name} subtitle={isZh ? "按赛季查看可用的投篮区域记录。" : "Explore available shooting-zone records by season."} />
    <div className={styles.playerSummary}>
      <span className={styles.playerId}>NBA ID {player.playerId}</span>
      <span>{isZh ? "历史来源覆盖" : "Historical source coverage"}: {player.firstSeason.replace("-", "–")} → {player.lastSeason.replace("-", "–")}</span>
      <span>{player.datasetCount.toLocaleString(isZh ? "zh-CN" : "en-US")} {isZh ? "个来源数据集" : "source datasets"}</span>
    </div>

    {initialSelection && initialResource ? <PlayerSeasonHeatmap
      player={{ id: player.playerId, name: player.name }}
      locale={locale}
      datasets={datasets}
      initialSelection={initialSelection}
      initialResource={initialResource}
    /> : <section className={styles.state} role="status">
      <Database size={24} aria-hidden="true" />
      <h2>{isZh ? "投篮热区暂不可用" : "Shooting zones are currently unavailable"}</h2>
      <p>{isZh ? "此球员出现在历史目录中，但当前没有可加载的赛季热区。这不代表零次出手。" : "This player appears in the historical directory, but no season heatmap can currently be loaded. This does not mean zero attempts."}</p>
      <Link href={`/shot-archive/${player.playerId}`} prefetch={false}>{isZh ? "重新加载档案" : "Reload archive"}</Link>
    </section>}

    <aside className={styles.coverageNote} aria-label={isZh ? "档案范围与局限" : "Archive scope and limitations"}>
      <p><strong>{isZh ? "历史档案覆盖范围" : "Historical archive coverage"}</strong><br />{isZh ? "历史来源仅覆盖 2005–2025 赛季起始年中有投篮记录的球员与赛季。这里的起止赛季是档案覆盖范围，并非球员生涯起止年份；中间赛季也可能缺失。未收录的球员、赛季或赛事类型表示不可用，并非零次出手。" : "The historical source covers shot-bearing players and seasons with season starts from 2005 through 2025. The range above describes archived coverage, not the player's career; intervening seasons may be absent. Missing players, seasons, or season types are unavailable, not zero-attempt records."}</p>
      <p>{isZh ? "历史记录汇总可能不完整；完整赛季核对状态以每个热区的标注为准。比较基准仅对应所选来源、赛季与赛事类型，不能视为跨来源通用的联盟均值。" : "Historical aggregates may be incomplete; use each heatmap’s coverage label to judge full-season reconciliation. Comparison benchmarks are specific to the selected source, season, and season type, rather than a universal league average across sources."}</p>
    </aside>
  </div>;
}
