import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Target, Award, Crown, TrendingUp, Activity } from "lucide-react";
import { getPlayerIndex } from "@/lib/api";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";
import { getLocale } from "@/lib/locale";

export const metadata: Metadata = {
  title: "Career Pace Tracker",
  description: "Career totals projected from recent per-game averages — milestone projections, not official career totals.",
};

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

function MilestoneCard({ m, color, eyebrow, isZh }: { m: ChasingMilestone; color: string; eyebrow: string; isZh: boolean }) {
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
        <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary">{isZh ? "还需" : "Needs"}</p>
        <p className="text-lg font-light font-mono tabular-nums" style={{ color }}>
          {m.needed.toLocaleString()}
        </p>
        <p className="text-[9px] font-mono uppercase tracking-[0.1em] text-text-secondary/60 mt-0.5">{m.pace}</p>
      </div>
    </Link>
  );
}

export default async function MilestonesPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const players = await getPlayerIndex().catch(() => []);

  if (players.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <PageHeader eyebrow="Players" icon={Trophy} title={isZh ? "生涯轨迹追踪" : "Career Pace Tracker"} />
        <EmptyState
          icon={Trophy}
          title={isZh ? "暂无球员数据" : "No player data"}
          description={isZh ? "无法加载球员索引，请稍后再试。" : "Could not load player index. Try again later."}
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
        title={isZh ? "生涯轨迹追踪" : "Career Pace Tracker"}
        subtitle={isZh ? "基于近期场均推算的生涯累计与里程碑投影 · 实际数字会因伤病、场均波动而不同" : "Career totals projected from recent per-game averages · actual numbers shift with injuries and form"}
      />

      {scoringChase.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-accent-amber flex items-center gap-2">
              <Trophy size={14} className="text-accent-amber" />
              {isZh ? "得分里程碑投影" : "Projected scoring milestones"}
            </h2>
            <span className="h-px flex-1 bg-accent-amber/30" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{scoringChase.length} {isZh ? "追逐中" : "chasing"}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {scoringChase.map((m, i) => (
              <MilestoneCard
                key={`s-${i}-${m.player.personId}`}
                m={m}
                color="#FFD700"
                eyebrow={isZh ? `投影至 ${m.threshold.label}` : `Projected toward ${m.threshold.label}`}
                isZh={isZh}
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
              {isZh ? "篮板里程碑投影" : "Projected rebounding milestones"}
            </h2>
            <span className="h-px flex-1 bg-success/30" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{reboundChase.length} {isZh ? "追逐中" : "chasing"}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {reboundChase.map((m, i) => (
              <MilestoneCard
                key={`r-${i}-${m.player.personId}`}
                m={m}
                color="#22C55E"
                eyebrow={isZh ? `投影至 ${m.threshold.label}` : `Projected toward ${m.threshold.label}`}
                isZh={isZh}
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
              {isZh ? "助攻里程碑投影" : "Projected assist milestones"}
            </h2>
            <span className="h-px flex-1 bg-accent/30" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{assistChase.length} {isZh ? "追逐中" : "chasing"}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {assistChase.map((m, i) => (
              <MilestoneCard
                key={`a-${i}-${m.player.personId}`}
                m={m}
                color="#3B82F6"
                eyebrow={isZh ? `投影至 ${m.threshold.label}` : `Projected toward ${m.threshold.label}`}
                isZh={isZh}
              />
            ))}
          </div>
        </section>
      )}

      <div className="glass-tile p-4 mt-2">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2">/ {isZh ? "方法" : "Method"}</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          {isZh
            ? "所有数字均为投影，非官方生涯统计。计算方式：NBA 球员索引中的上赛季场均（得分／篮板／助攻）× ~70 场／赛季 × 出场赛季数。由于使用的是上赛季场均而非各赛季实际数据，结果会因伤病、半赛季、轮休及场均波动而与真实生涯总和不同。展示按当前速度 ~2.5 赛季内能达成下一档的球员。这是观察清单，不是官方纪录册。"
            : "All numbers are projections, not official career totals. Method: last-season per-game averages (pts / reb / ast) from the NBA player index × ~70 games per season × seasons played. Because we use last-season averages rather than each season's actuals, results diverge from real career totals due to injuries, partial seasons, rest, and form. Players within ~2.5 seasons (at current pace) of their next tier are shown. This is a watchlist, not an official record book."}
        </p>
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/all-time-leaders", label: isZh ? "历史榜首" : "All-Time Leaders", description: isZh ? "历史数据领跑者" : "Career stat leaders", icon: Crown },
          { href: "/awards-race", label: isZh ? "奖项竞争" : "Awards Race", description: isZh ? "MVP / ROY / DPOY" : "MVP / ROY / DPOY tracker", icon: Award },
          { href: "/stats", label: isZh ? "联盟数据" : "League Stats", description: isZh ? "完整联盟统计" : "Full league statistics", icon: TrendingUp },
          { href: "/history", label: isZh ? "历史" : "History", description: isZh ? "NBA 历史回顾" : "NBA history archive", icon: Trophy },
          { href: "/rookie-watch", label: isZh ? "新秀榜" : "Rookie Watch", description: isZh ? "本届新秀表现" : "Top rookies this season", icon: Activity },
        ]}
      />
    </div>
  );
}
