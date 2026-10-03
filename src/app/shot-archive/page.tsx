import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Database, Search, Target } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { getLocale } from "@/lib/locale";
import { searchHistoricalShotPlayers } from "@/lib/historical-shot-archive";
import styles from "./shot-archive.module.css";

export const metadata: Metadata = {
  title: "Historical Shot Archive",
  description: "Find archived player-season shooting heatmaps for available NBA shot records, with season starts from 2005 through 2025.",
};

interface ArchivePageProps {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}

function archiveHref(query: string, page = 1): string {
  const search = new URLSearchParams();
  if (query) search.set("q", query);
  if (page > 1) search.set("page", String(page));
  return `/shot-archive${search.size ? `?${search}` : ""}`;
}

export default async function ShotArchivePage({ searchParams }: ArchivePageProps) {
  const [params, locale] = await Promise.all([searchParams, getLocale()]);
  const isZh = locale === "zh";
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const requestedPage = typeof params.page === "string" && /^[1-9]\d{0,5}$/.test(params.page) ? Number(params.page) : 1;
  const result = await searchHistoricalShotPlayers(query, requestedPage);
  const number = (value: number) => value.toLocaleString(isZh ? "zh-CN" : "en-US");
  const pageCount = result.status === "ready" ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return <div className={styles.page} lang={isZh ? "zh-CN" : "en"}>
    <PageHeader
      eyebrow={isZh ? "历史数据 · 球员目录" : "Historical data · Player directory"}
      icon={Target}
      title={isZh ? "历史投篮档案" : "Historical shot archive"}
      subtitle={isZh ? "从球员开始，探索档案中可用的逐赛季投篮热区。" : "Start with a player. Explore their available season-by-season shooting zones."}
    />

    <section className={styles.intro} aria-label={isZh ? "档案覆盖范围" : "Archive coverage"}>
      <div className={styles.introCopy}>
        <span className={styles.eyebrow}><Database size={13} aria-hidden="true" /> {isZh ? "有记录，才展示" : "Built from recorded shots"}</span>
        <h2>{isZh ? "2005–2025 赛季起始年" : "2005–2025 season starts"}</h2>
        <p>{isZh ? "仅收录该历史数据源中有投篮记录的球员与赛季。缺失的球员或赛季表示数据不可用，并不表示零次出手。" : "Includes only players and seasons with shot records in this historical source. A missing player or season means unavailable data, never zero attempts."}</p>
      </div>
      {result.status === "ready" && <dl className={styles.stats}>
        <div><dt>{query ? (isZh ? "匹配球员" : "Matching players") : (isZh ? "档案球员" : "Archived players")}</dt><dd>{number(result.total)}</dd></div>
        <div><dt>{isZh ? "来源赛季" : "Source seasons"}</dt><dd>{number(result.seasonCount)}</dd></div>
        <div><dt>{isZh ? "来源档案" : "Source archives"}</dt><dd>{number(result.archiveCount)}</dd></div>
      </dl>}
    </section>

    <form action="/shot-archive" method="get" className={styles.search} role="search" aria-label={isZh ? "搜索历史球员" : "Search historical players"}>
      <label htmlFor="shot-archive-search">{isZh ? "球员姓名或 NBA 球员 ID" : "Player name or NBA player ID"}</label>
      <div className={styles.searchControls}>
        <div className={styles.inputWrap}>
          <Search size={18} aria-hidden="true" />
          <input id="shot-archive-search" name="q" type="search" defaultValue={query} maxLength={100} placeholder={isZh ? "例如：Kobe Bryant" : "e.g. Kobe Bryant"} />
        </div>
        <button type="submit">{isZh ? "搜索" : "Search"}<ArrowRight size={16} aria-hidden="true" /></button>
      </div>
    </form>

    {result.status === "error" ? <section className={styles.state} role="alert">
      <Database size={24} aria-hidden="true" />
      <h2>{isZh ? "暂时无法加载档案目录" : "The archive directory could not load"}</h2>
      <p>{isZh ? "这是加载错误，不代表没有球员或投篮记录。请重试。" : "This is a loading error, not an absence of players or shot records. Please try again."}</p>
      <Link href={archiveHref(query, requestedPage)} prefetch={false}>{isZh ? "重新加载目录" : "Reload directory"}</Link>
    </section> : <section aria-labelledby="shot-archive-results">
      <div className={styles.resultsHeading}>
        <h2 id="shot-archive-results">{query ? (isZh ? `“${query}”的结果` : `Results for “${query}”`) : (isZh ? "浏览球员" : "Browse players")}</h2>
        <span>{number(result.total)} {isZh ? "位球员" : "players"}</span>
      </div>

      {result.players.length ? <ul className={styles.players}>
        {result.players.map(player => <li key={player.playerId}>
          <Link href={`/shot-archive/${player.playerId}`} prefetch={false} className={styles.playerCard}>
            <div className={styles.cardTop}><span className={styles.playerId}>NBA ID {player.playerId}</span><ArrowRight size={17} aria-hidden="true" /></div>
            <h3>{player.name}</h3>
            <p className={styles.seasonRange}>{player.firstSeason.replace("-", "–")}<span aria-hidden="true"> → </span><span className={styles.srOnly}>{isZh ? "至" : " to "}</span>{player.lastSeason.replace("-", "–")}</p>
            <div className={styles.cardBottom}><span>{isZh ? "档案覆盖范围" : "Archived coverage"}</span><span>{number(player.datasetCount)} {isZh ? "个数据集" : "datasets"}</span></div>
          </Link>
        </li>)}
      </ul> : <div className={styles.state} role="status">
        <Search size={24} aria-hidden="true" />
        <h3>{isZh ? "未找到匹配的档案球员" : "No matching archived players"}</h3>
        <p>{isZh ? "请尝试其他姓名拼写或 NBA 球员 ID。此目录仅包含数据源中有投篮记录的球员。" : "Try another spelling or an NBA player ID. This directory only includes players with shot records in the source."}</p>
        <Link href="/shot-archive" prefetch={false}>{isZh ? "查看全部档案球员" : "Browse all archived players"}</Link>
      </div>}

      {pageCount > 1 && <nav className={styles.pagination} aria-label={isZh ? "档案目录分页" : "Archive directory pagination"}>
        {result.page > 1 ? <Link href={archiveHref(query, result.page - 1)} prefetch={false} rel="prev"><ChevronLeft size={17} aria-hidden="true" />{isZh ? "上一页" : "Previous"}</Link> : <span aria-disabled="true"><ChevronLeft size={17} aria-hidden="true" />{isZh ? "上一页" : "Previous"}</span>}
        <p>{isZh ? `第 ${number(result.page)} / ${number(pageCount)} 页` : `${number(result.page)} / ${number(pageCount)}`}</p>
        {result.page < pageCount ? <Link href={archiveHref(query, result.page + 1)} prefetch={false} rel="next">{isZh ? "下一页" : "Next"}<ChevronRight size={17} aria-hidden="true" /></Link> : <span aria-disabled="true">{isZh ? "下一页" : "Next"}<ChevronRight size={17} aria-hidden="true" /></span>}
      </nav>}
    </section>}

    <aside className={styles.coverageNote} aria-label={isZh ? "使用说明" : "Reading this archive"}>
      <p><strong>{isZh ? "按来源解读数据。" : "Read the numbers in their source context."}</strong> {isZh ? "历史记录汇总可能不完整，不能自动视为完整赛季总数。基准仅适用于对应来源、赛季及赛事类型，不能直接当作跨来源的统一联盟均值。" : "Historical shot aggregates may be incomplete and do not automatically represent full-season totals. Benchmarks apply only to the corresponding source, season, and season type; they are not a universal league average across sources."}</p>
    </aside>
  </div>;
}
