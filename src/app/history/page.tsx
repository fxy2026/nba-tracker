import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Crown, TrendingUp, Award, Calendar } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getTranslations(locale);
  return {
    title: t.meta.championsTitle,
    description: t.meta.championsDesc,
  };
}

const champions = [
  { year: 2026, champion: "TBD", fmvp: "TBD", runnerUp: "TBD", series: "TBD" },
  { year: 2025, champion: "TBD", fmvp: "TBD", runnerUp: "TBD", series: "TBD" },
  { year: 2024, champion: "Boston Celtics", fmvp: "Jaylen Brown", runnerUp: "Dallas Mavericks", series: "4-1" },
  { year: 2023, champion: "Denver Nuggets", fmvp: "Nikola Jokic", runnerUp: "Miami Heat", series: "4-1" },
  { year: 2022, champion: "Golden State Warriors", fmvp: "Stephen Curry", runnerUp: "Boston Celtics", series: "4-2" },
  { year: 2021, champion: "Milwaukee Bucks", fmvp: "Giannis Antetokounmpo", runnerUp: "Phoenix Suns", series: "4-2" },
  { year: 2020, champion: "Los Angeles Lakers", fmvp: "LeBron James", runnerUp: "Miami Heat", series: "4-2" },
  { year: 2019, champion: "Toronto Raptors", fmvp: "Kawhi Leonard", runnerUp: "Golden State Warriors", series: "4-2" },
  { year: 2018, champion: "Golden State Warriors", fmvp: "Kevin Durant", runnerUp: "Cleveland Cavaliers", series: "4-0" },
  { year: 2017, champion: "Golden State Warriors", fmvp: "Kevin Durant", runnerUp: "Cleveland Cavaliers", series: "4-1" },
  { year: 2016, champion: "Cleveland Cavaliers", fmvp: "LeBron James", runnerUp: "Golden State Warriors", series: "4-3" },
  { year: 2015, champion: "Golden State Warriors", fmvp: "Andre Iguodala", runnerUp: "Cleveland Cavaliers", series: "4-2" },
  { year: 2014, champion: "San Antonio Spurs", fmvp: "Kawhi Leonard", runnerUp: "Miami Heat", series: "4-1" },
  { year: 2013, champion: "Miami Heat", fmvp: "LeBron James", runnerUp: "San Antonio Spurs", series: "4-3" },
  { year: 2012, champion: "Miami Heat", fmvp: "LeBron James", runnerUp: "Oklahoma City Thunder", series: "4-1" },
  { year: 2011, champion: "Dallas Mavericks", fmvp: "Dirk Nowitzki", runnerUp: "Miami Heat", series: "4-2" },
  { year: 2010, champion: "Los Angeles Lakers", fmvp: "Kobe Bryant", runnerUp: "Boston Celtics", series: "4-3" },
  { year: 2009, champion: "Los Angeles Lakers", fmvp: "Kobe Bryant", runnerUp: "Orlando Magic", series: "4-1" },
  { year: 2008, champion: "Boston Celtics", fmvp: "Paul Pierce", runnerUp: "Los Angeles Lakers", series: "4-2" },
  { year: 2007, champion: "San Antonio Spurs", fmvp: "Tony Parker", runnerUp: "Cleveland Cavaliers", series: "4-0" },
  { year: 2006, champion: "Miami Heat", fmvp: "Dwyane Wade", runnerUp: "Dallas Mavericks", series: "4-2" },
  { year: 2005, champion: "San Antonio Spurs", fmvp: "Tim Duncan", runnerUp: "Detroit Pistons", series: "4-3" },
  { year: 2004, champion: "Detroit Pistons", fmvp: "Chauncey Billups", runnerUp: "Los Angeles Lakers", series: "4-1" },
  { year: 2003, champion: "San Antonio Spurs", fmvp: "Tim Duncan", runnerUp: "New Jersey Nets", series: "4-2" },
  { year: 2002, champion: "Los Angeles Lakers", fmvp: "Shaquille O'Neal", runnerUp: "New Jersey Nets", series: "4-0" },
  { year: 2001, champion: "Los Angeles Lakers", fmvp: "Shaquille O'Neal", runnerUp: "Philadelphia 76ers", series: "4-1" },
  { year: 2000, champion: "Los Angeles Lakers", fmvp: "Shaquille O'Neal", runnerUp: "Indiana Pacers", series: "4-2" },
];

