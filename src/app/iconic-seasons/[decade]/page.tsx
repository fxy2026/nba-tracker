import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crown, Flame, GitCompareArrows, Trophy, Activity, ArrowLeft } from "lucide-react";
import { ICONIC_SEASONS, type IconicSeason } from "@/lib/iconicSeasons";
import SeasonCard from "../SeasonCard";
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

function seasonsForDecade(slug: DecadeSlug): IconicSeason[] {
  const start = startYearOfSlug(slug);
  return ICONIC_SEASONS
    .filter((s) => s.seasonYear >= start && s.seasonYear < start + 10)
    .sort((a, b) => a.seasonYear - b.seasonYear);
}

// Editorial blurbs per decade — gives each page a distinct narrative voice
// instead of being a thin filter view.
const DECADE_BLURB: Record<DecadeSlug, { en: string; zh: string }> = {
  "1960s": {
    en: "The pioneer era. Wilt and Russell forged the league into a true two-superstar contest; Oscar Robertson averaged a triple-double before anyone knew what to call it.",
    zh: "拓荒年代。张伯伦与拉塞尔确立了 NBA 双星时代；奥斯卡·罗伯特森场均三双——彼时尚无人为这数据命名。",
  },
  "1970s": {
    en: "A decade of merger and movement. The NBA absorbed the ABA, the 3-point line was a few years away, and Doctor J brought a new kind of aerial showmanship.",
    zh: "联盟合并的十年。NBA 吞并 ABA，三分线尚未启用，J 博士带来空中表演的新美学。",
  },
  "1980s": {
    en: "Magic vs Bird. Showtime vs Beat-You-Up. The decade that saved the league commercially and elevated the rivalry to pop-culture status.",
    zh: "魔术师 vs 大鸟。Showtime 与硬汉篮球的对决。商业上拯救联盟、把对抗升级为流行文化的十年。",
  },
  "1990s": {
    en: "Jordan's coronation. Two three-peats sandwiched a baseball detour; Hakeem stole one in between; the Bad-Boys and Knicks-Heat fights set the league's harshest tone.",
    zh: "乔丹的加冕。两个三连冠中间穿插了棒球之旅；大梦虎口拔牙；坏小子与尼克斯-热火大战定义了最硬的篮球时代。",
  },
  "2000s": {
    en: "Shaq + Kobe ushered in three-peat dynastic basketball, Duncan's Spurs were the model franchise, and a new global generation (Nash, Dirk, Manu) reshaped the game.",
    zh: "OK 组合开启王朝；马刺确立模板；纳什、诺天王、马努等国际新一代重塑比赛形态。",
  },
  "2010s": {
    en: "The pace-and-space revolution. LeBron's Decision, Curry's bulky three-point thumbprint, the 73-9 Warriors, and the most parity-rich half of any decade.",
    zh: "节奏与空间革命。詹姆斯的决定、库里的三分革命、73 胜勇士、史上最具竞争平衡的半个十年。",
  },
  "2020s": {
    en: "International dominance — Jokić, Embiid, Giannis, SGA traded MVPs while domestic stars Tatum, Curry, LeBron extended their windows. The bubble and OKC's young rise bracket the decade.",
    zh: "国际球员统治。约基奇、恩比德、字母哥、SGA 轮流捧 MVP；本土巨星塔图姆、库里、詹姆斯延长窗口。园区赛季与雷霆崛起为此十年画线。",
  },
};

const DECADE_TITLE: Record<DecadeSlug, { en: string; zh: string }> = {
  "1960s": { en: "1960s — Pioneer Era", zh: "1960 年代 · 拓荒时代" },
  "1970s": { en: "1970s — Merger & Style", zh: "1970 年代 · 合并与风格" },
  "1980s": { en: "1980s — Magic vs Bird", zh: "1980 年代 · 魔鸟争锋" },
  "1990s": { en: "1990s — Jordan's Reign", zh: "1990 年代 · 乔丹王朝" },
  "2000s": { en: "2000s — Shaq, Duncan, Kobe", zh: "2000 年代 · OK 组合与马刺" },
  "2010s": { en: "2010s — Pace & Space", zh: "2010 年代 · 节奏与空间革命" },
  "2020s": { en: "2020s — Global Era", zh: "2020 年代 · 国际化时代" },
};

interface PageProps {
  params: Promise<{ decade: string }>;
}

