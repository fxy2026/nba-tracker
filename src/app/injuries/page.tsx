import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { TEAM_META } from "@/lib/teams";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

export const revalidate = 300;

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

function findTeamMeta(displayName: string) {
  if (!displayName) return null;
  const lower = displayName.toLowerCase();
  for (const meta of Object.values(TEAM_META)) {
    if (lower.includes(meta.name.toLowerCase()) || lower.includes(meta.city.toLowerCase())) {
      return meta;
    }
  }
  return null;
}

function getStatusColor(status: string | undefined): string {
  if (!status) return "text-text-secondary";
  const s = status.toLowerCase();
  if (s.includes("out")) return "text-danger";
  if (s.includes("day-to-day") || s.includes("questionable")) return "text-accent-amber";
  if (s.includes("doubtful")) return "text-accent-amber";
  return "text-text-secondary";
}

function getStatusBg(status: string | undefined): string {
  if (!status) return "bg-text-secondary/10";
  const s = status.toLowerCase();
  if (s.includes("out")) return "bg-danger/10";
  if (s.includes("day-to-day") || s.includes("questionable")) return "bg-accent-amber/10";
  if (s.includes("doubtful")) return "bg-accent-amber/10";
  return "bg-text-secondary/10";
}

export default async function InjuriesPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const params = await searchParams;
  const filterTeam = params.team?.toLowerCase();
  const [allTeams, locale] = await Promise.all([getInjuries(), getLocale()]);
  const t = getTranslations(locale);

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
        {t.common.backToHome}
      </Link>

      <PageHeader
        eyebrow="League"
        icon={AlertTriangle}
        title={t.injuriesPage.title}
        subtitle={`${t.injuriesPage.dataSource}${new Date().toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { timeZone: "Asia/Shanghai", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} (${t.common.beijing})`}
        action={totalInjured > 0 ? (
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary">
            <span className="text-text-primary font-bold tabular-nums">{totalInjured}</span> {t.common.players} · <span className="text-text-primary font-bold tabular-nums">{allTeams.length}</span> {t.common.teams}
          </span>
        ) : undefined}
        className="mt-4"
      />

      {/* Feature 6: Injury status summary */}
      {totalInjured > 0 && (() => {
        let outCount = 0, dtdCount = 0, questionableCount = 0, doubtfulCount = 0;
        for (const team of allTeams) {
          for (const inj of (team.injuries || [])) {
            const s = (inj.status || "").toLowerCase();
            if (s.includes("out")) outCount++;
            else if (s.includes("doubtful")) doubtfulCount++;
            else if (s.includes("day-to-day")) dtdCount++;
            else if (s.includes("questionable")) questionableCount++;
          }
        }
        return (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="text-sm flex items-center gap-1.5 px-3 py-1.5 bg-danger/10 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-danger" />
              <span className="font-bold text-danger">{outCount}</span>
              <span className="text-text-secondary text-xs">{t.injuriesPage.out}</span>
            </span>
            <span className="text-sm flex items-center gap-1.5 px-3 py-1.5 bg-accent-amber/10 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-accent-amber" />
              <span className="font-bold text-accent-amber">{doubtfulCount}</span>
              <span className="text-text-secondary text-xs">{t.injuriesPage.doubtful}</span>
            </span>
            <span className="text-sm flex items-center gap-1.5 px-3 py-1.5 bg-accent-amber/10 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-accent-amber" />
              <span className="font-bold text-accent-amber">{dtdCount}</span>
              <span className="text-text-secondary text-xs">{t.injuriesPage.dayToDay}</span>
            </span>
            <span className="text-sm flex items-center gap-1.5 px-3 py-1.5 bg-accent-amber/10 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-accent-amber" />
              <span className="font-bold text-accent-amber">{questionableCount}</span>
              <span className="text-text-secondary text-xs">{t.injuriesPage.questionable}</span>
            </span>
          </div>
        );
      })()}

      {/* Most Affected Teams */}
      {allTeams.length > 0 && (() => {
        const sorted = [...allTeams]
          .filter((t) => t.injuries && t.injuries.length > 0)
          .sort((a, b) => (b.injuries?.length || 0) - (a.injuries?.length || 0))
          .slice(0, 5);
        if (sorted.length === 0) return null;
        const maxInj = sorted[0].injuries?.length || 1;
        return (
          <div className="glass-tile p-4 mb-4">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3">{t.injuriesPage.mostAffected}</h3>
            <div className="space-y-1.5">
              {sorted.map((team) => (
                <div key={team.id || team.displayName} className="flex items-center gap-2">
                  <span className="text-xs text-text-primary font-medium w-36 truncate">{team.displayName}</span>
                  <div className="flex-1 h-3 bg-bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-danger/60 rounded-full" style={{ width: `${((team.injuries?.length || 0) / maxInj) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-danger font-mono tabular-nums w-6 text-right">{team.injuries?.length}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Team Filter */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <Link
          href="/injuries"
          className={`text-xs px-2.5 py-1 rounded-full transition-colors ${!filterTeam ? "bg-accent text-white" : "bg-bg-card border border-border text-text-secondary hover:text-text-primary"}`}
        >
          {t.injuriesPage.allTeams}
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
        <div className="glass-tile p-12 text-center">
          <AlertTriangle size={32} className="text-text-secondary mx-auto mb-3 opacity-30" />
          <p className="text-text-secondary">{t.injuriesPage.noInjuryData}</p>
          <p className="text-xs text-text-secondary mt-1">{t.injuriesPage.offseasonNote}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => {
            if (!team.injuries || team.injuries.length === 0) return null;
            return (
              <div key={team.id || team.displayName} className="glass-tile overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  {(() => {
                    const meta = findTeamMeta(team.displayName || "");
                    if (!meta) return null;
                    return (
                      <Image
                        src={`https://cdn.nba.com/logos/nba/${meta.teamId}/global/L/logo.svg`}
                        alt={meta.tricode}
                        width={24}
                        height={24}
                        unoptimized
                      />
                    );
                  })()}
                  <h2 className="font-semibold text-sm text-text-primary">
                    {team.displayName || "Unknown Team"}
                  </h2>
                  <span className="text-xs text-text-secondary ml-auto">
                    {team.injuries.length} {t.common.players}
                  </span>
                </div>
                <div className="divide-y divide-border/50">
                  {team.injuries.map((inj, idx) => (
                    <div key={inj.id || idx} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-3 min-w-[180px]">
                        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                          inj.status?.toLowerCase().includes("out") ? "bg-danger" :
                          inj.status?.toLowerCase().includes("doubtful") ? "bg-accent-amber" :
                          inj.status?.toLowerCase().includes("day-to-day") || inj.status?.toLowerCase().includes("questionable") ? "bg-accent-amber" :
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
                      {inj.date && (() => {
                        const injDate = new Date(inj.date);
                        const daysAgo = Math.floor((Date.now() - injDate.getTime()) / (1000 * 60 * 60 * 24));
                        return (
                          <span className="text-[10px] text-text-secondary shrink-0 flex items-center gap-1">
                            {injDate.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" })}
                            {daysAgo <= 2 && <span className="px-1 py-0.5 rounded bg-danger/15 text-danger font-medium">NEW</span>}
                            {daysAgo > 2 && daysAgo <= 7 && <span className="text-text-secondary/60">({daysAgo}d)</span>}
                          </span>
                        );
                      })()}
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
