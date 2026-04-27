import Link from "next/link";
import { Trophy } from "lucide-react";

const champions = [
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
];

export default function HistoryPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <Trophy size={20} className="text-accent" />
        <h1 className="text-xl font-bold">NBA Champions (2015-2025)</h1>
      </div>

      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary">
                <th className="text-left py-3 px-4 font-medium text-text-secondary">Year</th>
                <th className="text-left py-3 px-4 font-medium text-text-secondary">Champion</th>
                <th className="text-left py-3 px-4 font-medium text-text-secondary">Finals MVP</th>
                <th className="text-left py-3 px-4 font-medium text-text-secondary">Runner-up</th>
                <th className="text-left py-3 px-4 font-medium text-text-secondary">Series</th>
              </tr>
            </thead>
            <tbody>
              {champions.map((row) => (
                <tr key={row.year} className="border-b border-border/30 hover:bg-bg-hover/50 transition-colors">
                  <td className="py-3 px-4 font-bold text-accent">{row.year}</td>
                  <td className="py-3 px-4 font-medium text-text-primary">{row.champion}</td>
                  <td className="py-3 px-4 text-text-secondary">{row.fmvp}</td>
                  <td className="py-3 px-4 text-text-secondary">{row.runnerUp}</td>
                  <td className="py-3 px-4 text-text-secondary">{row.series}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link href="/" className="text-xs text-text-secondary hover:text-accent transition-colors">
          &larr; Back to Home
        </Link>
      </div>
    </div>
  );
}
