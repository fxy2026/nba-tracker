import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Crown, Trophy, GitCompareArrows, Calendar } from "lucide-react";
import { ICONIC_GAMES, type GameTag } from "@/lib/iconicGames";
import { GAME_DECADES } from "@/lib/decades";
import GamesFilter from "./GamesFilter";
import GameCard from "./GameCard";
import { getLocale } from "@/lib/locale";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";

export const metadata: Metadata = {
  title: "Iconic NBA Games — Single-Night Performances",
  description: "Wilt's 100, Kobe's 81, MJ's Flu Game, The Block, Tatum 51 in a Game 7. The single-night moments that defined careers.",
  alternates: { canonical: "/iconic-games" },
  openGraph: {
    title: "Iconic NBA Games",
    description: `${ICONIC_GAMES.length} single-night performances that defined careers — Wilt 100, Kobe 81, MJ flu game, The Block, Tatum 51 in a Game 7, and more.`,
  },
};

export default async function IconicGamesPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";

  // Chronological — narrative arc from Wilt 1962 to modern night.
  const sorted = [...ICONIC_GAMES].sort((a, b) => a.date.localeCompare(b.date));

  // Unique set of tags that actually appear in the dataset — passed to the
  // client filter so we don't render chips for tag types nobody uses.
  const allTags = Array.from(
    new Set(sorted.flatMap((g) => g.tags ?? [])),
  ) as GameTag[];

  // Decade labels — "1960s", "2010s", etc. Derived from the dataset so chips
  // only show decades that have at least one entry.
  const allDecades = GAME_DECADES;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Iconic NBA Games",
    numberOfItems: sorted.length,
    itemListElement: sorted.slice(0, 25).map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: g.title,
      description: g.story,
    })),
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <Breadcrumbs items={[{ label: isZh ? "经典之夜" : "Iconic Games" }]} />

      <PageHeader
        eyebrow={isZh ? "数据库" : "Showcase"}
        icon={Flame}
        title={isZh ? "经典之夜" : "Iconic NBA Games"}
        subtitle={
          isZh
            ? `${sorted.length} 个改变生涯的夜晚 · 含完整数据线、故事、对手与结果`
            : `${sorted.length} single-night performances that defined careers — full lines, narratives, and context`
        }
      />

      {/* Client filter — pure CSS-driven so the SSR list stays intact */}
      <div className="mt-6">
        <GamesFilter availableTags={allTags} availableDecades={allDecades} />
      </div>

      {/* Decade landing-page nav — separate from the in-page filter so it
          drives crawlable internal links to /iconic-games/[decade]. */}
      <div className="mb-4 flex items-center flex-wrap gap-1.5">
        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60 mr-1">
          {isZh ? "深入年代" : "Decade pages"}
        </span>
        {allDecades.map((d) => (
          <Link
            key={d}
            href={`/iconic-games/${d}`}
            className="text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 rounded border border-border bg-bg-secondary/40 text-text-secondary hover:border-accent/40 hover:text-text-primary cursor-pointer"
          >
            {d} →
          </Link>
        ))}
      </div>

      {/* Game list — chronological, card-per-game */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sorted.map((g) => (
          <GameCard key={g.id} game={g} isZh={isZh} />
        ))}
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/iconic-seasons", label: isZh ? "经典赛季" : "Iconic Seasons", icon: Crown },
          { href: "/compare", label: isZh ? "球员对比" : "Player Compare", icon: GitCompareArrows },
          { href: "/records", label: isZh ? "赛季纪录" : "Season Records", icon: Trophy },
          { href: "/this-day", label: isZh ? "历史上的今天" : "This Day", icon: Calendar },
        ]}
      />
    </div>
  );
}

