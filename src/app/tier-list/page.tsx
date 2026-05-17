import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Layers } from "lucide-react";
import { getFullSchedule } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import { teamLogoUrl } from "@/lib/teamUrls";
import { isRegular } from "@/lib/games";
import { getLocale } from "@/lib/locale";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Team Tier List",
  description: "All 30 NBA teams bucketed by competitive tier — from championship contenders to lottery teams.",
};

export const revalidate = 600;

interface TeamScore {
  tricode: string;
  teamId: number;
  wins: number;
  losses: number;
  winPct: number;
  power: number;
}

async function rankTeams(): Promise<TeamScore[]> {
  const schedule = await getFullSchedule().catch(() => []);

  type Outcome = { date: string; won: boolean; pf: number; pa: number; teamId: number };
  const teamGames = new Map<string, Outcome[]>();
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      if (!isRegular(g.gameId)) continue;
      const dateStr = gd.gameDate.split(" ")[0];
      const [m, d, y] = dateStr.split("/");
      const isoDate = `${y}-${m}-${d}`;
      const homeWon = g.homeTeam.score > g.awayTeam.score;
      const push = (tri: string, won: boolean, pf: number, pa: number, teamId: number) => {
        const arr = teamGames.get(tri) || [];
        arr.push({ date: isoDate, won, pf, pa, teamId });
        teamGames.set(tri, arr);
      };
      push(g.homeTeam.teamTricode, homeWon, g.homeTeam.score, g.awayTeam.score, g.homeTeam.teamId);
      push(g.awayTeam.teamTricode, !homeWon, g.awayTeam.score, g.homeTeam.score, g.awayTeam.teamId);
    }
  }

  const out: TeamScore[] = [];
  for (const [tricode, games] of teamGames) {
    games.sort((a, b) => b.date.localeCompare(a.date));
    const wins = games.filter((g) => g.won).length;
    const losses = games.length - wins;
    const winPct = games.length > 0 ? wins / games.length : 0;
    const last10 = games.slice(0, 10);
    const last10Pct = last10.length > 0 ? last10.filter((g) => g.won).length / last10.length : 0;
    const pd = last10.length > 0 ? last10.reduce((s, g) => s + (g.pf - g.pa), 0) / last10.length : 0;
    const pdScore = Math.min(Math.max((pd + 15) / 30, 0), 1);
    const power = winPct * 0.35 + last10Pct * 0.35 + pdScore * 0.3;
    out.push({ tricode, teamId: games[0].teamId, wins, losses, winPct, power });
  }

  // Add any missing teams as zero
  for (const meta of Object.values(TEAM_META)) {
    if (!out.find((o) => o.tricode === meta.tricode)) {
      out.push({ tricode: meta.tricode, teamId: meta.teamId, wins: 0, losses: 0, winPct: 0, power: 0 });
    }
  }

  out.sort((a, b) => b.power - a.power);
  return out;
}

interface Tier {
  label: string;
  eyebrow: string;
  description: string;
  color: string;
  bgClass: string;
  minPower: number;
}

const TIERS: Tier[] = [
  { label: "Elite", eyebrow: "S Tier", description: "Title favorites · clear championship contenders", color: "#FFD700", bgClass: "bg-[#FFD700]/[0.04]", minPower: 0.62 },
  { label: "Contenders", eyebrow: "A Tier", description: "Real shot at deep playoff runs", color: "#A855F7", bgClass: "bg-[#A855F7]/[0.04]", minPower: 0.52 },
  { label: "Mid", eyebrow: "B Tier", description: "Solid playoff teams · capable of upsets", color: "#3B82F6", bgClass: "bg-accent/[0.04]", minPower: 0.42 },
  { label: "Bubble", eyebrow: "C Tier", description: "Play-in territory · fighting for the 10th seed", color: "#F59E0B", bgClass: "bg-accent-amber/[0.04]", minPower: 0.32 },
  { label: "Lottery", eyebrow: "D Tier", description: "Trending toward the draft lottery", color: "#94A3B8", bgClass: "bg-bg-hover/40", minPower: 0 },
];

const TIER_LABEL_ZH: Record<string, string> = {
  Elite: "顶级",
  Contenders: "争冠",
  Mid: "中游",
  Bubble: "边缘",
  Lottery: "乐透",
};

