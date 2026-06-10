import Link from "next/link";
import Image from "next/image";
import { PLAY_STYLE_LABEL, type IconicSeason } from "@/lib/iconicSeasons";
import { decadeOfYear } from "@/lib/decades";
import { TEAM_META } from "@/lib/teams";
import { playerHeadshotUrl, teamLogoUrl } from "@/lib/teamUrls";

export default function SeasonCard({ season, isZh }: { season: IconicSeason; isZh: boolean }) {
  const team = TEAM_META[season.team];
  const teamColor = team?.primaryColor || "#94A3B8";
  const story = isZh && season.storyZh ? season.storyZh : season.story;

  const decade = decadeOfYear(season.seasonYear);
  const trophyFlags = [
    season.mvp && "mvp",
    season.champion && "champion",
    season.finalsMvp && "finalsMvp",
    season.dpoy && "dpoy",
    season.scoringTitle && "scoringTitle",
  ].filter(Boolean).join(" ");

  const trophies: { label: string; tone: string }[] = [];
  if (season.mvp) trophies.push({ label: "MVP", tone: "bg-accent-amber/15 text-accent-amber border-accent-amber/30" });
  if (season.finalsMvp) trophies.push({ label: "FMVP", tone: "bg-accent-amber/15 text-accent-amber border-accent-amber/30" });
  if (season.champion) trophies.push({ label: "🏆", tone: "bg-success/15 text-success border-success/30" });
  if (season.dpoy) trophies.push({ label: "DPOY", tone: "bg-accent/15 text-accent border-accent/30" });
  if (season.scoringTitle) trophies.push({ label: "Scoring", tone: "bg-danger/10 text-danger border-danger/30" });

  return (
    <Link
      href={`/compare?p1=${encodeURIComponent(season.id)}`}
      className="glass-tile p-4 relative overflow-hidden block cursor-pointer hover:border-accent/40 transition-colors group"
      data-season-card
      data-decade={decade}
      data-styles={(season.styles ?? []).join(" ")}
      data-trophies={trophyFlags}
    >
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${teamColor}55 0%, transparent 60%)` }}
      />

      <div className="relative flex items-center gap-3 mb-3">
        <div className="w-14 h-14 rounded-xl overflow-hidden bg-bg-secondary shrink-0 border border-border">
          <Image
            src={playerHeadshotUrl(season.personId, "260x190")}
            alt={season.name}
            width={56}
            height={56}
            unoptimized
            className="w-full h-full object-cover object-top"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-accent/15 text-accent">
              {season.season}
            </span>
            {team && (
              <Image
                src={teamLogoUrl(team.teamId)}
                alt=""
                width={14}
                height={14}
                unoptimized
                aria-hidden
                className="opacity-70"
              />
            )}
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary truncate">
              {season.team}
            </span>
          </div>
          <p className="font-semibold text-text-primary text-sm leading-tight mt-1 truncate">
            {season.name}
          </p>
        </div>
      </div>

      <div className="relative grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">PPG</p>
          <p className="text-xl font-light font-mono tabular-nums text-accent-amber">{season.ppg.toFixed(1)}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">RPG</p>
          <p className="text-xl font-light font-mono tabular-nums text-text-primary">{season.rpg.toFixed(1)}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">APG</p>
          <p className="text-xl font-light font-mono tabular-nums text-text-primary">{season.apg.toFixed(1)}</p>
        </div>
      </div>

      {trophies.length > 0 && (
        <div className="relative flex flex-wrap gap-1 mb-2">
          {trophies.map((tr) => (
            <span
              key={tr.label}
              className={`text-[9px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded border ${tr.tone}`}
            >
              {tr.label}
            </span>
          ))}
        </div>
      )}

      {season.styles && season.styles.length > 0 && (
        <div className="relative flex flex-wrap gap-1 mb-2">
          {season.styles.slice(0, 2).map((st) => {
            const label = PLAY_STYLE_LABEL[st];
            return (
              <span key={st} className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                {isZh ? label.zh : label.en}
              </span>
            );
          })}
        </div>
      )}

      <p className="relative text-[11px] text-text-secondary leading-relaxed line-clamp-3">
        {story}
      </p>

      <div className="relative mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
        <span className="text-text-secondary/60 font-mono uppercase tracking-[0.15em]">
          {isZh ? "对比" : "Compare"}
        </span>
        <span className="text-accent group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </Link>
  );
}
