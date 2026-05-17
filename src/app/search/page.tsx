import type { Metadata } from "next";
import { Search, Flame, GitCompareArrows, Crown, Activity, Heart, Users } from "lucide-react";
import Link from "next/link";
import SearchInput from "@/components/SearchInput";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PageHeader from "@/components/PageHeader";
import RelatedPages from "@/components/RelatedPages";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getTranslations(locale);
  return {
    title: t.meta.searchTitle,
    description: t.meta.searchDesc,
  };
}

const POPULAR_PLAYERS = [
  { id: 2544, name: "LeBron James", team: "LAL" },
  { id: 201142, name: "Kevin Durant", team: "PHX" },
  { id: 201939, name: "Stephen Curry", team: "GSW" },
  { id: 203507, name: "Giannis Antetokounmpo", team: "MIL" },
  { id: 203954, name: "Joel Embiid", team: "PHI" },
  { id: 1629029, name: "Luka Doncic", team: "DAL" },
  { id: 1628983, name: "Shai Gilgeous-Alexander", team: "OKC" },
  { id: 203999, name: "Nikola Jokic", team: "DEN" },
];

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const t = getTranslations(locale);
  const { q } = await searchParams;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <PageHeader eyebrow="Tool" icon={Search} title={t.searchPage.title} />
      <SearchInput initialQuery={q || ""} />

      {/* Quick filters — chips */}
      <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
        {([["Guard", t.searchPage.guard], ["Forward", t.searchPage.forward], ["Center", t.searchPage.center]] as const).map(([pos, label]) => (
          <a key={pos} href={`/search?q=${pos}`} className="chip">
            {label}
          </a>
        ))}
        <span className="text-text-secondary/40 mx-1">·</span>
        {["Lakers", "Celtics", "Warriors", "Nuggets"].map((team) => (
          <a key={team} href={`/search?q=${team}`} className="chip">
            {team}
          </a>
        ))}
      </div>

      {!q && (
        <div className="mt-8">
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ 01</p>
              <h2 className="text-base font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-1">
                <Flame size={14} className="text-accent-amber" />
                {t.searchPage.popularPlayers}
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {POPULAR_PLAYERS.map((p) => (
              <Link
                key={p.id}
                href={`/player/${p.id}`}
                className="flex items-center gap-2.5 glass-tile px-3 py-2.5 hover:border-accent/50 transition-colors group cursor-pointer"
              >
                <PlayerHeadshot personId={p.id} name={p.name} size={32} />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors truncate block">{p.name}</span>
                  <span className="text-[10px] text-text-secondary font-mono uppercase tracking-[0.15em]">{p.team}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Search Tips */}
      <div className="mt-8 text-center space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary/60">
          {t.searchPage.searchHint}
        </p>
        <p className="text-[10px] text-text-secondary/50">
          {t.searchPage.tip}
        </p>
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/compare", label: isZh ? "球员对比" : "Compare players", icon: GitCompareArrows },
          { href: "/all-time-leaders", label: isZh ? "历史排行" : "All-time leaders", icon: Crown },
          { href: "/rookie-watch", label: isZh ? "新秀关注" : "Rookie watch", icon: Activity },
          { href: "/favorites", label: isZh ? "我的收藏" : "My favorites", icon: Heart },
          { href: "/by-position", label: isZh ? "按位置" : "By position", icon: Users },
        ]}
      />
    </div>
  );
}
