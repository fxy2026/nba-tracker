import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Trophy, Flame, Target, Crown, Award, BookOpen, History } from "lucide-react";
import { getScheduleAge } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import { teamLogoUrl } from "@/lib/teamUrls";
import { finalsResult, seasonRecordExtremes, seasonBestGames, type ExtremeGame, type RecapGame } from "@/lib/season-recap";
import awardsData from "@/data/awards.json";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";

export async function generateMetadata(): Promise<Metadata> {
  const isZh = (await getLocale()) === "zh";
  return {
    title: isZh ? "2025-26 赛季回顾" : "2025-26 Season Recap",
    description: isZh
      ? "2025-26 NBA 赛季回顾：总冠军、总决赛逐场比分、赛季之最与年度最佳比赛。"
      : "A recap of the 2025-26 NBA season — champion, Finals game-by-game, season extremes, and the year's best games.",
  };
}

interface AwardRow {
  season: string;
  player: string;
  team: string;
}

interface AwardEntry {
  key: string;
  en: string;
  zh: string;
  player: string;
  team: string;
}

const AWARD_META = [
  { key: "mvp", en: "MVP", zh: "常规赛 MVP" },
  { key: "fmvp", en: "Finals MVP", zh: "总决赛 MVP" },
  { key: "dpoy", en: "Defensive Player", zh: "最佳防守球员" },
  { key: "roy", en: "Rookie of the Year", zh: "最佳新秀" },
  { key: "smoy", en: "Sixth Man", zh: "最佳第六人" },
  { key: "mip", en: "Most Improved", zh: "进步最快球员" },
] as const;

function isPlaceholder(v: string): boolean {
  const s = v.trim();
  return s === "" || s === "TBD" || s === "-";
}

function ExtremeTile({ game, eyebrow, label, color, badgePrefix = "" }: { game: ExtremeGame | null; eyebrow: string; label: string; color: string; badgePrefix?: string }) {
  if (!game) return null;
  return (
    <Link href={`/game/${game.gameId}`} className="glass-tile p-3 sm:p-4 flex flex-col gap-1.5 group cursor-pointer">
      <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60">/ {eyebrow}</p>
      <span className="text-2xl sm:text-3xl font-light font-mono tabular-nums leading-none" style={{ color }}>{badgePrefix}{game.value}</span>
      <p className="text-[11px] font-medium text-text-primary leading-tight">{label}</p>
      <div className="flex items-center gap-1 text-[10px] font-mono text-text-secondary mt-0.5">
        <span>{game.awayTricode} {game.awayScore}</span>
        <span className="text-text-secondary/40">@</span>
        <span>{game.homeTricode} {game.homeScore}</span>
      </div>
      <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">{game.gameDate}</p>
    </Link>
  );
}

