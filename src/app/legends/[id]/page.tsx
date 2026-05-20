import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Crown, TrendingUp, GitCompareArrows, Users, Trophy, Sparkles, ArrowRight } from "lucide-react";
import { ALL_TIME_LEADERS } from "@/lib/allTimeLeaders";
import { TEAM_META } from "@/lib/teams";
import { playerHeadshotUrl, teamLogoUrl } from "@/lib/teamUrls";
import { getLocale } from "@/lib/locale";
import Breadcrumbs from "@/components/Breadcrumbs";
import PageHeader from "@/components/PageHeader";
import RelatedPages from "@/components/RelatedPages";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return ALL_TIME_LEADERS.filter((p) => !p.active && p.personId > 0).map((p) => ({
    id: String(p.personId),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const player = ALL_TIME_LEADERS.find((p) => p.personId === parseInt(id, 10) && !p.active);
  if (!player) return {};
  const desc = `${player.name} — career: ${player.ppg.toFixed(1)} PPG / ${player.rpg.toFixed(1)} RPG / ${player.apg.toFixed(1)} APG · ${player.fromYear}-${player.toYear}`;
  return {
    title: `${player.name} — NBA Legend`,
    description: desc,
    alternates: { canonical: `/legends/${id}` },
    openGraph: {
      title: player.name,
      description: desc,
      images: [playerHeadshotUrl(player.personId)],
    },
  };
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="glass-tile p-3 text-center">
      <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60">{label}</p>
      <p className={`mt-1 text-2xl font-light font-mono tabular-nums ${accent ? "text-accent-amber" : "text-text-primary"}`}>
        {value}
      </p>
    </div>
  );
}

export default async function LegendPage({ params }: PageProps) {
  const { id } = await params;
  const personId = parseInt(id, 10);
  if (isNaN(personId)) notFound();

  const player = ALL_TIME_LEADERS.find((p) => p.personId === personId && !p.active);
  if (!player) notFound();

  const locale = await getLocale();
  const isZh = locale === "zh";
  const team = TEAM_META[player.team];
  const teamColor = team?.primaryColor || "#94A3B8";
  const seasons = player.toYear - player.fromYear + 1;

  // Rank a stat relative to all retired legends in our dataset — gives the
  // page a small "X-greatest of all time at category Y" narrative.
  const rankAmong = (key: "ppg" | "rpg" | "apg" | "spg" | "bpg") => {
    const list = ALL_TIME_LEADERS
      .filter((p) => !p.active && (p[key] ?? 0) > 0)
      .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
    const idx = list.findIndex((p) => p.personId === player.personId);
    return idx >= 0 ? idx + 1 : null;
  };
  const ppgRank = rankAmong("ppg");
  const rpgRank = rankAmong("rpg");
  const apgRank = rankAmong("apg");
  const bestRank = [
    ppgRank && { key: "PPG", rank: ppgRank },
    rpgRank && { key: "RPG", rank: rpgRank },
    apgRank && { key: "APG", rank: apgRank },
  ]
    .filter(Boolean)
    .sort((a, b) => (a as { rank: number }).rank - (b as { rank: number }).rank)[0] as
    | { key: string; rank: number }
    | undefined;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: player.name,
    jobTitle: "Professional basketball player (retired)",
    affiliation: team
      ? { "@type": "SportsTeam", name: `${team.city} ${team.name}` }
      : undefined,
    url: `https://nba.xpy.me/legends/${player.personId}`,
    image: playerHeadshotUrl(player.personId),
    description: `${player.name} — ${player.ppg.toFixed(1)} career PPG, ${player.fromYear}-${player.toYear}.`,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Breadcrumbs
        items={[
          { label: isZh ? "历史榜单" : "All-Time Leaders", href: "/all-time-leaders" },
          { label: player.name },
        ]}
      />

      {/* Quick-action — one-click GOAT-debate launcher with this legend pre-loaded */}
      <div className="mt-2 flex flex-wrap gap-2">
        <Link
          href={`/compare?p1=${player.personId}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.15em] rounded-md bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors cursor-pointer"
        >
          <GitCompareArrows size={12} />
          {isZh ? "对比此球员" : "Compare with…"}
          <ArrowRight size={11} />
        </Link>
      </div>

      <PageHeader
        eyebrow={isZh ? "传奇" : "Legend"}
        icon={Crown}
        title={player.name}
        subtitle={
          isZh
            ? `${player.fromYear}-${player.toYear} · ${player.team} · 生涯共 ${seasons} 个赛季`
            : `${player.fromYear}-${player.toYear} · ${player.team} · ${seasons} NBA seasons`
        }
      />

      {/* Hero — headshot + team identity + era + best rank */}
      <div
        className="glass-tile glass-tile-featured p-5 sm:p-6 relative overflow-hidden mt-4"
        style={{ ["--team-color" as string]: teamColor }}
      >
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ background: `linear-gradient(135deg, ${teamColor}55 0%, transparent 60%)` }}
        />
        <div className="relative flex items-center gap-5 sm:gap-7">
          <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-bg-secondary border-2 border-accent/30 shrink-0">
            <Image
              src={playerHeadshotUrl(player.personId)}
              alt={player.name}
              width={144}
              height={144}
              unoptimized
              priority
              className="w-full h-full object-cover object-top"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-accent-amber mb-1">
              {isZh ? "退役" : "Retired"}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary leading-tight">
              {player.name}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              {team ? (
                <>
                  <Image
                    src={teamLogoUrl(team.teamId)}
                    alt=""
                    width={20}
                    height={20}
                    unoptimized
                    aria-hidden
                  />
                  <span className="text-sm text-text-secondary">
                    {team.city} {team.name}
                  </span>
                </>
              ) : (
                // Defunct/legacy tricode (NJN/NOJ/STL) — no current NBA logo
                // exists at the CDN, so fall back to text-only attribution.
                <span className="text-sm text-text-secondary font-mono">{player.team}</span>
              )}
            </div>
            {bestRank && (
              <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-accent-amber/15 text-accent-amber border border-accent-amber/30">
                <Sparkles size={11} />
                <span className="font-mono tabular-nums">#{bestRank.rank}</span>
                <span>
                  {isZh ? "历史" : "All-time"} {bestRank.key}{" "}
                  <span className="text-text-secondary/70">
                    ({isZh ? "本站收录的退役球员中" : "among retired legends in dataset"})
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Career averages */}
      <div className="mt-6">
        <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 mb-2">
          / {isZh ? "生涯场均" : "Career averages"}
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <Stat label="PPG" value={player.ppg.toFixed(1)} accent />
          <Stat label="RPG" value={player.rpg.toFixed(1)} />
          <Stat label="APG" value={player.apg.toFixed(1)} />
          {player.spg !== undefined && <Stat label="SPG" value={player.spg.toFixed(1)} />}
          {player.bpg !== undefined && <Stat label="BPG" value={player.bpg.toFixed(1)} />}
        </div>
      </div>

      {/* Career totals — only show tiles with data */}
      {(player.totalPts || player.totalReb || player.totalAst || player.totalStl || player.totalBlk) && (
        <div className="mt-6">
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 mb-2">
            / {isZh ? "生涯总计" : "Career totals"}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {player.totalPts !== undefined && (
              <Stat label={isZh ? "总得分" : "Points"} value={player.totalPts.toLocaleString("en-US")} accent />
            )}
            {player.totalReb !== undefined && (
              <Stat label={isZh ? "总篮板" : "Rebounds"} value={player.totalReb.toLocaleString("en-US")} />
            )}
            {player.totalAst !== undefined && (
              <Stat label={isZh ? "总助攻" : "Assists"} value={player.totalAst.toLocaleString("en-US")} />
            )}
            {player.totalStl !== undefined && (
              <Stat label={isZh ? "总抢断" : "Steals"} value={player.totalStl.toLocaleString("en-US")} />
            )}
            {player.totalBlk !== undefined && (
              <Stat label={isZh ? "总盖帽" : "Blocks"} value={player.totalBlk.toLocaleString("en-US")} />
            )}
          </div>
        </div>
      )}

      {/* Era summary */}
      <div className="mt-6 glass-tile p-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary/60">
          / {isZh ? "效力时代" : "Era"}
        </p>
        <p className="mt-2 text-text-primary">
          {isZh ? (
            <>
              在 NBA 征战 <span className="font-bold text-accent-amber font-mono tabular-nums">{seasons}</span> 个赛季，从{" "}
              <span className="font-mono tabular-nums">{player.fromYear}</span> 至{" "}
              <span className="font-mono tabular-nums">{player.toYear}</span> 年。
            </>
          ) : (
            <>
              Played <span className="font-bold text-accent-amber font-mono tabular-nums">{seasons}</span> NBA seasons,
              from <span className="font-mono tabular-nums">{player.fromYear}</span> to{" "}
              <span className="font-mono tabular-nums">{player.toYear}</span>.
            </>
          )}
        </p>
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/all-time-leaders", label: isZh ? "历史排行榜" : "All-time leaders", icon: Crown },
          {
            href: `/team/${player.team}`,
            label: `${player.team} ${isZh ? "球队页" : "team page"}`,
            icon: Users,
          },
          { href: "/records", label: isZh ? "赛季纪录" : "Season records", icon: Trophy },
          { href: "/milestones", label: isZh ? "里程碑" : "Milestones", icon: TrendingUp },
          { href: "/compare", label: isZh ? "球员对比" : "Compare", icon: GitCompareArrows },
        ]}
      />
    </div>
  );
}
