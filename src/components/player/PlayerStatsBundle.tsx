"use client";

import { careerAggregationRows, type CareerShootingRates } from "@/lib/career-shooting";
import { useState } from "react";
import type { ReactNode } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { usePlayerCareer, type CareerSeasonRow } from "@/lib/usePlayerCareer";
import type { Translations } from "@/locales/types";
import PlayerCareerChart from "@/components/player/PlayerCareerChart";
import PlayerRankBadges from "@/components/player/PlayerRankBadges";

interface Props {
  playerId: number;
  playerName?: string;
  teamTricode?: string;
}

export default function PlayerStatsBundle({ playerId, playerName, teamTricode }: Props) {
  const { t, locale } = useLocale();
  const { data, loading, error, stale, retry } = usePlayerCareer(playerId, playerName ?? "", teamTricode ?? "");
  const seasons = data?.careerSeasons ?? null;

  if (loading && !data) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-bg-secondary/60 rounded-lg skeleton-shimmer" />
        ))}
      </div>
    );
  }

  if (error && !seasons?.length) {
    const encodedName = encodeURIComponent(playerName || "");
    return (
      <div className="bg-bg-secondary/60 rounded-xl p-4 text-center space-y-3">
        <p className="text-sm text-text-secondary">{t.playerStats.detailedUnavailable}</p>
        <p className="text-xs text-text-secondary">{locale === "zh" ? "失败后暂停请求 30 秒，再点重试。" : "After a failed request, wait 30 seconds before retrying."}</p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <a href={`https://www.nba.com/player/${playerId}`} target="_blank" rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 bg-bg-card border border-border rounded-lg hover:border-accent/50 text-text-primary transition-colors">
            {t.playerStats.viewOnNba}
          </a>
          <a href={`https://www.basketball-reference.com/search/search.fcgi?search=${encodedName}`} target="_blank" rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 bg-bg-card border border-border rounded-lg hover:border-accent/50 text-text-primary transition-colors">
            {t.playerStats.basketballRef}
          </a>
          <button onClick={retry} className="text-xs px-3 py-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors">
            {t.common.retry}
          </button>
        </div>
      </div>
    );
  }

  if (!seasons?.length) {
    return <p className="text-sm text-text-secondary p-4">{locale === "zh"
      ? "数据源已响应，但未返回可用的常规赛生涯记录。"
      : "The source responded with no regular-season career records."}</p>;
  }

  return (
    <div className="space-y-6">
      {stale && <div role="status" className="text-xs text-text-secondary">
        {locale === "zh" ? "刷新暂不可用，保留上次成功加载的数据。请在 30 秒后重试。" : "Refresh unavailable. Showing the last successfully loaded data. Retry after 30 seconds."}
        <button onClick={retry} className="ml-2 text-accent">{t.common.retry}</button>
      </div>}
      {/* Current-season league-rank badges (silent-hide when not a leader) */}
      <PlayerRankBadges playerId={playerId} />

      {/* Career Stats — table by default, with an opt-in chart view */}
      <CareerSection careerShooting={data?.careerShooting} seasons={seasons} t={t} isZh={locale === "zh"} />
    </div>
  );
}

