"use client";

import { useEffect, useState } from "react";
import type { ScheduleGame } from "@/lib/api";
import PlayoffBracketV2 from "./PlayoffBracketV2";
import RecentHighlights from "./RecentHighlights";

export default function HomeExtra() {
  const [data, setData] = useState<{ playoffs: ScheduleGame[]; recent: ScheduleGame[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/extra")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancelled && d) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled && !data) setData({ playoffs: [], recent: [] }); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) {
    return (
      <div className="mt-10 space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-5 w-32 bg-bg-card rounded mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-24 bg-bg-card rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-10" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 400px" }}>
      {data.playoffs.length > 0 && <PlayoffBracketV2 games={data.playoffs} />}
      {data.recent.length > 0 && <RecentHighlights games={data.recent} />}
    </div>
  );
}