export async function generateStaticParams() {
  return DECADE_SLUGS
    .filter((slug) => seasonsForDecade(slug).length > 0)
    .map((decade) => ({ decade }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { decade } = await params;
  if (!DECADE_SLUGS.includes(decade as DecadeSlug)) return {};
  const slug = decade as DecadeSlug;
  const seasons = seasonsForDecade(slug);
  if (seasons.length === 0) return {};
  const meta = DECADE_TITLE[slug];
  const names = seasons.slice(0, 4).map((s) => s.name).join(", ");
  return {
    title: `${meta.en} — Iconic NBA Seasons`,
    description: `${seasons.length} peak campaigns from the ${slug}: ${names}, and more.`,
    alternates: { canonical: `/iconic-seasons/${slug}` },
    openGraph: {
      title: meta.en,
      description: `${seasons.length} hand-curated peak campaigns from the ${slug}.`,
    },
  };
}

export default async function DecadeIconicSeasonsPage({ params }: PageProps) {
  const { decade } = await params;
  if (!DECADE_SLUGS.includes(decade as DecadeSlug)) notFound();
  const slug = decade as DecadeSlug;
  const seasons = seasonsForDecade(slug);
  if (seasons.length === 0) notFound();

  const locale = await getLocale();
  const isZh = locale === "zh";
  const title = isZh ? DECADE_TITLE[slug].zh : DECADE_TITLE[slug].en;
  const blurb = isZh ? DECADE_BLURB[slug].zh : DECADE_BLURB[slug].en;

  // Cross-link to adjacent decades for navigation flow
  const availableDecades = DECADE_SLUGS.filter((s) => seasonsForDecade(s).length > 0);

  // Trophy + champion tallies for this decade — gives the page a top-line
  // narrative beyond a card list.
  const mvpCount = seasons.filter((s) => s.mvp).length;
  const champCount = seasons.filter((s) => s.champion).length;
  const fmvpCount = seasons.filter((s) => s.finalsMvp).length;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Iconic NBA Seasons — ${slug}`,
    numberOfItems: seasons.length,
    itemListElement: seasons.map((s, i) => ({
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
      <Breadcrumbs
        items={[
          { label: isZh ? "经典赛季" : "Iconic Seasons", href: "/iconic-seasons" },
          { label: slug },
        ]}
      />

      <PageHeader
        eyebrow={isZh ? "年代" : "Decade"}
        icon={Flame}
        title={title}
        subtitle={
          isZh
            ? `${seasons.length} 个 ${slug.slice(0, 4)} 年代的巅峰赛季`
            : `${seasons.length} peak campaigns from the ${slug}`
        }
      />

      {/* Editorial blurb — gives the page its own voice */}
      <div className="mt-4 glass-tile p-4">
        <p className="text-sm text-text-secondary leading-relaxed">{blurb}</p>
      </div>

      {/* Decade tally strip */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        <Tile label={isZh ? "MVP 赛季" : "MVP Seasons"} value={mvpCount} icon={Crown} />
        <Tile label={isZh ? "夺冠赛季" : "Title Runs"} value={champCount} icon={Trophy} />
        <Tile label={isZh ? "FMVP" : "Finals MVP"} value={fmvpCount} icon={Activity} />
      </div>

      {/* Adjacent decades nav */}
      <div className="mt-6 flex items-center flex-wrap gap-1.5">
        <Link
          href="/iconic-seasons"
          className="text-[10px] font-mono uppercase tracking-[0.15em] inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-bg-secondary/40 text-text-secondary hover:border-accent/40 hover:text-text-primary cursor-pointer"
        >
          <ArrowLeft size={11} />
          {isZh ? "全部年代" : "All decades"}
        </Link>
        {availableDecades.map((d) => (
          <Link
            key={d}
            href={`/iconic-seasons/${d}`}
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

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {seasons.map((s) => (
          <SeasonCard key={s.id} season={s} isZh={isZh} />
        ))}
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/iconic-seasons", label: isZh ? "全部经典赛季" : "All iconic seasons", icon: Flame },
          { href: "/iconic-games", label: isZh ? "经典之夜" : "Iconic games", icon: Flame },
          { href: "/compare", label: isZh ? "球员对比" : "Player compare", icon: GitCompareArrows },
          { href: "/all-time-leaders", label: isZh ? "历史排行" : "All-time leaders", icon: Crown },
        ]}
      />
    </div>
  );
}

function Tile({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Crown }) {
  return (
    <div className="glass-tile p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-accent-amber/15 flex items-center justify-center text-accent-amber">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60">{label}</p>
        <p className="text-2xl font-light font-mono tabular-nums text-text-primary">{value}</p>
      </div>
    </div>
  );
}
