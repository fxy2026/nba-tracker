"use client";

import { useEffect, useState } from "react";
import { Ruler } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { parsePlayerMeasurements, type PlayerMeasurements as Measurements } from "@/lib/player-measurements";

interface MeasurementState {
  key: string;
  data: Measurements | null;
}

export default function PlayerMeasurements({ playerId, draftYear }: { playerId: number; draftYear: number | null }) {
  const { t } = useLocale();
  const key = `${playerId}:${draftYear}`;
  const [result, setResult] = useState<MeasurementState>({ key, data: null });
  // Reset during render so navigating within a draft class never paints old data,
  // including A → B → A before B's request finishes.
  if (result.key !== key) setResult({ key, data: null });
  const data = result.key === key ? result.data : null;

  useEffect(() => {
    if (!Number.isSafeInteger(playerId) || playerId <= 0
      || draftYear === null || !Number.isInteger(draftYear) || draftYear < 1946 || draftYear > 9999) return;
    const controller = new AbortController();
    let active = true;
    const isCurrent = () => active && !controller.signal.aborted;
    (async () => {
      try {
        const qs = new URLSearchParams({
          endpoint: "draftcombineplayeranthro",
          LeagueID: "00",
          SeasonYear: String(draftYear),
        });
        const res = await fetch(`/api/stats?${qs}`, { signal: controller.signal });
        if (!isCurrent()) return;
        if (!res.ok) throw new Error("Combine measurements unavailable");
        const json: unknown = await res.json();
        if (isCurrent()) setResult({ key, data: parsePlayerMeasurements(json, playerId) });
      } catch {
        if (isCurrent()) setResult({ key, data: null });
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [playerId, draftYear, key]);

  // Unmatched, unavailable and pending data stay hidden rather than borrowing
  // another player's measurements or implying that the class average is known.
  if (!data || !draftYear) return null;

  return (
    <div className="glass-tile overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ Combine {draftYear}</p>
        <h3 className="text-sm font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-1">
          <Ruler size={14} className="text-accent-amber" />
          {t.playerMeasurements.title}
        </h3>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-border">
        <MeasureCell label={t.playerMeasurements.wingspan} value={data.wingspan} />
        <MeasureCell label={t.playerMeasurements.standingReach} value={data.standingReach} />
        <MeasureCell label={t.playerMeasurements.heightNoShoes} value={data.heightNoShoes} />
        <MeasureCell label={t.playerMeasurements.handLength} value={data.handLength} />
        <MeasureCell label={t.playerMeasurements.handWidth} value={data.handWidth} />
        <MeasureCell label={t.playerMeasurements.bodyFat} value={data.bodyFat} unit="%" />
      </div>
      <p className="px-4 py-2 text-[10px] text-text-secondary">
        {t.playerMeasurements.disclaimer}
      </p>
    </div>
  );
}

function MeasureCell({ label, value, unit = '"' }: { label: string; value: number | null; unit?: string }) {
  return (
    <div className="bg-bg-card p-3 text-center">
      <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary">{label}</p>
      <p className="text-base font-light font-mono tabular-nums text-text-primary mt-1">{value === null ? "—" : `${value}${unit}`}</p>
    </div>
  );
}
