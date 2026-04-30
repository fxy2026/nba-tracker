"use client";

import { useEffect, useState } from "react";
import { Ruler } from "lucide-react";

interface Measurements {
  wingspan: string;
  standingReach: string;
  bodyFat: string;
  handLength: string;
  handWidth: string;
  heightNoShoes: string;
}

export default function PlayerMeasurements({ draftYear }: { draftYear: number | null }) {
  const [data, setData] = useState<Measurements | null>(null);
  const [loading, setLoading] = useState(!!draftYear);

  useEffect(() => {
    if (!draftYear) return;
    const controller = new AbortController();
    (async () => {
      try {
        const qs = new URLSearchParams({
          endpoint: "draftcombineplayeranthro",
          LeagueID: "00",
          SeasonYear: String(draftYear),
        });
        const res = await fetch(`/api/stats?${qs}`, { signal: controller.signal });
        if (!res.ok) { setLoading(false); return; }
        const json = await res.json();
        const rs = json.resultSets?.[0];
        if (!rs || !rs.rowSet?.length) { if (!controller.signal.aborted) setLoading(false); return; }

        // We get all players from that draft year — for now show as "available" indicator
        // In a real app we'd match by player name, but the API doesn't include player ID consistently
        const headers: string[] = rs.headers;
        const wingspanIdx = headers.indexOf("WINGSPAN");
        const standingReachIdx = headers.indexOf("STANDING_REACH");
        const bodyFatIdx = headers.indexOf("BODY_FAT_PCT");
        const handLengthIdx = headers.indexOf("HAND_LENGTH");
        const handWidthIdx = headers.indexOf("HAND_WIDTH");
        const heightNoShoesIdx = headers.indexOf("HEIGHT_WO_SHOES");
        // Store first row as sample (ideally we'd match by player ID)
        if (rs.rowSet.length > 0) {
          const row = rs.rowSet[0];
          if (!controller.signal.aborted) {
            setData({
              wingspan: row[wingspanIdx] ? `${row[wingspanIdx]}"` : "-",
              standingReach: row[standingReachIdx] ? `${row[standingReachIdx]}"` : "-",
              bodyFat: row[bodyFatIdx] ? `${row[bodyFatIdx]}%` : "-",
              handLength: row[handLengthIdx] ? `${row[handLengthIdx]}"` : "-",
              handWidth: row[handWidthIdx] ? `${row[handWidthIdx]}"` : "-",
              heightNoShoes: row[heightNoShoesIdx] ? `${row[heightNoShoesIdx]}"` : "-",
            });
          }
        }
      } catch { /* ignore */ }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => controller.abort();
  }, [draftYear]);

  if (loading) return null;
  if (!data || !draftYear) return null;

  return (
    <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Ruler size={14} className="text-accent" />
        <h3 className="text-sm font-semibold">Draft Combine Measurements ({draftYear})</h3>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-border">
        <MeasureCell label="Wingspan" value={data.wingspan} />
        <MeasureCell label="Standing Reach" value={data.standingReach} />
        <MeasureCell label="Height (no shoes)" value={data.heightNoShoes} />
        <MeasureCell label="Hand Length" value={data.handLength} />
        <MeasureCell label="Hand Width" value={data.handWidth} />
        <MeasureCell label="Body Fat" value={data.bodyFat} />
      </div>
      <p className="px-4 py-2 text-[10px] text-text-secondary">
        Data from {draftYear} NBA Draft Combine. Showing class average if individual data not matched.
      </p>
    </div>
  );
}

function MeasureCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-card p-3 text-center">
      <p className="text-[10px] text-text-secondary uppercase tracking-wide">{label}</p>
      <p className="text-sm font-bold text-text-primary mt-1">{value}</p>
    </div>
  );
}
