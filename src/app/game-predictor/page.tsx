import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Sparkles, TrendingUp, ArrowRight, Calendar, Repeat, Activity, MapPin } from "lucide-react";
import { getCurrentSeasonSchedule, getScheduleAge, formatDate } from "@/lib/api";
import { teamLogoUrl } from "@/lib/teamUrls";
import { buildPredictions, MIN_PREDICTION_GAMES, type PredictedGame } from "@/lib/game-predictions";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";
import { getLocale } from "@/lib/locale";

export const metadata: Metadata = {
  title: "Game Predictor",
  description: "Upcoming game form estimates with explicit current-season sample requirements; heuristic scores are not calibrated win probabilities.",
};

function EdgeBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden flex-1 min-w-[80px]">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct * 100}%`, background: color }} />
    </div>
  );
}

function GameRow({ p, isZh }: { p: PredictedGame; isZh: boolean }) {
  if (!p.qualified) return (
    <Link href={`/game/${p.game.gameId}`} className="glass-tile p-4 block">
      <p className="text-xs text-text-secondary">{p.date}</p>
      <p className="font-semibold mt-2">{p.game.awayTeam.teamTricode} @ {p.game.homeTeam.teamTricode}</p>
      <p className="text-sm text-text-secondary mt-2">{isZh ? "样本不足，暂不提供数值预测" : "Insufficient data — no numerical forecast"}</p>
      <p className="text-xs text-text-secondary mt-1">{isZh
        ? `双方各需 ${MIN_PREDICTION_GAMES} 场本赛季已完成常规赛；当前 ${p.game.homeTeam.teamTricode} ${p.homeSamples} 场，${p.game.awayTeam.teamTricode} ${p.awaySamples} 场`
        : `Each team needs ${MIN_PREDICTION_GAMES} completed current-season regular-season games; available: ${p.game.homeTeam.teamTricode} ${p.homeSamples}, ${p.game.awayTeam.teamTricode} ${p.awaySamples}`}</p>
    </Link>
  );
  const homePicked = p.predictedWinner === "home";
  const winnerForm = homePicked ? p.homeForm : p.awayForm;
  const loserForm = homePicked ? p.awayForm : p.homeForm;
  const winnerTri = homePicked ? p.game.homeTeam.teamTricode : p.game.awayTeam.teamTricode;
  const winnerId = homePicked ? p.game.homeTeam.teamId : p.game.awayTeam.teamId;
  const loserTri = homePicked ? p.game.awayTeam.teamTricode : p.game.homeTeam.teamTricode;
  const loserId = homePicked ? p.game.awayTeam.teamId : p.game.homeTeam.teamId;
  const confColor = p.edgeScore >= 0.75 ? "#22C55E" : p.edgeScore >= 0.6 ? "#F59E0B" : "#94A3B8";

  return (
    <Link href={`/game/${p.game.gameId}`} className="glass-tile p-4 group cursor-pointer block">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary">{p.date}</span>
        <span
          className="text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-0.5 rounded-full"
          style={{ background: `${confColor}22`, color: confColor }}
        >
          {Math.round(p.edgeScore * 100)}/100 {isZh ? "启发式指数" : "heuristic score"}
        </span>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        {/* Predicted winner side */}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <Image
            src={teamLogoUrl(winnerId)}
            alt={winnerTri}
            width={48}
            height={48}
            unoptimized
            className="shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-accent-amber">{isZh ? "模型倾向" : "Model lean"}</p>
            <p className="text-lg font-bold text-text-primary group-hover:text-accent-amber transition-colors">{winnerTri}</p>
            <p className="text-[10px] font-mono tabular-nums text-text-secondary">
              {winnerForm.wins}-{winnerForm.losses} · L10 {Math.round(winnerForm.last10Pct * 100)}%
            </p>
          </div>
        </div>

        {/* Spread */}
        <div className="flex flex-col items-center px-2 sm:px-4 shrink-0">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary">{isZh ? "估计分差" : "Estimated margin"}</p>
          <p className="text-2xl font-light font-mono tabular-nums text-accent-amber leading-none mt-0.5">
            +{Math.abs(p.spread).toFixed(1)} {isZh ? "分" : "pts"}
          </p>
          <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60 mt-0.5">{isZh ? `对阵 ${loserTri}` : `vs ${loserTri}`}</p>
        </div>

        {/* Loser side */}
        <div className="flex-1 flex items-center gap-3 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary">{isZh ? "对手" : "Opponent"}</p>
            <p className="text-lg font-bold text-text-secondary">{loserTri}</p>
            <p className="text-[10px] font-mono tabular-nums text-text-secondary/70">
              {loserForm.wins}-{loserForm.losses} · L10 {Math.round(loserForm.last10Pct * 100)}%
            </p>
          </div>
          <Image
            src={teamLogoUrl(loserId)}
            alt={loserTri}
            width={48}
            height={48}
            unoptimized
            className="shrink-0 opacity-60"
          />
        </div>
      </div>

      {/* Heuristic score bar at bottom */}
      <div className="mt-3 pt-3 border-t border-border flex items-center gap-3">
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">{isZh ? "优势" : "Edge"}</span>
        <EdgeBar pct={p.edgeScore} color={confColor} />
        <ArrowRight size={12} className="text-text-secondary group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
}

export default async function GamePredictorPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const schedule = await getCurrentSeasonSchedule().catch(() => []);
  const predictions = buildPredictions(schedule, formatDate(new Date()));

  if (predictions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <PageHeader eyebrow={isZh ? "工具" : "Tool"} icon={Sparkles} title={isZh ? "比赛预测" : "Game Predictor"} />
        <EmptyState
          icon={Sparkles}
          title={isZh ? "暂无待预测的比赛" : "No upcoming games to predict"}
          description={isZh ? "未来 7 天没有排定的比赛,或赛程数据尚未加载。" : "No games scheduled in the next 7 days, or schedule data isn't loaded yet."}
          action={{ label: isZh ? "查看今日" : "View today", href: "/" }}
        />
      </div>
    );
  }

  const qualified = predictions.filter((p) => p.qualified);
  const highEdge = qualified.filter((p) => p.edgeScore >= 0.75).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? "工具" : "Tool"}
        icon={Sparkles}
        title={isZh ? "比赛预测" : "Game Predictor"}
        subtitle={isZh ? "未来 7 天赛程 · 基于本赛季样本的启发式估计" : "Next 7 days · current-season form estimates, not calibrated win probabilities"}
        updatedAt={getScheduleAge()}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="glass-tile p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-amber/15 flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-accent-amber" />
          </div>
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">{isZh ? "预测中" : "Predicting"}</p>
            <p className="text-xl font-light font-mono tabular-nums text-accent-amber leading-none">{qualified.length}</p>
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">{isZh ? "场比赛" : "games"}</p>
          </div>
        </div>
        <div className="glass-tile p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center shrink-0">
            <TrendingUp size={16} className="text-success" />
          </div>
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">{isZh ? "较强模型倾向" : "Stronger model lean"}</p>
            <p className="text-xl font-light font-mono tabular-nums text-success leading-none">{highEdge}</p>
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">{isZh ? "指数 ≥ 75/100" : "score ≥ 75/100"}</p>
          </div>
        </div>
        <div className="glass-tile p-3 flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
            <ArrowRight size={16} className="text-accent" />
          </div>
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">{isZh ? "窗口" : "Window"}</p>
            <p className="text-sm font-bold text-text-primary">{isZh ? "未来 7 天" : "Next 7 days"}</p>
            <p className="text-[10px] font-mono text-text-secondary">{isZh ? "来自现有赛程缓存" : "From available schedule cache"}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {predictions.map((p) => <GameRow key={p.game.gameId} p={p} isZh={isZh} />)}
      </div>

      <div className="glass-tile p-4 mt-6">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2">{isZh ? "/ 方法" : "/ Method"}</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          {isZh
            ? "双方各需至少 10 场本赛季已完成常规赛，覆盖完整近 10 场窗口。指数基于总胜率、近 10 场胜率和净胜分，主场评分加 0.05。指数与分差均为启发式估计，未校准为获胜概率，也未验证预测准确率。"
            : "Each team needs at least 10 completed current-season regular-season games for a full last-10 window. The score combines overall win rate, last-10 form and point differential, with +0.05 for home court. Scores and margins are heuristic estimates, not calibrated win probabilities; predictive accuracy has not been validated."}
        </p>
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/schedule", label: isZh ? "赛程" : "Schedule", description: isZh ? "完整赛程" : "Full league schedule", icon: Calendar },
          { href: "/back-to-back", label: isZh ? "背靠背" : "Back-to-Back", description: isZh ? "背靠背赛程" : "Back-to-back games", icon: Repeat },
          { href: "/power-rankings", label: isZh ? "实力榜" : "Power Rankings", description: isZh ? "球队实力排名" : "Team power rankings", icon: TrendingUp },
          { href: "/momentum", label: isZh ? "势头追踪" : "Momentum", description: isZh ? "球队势头追踪" : "Team momentum tracker", icon: Activity },
          { href: "/home-vs-road", label: isZh ? "主客场" : "Home vs Road", description: isZh ? "主客场战绩" : "Home/road splits", icon: MapPin },
        ]}
      />
    </div>
  );
}
