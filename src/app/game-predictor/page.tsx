import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Sparkles, TrendingUp, ArrowRight } from "lucide-react";
import { getFullSchedule, formatDate, type ScheduleGame } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Game Predictor",
  description: "Upcoming game predictions — winner + confidence % based on each team's recent form.",
};

export const revalidate = 600;

interface TeamForm {
  wins: number;
  losses: number;
  last10Pct: number;
  pf: number;
  pa: number;
  pd: number;
  power: number;
}

interface PredictedGame {
  game: ScheduleGame;
  date: string;
  homeForm: TeamForm;
  awayForm: TeamForm;
  predictedWinner: "home" | "away";
  confidence: number; // 0-1
  spread: number; // predicted point spread
}

function buildTeamForm(map: Map<string, { won: boolean; pf: number; pa: number; date: string }[]>, tricode: string): TeamForm {
  const games = map.get(tricode) || [];
  games.sort((a, b) => b.date.localeCompare(a.date));
  const wins = games.filter((g) => g.won).length;
  const losses = games.length - wins;
  const winPct = games.length > 0 ? wins / games.length : 0;
  const last10 = games.slice(0, 10);
  const last10Pct = last10.length > 0 ? last10.filter((g) => g.won).length / last10.length : 0;
  const pf = last10.length > 0 ? last10.reduce((s, g) => s + g.pf, 0) / last10.length : 100;
  const pa = last10.length > 0 ? last10.reduce((s, g) => s + g.pa, 0) / last10.length : 100;
  const pd = pf - pa;
  const pdScore = Math.min(Math.max((pd + 15) / 30, 0), 1);
  const power = winPct * 0.35 + last10Pct * 0.35 + pdScore * 0.3;
  return { wins, losses, last10Pct, pf, pa, pd, power };
}

async function buildPredictions(): Promise<PredictedGame[]> {
  const schedule = await getFullSchedule().catch(() => []);

  // Build form map from finished games
  const teamFinished = new Map<string, { won: boolean; pf: number; pa: number; date: string }[]>();
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      if (!g.gameId.startsWith("002")) continue;
      const dateStr = gd.gameDate.split(" ")[0];
      const [m, d, y] = dateStr.split("/");
      const isoDate = `${y}-${m}-${d}`;
      const homeWon = g.homeTeam.score > g.awayTeam.score;
      const push = (tri: string, won: boolean, pf: number, pa: number) => {
        const arr = teamFinished.get(tri) || [];
        arr.push({ won, pf, pa, date: isoDate });
        teamFinished.set(tri, arr);
      };
      push(g.homeTeam.teamTricode, homeWon, g.homeTeam.score, g.awayTeam.score);
      push(g.awayTeam.teamTricode, !homeWon, g.awayTeam.score, g.homeTeam.score);
    }
  }

  // Find next 7 days of upcoming games
  const today = formatDate(new Date());
  const sevenDaysOut = new Date();
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
  const cutoff = formatDate(sevenDaysOut);

  const predictions: PredictedGame[] = [];
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 1) continue; // Only upcoming
      const dateStr = gd.gameDate.split(" ")[0];
      const [m, d, y] = dateStr.split("/");
      const isoDate = `${y}-${m}-${d}`;
      if (isoDate < today || isoDate > cutoff) continue;

      const homeForm = buildTeamForm(teamFinished, g.homeTeam.teamTricode);
      const awayForm = buildTeamForm(teamFinished, g.awayTeam.teamTricode);

      // Home court advantage: +3 to power proxy
      const homeAdj = homeForm.power + 0.05;
      const awayAdj = awayForm.power;
      const diff = homeAdj - awayAdj;

      const predictedWinner = diff >= 0 ? "home" : "away";
      // Logistic-ish confidence — diff of 0.2 ≈ 75% confident
      const confidence = Math.min(0.95, Math.max(0.51, 0.5 + Math.abs(diff) * 1.2));
      const spread = Math.round((diff * 25 + (diff >= 0 ? 3 : -3)) * 2) / 2;

      predictions.push({ game: g, date: isoDate, homeForm, awayForm, predictedWinner, confidence, spread });
    }
  }

  predictions.sort((a, b) => a.date.localeCompare(b.date));
  return predictions.slice(0, 20); // cap at 20 upcoming games
}

function ConfidenceBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden flex-1 min-w-[80px]">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct * 100}%`, background: color }} />
    </div>
  );
}

