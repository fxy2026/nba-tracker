"use client";

import { useEffect, useState } from "react";

// Career row from /api/player's careerSeasons — the SeasonTotalsRegularSeason
// result set, or the ESPN fallback (same field names). Shooting-volume
// columns can be absent on very old seasons, so they stay optional.
export interface CareerSeasonRow {
  SEASON_ID: string;
  TEAM_ABBREVIATION: string;
  GP: number;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  STL: number;
  BLK: number;
  FG_PCT: number;
  FG3_PCT: number;
  FT_PCT: number;
  FGA?: number | null;
  FG3A?: number | null;
  FTA?: number | null;
}

export interface PlayerCareerData {
  careerSeasons: CareerSeasonRow[];
}

// Module-level promise cache: PlayerStatsBundle and PlayerAdvancedStats mount
// on the same page and would otherwise issue duplicate /api/player requests.
const careerCache = new Map<string, Promise<PlayerCareerData>>();

function fetchPlayerCareer(url: string): Promise<PlayerCareerData> {
  const cached = careerCache.get(url);
  if (cached) return cached;
  const p = (async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`player api ${res.status}`);
    const raw = (await res.json()) as { careerSeasons?: CareerSeasonRow[] | null };
    return { careerSeasons: raw.careerSeasons ?? [] };
  })();
  // a rejected promise must not poison the cache — the next mount retries
  p.catch(() => careerCache.delete(url));
  careerCache.set(url, p);
  return p;
}

export function usePlayerCareer(personId: number, name: string, teamAbbr: string): {
  data: PlayerCareerData | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
} {
  const [data, setData] = useState<PlayerCareerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const qs = new URLSearchParams({ id: String(personId) });
  if (name) qs.set("name", name);
  if (teamAbbr) qs.set("team", teamAbbr);
  const url = `/api/player?${qs}`;

  // Loading state reset on url/retry change — intentional dep-change refetch pattern.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    fetchPlayerCareer(url).then(
      (d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      },
      () => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url, retryKey]);

  const retry = () => {
    careerCache.delete(url);
    setRetryKey((k) => k + 1);
  };

  return { data, loading, error, retry };
}
