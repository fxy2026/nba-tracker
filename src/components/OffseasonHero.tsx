import Link from "next/link";
import Image from "next/image";
import { Trophy, CalendarClock, ArrowLeftRight, Newspaper, ArrowRight, Sparkles } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { formatGameDate } from "@/lib/dates";
import { teamLogoUrl } from "@/lib/teamUrls";
import { SEASON_SNAPSHOT, type SnapshotTeam } from "@/lib/season-snapshot";
import { CURRENT_SEASON, PLAYOFFS_END, NEXT_SEASON_START_ESTIMATE } from "@/lib/constants";

interface EspnTxn {
  date?: string;
  description?: string;
  team?: { abbreviation?: string; logos?: { href?: string }[] };
}
interface HeroTxn {
  date: string;
  teamAbbr: string;
  teamLogo: string;
  description: string;
}
interface HeroNews {
  headline: string;
  link: string;
  published: string;
}

// Mirrors the /api/transactions route fetch (UA header + 5s abort + revalidate
// + shape guard); best-effort — any failure degrades to an empty section.
async function fetchLatestTransactions(): Promise<HeroTxn[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/transactions?limit=20",
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 1800 },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    const items: EspnTxn[] = data.transactions || data.items || [];
    if (!Array.isArray(items)) return [];
    return items.slice(0, 5).map((t) => ({
      date: t.date || "",
      teamAbbr: t.team?.abbreviation || "",
      teamLogo: t.team?.logos?.[0]?.href || "",
      description: t.description || "",
    }));
  } catch {
    return [];
  }
}

async function fetchTopNews(): Promise<HeroNews[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=10",
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 1800 },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    const articles: { headline?: string; links?: { web?: { href?: string } }; published?: string }[] =
      data.articles || [];
    if (!Array.isArray(articles)) return [];
    return articles.slice(0, 3).map((a) => ({
      headline: a.headline || "",
      link: a.links?.web?.href || "",
      published: a.published || "",
    }));
  } catch {
    return [];
  }
}

// Derive last season's champion from the frozen snapshot's Finals games
// (playoff prefix "004", round digit "4") instead of importing T4's
// season-recap lib, so this hero compiles and ships independently.
function deriveChampion(): { champ: SnapshotTeam; runner: SnapshotTeam; seriesText: string } | null {
  const finals = SEASON_SNAPSHOT.finishedGames.filter(
    (g) => g.gameId.startsWith("004") && g.gameId.charAt(7) === "4"
  );
  if (finals.length === 0) return null;
  const wins: Record<string, number> = {};
  for (const g of finals) {
    const winner = g.homeScore > g.awayScore ? g.homeTricode : g.awayTricode;
    wins[winner] = (wins[winner] || 0) + 1;
  }
  const ranked = Object.entries(wins).sort((a, b) => b[1] - a[1]);
  if (ranked.length < 2) return null;
  const champ = SEASON_SNAPSHOT.teams.find((t) => t.tricode === ranked[0][0]);
  const runner = SEASON_SNAPSHOT.teams.find((t) => t.tricode === ranked[1][0]);
  if (!champ || !runner) return null;
  return { champ, runner, seriesText: `${ranked[0][1]}-${ranked[1][1]}` };
}

