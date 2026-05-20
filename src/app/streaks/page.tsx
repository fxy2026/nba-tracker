import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Flame, Snowflake, TrendingDown, TrendingUp, Crown, Target, Layers } from "lucide-react";
import { getFullSchedule, getScheduleAge } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import { teamLogoUrl } from "@/lib/teamUrls";
import { isRegular, isPlayoff } from "@/lib/games";
import { getLocale } from "@/lib/locale";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";

export const metadata: Metadata = {
  title: "Streaks",
  description: "Hot and cold teams across the NBA — current win/loss streaks with last-10 visualization.",
};

export const revalidate = 600;

interface TeamStreak {
  tricode: string;
  teamId: number;
  current: { type: "W" | "L"; count: number };
  last10: boolean[]; // most recent first, true = win
  ptsFor: number;
  ptsAgainst: number;
  gamesAnalyzed: number;
}

async function computeStreaks(): Promise<TeamStreak[]> {
  const schedule = await getFullSchedule().catch(() => []);

  // Collect chronological finished games per team (most recent first)
  type GameOutcome = { date: string; won: boolean; ptsFor: number; ptsAgainst: number; teamId: number };
  const teamGames = new Map<string, GameOutcome[]>();

  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      // Regular season (002) + playoffs (004) only — skip preseason (001) which
      // includes exhibition games vs international teams (Melbourne, Guangzhou, etc).
      if (!isRegular(g.gameId) && !isPlayoff(g.gameId)) continue;
      const dateStr = gd.gameDate.split(" ")[0];
      const [month, day, year] = dateStr.split("/");
      const isoDate = `${year}-${month}-${day}`;

      const home = g.homeTeam;
      const away = g.awayTeam;
      const homeWon = home.score > away.score;

      const pushOutcome = (tri: string, won: boolean, pf: number, pa: number, teamId: number) => {
        const arr = teamGames.get(tri) || [];
        arr.push({ date: isoDate, won, ptsFor: pf, ptsAgainst: pa, teamId });
        teamGames.set(tri, arr);
      };

      pushOutcome(home.teamTricode, homeWon, home.score, away.score, home.teamId);
      pushOutcome(away.teamTricode, !homeWon, away.score, home.score, away.teamId);
    }
  }

  const streaks: TeamStreak[] = [];
  for (const [tricode, games] of teamGames) {
    if (games.length === 0) continue;
    // Sort most-recent first
    games.sort((a, b) => b.date.localeCompare(a.date));
    const last10 = games.slice(0, 10).map((g) => g.won);
    const teamId = games[0].teamId;

    // Current streak
    const firstWon = games[0].won;
    let count = 0;
    for (const g of games) {
      if (g.won === firstWon) count++;
      else break;
    }

    const ptsFor = games.slice(0, 10).reduce((s, g) => s + g.ptsFor, 0);
    const ptsAgainst = games.slice(0, 10).reduce((s, g) => s + g.ptsAgainst, 0);

    streaks.push({
      tricode,
      teamId,
      current: { type: firstWon ? "W" : "L", count },
      last10,
      ptsFor,
      ptsAgainst,
      gamesAnalyzed: Math.min(games.length, 10),
    });
  }

  return streaks;
}