function BestRow({ game, badge, color }: { game: RecapGame; badge: string; color: string }) {
  const homeWon = game.homeScore > game.awayScore;
  return (
    <Link href={`/game/${game.gameId}`} className="glass-tile p-4 flex items-center gap-3 group cursor-pointer">
      <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${color}22`, boxShadow: `inset 0 0 0 1px ${color}55` }}>
        <span className="text-xl font-light font-mono tabular-nums" style={{ color }}>{badge}</span>
      </div>
      <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Image src={teamLogoUrl(game.awayTeamId)} alt={game.awayTricode} width={26} height={26} unoptimized />
          <span className={`text-sm font-bold font-mono ${!homeWon ? "text-text-primary" : "text-text-secondary"}`}>{game.awayTricode}</span>
          <span className="text-base font-light font-mono tabular-nums text-text-secondary">{game.awayScore}</span>
          <span className="text-text-secondary/40">·</span>
          <span className="text-base font-light font-mono tabular-nums text-text-secondary">{game.homeScore}</span>
          <span className={`text-sm font-bold font-mono ${homeWon ? "text-text-primary" : "text-text-secondary"}`}>{game.homeTricode}</span>
          <Image src={teamLogoUrl(game.homeTeamId)} alt={game.homeTricode} width={26} height={26} unoptimized />
        </div>
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary shrink-0">{game.gameDate}</p>
      </div>
    </Link>
  );
}

export default async function SeasonRecapPage() {
  const isZh = (await getLocale()) === "zh";
  const finals = finalsResult();
  const extremes = seasonRecordExtremes();
  const best = seasonBestGames();

  const awardTable = awardsData as Record<string, AwardRow[]>;
  const awards2526 = AWARD_META
    .map((m): AwardEntry | null => {
      const row = (awardTable[m.key] ?? []).find((r) => r.season === "2025-26");
      return row && !isPlaceholder(row.player)
        ? { key: m.key, en: m.en, zh: m.zh, player: row.player, team: row.team }
        : null;
    })
    .filter((a): a is AwardEntry => a !== null);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ label: isZh ? "2025-26 赛季回顾" : "2025-26 Season Recap" }]} />
      <PageHeader
        eyebrow="2025-26"
        icon={Trophy}
        title={isZh ? "赛季回顾" : "Season Recap"}
        subtitle={finals.champion
          ? (isZh ? `${finals.champion} 夺冠 · 总决赛 ${finals.seriesText} 击败 ${finals.runnerUp}` : `${finals.champion} — ${finals.seriesText} in the Finals over the ${finals.runnerUp}`)
          : undefined}
        updatedAt={getScheduleAge()}
      />

      {finals.games.length > 0 && (
        <section className="glass-tile p-5 sm:p-6 mb-8 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-accent-amber opacity-80" />
          <div className="relative flex items-center gap-4">
            <Image src={teamLogoUrl(finals.championTeamId)} alt={finals.championTricode} width={64} height={64} unoptimized className="shrink-0" />
            <div>
              <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-accent-amber">{isZh ? "总冠军" : "Champion"}</p>
              <h2 className="text-xl font-semibold text-text-primary tracking-tight">{finals.champion}</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                {isZh ? `总决赛 ${finals.seriesText} 击败 ${finals.runnerUp}` : `${finals.seriesText} in the Finals over the ${finals.runnerUp}`}
              </p>
            </div>
          </div>
          <div className="relative mt-4 grid grid-cols-1 sm:grid-cols-5 gap-2">
            {finals.games.map((g, i) => {
              const champHome = g.homeTricode === finals.championTricode;
              const champScore = champHome ? g.homeScore : g.awayScore;
              const oppScore = champHome ? g.awayScore : g.homeScore;
              const champWon = champScore > oppScore;
              return (
                <Link key={g.gameId} href={`/game/${g.gameId}`} className="glass-tile p-3 text-center group cursor-pointer">
                  <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">{isZh ? `第 ${i + 1} 场` : `Game ${i + 1}`}</p>
                  <p className={`text-lg font-light font-mono tabular-nums mt-1 ${champWon ? "text-accent-amber" : "text-text-secondary"}`}>{champScore}-{oppScore}</p>
                  <p className="text-[10px] font-mono text-text-secondary">{champWon ? (isZh ? "胜" : "W") : (isZh ? "负" : "L")} · {g.gameDate.slice(5)}</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-8">
        <div className="mb-4">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "赛季之最" : "Season Extremes"}</p>
          <h2 className="text-base font-semibold text-text-primary tracking-tight mt-1">{isZh ? "单场纪录" : "Single-Game Records"}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ExtremeTile game={extremes.highestTeamScore} eyebrow={isZh ? "顶级得分" : "Top Score"} label={isZh ? "球队单场最高得分" : "Highest team score"} color="#FFD700" />
          <ExtremeTile game={extremes.highestCombined} eyebrow={isZh ? "对攻战" : "Shootout"} label={isZh ? "两队总得分最高" : "Highest combined"} color="#22C55E" />
          <ExtremeTile game={extremes.largestMargin} eyebrow={isZh ? "屠杀" : "Beatdown"} label={isZh ? "最大分差" : "Largest margin"} color="#F59E0B" badgePrefix="+" />
          <ExtremeTile game={extremes.lowestTeamScore} eyebrow={isZh ? "冷夜" : "Cold Night"} label={isZh ? "球队单场最低得分" : "Lowest team score"} color="#94A3B8" />
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "年度最佳" : "Best of the Year"}</p>
          <h2 className="text-base font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-1">
            <Target size={16} className="text-danger" />
            {isZh ? "最焦灼的比赛" : "Closest Games"}
          </h2>
        </div>
        <div className="space-y-2">
          {best.closest.map((g) => (
            <BestRow key={g.gameId} game={g} badge={`+${g.margin}`} color="#DF1B41" />
          ))}
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-text-primary tracking-tight flex items-center gap-2">
            <Flame size={16} className="text-success" />
            {isZh ? "最高得分之战" : "Highest-Scoring Games"}
          </h2>
        </div>
        <div className="space-y-2">
          {best.highestScoring.map((g) => (
            <BestRow key={g.gameId} game={g} badge={String(g.total)} color="#22C55E" />
          ))}
        </div>
      </section>

      {awards2526.length > 0 && (
        <section className="mb-8">
          <div className="mb-4">
            <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "年度奖项" : "Season Awards"}</p>
            <h2 className="text-base font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-1">
              <Award size={16} className="text-accent" />
              {isZh ? "个人奖项" : "Individual Hardware"}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {awards2526.map((a) => (
              <div key={a.key} className="glass-tile p-3">
                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">{isZh ? a.zh : a.en}</p>
                <p className="text-sm font-semibold text-text-primary mt-1">{a.player}</p>
                {a.team !== "-" && <p className="text-[10px] font-mono text-text-secondary">{a.team}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/history", label: isZh ? "历届冠军" : "NBA Champions", description: isZh ? "历届总冠军与总决赛" : "Past champions and Finals", icon: History },
          { href: "/records", label: isZh ? "赛季纪录" : "Season Records", description: isZh ? "单场最高与最低" : "Single-game highs and lows", icon: BookOpen },
          { href: "/all-time-leaders", label: isZh ? "历史排行" : "All-Time Leaders", description: isZh ? "生涯数据领跑者" : "Career stat leaders", icon: Crown },
          { href: "/best-games", label: isZh ? "最佳比赛" : "Best Games", description: isZh ? "本赛季精彩对决" : "Top games of the season", icon: Flame },
        ]}
      />
    </div>
  );
}
