import Link from "next/link";
import Image from "next/image";
import { Crown, Flame, ArrowRight, Trophy } from "lucide-react";
import { ALL_TIME_LEADERS } from "@/lib/allTimeLeaders";
import { ICONIC_SEASONS } from "@/lib/iconicSeasons";
import { ICONIC_GAMES } from "@/lib/iconicGames";
import { getFranchiseFive } from "@/lib/franchiseAllTimeFive";
import { playerHeadshotUrl } from "@/lib/teamUrls";

interface Props {
  tricode: string;
  // Defunct-team mapping — Pete Maravich (NOJ) → UTA, Bob Pettit (STL) → ATL,
  // Jason Kidd (NJN) → BKN. Use the current franchise's tricode lookup.
  legacyAliases?: string[];
  isZh: boolean;
}

// Showcase section on /team/[tricode] — surfaces all the curated legends,
// iconic seasons, and iconic games that played for this franchise. Bridges
// the static museum data into a team-specific context the team page
// otherwise wouldn't link to.
export default function TeamLegends({ tricode, legacyAliases = [], isZh }: Props) {
  const matchTeam = (t: string) => t === tricode || legacyAliases.includes(t);

  const legends = ALL_TIME_LEADERS
    .filter((p) => !p.active && p.personId > 0 && matchTeam(p.team))
    .slice(0, 6);
  const seasons = ICONIC_SEASONS
    .filter((s) => matchTeam(s.team))
    .sort((a, b) => b.seasonYear - a.seasonYear)
    .slice(0, 6);
  const games = ICONIC_GAMES
    .filter((g) => matchTeam(g.team))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  const allTimeFive = getFranchiseFive(tricode);

  if (legends.length === 0 && seasons.length === 0 && games.length === 0 && !allTimeFive) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary/60">
          / {isZh ? "球队传奇" : "Franchise Legacy"}
        </h3>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* All-Time Starting 5 — hand-curated for the most storied 10 teams.
          Each member can deep-link into /legends/[id] (retired w/ headshot)
          or just render as a text tile (defunct era, no CDN photo). */}
      {allTimeFive && (
        <div className="mb-6">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary mb-2 flex items-center gap-1.5">
            <Trophy size={11} className="text-accent-amber" />
            {isZh ? "历史最佳 5 人" : "All-Time Starting 5"}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {allTimeFive.five.map((p) => {
              const hasHeadshot = p.personId > 0;
              const bio = isZh && p.bioZh ? p.bioZh : p.bio;
              const inner = (
                <div className="flex flex-col items-center text-center h-full">
                  {hasHeadshot ? (
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-bg-secondary border border-accent-amber/40">
                      <Image
                        src={playerHeadshotUrl(p.personId, "260x190")}
                        alt={p.name}
                        width={56}
                        height={56}
                        unoptimized
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-[10px] font-bold text-text-secondary">
                      {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                  )}
                  <p className="text-[11px] font-semibold text-text-primary mt-1.5 truncate w-full">{p.name}</p>
                  <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-accent-amber">{p.position}</p>
                  <p className="text-[9px] font-mono tabular-nums text-text-secondary/60">{p.era}</p>
                  <p className="text-[10px] text-text-secondary leading-tight mt-1.5 line-clamp-2">{bio}</p>
                </div>
              );
              return hasHeadshot ? (
                <Link
                  key={p.name}
                  href={`/legends/${p.personId}`}
                  className="glass-tile p-2.5 cursor-pointer hover:border-accent-amber/40 transition-colors"
                  title={bio}
                >
                  {inner}
                </Link>
              ) : (
                <div key={p.name} className="glass-tile p-2.5" title={bio}>
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {legends.length > 0 && (
        <div className="mb-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary mb-2 flex items-center gap-1.5">
            <Crown size={11} className="text-accent-amber" />
            {isZh ? "传奇球员" : "Legends"}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {legends.map((p) => (
              <Link
                key={p.personId}
                href={`/legends/${p.personId}`}
                className="glass-tile p-2 flex flex-col items-center text-center cursor-pointer hover:border-accent/40 transition-colors group"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-bg-secondary border border-border">
                  <Image
                    src={playerHeadshotUrl(p.personId, "260x190")}
                    alt={p.name}
                    width={48}
                    height={48}
                    unoptimized
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <p className="text-[10px] font-medium text-text-primary mt-1.5 truncate w-full">{p.name}</p>
                <p className="text-[9px] font-mono tabular-nums text-text-secondary/60">
                  {p.ppg.toFixed(1)} PPG
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {seasons.length > 0 && (
        <div className="mb-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary mb-2 flex items-center gap-1.5">
            <Flame size={11} className="text-accent-amber" />
            {isZh ? "经典赛季" : "Iconic Seasons"}
          </p>
          <div className="flex flex-wrap gap-2">
            {seasons.map((s) => (
              <Link
                key={s.id}
                href={`/compare?p1=${encodeURIComponent(s.id)}`}
                className="glass-tile px-3 py-2 text-xs cursor-pointer hover:border-accent/40 transition-colors group inline-flex items-center gap-2"
              >
                <span className="font-mono tabular-nums text-accent">{s.season}</span>
                <span className="text-text-primary font-medium">{s.name}</span>
                <span className="text-text-secondary font-mono tabular-nums">{s.ppg.toFixed(1)} PPG</span>
                <ArrowRight size={11} className="text-text-secondary group-hover:text-accent group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {games.length > 0 && (
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary mb-2 flex items-center gap-1.5">
            <Flame size={11} className="text-accent" />
            {isZh ? "经典之夜" : "Iconic Games"}
          </p>
          <div className="flex flex-col gap-2">
            {games.map((g) => {
              const dt = new Date(g.date + "T12:00:00");
              const dateLabel = dt.toLocaleDateString(isZh ? "zh-CN" : "en-US", {
                year: "numeric", month: "short", day: "numeric",
              });
              const title = isZh && g.titleZh ? g.titleZh : g.title;
              return (
                <Link
                  key={g.id}
                  href={g.gameId ? `/game/${g.gameId}` : "/iconic-games"}
                  className="glass-tile px-3 py-2 text-xs cursor-pointer hover:border-accent/40 transition-colors group flex items-center gap-3"
                >
                  <span className="font-mono tabular-nums text-text-secondary shrink-0 w-24">{dateLabel}</span>
                  <span className="text-text-primary font-medium flex-1 truncate">{title}</span>
                  <span className="font-mono tabular-nums text-accent-amber shrink-0">{g.pts} pts</span>
                  <ArrowRight size={11} className="text-text-secondary group-hover:text-accent group-hover:translate-x-0.5 transition-transform shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
