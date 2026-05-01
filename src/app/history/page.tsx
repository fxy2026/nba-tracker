import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

export const metadata: Metadata = {
  title: "历届总冠军",
  description: "NBA 历届总冠军、FMVP 和总决赛比分一览。",
};

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
      <div className="flex items-center gap-2 mb-6">
        <Trophy size={20} className="text-accent" />
        <h1 className="text-xl font-bold">{t.historyPage.title}</h1>
      </div>

      {/* Quick Facts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-accent">{sweeps.length}</p>
          <p className="text-[10px] text-text-secondary uppercase">{t.historyPage.sweeps}</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-accent">{game7s.length}</p>
          <p className="text-[10px] text-text-secondary uppercase">{t.historyPage.game7s}</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-accent">{repeats.length}</p>
          <p className="text-[10px] text-text-secondary uppercase">{t.historyPage.repeatChamps}</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-accent">{topFmvps.length > 0 ? topFmvps[0][1] : 0}</p>
          <p className="text-[10px] text-text-secondary uppercase">{t.historyPage.mostFmvps}</p>
          {topFmvps.length > 0 && <p className="text-[10px] text-accent mt-0.5">{topFmvps[0][0]}</p>}
        </div>
      </div>

      {/* Multi-FMVP winners */}
      {topFmvps.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {topFmvps.map(([name, count]) => (
            <span key={name} className="text-xs px-2.5 py-1 rounded-full bg-accent/15 text-accent font-medium">
              {name}: {count}x FMVP
            </span>
          ))}
        </div>
      )}

      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary">
                <th className="text-left py-3 px-4 font-medium text-text-secondary">{t.historyPage.year}</th>
                <th className="text-left py-3 px-4 font-medium text-text-secondary">{t.historyPage.champion}</th>
                <th className="text-left py-3 px-4 font-medium text-text-secondary">{t.historyPage.finalsMvp}</th>
                <th className="text-left py-3 px-4 font-medium text-text-secondary">{t.historyPage.runnerUp}</th>
                <th className="text-left py-3 px-4 font-medium text-text-secondary">{t.historyPage.series}</th>
              </tr>
            </thead>
            <tbody>
              {champions.map((row, i) => {
                const isSweep = row.series === "4-0";
                const isGame7 = row.series === "4-3";
                const isRepeat = i > 0 && row.champion !== "TBD" && row.champion === champions[i - 1].champion;
                return (
                  <tr key={row.year} className={`border-b border-border/30 hover:bg-bg-hover/50 transition-colors ${row.champion === "TBD" ? "opacity-50" : ""}`}>
                    <td className="py-3 px-4 font-bold text-accent">{row.year}</td>
                    <td className="py-3 px-4 font-medium text-text-primary">
                      {row.champion}
                      {isRepeat && <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-yellow-500/15 text-yellow-500 font-bold">{t.historyPage.repeat}</span>}
                    </td>
                    <td className="py-3 px-4 text-text-secondary">
                      {row.fmvp}
                      {fmvpCounts[row.fmvp] >= 2 && row.fmvp !== "TBD" && <span className="ml-1 text-accent text-[10px]">({fmvpCounts[row.fmvp]}x)</span>}
                    </td>
                    <td className="py-3 px-4 text-text-secondary">{row.runnerUp}</td>
                    <td className="py-3 px-4">
                      <span className={`${isSweep ? "text-accent font-bold" : isGame7 ? "text-yellow-500 font-medium" : "text-text-secondary"}`}>
                        {row.series}
                      </span>
                      {isSweep && <span className="ml-1 text-[9px] text-accent">{t.historyPage.sweep}</span>}
                      {isGame7 && <span className="ml-1 text-[9px] text-yellow-500">{t.historyPage.g7}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Championships by Franchise */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden mt-8 p-4">
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
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden mt-8 p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Trophy size={16} className="text-yellow-500" />
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
    </div>
  );
}
