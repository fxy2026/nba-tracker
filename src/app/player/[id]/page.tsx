import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPlayerInfo, getPlayerIndex, getPlayerHeadshotUrl } from "@/lib/api";
import { formatGameDate } from "@/lib/dates";
import { ALL_TIME_LEADERS } from "@/lib/allTimeLeaders";
import { ICONIC_SEASONS } from "@/lib/iconicSeasons";
import { ICONIC_GAMES } from "@/lib/iconicGames";
import { notFound } from "next/navigation";
import { Ruler, Weight, MapPin, GraduationCap, Award, ExternalLink, Newspaper, Trophy, GitCompareArrows, TrendingUp, Users, ArrowUpRight, Activity, Globe, ArrowRight, Crown, Sparkles, type LucideIcon } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import ShareButton from "@/components/ShareButton";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import RecentVisitTracker from "@/components/RecentVisitTracker";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import CountUpNumber from "@/components/CountUpNumber";
import { TEAM_META } from "@/lib/teams";
import { teamLogoUrl, playerHeadshotUrl } from "@/lib/teamUrls";
import { getAccolades } from "@/lib/playerAccolades";
import nextDynamic from "next/dynamic";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

// Heavy player subcomponents are code-split — each ships its own chunk
// instead of bloating the player page bundle. They all fetch on mount,
// so deferring the JS doesn't change behavior.
const PlayerHonors = nextDynamic(() => import("@/components/player/PlayerHonors"));
const PlayerMeasurements = nextDynamic(() => import("@/components/player/PlayerMeasurements"));
const PlayerSalary = nextDynamic(() => import("@/components/player/PlayerSalary"));
const PlayerNews = nextDynamic(() => import("@/components/player/PlayerNews"));
const PlayerStatsBundle = nextDynamic(() => import("@/components/player/PlayerStatsBundle"));
const PlayerAdvancedStats = nextDynamic(() => import("@/components/player/PlayerAdvancedStats"));
const ShotHeatmap = nextDynamic(() => import("@/components/ShotHeatmap"));

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const [player, locale] = await Promise.all([getPlayerInfo(parseInt(id, 10)), getLocale()]);
  if (!player) return {};
  const name = `${player.firstName} ${player.lastName}`;
  const desc = locale === "zh"
    ? `${name} 球员档案：${player.pts} PPG / ${player.reb} RPG / ${player.ast} APG | ${player.position} | ${player.teamCity} ${player.teamName}`
    : `${name} player profile: ${player.pts} PPG / ${player.reb} RPG / ${player.ast} APG | ${player.position} | ${player.teamCity} ${player.teamName}`;
  return {
    title: `${name} — ${player.teamCity} ${player.teamName}`,
    description: desc,
    alternates: { canonical: `/player/${id}` },
    openGraph: {
      title: name,
      description: `${player.pts} PPG · ${player.reb} RPG · ${player.ast} APG`,
      images: [getPlayerHeadshotUrl(player.personId)],
    },
  };
}

