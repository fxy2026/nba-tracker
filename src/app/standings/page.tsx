import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ListOrdered } from "lucide-react";
import { getFullSchedule, getScheduleAge } from "@/lib/api";
import { teamLogoUrl } from "@/lib/teamUrls";
import { computeStandingsRows, gamesBehind, type StandingsRow } from "@/lib/standings-splits";
import ExportStandings from "@/components/ExportStandings";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import { TrendingUp, Activity, Users, Crown, Award } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";
import type { Translations } from "@/locales";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getTranslations(locale);
  return {
    title: t.meta.standingsTitle,
    description: t.meta.standingsDesc,
  };
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

function DivisionCard({ division, teams, conferenceRanks, t }: {
  division: string;
  teams: StandingsRow[];
  conferenceRanks: Map<string, number>;
  t: Translations;
}) {
  // Sort by win pct within the division
  const sorted = [...teams].sort((a, b) => b.pct - a.pct || b.wins - a.wins);

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
          const gb = idx === 0 ? "-" : (((leaderWins - leaderLosses) - (team.wins - team.losses)) / 2).toFixed(1);
          const confRank = conferenceRanks.get(team.tricode) || 99;
          const isPlayoff = confRank <= 6;
          const isPlayIn = confRank >= 7 && confRank <= 10;

          return (
            <Link
              key={team.tricode}
              href={`/team/${team.tricode}`}
              className={`grid grid-cols-[auto_minmax(0,1fr)_36px_36px_48px] sm:grid-cols-[auto_1fr_40px_40px_56px_40px] items-center px-4 py-2.5 hover:bg-bg-hover transition-colors ${
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
                  const gbNum = ((leaderWins - leaderLosses) - (team.wins - team.losses)) / 2;
                  const maxGb = sorted.length > 1 ? ((leaderWins - leaderLosses) - (sorted[sorted.length - 1].wins - sorted[sorted.length - 1].losses)) / 2 : 1;
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

// Hupu-style one-row-per-team conference table: 排名 队 胜 负 胜率 胜场差
// 主场 客场 赛区 得分 失分 净胜 连胜/负 — wide, so it horizontally scrolls on
// phones with the team column pinned (sticky pattern from StatsTable).
function ConferenceTable({ title, teams, t, isZh }: { title: string; teams: StandingsRow[]; t: Translations; isZh: boolean }) {
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
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-accent-amber">★ {t.standingsPage.best}{leader.tricode} <span className="tabular-nums">({leader.wins}-{leader.losses})</span></span>
        )}
      </div>
      <div className="overflow-x-auto">
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
              const isPlayoff = i < 6;
              const isPlayIn = i >= 6 && i < 10;
              const isTop3 = i < 3;
              const medalBg = i === 0 ? "bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700]"
                : i === 1 ? "bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0]"
                : i === 2 ? "bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32]"
                : "";
              const diffColor = team.diff > 0 ? "text-success" : team.diff < 0 ? "text-danger" : "text-text-secondary";
              return (
                // Hupu-style cutlines: heavier border under #6 (playoff) and #10 (play-in)
                <tr key={team.tricode} className={`border-b border-border/30 hover:bg-bg-hover transition-colors ${i === 5 ? "border-b-2 border-b-accent/30" : ""} ${i === 9 ? "border-b-2 border-b-accent-amber/30" : ""}`}>
                  <td className="py-2 px-3 sticky left-0 z-10 bg-bg-card">
                    <Link href={`/team/${team.tricode}`} className={`flex items-center gap-2 hover:text-accent transition-colors cursor-pointer ${i >= 10 && team.pct < 0.3 ? "opacity-60" : ""}`}>
                      {isTop3 ? (
                        <span className={`w-6 h-6 shrink-0 inline-flex items-center justify-center rounded-full text-[11px] font-bold font-mono tabular-nums ${medalBg}`}>
                          {i + 1}
                        </span>
                      ) : (
                        <span className="w-6 shrink-0 text-center text-text-secondary text-xs font-mono tabular-nums">{i + 1}</span>
                      )}
                      <Image src={teamLogoUrl(team.teamId)} alt={team.tricode} width={22} height={22} unoptimized />
                      <span className="font-semibold text-text-primary font-mono">{team.tricode}</span>
                      {i === 0 && <span title={t.standingsPage.confLeader} className="text-[#FFD700]">★</span>}
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

export default async function StandingsPage() {
  const [schedule, locale] = await Promise.all([
    getFullSchedule().catch(() => []),
    getLocale(),
  ]);
  const standings = computeStandingsRows(schedule);
  const t = getTranslations(locale);

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

  const isZh = locale === "zh";

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ label: isZh ? "排名" : "Standings" }]} />
      <PageHeader
        eyebrow="League"
        icon={ListOrdered}
        title={t.standingsPage.divisionStandings}
        subtitle={t.standingsPage.top6Hint}
        updatedAt={getScheduleAge()}
        action={<ExportStandings east={eastTeams} west={westTeams} />}
      />
      {/* Conference comparison */}
      {eastTeams.length > 0 && westTeams.length > 0 && (() => {
        const eastBest = eastTeams[0];
        const westBest = westTeams[0];
        return (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="glass-tile p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-text-secondary uppercase">{t.standingsPage.eastAvgW}</p>
                <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">{eastAvgW.toFixed(1)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-text-secondary">{t.standingsPage.best}</p>
                <p className="text-xs font-medium text-text-primary">{eastBest.tricode} ({eastBest.wins}-{eastBest.losses})</p>
              </div>
            </div>
            <div className="glass-tile p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-text-secondary uppercase">{t.standingsPage.westAvgW}</p>
                <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">{westAvgW.toFixed(1)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-text-secondary">{t.standingsPage.best}</p>
                <p className="text-xs font-medium text-text-primary">{westBest.tricode} ({westBest.wins}-{westBest.losses})</p>
              </div>
            </div>
          </div>
        );
      })()}
      <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary mb-6">
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-accent rounded" /> {t.standingsPage.playoff} (1-6)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-accent-amber rounded" /> {t.standingsPage.playIn} (7-10)</span>
      </div>

      {/* Full Conference Rankings — Hupu-style one-table-per-conference */}
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-primary flex items-center gap-2">
          <span className="w-1 h-3 bg-accent-amber rounded-full" />
          {t.standingsPage.fullRankings}
        </h2>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="space-y-6 mb-3">
        <ConferenceTable title={t.standingsPage.eastConference} teams={eastTeams} t={t} isZh={isZh} />
        <ConferenceTable title={t.standingsPage.westConference} teams={westTeams} t={t} isZh={isZh} />
      </div>
      <p className="text-[10px] text-text-secondary/70 leading-relaxed mb-10">
        {isZh
          ? "得分 / 失分 / 净胜均为场均数据。排名先比胜率；胜率相同时依次比相互交手战绩、赛区战绩（同赛区时）、分区战绩与净胜分。"
          : "PF / PA / Diff are per-game averages. Teams rank by win pct; ties break on head-to-head record, division record (same division), conference record, then point differential."}
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
        eyebrow={locale === "zh" ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/power-rankings", label: locale === "zh" ? "实力榜" : "Power Rankings", description: locale === "zh" ? "综合表现排名" : "Composite team rankings", icon: TrendingUp },
          { href: "/conference-race", label: locale === "zh" ? "季后赛席位竞争" : "Playoff race", description: locale === "zh" ? "1-6 锁定 · 7-10 附加" : "1-6 locked · 7-10 play-in", icon: Users },
          { href: "/streaks", label: locale === "zh" ? "连胜连败" : "Streaks", description: locale === "zh" ? "近期火热与低迷" : "Hot and cold runs", icon: Activity },
          { href: "/momentum", label: locale === "zh" ? "球队趋势" : "Team momentum", description: locale === "zh" ? "近 5 场 vs 前 10 场" : "Last 5 vs prior 10", icon: Activity },
          { href: "/tier-list", label: locale === "zh" ? "球队分级" : "Tier list", description: locale === "zh" ? "S-D 等级划分" : "S through D buckets", icon: Crown },
          { href: "/awards-race", label: locale === "zh" ? "奖项竞争" : "Awards race", description: "MVP · DPOY · ROY", icon: Award },
        ]}
      />
    </div>
  );
}
