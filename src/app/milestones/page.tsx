import { PlayerDirectorySource } from "@/components/PlayerDirectoryContext";
import { milestoneCandidates, findChasing, GP_PER_SEASON, type Threshold, type ChasingMilestone } from "@/lib/milestone-projections";
import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Target, Award, Crown, TrendingUp, Activity } from "lucide-react";
import { getPlayerIndexSnapshot } from "@/lib/api";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";
import { getLocale } from "@/lib/locale";

export const metadata: Metadata = {
  title: "Career Pace Tracker",
  description: "Hypothetical milestone projections from snapshot averages, assuming 70 games per season across the index year span; not actual career totals.",
};

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
          {m.player.teamAbbr} · <span className="tabular-nums">{m.player.seasons}</span> {isZh ? "年跨度" : "year span"}
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
        <p className="text-[9px] font-mono uppercase tracking-[0.1em] text-text-secondary/60 mt-0.5">{isZh ? `约 ${m.gamesNeeded} 场 · ${(m.gamesNeeded / GP_PER_SEASON).toFixed(1)} 个假设赛季` : `~${m.gamesNeeded} games · ${(m.gamesNeeded / GP_PER_SEASON).toFixed(1)} assumed seasons`}</p>
      </div>
    </Link>
  );
}

export default async function MilestonesPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const snapshot = await getPlayerIndexSnapshot().catch(() => null);
  const players = snapshot?.players ?? [];

  if (players.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <PageHeader eyebrow="Players" icon={Trophy} title={isZh ? "生涯轨迹追踪" : "Career Pace Tracker"} />
        <PlayerDirectorySource provenance={snapshot?.provenance ?? null} locale={locale} />
        <EmptyState
          icon={Trophy}
          title={isZh ? "暂无球员数据" : "No player data"}
          description={isZh ? "无法加载球员索引，请稍后再试。" : "Could not load player index. Try again later."}
        />
      </div>
    );
  }

  const candidates = milestoneCandidates(players);
  const hasKnownMetric = candidates.some(p => p.estCareerPoints !== null || p.estCareerRebs !== null || p.estCareerAsts !== null);
  const scoringChase = findChasing(candidates, SCORING_TIERS, (p) => p.estCareerPoints, (p) => p.ppg);
  const reboundChase = findChasing(candidates, REBOUND_TIERS, (p) => p.estCareerRebs, (p) => p.rpg);
  const assistChase = findChasing(candidates, ASSIST_TIERS, (p) => p.estCareerAsts, (p) => p.apg);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow="Players"
        icon={Trophy}
        title={isZh ? "生涯轨迹追踪" : "Career Pace Tracker"}
        subtitle={isZh ? "基于该快照场均的假设投影 · 不是实际生涯累计" : "Hypothetical projections from this snapshot’s averages · not actual career totals"}
      />

      <PlayerDirectorySource provenance={snapshot?.provenance ?? null} locale={locale} />
      <p className="glass-tile p-4 mb-6 text-xs text-text-secondary leading-relaxed">
        {isZh
          ? "模型假设：该快照场均 × 每赛季 70 场 × 索引首末年份跨度。年份跨度不是实际参赛季数；数字不是实际生涯累计或官方纪录。各项仅使用已知场均，展示在相同速度下约 2.5 个假设赛季内可达的最近未达档位。"
          : "Model assumption: this snapshot’s per-game average × 70 games per season × the index’s first-to-last year span. The span is not seasons actually played; these are not actual career totals or official records. Each metric uses its own known average and shows the nearest unmet tier within about 2.5 assumed seasons at the same pace."}
      </p>
      {scoringChase.length + reboundChase.length + assistChase.length === 0 && (
        <EmptyState icon={Trophy}
          title={hasKnownMetric ? (isZh ? "暂无近程投影目标" : "No nearby projected targets") : (isZh ? "暂无可用投影数据" : "No usable projection data")}
          description={hasKnownMetric
            ? (isZh ? "已知场均和有效年份跨度下，没有约 2.5 个假设赛季内可达的未达档位；已知零值不用于计算达标时间。" : "The known averages and valid year spans yield no unmet tier within about 2.5 assumed seasons. Known zero averages do not produce an arrival estimate.")
            : (isZh ? "需要有效的首末年份和至少一项已知场均。缺失数据不作为零值，也不生成投影。" : "A valid first-to-last year span and at least one known average are required. Missing data is not treated as zero or projected.")}
        />
      )}

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