export default async function OffseasonHero() {
  // Offseason predicate: strictly after last season's playoffs and before the
  // estimated next tip-off. Evaluated before any await, so in-season this
  // returns null with no fetch and no layout impact on the home page.
  const now = new Date().getTime();
  const playoffsEnd = new Date(PLAYOFFS_END).getTime();
  const nextStart = new Date(NEXT_SEASON_START_ESTIMATE).getTime();
  if (!(now > playoffsEnd && now < nextStart)) return null;

  const isZh = (await getLocale()) === "zh";
  const [transactions, news] = await Promise.all([fetchLatestTransactions(), fetchTopNews()]);
  const finals = deriveChampion();
  const daysUntil = Math.max(0, Math.ceil((nextStart - now) / 86_400_000));

  const fmtDate = (iso: string) =>
    formatGameDate(iso, isZh ? "zh" : "en", { month: "short", day: "numeric" });

  return (
    <section className="mt-4 mb-2">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={12} className="text-accent-amber" />
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent-amber">
          {isZh ? "休赛期" : "Offseason"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Champion banner + countdown */}
        <div className="space-y-3">
          {finals && (
            <Link
              href="/season/2025-26"
              className="glass-tile relative overflow-hidden p-4 flex items-center gap-3 group cursor-pointer hover:border-accent/40 transition-colors"
            >
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.5) 0%, transparent 70%)" }}
              />
              <Image
                src={teamLogoUrl(finals.champ.teamId)}
                alt={finals.champ.tricode}
                width={48}
                height={48}
                unoptimized
                className="relative shrink-0"
              />
              <div className="relative min-w-0">
                <div className="flex items-center gap-1.5">
                  <Trophy size={11} className="text-accent-amber shrink-0" />
                  <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-accent-amber">
                    {CURRENT_SEASON} {isZh ? "总冠军" : "Champions"}
                  </span>
                </div>
                <p className="font-bold text-text-primary truncate mt-0.5">
                  {finals.champ.teamCity} {finals.champ.teamName}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-text-secondary">
                  {isZh ? "总决赛" : "Finals"} {finals.seriesText} {isZh ? "胜" : "def."}{" "}
                  {finals.runner.teamCity} {finals.runner.teamName}
                </p>
              </div>
            </Link>
          )}

          <div className="glass-tile p-4 flex items-center gap-3">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <CalendarClock size={18} className="text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">
                {isZh ? "预计开赛" : "Est. tip-off"}
              </p>
              <p className="font-bold text-text-primary">
                <span className="font-mono tabular-nums text-accent">{daysUntil}</span> {isZh ? "天" : "days"}
              </p>
              <p className="text-[11px] text-text-secondary">
                {isZh ? "预计 10 月下旬回归" : "est. late October"}
              </p>
            </div>
          </div>
        </div>

        {/* Latest transactions */}
        <Link
          href="/transactions"
          className="glass-tile p-4 group cursor-pointer hover:border-accent/40 transition-colors block"
        >
          <div className="flex items-center gap-1.5 mb-3">
            <ArrowLeftRight size={12} className="text-accent" />
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">
              {isZh ? "最新交易" : "Latest moves"}
            </span>
            <ArrowRight
              size={12}
              className="text-text-secondary group-hover:text-accent group-hover:translate-x-0.5 transition-all ml-auto"
            />
          </div>
          {transactions.length === 0 ? (
            <p className="text-[11px] text-text-secondary">
              {isZh ? "暂无交易数据" : "No transactions available"}
            </p>
          ) : (
            <ul className="space-y-2">
              {transactions.map((tx, i) => (
                <li key={i} className="flex items-start gap-2">
                  {tx.teamLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ESPN CDN not in next/image remotePatterns; same precedent as NewsFeed
                    <img
                      src={tx.teamLogo}
                      alt={tx.teamAbbr}
                      width={16}
                      height={16}
                      loading="lazy"
                      className="mt-0.5 shrink-0"
                    />
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}
                  <span className="text-[11px] text-text-secondary leading-snug line-clamp-2">
                    {fmtDate(tx.date) && (
                      <span className="text-text-secondary/50 font-mono mr-1">{fmtDate(tx.date)}</span>
                    )}
                    {tx.description}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Link>

        {/* Top news + quick links */}
        <div className="space-y-3">
          <div className="glass-tile p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Newspaper size={12} className="text-accent" />
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">
                {isZh ? "热点新闻" : "Headlines"}
              </span>
            </div>
            {news.length === 0 ? (
              <p className="text-[11px] text-text-secondary">{isZh ? "暂无新闻" : "No headlines available"}</p>
            ) : (
              <ul className="space-y-2">
                {news.map((n, i) => (
                  <li key={i}>
                    <a
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-text-secondary hover:text-accent transition-colors leading-snug line-clamp-2 block"
                    >
                      {n.headline}
                      {fmtDate(n.published) && (
                        <span className="text-text-secondary/50 font-mono ml-1">· {fmtDate(n.published)}</span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/draft/2026"
              className="glass-tile p-3 flex items-center gap-2 group cursor-pointer hover:border-accent/40 transition-colors"
            >
              <Sparkles size={14} className="text-accent shrink-0" />
              <span className="text-[11px] font-medium text-text-primary group-hover:text-accent transition-colors">
                {isZh ? "2026 选秀" : "2026 Draft"}
              </span>
            </Link>
            <Link
              href="/season/2025-26"
              className="glass-tile p-3 flex items-center gap-2 group cursor-pointer hover:border-accent/40 transition-colors"
            >
              <Trophy size={14} className="text-accent shrink-0" />
              <span className="text-[11px] font-medium text-text-primary group-hover:text-accent transition-colors">
                {isZh ? "赛季回顾" : "Season recap"}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
