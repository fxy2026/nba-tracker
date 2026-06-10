import Link from "next/link";
import TeamLogo from "@/components/TeamLogo";
import FavoriteButton from "@/components/FavoriteButton";
import UpdatedPill from "@/components/UpdatedPill";
import ShareButton from "@/components/ShareButton";
import type { TeamMeta } from "@/lib/teams";
import type { Translations } from "@/locales";

interface TeamHeroProps {
  team: TeamMeta;
  t: Translations;
  // Record + KPI
  wins: number;
  losses: number;
  winPct: string;
  w10: number;
  l10: number;
  playoffWins: number;
  playoffLosses: number;
  rosterCount: number;
  confRank: number;
  // Season stats (only rendered when gamesPlayed > 0)
  gamesPlayed: number;
  ppg: string;
  oppPpg: string;
  homeWins: number;
  homeLosses: number;
  awayWins: number;
  awayLosses: number;
  streakType: string;
  streakDisplay: string;
  longestWinStreak: number;
  longestLossStreak: number;
  // Age of the schedule cache the record is computed from (ms), or null.
  updatedAt: number | null;
}

/**
 * Hero bento with team-color tint, KPI strip, and inline season stats.
 * Kept as one composite component because the radial accent, logo
 * watermark, KPI strip, and stats grid all share the team-color CSS var
 * scope — splitting them would force prop drilling of the color twice.
 */
export default function TeamHero({
  team, t,
  wins, losses, winPct, w10, l10,
  playoffWins, playoffLosses, rosterCount, confRank,
  gamesPlayed, ppg, oppPpg, homeWins, homeLosses, awayWins, awayLosses,
  streakType, streakDisplay, longestWinStreak, longestLossStreak,
  updatedAt,
}: TeamHeroProps) {
  return (
    <div
      className="glass-tile glass-tile-featured mt-6 p-6 sm:p-8 relative overflow-hidden"
      style={{ ["--team-color" as string]: team.primaryColor }}
    >
      {/* Team color radial accent on top-left */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 50% 40% at 10% 0%, ${team.primaryColor}66 0%, transparent 70%)` }}
      />
      {/* Big team logo watermark on right */}
      <div className="absolute -right-12 -top-8 opacity-10 pointer-events-none">
        <TeamLogo teamId={team.teamId} tricode={team.tricode} size={280} />
      </div>

      <div className="relative flex items-center gap-4 sm:gap-6">
        <div className="shrink-0">
          <TeamLogo teamId={team.teamId} tricode={team.tricode} size={88} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary flex items-center gap-2 flex-wrap">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: team.primaryColor }} />
            {team.tricode} · {team.conference}ern · {team.division}
            <UpdatedPill ageMs={updatedAt} />
          </p>
          <h1 className="leading-[0.9] tracking-[-0.03em] mt-1.5">
            <span className="block text-sm sm:text-base font-extralight text-text-secondary">{team.city}</span>
            <span className="block text-3xl sm:text-5xl font-black text-text-primary">{team.name}</span>
          </h1>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {confRank > 0 && (
              <span className={`text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 rounded-full font-bold ${
                confRank <= 6 ? "bg-accent-amber/15 text-accent-amber border border-accent-amber/30" :
                confRank <= 10 ? "bg-accent/15 text-accent border border-accent/30" :
                "bg-bg-hover text-text-secondary border border-border"
              }`}>
                #{confRank} {team.conference}
              </span>
            )}
            <Link href={`/schedule?team=${team.tricode}`} className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary hover:text-accent transition-colors cursor-pointer">
              → {t.teamPage.scheduleLink}
            </Link>
            <FavoriteButton type="team" id={team.tricode} />
            {/* Share embeds the canonical URL inside the text body so the link
                travels with the share/clipboard payload. */}
            <ShareButton text={`${team.city} ${team.name} ${wins}-${losses} | NBA Tracker\nhttps://nba.xpy.me/team/${team.tricode}`} />
          </div>
        </div>
      </div>

      {/* KPI strip — hairline cells, oversized numerals */}
      <div className="relative grid grid-cols-2 sm:grid-cols-5 mt-8 border-t border-border">
        <TeamKpiCell label="Record" value={
          <><span className="text-success">{wins}</span><span className="text-text-secondary/40 mx-1">–</span><span className="text-danger">{losses}</span></>
        } />
        <TeamKpiCell label="Win %" value={<span className="text-accent-amber">{winPct}%</span>} />
        <TeamKpiCell label={t.teamPage.last10} value={
          <><span className="text-success">{w10}</span><span className="text-text-secondary/40 mx-1">–</span><span className="text-danger">{l10}</span></>
        } />
        {(playoffWins + playoffLosses > 0) ? (
          <TeamKpiCell label={t.common.playoffs} value={
            <><span className="text-success">{playoffWins}</span><span className="text-text-secondary/40 mx-1">–</span><span className="text-danger">{playoffLosses}</span></>
          } />
        ) : (
          <TeamKpiCell label="Conf" value={<span className="text-text-primary">{team.conference[0]}</span>} />
        )}
        <TeamKpiCell label={t.teamPage.playersCount} value={<span className="text-text-primary">{rosterCount}</span>} />
      </div>

      {/* Season Stats */}
      {gamesPlayed > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mt-4">
          <div className="bg-bg-secondary/60 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase">PPG</p>
            <p className="text-lg font-bold text-accent mt-0.5">{ppg}</p>
          </div>
          <div className="bg-bg-secondary/60 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase">OPP PPG</p>
            <p className="text-lg font-bold mt-0.5">{oppPpg}</p>
          </div>
          <div className="bg-bg-secondary/60 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase">{t.teamPage.home}</p>
            <p className="text-lg font-bold mt-0.5">
              <span className="text-success">{homeWins}</span>
              <span className="text-text-secondary mx-0.5">-</span>
              <span className="text-danger">{homeLosses}</span>
            </p>
          </div>
          <div className="bg-bg-secondary/60 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase">{t.teamPage.away}</p>
            <p className="text-lg font-bold mt-0.5">
              <span className="text-success">{awayWins}</span>
              <span className="text-text-secondary mx-0.5">-</span>
              <span className="text-danger">{awayLosses}</span>
            </p>
          </div>
          <div className="bg-bg-secondary/60 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase">{t.teamPage.streak}</p>
            <p className={`text-lg font-bold mt-0.5 ${streakType === "W" ? "text-success" : "text-danger"}`}>
              {streakDisplay}
            </p>
          </div>
          {/* Season Highs */}
          <div className="bg-bg-secondary/60 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase">{t.teamPage.bestStreak}</p>
            <p className="text-lg font-bold text-success mt-0.5">W{longestWinStreak}</p>
          </div>
          <div className="bg-bg-secondary/60 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase">{t.teamPage.worstStreak}</p>
            <p className="text-lg font-bold text-danger mt-0.5">L{longestLossStreak}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamKpiCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="relative py-4 sm:py-5 px-3 sm:px-4 [&:not(:first-child)]:before:absolute [&:not(:first-child)]:before:left-0 [&:not(:first-child)]:before:top-3 [&:not(:first-child)]:before:bottom-3 [&:not(:first-child)]:before:w-px [&:not(:first-child)]:before:bg-border [&:not(:first-child)]:before:content-['']">
      <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">{label}</p>
      <p className="text-2xl sm:text-3xl font-light font-mono tabular-nums mt-1.5 leading-none">
        {value}
      </p>
    </div>
  );
}
