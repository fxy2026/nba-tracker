"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { AlertCircle } from "lucide-react";

import { CURRENT_SEASON } from "@/lib/constants";
import { useLocale } from "@/components/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import Select from "@/components/ui/Select";
import { playerHeadshotUrl as buildHeadshotUrl } from "@/lib/teamUrls";
import { parseLeagueLeaders, formatLeagueLeaderValue, type LeagueLeaderRow, type LeagueLeaderNumericField } from "@/lib/league-leaders";
const STATS_API = "/api/stats";

const PLAYER_CATS = [
  { key: "PTS", label: "Points" },
  { key: "REB", label: "Rebs" },
  { key: "AST", label: "Assists" },
  { key: "STL", label: "Steals" },
  { key: "BLK", label: "Blocks" },
  { key: "FG_PCT", label: "FG%" },
  { key: "FG3_PCT", label: "3P%" },
  { key: "EFF", label: "Effect" },
  { key: "MIN", label: "Minutes" },
] as const;

function headshotUrl(id: number) {
  // 32px avatars — the small CDN variant is ~10x lighter than the default 1040x760.
  return buildHeadshotUrl(id, "260x190");
}

export default function PlayerLeaders() {
  const { t, locale } = useLocale();
  const [cat, setCat] = useState<LeagueLeaderNumericField>("PTS");
  const [rows, setRows] = useState<LeagueLeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seasonType, setSeasonType] = useState("Regular Season");
  const [retryKey, setRetryKey] = useState(0);
  const [rejectedRows, setRejectedRows] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const retry = () => { requestRef.current?.abort(); setRetryKey(key => key + 1); };

  useEffect(() => {
    const controller = new AbortController();
    requestRef.current = controller;
    let active = true;
    const current = () => active && !controller.signal.aborted;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- query/retry starts its owned request
    setLoading(true);
    setError("");
    const timeout = setTimeout(() => {
      if (!current()) return;
      controller.abort(); setError("unavailable"); setLoading(false);
    }, 12000);
    (async () => {
      try {
        const qs = new URLSearchParams({
          endpoint: "leagueleaders",
          LeagueID: "00",
          PerMode: "PerGame",
          Scope: "S",
          Season: CURRENT_SEASON,
          SeasonType: seasonType,
          StatCategory: cat,
          limit: "50",
        }).toString();
        const res = await fetch(`${STATS_API}?${qs}`, { signal: controller.signal });
        if (!current()) return;
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        if (!current()) return;
        const parsed = parseLeagueLeaders(data);
        if (!parsed || (!parsed.rows.length && parsed.rejectedRows > 0)) throw new Error("No usable data");
        setRows(parsed.rows);
        setRejectedRows(parsed.rejectedRows);
      } catch {
        if (current()) { setError("unavailable"); setRows([]); }
      } finally {
        clearTimeout(timeout);
        if (current()) setLoading(false);
      }
    })();
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [cat, seasonType, retryKey]);

  // topVal & label only depend on rows[0] + cat → compute once per render, not per row.
  const topVal = rows[0]?.[cat] ?? null;
  const isPctCat = cat.includes("PCT");
  const fmtVal = (r: LeagueLeaderRow) => formatLeagueLeaderValue(r[cat], isPctCat);
  const partial = rejectedRows > 0 || rows.some(row =>
    [row.RANK, row.GP, row[cat], row.PTS, row.REB, row.AST, row.STL, row.BLK].some(value => value === null));

  return (
    <div>
      {/* Filter chips — glass tile pill bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="glass-tile flex flex-wrap overflow-hidden p-1">
          {PLAYER_CATS.map((c) => (
            <button key={c.key} onClick={() => {
              if (c.key !== cat) {
                requestRef.current?.abort(); setLoading(true); setError(""); setCat(c.key);
              }
            }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${cat === c.key ? "bg-accent text-white shadow-md" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"}`}>
              {c.label}
            </button>
          ))}
        </div>
        <Select value={seasonType} onValueChange={(value) => {
          if (value !== seasonType) {
            requestRef.current?.abort(); setLoading(true); setError(""); setSeasonType(value);
          }
        }}
          aria-label={locale === "zh" ? "赛季类型" : "Season type"}
          options={[
            { value: "Regular Season", label: t.statsPage.regularSeason },
            { value: "Playoffs", label: t.statsPage.playoffs },
          ]}
        />
      </div>

      {loading ? (
        // 25 rows ≈ the rendered table height; without this the footer below
        // gets shoved down ~1500px when the data lands and CLS spikes.
        <div className="space-y-2">
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} className="glass-tile h-12 skeleton-shimmer" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={AlertCircle}
          tone="danger"
          title={t.statsPage.failedToLoad}
          description={locale === "zh" ? "球员统计来源暂不可用，请重试。" : "Player statistics are unavailable. Please try again."}
          action={{ label: t.common.retry, onClick: retry }}
        />
      ) : (
        <div className="glass-tile overflow-hidden">
          {partial && <p role="status" className="px-4 py-3 text-xs text-text-secondary border-b border-border">
            {locale === "zh" ? "部分数据不可用；按来源顺序展示可用记录，并保留原始排名。" : "Partial data: showing available records in source order with their original ranks."}
          </p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm stats-table">
              <thead className="sticky top-0 z-10 bg-bg-card/95 backdrop-blur-md">
                <tr className="border-b border-border text-text-secondary text-[10px] font-mono uppercase tracking-[0.15em]">
                  <th className="text-left py-3 px-3 w-12">Rank</th>
                  <th className="text-left py-3 px-2">Player</th>
                  <th className="text-left py-3 px-2">Team</th>
                  <th className="text-center py-3 px-2">GP</th>
                  <th className="text-center py-3 px-2 font-bold text-accent-amber">{PLAYER_CATS.find((c) => c.key === cat)?.label}</th>
                  <th className="text-center py-3 px-2">PTS</th>
                  <th className="text-center py-3 px-2">REB</th>
                  <th className="text-center py-3 px-2">AST</th>
                  <th className="text-center py-3 px-2">STL</th>
                  <th className="text-center py-3 px-2">BLK</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r) => {
                  const curVal = r[cat];
                  const barPct = curVal !== null && topVal !== null && topVal > 0 ? (curVal / topVal) * 100 : 0;
                  const isTop3 = r.RANK !== null && r.RANK >= 1 && r.RANK <= 3;
                  const medalBg = r.RANK === 1 ? "bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700]"
                    : r.RANK === 2 ? "bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0]"
                    : r.RANK === 3 ? "bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32]"
                    : "";
                  const barColor = r.RANK === 1 ? "bg-[#FFD700]" : r.RANK === 2 ? "bg-[#C0C0C0]" : r.RANK === 3 ? "bg-[#CD7F32]" : "bg-accent/60";
                  return (
                  <tr key={r.PLAYER_ID} className={`border-b border-border/40 hover:bg-bg-hover/50 transition-colors ${isTop3 ? "bg-accent-amber/[0.03]" : ""}`}>
                    <td className="py-2.5 px-3">
                      {isTop3 ? (
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-bold font-mono tabular-nums ${medalBg}`}>
                          {r.RANK ?? "—"}
                        </span>
                      ) : (
                          <span className="text-text-secondary font-mono tabular-nums text-xs ml-1">{r.RANK ?? "—"}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-bg-secondary shrink-0 ring-1 ring-border">
                          <Image src={headshotUrl(r.PLAYER_ID)} alt={r.PLAYER} width={32} height={32}
                            unoptimized
                            className="w-full h-full object-cover object-top"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        </div>
                        <span className="font-medium text-text-primary whitespace-nowrap">{r.PLAYER}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-text-secondary font-mono tabular-nums text-xs">{r.TEAM ?? "—"}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary font-mono tabular-nums">{r.GP ?? "—"}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold font-mono tabular-nums min-w-[48px] text-center ${isTop3 ? "text-text-primary" : "text-accent"}`}>{fmtVal(r)}</span>
                        <div className="flex-1 h-1.5 bg-bg-hover rounded-full overflow-hidden max-w-[80px]">
                          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center text-text-secondary font-mono tabular-nums">{formatLeagueLeaderValue(r.PTS)}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary font-mono tabular-nums">{formatLeagueLeaderValue(r.REB)}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary font-mono tabular-nums">{formatLeagueLeaderValue(r.AST)}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary font-mono tabular-nums">{formatLeagueLeaderValue(r.STL)}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary font-mono tabular-nums">{formatLeagueLeaderValue(r.BLK)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
