"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ScorePeriod } from "@/lib/reported-score-chart";

interface LinkedGamePeriod {
  period: ScorePeriod;
  selectPeriod: (period: ScorePeriod) => void;
}

const GamePeriodContext = createContext<LinkedGamePeriod | null>(null);

/** Only the shared viewing range lives here. Both factual datasets stay separate. */
export default function GamePeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<ScorePeriod>(0);
  const selectPeriod = useCallback((next: ScorePeriod) => {
    if (Number.isInteger(next) && next >= 0 && next <= 4) setPeriod(next);
  }, []);
  const value = useMemo(() => ({ period, selectPeriod }), [period, selectPeriod]);
  return <GamePeriodContext.Provider value={value}>
    <div data-linked-game-period={period === 0 ? "all" : period}>{children}</div>
  </GamePeriodContext.Provider>;
}

/** Standalone charts retain their own period controls, including court overtime. */
export function useLinkedGamePeriod() {
  return useContext(GamePeriodContext);
}
