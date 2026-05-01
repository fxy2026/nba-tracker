"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";

interface TeamRecord { tricode: string; teamId: number; teamName: string; teamCity: string; wins: number; losses: number; }

const EAST = ["ATL","BOS","BKN","CHA","CHI","CLE","DET","IND","MIA","MIL","NYK","ORL","PHI","TOR","WAS"];

export default function TeamStandings() {
  const { t } = useLocale();
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [conf, setConf] = useState<"all" | "east" | "west">("all");

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/standings", { signal: controller.signal });
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        if (!controller.signal.aborted) setTeams(json.data || []);
      } catch { if (!controller.signal.aborted) setTeams([]); }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() =>
    conf === "all" ? teams : teams.filter((t) => conf === "east" ? EAST.includes(t.tricode) : !EAST.includes(t.tricode)),
    [teams, conf]
  );
  const topPct = useMemo(() =>
    filtered[0] ? filtered[0].wins / (filtered[0].wins + filtered[0].losses || 1) : 0,
    [filtered]
  );

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <div className="flex rounded-lg overflow-hidden border border-border">
          {(["all","east","west"] as const).map((c) => (
            <button key={c} onClick={() => setConf(c)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${conf === c ? "bg-accent text-white" : "bg-bg-card text-text-secondary hover:text-text-primary"}`}>
              {c === "all" ? t.statsPage.all : c === "east" ? t.statsPage.eastern : t.statsPage.western}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-11 bg-bg-card rounded-lg skeleton-shimmer" />
          ))}
        </div>
      ) : (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm stats-table">
              <thead>
                <tr className="border-b border-border text-text-secondary text-xs">
                  <th className="text-left py-3 px-3 w-8">#</th>
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
                  const gb = i === 0 ? "-" : (((topPct - pct) * (filtered[0].wins + filtered[0].losses)) / 2).toFixed(1);
                  const logoUrl = `https://cdn.nba.com/logos/nba/${tm.teamId}/global/L/logo.svg`;
                  return (
                    <React.Fragment key={tm.tricode}>
                    <tr className={`border-b border-border/50 hover:bg-bg-hover transition-colors ${i < 6 ? "bg-accent/5" : i < 10 ? "bg-yellow-500/5" : ""}`}>
                      <td className="py-2.5 px-3 text-text-secondary font-medium">{i + 1}</td>
                      <td className="py-2.5 px-2">
                        <Link href={`/team/${tm.tricode}`} className="flex items-center gap-2 hover:text-accent transition-colors">
                          <Image src={logoUrl} alt={tm.tricode} width={24} height={24} unoptimized
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          <span className="font-medium text-text-primary whitespace-nowrap">{tm.teamCity} {tm.teamName}</span>
                          <span className="text-text-secondary text-xs">{tm.tricode}</span>
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-center text-success font-medium">{tm.wins}</td>
                      <td className="py-2.5 px-2 text-center text-danger font-medium">{tm.losses}</td>
                      <td className="py-2.5 px-2 text-center">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-accent tabular-nums min-w-[40px]">{(pct * 100).toFixed(1)}%</span>
                          <div className="w-12 h-1.5 bg-bg-hover rounded-full overflow-hidden">
                            <div className="h-full bg-accent/60 rounded-full" style={{ width: `${pct * 100}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center text-text-secondary tabular-nums">{gb}</td>
                    </tr>
                    {i === 5 && conf !== "all" && (
                      <tr><td colSpan={6} className="py-0"><div className="h-px bg-accent/30" /><p className="text-[9px] text-accent text-center py-0.5">{t.statsPage.playoffLine}</p></td></tr>
                    )}
                    {i === 9 && conf !== "all" && (
                      <tr><td colSpan={6} className="py-0"><div className="h-px bg-yellow-500/30" /><p className="text-[9px] text-yellow-500 text-center py-0.5">{t.statsPage.playInLine}</p></td></tr>
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
