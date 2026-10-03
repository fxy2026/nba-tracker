"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { CURRENT_SEASON } from "@/lib/constants";
import { Target, Loader2, Trophy, Crown, Activity, Calendar } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import RelatedPages from "@/components/RelatedPages";
import { useLocale } from "@/components/LocaleProvider";
import { playerHeadshotUrl } from "@/lib/teamUrls";

import { parseLeagueLeaders, formatLeagueLeaderValue, type LeagueLeaderRow } from "@/lib/league-leaders";
import { TEAM_META } from "@/lib/teams";

type Category = "EFF" | "PTS" | "AST" | "STL" | "FG_PCT";
type Query = { category: Category; attempt: number };
type Result =
  | { query: Query; status: "success"; rows: LeagueLeaderRow[]; rejectedRows: number }
  | { query: Query; status: "error" };

export default function ClutchPage() {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const [query, setQuery] = useState<Query>({ category: "EFF", attempt: 0 });
  const [result, setResult] = useState<Result | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const category = query.category;
  // Query identity also hides the old result during the render before effect cleanup.
  const loading = result?.query !== query;
  const error = !loading && result?.status === "error";
  const success = !loading && result?.status === "success" ? result : null;
  const players = success?.rows ?? [];
  const partial = !!success && (success.rejectedRows > 0 || players.some(player =>
    player.RANK === 0 || [player.RANK, player.GP, player[category], player.PTS, player.AST, player.STL].some(value => value === null)));
  const topVal = Math.max(0, ...players.flatMap(player => player[category] === null ? [] : [player[category]]));
  const retry = () => {
    requestRef.current?.abort();
    setQuery(current => ({ ...current, attempt: current.attempt + 1 }));
  };

  useEffect(() => {
    const controller = new AbortController();
    requestRef.current = controller;
    let active = true;
    const current = () => active && !controller.signal.aborted;
    // Keep the deadline through JSON decoding. Even an abort-ignoring fetch/body
    // must leave loading; only the currently owned request may publish a result.
    const timeout = setTimeout(() => {
      if (!current()) return;
      controller.abort();
      setResult({ query, status: "error" });
    }, 12000);
    (async () => {
      try {
        const params = new URLSearchParams({
          endpoint: "leagueleaders",
          LeagueID: "00",
          Season: CURRENT_SEASON,
          SeasonType: "Playoffs",
          PerMode: "PerGame",
          Scope: "S",
          StatCategory: query.category,
          limit: "25",
        });
        const res = await fetch(`/api/stats?${params}`, { signal: controller.signal });
        if (!current()) return;
        if (!res.ok) throw new Error("Failed");
        const data: unknown = await res.json();
        if (!current()) return;
        const parsed = parseLeagueLeaders(data);
        if (!parsed || (!parsed.rows.length && parsed.rejectedRows > 0)) throw new Error("No usable data");
        setResult({ query, status: "success", rows: parsed.rows.slice(0, 25), rejectedRows: parsed.rejectedRows });
      } catch {
        if (current()) setResult({ query, status: "error" });
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [query]);

  const categories = [
    { key: "EFF", label: t.clutchPage.efficiency },
    { key: "PTS", label: t.clutchPage.scoring },
    { key: "AST", label: t.clutchPage.playmaking },
    { key: "STL", label: t.clutchPage.steals },
    { key: "FG_PCT", label: t.clutchPage.fgPct },
  ] satisfies { key: Category; label: string }[];

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

      {/* Category tabs — glass pill bar */}
      <div className="flex flex-wrap gap-1 mb-4">
        <div className="glass-tile flex flex-wrap overflow-hidden p-1">
          {categories.map((c) => (
            <button
              key={c.key}
              onClick={() => {
                if (c.key !== category) {
                  requestRef.current?.abort();
                  setQuery(current => ({ category: c.key, attempt: current.attempt }));
                }
              }}
              aria-pressed={category === c.key}
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
        <div role="status" aria-label={t.common.loading} className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-accent" aria-hidden="true" />
        </div>
      )}

      {error && !loading && (
        <div role="alert" className="glass-tile p-12 text-center">
          <p className="text-text-secondary">{t.clutchPage.failedToLoad}</p>
          <button onClick={retry} className="mt-4 px-4 py-2 rounded-md bg-accent text-white text-sm cursor-pointer">{t.common.retry}</button>
        </div>
      )}

      {!loading && !error && players.length === 0 && (
        <div role="status" className="glass-tile p-12 text-center">
          <p className="text-text-secondary">{t.clutchPage.noData}</p>
          <button onClick={retry} className="mt-4 px-4 py-2 rounded-md bg-accent text-white text-sm cursor-pointer">{t.common.retry}</button>
        </div>
      )}

      {success && players.length > 0 && (
        <div className="glass-tile overflow-hidden">
          <p className="px-4 py-3 text-xs text-text-secondary border-b border-border">{t.clutchPage.scopeNote}</p>
          {partial && <p role="status" className="px-4 py-3 text-xs text-accent-amber border-b border-border">{t.clutchPage.partialData}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-bg-card">
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
                {players.map((p) => {
                  const statVal = p[category];
                  const barPct = statVal !== null && statVal >= 0 && topVal > 0 ? Math.min(100, (statVal / topVal) * 100) : null;
                  const rank = p.RANK !== null && p.RANK > 0 ? p.RANK : null;
                  const topThree = rank !== null && rank <= 3;
                  return (
                  <tr key={p.PLAYER_ID} className={`border-b border-border/30 hover:bg-bg-hover/50 transition-colors ${topThree ? "bg-accent-amber/[0.03]" : ""}`}>
                    <td className="text-center py-2.5 px-2">
                      {rank === 1 ? (
                        <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700] font-bold font-mono tabular-nums text-[11px]">{rank}</span>
                      ) : rank === 2 ? (
                        <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0] font-bold font-mono tabular-nums text-[11px]">{rank}</span>
                      ) : rank === 3 ? (
                        <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32] font-bold font-mono tabular-nums text-[11px]">{rank}</span>
                      ) : (
                        <span className="text-text-secondary font-mono tabular-nums text-xs">{rank ?? "—"}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <Link href={`/player/${p.PLAYER_ID}`} className="flex items-center gap-2 hover:text-accent transition-colors">
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-bg-secondary shrink-0">
                          <Image
                            src={playerHeadshotUrl(p.PLAYER_ID, "260x190")}
                            alt={p.PLAYER}
                            width={28}
                            height={28}
                            unoptimized
                            className="w-full h-full object-cover object-top"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        </div>
                        <span className="font-medium text-text-primary">{p.PLAYER}</span>
                      </Link>
                    </td>
                    <td className="text-center py-2.5 px-2">
                      {p.TEAM && Object.hasOwn(TEAM_META, p.TEAM) ? (
                        <Link href={`/team/${p.TEAM}`} className="text-text-secondary hover:text-accent transition-colors">{p.TEAM}</Link>
                      ) : <span className="text-text-secondary">{p.TEAM ?? "—"}</span>}
                    </td>
                    <td className="text-center py-2.5 px-2 text-text-secondary">{p.GP ?? "—"}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-accent font-mono tabular-nums min-w-[40px] text-center">{formatLeagueLeaderValue(statVal, category === "FG_PCT")}</span>
                        {barPct !== null && <div aria-hidden="true" className="flex-1 h-2 bg-bg-hover rounded-full overflow-hidden max-w-[60px]">
                          <div className="h-full bg-accent/60 rounded-full" style={{ width: `${barPct}%` }} />
                        </div>}
                      </div>
                    </td>
                    <td className="text-center py-2.5 px-2 text-text-secondary">{formatLeagueLeaderValue(p.PTS)}</td>
                    <td className="text-center py-2.5 px-2 text-text-secondary">{formatLeagueLeaderValue(p.AST)}</td>
                    <td className="text-center py-2.5 px-2 text-text-secondary">{formatLeagueLeaderValue(p.STL)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
