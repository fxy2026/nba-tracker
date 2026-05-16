import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Target, Award } from "lucide-react";
import { getPlayerIndex } from "@/lib/api";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Career Milestones",
  description: "Players approaching career scoring, rebounding, and assist milestones — estimated from per-game averages.",
};

export const revalidate = 600;

interface MilestoneCandidate {
  personId: number;
  firstName: string;
  lastName: string;
  teamAbbr: string;
  estCareerPoints: number;
  estCareerRebs: number;
  estCareerAsts: number;
  ppg: number;
  rpg: number;
  apg: number;
  seasons: number;
}

const GP_PER_SEASON = 70; // estimate

interface Threshold {
  value: number;
  label: string;
}

const SCORING_TIERS: Threshold[] = [
  { value: 30000, label: "30,000 pts" },
  { value: 25000, label: "25,000 pts" },
  { value: 20000, label: "20,000 pts" },
  { value: 15000, label: "15,000 pts" },
  { value: 10000, label: "10,000 pts" },
];

const REBOUND_TIERS: Threshold[] = [
  { value: 15000, label: "15,000 reb" },
  { value: 12000, label: "12,000 reb" },
  { value: 10000, label: "10,000 reb" },
  { value: 8000, label: "8,000 reb" },
];

const ASSIST_TIERS: Threshold[] = [
  { value: 12000, label: "12,000 ast" },
  { value: 10000, label: "10,000 ast" },
  { value: 8000, label: "8,000 ast" },
  { value: 6000, label: "6,000 ast" },
];

interface ChasingMilestone {
  player: MilestoneCandidate;
  current: number;
  threshold: Threshold;
  needed: number;
  pace: string; // estimated games until reached
}

function findChasing(players: MilestoneCandidate[], tiers: Threshold[], current: (p: MilestoneCandidate) => number, perGame: (p: MilestoneCandidate) => number): ChasingMilestone[] {
  const out: ChasingMilestone[] = [];
  for (const p of players) {
    const cur = current(p);
    // Find the next tier the player is below but within reasonable reach (within next 2 seasons at current pace)
    for (const tier of tiers) {
      if (cur < tier.value) {
        const needed = tier.value - cur;
        const pg = perGame(p);
        if (pg < 0.5) continue;
        const gamesNeeded = needed / pg;
        if (gamesNeeded > GP_PER_SEASON * 2.5) continue;
        const seasonsLeft = (gamesNeeded / GP_PER_SEASON).toFixed(1);
        const pace = `~${Math.round(gamesNeeded)} gp · ${seasonsLeft} seasons`;
        out.push({ player: p, current: cur, threshold: tier, needed, pace });
        break; // only show closest tier per player
      }
    }
  }
  out.sort((a, b) => a.needed - b.needed);
  return out.slice(0, 12);
}

function MilestoneCard({ m, color, eyebrow }: { m: ChasingMilestone; color: string; eyebrow: string }) {
  const pct = m.threshold.value > 0 ? Math.min((m.current / m.threshold.value) * 100, 100) : 0;
  return (
    <Link
      href={`/player/${m.player.personId}`}
      className="glass-tile p-4 group cursor-pointer flex items-center gap-3 relative overflow-hidden"
    >
      {/* Side color accent */}
      <div className="absolute inset-y-0 left-0 w-1 opacity-70" style={{ background: color }} />

      <PlayerHeadshot personId={m.player.personId} name={`${m.player.firstName} ${m.player.lastName}`} size={48} />

      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary">{eyebrow}</p>
        <p className="font-bold text-text-primary group-hover:text-accent transition-colors truncate">
          {m.player.firstName} {m.player.lastName}
        </p>
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
          {m.player.teamAbbr} · <span className="tabular-nums">{m.player.seasons}</span> seasons
        </p>

        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-bg-hover rounded-full overflow-hidden max-w-[200px]">
            <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
          </div>
          <span className="text-[10px] font-mono tabular-nums text-text-secondary">{pct.toFixed(0)}%</span>
        </div>
      </div>

      <div className="hidden sm:flex flex-col items-end shrink-0 text-right">
        <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary">Needs</p>
        <p className="text-lg font-light font-mono tabular-nums" style={{ color }}>
          {m.needed.toLocaleString()}
        </p>
        <p className="text-[9px] font-mono uppercase tracking-[0.1em] text-text-secondary/60 mt-0.5">{m.pace}</p>
      </div>
    </Link>
  );
}