function StreakDots({ results }: { results: boolean[] }) {
  return (
    <div className="flex items-center gap-1">
      {results.map((won, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${won ? "bg-success" : "bg-danger"}`}
          title={won ? "Win" : "Loss"}
        />
      ))}
      {/* Pad to 10 with neutral dots if fewer */}
      {Array.from({ length: Math.max(0, 10 - results.length) }).map((_, i) => (
        <span key={`pad-${i}`} className="w-2 h-2 rounded-full bg-bg-hover" />
      ))}
    </div>
  );
}

function TeamRow({ s }: { s: TeamStreak }) {
  const meta = TEAM_META[s.tricode];
  const teamColor = meta?.primaryColor || "#3B82F6";
  const isHot = s.current.type === "W" && s.current.count >= 3;
  const isCold = s.current.type === "L" && s.current.count >= 3;
  const w10 = s.last10.filter((x) => x).length;
  const l10 = s.last10.length - w10;
  const netRtg = s.gamesAnalyzed > 0 ? (s.ptsFor - s.ptsAgainst) / s.gamesAnalyzed : 0;

  return (
    <Link
      href={`/team/${s.tricode}`}
      className="glass-tile flex items-center gap-4 p-4 cursor-pointer group relative overflow-hidden"
    >
      {/* Team color side accent */}
      <div
        className="absolute inset-y-0 left-0 w-1 opacity-70"
        style={{ background: teamColor }}
      />
      {/* Streak badge */}
      <div
        className={`shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-mono tabular-nums ${
          isHot
            ? "bg-accent-amber/15 ring-1 ring-accent-amber/50 text-accent-amber"
            : isCold
            ? "bg-danger/15 ring-1 ring-danger/50 text-danger"
            : "bg-bg-hover/60 ring-1 ring-border text-text-secondary"
        }`}
      >
        <span className="text-2xl font-light leading-none">{s.current.count}</span>
        <span className="text-[9px] uppercase tracking-[0.2em] mt-0.5">{s.current.type}</span>
      </div>

      {/* Team logo + meta */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Image
          src={teamLogoUrl(s.teamId)}
          alt={s.tricode}
          width={36}
          height={36}
          unoptimized
        />
        <div className="min-w-0">
          <p className="font-bold text-text-primary group-hover:text-accent transition-colors">
            {meta ? `${meta.city} ${meta.name}` : s.tricode}
          </p>
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
            {meta?.tricode} · {meta?.conference}
          </p>
        </div>
      </div>

      {/* Last 10 dots + numbers */}
      <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0">
        <StreakDots results={s.last10} />
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
          L10 · <span className="text-success font-bold tabular-nums">{w10}</span>
          <span className="text-text-secondary/40 mx-0.5">-</span>
          <span className="text-danger font-bold tabular-nums">{l10}</span>
        </p>
      </div>

      {/* Net rating */}
      <div className="hidden sm:flex flex-col items-end shrink-0 w-20">
        <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">Net</p>
        <p
          className={`text-lg font-light font-mono tabular-nums ${
            netRtg > 0 ? "text-success" : netRtg < 0 ? "text-danger" : "text-text-secondary"
          }`}
        >
          {netRtg > 0 ? "+" : ""}
          {netRtg.toFixed(1)}
        </p>
      </div>
    </Link>
  );
}

export default async function StreaksPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const streaks = await computeStreaks();

  if (streaks.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Breadcrumbs items={[{ label: isZh ? "连胜连败" : "Streaks" }]} />
        <PageHeader
          eyebrow={isZh ? "联盟" : "League"}
          icon={Flame}
          title={isZh ? "连胜连败" : "Streaks"}
          subtitle={isZh ? "全联盟最热与最冷的球队" : "Hot and cold teams across the NBA"}
        />
        <EmptyState
          icon={Flame}
          title={isZh ? "暂无连胜数据" : "No streak data yet"}
          description={isZh ? "连胜分析需要本赛季已结束的若干场比赛。" : "Streak analysis needs at least a handful of finished games for the season."}
        />
      </div>
    );
  }

  // Split into hot (current W streak >= 2) and cold (current L streak >= 2), sorted by streak length
  const hot = streaks
    .filter((s) => s.current.type === "W" && s.current.count >= 2)
    .sort((a, b) => b.current.count - a.current.count);
  const cold = streaks
    .filter((s) => s.current.type === "L" && s.current.count >= 2)
    .sort((a, b) => b.current.count - a.current.count);

  // Insight cards
  const hottest = hot[0];
  const coldest = cold[0];
  const longestStreak = streaks.reduce((max, s) => (s.current.count > max.current.count ? s : max), streaks[0]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ label: isZh ? "连胜连败" : "Streaks" }]} />
      <PageHeader
        eyebrow={isZh ? "联盟" : "League"}
        icon={Flame}
        title={isZh ? "连胜连败" : "Streaks"}
        subtitle={isZh ? "全联盟最热与最冷的球队" : "Hot and cold teams across the NBA"}
        updatedAt={getScheduleAge()}
      />

      {/* Insight strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {hottest && (
          <div className="glass-tile p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-amber/15 flex items-center justify-center shrink-0">
              <Flame size={18} className="text-accent-amber" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">{isZh ? "最火热" : "Hottest"}</p>
              <p className="text-sm font-bold text-text-primary">{TEAM_META[hottest.tricode]?.city} {TEAM_META[hottest.tricode]?.name}</p>
              <p className="text-[10px] font-mono tabular-nums text-accent-amber">{hottest.current.count} {hottest.current.type} in a row</p>
            </div>
          </div>
        )}
        {coldest && (
          <div className="glass-tile p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-danger/15 flex items-center justify-center shrink-0">
              <Snowflake size={18} className="text-danger" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">{isZh ? "最低迷" : "Coldest"}</p>
              <p className="text-sm font-bold text-text-primary">{TEAM_META[coldest.tricode]?.city} {TEAM_META[coldest.tricode]?.name}</p>
              <p className="text-[10px] font-mono tabular-nums text-danger">{coldest.current.count} {coldest.current.type} in a row</p>
            </div>
          </div>
        )}
        {longestStreak && (
          <div className="glass-tile p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">{isZh ? "最长连续" : "Longest run"}</p>
              <p className="text-sm font-bold text-text-primary">{TEAM_META[longestStreak.tricode]?.tricode}</p>
              <p className="text-[10px] font-mono tabular-nums text-accent">{longestStreak.current.count} {longestStreak.current.type} streak</p>
            </div>
          </div>
        )}
      </div>

      {/* Hot teams */}
      {hot.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-accent-amber flex items-center gap-2">
              <Flame size={14} className="text-accent-amber" />
              {isZh ? "热门 · 当前连胜" : "Hot · Currently winning"}
            </h2>
            <span className="h-px flex-1 bg-accent-amber/30" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{hot.length} teams</span>
          </div>
          <div className="space-y-2">
            {hot.map((s) => (
              <TeamRow key={s.tricode} s={s} />
            ))}
          </div>
        </section>
      )}

      {/* Cold teams */}
      {cold.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-danger flex items-center gap-2">
              <TrendingDown size={14} className="text-danger" />
              {isZh ? "低迷 · 当前连败" : "Cold · Currently losing"}
            </h2>
            <span className="h-px flex-1 bg-danger/30" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{cold.length} teams</span>
          </div>
          <div className="space-y-2">
            {cold.map((s) => (
              <TeamRow key={s.tricode} s={s} />
            ))}
          </div>
        </section>
      )}

      {hot.length === 0 && cold.length === 0 && (
        <EmptyState
          icon={Flame}
          title={isZh ? "暂无活跃连胜" : "No active streaks"}
          description={isZh ? "目前没有球队保持多场连胜。下一轮比赛后再来看看。" : "No teams currently riding multi-game streaks. Check back after the next slate."}
        />
      )}

      <RelatedPages
        pages={[
          { href: "/momentum", label: "Momentum", description: "L5 vs prior 10 win % trends", icon: TrendingUp },
          { href: "/power-rankings", label: "Power Rankings", description: "Composite team strength 1-30", icon: Crown },
          { href: "/clutch-teams", label: "Clutch Teams", description: "Close-game and OT records", icon: Target },
          { href: "/tier-list", label: "Tier List", description: "Bucketed S/A/B/C/D", icon: Layers },
        ]}
      />
    </div>
  );
}
