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

export default function NbaNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/news");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setNews(json.data || []);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <Newspaper size={14} className="text-accent" />
          <h2 className="text-sm font-medium text-text-secondary">NBA Headlines</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-bg-card rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (news.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <Newspaper size={14} className="text-accent" />
        <h2 className="text-sm font-medium text-text-secondary">NBA Headlines</h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">{news.length}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {news.map((item, i) => (
          <a
            key={i}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 bg-bg-card border border-border rounded-xl p-3 hover:border-accent/50 transition-colors group"
          >
            {item.image && (
              <div className="w-20 h-14 rounded-lg overflow-hidden bg-bg-secondary shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary line-clamp-2 group-hover:text-accent transition-colors">
                {item.headline}
              </p>
              <p className="text-[10px] text-text-secondary mt-1">{item.published}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
