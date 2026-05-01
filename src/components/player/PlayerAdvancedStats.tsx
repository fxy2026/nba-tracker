"use client";

import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

interface AdvancedData {
  TS_PCT: number | null;
  EFG_PCT: number | null;
  USG_PCT: number | null;
}

function computeAdvanced(seasons: Record<string, unknown>[]): AdvancedData | null {
  if (!seasons || seasons.length === 0) return null;
  const latest = seasons[seasons.length - 1] as Record<string, number>;
  const pts = latest.PTS;
  const fga = latest.FGA;
  const fta = latest.FTA;
  const fgPct = latest.FG_PCT;
  const fg3Pct = latest.FG3_PCT;
  const fg3a = latest.FG3A;
  let tsPct: number | null = null;
  if (fga != null && fta != null && pts != null && (fga + 0.44 * fta) > 0) {
    tsPct = pts / (2 * (fga + 0.44 * fta));
  }
  let efgPct: number | null = null;
  if (fgPct != null && fg3Pct != null && fga != null && fg3a != null && fga > 0) {
    const fgm = fgPct * fga;
    const fg3m = fg3Pct * fg3a;
    efgPct = (fgm + 0.5 * fg3m) / fga;
  }
  return { TS_PCT: tsPct, EFG_PCT: efgPct, USG_PCT: null };
}

export default function PlayerAdvancedStats({ playerId, playerName, teamTricode }: { playerId: number; playerName?: string; teamTricode?: string }) {
  const { t } = useLocale();
  const [stats, setStats] = useState<AdvancedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    (async () => {
      try {
        const qs = new URLSearchParams({ id: String(playerId) });
        if (playerName) qs.set("name", playerName);
        if (teamTricode) qs.set("team", teamTricode);
        const res = await fetch(`/api/player?${qs}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) { if (!controller.signal.aborted) setLoading(false); return; }
        const data = await res.json();
        if (!controller.signal.aborted) setStats(computeAdvanced(data.careerSeasons || []));
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [playerId, retryKey]);

  if (loading) {
    return (
      <div className="h-20 bg-bg-secondary rounded-lg skeleton-shimmer" />
    );
  }

  // If failed, just hide — advanced stats are supplementary
  if (error) return null;

  if (!stats || (stats.TS_PCT == null && stats.EFG_PCT == null)) return null;

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-2">
        <TrendingUp size={14} className="text-accent" />
        {t.playerAdvanced.title}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.TS_PCT != null && (
          <div className="bg-bg-secondary rounded-lg p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase tracking-wide">{t.playerAdvanced.tsPct}</p>
            <p className="text-xl font-bold mt-1 text-accent">{(stats.TS_PCT * 100).toFixed(1)}%</p>
            <p className="text-[9px] text-text-secondary">{t.playerAdvanced.trueShooting}</p>
            {stats.TS_PCT >= 0.6 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/15 text-success font-bold mt-1 inline-block">{t.playerAdvanced.elite}</span>}
            {stats.TS_PCT >= 0.55 && stats.TS_PCT < 0.6 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-bold mt-1 inline-block">{t.playerAdvanced.aboveAvg}</span>}
          </div>
        )}
        {stats.EFG_PCT != null && (
          <div className="bg-bg-secondary rounded-lg p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase tracking-wide">{t.playerAdvanced.efgPct}</p>
            <p className="text-xl font-bold mt-1 text-text-primary">{(stats.EFG_PCT * 100).toFixed(1)}%</p>
            <p className="text-[9px] text-text-secondary">{t.playerAdvanced.effectiveFg}</p>
            {stats.EFG_PCT >= 0.55 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/15 text-success font-bold mt-1 inline-block">{t.playerAdvanced.elite}</span>}
          </div>
        )}
        {stats.USG_PCT != null && (
          <div className="bg-bg-secondary rounded-lg p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase tracking-wide">{t.playerAdvanced.usgPct}</p>
            <p className="text-xl font-bold mt-1 text-text-primary">{(stats.USG_PCT * 100).toFixed(1)}%</p>
            <p className="text-[9px] text-text-secondary">{t.playerAdvanced.usageRate}</p>
          </div>
        )}
      </div>
    </div>
  );
}
