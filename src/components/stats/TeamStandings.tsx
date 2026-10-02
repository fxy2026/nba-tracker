"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { teamLogoUrl } from "@/lib/teamUrls";
import { gamesBehind } from "@/lib/standings-splits";
import { parseStandingsResponse, type StandingsTeamRecord } from "@/lib/standings-response";

type TeamRecord = StandingsTeamRecord;

const EAST = ["ATL","BOS","BKN","CHA","CHI","CLE","DET","IND","MIA","MIL","NYK","ORL","PHI","TOR","WAS"];

export default function TeamStandings() {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [archivedSeason, setArchivedSeason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [conf, setConf] = useState<"all" | "east" | "west">("all");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      setLoading(true); setError(false);
      try {
        const request = (async () => {
          const response = await fetch("/api/standings", { signal: controller.signal });
          if (!response.ok) throw new Error("Unavailable standings");
          return await response.json() as unknown;
        })();
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error("Standings timeout")); }, 18_000);
        });
        const json = await Promise.race([request, deadline]);
        if (!active || controller.signal.aborted) return;
        const parsed = parseStandingsResponse(json);
        if (!parsed) throw new Error("Invalid standings");
        setTeams(parsed.teams); setArchivedSeason(parsed.archivedSeason);
      } catch { if (active) setError(true); }
      finally { clearTimeout(timer); if (active) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [retry]);

  const filtered = useMemo(() =>
    conf === "all" ? teams : teams.filter((t) => conf === "east" ? EAST.includes(t.tricode) : !EAST.includes(t.tricode)),
    [teams, conf]
  );


  return (
    <div>
      <div className="flex gap-2 mb-4">
        <div className="glass-tile flex overflow-hidden p-1">
          {(["all","east","west"] as const).map((c) => (
            <button key={c} onClick={() => setConf(c)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${conf === c ? "bg-accent text-white shadow-md" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"}`}>
              {c === "all" ? t.statsPage.all : c === "east" ? t.statsPage.eastern : t.statsPage.western}
            </button>
          ))}
        </div>
        {archivedSeason && (
          <span className="self-center text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 rounded-full bg-accent-amber/15 text-accent-amber">
            {archivedSeason} {isZh ? "赛季最终" : "Final"}
          </span>
        )}
      </div>

      {error && <div role="alert" className="glass-tile p-4 mb-4 space-y-2">
        <p>{isZh ? "排名数据暂时无法加载，请重试。" : "Standings are temporarily unavailable. Please retry."}</p>
        {teams.length > 0 && <p className="text-xs text-text-secondary">{isZh ? "下方保留上次成功加载的数据，可能已过时。" : "The last successfully loaded standings remain below and may be stale."}</p>}
        <button type="button" disabled={loading} onClick={() => setRetry(value => value + 1)} className="text-accent hover:underline disabled:opacity-50">{isZh ? "重试" : "Retry"}</button>
      </div>}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="glass-tile h-11 skeleton-shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (!error && <p role="status" className="glass-tile p-4 text-text-secondary">{isZh ? "暂无可用的已完赛排名数据。" : "No finished-game standings are available."}</p>) : (
        <div className="glass-tile overflow-hidden">
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={isZh ? "球队排名，可横向滚动" : "Team standings, scroll horizontally"}>
            <table className="w-full text-sm stats-table">
              <thead className="sticky top-0 z-10 bg-bg-card">
                <tr className="border-b border-border text-text-secondary text-[10px] font-mono uppercase tracking-[0.15em]">
                  <th className="text-left py-3 px-3 w-12">Rank</th>
                  <th className="text-left py-3 px-2">{t.common.team}</th>
                  <th className="text-center py-3 px-2">{t.common.wins}</th>
                  <th className="text-center py-3 px-2">{t.common.losses}</th>
                  <th className="text-center py-3 px-2">{t.standingsPage.pct}</th>
                  <th className="text-center py-3 px-2">{t.standingsPage.gb}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tm, i) => {
                  const pct = tm.wins + tm.losses > 0 ? tm.wins / (tm.wins + tm.losses) : 0;
                  const gb = gamesBehind(filtered[0], tm);
                  const logoUrl = teamLogoUrl(tm.teamId);
                  const isTop3 = i < 3;
                  const medalBg = i === 0 ? "bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700]"
                    : i === 1 ? "bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0]"
                    : i === 2 ? "bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32]"
                    : "";
                  return (
                    <React.Fragment key={tm.tricode}>
                    <tr className={`border-b border-border/40 hover:bg-bg-hover/50 transition-colors ${i < 6 ? "bg-accent/[0.03]" : i < 10 ? "bg-accent-amber/[0.03]" : ""}`}>
                      <td className="py-2.5 px-3">
                        {isTop3 ? (
                          <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-bold font-mono tabular-nums ${medalBg}`}>
                            {i + 1}
                          </span>
                        ) : (
                          <span className="text-text-secondary font-mono tabular-nums text-xs ml-1">{i + 1}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2">
                        <Link href={`/team/${tm.tricode}`} className="flex items-center gap-2 hover:text-accent transition-colors">
                          <Image src={logoUrl} alt={tm.tricode} width={24} height={24} unoptimized
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          <span className="font-medium text-text-primary whitespace-nowrap">{tm.teamCity} {tm.teamName}</span>
                          <span className="text-text-secondary text-xs">{tm.tricode}</span>
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-center text-success font-medium font-mono tabular-nums">{tm.wins}</td>
                      <td className="py-2.5 px-2 text-center text-danger font-medium font-mono tabular-nums">{tm.losses}</td>
                      <td className="py-2.5 px-2 text-center">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-medium font-mono tabular-nums min-w-[40px] ${isTop3 ? "text-text-primary" : "text-accent"}`}>{(pct * 100).toFixed(1)}%</span>
                          <div className="w-12 h-1.5 bg-bg-hover rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${i === 0 ? "bg-[#FFD700]" : i === 1 ? "bg-[#C0C0C0]" : i === 2 ? "bg-[#CD7F32]" : "bg-accent/60"}`} style={{ width: `${pct * 100}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center text-text-secondary font-mono tabular-nums">{gb}</td>
                    </tr>
                    {i === 5 && conf !== "all" && (
                      <tr><td colSpan={6} className="py-0"><div className="h-px bg-accent/30" /><p className="text-[9px] text-accent text-center py-0.5">{t.statsPage.playoffLine}</p></td></tr>
                    )}
                    {i === 9 && conf !== "all" && (
                      <tr><td colSpan={6} className="py-0"><div className="h-px bg-accent-amber/30" /><p className="text-[9px] text-accent-amber text-center py-0.5">{t.statsPage.playInLine}</p></td></tr>
                    )}
                    </React.Fragment>
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
