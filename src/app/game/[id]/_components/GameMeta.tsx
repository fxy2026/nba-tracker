import type { BoxScoreTeam } from "@/lib/api";
import type { Translations } from "@/locales";

// 4-up metadata strip: estimated pace (normalized to 48 min), total pts, bench
// pts, free-throw attempts. OT is rolled into pace by extending denominator.
export default function GameMeta({ homeTeam, awayTeam, t }: { homeTeam: BoxScoreTeam; awayTeam: BoxScoreTeam; t: Translations }) {
  const totalPts = homeTeam.score + awayTeam.score;
  const periodsCount = homeTeam.periods?.length || 4;
  const otPeriods = Math.max(periodsCount - 4, 0);
  const pace = Math.round((totalPts / (48 + otPeriods * 5)) * 48);

  let homeBench = 0;
  let awayBench = 0;
  let homeFTA = 0;
  let awayFTA = 0;
  for (const p of homeTeam.players) {
    if (p.played !== "1") continue;
    homeFTA += p.statistics.freeThrowsAttempted;
    if (p.starter !== "1") homeBench += p.statistics.points;
  }
  for (const p of awayTeam.players) {
    if (p.played !== "1") continue;
    awayFTA += p.statistics.freeThrowsAttempted;
    if (p.starter !== "1") awayBench += p.statistics.points;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
      <div className="glass-tile p-3 text-center">
        <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">{pace}</p>
        <p className="text-[10px] text-text-secondary uppercase">{t.gameDetail.estPace}</p>
      </div>
      <div className="glass-tile p-3 text-center">
        <p className="text-2xl font-light font-mono tabular-nums text-text-primary">{totalPts}</p>
        <p className="text-[10px] text-text-secondary uppercase">{t.gameDetail.totalPoints}</p>
      </div>
      <div className="glass-tile p-3 text-center">
        <p className="text-sm font-bold">
          <span className="text-text-secondary">{awayTeam.teamTricode}</span> <span className="text-accent">{awayBench}</span>
          <span className="text-text-secondary mx-1">-</span>
          <span className="text-accent">{homeBench}</span> <span className="text-text-secondary">{homeTeam.teamTricode}</span>
        </p>
        <p className="text-[10px] text-text-secondary uppercase">{t.gameDetail.benchPoints}</p>
      </div>
      <div className="glass-tile p-3 text-center">
        <p className="text-sm font-bold">
          <span className="text-text-secondary">{awayTeam.teamTricode}</span>{" "}
          <span className={awayFTA > homeFTA ? "text-accent" : "text-text-primary"}>{awayFTA}</span>
          <span className="text-text-secondary mx-1">-</span>
          <span className={homeFTA > awayFTA ? "text-accent" : "text-text-primary"}>{homeFTA}</span> <span className="text-text-secondary">{homeTeam.teamTricode}</span>
        </p>
        <p className="text-[10px] text-text-secondary uppercase">{t.gameDetail.freeThrowAtt}</p>
      </div>
    </div>
  );
}
