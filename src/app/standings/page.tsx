import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ListOrdered } from "lucide-react";
import { getCurrentSeasonSchedule, getRecorded2025SeasonSchedule, getScheduleAge } from "@/lib/api";
import { teamLogoUrl } from "@/lib/teamUrls";
import { RECORDED_TRAJECTORY_SEASON, trajectorySeason, trajectoryCoverage } from "@/lib/trajectory-season";
import { standingsRecordedFinals } from "@/lib/standings-recorded";
import { computeStandingsRows, gamesBehind, type StandingsRow } from "@/lib/standings-splits";
import ExportStandings from "@/components/ExportStandings";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";
import { TrendingUp, Activity, Users, Crown, Award, BarChart3 } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";
import type { Translations } from "@/locales";

type NextPageProps = { searchParams?: Promise<{ [key: string]: string | string[] | undefined }> };

export async function generateMetadata({ searchParams }: NextPageProps): Promise<Metadata> {
  const selection = trajectorySeason((await searchParams)?.season);
  const locale = await getLocale();
  const t = getTranslations(locale);
  return {
    title: `${selection.season} · ${t.meta.standingsTitle}`,
    description: selection.archive
      ? (locale === "zh" ? "2025-26 已记录常规赛排名，按本地终场记录计算，未应用官方同胜率排名规则。" : "2025-26 recorded regular-season standings, computed from local finals without official NBA tiebreakers.")
      : `${selection.season} · ${t.meta.standingsDesc}`,
  };
}

