import Link from "next/link";
import { ArrowUpRight, Database, Target, UserRound } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import RecentVisitTracker from "@/components/RecentVisitTracker";
import FavoriteButton from "@/components/FavoriteButton";
import ShareButton from "@/components/ShareButton";
import PlayerSeasonHeatmap from "./PlayerSeasonHeatmap";
import type { PlayerIdentity } from "@/lib/player-identity";
import type { HeatmapIdentity, SeasonHeatmapArchiveResource, SeasonHeatmapCatalogEntry } from "@/lib/season-heatmap";
import { OFFICIAL_PLAYER_REGISTRY_SOURCE } from "@/lib/official-player-registry";
import { ALL_TIME_LEADERS } from "@/lib/allTimeLeaders";
import { ICONIC_SEASONS } from "@/lib/iconicSeasons";

interface Props {
  player: PlayerIdentity;
  locale: "en" | "zh";
  catalog: readonly SeasonHeatmapCatalogEntry[];
  initialSelection: HeatmapIdentity | null;
  initialResource: SeasonHeatmapArchiveResource | null;
}
/** Historical identities get real profiles without invented current-roster facts. */
export default function ArchivedPlayerProfile({ player, locale, catalog, initialSelection, initialResource }: Props) {
  const isZh = locale === "zh";
  const legend = ALL_TIME_LEADERS.find(row => row.personId === player.id && !row.active);
  const iconicSeasons = ICONIC_SEASONS.filter(row => row.personId === player.id);
  const title = isZh ? "球员主页" : "Player profile";
  const sourceLabel = player.sources.includes("all-time-registry") ? (isZh ? "NBA 官方历代球员名录" : "NBA official all-time player registry")
    : player.sources.includes("historical-shots") ? (isZh ? "历史投篮来源中的球员身份" : "Player identity recorded in the historical shot source")
    : (isZh ? "本站历史球员名录" : "Curated historical player directory");
  const structuredData = { "@context": "https://schema.org", "@type": "Person", name: player.name, identifier: String(player.id), url: `https://nba.xpy.me/player/${player.id}` };
  return <div className="max-w-6xl mx-auto px-4 py-6" lang={isZh ? "zh-CN" : "en"}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <RecentVisitTracker kind="player" id={String(player.id)} label={player.name} />
    <Breadcrumbs items={[{ label: isZh ? "球员" : "Players", href: "/search" }, { label: player.name }]} />
    <header id="overview" className="glass-tile mt-5 p-5 sm:p-7 scroll-mt-24">
      <div className="flex items-start gap-4 sm:gap-6">
        <div className="hidden sm:block"><PlayerHeadshot personId={player.id} name={player.name} size={96} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent">{title} · NBA ID {player.id}</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-text-primary break-words">{player.name}</h1>
          <p className="mt-3 text-xs text-text-secondary">{sourceLabel}{player.sources.includes("all-time-registry") && <> · {OFFICIAL_PLAYER_REGISTRY_SOURCE.retrievedDate}</>}</p>
          {player.sourceYears && <p className="mt-2 text-xs text-text-secondary">{isZh ? "NBA 名录赛季起始年" : "NBA indexed season-start years"}: {player.sourceYears.from} → {player.sourceYears.to}</p>}
        </div>
        <div className="flex flex-col sm:flex-row gap-1">
          <FavoriteButton type="player" id={player.id} />
          <ShareButton text={`${player.name} · ${title} · https://nba.xpy.me/player/${player.id}`} />
        </div>
      </div>
      <nav aria-label={isZh ? "球员页导航" : "Player page navigation"} className="mt-5 flex flex-wrap gap-2">
        <a href="#overview" className="chip min-h-11 inline-flex items-center gap-1.5"><UserRound size={14} />{isZh ? "概览" : "Overview"}</a>
        <a href="#shooting" className="chip min-h-11 inline-flex items-center gap-1.5"><Target size={14} />{isZh ? "投篮分布" : "Shooting"}</a>
        <a href="#career" className="chip min-h-11 inline-flex items-center gap-1.5"><Database size={14} />{isZh ? "生涯数据" : "Career"}</a>
      </nav>
    </header>

    <aside className="mt-4 text-xs text-text-secondary leading-relaxed">
      <p>{isZh ? "此来源未收录个人资料与当前球队 / 状态；不会据此推断现役或退役。" : "Biographical details and current team / status are not recorded in this source; active or retired status is not inferred."}</p>
      {player.sources.includes("all-time-registry") && <p className="mt-2">{isZh ? "身份来自官方名录的固定快照；列出的是赛季起始年份，不是日历生涯起止日期。" : "Identity comes from a fixed official-registry snapshot; the years are season-start years, not calendar career dates."} <a href={OFFICIAL_PLAYER_REGISTRY_SOURCE.url} className="text-accent" target="_blank" rel="noopener noreferrer">{isZh ? "查看来源" : "View source"}</a></p>}
      <a className="inline-flex items-center gap-1 text-accent min-h-11" href={`https://www.nba.com/stats/player/${player.id}`} target="_blank" rel="noopener noreferrer">{isZh ? "NBA 官方球员页面" : "NBA official player page"}<ArrowUpRight size={13} /></a>
    </aside>

    {player.shotArchiveStatus === "error" && <p className="mt-3 text-sm text-text-secondary" role="alert">{isZh ? "投篮档案暂时加载失败；球员身份仍然可用。这不代表没有投篮记录。请重新加载页面重试。" : "The shot archive could not load; the player identity is still available. This is not an absence of shot records. Reload the page to retry."}</p>}
    {!initialSelection && !legend ? <section id="shooting" className="mt-5 scroll-mt-24 glass-tile p-5" role="status">
      <div id="career" className="scroll-mt-24">
        <h2 className="text-base font-semibold text-text-primary">{isZh ? "已收录球员身份" : "Player identity recorded"}</h2>
        <p className="mt-2 text-sm text-text-secondary">{player.shotArchiveStatus === "error" ? (isZh ? "生涯统计暂未收录；投篮档案加载失败。" : "Career statistics are not recorded; shooting-archive loading failed.") : (isZh ? "生涯统计与投篮记录暂未收录。缺失记录不表示零出场或零次出手。" : "Career statistics and shooting records are not yet available. Missing records do not imply zero games or zero attempts.")}</p>
      </div>
    </section> : <>

    <section id="shooting" aria-labelledby="player-shooting-heading" className="mt-8 scroll-mt-24">
      <h2 id="player-shooting-heading" className="mb-3 text-xl font-semibold text-text-primary">{isZh ? "投篮分布" : "Shooting"}</h2>
      {player.shotCoverage && <p className="mb-4 text-xs text-text-secondary">{isZh ? "投篮来源覆盖" : "Shot-source coverage"}: {player.shotCoverage.firstSeason} → {player.shotCoverage.lastSeason} · {player.shotCoverage.datasetCount} {isZh ? "个赛季 / 赛事数据集。这是档案范围，不是生涯起止年份；中间赛季可能缺失。" : "season / competition datasets. This is archive coverage, not career dates; intervening seasons can be absent."}</p>}
      {initialSelection && initialResource ? <PlayerSeasonHeatmap player={{ id: player.id, name: player.name }} locale={locale} datasets={catalog} initialSelection={initialSelection} initialResource={initialResource} />
        : <div className="glass-tile p-6" role="status"><p className="font-medium text-text-primary">{isZh ? "暂无可用投篮数据" : "Shooting data is not available"}</p><p className="mt-2 text-sm text-text-secondary">{isZh ? "身份已收录，但此球员没有可加载的投篮赛季。缺失记录并不代表零次出手。" : "The identity is recorded, but no shooting season is available for this player. Missing records do not mean zero attempts."}</p></div>}
    </section>

    <section id="career" aria-labelledby="player-career-heading" className="mt-8 scroll-mt-24 glass-tile p-5">
      <h2 id="player-career-heading" className="text-xl font-semibold text-text-primary">{isZh ? "生涯数据" : "Career statistics"}</h2>
      {legend && <>
        <p className="mt-2 text-xs text-text-secondary">{isZh ? "本站已收录的历史生涯摘要；与逐赛季投篮来源分开标注。" : "Existing curated career summary, separate from the season-by-season shot source."}</p>
        <dl className="mt-4 grid grid-cols-3 gap-3">{[["PPG", legend.ppg], ["RPG", legend.rpg], ["APG", legend.apg]].map(([label, value]) => <div key={label} className="rounded-lg bg-bg-secondary p-3"><dt className="text-xs text-text-secondary">{label}</dt><dd className="mt-1 text-2xl font-mono text-text-primary">{Number(value).toFixed(1)}</dd></div>)}</dl>
        <Link href={`/legends/${player.id}`} className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm text-accent">{isZh ? "查看已有生涯摘要与代表时刻" : "View existing career summary and notable moments"}<ArrowUpRight size={14} /></Link>
      </>}
      <p className="mt-3 text-sm text-text-secondary">{isZh ? "完整逐赛季生涯表暂未收录。不使用投篮档案覆盖范围推算出场数、场均数据或生涯年限。" : "A complete season-by-season career table has not been recorded. Shot-archive coverage is not used to infer games played, per-game averages or career length."}</p>
      {iconicSeasons.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{iconicSeasons.map(season => <Link key={season.id} href={`/compare?p1=${encodeURIComponent(season.id)}`} className="chip min-h-11 inline-flex items-center">{season.seasonYear} · {isZh ? "代表赛季" : "Featured season"}</Link>)}</div>}
    </section>
    </>}
  </div>;
}
