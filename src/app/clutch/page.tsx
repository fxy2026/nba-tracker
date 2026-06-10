"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { CURRENT_SEASON } from "@/lib/constants";
import { Target, Loader2, Trophy, Crown, Activity, Calendar } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import RelatedPages from "@/components/RelatedPages";
import { useLocale } from "@/components/LocaleProvider";
import { playerHeadshotUrl } from "@/lib/teamUrls";

interface PlayerRow {
  PLAYER_ID: number;
  PLAYER: string;
  TEAM: string;
  GP: number;
  PTS: number;
  FG_PCT: number;
  FG3_PCT: number;
  FT_PCT: number;
  AST: number;
  STL: number;
  EFF: number;
}

export default function ClutchPage() {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState("EFF");

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams({
          endpoint: "leagueleaders",
          LeagueID: "00",
          Season: CURRENT_SEASON,
          SeasonType: "Playoffs",
          PerMode: "PerGame",
          Scope: "S",
          StatCategory: category,
          limit: "25",
        });
        const res = await fetch(`/api/stats?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        const rs = data.resultSet;
        if (!rs) throw new Error("No data");
        const headers: string[] = rs.headers;
        const parsed = rs.rowSet.slice(0, 25).map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { obj[h] = row[i]; });
          return obj;
        }) as unknown as PlayerRow[];
        if (!controller.signal.aborted) setPlayers(parsed);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => controller.abort();
  }, [category]);

  const overviewStats = useMemo(() => {
    if (players.length === 0) return null;
    const topScorer = [...players].sort((a, b) => (b.PTS || 0) - (a.PTS || 0))[0];
    const topAssist = [...players].sort((a, b) => (b.AST || 0) - (a.AST || 0))[0];
    const mostGP = [...players].sort((a, b) => (b.GP || 0) - (a.GP || 0))[0];
    return { topScorer, topAssist, mostGP };
  }, [players]);

  const categories = [
    { key: "EFF", label: t.clutchPage.efficiency },
    { key: "PTS", label: t.clutchPage.scoring },
    { key: "AST", label: t.clutchPage.playmaking },
    { key: "STL", label: t.clutchPage.steals },
    { key: "FG_PCT", label: t.clutchPage.fgPct },
  ];

  const fmtVal = (p: PlayerRow) => {
    if (category === "FG_PCT" || category === "FG3_PCT" || category === "FT_PCT") {
      const v = p[category as keyof PlayerRow] as number;
      return v != null ? (v * 100).toFixed(1) + "%" : "-";
    }
    const v = p[category as keyof PlayerRow] as number;
    return v?.toFixed(1) ?? "-";
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={`${CURRENT_SEASON} ${t.clutchPage.eyebrowSuffix}`}
        icon={Target}
        title={t.clutchPage.title}
        subtitle={t.clutchPage.subtitle}
      />

      <div className="glass-tile p-3 mb-6 flex items-start gap-2 text-xs text-text-secondary">
        <Target size={14} className="text-accent-amber shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">{t.clutchPage.aboutNote}</p>
      </div>

      {/* Quick Stats Overview */}
      {!loading && overviewStats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="glass-tile p-3 text-center">
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">{t.clutchPage.topScorer}</p>
            <p className="text-sm font-bold text-accent-amber mt-1">{overviewStats.topScorer.PLAYER?.split(" ").pop()}</p>
            <p className="text-xs text-text-secondary font-mono tabular-nums mt-0.5">{overviewStats.topScorer.PTS?.toFixed(1)} <span className="text-[9px]">PPG</span></p>
          </div>
          <div className="glass-tile p-3 text-center">
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">{t.clutchPage.topPlaymaker}</p>
            <p className="text-sm font-bold text-accent mt-1">{overviewStats.topAssist.PLAYER?.split(" ").pop()}</p>
            <p className="text-xs text-text-secondary font-mono tabular-nums mt-0.5">{overviewStats.topAssist.AST?.toFixed(1)} <span className="text-[9px]">APG</span></p>
          </div>
          <div className="glass-tile p-3 text-center">
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">{t.clutchPage.mostGames}</p>
            <p className="text-sm font-bold text-text-primary mt-1">{overviewStats.mostGP.PLAYER?.split(" ").pop()}</p>
            <p className="text-xs text-text-secondary font-mono tabular-nums mt-0.5">{overviewStats.mostGP.GP}{t.clutchPage.gp}</p>
          </div>
        </div>
      )}

      {/* Category tabs — glass pill bar */}
      <div className="flex flex-wrap gap-1 mb-4">
        <div className="glass-tile flex flex-wrap overflow-hidden p-1">
          {categories.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                category === c.key ? "bg-accent text-white shadow-md" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-accent" />
        </div>
      )}

      {error && !loading && (
        <div className="glass-tile p-12 text-center">
          <p className="text-text-secondary">{t.clutchPage.failedToLoad}</p>
        </div>
      )}

      {!loading && !error && players.length === 0 && (
        <div className="glass-tile p-12 text-center">
          <p className="text-text-secondary">{t.clutchPage.noData}</p>
        </div>
      )}

      {!loading && players.length > 0 && (() => {
        // Compute max value for the selected category to use for bar widths
        const getStatVal = (p: PlayerRow) => {
          const v = p[category as keyof PlayerRow] as number;
          return v ?? 0;
        };
        const topVal = Math.max(...players.map(getStatVal), 0.1);

        return (
        <div className="glass-tile overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-bg-card/95 backdrop-blur-md">
                <tr className="border-b border-border text-text-secondary text-[10px] font-mono uppercase tracking-[0.15em]">
                  <th className="text-center py-3 px-2 w-12">Rank</th>
                  <th className="text-left py-3 px-3">Player</th>
                  <th className="text-center py-3 px-2">Team</th>
                  <th className="text-center py-3 px-2">GP</th>
                  <th className="text-center py-3 px-2 text-accent-amber font-bold">{categories.find(c => c.key === category)?.label}</th>
                  <th className="text-center py-3 px-2">PTS</th>
                  <th className="text-center py-3 px-2">AST</th>
                  <th className="text-center py-3 px-2">STL</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => {
                  const statVal = getStatVal(p);
                  const barPct = topVal > 0 ? (statVal / topVal) * 100 : 0;
                  return (
                  <tr key={p.PLAYER_ID} className={`border-b border-border/30 hover:bg-bg-hover/50 transition-colors ${i < 3 ? "bg-accent-amber/[0.03]" : ""}`}>
                    <td className="text-center py-2.5 px-2">
                      {i === 0 ? (
                        <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700] font-bold font-mono tabular-nums text-[11px]">1</span>
                      ) : i === 1 ? (
                        <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0] font-bold font-mono tabular-nums text-[11px]">2</span>
                      ) : i === 2 ? (
                        <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32] font-bold font-mono tabular-nums text-[11px]">3</span>
                      ) : (
                        <span className="text-text-secondary font-mono tabular-nums text-xs">{i + 1}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <Link href={`/player/${p.PLAYER_ID}`} className="flex items-center gap-2 hover:text-accent transition-colors">
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-bg-secondary shrink-0">
                          <Image
                            src={playerHeadshotUrl(p.PLAYER_ID)}
                            alt={p.PLAYER}
                            width={28}
                            height={28}
                            className="w-full h-full object-cover object-top"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        </div>
                        <span className="font-medium text-text-primary">{p.PLAYER}</span>
                      </Link>
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <Link href={`/team/${p.TEAM}`} className="text-text-secondary hover:text-accent transition-colors">{p.TEAM}</Link>
                    </td>
                    <td className="text-center py-2.5 px-2 text-text-secondary">{p.GP}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-accent font-mono tabular-nums min-w-[40px] text-center">{fmtVal(p)}</span>
                        <div className="flex-1 h-2 bg-bg-hover rounded-full overflow-hidden max-w-[60px]">
                          <div className="h-full bg-accent/60 rounded-full" style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="text-center py-2.5 px-2 text-text-secondary">{p.PTS?.toFixed(1)}</td>
                    <td className="text-center py-2.5 px-2 text-text-secondary">{p.AST?.toFixed(1)}</td>
                    <td className="text-center py-2.5 px-2 text-text-secondary">{p.STL?.toFixed(1)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/best-games", label: isZh ? "最佳比赛" : "Best Games", description: isZh ? "季后赛精彩对决" : "Best playoff games this season", icon: Trophy },
          { href: "/records", label: isZh ? "赛季纪录" : "Records", description: isZh ? "赛季单场纪录" : "Single-game season records", icon: Crown },
          { href: "/clutch-teams", label: isZh ? "关键时刻" : "Clutch Teams", description: isZh ? "焦点战与加时赛战绩" : "Close-game and OT records", icon: Activity },
          { href: "/", label: isZh ? "季后赛对阵" : "Playoff Bracket", description: isZh ? "完整对阵图" : "Full postseason bracket", icon: Trophy },
          { href: "/this-day", label: isZh ? "历史上的今天" : "On This Day", description: isZh ? "历史比赛回顾" : "This day in history", icon: Calendar },
        ]}
      />
    </div>
  );
}
