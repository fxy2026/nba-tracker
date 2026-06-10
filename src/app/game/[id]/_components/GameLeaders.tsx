import type { BoxScoreTeam, PlayerInfo } from "@/lib/api";
import { gameScore, scoreToGrade, gradeColorClass, minutesFromIso } from "@/lib/game-stats";
import { getLocale } from "@/lib/locale";
import type { Translations } from "@/locales";

// Hollinger Game Score normalized to a Hupu-style 0-10 grade, ranked across
// both rosters (top 5)
export default async function GameLeaders({
  homeTeam,
  awayTeam,
  playerInfoMap,
  isLive = false,
  t,
}: {
  homeTeam: BoxScoreTeam;
  awayTeam: BoxScoreTeam;
  playerInfoMap?: Map<number, PlayerInfo>;
  // Live games aren't over, so the #1 player isn't yet "Player of the Game".
  isLive?: boolean;
  t: Translations;
}) {
  const isZh = (await getLocale()) === "zh";
  const allPlayedPlayers = [
    ...awayTeam.players.filter((p) => p.played === "1").map((p) => ({ ...p, teamTricode: awayTeam.teamTricode })),
    ...homeTeam.players.filter((p) => p.played === "1").map((p) => ({ ...p, teamTricode: homeTeam.teamTricode })),
  ];
  const scored = allPlayedPlayers
    .filter((p) => minutesFromIso(p.statistics.minutes) > 0)
    .map((p) => {
      const s = p.statistics;
      const gs = gameScore(s);
      const grade = scoreToGrade(gs, minutesFromIso(s.minutes));
      // Mark a performance as "hot" when scoring decisively beats the player's
      // season pace. The absolute floor (≥25 pts) guards against role-player
      // small-sample averages: 16 pts vs a 4 PPG average isn't a season highlight.
      const info = playerInfoMap?.get(p.personId);
      const seasonPpg = info?.pts ?? 0;
      const hot = s.points >= 25 && seasonPpg > 0 && s.points >= seasonPpg * 1.7;
      return {
        name: p.nameI,
        teamTricode: p.teamTricode,
        gameScore: Math.round(gs * 10) / 10,
        grade,
        hot,
        points: s.points,
        seasonPpg,
      };
    })
    .sort((a, b) => b.grade - a.grade || b.gameScore - a.gameScore)
    .slice(0, 5);

  if (scored.length === 0) return null;
  return (
    <div className="glass-tile p-4 mt-4">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <span className="w-1 h-4 bg-accent rounded-full" />
        {t.gameDetail.playerRatings}
      </h3>
      <div className="space-y-2">
        {scored.map((p, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 bg-bg-secondary rounded-lg">
            <span className={`text-sm font-bold w-6 text-center ${i === 0 ? "text-accent" : "text-text-secondary"}`}>#{i + 1}</span>
            <span className="text-sm font-medium text-text-primary flex-1 flex items-center gap-1.5">
              {p.name}
              {i === 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-amber/15 text-accent-amber border border-accent-amber/30 font-bold">
                  ★ {isLive ? (isZh ? "暂列第一" : "Leading") : isZh ? "本场最佳" : "POTG"}
                </span>
              )}
              {p.hot && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded bg-accent-amber/15 text-accent-amber border border-accent-amber/30 font-mono tabular-nums"
                  title={`${p.points} pts vs ${p.seasonPpg.toFixed(1)} PPG season avg`}
                >
                  {p.points} / {p.seasonPpg.toFixed(1)}
                </span>
              )}
            </span>
            <span className="text-[10px] text-text-secondary">{p.teamTricode}</span>
            <span className="text-[10px] text-text-secondary font-mono tabular-nums" title="Game Score">
              GmSc {p.gameScore}
            </span>
            <span className={`text-sm font-bold font-mono tabular-nums px-1.5 py-0.5 rounded ${gradeColorClass(p.grade)}`}>
              {p.grade.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-text-secondary mt-2">
        {isZh
          ? "评分 = 霍林格 Game Score 归一化到 0-10（5.0 为中性，出场不足 15 分钟向 5.0 回归）"
          : "Grade = Hollinger Game Score normalized to 0-10 (5.0 is neutral; sub-15-minute stints regress toward 5.0)"}
      </p>
    </div>
  );
}
