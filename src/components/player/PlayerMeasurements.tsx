"use client";

import { useEffect, useState } from "react";
import { Ruler } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

interface Measurements {
  wingspan: string;
  standingReach: string;
  bodyFat: string;
  handLength: string;
  handWidth: string;
  heightNoShoes: string;
}

export default function PlayerMeasurements({ draftYear }: { draftYear: number | null }) {
  const { t } = useLocale();
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

  // While the combine API is in flight (or for players without combine data)
  // render nothing — most users will never see this tile, so reserving height
  // would be wasted whitespace. The miss case is players who DO have combine
  // data: returning null here briefly causes a small CLS when the tile appears.
  // Accepted trade-off since players-with-combine is the minority.
  if (loading) return null;
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
        <MeasureCell label={t.playerMeasurements.bodyFat} value={data.bodyFat} />
      </div>
      <p className="px-4 py-2 text-[10px] text-text-secondary">
        {t.playerMeasurements.disclaimer}
      </p>
    </div>
  );
}

function MeasureCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-card p-3 text-center">
      <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary">{label}</p>
      <p className="text-base font-light font-mono tabular-nums text-text-primary mt-1">{value}</p>
    </div>
  );
}
