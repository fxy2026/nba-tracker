"use client";

import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";

interface NewsItem {
  headline: string;
  description: string;
  link: string;
  published: string;
  image?: string;
}

export default function PlayerNews({ playerName }: { playerName: string }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/news?q=${encodeURIComponent(playerName)}`);
        if (!res.ok) { setLoading(false); return; }
        const json = await res.json();
        if (!cancelled && json.data) setNews(json.data);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [playerName]);

  if (loading) {
    return (
      <div className="bg-bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Newspaper size={14} className="text-accent" />
          <h3 className="text-sm font-semibold">Latest News</h3>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-bg-secondary rounded-lg skeleton-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (news.length === 0) return null;

  return (
    <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Newspaper size={14} className="text-accent" />
        <h3 className="text-sm font-semibold">Latest News</h3>
      </div>
      <div className="divide-y divide-border/50">
        {news.map((item, i) => (
          <a
            key={i}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 px-4 py-3 hover:bg-bg-hover transition-colors"
          >
            {item.image && (
              <div className="w-16 h-12 rounded-lg overflow-hidden bg-bg-secondary shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image} alt={item.headline} loading="lazy" width={64} height={48} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary line-clamp-2">{item.headline}</p>
              <p className="text-xs text-text-secondary mt-0.5">{item.published}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
