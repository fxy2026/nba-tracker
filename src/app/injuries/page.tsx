import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export const revalidate = 1800;

interface Athlete {
  displayName: string;
  position?: { abbreviation?: string };
}

interface Injury {
  athlete?: Athlete;
  status?: string;
  date?: string;
  type?: { description?: string; detail?: { description?: string } };
  details?: { detail?: string; side?: string; returnDate?: string };
  description?: string;
}

interface TeamInjury {
  team?: {
    displayName?: string;
    abbreviation?: string;
    logos?: { href?: string }[];
  };
  injuries?: Injury[];
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
    return json.teams || json.resultSets || [];
  } catch {
    return [];
  }
}

function getStatusColor(status: string | undefined): string {
  if (!status) return "text-text-secondary";
  const s = status.toLowerCase();
  if (s.includes("out")) return "text-danger";
  if (s.includes("day-to-day") || s.includes("questionable")) return "text-warning";
  if (s.includes("doubtful")) return "text-danger";
  return "text-text-secondary";
}

export default async function InjuriesPage() {
  const teams = await getInjuries();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link href="/" className="text-sm text-text-secondary hover:text-accent transition-colors">
        <ArrowLeft size={14} className="inline mr-1" />
        Back to home
      </Link>

      <div className="flex items-center gap-3 mt-4 mb-6">
        <AlertTriangle size={24} className="text-warning" />
        <h1 className="text-2xl font-bold text-text-primary">Injury Report</h1>
      </div>

      {teams.length === 0 ? (
        <div className="bg-bg-card rounded-xl border border-border p-8 text-center">
          <p className="text-text-secondary">No injury data available at this time.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((t) => {
            if (!t.injuries || t.injuries.length === 0) return null;
            return (
              <div key={t.team?.abbreviation || t.team?.displayName} className="bg-bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  {t.team?.logos?.[0]?.href && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.team.logos[0].href} alt="" className="w-5 h-5" />
                  )}
                  <h2 className="font-semibold text-sm text-text-primary">
                    {t.team?.displayName || "Unknown"}
                  </h2>
                  <span className="text-xs text-text-secondary ml-auto">
                    {t.injuries.length} player{t.injuries.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="divide-y divide-border/50">
                  {t.injuries.map((inj, idx) => (
                    <div key={`${inj.athlete?.displayName || idx}`} className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-medium text-sm text-text-primary min-w-[140px]">
                        {inj.athlete?.displayName || "Unknown"}
                        {inj.athlete?.position?.abbreviation && (
                          <span className="text-text-secondary text-xs ml-1">({inj.athlete.position.abbreviation})</span>
                        )}
                      </span>
                      <span className={`text-xs font-semibold uppercase ${getStatusColor(inj.status)}`}>
                        {inj.status || "Unknown"}
                      </span>
                      <span className="text-xs text-text-secondary flex-1">
                        {inj.details?.detail || inj.type?.detail?.description || inj.type?.description || inj.description || ""}
                      </span>
                      {inj.date && (
                        <span className="text-[10px] text-text-secondary">
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
