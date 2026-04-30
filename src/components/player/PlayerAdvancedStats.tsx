"use client";

import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";

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

interface Props {
  playerId: number;
  initialSeasons?: Record<string, unknown>[] | null;
}

export default function PlayerAdvancedStats({ playerId, initialSeasons }: Props) {
  const hasInitial = !!(initialSeasons?.length);
  const [stats, setStats] = useState<AdvancedData | null>(hasInitial ? computeAdvanced(initialSeasons!) : null);
  const [loading, setLoading] = useState(!hasInitial);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (hasInitial) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    (async () => {
      try {
        const res = await fetch(`/api/player?id=${playerId}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) { if (!cancelled) { setLoading(false); } return; }
        const data = await res.json();
        const computed = computeAdvanced(data.careerSeasons || []);
        if (!cancelled) {
          setStats(computed);
        }
      } catch {
        if (!cancelled) setError(true);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; controller.abort(); clearTimeout(timeout); };
  }, [playerId, retryKey, hasInitial]);

  if (loading) {
    return (
      <div className="h-20 bg-bg-secondary rounded-lg skeleton-shimmer" />
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg text-xs">
        <span className="text-text-secondary">Advanced stats failed to load</span>
        <button onClick={() => setRetryKey((k) => k + 1)} className="text-accent hover:underline ml-auto">Retry</button>
      </div>
    );
  }

  if (!stats || (stats.TS_PCT == null && stats.EFG_PCT == null)) return null;

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-2">
        <TrendingUp size={14} className="text-accent" />
        Advanced Stats (Latest Season)
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.TS_PCT != null && (
          <div className="bg-bg-secondary rounded-lg p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase tracking-wide">TS%</p>
            <p className="text-xl font-bold mt-1 text-accent">{(stats.TS_PCT * 100).toFixed(1)}%</p>
            <p className="text-[9px] text-text-secondary">True Shooting</p>
            {stats.TS_PCT >= 0.6 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/15 text-success font-bold mt-1 inline-block">Elite</span>}
            {stats.TS_PCT >= 0.55 && stats.TS_PCT < 0.6 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-bold mt-1 inline-block">Above Avg</span>}
          </div>
        )}
        {stats.EFG_PCT != null && (
          <div className="bg-bg-secondary rounded-lg p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase tracking-wide">eFG%</p>
            <p className="text-xl font-bold mt-1 text-text-primary">{(stats.EFG_PCT * 100).toFixed(1)}%</p>
            <p className="text-[9px] text-text-secondary">Effective FG</p>
            {stats.EFG_PCT >= 0.55 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/15 text-success font-bold mt-1 inline-block">Elite</span>}
          </div>
        )}
        {stats.USG_PCT != null && (
          <div className="bg-bg-secondary rounded-lg p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase tracking-wide">USG%</p>
            <p className="text-xl font-bold mt-1 text-text-primary">{(stats.USG_PCT * 100).toFixed(1)}%</p>
            <p className="text-[9px] text-text-secondary">Usage Rate</p>
          </div>
        )}
      </div>
    </div>
  );
}
