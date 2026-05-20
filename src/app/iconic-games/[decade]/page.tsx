import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crown, Flame, GitCompareArrows, ArrowLeft, Calendar } from "lucide-react";
import { ICONIC_GAMES, type IconicGame } from "@/lib/iconicGames";
import GameCard from "../GameCard";
import { getLocale } from "@/lib/locale";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";

export const revalidate = 86400;

const DECADE_SLUGS = ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"] as const;
type DecadeSlug = typeof DECADE_SLUGS[number];

function startYearOfSlug(slug: DecadeSlug): number {
  return parseInt(slug.slice(0, 4), 10);
}

function gamesForDecade(slug: DecadeSlug): IconicGame[] {
  const start = startYearOfSlug(slug);
  return ICONIC_GAMES
    .filter((g) => {
      const y = parseInt(g.date.slice(0, 4), 10);
      return y >= start && y < start + 10;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

const DECADE_BLURB: Record<DecadeSlug, { en: string; zh: string }> = {
  "1960s": {
    en: "The era of Wilt's 100-point game — single performances so outsized they redefined what was possible.",
    zh: "张伯伦 100 分之夜的时代——单场表演大到让人重新定义什么叫极限。",
  },
  "1970s": {
    en: "Walton, Doctor J, the merger years — gritty, low-pace, defense-first nights of basketball.",
    zh: "比尔·沃顿、J 博士、合并年代——慢节奏、防守至上的硬派篮球。",
  },
  "1980s": {
    en: "Magic's Junior Sky Hook, Bird's steal, MJ's 63 in the Garden — playoff theater at its peak.",
    zh: "魔术师的小天勾、大鸟的关键抢断、乔丹花园 63 分——季后赛舞台剧的巅峰。",
  },
  "1990s": {
    en: "Flu Game. Last Shot. Reggie's 8 in 9. The post-up era's most quotable nights.",
    zh: "流感之战、最后一投、雷吉 8 秒 8 分——背身时代最值得引用的夜晚。",
  },
  "2000s": {
    en: "Kobe 81, T-Mac 13-in-33, LeBron 25-of-29 — the iso era's signature explosions.",
    zh: "科比 81、麦迪 33 秒 13 分、詹姆斯东决 G5——单打时代的标志性爆发。",
  },
  "2010s": {
    en: "Klay 60 in 29 minutes, Curry passing Ray Allen, Kawhi's bouncing-rim G7 buzzer — small-ball's most outrageous nights.",
    zh: "克莱 29 分钟砍下 60 分、库里超越雷·阿伦、伦纳德四下入筐的 G7 绝杀——小球时代最离谱的夜晚。",
  },
  "2020s": {
    en: "Mitchell 71, Embiid 70, Booker 70, LeBron passing Kareem, Tatum 51 in Game 7 — the modern explosion era.",
    zh: "米切尔 71、恩比德 70、布克 70、詹姆斯超越贾巴尔、塔图姆 G7 51 分——现代爆发时代。",
  },
};

const DECADE_TITLE: Record<DecadeSlug, { en: string; zh: string }> = {
  "1960s": { en: "1960s — Pioneer Nights", zh: "1960 年代 · 拓荒之夜" },
  "1970s": { en: "1970s — Gritty & Grand", zh: "1970 年代 · 老派硬派" },
  "1980s": { en: "1980s — Playoff Theater", zh: "1980 年代 · 季后赛戏剧" },
  "1990s": { en: "1990s — Era of Iconic Quotes", zh: "1990 年代 · 神迹时代" },
  "2000s": { en: "2000s — ISO Explosions", zh: "2000 年代 · 单打爆发" },
  "2010s": { en: "2010s — Small-Ball Spectacle", zh: "2010 年代 · 小球奇观" },
  "2020s": { en: "2020s — Modern Outbursts", zh: "2020 年代 · 现代爆发" },
};

interface PageProps {
  params: Promise<{ decade: string }>;
}

export async function generateStaticParams() {
  return DECADE_SLUGS
    .filter((slug) => gamesForDecade(slug).length > 0)
    .map((decade) => ({ decade }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { decade } = await params;
  if (!DECADE_SLUGS.includes(decade as DecadeSlug)) return {};
  const slug = decade as DecadeSlug;
  const games = gamesForDecade(slug);
  if (games.length === 0) return {};
  const meta = DECADE_TITLE[slug];
  const names = games.slice(0, 4).map((g) => g.name).join(", ");
  return {
    title: `${meta.en} — Iconic NBA Games`,
    description: `${games.length} single-night performances from the ${slug}: ${names}, and more.`,
    alternates: { canonical: `/iconic-games/${slug}` },
    openGraph: {
      title: meta.en,
      description: `${games.length} hand-curated iconic NBA games from the ${slug}.`,
    },
  };
}

export default async function DecadeIconicGamesPage({ params }: PageProps) {
  const { decade } = await params;
  if (!DECADE_SLUGS.includes(decade as DecadeSlug)) notFound();
  const slug = decade as DecadeSlug;
  const games = gamesForDecade(slug);
  if (games.length === 0) notFound();

  const locale = await getLocale();
  const isZh = locale === "zh";
  const title = isZh ? DECADE_TITLE[slug].zh : DECADE_TITLE[slug].en;
  const blurb = isZh ? DECADE_BLURB[slug].zh : DECADE_BLURB[slug].en;

  const availableDecades = DECADE_SLUGS.filter((s) => gamesForDecade(s).length > 0);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Iconic NBA Games — ${slug}`,
    numberOfItems: games.length,
    itemListElement: games.map((g, i) => ({
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
      <Breadcrumbs
        items={[
          { label: isZh ? "经典之夜" : "Iconic Games", href: "/iconic-games" },
          { label: slug },
        ]}
      />

      <PageHeader
        eyebrow={isZh ? "年代" : "Decade"}
        icon={Flame}
        title={title}
        subtitle={
          isZh
            ? `${games.length} 个 ${slug.slice(0, 4)} 年代的经典夜晚`
            : `${games.length} single-night performances from the ${slug}`
        }
      />

      <div className="mt-4 glass-tile p-4">
        <p className="text-sm text-text-secondary leading-relaxed">{blurb}</p>
      </div>

      <div className="mt-6 flex items-center flex-wrap gap-1.5">
        <Link
          href="/iconic-games"
          className="text-[10px] font-mono uppercase tracking-[0.15em] inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-bg-secondary/40 text-text-secondary hover:border-accent/40 hover:text-text-primary cursor-pointer"
        >
          <ArrowLeft size={11} />
          {isZh ? "全部年代" : "All decades"}
        </Link>
        {availableDecades.map((d) => (
          <Link
            key={d}
            href={`/iconic-games/${d}`}
            className={`text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 rounded border cursor-pointer ${
              d === slug
                ? "bg-accent/20 text-accent border-accent/50"
                : "bg-bg-secondary/40 text-text-secondary border-border hover:border-accent/40"
            }`}
          >
            {d}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        {games.map((g) => (
          <GameCard key={g.id} game={g} isZh={isZh} />
        ))}
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/iconic-games", label: isZh ? "全部经典之夜" : "All iconic games", icon: Flame },
          { href: "/iconic-seasons", label: isZh ? "经典赛季" : "Iconic seasons", icon: Crown },
          { href: `/iconic-seasons/${slug}`, label: isZh ? `${slug} 经典赛季` : `${slug} iconic seasons`, icon: Calendar },
          { href: "/compare", label: isZh ? "球员对比" : "Player compare", icon: GitCompareArrows },
        ]}
      />
    </div>
  );
}
