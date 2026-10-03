"use client";

import { useEffect, useRef, useState } from "react";
import { createPlayerCareerLoader } from "./player-career-cache";
import type { PlayerCareerData } from "./player-career-data";
export type { CareerSeasonRow, PlayerCareerData } from "./player-career-data";

// Lazy fetch binding keeps this client module safe during server rendering.
const loadCareer = createPlayerCareerLoader((...args) => fetch(...args));
interface State { url: string; data: PlayerCareerData | null; loading: boolean; error: boolean; stale: boolean; }

export function usePlayerCareer(personId: number, name: string, teamAbbr: string, initialData?: PlayerCareerData | null): {
  data: PlayerCareerData | null; loading: boolean; error: boolean; stale: boolean; retry: () => void;
} {
  const [state, setState] = useState<State>({ url: "", data: null, loading: true, error: false, stale: false });
  const [retryKey, setRetryKey] = useState(0);
  const retryUrl = useRef<string | null>(null);
  const qs = new URLSearchParams({ id: String(personId), context: "2" });
  if (name) qs.set("name", name);
  if (teamAbbr) qs.set("team", teamAbbr);
  const url = `/api/player?${qs}`;

  const seeded = loadCareer.read(url, initialData);

  useEffect(() => {
    loadCareer.seed(url, initialData);
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(previous => ({ url, data: previous.url === url ? previous.data ?? loadCareer.read(url) : loadCareer.read(url), loading: true, error: false, stale: previous.url === url ? previous.stale || loadCareer.read(url)?.stale === true : loadCareer.read(url)?.stale === true }));
    const apply = (result: Awaited<ReturnType<typeof loadCareer>>) => {
      if (!cancelled) setState({ url, data: result.data, loading: false, error: result.unavailable, stale: result.stale });
    };
    const unsubscribe = loadCareer.subscribe(url, apply);
    const explicitRetry = retryUrl.current === url;
    retryUrl.current = null;
    loadCareer(url, explicitRetry).then(apply);
    // Shared requests survive one consumer unmount; late results cannot update
    // that consumer or display a previous player's data during navigation.
    return () => { cancelled = true; unsubscribe(); };
  }, [url, retryKey, initialData]);

  const visible = state.url === url ? state : { data: seeded, loading: true, error: false, stale: seeded?.stale === true };
  return { data: visible.data, loading: visible.loading, error: visible.error, stale: visible.stale, retry: () => { retryUrl.current = url; setRetryKey(k => k + 1); } };
}
