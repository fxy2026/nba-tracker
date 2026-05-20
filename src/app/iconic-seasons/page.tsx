import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Crown, GitCompareArrows, Trophy, Flame, Activity, Star } from "lucide-react";
import { ICONIC_SEASONS, PLAY_STYLE_LABEL, type IconicSeason } from "@/lib/iconicSeasons";
import { TEAM_META } from "@/lib/teams";
import { playerHeadshotUrl, teamLogoUrl } from "@/lib/teamUrls";
import { getLocale } from "@/lib/locale";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";

export const metadata: Metadata = {
  title: "Iconic NBA Seasons — 26 Peak Campaigns",
  description: "Hand-curated single-season snapshots: Jordan '96, Curry '16, LeBron's bubble run, Kobe's 81, and 22 more. Click any card to compare.",
  alternates: { canonical: "/iconic-seasons" },
  openGraph: {
    title: "Iconic NBA Seasons",
    description: "26 peak campaigns from Wilt's 50.4 PPG to Jokić's first MVP — each with trophy flags, career narrative, and side-by-side compare.",
  },
};

export const revalidate = 86400;

// Era buckets — shown as quick filter chips. Each iconic season falls into
// exactly one based on seasonYear.
type Era = "60s" | "80s" | "90s" | "2000s" | "2010s" | "2020s";
function eraOf(year: number): Era {
  if (year < 1970) return "60s";
  if (year < 1990) return "80s";
  if (year < 2000) return "90s";
  if (year < 2010) return "2000s";
  if (year < 2020) return "2010s";
  return "2020s";
}

export default async function IconicSeasonsPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";

  // Sort chronologically — natural narrative when scrolling top-to-bottom.
  const sorted = [...ICONIC_SEASONS].sort((a, b) => a.seasonYear - b.seasonYear);

  // Group by era for editorial section dividers.
  const byEra: Record<Era, IconicSeason[]> = {
    "60s": [], "80s": [], "90s": [], "2000s": [], "2010s": [], "2020s": [],
  };
  for (const s of sorted) byEra[eraOf(s.seasonYear)].push(s);
  const eraOrder: Era[] = ["60s", "80s", "90s", "2000s", "2010s", "2020s"];

  // Aggregate trophy counts across the dataset — surfaced as a stat strip
  // so the page feels like a museum index, not a flat list.
  const totalMvp = ICONIC_SEASONS.filter((s) => s.mvp).length;
  const totalChamp = ICONIC_SEASONS.filter((s) => s.champion).length;
  const totalFmvp = ICONIC_SEASONS.filter((s) => s.finalsMvp).length;

  const eraLabel = (e: Era): string => {
    if (isZh) {
      return e === "60s" ? "60 年代"
        : e === "80s" ? "80 年代"
        : e === "90s" ? "90 年代"
        : e === "2000s" ? "00 年代"
        : e === "2010s" ? "10 年代"
        : "20 年代";
    }
    return e;
  };

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

      {/* Era sections */}
      <div className="mt-10 space-y-12">
        {eraOrder.map((era) => {
          const seasons = byEra[era];
          if (seasons.length === 0) return null;
          return (
            <section key={era}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent-amber">
                  / {eraLabel(era)}
                </h2>
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
          { href: "/compare", label: isZh ? "球员对比" : "Player Compare", icon: GitCompareArrows },
          { href: "/all-time-leaders", label: isZh ? "历史排行" : "All-Time Leaders", icon: Crown },
          { href: "/records", label: isZh ? "赛季纪录" : "Season Records", icon: Activity },
        ]}
      />
    </div>
  );
}

function StatTile({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Crown }) {
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

function SeasonCard({ season, isZh }: { season: IconicSeason; isZh: boolean }) {
  const team = TEAM_META[season.team];
  const teamColor = team?.primaryColor || "#94A3B8";
  const story = isZh && season.storyZh ? season.storyZh : season.story;

  // Trophy chips — only render what this season earned
  const trophies: { label: string; tone: string }[] = [];
  if (season.mvp) trophies.push({ label: "MVP", tone: "bg-accent-amber/15 text-accent-amber border-accent-amber/30" });
  if (season.finalsMvp) trophies.push({ label: "FMVP", tone: "bg-accent-amber/15 text-accent-amber border-accent-amber/30" });
  if (season.champion) trophies.push({ label: "🏆", tone: "bg-success/15 text-success border-success/30" });
  if (season.dpoy) trophies.push({ label: "DPOY", tone: "bg-accent/15 text-accent border-accent/30" });
  if (season.scoringTitle) trophies.push({ label: "Scoring", tone: "bg-danger/10 text-danger border-danger/30" });

  return (
    <Link
      href={`/compare?p1=${encodeURIComponent(season.id)}`}
      className="glass-tile p-4 relative overflow-hidden block cursor-pointer hover:border-accent/40 transition-colors group"
    >
      {/* Team color tint */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${teamColor}55 0%, transparent 60%)` }}
      />

      {/* Header — headshot + name */}
      <div className="relative flex items-center gap-3 mb-3">
        <div className="w-14 h-14 rounded-xl overflow-hidden bg-bg-secondary shrink-0 border border-border">
          <Image
            src={playerHeadshotUrl(season.personId)}
            alt={season.name}
            width={56}
            height={56}
            unoptimized
            className="w-full h-full object-cover object-top"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-accent/15 text-accent">
              {season.season}
            </span>
            {team && (
              <Image
                src={teamLogoUrl(team.teamId)}
                alt=""
                width={14}
                height={14}
                unoptimized
                aria-hidden
                className="opacity-70"
              />
            )}
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary truncate">
              {season.team}
            </span>
          </div>
          <p className="font-semibold text-text-primary text-sm leading-tight mt-1 truncate">
            {season.name}
          </p>
        </div>
      </div>

      {/* Headline stats */}
      <div className="relative grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">PPG</p>
          <p className="text-xl font-light font-mono tabular-nums text-accent-amber">{season.ppg.toFixed(1)}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">RPG</p>
          <p className="text-xl font-light font-mono tabular-nums text-text-primary">{season.rpg.toFixed(1)}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">APG</p>
          <p className="text-xl font-light font-mono tabular-nums text-text-primary">{season.apg.toFixed(1)}</p>
        </div>
      </div>

      {/* Trophies */}
      {trophies.length > 0 && (
        <div className="relative flex flex-wrap gap-1 mb-2">
          {trophies.map((tr) => (
            <span
              key={tr.label}
              className={`text-[9px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded border ${tr.tone}`}
            >
              {tr.label}
            </span>
          ))}
        </div>
      )}

      {/* Style tags */}
      {season.styles && season.styles.length > 0 && (
        <div className="relative flex flex-wrap gap-1 mb-2">
          {season.styles.slice(0, 2).map((st) => {
            const label = PLAY_STYLE_LABEL[st];
            return (
              <span key={st} className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                {isZh ? label.zh : label.en}
              </span>
            );
          })}
        </div>
      )}

      {/* Story */}
      <p className="relative text-[11px] text-text-secondary leading-relaxed line-clamp-3">
        {story}
      </p>

      {/* CTA hint */}
      <div className="relative mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
        <span className="text-text-secondary/60 font-mono uppercase tracking-[0.15em]">
          {isZh ? "对比" : "Compare"}
        </span>
        <span className="text-accent group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </Link>
  );
}