export default async function PlayerPage({ params }: PageProps) {
  const { id } = await params;
  const personId = parseInt(id, 10);
  if (isNaN(personId)) notFound();

  // Player info + league index in parallel — the index is large and was
  // previously serialized after getPlayerInfo, adding ~100-300ms of TTFB.
  const [player, allPlayers, locale] = await Promise.all([
    getPlayerInfo(personId),
    getPlayerIndex().catch(() => []),
    getLocale(),
  ]);
  if (!player) notFound();

  const t = getTranslations(locale);
  const isZh = locale === "zh";

  const headshotUrl = getPlayerHeadshotUrl(personId);
  // Hand-curated honor counts for this one player — passed to the (code-split)
  // PlayerHonors client component so the full PLAYER_ACCOLADES table never
  // enters the browser bundle.
  const accolades = getAccolades(personId);
  const fullName = `${player.firstName} ${player.lastName}`;
  const seasons = player.toYear && player.fromYear ? parseInt(player.toYear) - parseInt(player.fromYear) + 1 : 0;

  // Helper: compute rank/percentile/delta for any stat
  function statContext(statKey: "pts" | "reb" | "ast", value: number) {
    const active = allPlayers.filter((p) => p.pts > 0);
    if (active.length === 0 || value <= 0) return { rank: 0, percentile: 0, delta: 0, leagueAvg: 0 };
    const leagueAvg = active.reduce((s, p) => s + p[statKey], 0) / active.length;
    const sorted = [...active].sort((a, b) => b[statKey] - a[statKey]);
    const rank = sorted.findIndex((p) => p.personId === personId) + 1;
    const percentile = rank > 0 ? Math.round(((sorted.length - rank) / sorted.length) * 100) : 0;
    const delta = leagueAvg > 0 ? ((value - leagueAvg) / leagueAvg) * 100 : 0;
    return { rank, percentile, delta, leagueAvg };
  }

  // No server-side stats fetch — stats.nba.com blocks Vercel IPs.
  // Client components will attempt fetch and show graceful fallback if blocked.

  const ppg = typeof player.pts === "number" ? player.pts : parseFloat(String(player.pts || 0));
  const rpg = typeof player.reb === "number" ? player.reb : parseFloat(String(player.reb || 0));
  const apg = typeof player.ast === "number" ? player.ast : parseFloat(String(player.ast || 0));

  // Team primary color for accents
  const teamColor = player.teamAbbr ? TEAM_META[player.teamAbbr]?.primaryColor || "#3B82F6" : "#3B82F6";

  const ptsCtx = statContext("pts", ppg);
  const rebCtx = statContext("reb", rpg);
  const astCtx = statContext("ast", apg);

  // Similar players — 3 closest active peers + 2 closest historical legends
  // by normalized PPG/RPG/APG distance. Cross-era reach lets "who plays like
  // this active player?" land on a retired great when the shape matches.
  const { activePeers: similarPlayers, legendPeers: similarLegends } = (() => {
    if (ppg <= 0) return { activePeers: [], legendPeers: [] };
    const peers = allPlayers.filter((p) => p.personId !== personId && p.pts > 0);
    if (peers.length === 0) return { activePeers: [], legendPeers: [] };
    const stddev = (vals: number[]) => {
      const m = vals.reduce((s, v) => s + v, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length;
      return Math.sqrt(variance) || 1;
    };
    const pStd = stddev(peers.map((p) => p.pts));
    const rStd = stddev(peers.map((p) => p.reb));
    const aStd = stddev(peers.map((p) => p.ast));
    const dist2 = (p: { pts: number; reb: number; ast: number }) =>
      ((p.pts - ppg) / pStd) ** 2 +
      ((p.reb - rpg) / rStd) ** 2 +
      ((p.ast - apg) / aStd) ** 2;
    const activeScored = peers
      .map((p) => ({ player: p, distance: dist2(p) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);
    // Legend pool — retired entries from ALL_TIME_LEADERS that carry a
    // valid CDN headshot. Reuse the active stddevs so distances stay
    // comparable across eras (no separate normalization).
    const legendScored = ALL_TIME_LEADERS
      .filter((l) => !l.active && l.personId > 0)
      .map((l) => ({
        legend: l,
        distance: dist2({ pts: l.ppg, reb: l.rpg, ast: l.apg }),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
    return {
      activePeers: activeScored.map((s) => s.player),
      legendPeers: legendScored.map((s) => s.legend),
    };
  })();

  // JSON-LD structured data — Person schema (athlete) for rich snippets
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: `${player.firstName} ${player.lastName}`,
    givenName: player.firstName,
    familyName: player.lastName,
    jobTitle: "Professional basketball player",
    affiliation: player.teamAbbr && TEAM_META[player.teamAbbr] ? {
      "@type": "SportsTeam",
      name: `${player.teamCity} ${player.teamName}`,
      url: `https://nba.xpy.me/team/${player.teamAbbr}`,
    } : undefined,
    height: player.height ? player.height : undefined,
    weight: player.weight ? `${player.weight} lb` : undefined,
    nationality: player.country || undefined,
    alumniOf: player.college ? { "@type": "CollegeOrUniversity", name: player.college } : undefined,
    url: `https://nba.xpy.me/player/${player.personId}`,
    image: playerHeadshotUrl(player.personId),
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <RecentVisitTracker kind="player" id={String(personId)} label={fullName} />
      <Breadcrumbs
        items={[
          { label: isZh ? "球员" : "Players", href: "/search" },
          { label: fullName },
        ]}
      />

      {/* Quick-action row — one-click into /compare with this player primed */}
      <div className="mt-2 flex flex-wrap gap-2">
        <Link
          href={`/compare?p1=${personId}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.15em] rounded-md bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors cursor-pointer"
        >
          <GitCompareArrows size={12} />
          {isZh ? "对比此球员" : "Compare with…"}
          <ArrowRight size={11} />
        </Link>
      </div>

      {/* ─── Bento Hero ─────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-6 gap-3 sm:gap-4 auto-rows-[110px] sm:auto-rows-[120px]">

        {/* Tile 1 — HEADSHOT (Apple-card style: photo top + meta bottom, no bleed) */}
        <div
          className="glass-tile glass-tile-featured col-span-2 sm:col-span-2 row-span-3 sm:row-span-3 group cursor-default bento-rise"
          style={{
            animationDelay: "0ms",
            // Team-color tinted halo on the featured ring
            ["--team-color" as string]: teamColor,
          }}
        >
          {/* Top: photo area — fixed height, image properly centered on face */}
          <div className="relative h-[200px] sm:h-[220px] overflow-hidden bg-bg-secondary kenburns-parent">
            {/* Team color gradient backdrop */}
            <div
              className="absolute inset-0 opacity-50"
              style={{ background: `linear-gradient(135deg, ${teamColor}33 0%, transparent 60%)` }}
            />
            <Image
              src={headshotUrl}
              alt={fullName}
              width={320}
              height={234}
              priority
              unoptimized
              className="kenburns relative w-full h-full object-cover"
              style={{ objectPosition: "50% 15%" }}
            />
            {/* Vignette at edges + bottom fade for text legibility */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 40%, transparent 50%, rgba(0,0,0,0.25) 100%)" }} />
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-bg-card/95 to-transparent" />
            {/* Team logo watermark, top-left */}
            <Image
              src={teamLogoUrl(player.teamId)}
              alt=""
              width={28}
              height={28}
              unoptimized
              className="absolute top-2 left-2 opacity-60 group-hover:opacity-90 transition-opacity drop-shadow-lg"
            />
          </div>
          {/* Bottom: meta */}
          <div className="relative flex flex-col gap-1 p-4">
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-accent-amber">
              #{player.jersey} · {player.position}
            </p>
            <h1 className="leading-[0.9] tracking-[-0.03em]">
              <span className="block text-base font-extralight text-text-secondary">{player.firstName}</span>
              <span className="block text-2xl font-bold text-text-primary">{player.lastName}</span>
            </h1>
            <Link
              href={`/team/${player.teamAbbr}`}
              className="mt-1 text-[11px] text-text-secondary hover:text-accent transition-colors font-medium cursor-pointer w-fit"
            >
              {player.teamCity} {player.teamName}
            </Link>
          </div>
          {/* Favorite + Share share one glass pill. Share embeds the canonical
              URL inside the text body so the link travels with the payload. */}
          <div className="absolute top-2 right-2 z-10 flex items-center bg-bg-card/60 backdrop-blur-md rounded-lg">
            <FavoriteButton type="player" id={personId} />
            <ShareButton text={`${fullName} — ${ppg} PPG · ${rpg} RPG · ${apg} APG | NBA Tracker\nhttps://nba.xpy.me/player/${personId}`} />
          </div>
        </div>

        {/* Tile 2 — PPG HERO (the star number, with rank + delta + percentile bar) */}
        <div className="glass-tile col-span-2 sm:col-span-2 row-span-2 group bento-rise" style={{ animationDelay: "60ms" }}>
          <div className="h-full flex flex-col justify-between p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">Points / Game</p>
              {ptsCtx.rank > 0 && (
                <span className="text-[9px] font-mono tabular-nums uppercase tracking-[0.15em] text-accent-amber flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-accent-amber" />
                  #{ptsCtx.rank} in NBA
                </span>
              )}
            </div>
            <div>
              <div className="flex items-baseline gap-3">
                <p className="text-[clamp(3rem,8vw,6rem)] font-light font-mono tabular-nums leading-none text-accent-amber">
                  {ppg > 0 ? <CountUpNumber value={ppg} decimals={1} stripTrailingZero durationMs={1100} /> : "—"}
                </p>
                {ppg > 0 && ptsCtx.leagueAvg > 0 && (
                  <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded ${
                    ptsCtx.delta >= 0
                      ? "bg-success/15 text-success"
                      : "bg-danger/15 text-danger"
                  }`}>
                    {ptsCtx.delta >= 0 ? "▲" : "▼"} {Math.abs(ptsCtx.delta).toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 mt-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary font-mono">
                  vs league avg <span className="text-text-primary">{ptsCtx.leagueAvg.toFixed(1)}</span>
                </p>
                {ptsCtx.percentile > 0 && (
                  <p className="text-[9px] font-mono tabular-nums text-text-secondary">P{ptsCtx.percentile}</p>
                )}
              </div>
              {ptsCtx.percentile > 0 && (
                <div className="mt-2 h-1 bg-bg-hover rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent to-accent-amber rounded-full"
                    style={{ width: `${ptsCtx.percentile}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tile 3 — RPG (with full context like PPG) */}
        <DataStatTile label="Rebounds" value={rpg} ctx={rebCtx} delayMs={120} />

        {/* Tile 4 — APG (with full context like PPG) */}
        <DataStatTile label="Assists" value={apg} ctx={astCtx} delayMs={180} />

        {/* Tile 5 — Career arc (year range with progress + active dot) */}
        <div className="glass-tile col-span-1 sm:col-span-1 row-span-1 p-3 flex flex-col justify-between bento-rise" style={{ animationDelay: "240ms" }}>
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary">Career</p>
            <p className="text-[9px] font-mono tabular-nums text-accent-amber">{seasons || "—"} yrs</p>
          </div>
          <div>
            <div className="flex items-baseline justify-between font-mono tabular-nums">
              <span className="text-base font-semibold text-text-primary">{player.fromYear || "—"}</span>
              <span className="text-[10px] text-text-secondary">→</span>
              <span className="text-base font-semibold text-text-primary">{player.toYear || "—"}</span>
            </div>
            <div className="mt-1.5 h-0.5 bg-bg-hover rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-accent to-accent-amber" style={{ width: "100%" }} />
            </div>
          </div>
        </div>

        {/* Tile 6 — Draft snapshot OR college (filled, not bare) */}
        <div className="glass-tile col-span-1 sm:col-span-1 row-span-1 p-3 flex flex-col justify-between bento-rise" style={{ animationDelay: "300ms" }}>
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary">
            {player.draftYear ? `Draft ${player.draftYear}` : "Origin"}
          </p>
          <div>
            {player.draftYear ? (
              <p className="text-sm font-semibold text-text-primary leading-tight">
                R{player.draftRound} · <span className="text-accent-amber font-mono tabular-nums">#{player.draftNumber}</span>
              </p>
            ) : (
              <p className="text-sm font-semibold text-text-primary leading-tight">Undrafted</p>
            )}
            <p className="text-[10px] text-text-secondary mt-0.5 truncate">
              {player.college || player.country || "—"}
            </p>
          </div>
        </div>

        {/* Tile 7 — Compare CTA (compact, packed) */}
        <Link
          href={`/compare?q1=${encodeURIComponent(player.lastName)}`}
          className="glass-tile col-span-2 sm:col-span-2 row-span-1 p-3 flex items-center justify-between group cursor-pointer bento-rise"
          style={{ animationDelay: "360ms" }}
        >
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">Compare</p>
            <p className="text-sm font-medium text-text-primary mt-0.5 group-hover:text-accent-amber transition-colors">
              vs. other {player.position}s
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-accent-amber/10 flex items-center justify-center group-hover:bg-accent-amber group-hover:text-bg-primary transition-colors">
            <GitCompareArrows size={14} className="text-accent-amber group-hover:text-bg-primary" />
          </div>
        </Link>
      </div>

      {/* ─── Honor wall (real awards via stats proxy — hides itself on failure) ─ */}
      <PlayerHonors playerId={personId} accolades={accolades} />

      {/* ─── Profile (archetype + scoring DNA + body metrics) ─── */}
      {(() => {
        const tags: { label: string; tone: "amber" | "blue" | "green" }[] = [];
        if (ppg > 0) {
          if (ppg >= 25) tags.push({ label: t.playerDetail.eliteScorer, tone: "amber" });
          else if (ppg >= 20) tags.push({ label: t.playerDetail.scorer, tone: "blue" });
          if (apg >= 8) tags.push({ label: t.playerDetail.floorGeneral, tone: "blue" });
          else if (apg >= 5) tags.push({ label: t.playerDetail.playmaker, tone: "blue" });
          if (rpg >= 10) tags.push({ label: t.playerDetail.glassCleaner, tone: "green" });
          else if (rpg >= 7) tags.push({ label: t.playerDetail.rebounder, tone: "green" });
          if (ppg >= 15 && rpg >= 5 && apg >= 5) tags.push({ label: t.playerDetail.allAround, tone: "amber" });
          if (seasons >= 15) tags.push({ label: t.playerDetail.veteran, tone: "amber" });
          if (seasons <= 2 && ppg >= 10) tags.push({ label: t.playerDetail.risingStar, tone: "amber" });
        }

        const pos = (player.position || "").toUpperCase();
        let fg2Pct = 0.5, fg3Pct = 0.25, ftPct = 0.25;
        if (pos.includes("C")) { fg2Pct = 0.65; fg3Pct = 0.10; ftPct = 0.25; }
        else if (pos.includes("G")) { fg2Pct = 0.35; fg3Pct = 0.40; ftPct = 0.25; }

        return (
          <section className="mt-8 sm:mt-10">
            <SectionHeader icon={Award} title={t.playerDetail.profileTitle} eyebrow="01" />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
                {tags.map((tag) => (
                  <span
                    key={tag.label}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                      tag.tone === "amber" ? "border-accent-amber/30 bg-accent-amber/5 text-accent-amber" :
                      tag.tone === "blue" ? "border-accent/30 bg-accent/5 text-accent" :
                      "border-success/30 bg-success/5 text-success"
                    }`}
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 auto-rows-[90px]">
              {/* Scoring DNA (3-col wide) — only when scoring data exists */}
              {ppg > 0 ? (
                <ScoringDnaTile ppg={ppg} fg2Pct={fg2Pct} fg3Pct={fg3Pct} ftPct={ftPct} t={t} />
              ) : (
                <div className="glass-tile col-span-2 sm:col-span-3 row-span-1 p-3 flex items-center text-sm text-text-secondary">
                  {t.playerDetail.noScoringData}
                </div>
              )}
              {/* Body metrics — 3 small (height + weight + country) on top, college (3-col) below */}
              <GlassFact icon={Ruler} label={t.playerDetail.height} value={player.height || "—"} />
              <GlassFact icon={Weight} label={t.playerDetail.weight} value={player.weight ? `${player.weight} lbs` : "—"} />
              <GlassFact icon={MapPin} label={t.playerDetail.country} value={player.country || "—"} />
              <GlassFact icon={GraduationCap} label={t.playerDetail.college} value={player.college || "—"} />
              <GlassFact icon={Award} label={t.playerDetail.statusLabel} value={seasons > 0 && player.toYear && parseInt(player.toYear) >= new Date().getFullYear() ? t.playerDetail.activeValue : "—"} />
            </div>
          </section>
        );
      })()}

      {/* ─── Career Milestones ───────────────── */}
      {ppg > 0 && seasons > 0 && (() => {
        const gpEstimate = 70;
        const estTotalPts = Math.round(ppg * gpEstimate * seasons);
        const milestones: string[] = [];
        if (estTotalPts >= 25000) milestones.push(t.playerDetail.careerPointsEst(25000));
        else if (estTotalPts >= 20000) milestones.push(t.playerDetail.careerPointsEst(20000));
        else if (estTotalPts >= 15000) milestones.push(t.playerDetail.careerPointsEst(15000));
        else if (estTotalPts >= 10000) milestones.push(t.playerDetail.careerPointsEst(10000));
        else if (estTotalPts >= 5000) milestones.push(t.playerDetail.careerPointsEst(5000));
        if (ppg >= 20 && seasons >= 10) milestones.push(t.playerDetail.milestoneDecadeScorer);
        if (ppg >= 25) milestones.push(t.playerDetail.milestoneEliteScorer);
        if (seasons >= 15) milestones.push(t.playerDetail.milestoneVeteran);
        if (milestones.length === 0) return null;
        return (
          <section className="mt-8 sm:mt-10">
            <SectionHeader icon={Trophy} title={t.playerDetail.careerMilestones} eyebrow="02" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {/* Total points hero tile */}
              <div className="glass-tile glass-tile-featured sm:col-span-1 row-span-1 p-5 flex flex-col justify-between min-h-[150px]">
                <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">{t.playerDetail.estimatedTotal}</p>
                <div>
                  <p className="text-3xl sm:text-4xl font-light font-mono tabular-nums text-accent-amber leading-none">
                    {estTotalPts.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-text-secondary mt-2 font-mono tabular-nums">
                    {t.playerDetail.ppgGpSeasons(ppg, gpEstimate, seasons)}
                  </p>
                </div>
              </div>
              {/* Milestone chips, distributed across remaining tiles */}
              {milestones.slice(0, 4).map((m, i) => (
                <div key={i} className="glass-tile p-4 flex items-center gap-3 min-h-[80px]">
                  <div className="shrink-0 w-9 h-9 rounded-full bg-accent-amber/10 flex items-center justify-center">
                    <Trophy size={14} className="text-accent-amber" />
                  </div>
                  <p className="text-sm text-text-primary font-medium leading-snug">{m}</p>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* ─── Stats Deep Dive (dynamic client sections — own styling) ─ */}
      <section className="mt-8 sm:mt-10 space-y-4">
        <SectionHeader icon={TrendingUp} title={t.playerDetail.statsDeepDiveTitle} eyebrow="03" />
        <PlayerStatsBundle playerId={personId} playerName={fullName} teamTricode={player.teamAbbr} />
        <PlayerAdvancedStats playerId={personId} playerName={fullName} teamTricode={player.teamAbbr} />
        <ShotHeatmap playerId={personId} teamTricode={player.teamAbbr} fromYear={player.fromYear} toYear={player.toYear} />
        <PlayerMeasurements draftYear={player.draftYear} />
        <PlayerSalary playerName={fullName} teamAbbr={player.teamAbbr} />
        <PlayerNews playerName={fullName} />
      </section>

      {/* ─── Connections (Teammates + Similar) ──────────── */}
      {(() => {
        const teammates = player.teamAbbr
          ? allPlayers
              .filter((p) => p.teamAbbr === player.teamAbbr && p.personId !== personId && p.pts > 0)
              .sort((a, b) => b.pts - a.pts)
              .slice(0, 6)
          : [];

        const similarCandidates: { p: typeof allPlayers[number]; distance: number }[] = [];
        if (ppg > 0) {
          for (const p of allPlayers) {
            if (p.personId === personId || p.pts <= 0 || p.position !== player.position) continue;
            const dPts = p.pts - ppg;
            const dReb = (p.reb - rpg) * 1.5;
            const dAst = (p.ast - apg) * 1.5;
            similarCandidates.push({ p, distance: Math.sqrt(dPts * dPts + dReb * dReb + dAst * dAst) });
          }
          similarCandidates.sort((a, b) => a.distance - b.distance);
        }
        const similar = similarCandidates.slice(0, 5);

        if (teammates.length === 0 && similar.length === 0) return null;

        return (
          <section className="mt-8 sm:mt-10">
            <SectionHeader icon={Users} title={t.playerDetail.connectionsTitle} eyebrow="04" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
              {/* Teammates tile */}
              {teammates.length > 0 && (
                <div className="glass-tile p-5">
                  <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-4">{t.playerDetail.teammates}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {teammates.map((tm) => (
                      <Link
                        key={tm.personId}
                        href={`/player/${tm.personId}`}
                        className="group flex flex-col items-center text-center cursor-pointer"
                      >
                        <div className="relative">
                          <PlayerHeadshot personId={tm.personId} name={`${tm.firstName} ${tm.lastName}`} size={48} />
                          <span className="absolute -bottom-1 -right-1 text-[9px] font-mono tabular-nums px-1.5 py-0.5 bg-bg-card/90 backdrop-blur-md text-accent-amber rounded-full border border-border">
                            {tm.pts.toFixed(0)}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-primary group-hover:text-accent transition-colors mt-2 font-medium leading-tight">
                          {tm.firstName.charAt(0)}. {tm.lastName}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Similar players tile */}
              {similar.length > 0 && (
                <div className="glass-tile p-5">
                  <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-4 flex items-center justify-between">
                    {t.playerDetail.similarPlayers}
                    <span className="text-text-secondary/60 normal-case">by PPG · RPG · APG</span>
                  </p>
                  <div className="space-y-1">
                    {similar.map(({ p: s, distance }) => (
                      <Link
                        key={s.personId}
                        href={`/player/${s.personId}`}
                        className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-bg-hover transition-colors group cursor-pointer"
                      >
                        <PlayerHeadshot personId={s.personId} name={`${s.firstName} ${s.lastName}`} size={32} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors truncate">
                            {s.firstName} {s.lastName}
                          </p>
                          <p className="text-[10px] text-text-secondary font-mono tabular-nums">{s.teamAbbr}</p>
                        </div>
                        <div className="flex items-center gap-3 font-mono tabular-nums">
                          <span className="text-xs text-accent-amber font-bold w-6 text-right">{s.pts.toFixed(0)}</span>
                          <span className="text-xs text-text-secondary w-6 text-right">{s.reb.toFixed(0)}</span>
                          <span className="text-xs text-text-secondary w-6 text-right">{s.ast.toFixed(0)}</span>
                          <span className="text-[9px] text-text-secondary/50 w-10 text-right">Δ{distance.toFixed(1)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* ─── Resources & Team CTA ────────────────────── */}
      <section className="mt-8 sm:mt-10">
        <SectionHeader icon={Newspaper} title={t.playerDetail.moreInfo} eyebrow="05" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <ExternalLinkTile
            icon={Award}
            iconColor="#1D428A"   /* NBA navy */
            label="NBA.com"
            title={t.playerDetail.playerProfile}
            subtitle={t.playerDetail.fullCareerStats}
            href={player.slug ? `https://www.nba.com/player/${personId}/${player.slug}` : `https://www.nba.com/player/${personId}`}
          />
          <ExternalLinkTile
            icon={TrendingUp}
            iconColor="#F37920"   /* Spotrac orange */
            label="Spotrac"
            title={t.playerDetail.salaryContract}
            subtitle={t.playerDetail.capInfo}
            href={`https://www.spotrac.com/nba/player/_/id/${personId}`}
          />
          <ExternalLinkTile
            icon={Newspaper}
            iconColor="#EA4335"   /* Google red */
            label="Google News"
            title={t.playerDetail.latestNews}
            subtitle={t.playerDetail.searchArticles}
            href={`https://www.google.com/search?q=${encodeURIComponent(fullName)}+NBA+news&tbm=nws`}
          />
          <ExternalLinkTile
            icon={TrendingUp}
            iconColor="#7E5733"   /* Basketball Reference brown */
            label="Basketball Reference"
            title={t.playerDetail.statsAnalytics}
            subtitle={t.playerDetail.advancedData}
            href={`https://www.basketball-reference.com/search/search.fcgi?search=${encodeURIComponent(fullName)}`}
          />
        </div>

        {/* Featured team CTA — team color tint */}
        {player.teamAbbr && (
          <Link
            href={`/team/${player.teamAbbr}`}
            className="glass-tile glass-tile-featured mt-4 sm:mt-5 p-5 flex items-center justify-between group cursor-pointer relative overflow-hidden"
            style={{ ["--team-color" as string]: teamColor }}
          >
            {/* Team color tint */}
            <div
              className="absolute inset-0 opacity-25 pointer-events-none"
              style={{ background: `linear-gradient(120deg, ${teamColor}55 0%, transparent 70%)` }}
            />
            {/* Watermark logo */}
            <Image
              src={teamLogoUrl(player.teamId)}
              alt=""
              width={220}
              height={220}
              unoptimized
              className="absolute -right-8 -bottom-12 opacity-15 group-hover:opacity-30 transition-opacity"
            />
            <div className="relative flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: `${teamColor}22`, boxShadow: `0 0 0 1px ${teamColor}44 inset` }}
              >
                <Image
                  src={teamLogoUrl(player.teamId)}
                  alt={player.teamAbbr}
                  width={40}
                  height={40}
                  unoptimized
                />
              </div>
              <div>
                <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">{player.teamAbbr}</p>
                <p className="text-lg font-bold text-text-primary group-hover:text-accent transition-colors">
                  {player.teamCity} {player.teamName}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">View team roster &amp; schedule</p>
              </div>
            </div>
            <ArrowUpRight size={20} className="relative text-text-secondary group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </Link>
        )}
      </section>

      {/* Similar players — closest current peers (top row) + closest
          historical legends (bottom row). Both rows linked into /compare. */}
      {(similarPlayers.length > 0 || similarLegends.length > 0) && (
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary/60">
              / {isZh ? "数据相近的球员" : "Statistical Peers"}
            </h2>
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] text-text-secondary">
              {isZh ? "按 PPG/RPG/APG 标准化距离" : "By normalized PPG/RPG/APG distance"}
            </span>
          </div>

          {similarPlayers.length > 0 && (
            <>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary mb-2">
                {isZh ? "现役球员" : "Active"}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {similarPlayers.map((p) => (
                  <Link
                    key={p.personId}
                    href={`/compare?p1=${player.personId}&p2=${p.personId}`}
                    className="glass-tile p-3 flex flex-col items-center text-center cursor-pointer hover:border-accent/40 transition-colors group"
                  >
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-bg-secondary border border-border">
                      <Image
                        src={playerHeadshotUrl(p.personId, "260x190")}
                        alt={`${p.firstName} ${p.lastName}`}
                        width={56}
                        height={56}
                        unoptimized
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <p className="text-xs font-medium text-text-primary mt-2 truncate w-full">
                      {p.firstName} {p.lastName}
                    </p>
                    <p className="text-[10px] font-mono tabular-nums text-text-secondary">
                      {p.pts.toFixed(1)} / {p.reb.toFixed(1)} / {p.ast.toFixed(1)}
                    </p>
                    <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60 mt-1">
                      {p.teamAbbr}
                    </p>
                  </Link>
                ))}
              </div>
            </>
          )}

          {similarLegends.length > 0 && (
            <>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent-amber mb-2 flex items-center gap-1.5">
                <Crown size={11} />
                {isZh ? "数据最相近的历史传奇" : "Closest historical legends"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {similarLegends.map((l) => (
                  <Link
                    key={l.personId}
                    href={`/compare?p1=${player.personId}&p2=${l.personId}`}
                    className="glass-tile p-3 flex items-center gap-3 cursor-pointer hover:border-accent-amber/40 transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-bg-secondary border border-accent-amber/40 shrink-0">
                      <Image
                        src={playerHeadshotUrl(l.personId, "260x190")}
                        alt={l.name}
                        width={48}
                        height={48}
                        unoptimized
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-text-primary truncate">{l.name}</p>
                      <p className="text-[10px] font-mono tabular-nums text-text-secondary">
                        {l.ppg.toFixed(1)} / {l.rpg.toFixed(1)} / {l.apg.toFixed(1)}
                      </p>
                      <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">
                        {l.team} · {l.fromYear}-{l.toYear}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {(() => {
        const iconic = ICONIC_SEASONS
          .filter((s) => s.personId === player.personId)
          .sort((a, b) => b.seasonYear - a.seasonYear);
        if (iconic.length === 0) return null;
        return (
          <section className="mt-8">
            <SectionHeader
              icon={Sparkles}
              eyebrow={isZh ? "巅峰赛季" : "Peak campaigns"}
              title={isZh ? "经典赛季" : "Iconic Seasons"}
            />
            <div className="flex flex-wrap gap-2">
              {iconic.map((s) => (
                <Link
                  key={s.id}
                  href={`/compare?p1=${encodeURIComponent(s.id)}`}
                  className="glass-tile px-3 py-2 text-xs inline-flex items-center gap-2 hover:border-accent-amber/40 transition-colors cursor-pointer group"
                >
                  <span className="font-mono tabular-nums text-accent">{s.season}</span>
                  <span className="text-accent-amber font-mono tabular-nums">{s.ppg.toFixed(1)} PPG</span>
                  {s.mvp && <span className="text-[9px] uppercase tracking-[0.15em] px-1 rounded bg-accent-amber/15 text-accent-amber">MVP</span>}
                  {s.finalsMvp && <span className="text-[9px] uppercase tracking-[0.15em] px-1 rounded bg-accent-amber/15 text-accent-amber">FMVP</span>}
                  {s.champion && <span className="text-[9px] uppercase tracking-[0.15em] px-1 rounded bg-success/15 text-success">🏆</span>}
                  <ArrowRight size={11} className="text-text-secondary group-hover:text-accent group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ))}
            </div>
          </section>
        );
      })()}

      {(() => {
        const games = ICONIC_GAMES
          .filter((g) => g.personId === player.personId)
          .sort((a, b) => b.date.localeCompare(a.date));
        if (games.length === 0) return null;
        return (
          <section className="mt-8">
            <SectionHeader
              icon={Trophy}
              eyebrow={isZh ? "单场神迹" : "Single-night brilliance"}
              title={isZh ? "经典之夜" : "Iconic Games"}
            />
            <div className="flex flex-col gap-2">
              {games.map((g) => {
                const dt = new Date(g.date + "T12:00:00");
                const dateLabel = formatGameDate(dt, isZh ? "zh" : "en", {
                  year: "numeric", month: "short", day: "numeric",
                });
                const title = isZh && g.titleZh ? g.titleZh : g.title;
                return (
                  <Link
                    key={g.id}
                    href={g.gameId ? `/game/${g.gameId}` : "/iconic-games"}
                    className="glass-tile px-3 py-2 text-xs inline-flex items-center gap-3 hover:border-accent/40 transition-colors cursor-pointer group"
                  >
                    <span className="font-mono tabular-nums text-text-secondary shrink-0 w-24">{dateLabel}</span>
                    <span className="text-text-primary font-medium flex-1 truncate">{title}</span>
                    <span className="font-mono tabular-nums text-accent-amber shrink-0">{g.pts} pts</span>
                    <ArrowRight size={11} className="text-text-secondary group-hover:text-accent group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })()}

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          ...(player.teamAbbr
            ? [{ href: `/team/${player.teamAbbr}`, label: isZh ? "球队主页" : "Team page", icon: Users }]
            : []),
          { href: `/compare?p1=${player.personId}`, label: isZh ? "对比球员" : "Compare with another", icon: GitCompareArrows },
          ...(player.position
            ? [{ href: `/by-position?pos=${player.position}`, label: isZh ? "同位置球员" : "Same position", icon: Activity }]
            : []),
          ...(player.country
            ? [{ href: `/by-country?country=${encodeURIComponent(player.country)}`, label: isZh ? "同国家球员" : "Same country", icon: Globe }]
            : []),
          ...(player.draftYear
            ? [{ href: `/draft-classes/${player.draftYear}`, label: isZh ? `${player.draftYear} 届选秀` : `${player.draftYear} draft class`, icon: GraduationCap }]
            : []),
          { href: "/milestones", label: isZh ? "里程碑追踪" : "Career milestones", icon: Award },
        ]}
      />
    </div>
  );
}

/* ─── Bento helper components ───────────────────────────── */

function SectionHeader({ icon: Icon, title, eyebrow, action }: {
  icon: LucideIcon;
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-4 sm:mb-5">
      <div>
        {eyebrow && (
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-1">
            / {eyebrow}
          </p>
        )}
        <h2 className="text-base sm:text-lg font-semibold text-text-primary tracking-tight flex items-center gap-2">
          <Icon size={16} className="text-accent-amber" />
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function GlassFact({ icon: Icon, label, value, mono = false }: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="glass-tile col-span-1 sm:col-span-1 row-span-1 p-3 sm:p-4 flex flex-col justify-between">
      <div className="flex items-center gap-1.5">
        <Icon size={11} className="text-text-secondary/70" />
        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary">{label}</p>
      </div>
      <p className={`text-sm sm:text-base font-semibold text-text-primary truncate ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function ScoringDnaTile({ ppg, fg2Pct, fg3Pct, ftPct, t }: {
  ppg: number;
  fg2Pct: number;
  fg3Pct: number;
  ftPct: number;
  t: { playerDetail: { scoringProfile: string } };
}) {
  const fg2 = (ppg * fg2Pct).toFixed(1);
  const fg3 = (ppg * fg3Pct).toFixed(1);
  const ft = (ppg * ftPct).toFixed(1);
  return (
    <div className="glass-tile col-span-2 sm:col-span-3 row-span-1 p-4 flex flex-col justify-between">
      <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">{t.playerDetail.scoringProfile}</p>
      <div>
        <div className="flex h-2 rounded-full overflow-hidden bg-bg-hover">
          <div className="bg-accent transition-all duration-500" style={{ width: `${fg2Pct * 100}%` }} title={`2PT: ~${fg2}`} />
          <div className="bg-success transition-all duration-500" style={{ width: `${fg3Pct * 100}%` }} title={`3PT: ~${fg3}`} />
          <div className="bg-accent-amber transition-all duration-500" style={{ width: `${ftPct * 100}%` }} title={`FT: ~${ft}`} />
        </div>
        <div className="flex justify-between mt-2 text-[10px] font-mono tabular-nums">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent" /><span className="text-text-secondary">2PT</span><span className="text-text-primary">{fg2}</span></span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-success" /><span className="text-text-secondary">3PT</span><span className="text-text-primary">{fg3}</span></span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent-amber" /><span className="text-text-secondary">FT</span><span className="text-text-primary">{ft}</span></span>
        </div>
      </div>
    </div>
  );
}

function ExternalLinkTile({ icon: Icon, iconColor, label, title, subtitle, href }: {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  title: string;
  subtitle: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="glass-tile p-4 flex items-center gap-3 group cursor-pointer"
    >
      <div
        className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all"
        style={{ background: `${iconColor}1A`, boxShadow: `0 0 0 1px ${iconColor}33 inset` }}
      >
        <Icon size={16} style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary truncate">{label}</p>
        <p className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors truncate">{title}</p>
        <p className="text-[11px] text-text-secondary truncate">{subtitle}</p>
      </div>
      <ExternalLink size={14} className="text-text-secondary/50 group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
    </a>
  );
}

function DataStatTile({ label, value, ctx, delayMs = 0 }: {
  label: string;
  value: number;
  ctx: { rank: number; percentile: number; delta: number; leagueAvg: number };
  delayMs?: number;
}) {
  return (
    <div className="glass-tile col-span-1 sm:col-span-1 row-span-1 p-3 flex flex-col justify-between bento-rise" style={{ animationDelay: `${delayMs}ms` }}>
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary">{label}</p>
        {ctx.rank > 0 && ctx.rank <= 50 && (
          <p className="text-[9px] font-mono tabular-nums text-accent-amber">#{ctx.rank}</p>
        )}
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <p className="text-2xl sm:text-3xl font-light font-mono tabular-nums leading-none text-text-primary">
            {value > 0 ? <CountUpNumber value={value} decimals={1} stripTrailingZero durationMs={900} /> : "—"}
          </p>
          {value > 0 && ctx.leagueAvg > 0 && (
            <span className={`text-[9px] font-mono tabular-nums ${ctx.delta >= 0 ? "text-success" : "text-danger"}`}>
              {ctx.delta >= 0 ? "▲" : "▼"}{Math.abs(ctx.delta).toFixed(0)}%
            </span>
          )}
        </div>
        {ctx.percentile > 0 && (
          <div className="mt-1.5 h-0.5 bg-bg-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-accent-amber"
              style={{ width: `${ctx.percentile}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