function SeasonSource({ selection, coverage, isZh }: {
  selection: ReturnType<typeof trajectorySeason>;
  coverage: ReturnType<typeof trajectoryCoverage>;
  isZh: boolean;
}) {
  return <section aria-label={isZh ? "赛季与数据来源" : "Season and data source"} className="mb-5 space-y-3">
    <nav aria-label={isZh ? "选择赛季" : "Choose season"} className="flex flex-wrap gap-2">
      <Link href="/standings" prefetch={false} aria-current={!selection.archive ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-accent aria-[current=page]:bg-accent/10 aria-[current=page]:text-accent">
        {selection.current} · {isZh ? "当前赛季" : "Current season"}
      </Link>
      {selection.current !== RECORDED_TRAJECTORY_SEASON && <Link href={`/standings?season=${RECORDED_TRAJECTORY_SEASON}`} prefetch={false} aria-current={selection.archive ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-accent aria-[current=page]:bg-accent/10 aria-[current=page]:text-accent">
        {RECORDED_TRAJECTORY_SEASON} · {isZh ? "已记录赛季" : "Recorded season"}
      </Link>}
    </nav>
    {selection.invalid && <p className="text-sm text-text-secondary">{isZh ? "赛季参数无效或重复，已显示当前赛季。" : "Invalid or repeated season selection; showing the current season."}</p>}
    {selection.archive && <div className="space-y-2 text-sm leading-relaxed text-text-secondary">
      <p className="tabular-nums">{isZh
        ? `${coverage.finals.toLocaleString("en-US")} 场终场记录 · ${coverage.teams} 支球队 · 每队 ${coverage.min === coverage.max ? coverage.max : `${coverage.min}–${coverage.max}`} 场`
        : `${coverage.finals.toLocaleString("en-US")} recorded finals · ${coverage.teams} teams · ${coverage.min === coverage.max ? coverage.max : `${coverage.min}–${coverage.max}`} games per team`}</p>
      <details>
        <summary className="min-h-11 cursor-pointer rounded py-3 focus-visible:outline-2 focus-visible:outline-accent">{isZh ? "数据来源与排名说明" : "Source and standings notes"}</summary>
        <div className="space-y-2 pb-3">
          <p>{isZh ? `${selection.season} · 本地存档中的常规赛终场记录，并非实时或近期核验的数据。仅纳入有效且非平分的终场比分。` : `${selection.season} · Recorded regular-season finals from the local archive, not live or recently verified data. Only valid, non-tied final scores are included.`}</p>
          <p>{isZh ? "按胜率、胜场数、场均净胜分依次排序；这不是官方种子排名，未应用 NBA 官方同胜率排名规则。" : "Sorted by win percentage, then wins, then per-game point differential. This is computed order, not official seeding; official NBA tiebreakers are not applied."}</p>
          <p>{isZh ? "主客场按存档中的指定身份统计，并非实际比赛场馆。每队各侧为 40–42 场，并非固定 41 场。赛区战绩仅统计同赛区对手。" : "Home and road follow recorded designations, not physical venues: 40–42 games on each side per team, not a fixed 41. Division records count opponents in the same division."}</p>
          <p>{isZh ? "得分、失分、净胜均为场均数据；胜率使用实际已记录场次。联盟表的胜场差相对本联盟首位计算，赛区卡片则相对本赛区首位，最低为零。连胜/负表示样本结束时的连续赛果，并非近期状态。" : "PF, PA and Diff are per-game averages; win percentage uses actual recorded games. Conference GB is relative to the conference leader; division-card GB is relative to the division leader. Both are clamped at zero. Streak is the run at the end of this sample, not current form."}</p>
          <p>{isZh ? "球队详情与下方链接显示各自页面的当前数据，不会继承本页的已记录赛季。" : "Team profiles and related links use their own current data; they do not inherit this recorded season."}</p>
        </div>
      </details>
    </div>}
  </section>;
}

const EAST_DIVISIONS = ["Atlantic", "Central", "Southeast"] as const;
const WEST_DIVISIONS = ["Northwest", "Pacific", "Southwest"] as const;

// ".683"-style win pct; an unbeaten team must read "1.000", not ".000".
function fmtPct(pct: number): string {
  return pct >= 1 ? "1.000" : pct.toFixed(3).slice(1);
}

function StreakBadge({ streak, compact }: { streak: string; compact?: boolean }) {
  if (!streak) return <span className="text-text-secondary">-</span>;
  const isWin = streak.startsWith("W");
  return (
    <span className={`${compact ? "text-[11px] sm:text-[9px] px-1" : "text-[11px] px-1.5"} py-0.5 rounded font-medium font-mono tabular-nums ${isWin ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
      {streak}
    </span>
  );
}

function DivisionCard({ division, teams, conferenceRanks, t, archive }: {
  division: string;
  teams: StandingsRow[];
  conferenceRanks: Map<string, number>;
  archive: boolean;
  t: Translations;
}) {
  // Sort by win pct within the division (then wins, then point diff — matches
  // the conference comparator in computeStandingsRows so ties order stably).
  const sorted = [...teams].sort((a, b) => b.pct - a.pct || b.wins - a.wins || b.diff - a.diff);

  const leader = sorted[0];
  const leaderWins = leader?.wins || 0;
  const leaderLosses = leader?.losses || 0;

  return (
    <div className="glass-tile overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-bg-secondary/30">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ Division</p>
        <h3 className="text-sm font-semibold text-text-primary tracking-tight mt-0.5">{division}</h3>
      </div>
      <div className="divide-y divide-border/30">
        {/* Header row — GB column hidden on small screens to free space for the
            team name; brings back below `sm` once viewport can fit it. */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_36px_36px_48px] sm:grid-cols-[auto_1fr_40px_40px_56px_40px] items-center px-4 py-2 text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
          <span className="w-5">#</span>
          <span>{t.common.team}</span>
          <span className="text-center">{t.common.wins}</span>
          <span className="text-center">{t.common.losses}</span>
          <span className="text-center">{t.standingsPage.pct}</span>
          <span className="text-center hidden sm:block">{t.standingsPage.gb}</span>
        </div>
        {sorted.map((team, idx) => {
          const gb = idx === 0 ? "-" : Math.max(0, ((leaderWins - leaderLosses) - (team.wins - team.losses)) / 2).toFixed(1);
          const confRank = conferenceRanks.get(team.tricode) || 99;
          const isPlayoff = !archive && confRank <= 6;
          const isPlayIn = !archive && confRank >= 7 && confRank <= 10;

          return (
            <Link
              key={team.tricode}
              href={`/team/${team.tricode}`}
              className={`grid grid-cols-[auto_minmax(0,1fr)_36px_36px_48px] sm:grid-cols-[auto_1fr_40px_40px_56px_40px] items-center min-h-11 focus-visible:outline-2 focus-visible:outline-accent px-4 py-2.5 hover:bg-bg-hover transition-colors ${
                isPlayoff ? "border-l-2 border-l-accent" : isPlayIn ? "border-l-2 border-l-accent-amber" : "border-l-2 border-l-transparent"
              }`}
            >
              <span className="text-xs text-text-secondary w-5">{idx + 1}</span>
              <div className="flex items-center gap-2.5 min-w-0">
                <Image
                  src={teamLogoUrl(team.teamId)}
                  alt={team.tricode}
                  width={24}
                  height={24}
                  unoptimized
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  {/* Show tricode on phones, full city + name once we have room */}
                  <span className="text-sm font-medium text-text-primary truncate inline sm:hidden">{team.tricode}</span>
                  <span className="text-sm font-medium text-text-primary truncate hidden sm:inline">{team.teamCity} {team.teamName}</span>
                  {isPlayoff && <span className="ml-1.5 text-[11px] sm:text-[9px] px-1 py-0.5 rounded bg-accent/10 text-accent">{t.standingsPage.playoff}</span>}
                  {isPlayIn && <span className="ml-1.5 text-[11px] sm:text-[9px] px-1 py-0.5 rounded bg-accent-amber/10 text-accent-amber">{t.standingsPage.playIn}</span>}
                  {team.streak && <span className="ml-1"><StreakBadge streak={team.streak} compact /></span>}
                </div>
              </div>
              <span className="text-center text-sm font-medium font-mono tabular-nums">{team.wins}</span>
              <span className="text-center text-sm text-text-secondary font-mono tabular-nums">{team.losses}</span>
              <span className="text-center text-sm font-mono tabular-nums">{fmtPct(team.pct)}</span>
              <div className="text-center hidden sm:block">
                <span className="text-xs text-text-secondary font-mono tabular-nums">{gb}</span>
                {idx > 0 && (() => {
                  const gbNum = Math.max(0, ((leaderWins - leaderLosses) - (team.wins - team.losses)) / 2);
                  const maxGb = sorted.length > 1 ? Math.max(0, ((leaderWins - leaderLosses) - (sorted[sorted.length - 1].wins - sorted[sorted.length - 1].losses)) / 2) : 1;
                  const pct = maxGb > 0 ? Math.min((gbNum / maxGb) * 100, 100) : 0;
                  return (
                    <div className="h-1 bg-bg-hover rounded-full overflow-hidden mt-0.5">
                      <div className="h-full bg-danger/40 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  );
                })()}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// Compact native disclosures on phones; retain every metric in the desktop table.
function ConferenceTable({ title, teams, t, isZh, archive }: { title: string; teams: StandingsRow[]; t: Translations; isZh: boolean; archive: boolean }) {
  const leader = teams[0];

  const headers: { key: string; label: string }[] = [
    { key: "w", label: t.common.wins },
    { key: "l", label: t.common.losses },
    { key: "pct", label: t.standingsPage.pct },
    { key: "gb", label: t.standingsPage.gb },
    { key: "home", label: isZh ? "主场" : "Home" },
    { key: "road", label: isZh ? "客场" : "Road" },
    { key: "div", label: isZh ? "赛区" : "Div" },
    { key: "pf", label: isZh ? "得分" : "PF" },
    { key: "pa", label: isZh ? "失分" : "PA" },
    { key: "diff", label: isZh ? "净胜" : "Diff" },
    { key: "strk", label: isZh ? "连胜/负" : "Strk" },
  ];

  return (
    <div className="glass-tile overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-bg-secondary/30 flex items-end justify-between">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ Conference</p>
          <h3 className="text-sm font-semibold text-text-primary tracking-tight mt-0.5">{title}</h3>
        </div>
        {leader && (
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-accent-amber">{!archive && "★ "}{archive ? (isZh ? "最佳记录：" : "Best recorded: ") : t.standingsPage.best}{leader.tricode} <span className="tabular-nums">({leader.wins}-{leader.losses})</span></span>
        )}
      </div>
      <div className="md:hidden divide-y divide-border/50">
        <div aria-hidden="true" className="grid grid-cols-[minmax(0,1fr)_3.5rem_3rem_2.5rem] gap-2 px-3 py-2 text-xs text-text-secondary">
          <span>{t.common.team}</span><span className="text-right">W–L</span><span className="text-right">{t.standingsPage.pct}</span><span className="text-right">{t.standingsPage.gb}</span>
        </div>
        {teams.map((team, i) => (
          <details key={team.tricode} data-team={team.tricode} className="group">
            <summary className="min-h-11 cursor-pointer list-none px-3 py-3 focus-visible:outline-2 focus-visible:outline-accent">
              <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_3rem_2.5rem] items-center gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-4 shrink-0 text-xs tabular-nums text-text-secondary">{i + 1}</span>
                  <span className="min-w-0 text-sm font-semibold break-words leading-snug">{team.teamCity} {team.teamName}<span className="block text-xs font-normal text-text-secondary">{team.tricode} · {isZh ? "详情" : "Details"} <span aria-hidden="true" className="inline-block group-open:rotate-180">⌄</span>{!archive && i < 10 && <span className="ml-1">{i < 6 ? "P" : "PI"}</span>}</span></span>
                </span>
                <span className="text-right text-sm font-mono tabular-nums"><span className="sr-only">{isZh ? "胜负 " : "Wins–losses "}</span>{team.wins}–{team.losses}</span>
                <span className="text-right text-xs font-mono tabular-nums"><span className="sr-only">{t.standingsPage.pct} </span>{fmtPct(team.pct)}</span>
                <span className="text-right text-xs font-mono tabular-nums"><span className="sr-only">{t.standingsPage.gb} </span>{leader ? gamesBehind(leader, team) : "-"}</span>
              </div>
            </summary>
            <div className="px-4 pb-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-bg-secondary/40 p-3 text-sm">
                {[
                  [isZh ? "主场" : "Home", `${team.homeW}-${team.homeL}`],
                  [isZh ? "客场" : "Road", `${team.roadW}-${team.roadL}`],
                  [isZh ? "赛区" : "Division", `${team.divW}-${team.divL}`],
                  [isZh ? "得分（场均）" : "PF / game", team.ppg.toFixed(1)],
                  [isZh ? "失分（场均）" : "PA / game", team.oppg.toFixed(1)],
                  [isZh ? "净胜（场均）" : "Diff / game", `${team.diff > 0 ? "+" : ""}${team.diff.toFixed(1)}`],
                ].map(([label, value]) => <div key={label}><dt className="text-xs text-text-secondary">{label}</dt><dd className="mt-1 font-mono tabular-nums">{value}</dd></div>)}
                <div><dt className="text-xs text-text-secondary">{isZh ? "连胜/负" : "Streak"}</dt><dd className="mt-1"><StreakBadge streak={team.streak} /></dd></div>
              </dl>
              <Link href={`/team/${team.tricode}`} className="mt-2 inline-flex min-h-11 items-center rounded px-2 text-sm text-accent underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent">{team.tricode} · {isZh ? "球队详情" : "Team profile"}</Link>
            </div>
          </details>
        ))}
      </div>
      <div className="hidden md:block overflow-x-auto table-scroll-x">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="border-b border-border text-text-secondary text-[10px] font-mono uppercase tracking-[0.15em]">
              <th className="text-left py-2.5 px-3 sticky left-0 z-10 bg-bg-card min-w-[150px]">{t.common.team}</th>
              {headers.map((h) => (
                <th key={h.key} className="text-center py-2.5 px-2 whitespace-nowrap">{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((team, i) => {
              const gb = leader ? gamesBehind(leader, team) : "-";
              const isPlayoff = !archive && i < 6;
              const isPlayIn = !archive && i >= 6 && i < 10;
              const isTop3 = !archive && i < 3;
              const medalBg = i === 0 ? "bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700]"
                : i === 1 ? "bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0]"
                : i === 2 ? "bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32]"
                : "";
              const diffColor = team.diff > 0 ? "text-success" : team.diff < 0 ? "text-danger" : "text-text-secondary";
              return (
                // Hupu-style cutlines: heavier border under #6 (playoff) and #10 (play-in)
                <tr key={team.tricode} className={`border-b border-border/30 hover:bg-bg-hover transition-colors ${!archive && i === 5 ? "border-b-2 border-b-accent/30" : ""} ${!archive && i === 9 ? "border-b-2 border-b-accent-amber/30" : ""}`}>
                  <td className="py-2 px-3 sticky left-0 z-10 bg-bg-card">
                    <Link href={`/team/${team.tricode}`} className={`flex min-h-11 items-center gap-2 focus-visible:outline-2 focus-visible:outline-accent hover:text-accent transition-colors cursor-pointer ${i >= 10 && team.pct < 0.3 ? "opacity-60" : ""}`}>
                      {isTop3 ? (
                        <span className={`w-6 h-6 shrink-0 inline-flex items-center justify-center rounded-full text-[11px] font-bold font-mono tabular-nums ${medalBg}`}>
                          {i + 1}
                        </span>
                      ) : (
                        <span className="w-6 shrink-0 text-center text-text-secondary text-xs font-mono tabular-nums">{i + 1}</span>
                      )}
                      <Image src={teamLogoUrl(team.teamId)} alt={team.tricode} width={22} height={22} unoptimized />
                      <span className="font-semibold text-text-primary font-mono">{team.tricode}</span>
                      {!archive && i === 0 && <span title={t.standingsPage.confLeader} className="text-[#FFD700]">★</span>}
                      {isPlayoff && i !== 0 && <span className="text-[11px] sm:text-[9px] font-mono uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-accent/15 text-accent">P</span>}
                      {isPlayIn && <span className="text-[11px] sm:text-[9px] font-mono uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-accent-amber/15 text-accent-amber">PI</span>}
                    </Link>
                  </td>
                  <td className="text-center py-2 px-2 font-medium font-mono tabular-nums">{team.wins}</td>
                  <td className="text-center py-2 px-2 text-text-secondary font-mono tabular-nums">{team.losses}</td>
                  <td className="text-center py-2 px-2 font-mono tabular-nums text-xs">{fmtPct(team.pct)}</td>
                  <td className="text-center py-2 px-2 text-text-secondary text-xs font-mono tabular-nums">{gb}</td>
                  <td className="text-center py-2 px-2 text-xs font-mono tabular-nums whitespace-nowrap">{team.homeW}-{team.homeL}</td>
                  <td className="text-center py-2 px-2 text-xs font-mono tabular-nums whitespace-nowrap">{team.roadW}-{team.roadL}</td>
                  <td className="text-center py-2 px-2 text-xs font-mono tabular-nums text-text-secondary whitespace-nowrap">{team.divW}-{team.divL}</td>
                  <td className="text-center py-2 px-2 text-xs font-mono tabular-nums">{team.ppg.toFixed(1)}</td>
                  <td className="text-center py-2 px-2 text-xs font-mono tabular-nums text-text-secondary">{team.oppg.toFixed(1)}</td>
                  <td className={`text-center py-2 px-2 text-xs font-mono tabular-nums font-medium ${diffColor}`}>{team.diff > 0 ? "+" : ""}{team.diff.toFixed(1)}</td>
                  <td className="text-center py-2 px-2"><StreakBadge streak={team.streak} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function StandingsPage({ searchParams }: NextPageProps) {
  const selection = trajectorySeason((await searchParams)?.season);
  const { season, archive } = selection;
  const [schedule, locale] = await Promise.all([
    archive ? standingsRecordedFinals(getRecorded2025SeasonSchedule(), season) : getCurrentSeasonSchedule(season).catch(() => null),
    getLocale(),
  ]);
  const standings = computeStandingsRows(schedule ?? []);
  const t = getTranslations(locale);
  const isZh = locale === "zh";

  const coverage = trajectoryCoverage(schedule ?? []);
  const seasonControls = <SeasonSource selection={selection} coverage={coverage} isZh={isZh} />;
  const subtitle = archive ? (isZh ? "计算排名 · 未应用 NBA 官方同胜率排名规则" : "Computed order · official NBA tiebreakers are not applied") : t.standingsPage.top6Hint;

  const seasonLabel = `${season} · ${isZh ? "常规赛" : "Regular season"}`;

  // Missing usable records do not establish whether the season has started.
  // Preserve a rejected request separately from a resolved empty sample.
  if (standings.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Breadcrumbs items={[{ label: isZh ? "排名" : "Standings" }]} />
        <PageHeader
          eyebrow={seasonLabel}
          icon={ListOrdered}
          title={t.standingsPage.divisionStandings}
          subtitle={subtitle}
        />
        {seasonControls}
        <EmptyState
          icon={ListOrdered}
          tone={schedule === null ? "danger" : "amber"}
          title={schedule === null
            ? (isZh ? "暂时无法加载排名" : "Unable to load standings")
            : (isZh ? "暂无可用排名数据" : "No standings data available")}
          description={schedule === null
            ? (isZh
              ? `未能加载 ${season} 赛季赛程，请稍后重试。`
              : `We couldn't load the schedule for ${season}. Try again later.`)
            : (isZh
              ? `当前没有可用于计算 ${season} 赛季排名的已结束常规赛记录。`
              : `No usable completed regular-season records are available for ${season}.`)
          }
        />
      </div>
    );
  }

  // Compute conference ranks
  const eastTeams = standings.filter((r) => r.conference === "East");
  const westTeams = standings.filter((r) => r.conference === "West");

  const conferenceRanks = new Map<string, number>();
  let eastWins = 0, eastLosses = 0, westWins = 0, westLosses = 0;
  eastTeams.forEach((r, i) => {
    conferenceRanks.set(r.tricode, i + 1);
    eastWins += r.wins;
    eastLosses += r.losses;
  });
  westTeams.forEach((r, i) => {
    conferenceRanks.set(r.tricode, i + 1);
    westWins += r.wins;
    westLosses += r.losses;
  });
  const eastAvgW = eastTeams.length > 0 ? eastWins / eastTeams.length : 0;
  const westAvgW = westTeams.length > 0 ? westWins / westTeams.length : 0;

  // Group by division
  const byDivision = new Map<string, StandingsRow[]>();
  for (const team of standings) {
    if (!byDivision.has(team.division)) byDivision.set(team.division, []);
    byDivision.get(team.division)!.push(team);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ label: isZh ? "排名" : "Standings" }]} />
      <PageHeader
        eyebrow={seasonLabel}
        icon={ListOrdered}
        title={t.standingsPage.divisionStandings}
        subtitle={subtitle}
        updatedAt={archive ? undefined : getScheduleAge()}
        action={<ExportStandings east={eastTeams} west={westTeams} season={season} archive={archive} />}
      />
      {seasonControls}
      {/* Conference comparison */}
      {eastTeams.length > 0 && westTeams.length > 0 && (() => {
        const eastBest = eastTeams[0];
        const westBest = westTeams[0];
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="glass-tile p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-text-secondary uppercase">{t.standingsPage.eastAvgW}</p>
                <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">{eastAvgW.toFixed(1)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-text-secondary">{archive ? (isZh ? "最佳记录" : "Best recorded") : t.standingsPage.best}</p>
                <p className="text-xs font-medium text-text-primary">{eastBest.tricode} ({eastBest.wins}-{eastBest.losses})</p>
              </div>
            </div>
            <div className="glass-tile p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-text-secondary uppercase">{t.standingsPage.westAvgW}</p>
                <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">{westAvgW.toFixed(1)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-text-secondary">{archive ? (isZh ? "最佳记录" : "Best recorded") : t.standingsPage.best}</p>
                <p className="text-xs font-medium text-text-primary">{westBest.tricode} ({westBest.wins}-{westBest.losses})</p>
              </div>
            </div>
          </div>
        );
      })()}
      {!archive && <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary mb-6">
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-accent rounded" /> {t.standingsPage.playoff} (1-6)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-accent-amber rounded" /> {t.standingsPage.playIn} (7-10)</span>
      </div>}

      {/* Full Conference Rankings — Hupu-style one-table-per-conference */}
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-primary flex items-center gap-2">
          <span className="w-1 h-3 bg-accent-amber rounded-full" />
          {t.standingsPage.fullRankings}
        </h2>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="space-y-6 mb-3">
        <ConferenceTable title={t.standingsPage.eastConference} teams={eastTeams} t={t} isZh={isZh} archive={archive} />
        <ConferenceTable title={t.standingsPage.westConference} teams={westTeams} t={t} isZh={isZh} archive={archive} />
      </div>
      <p className="text-[10px] text-text-secondary/70 leading-relaxed mb-10">
        {isZh
          ? "得分 / 失分 / 净胜均为场均数据。排名按胜率排序（胜率相同时按胜场数，再按净胜分），未应用 NBA 官方同胜率排名规则。"
          : "PF / PA / Diff are per-game averages. Teams rank by win pct (then total wins, then point differential); official NBA tiebreakers are not applied."}
      </p>

      {/* Eastern Conference divisions */}
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-primary flex items-center gap-2">
          <span className="w-1 h-3 bg-accent rounded-full" />
          {t.standingsPage.eastConference}
        </h2>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {EAST_DIVISIONS.map((div) => (
          <DivisionCard
            key={div}
            division={div}
            teams={byDivision.get(div) || []}
            archive={archive}
            conferenceRanks={conferenceRanks}
            t={t}
          />
        ))}
      </div>

      {/* Western Conference divisions */}
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-primary flex items-center gap-2">
          <span className="w-1 h-3 bg-accent rounded-full" />
          {t.standingsPage.westConference}
        </h2>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
        {WEST_DIVISIONS.map((div) => (
          <DivisionCard
            key={div}
            division={div}
            teams={byDivision.get(div) || []}
            archive={archive}
            conferenceRanks={conferenceRanks}
            t={t}
          />
        ))}
      </div>

      {/* Feature 4: East vs West Comparison */}
      {eastTeams.length > 0 && westTeams.length > 0 && (() => {
        const total = eastWins + westWins || 1;
        const eastPct = (eastWins / total) * 100;
        return (
          <div className="glass-tile p-4 mb-8">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3">{t.standingsPage.eastVsWest}</h3>
            <div className="flex items-center gap-4 mb-2">
              <span className="text-sm font-bold text-accent">East {eastWins}{t.common.wins}</span>
              <div className="flex-1 h-3 bg-bg-hover rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${eastPct}%` }} />
              </div>
              <span className="text-sm font-bold text-success">West {westWins}{t.common.wins}</span>
            </div>
            <p className="text-[10px] text-text-secondary text-center">
              {eastWins > westWins ? `${t.standingsPage.eastLeads} ${eastWins - westWins} ${t.common.wins}` : westWins > eastWins ? `${t.standingsPage.westLeads} ${westWins - eastWins} ${t.common.wins}` : t.common.tied}
            </p>
            {(() => {
              // Games are double-counted (each appears in 2 teams), so divide by 2.
              const totalGames = (eastWins + eastLosses + westWins + westLosses) / 2;
              const eastTeamCount = eastTeams.length || 15;
              const westTeamCount = westTeams.length || 15;
              const interConferenceGames = Math.round(totalGames - (eastTeamCount * (eastTeamCount - 1)) - (westTeamCount * (westTeamCount - 1)));
              return interConferenceGames > 0 ? (
                <p className="text-[10px] text-text-secondary text-center mt-1">
                  {t.standingsPage.totalGames.replace("%s", String(Math.round(totalGames))).replace("%s", String(eastTeams.length + westTeams.length))}
                </p>
              ) : null;
            })()}
          </div>
        );
      })()}

      <RelatedPages
        eyebrow={archive ? (isZh ? "继续探索 · 以下页面为各自当前数据" : "Keep exploring · current data on other pages") : (isZh ? "继续探索" : "Keep exploring")}
        pages={[
          { href: "/power-rankings", label: locale === "zh" ? "实力榜" : "Power Rankings", description: locale === "zh" ? "综合表现排名" : "Composite team rankings", icon: TrendingUp },
          { href: "/team-stats", label: locale === "zh" ? "球队数据榜" : "Team Stat Rankings", description: locale === "zh" ? "11 项类别 · 30 队全榜" : "11 categories · all 30 teams ranked", icon: BarChart3 },
          { href: "/conference-race", label: locale === "zh" ? "季后赛席位竞争" : "Playoff race", description: archive ? (isZh ? "当前赛季的席位竞争" : "Current-season qualification race") : (isZh ? "1-6 锁定 · 7-10 附加" : "1-6 locked · 7-10 play-in"), icon: Users },
          { href: "/streaks", label: locale === "zh" ? "连胜连败" : "Streaks", description: locale === "zh" ? "近期火热与低迷" : "Hot and cold runs", icon: Activity },
          { href: "/momentum", label: locale === "zh" ? "球队趋势" : "Team momentum", description: locale === "zh" ? "近 5 场 vs 前 10 场" : "Last 5 vs prior 10", icon: Activity },
          { href: "/tier-list", label: locale === "zh" ? "球队分级" : "Tier list", description: locale === "zh" ? "S-D 等级划分" : "S through D buckets", icon: Crown },
          { href: "/awards-race", label: locale === "zh" ? "奖项竞争" : "Awards race", description: "MVP · DPOY · ROY", icon: Award },
        ]}
      />
    </div>
  );
}
