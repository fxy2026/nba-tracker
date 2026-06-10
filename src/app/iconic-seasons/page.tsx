import type { Metadata } from "next";
import Link from "next/link";
import { Crown, GitCompareArrows, Trophy, Flame, Activity, Star } from "lucide-react";
import { ICONIC_SEASONS, type PlayStyle } from "@/lib/iconicSeasons";
import { type DecadeSlug, seasonsForDecade, SEASON_DECADES } from "@/lib/decades";
import SeasonsFilter from "./SeasonsFilter";
import SeasonCard from "./SeasonCard";
import StatTile from "./StatTile";
import { getLocale } from "@/lib/locale";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";

export const metadata: Metadata = {
  title: "Iconic NBA Seasons — Peak Campaign Snapshots",
  description: "Hand-curated single-season snapshots: Jordan '96, Curry '16, LeBron's bubble run, Kobe's 81, Jokić's MVP three-peat, SGA's 2025 title — and many more. Click any card to compare.",
  alternates: { canonical: "/iconic-seasons" },
  openGraph: {
    title: "Iconic NBA Seasons",
    description: "Peak campaigns from Wilt's 50.4 PPG to SGA's 2024-25 MVP ring — each with trophy flags, career narrative, and side-by-side compare.",
  },
};

export default async function IconicSeasonsPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";

  // Sort chronologically — natural narrative when scrolling top-to-bottom.
  const sorted = [...ICONIC_SEASONS].sort((a, b) => a.seasonYear - b.seasonYear);

  // Aggregate trophy counts across the dataset — surfaced as a stat strip
  // so the page feels like a museum index, not a flat list.
  const totalMvp = ICONIC_SEASONS.filter((s) => s.mvp).length;
  const totalChamp = ICONIC_SEASONS.filter((s) => s.champion).length;
  const totalFmvp = ICONIC_SEASONS.filter((s) => s.finalsMvp).length;

  // Short display form of a decade slug ("1960s" → "60s") — keeps the
  // section labels as compact as the original era chips.
  const eraLabel = (d: DecadeSlug): string => {
    if (isZh) return `${d.slice(2, 4)} 年代`;
    return d.startsWith("19") ? d.slice(2) : d;
  };

  // Filter input axes — derived from the dataset so chips only show what's
  // actually populated.
  const availableDecades = SEASON_DECADES;
  const availableStyles = Array.from(
    new Set(sorted.flatMap((s) => s.styles ?? [])),
  ) as PlayStyle[];
  const availableTrophies: ("mvp" | "champion" | "finalsMvp" | "dpoy" | "scoringTitle")[] = [];
  if (sorted.some((s) => s.mvp)) availableTrophies.push("mvp");
  if (sorted.some((s) => s.champion)) availableTrophies.push("champion");
  if (sorted.some((s) => s.finalsMvp)) availableTrophies.push("finalsMvp");
  if (sorted.some((s) => s.dpoy)) availableTrophies.push("dpoy");
  if (sorted.some((s) => s.scoringTitle)) availableTrophies.push("scoringTitle");

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Iconic NBA Seasons",
    numberOfItems: sorted.length,
    itemListElement: sorted.slice(0, 25).map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${s.season} ${s.name}`,
      url: `https://nba.xpy.me/compare?p1=${s.id}`,
    })),
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <Breadcrumbs items={[{ label: isZh ? "历史经典赛季" : "Iconic Seasons" }]} />

      <PageHeader
        eyebrow={isZh ? "数据库" : "Showcase"}
        icon={Flame}
        title={isZh ? "经典赛季全景" : "Iconic NBA Seasons"}
        subtitle={
          isZh
            ? `${sorted.length} 个手挑的巅峰赛季 · 含中英叙事 · 点击任一卡片进入对比`
            : `${sorted.length} hand-curated peak campaigns · with narrative + trophies · click any card to launch a head-to-head`
        }
      />

      {/* Summary stat strip */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 mt-6">
        <StatTile label={isZh ? "MVP 赛季" : "MVP Seasons"} value={totalMvp} icon={Crown} />
        <StatTile label={isZh ? "夺冠赛季" : "Title Runs"} value={totalChamp} icon={Trophy} />
        <StatTile label={isZh ? "FMVP" : "Finals MVP"} value={totalFmvp} icon={Star} />
      </div>

      <div className="mt-6">
        <SeasonsFilter
          availableDecades={availableDecades}
          availableStyles={availableStyles}
          availableTrophies={availableTrophies}
        />
      </div>

      {/* Era sections */}
      <div className="mt-6 space-y-12">
        {SEASON_DECADES.map((era) => {
          const seasons = seasonsForDecade(era);
          return (
            <section key={era}>
              <div className="flex items-center gap-3 mb-4">
                <Link
                  href={`/iconic-seasons/${era}`}
                  className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent-amber hover:text-accent transition-colors cursor-pointer"
                >
                  / {eraLabel(era)} →
                </Link>
                <span className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-mono tabular-nums text-text-secondary">
                  {seasons.length} {isZh ? "个赛季" : seasons.length === 1 ? "season" : "seasons"}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {seasons.map((s) => (
                  <SeasonCard key={s.id} season={s} isZh={isZh} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/iconic-games", label: isZh ? "经典之夜" : "Iconic Games", icon: Flame },
          { href: "/compare", label: isZh ? "球员对比" : "Player Compare", icon: GitCompareArrows },
          { href: "/all-time-leaders", label: isZh ? "历史排行" : "All-Time Leaders", icon: Crown },
          { href: "/records", label: isZh ? "赛季纪录" : "Season Records", icon: Activity },
        ]}
      />
    </div>
  );
}

