import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Award, BarChart3, Crown, Flame, History, Trophy } from "lucide-react";
import { getScheduleAge } from "@/lib/api";
import { getRecentNights, type NightPerformer } from "@/lib/best-of-night";
import { gradeColorClass } from "@/lib/game-stats";
import { TEAM_META } from "@/lib/teams";
import { playerHeadshotUrl } from "@/lib/teamUrls";
import { getLocale } from "@/lib/locale";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isZh = locale === "zh";
  return {
    title: isZh ? "今日最佳球员" : "Player of the Night",
    description: isZh
      ? "算法评选的 NBA 今日最佳球员 — 基于 Game Score 的 0-10 评分，最近比赛日的十佳表现、数据线与比赛链接。"
      : "Algorithmic NBA Player of the Night — Game Score graded 0-10, the top performances from the latest completed slate with stat lines and game links.",
  };
}

function statLine(p: NightPerformer): string {
  const parts = [`${p.points} PTS`, `${p.rebounds} REB`, `${p.assists} AST`];
  if (p.steals >= 2) parts.push(`${p.steals} STL`);
  if (p.blocks >= 2) parts.push(`${p.blocks} BLK`);
  parts.push(`${p.fieldGoalsMade}-${p.fieldGoalsAttempted} FG`);
  return parts.join(" · ");
}

// ISO date is a calendar day (ET) — format in UTC so it can't roll over.
function nightLabel(iso: string, isZh: boolean): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(isZh ? "zh-CN" : "en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function GameLink({ p, isZh }: { p: NightPerformer; isZh: boolean }) {
  return (
    <Link
      href={`/game/${p.gameId}`}
      className="font-mono tabular-nums text-text-secondary hover:text-accent transition-colors cursor-pointer"
    >
      <span className={`font-bold ${p.won ? "text-success" : "text-danger"}`}>
        {p.won ? (isZh ? "胜" : "W") : isZh ? "负" : "L"}
      </span>
      <span className="text-text-secondary/40 mx-1.5">·</span>
      {p.teamTricode} {p.teamScore}-{p.oppScore} {p.oppTricode}
    </Link>
  );
}

