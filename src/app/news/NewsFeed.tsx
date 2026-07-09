"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Newspaper } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { formatGameDate, formatRelative } from "@/lib/dates";

export interface NewsArticle {
  id: string;
  // ESPN article type — drives the Hupu-style category prefix tag
  type: string;
  headline: string;
  description: string;
  // External ESPN article URL ("" when the feed item carries none)
  link: string;
  // ISO timestamp
  published: string;
  byline: string;
  image: string;
  // Internal team pages trivially derived from ESPN team categories
  teams: { tricode: string; label: string }[];
}

const TYPE_META: Record<string, { zh: string; en: string; cls: string }> = {
  HeadlineNews: { zh: "头条", en: "Headline", cls: "bg-accent/10 text-accent" },
  Story: { zh: "报道", en: "Story", cls: "bg-accent-amber/10 text-accent-amber" },
  Recap: { zh: "战报", en: "Recap", cls: "bg-success/10 text-success" },
  Preview: { zh: "前瞻", en: "Preview", cls: "bg-[#A855F7]/10 text-[#A855F7]" },
  Media: { zh: "集锦", en: "Media", cls: "bg-danger/10 text-danger" },
};

const FALLBACK_TYPE = { zh: "资讯", en: "News", cls: "bg-bg-hover text-text-secondary" };

const TYPE_ORDER = ["HeadlineNews", "Story", "Recap", "Preview", "Media"];

// Relative time computed against the server fetch timestamp (passed as a
// prop) so SSR markup and hydration agree — Date.now() here would drift.
function formatPublished(iso: string, now: number, isZh: boolean): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  const locale = isZh ? "zh" : "en";
  const rel = formatRelative(now - ts, locale, "ago");
  // Empty past a week — degrade to an absolute date (Beijing time).
  return rel || formatGameDate(new Date(ts), locale, {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  });
}

export default function NewsFeed({ articles, fetchedAt }: { articles: NewsArticle[]; fetchedAt: number }) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);

  const typesPresent = useMemo(() => {
    const present = new Set(articles.map((a) => a.type));
    return TYPE_ORDER.filter((t) => present.has(t));
  }, [articles]);

  const teamsPresent = useMemo(() => {
    const set = new Set<string>();
    for (const a of articles) for (const tm of a.teams) set.add(tm.tricode);
    return [...set].sort();
  }, [articles]);

  const filtered = articles.filter(
    (a) =>
      (!typeFilter || a.type === typeFilter) &&
      (!teamFilter || a.teams.some((tm) => tm.tricode === teamFilter))
  );

  const hasFilter = Boolean(typeFilter || teamFilter);
  const chipCls = (active: boolean) =>
    `text-xs px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
      active
        ? "bg-accent text-white"
        : "bg-bg-card border border-border text-text-secondary hover:text-text-primary"
    }`;

  return (
    <div>
      {/* Category filter — ESPN article types mapped to Hupu-style tags */}
      {typesPresent.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button onClick={() => setTypeFilter(null)} className={chipCls(!typeFilter)}>
            {isZh ? "全部" : "All"}
          </button>
          {typesPresent.map((tp) => {
            const meta = TYPE_META[tp] ?? FALLBACK_TYPE;
            return (
              <button key={tp} onClick={() => setTypeFilter(typeFilter === tp ? null : tp)} className={chipCls(typeFilter === tp)}>
                {isZh ? meta.zh : meta.en}
              </button>
            );
          })}
        </div>
      )}

      {/* Team filter — only teams actually present in the feed */}
      {teamsPresent.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 mr-1">
            {isZh ? "球队" : "Teams"}
          </span>
          <button onClick={() => setTeamFilter(null)} className={chipCls(!teamFilter)}>
            {isZh ? "全部" : "All"}
          </button>
          {teamsPresent.map((tri) => (
            <button key={tri} onClick={() => setTeamFilter(teamFilter === tri ? null : tri)} className={`${chipCls(teamFilter === tri)} font-mono`}>
              {tri}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="glass-tile p-12 text-center">
          <Newspaper size={32} className="text-text-secondary mx-auto mb-3 opacity-30" />
          <p className="text-text-secondary">{isZh ? "没有符合筛选条件的资讯" : "No news matches the current filters"}</p>
          <button
            onClick={() => { setTypeFilter(null); setTeamFilter(null); }}
            className="text-xs text-accent hover:underline mt-2 cursor-pointer"
          >
            {isZh ? "清除筛选" : "Clear filters"}
          </button>
        </div>
      ) : (
        <div className="glass-tile overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary">
              {isZh ? "最新资讯" : "Latest"}
            </p>
            <p className="text-[10px] font-mono tabular-nums text-text-secondary">
              {filtered.length}
              {hasFilter ? ` / ${articles.length}` : ""}
            </p>
          </div>
          <div className="divide-y divide-border/50">
            {filtered.map((a) => {
              const meta = TYPE_META[a.type] ?? FALLBACK_TYPE;
              const time = formatPublished(a.published, fetchedAt, isZh);
              const thumb = a.image ? (
                <div className="w-20 h-14 sm:w-24 sm:h-16 rounded-lg overflow-hidden bg-bg-secondary shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- ESPN CDN not in next/image remotePatterns; same precedent as PlayerNews */}
                  <img src={a.image} alt="" loading="lazy" width={96} height={64} className="w-full h-full object-cover" />
                </div>
              ) : null;
              return (
                <article key={a.id} className="flex gap-3 px-4 py-3 hover:bg-bg-hover/50 transition-colors">
                  {thumb && (a.link ? (
                    <a href={a.link} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true" className="shrink-0">
                      {thumb}
                    </a>
                  ) : thumb)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${meta.cls}`}>
                        {isZh ? meta.zh : meta.en}
                      </span>
                      {a.teams.map((tm) => (
                        <Link
                          key={tm.tricode}
                          href={`/team/${tm.tricode}`}
                          title={tm.label}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-bg-hover text-text-secondary hover:text-accent transition-colors font-mono"
                        >
                          {tm.tricode}
                        </Link>
                      ))}
                    </div>
                    {a.link ? (
                      <a
                        href={a.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-text-primary hover:text-accent transition-colors"
                      >
                        {a.headline}
                        <ExternalLink size={11} className="inline ml-1 mb-0.5 text-text-secondary/60" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-text-primary">{a.headline}</span>
                    )}
                    {a.description && (
                      <p className="text-xs text-text-secondary line-clamp-2 mt-1">{a.description}</p>
                    )}
                    <p className="text-[10px] text-text-secondary mt-1.5 font-mono uppercase tracking-[0.15em]">
                      {time}
                      {a.byline ? ` · ${a.byline}` : ""} · ESPN
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[10px] text-text-secondary/60 mt-3 font-mono">
        {isZh ? "来源: ESPN (英文原文) · 链接跳转至 espn.com" : "Source: ESPN (English) · links open espn.com"}
      </p>
    </div>
  );
}