export default async function MilestonesPage() {
  const players = await getPlayerIndex().catch(() => []);

  if (players.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <PageHeader eyebrow="Players" icon={Trophy} title="Career Milestones" />
        <EmptyState
          icon={Trophy}
          title="No player data"
          description="Could not load player index. Try again later."
        />
      </div>
    );
  }

  const candidates: MilestoneCandidate[] = players
    .filter((p) => p.fromYear && p.toYear && p.pts > 0)
    .map((p) => {
      const seasons = Math.max(1, parseInt(p.toYear) - parseInt(p.fromYear) + 1);
      return {
        personId: p.personId,
        firstName: p.firstName,
        lastName: p.lastName,
        teamAbbr: p.teamAbbr,
        seasons,
        ppg: p.pts,
        rpg: p.reb,
        apg: p.ast,
        estCareerPoints: Math.round(p.pts * GP_PER_SEASON * seasons),
        estCareerRebs: Math.round(p.reb * GP_PER_SEASON * seasons),
        estCareerAsts: Math.round(p.ast * GP_PER_SEASON * seasons),
      };
    });

  const scoringChase = findChasing(candidates, SCORING_TIERS, (p) => p.estCareerPoints, (p) => p.ppg);
  const reboundChase = findChasing(candidates, REBOUND_TIERS, (p) => p.estCareerRebs, (p) => p.rpg);
  const assistChase = findChasing(candidates, ASSIST_TIERS, (p) => p.estCareerAsts, (p) => p.apg);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow="Players"
        icon={Trophy}
        title="Career Milestones"
        subtitle="Active players approaching historic thresholds · estimated from per-game averages × ~70 GP/season"
      />

      {scoringChase.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-accent-amber flex items-center gap-2">
              <Trophy size={14} className="text-accent-amber" />
              Scoring milestones
            </h2>
            <span className="h-px flex-1 bg-accent-amber/30" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{scoringChase.length} chasing</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {scoringChase.map((m, i) => (
              <MilestoneCard
                key={`s-${i}-${m.player.personId}`}
                m={m}
                color="#FFD700"
                eyebrow={`Toward ${m.threshold.label}`}
              />
            ))}
          </div>
        </section>
      )}

      {reboundChase.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-success flex items-center gap-2">
              <Target size={14} className="text-success" />
              Rebounding milestones
            </h2>
            <span className="h-px flex-1 bg-success/30" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{reboundChase.length} chasing</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {reboundChase.map((m, i) => (
              <MilestoneCard
                key={`r-${i}-${m.player.personId}`}
                m={m}
                color="#22C55E"
                eyebrow={`Toward ${m.threshold.label}`}
              />
            ))}
          </div>
        </section>
      )}

      {assistChase.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-accent flex items-center gap-2">
              <Award size={14} className="text-accent" />
              Assist milestones
            </h2>
            <span className="h-px flex-1 bg-accent/30" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{assistChase.length} chasing</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {assistChase.map((m, i) => (
              <MilestoneCard
                key={`a-${i}-${m.player.personId}`}
                m={m}
                color="#3B82F6"
                eyebrow={`Toward ${m.threshold.label}`}
              />
            ))}
          </div>
        </section>
      )}

      <div className="glass-tile p-4 mt-2">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2">/ Method</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          Career totals are estimated: per-game average × ~70 games per season × seasons played. Real career totals
          may differ due to injuries, partial seasons, and rest. Players within ~2.5 seasons (at current pace) of
          their next tier are shown. This is a watchlist, not an official record book.
        </p>
      </div>
    </div>
  );
}
