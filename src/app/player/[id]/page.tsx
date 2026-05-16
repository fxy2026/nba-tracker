import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPlayerInfo, getPlayerHeadshotUrl } from "@/lib/api";
import { notFound } from "next/navigation";
import { Ruler, Weight, MapPin, GraduationCap, Calendar, Award, ExternalLink, Newspaper, Trophy, GitCompareArrows, TrendingUp } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PlayerMeasurements from "@/components/player/PlayerMeasurements";
import PlayerSalary from "@/components/player/PlayerSalary";
import PlayerNews from "@/components/player/PlayerNews";
import PlayerStatsBundle from "@/components/player/PlayerStatsBundle";
import PlayerAdvancedStats from "@/components/player/PlayerAdvancedStats";
import ShotHeatmap from "@/components/ShotHeatmap";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

// Dynamic rendering — no edge cache, avoids stale hanging pages
export const dynamic = "force-dynamic";

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

  const player = await getPlayerInfo(personId);
  if (!player) notFound();

  const locale = await getLocale();
  const t = getTranslations(locale);

  // Get all players for position ranking
  const { getPlayerIndex } = await import("@/lib/api");
  const allPlayers = await getPlayerIndex().catch(() => []);
  const positionPlayers = player.position
    ? allPlayers.filter((p) => p.position === player.position && p.pts > 0).sort((a, b) => b.pts - a.pts)
    : [];
  const posRank = positionPlayers.findIndex((p) => p.personId === personId) + 1;

  const headshotUrl = getPlayerHeadshotUrl(personId);
  const fullName = `${player.firstName} ${player.lastName}`;
  const seasons = player.toYear && player.fromYear ? parseInt(player.toYear) - parseInt(player.fromYear) + 1 : 0;

  // No server-side stats fetch — stats.nba.com blocks Vercel IPs.
  // Client components will attempt fetch and show graceful fallback if blocked.

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Link href="/search" className="text-sm text-text-secondary hover:text-accent transition-colors">
        {t.common.backToSearch}
      </Link>

      {/* Player Header */}
      <div className="bg-bg-card rounded-xl border border-border mt-4 overflow-hidden">
        <div className="relative bg-gradient-to-r from-accent/10 via-bg-card to-bg-card p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-bg-secondary border-4 border-accent/20 shrink-0">
              <Image
                src={headshotUrl}
                alt={fullName}
                width={128}
                height={128}
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">
                  {player.firstName} <span className="text-accent">{player.lastName}</span>
                </h1>
                <FavoriteButton type="player" id={personId} />
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-3 mt-2 flex-wrap">
                <Link
                  href={`/team/${player.teamAbbr}`}
                  className="text-sm text-text-secondary hover:text-accent transition-colors"
                >
                  {player.teamCity} {player.teamName}
                </Link>
                <span className="text-accent font-medium text-sm">#{player.jersey} &middot; {player.position}</span>
                {posRank > 0 && posRank <= 30 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                    #{posRank} {player.position} in PPG
                  </span>
                )}
                <Link
                  href={`/compare?q1=${encodeURIComponent(player.lastName)}`}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-bg-hover text-text-secondary hover:text-accent hover:border-accent/50 transition-colors flex items-center gap-1"
                >
                  <GitCompareArrows size={10} /> Compare
                </Link>
              </div>
              {/* Quick stat pills */}
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                {player.pts > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold">{player.pts} PPG</span>}
                {player.reb > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-bold">{player.reb} RPG</span>}
                {player.ast > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold">{player.ast} APG</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Body Metrics */}
        <div className="p-6 border-t border-border">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
            <Ruler size={14} />
            {t.playerDetail.bodyMetrics}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard icon={<Ruler size={14} className="text-accent" />} label={t.playerDetail.height} value={player.height || "-"} />
            <MetricCard icon={<Weight size={14} className="text-accent" />} label={t.playerDetail.weight} value={player.weight ? `${player.weight} lbs` : "-"} />
            <MetricCard icon={<MapPin size={14} className="text-accent" />} label={t.playerDetail.country} value={player.country || "-"} />
            <MetricCard icon={<Calendar size={14} className="text-accent" />} label={t.playerDetail.seasons} value={seasons > 0 ? `${seasons} years` : "-"} />
          </div>
        </div>

        {/* Draft Info */}
        <div className="p-6 border-t border-border">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
            <Award size={14} />
            {t.playerDetail.draftInfo}
          </h2>
          {player.draftYear ? (
            <div className="bg-bg-secondary rounded-xl p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-center">
                  <p className="text-3xl font-bold text-accent">{player.draftYear}</p>
                  <p className="text-xs text-text-secondary">{t.playerDetail.yearLabel}</p>
                </div>
                <div className="w-px h-12 bg-border" />
                <div className="text-center">
                  <p className="text-3xl font-bold text-text-primary">R{player.draftRound}</p>
                  <p className="text-xs text-text-secondary">{t.playerDetail.round}</p>
                </div>
                <div className="w-px h-12 bg-border" />
                <div className="text-center">
                  <p className="text-3xl font-bold text-text-primary">#{player.draftNumber}</p>
                  <p className="text-xs text-text-secondary">{t.playerDetail.pick}</p>
                </div>
                {player.college && (
                  <>
                    <div className="w-px h-12 bg-border" />
                    <div className="flex items-center gap-2">
                      <GraduationCap size={16} className="text-text-secondary" />
                      <div>
                        <p className="text-sm font-medium text-text-primary">{player.college}</p>
                        <p className="text-xs text-text-secondary">{t.playerDetail.college}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-bg-secondary rounded-xl p-4 text-center">
              <p className="text-text-secondary text-sm">{t.playerDetail.undrafted}</p>
              {player.college && <p className="text-xs text-text-secondary mt-1">{t.playerDetail.college}: {player.college}</p>}
            </div>
          )}
        </div>

        {/* Career Timeline */}
        {player.fromYear && player.toYear && (() => {
          const from = parseInt(player.fromYear);
          const to = parseInt(player.toYear);
          const currentYear = new Date().getFullYear();
          const spanStart = Math.min(from, currentYear - 1);
          const spanEnd = Math.max(to, currentYear);
          const totalSpan = spanEnd - spanStart + 1;
          if (totalSpan <= 0) return null;
          const careerLeft = ((from - spanStart) / totalSpan) * 100;
          const careerWidth = ((to - from + 1) / totalSpan) * 100;
          const currentPos = ((currentYear - spanStart) / totalSpan) * 100;
          return (
            <div className="p-6 border-t border-border">
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
                <Calendar size={14} />
                {t.playerDetail.careerTimeline}
              </h2>
              <div className="relative h-8 bg-bg-secondary rounded-full overflow-hidden">
                <div
                  className="absolute top-0 h-full bg-accent/20 rounded-full"
                  style={{ left: `${careerLeft}%`, width: `${careerWidth}%` }}
                />
                {currentYear >= from && currentYear <= to && (
                  <div
                    className="absolute top-0 h-full w-1 bg-accent rounded-full"
                    style={{ left: `${currentPos}%` }}
                    title={`Current: ${currentYear}`}
                  />
                )}
              </div>
              <div className="flex justify-between text-[10px] text-text-secondary mt-1.5">
                <span>{player.fromYear}</span>
                {currentYear >= from && currentYear <= to && (
                  <span className="text-accent font-medium">{currentYear} {t.playerDetail.current}</span>
                )}
                <span>{player.toYear}</span>
              </div>
            </div>
          );
        })()}

        {/* Player Archetype */}
        {player.pts > 0 && (() => {
          const pts = typeof player.pts === "number" ? player.pts : parseFloat(String(player.pts)) || 0;
          const reb = typeof player.reb === "number" ? player.reb : parseFloat(String(player.reb)) || 0;
          const ast = typeof player.ast === "number" ? player.ast : parseFloat(String(player.ast)) || 0;
          const tags: { label: string; color: string }[] = [];
          if (pts >= 25) tags.push({ label: t.playerDetail.eliteScorer, color: "bg-accent/15 text-accent" });
          else if (pts >= 20) tags.push({ label: t.playerDetail.scorer, color: "bg-accent/10 text-accent" });
          if (ast >= 8) tags.push({ label: t.playerDetail.floorGeneral, color: "bg-blue-500/15 text-blue-400" });
          else if (ast >= 5) tags.push({ label: t.playerDetail.playmaker, color: "bg-blue-500/10 text-blue-400" });
          if (reb >= 10) tags.push({ label: t.playerDetail.glassCleaner, color: "bg-success/15 text-success" });
          else if (reb >= 7) tags.push({ label: t.playerDetail.rebounder, color: "bg-success/10 text-success" });
          if (pts >= 15 && reb >= 5 && ast >= 5) tags.push({ label: t.playerDetail.allAround, color: "bg-yellow-500/15 text-yellow-500" });
          if (seasons >= 15) tags.push({ label: t.playerDetail.veteran, color: "bg-orange-500/10 text-orange-400" });
          if (seasons <= 2 && pts >= 10) tags.push({ label: t.playerDetail.risingStar, color: "bg-pink-500/10 text-pink-400" });
          if (tags.length === 0) return null;
          return (
            <div className="px-6 pt-4 flex flex-wrap gap-2">
              {tags.map((t) => (
                <span key={t.label} className={`text-xs px-2.5 py-1 rounded-full font-medium ${t.color}`}>{t.label}</span>
              ))}
            </div>
          );
        })()}

        {/* Career Stats */}
        <div className="p-6 border-t border-border">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-4">{t.playerDetail.careerAverages}</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            <CareerStatBox label="PPG" value={player.pts} highlight allPlayers={allPlayers} personId={personId} statKey="pts" />
            <CareerStatBox label="RPG" value={player.reb} allPlayers={allPlayers} personId={personId} statKey="reb" />
            <CareerStatBox label="APG" value={player.ast} allPlayers={allPlayers} personId={personId} statKey="ast" />
            <StatBox label="From" value={player.fromYear || "-"} />
            <StatBox label="To" value={player.toYear || "-"} />
          </div>
          {/* Feature 3: Scoring Profile mini-bar */}
          {player.pts > 0 && (() => {
            const ppg = typeof player.pts === "number" ? player.pts : parseFloat(String(player.pts));
            if (isNaN(ppg) || ppg <= 0) return null;
            // Approximate scoring breakdown based on position heuristics
            const pos = (player.position || "").toUpperCase();
            let fg2Pct = 0.5, fg3Pct = 0.25, ftPct = 0.25;
            if (pos.includes("C")) { fg2Pct = 0.65; fg3Pct = 0.10; ftPct = 0.25; }
            else if (pos.includes("G")) { fg2Pct = 0.35; fg3Pct = 0.40; ftPct = 0.25; }
            const fg2 = (ppg * fg2Pct).toFixed(1);
            const fg3 = (ppg * fg3Pct).toFixed(1);
            const ft = (ppg * ftPct).toFixed(1);
            return (
              <div className="mt-3 bg-bg-secondary rounded-lg p-3">
                <p className="text-[10px] text-text-secondary uppercase mb-2">{t.playerDetail.scoringProfile}</p>
                <div className="flex h-4 rounded-full overflow-hidden">
                  <div className="bg-accent" style={{ width: `${fg2Pct * 100}%` }} title={`2PT: ~${fg2}`} />
                  <div className="bg-success" style={{ width: `${fg3Pct * 100}%` }} title={`3PT: ~${fg3}`} />
                  <div className="bg-yellow-400" style={{ width: `${ftPct * 100}%` }} title={`FT: ~${ft}`} />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-text-secondary">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent" />2PT ~{fg2}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" />3PT ~{fg3}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" />FT ~{ft}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Career PPG Highlight */}
        {player.pts > 0 && (() => {
          const ppg = typeof player.pts === "number" ? player.pts : parseFloat(String(player.pts));
          if (isNaN(ppg) || ppg <= 0) return null;
          const tier = ppg >= 25 ? { label: t.playerDetail.eliteScorer, color: "text-accent", bg: "bg-accent/10", icon: "star" }
            : ppg >= 18 ? { label: t.playerDetail.scorer, color: "text-success", bg: "bg-success/10", icon: "up" }
            : ppg >= 12 ? { label: t.playerDetail.playmaker, color: "text-blue-400", bg: "bg-blue-400/10", icon: "check" }
            : { label: t.playerDetail.rebounder, color: "text-text-secondary", bg: "bg-bg-hover", icon: "dot" };
          return (
            <div className="p-6 border-t border-border">
              <div className={`${tier.bg} border border-border rounded-xl p-4 flex items-center gap-4`}>
                <div className="text-center">
                  <p className={`text-3xl font-bold ${tier.color}`}>{ppg}</p>
                  <p className="text-[10px] text-text-secondary uppercase">{t.playerDetail.careerPpg}</p>
                </div>
                <div className="w-px h-10 bg-border" />
                <div>
                  <p className={`text-sm font-semibold ${tier.color}`}>{tier.label}</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {ppg >= 25 ? "Top-tier scoring output in the NBA" :
                     ppg >= 18 ? "Consistent high-level scorer" :
                     ppg >= 12 ? "Reliable scoring contributor" :
                     "Valuable role in the rotation"}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Career Milestones */}
        {player.pts > 0 && seasons > 0 && (() => {
          const ppg = typeof player.pts === "number" ? player.pts : parseFloat(String(player.pts));
          if (isNaN(ppg) || ppg <= 0) return null;
          // Estimate career total points: PPG * ~70 GP per season * seasons played
          const gpEstimate = 70;
          const estTotalPts = Math.round(ppg * gpEstimate * seasons);
          const milestones: string[] = [];
          if (estTotalPts >= 25000) milestones.push("25,000+ career points (est.)");
          else if (estTotalPts >= 20000) milestones.push("20,000+ career points (est.)");
          else if (estTotalPts >= 15000) milestones.push("15,000+ career points (est.)");
          else if (estTotalPts >= 10000) milestones.push("10,000+ career points (est.)");
          else if (estTotalPts >= 5000) milestones.push("5,000+ career points (est.)");
          if (ppg >= 20 && seasons >= 10) milestones.push("Decade-long 20+ PPG scorer");
          if (ppg >= 25) milestones.push("Elite scorer (25+ PPG)");
          if (seasons >= 15) milestones.push("15+ year veteran");
          if (milestones.length === 0) return null;
          return (
            <div className="p-6 border-t border-border">
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
                <Trophy size={14} />
                {t.playerDetail.careerMilestones}
              </h2>
              <div className="bg-bg-secondary rounded-xl p-4 space-y-2">
                <p className="text-xs text-text-secondary">
                  Estimated career total: <span className="font-bold text-accent">{estTotalPts.toLocaleString()}</span> points
                  <span className="text-text-secondary/70 ml-1">({ppg} PPG x ~{gpEstimate} GP x {seasons} seasons)</span>
                </p>
                {milestones.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-accent text-sm">&#9733;</span>
                    <span className="text-sm text-text-primary font-medium">{m}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* External Links */}
        <div className="p-6 border-t border-border">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
            <Newspaper size={14} />
            {t.playerDetail.moreInfo}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ExternalLinkCard
              title={t.playerDetail.playerProfile}
              subtitle={t.playerDetail.fullCareerStats}
              href={player.slug ? `https://www.nba.com/player/${personId}/${player.slug}` : `https://www.nba.com/player/${personId}`}
            />
            <ExternalLinkCard
              title={t.playerDetail.salaryContract}
              subtitle={t.playerDetail.capInfo}
              href={`https://www.spotrac.com/nba/player/_/id/${personId}`}
            />
            <ExternalLinkCard
              title={t.playerDetail.latestNews}
              subtitle={t.playerDetail.searchArticles}
              href={`https://www.google.com/search?q=${encodeURIComponent(fullName)}+NBA+news&tbm=nws`}
            />
            <ExternalLinkCard
              title={t.playerDetail.statsAnalytics}
              subtitle={t.playerDetail.advancedData}
              href={`https://www.basketball-reference.com/search/search.fcgi?search=${encodeURIComponent(fullName)}`}
            />
          </div>
        </div>

        {/* Dynamic data sections (client-fetched) */}
        <div className="p-6 border-t border-border space-y-6">
          {/* Stats bundle first — most important for basketball fans */}
          <PlayerStatsBundle playerId={personId} playerName={fullName} teamTricode={player.teamAbbr} />
          <PlayerAdvancedStats playerId={personId} playerName={fullName} teamTricode={player.teamAbbr} />
          <ShotHeatmap playerId={personId} teamTricode={player.teamAbbr} fromYear={player.fromYear} toYear={player.toYear} />
          <PlayerMeasurements draftYear={player.draftYear} />
          <PlayerSalary playerName={fullName} teamAbbr={player.teamAbbr} />
          <PlayerNews playerName={fullName} />
        </div>

        {/* Teammates */}
        {player.teamAbbr && (() => {
          const teammates = allPlayers
            .filter((p) => p.teamAbbr === player.teamAbbr && p.personId !== personId && p.pts > 0)
            .sort((a, b) => b.pts - a.pts)
            .slice(0, 6);
          if (teammates.length === 0) return null;
          return (
            <div className="p-6 border-t border-border">
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3">{t.playerDetail.teammates}</h2>
              <div className="flex flex-wrap gap-2">
                {teammates.map((t) => (
                  <Link key={t.personId} href={`/player/${t.personId}`} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-secondary rounded-lg hover:bg-bg-hover transition-colors text-sm">
                    <PlayerHeadshot personId={t.personId} name={`${t.firstName} ${t.lastName}`} size={20} />
                    <span className="text-text-primary">{t.firstName.charAt(0)}. {t.lastName}</span>
                    <span className="text-[10px] text-accent">{t.pts}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Similar Players */}
        {player.pts > 0 && (() => {
          // Multi-stat similarity: weighted distance across PTS, REB, AST
          const similar = allPlayers
            .filter((p) => p.personId !== personId && p.pts > 0 && p.position === player.position)
            .map((p) => ({
              ...p,
              distance: Math.sqrt(
                Math.pow(p.pts - player.pts, 2) +
                Math.pow((p.reb - player.reb) * 1.5, 2) +
                Math.pow((p.ast - player.ast) * 1.5, 2)
              ),
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5);
          if (similar.length === 0) return null;
          return (
            <div className="p-6 border-t border-border">
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-2">
                <TrendingUp size={14} />
                {t.playerDetail.similarPlayers}
              </h2>
              <div className="space-y-2">
                {similar.map((s) => (
                  <Link key={s.personId} href={`/player/${s.personId}`}
                    className="flex items-center gap-3 px-3 py-2.5 bg-bg-secondary rounded-lg hover:bg-bg-hover transition-colors group">
                    <PlayerHeadshot personId={s.personId} name={`${s.firstName} ${s.lastName}`} size={28} />
                    <span className="font-medium text-text-primary group-hover:text-accent transition-colors text-sm flex-1">{s.firstName} {s.lastName}</span>
                    <span className="text-[10px] text-text-secondary">{s.teamAbbr}</span>
                    <span className="text-xs text-accent font-bold">{s.pts}</span>
                    <span className="text-xs text-text-secondary">{s.reb}</span>
                    <span className="text-xs text-text-secondary">{s.ast}</span>
                    <span className="text-[9px] text-text-secondary/50 tabular-nums w-10 text-right">Δ{s.distance.toFixed(1)}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Team Link */}
        {player.teamAbbr && (
          <div className="p-6 border-t border-border">
            <Link
              href={`/team/${player.teamAbbr}`}
              className="flex items-center gap-3 px-4 py-3 bg-bg-hover rounded-lg hover:bg-accent/10 transition-colors group"
            >
              <Image
                src={`https://cdn.nba.com/logos/nba/${player.teamId}/global/L/logo.svg`}
                alt={player.teamAbbr}
                width={32}
                height={32}
                unoptimized
              />
              <div>
                <p className="font-medium text-text-primary group-hover:text-accent transition-colors">
                  {player.teamCity} {player.teamName}
                </p>
                <p className="text-xs text-text-secondary">View team roster & schedule</p>
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-bg-secondary rounded-lg p-3 text-center">
      <p className="text-[10px] text-text-secondary uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${highlight ? "text-accent" : "text-text-primary"}`}>{value}</p>
    </div>
  );
}

function CareerStatBox({ label, value, highlight, allPlayers, personId, statKey }: {
  label: string; value: string | number; highlight?: boolean;
  allPlayers: { personId: number; pts: number; reb: number; ast: number }[];
  personId: number; statKey: "pts" | "reb" | "ast";
}) {
  // Compute the position average across all players with >0 pts to determine if above average
  const activePlayers = allPlayers.filter((p) => p.pts > 0);
  const avg = activePlayers.length > 0 ? activePlayers.reduce((s, p) => s + p[statKey], 0) / activePlayers.length : 0;
  const numVal = typeof value === "number" ? value : parseFloat(String(value));
  const aboveAvg = !isNaN(numVal) && numVal > avg && avg > 0;
  // Check if player is in the top 20 for this stat
  const sorted = [...activePlayers].sort((a, b) => b[statKey] - a[statKey]);
  const rank = sorted.findIndex((p) => p.personId === personId) + 1;
  const isElite = rank > 0 && rank <= 20;

  // Percentile: what % of players this player is better than
  const percentile = sorted.length > 0 ? Math.round(((sorted.length - rank) / sorted.length) * 100) : 0;

  return (
    <div className="bg-bg-secondary rounded-lg p-3 text-center relative">
      <p className="text-[10px] text-text-secondary uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${highlight ? "text-accent" : "text-text-primary"}`}>
        {value}
        {aboveAvg && <span className="text-success text-xs ml-1" title="Above league average">&#9650;</span>}
      </p>
      {rank > 0 && (
        <div className="mt-1.5">
          <div className="h-1 bg-bg-hover rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${percentile >= 90 ? "bg-accent" : percentile >= 70 ? "bg-success" : percentile >= 40 ? "bg-yellow-400" : "bg-text-secondary/30"}`} style={{ width: `${percentile}%` }} />
          </div>
          <span className="text-[8px] text-text-secondary mt-0.5 block">
            {isElite ? `#${rank} in NBA` : `Top ${100 - percentile}%`}
          </span>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-bg-secondary rounded-lg p-3 flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-[10px] text-text-secondary uppercase">{label}</p>
        <p className="text-sm font-medium text-text-primary">{value}</p>
      </div>
    </div>
  );
}

function ExternalLinkCard({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 bg-bg-secondary rounded-lg hover:bg-bg-hover transition-colors group"
    >
      <ExternalLink size={14} className="text-text-secondary group-hover:text-accent shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">{title}</p>
        <p className="text-xs text-text-secondary truncate">{subtitle}</p>
      </div>
    </a>
  );
}