// Featured #1 card — the night's winner
function HeroCard({ p, isZh }: { p: NightPerformer; isZh: boolean }) {
  const teamColor = TEAM_META[p.teamTricode]?.primaryColor || "#3B82F6";
  return (
    <div className="glass-tile relative overflow-hidden p-5 mb-6">
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${teamColor}55 0%, transparent 70%)` }}
      />
      <div className="relative flex items-center gap-4">
        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-bg-secondary border border-border shrink-0">
          <Image
            src={playerHeadshotUrl(p.personId)}
            alt={p.name}
            width={80}
            height={80}
            unoptimized
            className="w-full h-full object-cover object-top"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Crown size={12} className="text-accent-amber" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent-amber">
              {isZh ? "本日最佳" : "Player of the Night"}
            </span>
          </div>
          <Link
            href={`/player/${p.personId}`}
            className="block w-fit max-w-full truncate text-lg font-bold text-text-primary hover:text-accent transition-colors cursor-pointer"
          >
            {p.name}
          </Link>
          <p className="text-[11px] font-mono tabular-nums text-text-secondary mt-0.5">{statLine(p)}</p>
          <p className="text-[11px] mt-1">
            <GameLink p={p} isZh={isZh} />
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-center gap-1">
          <span
            className={`px-3 py-2 rounded-xl font-mono font-bold tabular-nums text-2xl ${gradeColorClass(p.grade)}`}
          >
            {p.grade.toFixed(1)}
          </span>
          <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">
            {isZh ? "评分" : "Grade"}
          </span>
        </div>
      </div>
    </div>
  );
}

function PerformerRow({ p, rank, isZh }: { p: NightPerformer; rank: number; isZh: boolean }) {
  const teamColor = TEAM_META[p.teamTricode]?.primaryColor || "#3B82F6";
  return (
    <div className="glass-tile relative overflow-hidden flex items-center gap-3 p-3">
      <div className="absolute inset-y-0 left-0 w-1 opacity-70" style={{ background: teamColor }} />
      <span className="w-6 text-center font-mono tabular-nums text-sm text-text-secondary shrink-0">{rank}</span>
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-bg-secondary border border-border shrink-0">
        <Image
          src={playerHeadshotUrl(p.personId, "260x190")}
          alt={p.name}
          width={40}
          height={40}
          unoptimized
          className="w-full h-full object-cover object-top"
        />
      </div>
      <div className="flex-1 min-w-0">
        <Link
          href={`/player/${p.personId}`}
          className="block w-fit max-w-full truncate text-sm font-semibold text-text-primary hover:text-accent transition-colors cursor-pointer"
        >
          {p.name}
        </Link>
        <p className="text-[10px] font-mono tabular-nums text-text-secondary truncate">{statLine(p)}</p>
      </div>
      <span className="hidden sm:block text-[11px] shrink-0">
        <GameLink p={p} isZh={isZh} />
      </span>
      <span
        className={`shrink-0 px-2 py-1 rounded-lg font-mono font-bold tabular-nums text-sm ${gradeColorClass(p.grade)}`}
      >
        {p.grade.toFixed(1)}
      </span>
    </div>
  );
}

export default async function BestOfNightPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const nights = await getRecentNights(3, 10).catch(() => []);
  const [main, ...previous] = nights;
  const title = isZh ? "今日最佳球员" : "Player of the Night";

  if (!main || main.performers.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Breadcrumbs items={[{ label: title }]} />
        <PageHeader
          eyebrow={isZh ? "联盟" : "League"}
          icon={Crown}
          title={title}
          subtitle={isZh ? "每个比赛日的算法十佳表现" : "Algorithmic top performances for each game day"}
        />
        <EmptyState
          icon={Crown}
          title={isZh ? "暂无已完赛的比赛日" : "No completed game day yet"}
          description={
            isZh
              ? "最近 7 天内没有全部完赛的比赛日。等今晚的比赛打完再来看看。"
              : "No fully finished slate in the last 7 days. Check back once tonight's games wrap up."
          }
        />
      </div>
    );
  }

  const prevNights = previous.filter((n) => n.performers.length > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ label: title }]} />
      <PageHeader
        eyebrow={isZh ? "联盟" : "League"}
        icon={Crown}
        title={title}
        subtitle={
          isZh
            ? `${nightLabel(main.date, true)} · ${main.gamesCount} 场完赛的算法十佳`
            : `${nightLabel(main.date, false)} — algorithmic top 10 across ${main.gamesCount} final${main.gamesCount === 1 ? "" : "s"}`
        }
        updatedAt={getScheduleAge()}
      />

      <HeroCard p={main.performers[0]} isZh={isZh} />

      {main.performers.length > 1 && (
        <div className="space-y-2">
          {main.performers.slice(1).map((p, i) => (
            <PerformerRow key={`${p.gameId}-${p.personId}`} p={p} rank={i + 2} isZh={isZh} />
          ))}
        </div>
      )}

      <p className="text-[10px] text-text-secondary/70 leading-relaxed mt-4">
        {isZh
          ? "评分将 Game Score 归一化至 0-10：5.0 为普通表现，7.0 为优质首发级表现，9.0 以上为巨星之夜；上场不足 15 分钟的表现向 5.0 回归，平分时获胜方优先。"
          : "Grades normalize Game Score to 0-10: 5.0 is a neutral night, 7.0 a solid starter line, 9.0+ a star night. Stints under 15 minutes regress toward 5.0; grade ties go to the winning side."}
      </p>

      {prevNights.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary flex items-center gap-2">
              <History size={14} className="text-text-secondary" />
              {isZh ? "此前比赛日" : "Previous game days"}
            </h2>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-6">
            {prevNights.map((night) => (
              <div key={night.date}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold text-text-primary tracking-tight">
                    {nightLabel(night.date, isZh)}
                  </h3>
                  <span className="text-[10px] font-mono tabular-nums text-text-secondary">
                    {isZh ? `${night.gamesCount} 场比赛` : `${night.gamesCount} game${night.gamesCount === 1 ? "" : "s"}`}
                  </span>
                </div>
                <div className="space-y-2">
                  {night.performers.slice(0, 3).map((p, i) => (
                    <PerformerRow key={`${p.gameId}-${p.personId}`} p={p} rank={i + 1} isZh={isZh} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/stats", label: isZh ? "数据榜单" : "Stat Leaders", description: isZh ? "联盟球员数据领先者" : "League-wide player leaderboards", icon: BarChart3 },
          { href: "/best-games", label: isZh ? "最佳比赛" : "Best Games", description: isZh ? "本赛季最精彩对决" : "Season highlights and standout matchups", icon: Flame },
          { href: "/awards-race", label: isZh ? "奖项竞争" : "Awards Race", description: isZh ? "MVP 与各大奖项追踪" : "MVP and season award tracking", icon: Trophy },
          { href: "/milestones", label: isZh ? "里程碑" : "Milestones", description: isZh ? "球员生涯关注" : "Career watch list", icon: Award },
        ]}
      />
    </div>
  );
}
