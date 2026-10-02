"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { CURRENT_SEASON } from "@/lib/constants";
import { useLocale } from "@/components/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import { playerHeadshotUrl } from "@/lib/teamUrls";
import { parseLeagueLeaders, hasLeagueLeaderNumbers, formatLeagueLeaderValue, type LeagueLeaderRow } from "@/lib/league-leaders";

function mvpScore(p: LeagueLeaderRow): number | null {
  // Custom MVP formula: PTS*1.0 + REB*0.7 + AST*1.0 + STL*1.5 + BLK*1.2 + EFF*0.3 + GP*0.1
  if (!hasLeagueLeaderNumbers(p, ["PTS", "REB", "AST", "STL", "BLK", "EFF", "GP"])) return null;
  const score = p.PTS * 1.0 + p.REB * 0.7 + p.AST * 1.0 + p.STL * 1.5 + p.BLK * 1.2 + p.EFF * 0.3 + p.GP * 0.1;
  return Number.isFinite(score) ? score : null;
}

export default function MvpLadder() {
  const { t, locale } = useLocale();
  const [players, setPlayers] = useState<LeagueLeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [rejectedRows, setRejectedRows] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const retry = () => { requestRef.current?.abort(); setRetryKey(key => key + 1); };

  useEffect(() => {
    const controller = new AbortController();
    requestRef.current = controller;
    let active = true;
    const current = () => active && !controller.signal.aborted;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a retry owns a new request
    setLoading(true);
    setError(false);
    const timeout = setTimeout(() => {
      if (!current()) return;
      controller.abort(); setError(true); setLoading(false);
    }, 12000);
    (async () => {
      try {
        const qs = new URLSearchParams({
          endpoint: "leagueleaders",
          LeagueID: "00",
          PerMode: "PerGame",
          Scope: "S",
          Season: CURRENT_SEASON,
          SeasonType: "Regular Season",
          StatCategory: "EFF",
          limit: "50",
        });
        const res = await fetch(`/api/stats?${qs}`, { signal: controller.signal });
        if (!current()) return;
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (!current()) return;
        const parsed = parseLeagueLeaders(data);
        if (!parsed || (!parsed.rows.length && parsed.rejectedRows > 0)) throw new Error("No usable data");
        setPlayers(parsed.rows.slice(0, 50));
        setRejectedRows(parsed.rejectedRows);
      } catch { if (current()) setError(true); }
      finally { clearTimeout(timeout); if (current()) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [retryKey]);

  const { ranked, incomplete } = useMemo(() => {
    const scored: (LeagueLeaderRow & { _score: number })[] = [];
    let incomplete = false;
    for (const p of players) {
      if (!hasLeagueLeaderNumbers(p, ["GP"])) { incomplete = true; continue; }
      if (p.GP < 40) continue;
      const score = mvpScore(p);
      if (score === null) { incomplete = true; continue; }
      scored.push({ ...p, _score: score });
    }
    scored.sort((a, b) => b._score - a._score);
    return { ranked: scored.slice(0, 15), incomplete };
  }, [players]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-16 skeleton-shimmer rounded-xl" />
        ))}
      </div>
    );
  }

  if (error || (ranked.length === 0 && (incomplete || rejectedRows > 0))) return (
    <EmptyState icon={Trophy} tone="danger" title={t.statsPage.failedToLoad}
      description={locale === "zh" ? "MVP 排名所需统计暂不可用，请重试。" : "Statistics required for the MVP ladder are unavailable. Please try again."}
      action={{ label: t.common.retry, onClick: retry }} />
  );

  if (ranked.length === 0) return (
    <EmptyState
      icon={Trophy}
      title={t.statsPage.noMvpTitle}
      description={t.statsPage.noMvpDesc}
    />
  );

  const topScore = ranked[0]._score;

  return (
    <div>
      {(incomplete || rejectedRows > 0) && <p role="status" className="text-xs text-text-secondary mb-3">
        {locale === "zh" ? "部分记录或所需统计不可用；此排名仅基于可用记录。" : "Partial data: this ranking is based on available records; some records or required statistics are unavailable."}
      </p>}
      <p className="text-xs text-text-secondary mb-4">
        {t.statsPage.mvpRankingNote}
        <span className="text-text-secondary/60 ml-1">{t.statsPage.minGpRequired}</span>
      </p>
      <div className="space-y-2">
        {ranked.map((p, i) => {
          const score = p._score;
          const barPct = topScore > 0 ? (score / topScore) * 100 : 0;
          const isTop3 = i < 3;
          const medalBg = i === 0 ? "bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700]"
            : i === 1 ? "bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0]"
            : i === 2 ? "bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32]"
            : "bg-bg-hover text-text-secondary";
          const barColor = i === 0 ? "bg-[#FFD700]" : i === 1 ? "bg-[#C0C0C0]" : i === 2 ? "bg-[#CD7F32]" : "bg-accent/60";
          return (
            <Link
              key={p.PLAYER_ID}
              href={`/player/${p.PLAYER_ID}`}
              className={`flex items-center gap-3 glass-tile p-3 hover:border-accent/40 transition-all group cursor-pointer ${isTop3 ? "bg-accent-amber/[0.03]" : ""}`}
            >
              <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold font-mono tabular-nums shrink-0 ${medalBg}`}>
                {i + 1}
              </span>
              <div className="w-10 h-10 rounded-full overflow-hidden bg-bg-secondary shrink-0 ring-1 ring-border">
                <Image
                  src={playerHeadshotUrl(p.PLAYER_ID, "260x190")}
                  alt={p.PLAYER}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover object-top"
                  unoptimized
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary group-hover:text-accent transition-colors truncate">{p.PLAYER}</span>
                  <span className="text-[10px] text-text-secondary font-mono">{p.TEAM ?? "—"}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="flex-1 h-1.5 bg-bg-hover rounded-full overflow-hidden max-w-[200px]">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${barPct}%` }} />
                  </div>
                  <span className={`text-[10px] font-bold font-mono tabular-nums ${isTop3 ? "text-text-primary" : "text-accent"}`}>{score.toFixed(1)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-text-secondary shrink-0 font-mono tabular-nums">
                <span><span className="font-bold text-text-primary">{formatLeagueLeaderValue(p.PTS)}</span> <span className="text-[9px]">PPG</span></span>
                <span>{formatLeagueLeaderValue(p.REB)} <span className="text-[9px]">RPG</span></span>
                <span>{formatLeagueLeaderValue(p.AST)} <span className="text-[9px]">APG</span></span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