export default async function HistoryPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const t = getTranslations(locale);
  // Detect sweeps and game-7s
  const sweeps = champions.filter((r) => r.series === "4-0");
  const game7s = champions.filter((r) => r.series === "4-3");

  // Detect repeat champions
  const repeats: string[] = [];
  for (let i = 1; i < champions.length; i++) {
    if (champions[i].champion !== "TBD" && champions[i].champion === champions[i - 1].champion && !repeats.includes(champions[i].champion)) {
      repeats.push(champions[i].champion);
    }
  }

  // Most FMVP awards
  const fmvpCounts: Record<string, number> = {};
  for (const r of champions) {
    if (r.fmvp !== "TBD") fmvpCounts[r.fmvp] = (fmvpCounts[r.fmvp] || 0) + 1;
  }
  const topFmvps = Object.entries(fmvpCounts).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { label: isZh ? "历史" : "History" },
          { label: isZh ? "历届冠军" : "NBA champions" },
        ]}
      />
      <PageHeader eyebrow="History" icon={Trophy} title={t.historyPage.title} />

      {/* Quick Facts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="glass-tile p-3 text-center">
          <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">{sweeps.length}</p>
          <p className="text-[10px] text-text-secondary uppercase">{t.historyPage.sweeps}</p>
        </div>
        <div className="glass-tile p-3 text-center">
          <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">{game7s.length}</p>
          <p className="text-[10px] text-text-secondary uppercase">{t.historyPage.game7s}</p>
        </div>
        <div className="glass-tile p-3 text-center">
          <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">{repeats.length}</p>
          <p className="text-[10px] text-text-secondary uppercase">{t.historyPage.repeatChamps}</p>
        </div>
        <div className="glass-tile p-3 text-center">
          <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">{topFmvps.length > 0 ? topFmvps[0][1] : 0}</p>
          <p className="text-[10px] text-text-secondary uppercase">{t.historyPage.mostFmvps}</p>
          {topFmvps.length > 0 && <p className="text-[10px] text-accent mt-0.5">{topFmvps[0][0]}</p>}
        </div>
      </div>

      {/* Multi-FMVP winners */}
      {topFmvps.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {topFmvps.map(([name, count]) => (
            <span key={name} className="chip chip-active" style={{ color: "var(--accent-amber)", borderColor: "rgba(245,158,11,0.4)", background: "color-mix(in srgb, var(--accent-amber) 12%, transparent)" }}>
              {name} · <span className="font-mono tabular-nums font-bold">{count}x FMVP</span>
            </span>
          ))}
        </div>
      )}

      <div className="glass-tile overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-bg-card">
              <tr className="border-b border-border text-text-secondary text-[10px] font-mono uppercase tracking-[0.15em]">
                <th className="text-left py-3 px-4">{t.historyPage.year}</th>
                <th className="text-left py-3 px-4">{t.historyPage.champion}</th>
                <th className="text-left py-3 px-4">{t.historyPage.finalsMvp}</th>
                <th className="text-left py-3 px-4">{t.historyPage.runnerUp}</th>
                <th className="text-left py-3 px-4">{t.historyPage.series}</th>
              </tr>
            </thead>
            <tbody>
              {champions.map((row, i) => {
                const isSweep = row.series === "4-0";
                const isGame7 = row.series === "4-3";
                const isRepeat = i > 0 && row.champion !== "TBD" && row.champion === champions[i - 1].champion;
                return (
                  <tr key={row.year} className={`border-b border-border/30 hover:bg-bg-hover/50 transition-colors ${row.champion === "TBD" ? "opacity-50" : ""}`}>
                    <td className="py-3 px-4 font-bold text-accent-amber font-mono tabular-nums">{row.year}</td>
                    <td className="py-3 px-4 font-medium text-text-primary">
                      {row.champion}
                      {isRepeat && <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-accent-amber/15 text-accent-amber font-bold">{t.historyPage.repeat}</span>}
                    </td>
                    <td className="py-3 px-4 text-text-secondary">
                      {row.fmvp}
                      {fmvpCounts[row.fmvp] >= 2 && row.fmvp !== "TBD" && <span className="ml-1 text-accent text-[10px]">({fmvpCounts[row.fmvp]}x)</span>}
                    </td>
                    <td className="py-3 px-4 text-text-secondary">{row.runnerUp}</td>
                    <td className="py-3 px-4">
                      <span className={`${isSweep ? "text-accent font-bold" : isGame7 ? "text-accent-amber font-medium" : "text-text-secondary"}`}>
                        {row.series}
                      </span>
                      {isSweep && <span className="ml-1 text-[9px] text-accent">{t.historyPage.sweep}</span>}
                      {isGame7 && <span className="ml-1 text-[9px] text-accent-amber">{t.historyPage.g7}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Championships by Franchise */}
      <div className="glass-tile overflow-hidden mt-8 p-4">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Trophy size={16} className="text-accent" />
          {t.historyPage.championshipsByFranchise}
        </h2>
        <div className="space-y-2">
          {(() => {
            const counts: Record<string, number> = {};
            for (const row of champions) {
              if (row.champion === "TBD") continue;
              counts[row.champion] = (counts[row.champion] || 0) + 1;
            }
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            const max = sorted[0]?.[1] || 1;
            return sorted.map(([team, count]) => (
              <div key={team} className="flex items-center gap-3">
                <span className="text-xs text-text-primary font-medium w-44 shrink-0 truncate">{team}</span>
                <div className="flex-1 h-5 bg-bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-accent/70 rounded-full flex items-center justify-end pr-2" style={{ width: `${(count / max) * 100}%` }}>
                    <span className="text-[10px] text-white font-bold">{count}</span>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Dynasties Section */}
      {repeats.length > 0 && (
        <div className="glass-tile overflow-hidden mt-8 p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Trophy size={16} className="text-accent-amber" />
            {t.historyPage.dynastyWatch}
          </h2>
          <div className="space-y-2">
            {repeats.map((team) => {
              const years = champions.filter((r) => r.champion === team).map((r) => r.year);
              return (
                <div key={team} className="flex items-center justify-between px-3 py-2 bg-bg-secondary rounded-lg">
                  <span className="text-sm font-medium text-text-primary">{team}</span>
                  <div className="flex items-center gap-1.5">
                    {years.map((y) => (
                      <span key={y} className="text-[10px] px-1.5 py-0.5 bg-accent/15 text-accent rounded font-medium">{y}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 text-center">
        <Link href="/" className="text-xs text-text-secondary hover:text-accent transition-colors">
          &larr; {t.common.backToHome}
        </Link>
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/all-time-leaders", label: isZh ? "历史排行" : "All-time leaders", icon: Crown },
          { href: "/milestones", label: isZh ? "生涯里程碑" : "Milestones", icon: TrendingUp },
          { href: "/records", label: isZh ? "纪录" : "Records", icon: Award },
          { href: "/best-games", label: isZh ? "最佳比赛" : "Best games", icon: Trophy },
          { href: "/this-day", label: isZh ? "历史上的今天" : "This day in history", icon: Calendar },
        ]}
      />
    </div>
  );
}