const TIER_DESC_ZH: Record<string, string> = {
  Elite: "夺冠热门 · 明确的总冠军争夺者",
  Contenders: "有真实的深入季后赛机会",
  Mid: "稳定的季后赛球队 · 能制造冷门",
  Bubble: "附加赛区 · 争夺第10种子",
  Lottery: "正向乐透抽签滑落",
};

function bucketize(teams: TeamScore[]): Map<string, TeamScore[]> {
  const buckets = new Map<string, TeamScore[]>();
  for (const tier of TIERS) buckets.set(tier.label, []);
  for (const team of teams) {
    const tier = TIERS.find((t) => team.power >= t.minPower);
    if (tier) buckets.get(tier.label)!.push(team);
  }
  return buckets;
}

function TeamChip({ team }: { team: TeamScore }) {
  const meta = TEAM_META[team.tricode];
  return (
    <Link
      href={`/team/${team.tricode}`}
      className="flex items-center gap-2 px-3 py-2 glass-tile group cursor-pointer"
    >
      <Image
        src={teamLogoUrl(team.teamId)}
        alt={team.tricode}
        width={28}
        height={28}
        unoptimized
      />
      <div className="min-w-0">
        <p className="text-sm font-bold font-mono text-text-primary group-hover:text-accent transition-colors">
          {team.tricode}
        </p>
        <p className="text-[10px] font-mono tabular-nums text-text-secondary leading-none mt-0.5">
          {team.wins}-{team.losses}
          {meta && <span className="ml-1 text-text-secondary/40">· {meta.conference[0]}</span>}
        </p>
      </div>
    </Link>
  );
}

export default async function TierListPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const teams = await rankTeams();

  if (teams.length === 0 || teams.every((t) => t.power === 0)) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <PageHeader eyebrow={isZh ? "联盟" : "League"} icon={Layers} title={isZh ? "等级表" : "Team Tier List"} />
        <EmptyState
          icon={Layers}
          title={isZh ? "暂无数据" : "No data yet"}
          description={isZh ? "等本赛季产生已结束的比赛后,球队将被分入各档。" : "Teams will be bucketed once the season has produced finished games."}
        />
      </div>
    );
  }

  const buckets = bucketize(teams);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? "联盟" : "League"}
        icon={Layers}
        title={isZh ? "等级表" : "Team Tier List"}
        subtitle={isZh ? "30 支球队按综合战力分分档 · S 到 D" : "All 30 teams bucketed by composite power score · S to D"}
      />

      <div className="space-y-5">
        {TIERS.map((tier) => {
          const tierTeams = buckets.get(tier.label) || [];
          if (tierTeams.length === 0) return null;
          return (
            <section
              key={tier.label}
              className={`glass-tile p-5 ${tier.bgClass} relative overflow-hidden`}
            >
              {/* Tier color side accent */}
              <div className="absolute inset-y-0 left-0 w-1.5 opacity-80" style={{ background: tier.color }} />
              <div className="relative">
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {tier.eyebrow}</p>
                    <h2 className="text-2xl font-semibold tracking-tight" style={{ color: tier.color }}>
                      {isZh ? TIER_LABEL_ZH[tier.label] ?? tier.label : tier.label}
                    </h2>
                    <p className="text-xs text-text-secondary mt-1 max-w-md">{isZh ? TIER_DESC_ZH[tier.label] ?? tier.description : tier.description}</p>
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary tabular-nums">
                    {tierTeams.length} {isZh ? "支球队" : "teams"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {tierTeams.map((t) => <TeamChip key={t.tricode} team={t} />)}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="glass-tile p-4 mt-6">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2">{isZh ? "/ 方法" : "/ Method"}</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          {isZh ? (
            <>
              分档基于战力分: 35% 总胜率 + 35% 近10场状态 + 30% 场均净胜分。门槛:{" "}
              <span className="font-mono tabular-nums">62+ 顶级</span> /
              <span className="font-mono tabular-nums"> 52+ 争冠</span> /
              <span className="font-mono tabular-nums"> 42+ 中游</span> /
              <span className="font-mono tabular-nums"> 32+ 边缘</span> / 以下为乐透。
            </>
          ) : (
            <>
              Tiers are computed from a power score: 35% overall win % + 35% last-10 form + 30% per-game point
              differential. Thresholds: <span className="font-mono tabular-nums">62+ Elite</span> /
              <span className="font-mono tabular-nums"> 52+ Contender</span> /
              <span className="font-mono tabular-nums"> 42+ Mid</span> /
              <span className="font-mono tabular-nums"> 32+ Bubble</span> / below Lottery.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
