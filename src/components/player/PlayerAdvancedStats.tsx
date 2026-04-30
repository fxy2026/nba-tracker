"use client";

import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";

interface AdvancedData {
  TS_PCT: number | null;
  EFG_PCT: number | null;
  USG_PCT: number | null;
}

export default function PlayerAdvancedStats({ playerId }: { playerId: number }) {
  const [stats, setStats] = useState<AdvancedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Fetch from playercareerstats which includes FGA, FTA, FG_PCT, FG3_PCT, FT_PCT
        const res = await fetch(`/api/player?id=${playerId}`);
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        const seasons = data.careerSeasons;
        if (!seasons || seasons.length === 0) { setLoading(false); return; }

        // Get most recent season for advanced calculations
        const latest = seasons[seasons.length - 1];
        const pts = latest.PTS;
        const fga = latest.FGA;
        const fta = latest.FTA;
        const fgPct = latest.FG_PCT;
        const fg3Pct = latest.FG3_PCT;
        const fg3a = latest.FG3A;

        // True Shooting %: PTS / (2 * (FGA + 0.44 * FTA))
        let tsPct: number | null = null;
        if (fga != null && fta != null && pts != null && (fga + 0.44 * fta) > 0) {
          tsPct = pts / (2 * (fga + 0.44 * fta));
        }

        // Effective FG%: (FGM + 0.5 * FG3M) / FGA — approximate from per-game
        let efgPct: number | null = null;
        if (fgPct != null && fg3Pct != null && fga != null && fg3a != null && fga > 0) {
          const fgm = fgPct * fga;
          const fg3m = fg3Pct * fg3a;
          efgPct = (fgm + 0.5 * fg3m) / fga;
        }

        if (!cancelled) {
          setStats({ TS_PCT: tsPct, EFG_PCT: efgPct, USG_PCT: null });
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [playerId]);

  if (loading) {
    return (
      <div className="h-20 bg-bg-secondary rounded-lg skeleton-shimmer" />
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