function GameRow({ p }: { p: PredictedGame }) {
  const homePicked = p.predictedWinner === "home";
  const winnerForm = homePicked ? p.homeForm : p.awayForm;
  const loserForm = homePicked ? p.awayForm : p.homeForm;
  const winnerTri = homePicked ? p.game.homeTeam.teamTricode : p.game.awayTeam.teamTricode;
  const winnerId = homePicked ? p.game.homeTeam.teamId : p.game.awayTeam.teamId;
  const loserTri = homePicked ? p.game.awayTeam.teamTricode : p.game.homeTeam.teamTricode;
  const loserId = homePicked ? p.game.awayTeam.teamId : p.game.homeTeam.teamId;
  const confColor = p.confidence >= 0.75 ? "#22C55E" : p.confidence >= 0.6 ? "#F59E0B" : "#94A3B8";

  return (
    <Link href={`/game/${p.game.gameId}`} className="glass-tile p-4 group cursor-pointer block">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary">{p.date}</span>
        <span
          className="text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-0.5 rounded-full"
          style={{ background: `${confColor}22`, color: confColor }}
        >
          {Math.round(p.confidence * 100)}% confident
        </span>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        {/* Predicted winner side */}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <Image
            src={`https://cdn.nba.com/logos/nba/${winnerId}/global/L/logo.svg`}
            alt={winnerTri}
            width={48}
            height={48}
            unoptimized
            className="shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-accent-amber">★ Pick</p>
            <p className="text-lg font-bold text-text-primary group-hover:text-accent-amber transition-colors">{winnerTri}</p>
            <p className="text-[10px] font-mono tabular-nums text-text-secondary">
              {winnerForm.wins}-{winnerForm.losses} · L10 {Math.round(winnerForm.last10Pct * 100)}%
            </p>
          </div>
        </div>

        {/* Spread */}
        <div className="flex flex-col items-center px-2 sm:px-4 shrink-0">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary">Spread</p>
          <p className="text-2xl font-light font-mono tabular-nums text-accent-amber leading-none mt-0.5">
            -{Math.abs(p.spread).toFixed(1)}
          </p>
          <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60 mt-0.5">vs {loserTri}</p>
        </div>

        {/* Loser side */}
        <div className="flex-1 flex items-center gap-3 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary">Underdog</p>
            <p className="text-lg font-bold text-text-secondary">{loserTri}</p>
            <p className="text-[10px] font-mono tabular-nums text-text-secondary/70">
              {loserForm.wins}-{loserForm.losses} · L10 {Math.round(loserForm.last10Pct * 100)}%
            </p>
          </div>
          <Image
            src={`https://cdn.nba.com/logos/nba/${loserId}/global/L/logo.svg`}
            alt={loserTri}
            width={48}
            height={48}
            unoptimized
            className="shrink-0 opacity-60"
          />
        </div>
      </div>

      {/* Confidence bar at bottom */}
      <div className="mt-3 pt-3 border-t border-border flex items-center gap-3">
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">Edge</span>
        <ConfidenceBar pct={p.confidence} color={confColor} />
        <ArrowRight size={12} className="text-text-secondary group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
}

export default async function GamePredictorPage() {
  const predictions = await buildPredictions();

  if (predictions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <PageHeader eyebrow="Tool" icon={Sparkles} title="Game Predictor" />
        <EmptyState
          icon={Sparkles}
          title="No upcoming games to predict"
          description="No games scheduled in the next 7 days, or schedule data isn't loaded yet."
          action={{ label: "View today", href: "/" }}
        />
      </div>
    );
  }

  const highConfidence = predictions.filter((p) => p.confidence >= 0.75).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow="Tool"
        icon={Sparkles}
        title="Game Predictor"
        subtitle="Next 7 days of games · winner picks + confidence based on team form"
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="glass-tile p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-amber/15 flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-accent-amber" />
          </div>
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">Predicting</p>
            <p className="text-xl font-light font-mono tabular-nums text-accent-amber leading-none">{predictions.length}</p>
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">games</p>
          </div>
        </div>
        <div className="glass-tile p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center shrink-0">
            <TrendingUp size={16} className="text-success" />
          </div>
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">High confidence</p>
            <p className="text-xl font-light font-mono tabular-nums text-success leading-none">{highConfidence}</p>
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">≥ 75% locks</p>
          </div>
        </div>
        <div className="glass-tile p-3 flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
            <ArrowRight size={16} className="text-accent" />
          </div>
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">Window</p>
            <p className="text-sm font-bold text-text-primary">Next 7 days</p>
            <p className="text-[10px] font-mono text-text-secondary">Auto-refresh hourly</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {predictions.map((p) => <GameRow key={p.game.gameId} p={p} />)}
      </div>

      <div className="glass-tile p-4 mt-6">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2">/ Method</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          Predictions use a power score (overall win % + L10 form + point differential) with a home-court bump
          of +5%. Confidence scales with the power gap between teams. Spread is rounded to 0.5. These are
          computed projections, not betting advice — sports are wonderfully unpredictable.
        </p>
      </div>
    </div>
  );
}
