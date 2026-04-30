"use client";

import { useEffect, useState } from "react";
import type { ScheduleGame } from "@/lib/api";
import PlayoffBracketV2 from "./PlayoffBracketV2";
import RecentHighlights from "./RecentHighlights";

export default function HomeExtra() {
  const [data, setData] = useState<{ playoffs: ScheduleGame[]; recent: ScheduleGame[] } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/extra", { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!controller.signal.aborted && d) setData(d); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setData((prev) => prev ?? { playoffs: [], recent: [] }); });
    return () => controller.abort();
  }, []);

  if (error) return null;

  if (!data) {
    return (
      <div className="mt-10 space-y-6">
        {[1, 2].map((i) => (
          <div key={i}>
            <div className="h-5 w-32 skeleton-shimmer rounded mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-24 skeleton-shimmer rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (data.playoffs.length === 0 && data.recent.length === 0) return null;

  return (
    <div className="mt-10 space-y-10 content-visibility-auto" style={{ containIntrinsicSize: "auto 400px" }}>
      {data.playoffs.length > 0 && <PlayoffBracketV2 games={data.playoffs} />}
      {data.recent.length > 0 && <RecentHighlights games={data.recent} />}
    </div>
  );
}
