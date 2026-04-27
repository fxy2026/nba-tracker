"use client";

import { useEffect, useState } from "react";
import PlayoffBracketV2 from "./PlayoffBracketV2";
import RecentHighlights from "./RecentHighlights";

export default function HomeExtra() {
  const [data, setData] = useState<{ playoffs: never[]; recent: never[] } | null>(null);

  useEffect(() => {
    fetch("/api/extra")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
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
    <div className="mt-10 space-y-10">
      {data.playoffs.length > 0 && <PlayoffBracketV2 games={data.playoffs} />}
      {data.recent.length > 0 && <RecentHighlights games={data.recent} />}
    </div>
  );
}
