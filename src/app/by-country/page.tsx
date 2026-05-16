import type { Metadata } from "next";
import Link from "next/link";
import { Globe } from "lucide-react";
import { getPlayerIndex } from "@/lib/api";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "NBA By Country",
  description: "NBA players grouped by country of origin — global representation across the league.",
};

export const revalidate = 600;

interface CountryPlayer {
  personId: number;
  firstName: string;
  lastName: string;
  teamAbbr: string;
  pts: number;
  reb: number;
  ast: number;
}

interface CountryGroup {
  country: string;
  count: number;
  topThree: CountryPlayer[];
  bestPpg: number;
}

// Rough flag emoji mapping for common NBA countries
const FLAGS: Record<string, string> = {
  "USA": "🇺🇸",
  "Canada": "🇨🇦",
  "France": "🇫🇷",
  "Australia": "🇦🇺",
  "Germany": "🇩🇪",
  "Spain": "🇪🇸",
  "Serbia": "🇷🇸",
  "Slovenia": "🇸🇮",
  "Greece": "🇬🇷",
  "Croatia": "🇭🇷",
  "Lithuania": "🇱🇹",
  "Latvia": "🇱🇻",
  "Italy": "🇮🇹",
  "Turkey": "🇹🇷",
  "Israel": "🇮🇱",
  "Nigeria": "🇳🇬",
  "Cameroon": "🇨🇲",
  "Senegal": "🇸🇳",
  "Sudan": "🇸🇩",
  "South Sudan": "🇸🇸",
  "DR Congo": "🇨🇩",
  "Democratic Republic of the Congo": "🇨🇩",
  "Congo": "🇨🇬",
  "Bahamas": "🇧🇸",
  "Dominican Republic": "🇩🇴",
  "Brazil": "🇧🇷",
  "Argentina": "🇦🇷",
  "Mexico": "🇲🇽",
  "Venezuela": "🇻🇪",
  "Switzerland": "🇨🇭",
  "United Kingdom": "🇬🇧",
  "UK": "🇬🇧",
  "Britain": "🇬🇧",
  "Russia": "🇷🇺",
  "China": "🇨🇳",
  "Japan": "🇯🇵",
  "New Zealand": "🇳🇿",
  "South Korea": "🇰🇷",
  "Czech Republic": "🇨🇿",
  "Montenegro": "🇲🇪",
  "Bosnia and Herzegovina": "🇧🇦",
  "Finland": "🇫🇮",
  "Sweden": "🇸🇪",
  "Norway": "🇳🇴",
  "Ukraine": "🇺🇦",
  "Poland": "🇵🇱",
  "Austria": "🇦🇹",
  "Belgium": "🇧🇪",
  "Netherlands": "🇳🇱",
  "Cape Verde": "🇨🇻",
  "Republic of Congo": "🇨🇬",
  "Mali": "🇲🇱",
  "Egypt": "🇪🇬",
  "Tunisia": "🇹🇳",
  "Morocco": "🇲🇦",
  "Angola": "🇦🇴",
  "Ivory Coast": "🇨🇮",
  "Côte d'Ivoire": "🇨🇮",
  "Israel ": "🇮🇱",
  "Bulgaria": "🇧🇬",
  "Romania": "🇷🇴",
  "Estonia": "🇪🇪",
  "Iceland": "🇮🇸",
  "Ireland": "🇮🇪",
  "Portugal": "🇵🇹",
};

export default async function ByCountryPage() {
  const players = await getPlayerIndex().catch(() => []);

  if (players.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader eyebrow="Global" icon={Globe} title="NBA By Country" />
        <EmptyState icon={Globe} title="No data" description="Could not load player index." />
      </div>
    );
  }

  const byCountry = new Map<string, CountryPlayer[]>();
  for (const p of players) {
    const c = (p.country || "").trim();
    if (!c) continue;
    const row: CountryPlayer = {
      personId: p.personId,
      firstName: p.firstName,
      lastName: p.lastName,
      teamAbbr: p.teamAbbr,
      pts: p.pts,
      reb: p.reb,
      ast: p.ast,
    };
    const arr = byCountry.get(c) || [];
    arr.push(row);
    byCountry.set(c, arr);
  }

  const groups: CountryGroup[] = [];
  for (const [country, list] of byCountry) {
    const ranked = [...list].sort((a, b) => (b.pts + b.reb * 1.2 + b.ast * 1.5) - (a.pts + a.reb * 1.2 + a.ast * 1.5));
    const bestPpg = list.reduce((m, p) => p.pts > m ? p.pts : m, 0);
    groups.push({
      country,
      count: list.length,
      topThree: ranked.slice(0, 3),
      bestPpg,
    });
  }
  groups.sort((a, b) => b.count - a.count);

  const usa = groups.find((g) => g.country === "USA");
  const international = groups.filter((g) => g.country !== "USA");
  const totalInternational = international.reduce((s, g) => s + g.count, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow="Global"
        icon={Globe}
        title="NBA By Country"
        subtitle={`Players from ${groups.length} countries · ${totalInternational} international + ${usa?.count ?? 0} domestic`}
      />

      {/* USA hero tile */}
      {usa && (
        <section className="mb-8">
          <div className="glass-tile p-5 bg-accent/[0.04] relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1 bg-accent" />
            <div className="relative">
              <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ Domestic</p>
                  <h2 className="text-3xl font-light tracking-tight flex items-center gap-3">
                    <span className="text-4xl">{FLAGS[usa.country]}</span>
                    United States
                  </h2>
                </div>
                <div className="flex gap-5 text-right">
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">Players</p>
                    <p className="text-xl font-light font-mono tabular-nums">{usa.count}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">Best PPG</p>
                    <p className="text-xl font-light font-mono tabular-nums text-accent-amber">{usa.bestPpg.toFixed(1)}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {usa.topThree.map((p) => (
                  <Link key={p.personId} href={`/player/${p.personId}`} className="glass-tile p-3 flex items-center gap-3 group cursor-pointer">
                    <PlayerHeadshot personId={p.personId} name={`${p.firstName} ${p.lastName}`} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-text-primary group-hover:text-accent transition-colors truncate">{p.firstName} {p.lastName}</p>
                      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
                        {p.teamAbbr} · <span className="tabular-nums">{p.pts.toFixed(1)}</span>/<span className="tabular-nums">{p.reb.toFixed(1)}</span>/<span className="tabular-nums">{p.ast.toFixed(1)}</span>
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* International grid */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent flex items-center gap-2">
            <Globe size={14} className="text-accent" />
            International
          </h2>
          <span className="h-px flex-1 bg-accent/30" />
          <span className="text-[10px] font-mono tabular-nums text-text-secondary">{international.length} countries</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {international.map((g) => (
            <div key={g.country} className="glass-tile p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl shrink-0">{FLAGS[g.country] || "🌍"}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{g.country}</p>
                    <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">
                      <span className="tabular-nums">{g.count}</span> player{g.count === 1 ? "" : "s"} · best PPG <span className="tabular-nums">{g.bestPpg.toFixed(1)}</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                {g.topThree.map((p) => (
                  <Link
                    key={p.personId}
                    href={`/player/${p.personId}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-hover transition-colors group cursor-pointer"
                  >
                    <PlayerHeadshot personId={p.personId} name={`${p.firstName} ${p.lastName}`} size={28} />
                    <span className="text-xs font-medium text-text-primary group-hover:text-accent transition-colors truncate flex-1">
                      {p.firstName} {p.lastName}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-text-secondary shrink-0">{p.pts.toFixed(1)}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
