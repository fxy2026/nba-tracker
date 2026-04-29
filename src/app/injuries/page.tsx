import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "伤病报告",
  description: "NBA 全联盟伤病名单，实时更新球员伤停状态。",
};

export const revalidate = 1800;

interface Athlete {
  displayName: string;
  firstName?: string;
  lastName?: string;
  position?: { abbreviation?: string };
  links?: { href?: string }[];
}

interface InjuryItem {
  id?: string;
  status?: string;
  date?: string;
  athlete?: Athlete;
  shortComment?: string;
  longComment?: string;
}

interface TeamInjury {
  id?: string;
  displayName?: string;
  injuries?: InjuryItem[];
}

async function getInjuries(): Promise<TeamInjury[]> {
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries",
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 1800 },
      }
    );
    if (!res.ok) return [];
    const json = await res.json();
    // ESPN returns { injuries: [...teams] } — each team has { displayName, injuries: [...] }
    return json.injuries || [];
  } catch {
    return [];
  }
}

function getStatusColor(status: string | undefined): string {
  if (!status) return "text-text-secondary";
  const s = status.toLowerCase();
  if (s.includes("out")) return "text-danger";
  if (s.includes("day-to-day") || s.includes("questionable")) return "text-yellow-400";
  if (s.includes("doubtful")) return "text-orange-400";
  return "text-text-secondary";
}

function getStatusBg(status: string | undefined): string {
  if (!status) return "bg-text-secondary/10";
  const s = status.toLowerCase();
  if (s.includes("out")) return "bg-danger/10";
  if (s.includes("day-to-day") || s.includes("questionable")) return "bg-yellow-400/10";
  if (s.includes("doubtful")) return "bg-orange-400/10";
  return "bg-text-secondary/10";
}

export default async function InjuriesPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const params = await searchParams;
  const filterTeam = params.team?.toLowerCase();
  const allTeams = await getInjuries();

  const teams = filterTeam
    ? allTeams.filter((t) => t.displayName?.toLowerCase().includes(filterTeam))
    : allTeams;

  const totalInjured = allTeams.reduce((sum, t) => sum + (t.injuries?.length || 0), 0);

  const teamNames = allTeams
    .filter((t) => t.injuries && t.injuries.length > 0)
    .map((t) => t.displayName || "");

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link href="/" className="text-sm text-text-secondary hover:text-accent transition-colors">
        <ArrowLeft size={14} className="inline mr-1" />
        Back to home
      </Link>

      <div className="flex items-center justify-between mt-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-danger/10 flex items-center justify-center">
            <AlertTriangle size={20} className="text-danger" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Injury Report</h1>
            <p className="text-xs text-text-secondary">
              Data from ESPN &middot; Last updated: {new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} (Beijing)
            </p>
          </div>
        </div>
        {totalInjured > 0 && (
          <span className="text-sm text-text-secondary">{totalInjured} players &middot; {allTeams.length} teams</span>
        )}
      </div>

      {/* Feature 6: Injury status summary */}
      {totalInjured > 0 && (() => {
        let outCount = 0, dtdCount = 0, questionableCount = 0;
        for (const t of allTeams) {
          for (const inj of (t.injuries || [])) {
            const s = (inj.status || "").toLowerCase();
            if (s.includes("out")) outCount++;
            else if (s.includes("day-to-day")) dtdCount++;
            else if (s.includes("questionable")) questionableCount++;
          }
        }
        return (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="text-sm flex items-center gap-1.5 px-3 py-1.5 bg-danger/10 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-danger" />
              <span className="font-bold text-danger">{outCount}</span>
              <span className="text-text-secondary text-xs">Out</span>
            </span>
            <span className="text-sm flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400/10 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              <span className="font-bold text-yellow-400">{dtdCount}</span>
              <span className="text-text-secondary text-xs">Day-to-Day</span>
            </span>
            <span className="text-sm flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400/10 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              <span className="font-bold text-yellow-400">{questionableCount}</span>
              <span className="text-text-secondary text-xs">Questionable</span>
            </span>
          </div>
        );
      })()}

      {/* Team Filter */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <Link
          href="/injuries"
          className={`text-xs px-2.5 py-1 rounded-full transition-colors ${!filterTeam ? "bg-accent text-white" : "bg-bg-card border border-border text-text-secondary hover:text-text-primary"}`}
        >
          All Teams
        </Link>
        {teamNames.map((name) => (
          <Link
            key={name}
            href={`/injuries?team=${encodeURIComponent(name.toLowerCase())}`}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${filterTeam && name.toLowerCase().includes(filterTeam) ? "bg-accent text-white" : "bg-bg-card border border-border text-text-secondary hover:text-text-primary"}`}
          >
            {name}
          </Link>
        ))}
      </div>

      {teams.length === 0 ? (
        <div className="bg-bg-card rounded-xl border border-border p-12 text-center">
          <AlertTriangle size={32} className="text-text-secondary mx-auto mb-3 opacity-30" />
          <p className="text-text-secondary">No injury data available at this time.</p>
          <p className="text-xs text-text-secondary mt-1">This may happen during the off-season.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((t) => {
            if (!t.injuries || t.injuries.length === 0) return null;
            return (
              <div key={t.id || t.displayName} className="bg-bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <h2 className="font-semibold text-sm text-text-primary">
                    {t.displayName || "Unknown Team"}
                  </h2>
                  <span className="text-xs text-text-secondary ml-auto">
                    {t.injuries.length} player{t.injuries.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="divide-y divide-border/50">
                  {t.injuries.map((inj, idx) => (
                    <div key={inj.id || idx} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-3 min-w-[180px]">
                        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                          inj.status?.toLowerCase().includes("out") ? "bg-danger" :
                          inj.status?.toLowerCase().includes("doubtful") ? "bg-orange-400" :
                          inj.status?.toLowerCase().includes("day-to-day") || inj.status?.toLowerCase().includes("questionable") ? "bg-yellow-400" :
                          "bg-text-secondary/50"
                        }`} />
                        <span className="font-medium text-sm text-text-primary">
                          {inj.athlete?.displayName || "Unknown"}
                        </span>
                        {inj.athlete?.position?.abbreviation && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-hover text-text-secondary">
                            {inj.athlete.position.abbreviation}
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${getStatusColor(inj.status)} ${getStatusBg(inj.status)}`}>
                        {inj.status || "Unknown"}
                      </span>
                      <span className="text-xs text-text-secondary flex-1 line-clamp-2">
                        {inj.shortComment || ""}
                      </span>
                      {inj.date && (
                        <span className="text-[10px] text-text-secondary shrink-0">
                          {new Date(inj.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
