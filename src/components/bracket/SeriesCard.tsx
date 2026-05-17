"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import { TEAM_META } from "@/lib/teams";
import { winnerOf, type Series, type SeriesTeam } from "@/lib/playoffs";
import TeamLogo from "@/components/TeamLogo";

function ProgressDots({ results, total }: { results: ("T1" | "T2")[]; total: number }) {
  const slots = Array.from({ length: 7 });
  return (
    <div className="flex items-center justify-center gap-[3px] mt-1.5">
      {slots.map((_, i) => {
        const r = results[i];
        const filled = r === "T1" ? "bg-accent" : r === "T2" ? "bg-success" : "bg-bg-hover";
        return <div key={i} className={`w-1.5 h-1.5 rounded-full ${filled}`} />;
      })}
      <span className="ml-1.5 text-[11px] sm:text-[8px] font-mono uppercase tracking-[0.15em] text-text-secondary/60 tabular-nums">
        {total}/7
      </span>
    </div>
  );
}

function TeamRow({
  team,
  leading,
  isWinner,
  isLoser,
  primaryColor,
  size,
  align,
  dim = false,
}: {
  team: SeriesTeam;
  leading: boolean;
  isWinner: boolean;
  isLoser: boolean;
  primaryColor?: string;
  size: "sm" | "md" | "lg";
  align: "left" | "right";
  dim?: boolean;
}) {
  const logoSize = size === "lg" ? 32 : size === "md" ? 24 : 20;
  const triSize = size === "lg" ? "text-base" : size === "md" ? "text-sm" : "text-xs";
  const winSize = size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-sm";
  const pad = size === "lg" ? "py-2" : size === "md" ? "py-1.5" : "py-0.5";

  // When the team-color side stripe is rendered (leading + has primary color),
  // pad that side a bit more so the team logo doesn't kiss the colored bar.
  const sidePad = primaryColor && leading
    ? align === "left" ? "pl-2" : "pr-2"
    : "";

  return (
    <div
      className={`flex items-center gap-2 ${pad} ${sidePad} ${isLoser ? "opacity-40" : ""} relative ${align === "right" ? "flex-row-reverse" : ""}`}
      style={
        primaryColor && leading
          ? align === "left"
            ? { boxShadow: `inset 3px 0 0 0 ${primaryColor}` }
            : { boxShadow: `inset -3px 0 0 0 ${primaryColor}` }
          : undefined
      }
    >
      <TeamLogo teamId={team.teamId} tricode={team.tricode} size={logoSize} />
      <div className={`flex-1 min-w-0 flex items-center gap-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
        {team.seed > 0 && (
          <span className="text-[11px] sm:text-[10px] font-mono tabular-nums text-text-secondary/60 shrink-0">{team.seed}</span>
        )}
        <span className={`${triSize} font-bold font-mono ${dim ? "text-text-secondary" : leading ? "text-text-primary" : "text-text-secondary"} truncate`}>
          {team.tricode}
        </span>
        {isWinner && <Crown size={size === "lg" ? 16 : 12} className="text-[#FFD700] shrink-0" />}
      </div>
      {dim ? (
        <span className={`${winSize} font-light font-mono tabular-nums shrink-0 text-text-secondary/40`}>—</span>
      ) : (
        <span className={`${winSize} font-light font-mono tabular-nums shrink-0 ${leading ? "text-accent-amber" : "text-text-secondary"}`}>
          {team.wins}
        </span>
      )}
    </div>
  );
}

function CandidatesRow({
  candidates,
  size,
  align,
}: {
  candidates: SeriesTeam[];
  size: "sm" | "md" | "lg";
  align: "left" | "right";
}) {
  const logoSize = size === "lg" ? 22 : size === "md" ? 18 : 16;
  const triSize = size === "lg" ? "text-sm" : "text-[11px] sm:text-[10px]";
  const pad = size === "lg" ? "py-2" : size === "md" ? "py-1.5" : "py-0.5";
  return (
    <div className={`flex items-center gap-1.5 ${pad} relative ${align === "right" ? "flex-row-reverse" : ""}`}>
      {/* Stacked mini-logos */}
      <div className={`flex items-center ${align === "right" ? "flex-row-reverse -space-x-1.5 space-x-reverse" : "-space-x-1.5"} shrink-0`}>
        {candidates.slice(0, 4).map((c, i) => (
          <div
            key={`${c.tricode}-${i}`}
            className="rounded-full bg-bg-card ring-1 ring-border overflow-hidden"
            style={{ width: logoSize, height: logoSize }}
            title={c.tricode}
          >
            <TeamLogo teamId={c.teamId} tricode={c.tricode} size={logoSize} />
          </div>
        ))}
      </div>
      <div className={`flex-1 min-w-0 flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <span className={`${triSize} font-mono font-bold text-text-secondary/70 truncate`}>
          {candidates.map((c) => c.tricode).join(" / ")}
        </span>
      </div>
      <span className={`${triSize} font-mono uppercase tracking-[0.15em] text-text-secondary/40 shrink-0`}>
        TBD
      </span>
    </div>
  );
}

export default function SeriesCard({
  s,
  size = "sm",
  onPath = false,
  align = "left",
}: {
  s: Series;
  size?: "sm" | "md" | "lg";
  onPath?: boolean;
  align?: "left" | "right";
}) {
  const finished = !!winnerOf(s);
  const t1Leading = s.team1.wins > s.team2.wins;
  const t2Leading = s.team2.wins > s.team1.wins;
  const winner = winnerOf(s);
  const meta1 = TEAM_META[s.team1.tricode];
  const meta2 = TEAM_META[s.team2.tricode];

  const padClass = size === "lg" ? "p-4" : size === "md" ? "p-2.5" : "p-2";
  const isProjected = s.isProjected;
  const ring = onPath
    ? "ring-1 ring-[#FFD700]/50 shadow-[0_0_24px_-4px_rgba(255,215,0,0.35)]"
    : isProjected
    ? "ring-1 ring-dashed ring-text-secondary/25"
    : finished
    ? "ring-1 ring-text-secondary/15"
    : "";

  // Real (non-projected) series have a sample gameId → derive the 9-char series id
  // and link to /series/[id] for the deep-dive page. Projected series stay
  // unclickable since there's nothing to show yet.
  const seriesId = !isProjected && s.gameIdSample ? s.gameIdSample.slice(0, 9) : null;
  const cardClass = `glass-tile relative overflow-hidden w-full block ${padClass} ${ring} ${isProjected ? "bg-bg-card/40" : ""} ${seriesId ? "cursor-pointer hover:brightness-110 transition" : ""}`;

  const inner = (
    <>
      {onPath && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFD700]/[0.06] to-transparent pointer-events-none" />
      )}
      <div className="relative">
        {s.team1Candidates && s.team1Candidates.length > 0 ? (
          <CandidatesRow candidates={s.team1Candidates} size={size} align={align} />
        ) : (
          <TeamRow
            team={s.team1}
            leading={t1Leading}
            isWinner={finished && winner?.tricode === s.team1.tricode}
            isLoser={finished && winner?.tricode !== s.team1.tricode}
            primaryColor={meta1?.primaryColor}
            size={size}
            align={align}
            dim={isProjected}
          />
        )}
        <div className="h-px bg-border/40 my-0.5" />
        {s.team2Candidates && s.team2Candidates.length > 0 ? (
          <CandidatesRow candidates={s.team2Candidates} size={size} align={align} />
        ) : (
          <TeamRow
            team={s.team2}
            leading={t2Leading}
            isWinner={finished && winner?.tricode === s.team2.tricode}
            isLoser={finished && winner?.tricode !== s.team2.tricode}
            primaryColor={meta2?.primaryColor}
            size={size}
            align={align}
            dim={isProjected}
          />
        )}
        {isProjected ? (
          <div className="text-[11px] sm:text-[9px] font-mono uppercase tracking-[0.2em] text-center text-text-secondary/60 mt-1.5 flex items-center justify-center gap-1">
            <span className="w-1 h-1 rounded-full bg-accent-amber animate-pulse" />
            <span>{(s.team1Candidates?.length || s.team2Candidates?.length) ? "Awaiting opponent" : "Matchup set · upcoming"}</span>
          </div>
        ) : (
          <>
            <ProgressDots results={s.results} total={s.totalGames} />
            {finished && (
              <div className="text-[11px] sm:text-[9px] font-mono uppercase tracking-[0.18em] text-center text-[#FFD700] mt-1.5 font-bold flex items-center justify-center gap-1">
                <Crown size={10} />
                <span>{winner?.tricode} {Math.max(s.team1.wins, s.team2.wins)}-{Math.min(s.team1.wins, s.team2.wins)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  return seriesId ? (
    <Link href={`/series/${seriesId}`} className={cardClass}>{inner}</Link>
  ) : (
    <div className={cardClass}>{inner}</div>
  );
}