// Owns the 表格/图表 view state so the default table render stays untouched.
function CareerSection({ seasons, t, isZh, careerShooting }: { seasons: CareerSeasonRow[]; t: Translations; isZh: boolean; careerShooting?: CareerShootingRates }) {
  const [view, setView] = useState<"table" | "chart">("table");
  const canChart = seasons.length >= 2;

  const toggle = canChart ? (
    <div className="flex items-center gap-0.5 bg-bg-secondary/60 rounded-lg p-0.5">
      {([["table", isZh ? "表格" : "Table"], ["chart", isZh ? "图表" : "Chart"]] as const).map(([k, label]) => (
        <button
          key={k}
          onClick={() => setView(k)}
          aria-pressed={view === k}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
            view === k ? "bg-accent text-white shadow-md" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  ) : null;

  if (view === "chart" && canChart) {
    return <PlayerCareerChart seasons={seasons} headerExtra={toggle} />;
  }
  return <CareerStatsTable isZh={isZh} careerShooting={careerShooting} seasons={seasons} t={t} headerExtra={toggle} />;
}

// Compare current to career average
function CompareArrow({ current, career }: { current: number; career: number }) {
  if (current > career) return <span className="text-success text-[9px] ml-0.5">&#9650;</span>;
  if (current < career) return <span className="text-danger text-[9px] ml-0.5">&#9660;</span>;
  return null;
}

function CareerStatsTable({ seasons, t, headerExtra, careerShooting, isZh }: { seasons: CareerSeasonRow[]; t: Translations; headerExtra?: ReactNode; careerShooting?: CareerShootingRates; isZh: boolean }) {
  // Find best season by PPG
  let bestIdx = 0;
  let bestPts = 0;
  for (let i = 0; i < seasons.length; i++) {
    if (seasons[i].PTS > bestPts) {
      bestPts = seasons[i].PTS;
      bestIdx = i;
    }
  }

  // Compute career averages (weighted by GP)
  let totalGP = 0, totalMIN = 0, totalPTS = 0, totalREB = 0, totalAST = 0;
  let totalSTL = 0, totalBLK = 0;
  const aggregateRows = careerAggregationRows(seasons);

  for (const s of aggregateRows ?? []) {
    totalGP += s.GP;
    totalMIN += s.MIN * s.GP;
    totalPTS += s.PTS * s.GP;
    totalREB += s.REB * s.GP;
    totalAST += s.AST * s.GP;
    totalSTL += s.STL * s.GP;
    totalBLK += s.BLK * s.GP;

  }

  const careerAvg = totalGP > 0 ? {
    GP: totalGP,
    MIN: totalMIN / totalGP,
    PTS: totalPTS / totalGP,
    REB: totalREB / totalGP,
    AST: totalAST / totalGP,
    STL: totalSTL / totalGP,
    BLK: totalBLK / totalGP,
    FG_PCT: careerShooting?.FG_PCT ?? null,
    FG3_PCT: careerShooting?.FG3_PCT ?? null,
    FT_PCT: careerShooting?.FT_PCT ?? null,
  } : null;

  // Current season = last one in the list
  const latestYear = aggregateRows?.at(-1)?.SEASON_ID;
  const latestRows = aggregateRows?.filter(row => row.SEASON_ID === latestYear) ?? [];
  const currentSeason = latestRows.length === 1 ? latestRows[0] : null;

  return (
    <div className="glass-tile overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t.playerStats.seasonBySeasonStats}</h3>
        {headerExtra}
      </div>
      <p className="px-4 py-2 text-xs text-text-secondary">{isZh
        ? "生涯命中率仅采用数据源提供的常规赛生涯汇总；缺失时显示 —，不按比赛场数平均各季命中率。"
        : "Career shooting rates use the source's regular-season career aggregate. Missing rates are unavailable, not game-weighted averages of season percentages."}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-text-secondary">
              <th className="text-left py-2.5 px-3 sticky left-0 bg-bg-card">{t.common.season}</th>
              <th className="text-left py-2.5 px-2">{t.common.team}</th>
              <th className="text-center py-2.5 px-2">GP</th>
              <th className="text-center py-2.5 px-2">MIN</th>
              <th className="text-center py-2.5 px-2 text-accent font-bold">PTS</th>
              <th className="text-center py-2.5 px-2">REB</th>
              <th className="text-center py-2.5 px-2">AST</th>
              <th className="text-center py-2.5 px-2">STL</th>
              <th className="text-center py-2.5 px-2">BLK</th>
              <th className="text-center py-2.5 px-2">FG%</th>
              <th className="text-center py-2.5 px-2">3P%</th>
              <th className="text-center py-2.5 px-2">FT%</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((s, i) => (
              <tr
                key={`${s.SEASON_ID}-${s.TEAM_ABBREVIATION}-${i}`}
                className={`border-b border-border/30 hover:bg-bg-hover/50 ${i === bestIdx ? "bg-accent/5" : ""}`}
              >
                <td className={`py-2 px-3 font-medium sticky left-0 whitespace-nowrap ${i === bestIdx ? "text-accent bg-accent/5" : "text-text-primary bg-bg-card"}`}>
                  {s.SEASON_ID}
                  {i === bestIdx && <span className="ml-1 text-accent-amber text-[10px]" title={t.playerStats.bestSeason}>★</span>}
                </td>
                <td className="py-2 px-2 text-text-secondary">{s.TEAM_ABBREVIATION}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{s.GP}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{s.MIN?.toFixed(1)}</td>
                <td className={`text-center py-2 px-2 font-bold ${i === bestIdx ? "text-accent" : "text-accent"}`}>{s.PTS?.toFixed(1)}</td>
                <td className="text-center py-2 px-2">{s.REB?.toFixed(1)}</td>
                <td className="text-center py-2 px-2">{s.AST?.toFixed(1)}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{s.STL?.toFixed(1)}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{s.BLK?.toFixed(1)}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{s.FG_PCT != null ? (s.FG_PCT * 100).toFixed(1) + "%" : "-"}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{s.FG3_PCT != null ? (s.FG3_PCT * 100).toFixed(1) + "%" : "-"}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{s.FT_PCT != null ? (s.FT_PCT * 100).toFixed(1) + "%" : "-"}</td>
              </tr>
            ))}
            {/* Career Average Row */}
            {careerAvg && (
              <tr className="border-t-2 border-border bg-bg-secondary/50 font-medium">
                <td className="py-2 px-3 sticky left-0 bg-bg-secondary/50 text-text-primary font-bold">{t.common.career}</td>
                <td className="py-2 px-2 text-text-secondary">-</td>
                <td className="text-center py-2 px-2 text-text-secondary">{careerAvg.GP}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{careerAvg.MIN.toFixed(1)}</td>
                <td className="text-center py-2 px-2 font-bold text-text-primary">{careerAvg.PTS.toFixed(1)}</td>
                <td className="text-center py-2 px-2">{careerAvg.REB.toFixed(1)}</td>
                <td className="text-center py-2 px-2">{careerAvg.AST.toFixed(1)}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{careerAvg.STL.toFixed(1)}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{careerAvg.BLK.toFixed(1)}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{careerAvg.FG_PCT != null ? (careerAvg.FG_PCT * 100).toFixed(1) + "%" : "-"}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{careerAvg.FG3_PCT != null ? (careerAvg.FG3_PCT * 100).toFixed(1) + "%" : "-"}</td>
                <td className="text-center py-2 px-2 text-text-secondary">{careerAvg.FT_PCT != null ? (careerAvg.FT_PCT * 100).toFixed(1) + "%" : "-"}</td>
              </tr>
            )}
            {/* Current Season vs Career Comparison */}
            {currentSeason && careerAvg && seasons.length > 1 && (
              <tr className="bg-bg-hover/30 text-[10px]">
                <td className="py-1.5 px-3 sticky left-0 bg-bg-hover/30 text-text-secondary italic" colSpan={4}>{t.playerStats.vsCareerAvg}</td>
                <td className="text-center py-1.5 px-2 font-medium">
                  {currentSeason.PTS > careerAvg.PTS ? "+" : ""}{(currentSeason.PTS - careerAvg.PTS).toFixed(1)}
                  <CompareArrow current={currentSeason.PTS} career={careerAvg.PTS} />
                </td>
                <td className="text-center py-1.5 px-2">
                  {currentSeason.REB > careerAvg.REB ? "+" : ""}{(currentSeason.REB - careerAvg.REB).toFixed(1)}
                  <CompareArrow current={currentSeason.REB} career={careerAvg.REB} />
                </td>
                <td className="text-center py-1.5 px-2">
                  {currentSeason.AST > careerAvg.AST ? "+" : ""}{(currentSeason.AST - careerAvg.AST).toFixed(1)}
                  <CompareArrow current={currentSeason.AST} career={careerAvg.AST} />
                </td>
                <td className="text-center py-1.5 px-2 text-text-secondary">
                  {currentSeason.STL > careerAvg.STL ? "+" : ""}{(currentSeason.STL - careerAvg.STL).toFixed(1)}
                  <CompareArrow current={currentSeason.STL} career={careerAvg.STL} />
                </td>
                <td className="text-center py-1.5 px-2 text-text-secondary">
                  {currentSeason.BLK > careerAvg.BLK ? "+" : ""}{(currentSeason.BLK - careerAvg.BLK).toFixed(1)}
                  <CompareArrow current={currentSeason.BLK} career={careerAvg.BLK} />
                </td>
                <td className="text-center py-1.5 px-2 text-text-secondary">-</td>
                <td className="text-center py-1.5 px-2 text-text-secondary">-</td>
                <td className="text-center py-1.5 px-2 text-text-secondary">-</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
