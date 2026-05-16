"use client";

import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

interface NewsItem {
  headline: string;
  description: string;
  link: string;
  published: string;
  image?: string;
}

export default function PlayerNews({ playerName }: { playerName: string }) {
  const { t } = useLocale();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/news?q=${encodeURIComponent(playerName)}`, { signal: controller.signal });
        if (!res.ok) { setLoading(false); return; }
        const json = await res.json();
        if (!controller.signal.aborted && json.data) setNews(json.data);
      } catch { /* ignore */ }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => controller.abort();
  }, [playerName]);

  if (loading) {
    return (
      <div className="glass-tile p-4">
        <div className="mb-3">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ News</p>
          <h3 className="text-sm font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-1">
            <Newspaper size={14} className="text-accent-amber" />
            {t.playerNews.title}
          </h3>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-bg-secondary/60 rounded-lg skeleton-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (news.length === 0) return null;

  return (
    <div className="glass-tile overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ News</p>
        <h3 className="text-sm font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-1">
          <Newspaper size={14} className="text-accent-amber" />
          Latest News
        </h3>
      </div>
      <div className="divide-y divide-border/50">
        {news.map((item, i) => (
          <a
            key={i}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 px-4 py-3 hover:bg-bg-hover transition-colors cursor-pointer group"
          >
            {item.image && (
              <div className="w-16 h-12 rounded-lg overflow-hidden bg-bg-secondary shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image} alt={item.headline} loading="lazy" width={64} height={48} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary line-clamp-2 group-hover:text-accent transition-colors">{item.headline}</p>
              <p className="text-[10px] text-text-secondary mt-1 font-mono uppercase tracking-[0.15em]">{item.published}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
