import type { BoxScoreTeam, ShotAction } from "@/lib/api";
import {
  getTopScorer,
  getTopAssist,
  getSpecialPerformances,
  getLargestLead,
  getBiggestRun,
  getAstToRatio,
  getTeamFouls,
  getGameHero,
  getPaceLabel,
} from "@/lib/game-stats";
import type { Translations } from "@/locales";

export default function GameHeadlines({
  homeTeam,
  awayTeam,
  shots,
  t,
}: {
  homeTeam: BoxScoreTeam;
  awayTeam: BoxScoreTeam;
  shots: ShotAction[];
  t: Translations;
}) {
  const homeTopScorer = getTopScorer(homeTeam);
  const awayTopScorer = getTopScorer(awayTeam);
  const homeTopAssist = getTopAssist(homeTeam);
  const awayTopAssist = getTopAssist(awayTeam);
  const homeSpecial = getSpecialPerformances(homeTeam);
  const awaySpecial = getSpecialPerformances(awayTeam);
  const homeLargestLead = getLargestLead(homeTeam, awayTeam);
  const awayLargestLead = getLargestLead(awayTeam, homeTeam);
  const biggestRun = getBiggestRun(shots);
  const hero = getGameHero(homeTeam, awayTeam);
  const pace = getPaceLabel(homeTeam, awayTeam);
  const homeFouls = getTeamFouls(homeTeam);
  const awayFouls = getTeamFouls(awayTeam);
  const awayRatio = getAstToRatio(awayTeam);
  const homeRatio = getAstToRatio(homeTeam);

  return (
    <div className="glass-tile p-4 mt-4">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <span className="w-1 h-4 bg-accent rounded-full" />
        {t.gameDetail.gameSummary}
      </h3>
      {hero && (
        <div className="bg-accent/5 border border-accent/20 rounded-lg px-4 py-2.5 mb-3 flex items-center gap-2">
          <span className="text-accent text-sm">&#9733;</span>
          <span className="text-sm">
            <span className="font-bold text-accent">{hero.nameI}</span>
            <span className="text-text-secondary ml-2">
              {hero.statistics.points} PTS · {hero.statistics.reboundsTotal} REB · {hero.statistics.assists} AST
            </span>
          </span>
        </div>
      )}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary rounded-lg text-xs mb-3">
        <span className="text-text-secondary">{t.gameDetail.pace}</span>
        <span className={`font-bold px-1.5 py-0.5 rounded ${pace.color}`}>{pace.label}</span>
        <span className="text-text-secondary">
          ({pace.pacePerQ.toFixed(1)} {t.gameDetail.ptsPerQ})
        </span>
      </div>
      <div className="flex flex-wrap gap-3 mb-3">
        {biggestRun && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary rounded-lg text-xs">
            <span className="text-text-secondary">{t.gameDetail.biggestRun}</span>
            <span className="font-bold text-accent">
              {biggestRun.teamTricode} {biggestRun.points}-0
            </span>
            <span className="text-text-secondary">in {biggestRun.qLabel}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary rounded-lg text-xs">
          <span className="text-text-secondary">{t.gameDetail.astTo}</span>
          <span className="font-bold text-text-primary">
            {awayTeam.teamTricode} {awayRatio}
          </span>
          <span className="text-text-secondary">-</span>
          <span className="font-bold text-text-primary">
            {homeRatio} {homeTeam.teamTricode}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary rounded-lg text-xs">
          <span className="text-text-secondary">{t.gameDetail.fouls}</span>
          <span className={`font-bold ${awayFouls > homeFouls ? "text-danger" : "text-text-primary"}`}>
            {awayTeam.teamTricode} {awayFouls}
          </span>
          <span className="text-text-secondary">-</span>
          <span className={`font-bold ${homeFouls > awayFouls ? "text-danger" : "text-text-primary"}`}>
            {homeFouls} {homeTeam.teamTricode}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        {/* Away team summary */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-1.5">
            {awayTeam.teamCity} {awayTeam.teamName}
          </p>
          {awayTopScorer && (
            <p className="text-text-primary">
              <span className="font-medium">{awayTopScorer.nameI}</span>
              <span className="text-text-secondary ml-1">
                {awayTopScorer.statistics.points} PTS, {awayTopScorer.statistics.reboundsTotal} REB, {awayTopScorer.statistics.assists} AST
              </span>
            </p>
          )}
          {awaySpecial.length > 0 && (
            <div className="mt-1">
              {awaySpecial.map((p) => (
                <span
                  key={p.name}
                  className={`inline-block text-[10px] px-1.5 py-0.5 rounded mr-1 ${p.isTriple ? "bg-accent/20 text-accent" : "bg-accent/10 text-accent"}`}
                >
                  {p.name}: {p.isTriple ? t.gameDetail.tripleDouble : t.gameDetail.doubleDouble} ({p.pts}/{p.reb}/{p.ast})
                </span>
              ))}
            </div>
          )}
          {awayTopAssist && awayTopAssist.personId !== awayTopScorer?.personId && awayTopAssist.statistics.assists >= 5 && (
            <p className="text-text-secondary text-xs mt-0.5">
              {t.gameDetail.dimes} <span className="text-text-primary font-medium">{awayTopAssist.nameI}</span> {awayTopAssist.statistics.assists} AST
            </p>
          )}
          {awayLargestLead > 0 && <p className="text-xs text-text-secondary mt-1">{t.gameDetail.largestLead} {awayLargestLead} pts</p>}
        </div>
        {/* Home team summary */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-1.5">
            {homeTeam.teamCity} {homeTeam.teamName}
          </p>
          {homeTopScorer && (
            <p className="text-text-primary">
              <span className="font-medium">{homeTopScorer.nameI}</span>
              <span className="text-text-secondary ml-1">
                {homeTopScorer.statistics.points} PTS, {homeTopScorer.statistics.reboundsTotal} REB, {homeTopScorer.statistics.assists} AST
              </span>
            </p>
          )}
          {homeTopAssist && homeTopAssist.personId !== homeTopScorer?.personId && homeTopAssist.statistics.assists >= 5 && (
            <p className="text-text-secondary text-xs mt-0.5">
              {t.gameDetail.dimes} <span className="text-text-primary font-medium">{homeTopAssist.nameI}</span> {homeTopAssist.statistics.assists} AST
            </p>
          )}
          {homeSpecial.length > 0 && (
            <div className="mt-1">
              {homeSpecial.map((p) => (
                <span
                  key={p.name}
                  className={`inline-block text-[10px] px-1.5 py-0.5 rounded mr-1 ${p.isTriple ? "bg-accent/20 text-accent" : "bg-accent/10 text-accent"}`}
                >
                  {p.name}: {p.isTriple ? t.gameDetail.tripleDouble : t.gameDetail.doubleDouble} ({p.pts}/{p.reb}/{p.ast})
                </span>
              ))}
            </div>
          )}
          {homeLargestLead > 0 && <p className="text-xs text-text-secondary mt-1">{t.gameDetail.largestLead} {homeLargestLead} pts</p>}
        </div>
      </div>
    </div>
  );
}
