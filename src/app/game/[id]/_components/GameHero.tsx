import Link from "next/link";
import dynamic from "next/dynamic";
import CountUpNumber from "@/components/CountUpNumber";
import TeamLogo from "@/components/TeamLogo";
import QuarterScores from "@/components/QuarterScores";
import ShareButton from "@/components/ShareButton";
import { TEAM_META } from "@/lib/teams";
import { toBeijingTime, type BoxScore, type ShotAction } from "@/lib/api";
import { getLeadChanges, getQuarterMvp } from "@/lib/game-stats";
import type { Translations } from "@/locales";

const ChartPlaceholder = () => <div className="h-64 bg-bg-card rounded-xl skeleton-shimmer" />;
const WinProbability = dynamic(() => import("@/components/WinProbability"), { loading: ChartPlaceholder });

export default function GameHero({
  boxScore,
  shots,
  isPlayoffs,
  t,
}: {
  boxScore: BoxScore;
  shots: ShotAction[];
  isPlayoffs: boolean;
  t: Translations;
}) {
  const isFinal = boxScore.gameStatus === 3;
  const homeWon = boxScore.homeTeam.score > boxScore.awayTeam.score;
  const scoreDiff = Math.abs(boxScore.homeTeam.score - boxScore.awayTeam.score);
  const isCloseGame = isFinal && scoreDiff <= 5;
  const beijingTime = toBeijingTime(boxScore.gameTimeUTC);

  const awayColor = TEAM_META[boxScore.awayTeam.teamTricode]?.primaryColor || "#3B82F6";
  const homeColor = TEAM_META[boxScore.homeTeam.teamTricode]?.primaryColor || "#F59E0B";
  const winnerColor = isFinal ? (homeWon ? homeColor : awayColor) : awayColor;

  const leadChanges = isFinal ? getLeadChanges(boxScore.homeTeam, boxScore.awayTeam) : 0;
  const quarterMvp = isFinal ? getQuarterMvp(shots) : null;

  return (
    <div
      className="glass-tile glass-tile-featured p-5 sm:p-6 mt-4 overflow-hidden relative bento-rise"
      style={{ ["--team-color" as string]: winnerColor }}
    >
      {/* Team color split gradient (away on left, home on right) */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, ${awayColor}66 0%, transparent 35%, transparent 65%, ${homeColor}66 100%)`,
        }}
      />

      {/* Top meta row — editorial */}
      <div className="relative flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary">
          {isPlayoffs && <span className="text-accent-amber font-bold">★ {t.common.playoffs}</span>}
          {isCloseGame && <span className="text-danger font-bold">● {t.gameDetail.thriller}</span>}
          {isFinal && scoreDiff >= 20 && <span className="text-accent-amber font-bold">⚡ {t.gameDetail.blowout}</span>}
          {boxScore.homeTeam.periods?.length > 4 && (
            <span className="text-accent-amber font-bold">
              {boxScore.homeTeam.periods.length - 4}
              {t.gameDetail.ot}
            </span>
          )}
          <span className="text-text-secondary/80">
            {boxScore.arena.arenaName}, {boxScore.arena.arenaCity}
          </span>
          {beijingTime && <span className="text-text-secondary/60">· {beijingTime}</span>}
          {isFinal &&
            (() => {
              const periodsCount = boxScore.homeTeam.periods?.length || 4;
              const otPeriods = Math.max(periodsCount - 4, 0);
              const durationMin = 150 + otPeriods * 5;
              const hours = Math.floor(durationMin / 60);
              const mins = durationMin % 60;
              return (
                <span className="text-text-secondary/60">
                  · ~{hours}h{mins > 0 ? `${mins}m` : ""}
                </span>
              );
            })()}
        </div>
        <div className="flex items-center gap-2">
          {boxScore.gameStatus === 2 && (
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-success flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              {boxScore.gameStatusText.trim()}
            </span>
          )}
          {boxScore.gameStatus !== 2 && (
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary">{boxScore.gameStatusText.trim()}</span>
          )}
          {isFinal && (
            <ShareButton
              text={`${boxScore.awayTeam.teamTricode} ${boxScore.awayTeam.score} - ${boxScore.homeTeam.score} ${boxScore.homeTeam.teamTricode} | NBA Tracker`}
            />
          )}
        </div>
      </div>

      {/* Main score row */}
      <div className="relative flex items-center justify-center gap-6 sm:gap-10 py-4">
        {/* Away */}
        <div className="flex flex-col items-center gap-2 flex-1 max-w-[180px]">
          <TeamLogo teamId={boxScore.awayTeam.teamId} tricode={boxScore.awayTeam.teamTricode} size={64} />
          <Link href={`/team/${boxScore.awayTeam.teamTricode}`} className="text-center hover:text-accent transition-colors cursor-pointer">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary">Away</p>
            <p className="font-bold text-sm">{boxScore.awayTeam.teamCity}</p>
            <p className="font-bold text-sm">{boxScore.awayTeam.teamName}</p>
          </Link>
          {isFinal && !homeWon && <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-accent-amber font-bold">★ Winner</span>}
        </div>

        {/* Score */}
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          <span
            className={`text-5xl sm:text-7xl font-light font-mono tabular-nums leading-none tracking-tight ${
              isFinal && !homeWon ? "text-text-primary" : isFinal ? "text-text-secondary" : "text-text-primary"
            }`}
          >
            {boxScore.gameStatus > 1 ? <CountUpNumber value={boxScore.awayTeam.score} durationMs={1200} /> : "—"}
          </span>
          <span className="text-text-secondary/30 text-3xl sm:text-4xl font-extralight">–</span>
          <span
            className={`text-5xl sm:text-7xl font-light font-mono tabular-nums leading-none tracking-tight ${
              isFinal && homeWon ? "text-text-primary" : isFinal ? "text-text-secondary" : "text-text-primary"
            }`}
          >
            {boxScore.gameStatus > 1 ? <CountUpNumber value={boxScore.homeTeam.score} durationMs={1200} /> : "—"}
          </span>
        </div>

        {/* Home */}
        <div className="flex flex-col items-center gap-2 flex-1 max-w-[180px]">
          <TeamLogo teamId={boxScore.homeTeam.teamId} tricode={boxScore.homeTeam.teamTricode} size={64} />
          <Link href={`/team/${boxScore.homeTeam.teamTricode}`} className="text-center hover:text-accent transition-colors cursor-pointer">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary">Home</p>
            <p className="font-bold text-sm">{boxScore.homeTeam.teamCity}</p>
            <p className="font-bold text-sm">{boxScore.homeTeam.teamName}</p>
          </Link>
          {isFinal && homeWon && <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-accent-amber font-bold">★ Winner</span>}
        </div>
      </div>

      {boxScore.homeTeam.periods?.length > 0 && (
        <div className="mt-2 border-t border-border pt-3">
          <QuarterScores homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} />
          {isFinal && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-text-secondary">
              <span className="px-1.5 py-0.5 rounded bg-accent-amber/10 text-accent-amber font-medium">Lead Changes: {leadChanges}</span>
            </div>
          )}
          {isFinal && quarterMvp && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-text-secondary">
              <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                {quarterMvp.qLabel} {t.gameDetail.mvp}
              </span>
              <span className="font-medium text-text-primary">{quarterMvp.name}</span>
              <span>({quarterMvp.pts} pts from FG in highest-scoring quarter)</span>
            </div>
          )}
          {isFinal && boxScore.homeTeam.periods.length > 0 && (
            <WinProbability
              periods={boxScore.homeTeam.periods.map((p, i) => ({
                period: p.period,
                homeScore: p.score,
                awayScore: boxScore.awayTeam.periods[i]?.score || 0,
              }))}
            />
          )}
        </div>
      )}
    </div>
  );
}
