"use client";

import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { PlayerNewsLoading } from "./PlayerDetailsLoading";

interface NewsItem {
  headline: string;
  description: string;
  link: string;
  published: string;
  image?: string;
}

export default function PlayerNews({ playerName, showEmpty = false }: { playerName: string; showEmpty?: boolean }) {
  const { t, locale } = useLocale();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/news?q=${encodeURIComponent(playerName)}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!res.ok) { setLoading(false); return; }
        const json = await res.json();
        if (!controller.signal.aborted && json.data) setNews(json.data);
      } catch { /* ignore */ }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => controller.abort();
  }, [playerName]);

  if (loading) return <PlayerNewsLoading />;

  if (news.length === 0) return showEmpty ? <p role="status" className="sm:hidden rounded-xl bg-bg-secondary p-5 text-sm text-text-secondary">{locale === "zh" ? "暂时没有可展示的相关新闻。新闻来源可能不可用，请稍后再试。" : "No related news is available to display. The news source may be unavailable; try again later."}</p> : null;

  return (
    <div className="glass-tile overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ News</p>
        <h3 className="text-sm font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-1">
          <Newspaper size={14} className="text-accent-amber" />
          {t.playerNews.title}
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
