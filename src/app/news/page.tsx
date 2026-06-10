import type { Metadata } from "next";
import { Newspaper, AlertTriangle, ArrowLeftRight, ListOrdered, CalendarDays, TrendingUp } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import EmptyState from "@/components/EmptyState";
import { TEAM_META } from "@/lib/teams";
import { getLocale } from "@/lib/locale";
import NewsFeed, { type NewsArticle } from "./NewsFeed";

// ESPN's public undocumented API — same source as /api/news, fetched
// directly here (server-side) so the page gets the full 50-item feed
// instead of the route's 5-item slice tuned for PlayerNews.
const ESPN_NEWS = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=50";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isZh = locale === "zh";
  return {
    title: isZh ? "联盟资讯" : "League News",
    description: isZh
      ? "NBA 联盟资讯 — 来自 ESPN 的最新头条、战报、前瞻与集锦,支持按类型和球队筛选。"
      : "League-wide NBA news — the latest headlines, recaps, previews and media from ESPN, filterable by category and team.",
  };
}

interface EspnCategory {
  type?: string;
  description?: string;
}

interface EspnArticle {
  id?: number | string;
  type?: string;
  headline?: string;
  description?: string;
  published?: string;
  byline?: string;
  links?: { web?: { href?: string } };
  images?: { url?: string }[];
  categories?: EspnCategory[];
}

// Nickname-only match — nicknames are unique across the NBA, while city
// matching would confuse "Los Angeles Lakers" with LA Clippers.
function matchTeam(description: string) {
  const lower = description.toLowerCase();
  for (const meta of Object.values(TEAM_META)) {
    if (lower.includes(meta.name.toLowerCase())) return meta;
  }
  return null;
}

function publishedMs(iso: string): number {
  const ts = Date.parse(iso);
  return Number.isNaN(ts) ? 0 : ts;
}

// fetchedAt rides along so the client can render deterministic relative
// times (Date.now() in component render trips react-hooks/purity).
async function getNews(): Promise<{ articles: NewsArticle[]; fetchedAt: number }> {
  const fetchedAt = Date.now();
  try {
    const res = await fetch(ESPN_NEWS, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      next: { revalidate: 600 },
    });
    if (!res.ok) return { articles: [], fetchedAt };
    const json = await res.json();
    const raw: EspnArticle[] = json.articles || [];
    const articles = raw
      .filter((a) => a.headline)
      .map((a, i) => {
        const teams: NewsArticle["teams"] = [];
        for (const c of a.categories || []) {
          if (c.type !== "team" || !c.description) continue;
          const meta = matchTeam(c.description);
          if (meta && !teams.some((tm) => tm.tricode === meta.tricode)) {
            teams.push({ tricode: meta.tricode, label: c.description });
          }
        }
        return {
          id: String(a.id ?? i),
          type: a.type || "Story",
          headline: a.headline || "",
          description: a.description || "",
          link: a.links?.web?.href || "",
          published: a.published || "",
          byline: a.byline || "",
          image: a.images?.[0]?.url || "",
          teams: teams.slice(0, 3),
        };
      })
      .sort((x, y) => publishedMs(y.published) - publishedMs(x.published));
    return { articles, fetchedAt };
  } catch {
    return { articles: [], fetchedAt };
  }
}

export default async function NewsPage() {
  const [{ articles, fetchedAt }, locale] = await Promise.all([getNews(), getLocale()]);
  const isZh = locale === "zh";

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ label: isZh ? "联盟资讯" : "League News" }]} />

      <PageHeader
        eyebrow={isZh ? "联盟" : "League"}
        icon={Newspaper}
        title={isZh ? "联盟资讯" : "League News"}
        subtitle={isZh ? "来源: ESPN (英文原文) · 约每 10 分钟刷新" : "Source: ESPN (English) · refreshes about every 10 minutes"}
        action={articles.length > 0 ? (
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary">
            <span className="text-text-primary font-bold tabular-nums">{articles.length}</span> {isZh ? "条资讯" : "items"}
          </span>
        ) : undefined}
      />

      {articles.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title={isZh ? "暂无资讯" : "No news right now"}
          description={isZh ? "ESPN 资讯源暂时不可用,请稍后再试。" : "The ESPN news feed is temporarily unavailable. Please try again later."}
        />
      ) : (
        <NewsFeed articles={articles} fetchedAt={fetchedAt} />
      )}

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/injuries", label: isZh ? "伤病报告" : "Injuries", icon: AlertTriangle },
          { href: "/transactions", label: isZh ? "交易动态" : "Transactions", icon: ArrowLeftRight },
          { href: "/this-day", label: isZh ? "历史上的今天" : "On This Day", icon: CalendarDays },
          { href: "/standings", label: isZh ? "排行榜" : "Standings", icon: ListOrdered },
          { href: "/power-rankings", label: isZh ? "战力榜" : "Power Rankings", icon: TrendingUp },
        ]}
      />
    </div>
  );
}
