"use client";

import { memo } from "react";
import Link from "next/link";
import { Trophy, Crown } from "lucide-react";
import type { ScheduleGame } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import TeamLogo from "./TeamLogo";
import { useLocale } from "@/components/LocaleProvider";

interface Props {
  games: ScheduleGame[];
}

interface SeriesTeam {
  tricode: string;
  teamId: number;
  teamCity: string;
  teamName: string;
  wins: number;
  seed: number;
}

interface Series {
  id: string;
  gameIdSample: string; // any game's gameId from this series — used to derive round
  team1: SeriesTeam;
  team2: SeriesTeam;
  totalGames: number;
  conference: "East" | "West" | "Finals";
  round: number;
  seriesIndex: number; // index within round, used for bracket layout ordering
  results: ("T1" | "T2")[];
  isProjected?: boolean; // true if this is a placeholder for an upcoming series
  // For partial projections (one team known, other TBD): the unknown side carries candidates
  team1Candidates?: SeriesTeam[]; // if set, team1 is TBD with these as possible winners
  team2Candidates?: SeriesTeam[]; // if set, team2 is TBD with these as possible winners
}

function getConference(tricode1: string, tricode2: string): "East" | "West" | "Finals" {
  const t1 = TEAM_META[tricode1];
  const t2 = TEAM_META[tricode2];
  if (!t1 || !t2) return "East";
  if (t1.conference !== t2.conference) return "Finals";
  return t1.conference as "East" | "West";
}

/**
 * Parse round from NBA playoff gameId.
 * Format: `004` + 2-digit season + `00` + 1-digit round + 1-digit series + 1-digit game
 * Example: "0042500201" → round=2, series=0, game=1 (R2, East series 0, Game 1)
 * Rounds: 1=R1 (8 series), 2=R2/Semis (4 series), 3=ConfFinals (2 series), 4=Finals (1 series)
 */
function parseGameId(gameId: string): { round: number; seriesIndex: number; game: number } {
  if (!gameId.startsWith("004") || gameId.length < 10) return { round: 0, seriesIndex: 0, game: 0 };
  const round = parseInt(gameId.charAt(7)) || 0;
  const seriesIndex = parseInt(gameId.charAt(8)) || 0;
  const game = parseInt(gameId.charAt(9)) || 0;
  return { round, seriesIndex, game };
}

function winnerOf(s: Series): SeriesTeam | null {
  if (s.team1.wins === 4) return s.team1;
  if (s.team2.wins === 4) return s.team2;
  return null;
}

function isOnChampionPath(s: Series, allSeries: Series[]): boolean {
  const champion = allSeries.find((x) => x.conference === "Finals" && winnerOf(x));
  if (!champion) return false;
  const championTri = winnerOf(champion)!.tricode;
  const winner = winnerOf(s);
  return winner?.tricode === championTri;
}

/**
 * Project placeholder series for future rounds based on already-decided winners.
 * Two modes per series:
 *  - FULL projection: both feeders have winners → both teams pre-filled
 *  - PARTIAL projection: only one feeder has a winner → that team is set, the
 *    other side shows the two candidates from the unfinished feeder series
 *
 * Cascades R1 → R2 → R3 → Finals. Partial projections in earlier rounds become
 * inputs to even more partial projections later (the candidates list grows).
 *
 * Standard NBA bracket pairing:
 *  - R1 series 0,1 → R2 series 0 (East top)
 *  - R1 series 2,3 → R2 series 1 (East bottom)
 *  - R1 series 4,5 → R2 series 2 (West top)
 *  - R1 series 6,7 → R2 series 3 (West bottom)
 *  - R2 series 0,1 → R3 series 0 (East ConfFinal)
 *  - R2 series 2,3 → R3 series 1 (West ConfFinal)
 *  - R3 series 0,1 → R4 series 0 (Finals)
 */
function projectFutureSeries(actual: Series[]): Series[] {
  const out: Series[] = [...actual];
  const findInOut = (round: number, seriesIndex: number) =>
    out.find((s) => s.round === round && s.seriesIndex === seriesIndex);

  // Returns either the winner (if decided) or the list of candidate teams from a series.
  // For a R1 series in progress, candidates are team1 + team2. For a projected R1 series
  // with candidates, it bubbles them up.
  const winnerOrCandidates = (s: Series | undefined): { winner: SeriesTeam | null; candidates: SeriesTeam[] } => {
    if (!s) return { winner: null, candidates: [] };
    const w = winnerOf(s);
    if (w) return { winner: w, candidates: [w] };
    // No winner — return both teams as candidates (or expand candidate lists if present)
    const t1Cands = s.team1Candidates && s.team1Candidates.length > 0 ? s.team1Candidates : (s.team1.tricode ? [s.team1] : []);
    const t2Cands = s.team2Candidates && s.team2Candidates.length > 0 ? s.team2Candidates : (s.team2.tricode ? [s.team2] : []);
    return { winner: null, candidates: [...t1Cands, ...t2Cands] };
  };

  const makeProjectedFull = (
    round: number,
    seriesIndex: number,
    conference: "East" | "West" | "Finals",
    teamA: SeriesTeam,
    teamB: SeriesTeam,
  ): Series => {
    const codes = [teamA.tricode, teamB.tricode].sort();
    const [t1, t2] = teamA.tricode === codes[0] ? [teamA, teamB] : [teamB, teamA];
    return {
      id: `projected-R${round}S${seriesIndex}-${codes.join("-")}`,
      gameIdSample: "",
      team1: { ...t1, wins: 0 },
      team2: { ...t2, wins: 0 },
      totalGames: 0,
      conference,
      round,
      seriesIndex,
      results: [],
      isProjected: true,
    };
  };

  const makeProjectedPartial = (
    round: number,
    seriesIndex: number,
    conference: "East" | "West" | "Finals",
    knownTeam: SeriesTeam,
    candidates: SeriesTeam[],
    knownOnLeft: boolean,
  ): Series => {
    const empty: SeriesTeam = { tricode: "", teamId: 0, teamCity: "", teamName: "", wins: 0, seed: 0 };
    const t1 = knownOnLeft ? knownTeam : empty;
    const t2 = knownOnLeft ? empty : knownTeam;
    return {
      id: `projected-partial-R${round}S${seriesIndex}-${knownTeam.tricode}`,
      gameIdSample: "",
      team1: { ...t1, wins: 0 },
      team2: { ...t2, wins: 0 },
      totalGames: 0,
      conference,
      round,
      seriesIndex,
      results: [],
      isProjected: true,
      team1Candidates: knownOnLeft ? undefined : candidates,
      team2Candidates: knownOnLeft ? candidates : undefined,
    };
  };

  // Build a projection for a single round-series from two feeders
  const project = (
    round: number,
    seriesIndex: number,
    conference: "East" | "West" | "Finals",
    feederA: Series | undefined,
    feederB: Series | undefined,
  ) => {
    if (findInOut(round, seriesIndex)) return; // already exists
    const a = winnerOrCandidates(feederA);
    const b = winnerOrCandidates(feederB);
    if (a.winner && b.winner) {
      out.push(makeProjectedFull(round, seriesIndex, conference, a.winner, b.winner));
    } else if (a.winner && b.candidates.length > 0) {
      out.push(makeProjectedPartial(round, seriesIndex, conference, a.winner, b.candidates, true));
    } else if (b.winner && a.candidates.length > 0) {
      out.push(makeProjectedPartial(round, seriesIndex, conference, b.winner, a.candidates, false));
    }
    // both unknown: skip (we don't have enough info to show anything useful)
  };

  // Round 2 projections from R1 feeders.
  // NBA standard pairing: 1v8 winner meets 4v5 winner (top quarter), 2v7 winner
  // meets 3v6 winner (bottom quarter). The series indices follow seed pattern
  // 0=1v8, 1=2v7, 2=3v6, 3=4v5, so:
  //   R2.0 (East top) = R1.0 (1v8) + R1.3 (4v5)
  //   R2.1 (East bottom) = R1.1 (2v7) + R1.2 (3v6)
  // West mirrors with offset 4.
  const r2Pairings: { r2Idx: number; r1A: number; r1B: number; conf: "East" | "West" }[] = [
    { r2Idx: 0, r1A: 0, r1B: 3, conf: "East" },
    { r2Idx: 1, r1A: 1, r1B: 2, conf: "East" },
    { r2Idx: 2, r1A: 4, r1B: 7, conf: "West" },
    { r2Idx: 3, r1A: 5, r1B: 6, conf: "West" },
  ];
  for (const p of r2Pairings) {
    project(2, p.r2Idx, p.conf, findInOut(1, p.r1A), findInOut(1, p.r1B));
  }

  // Round 3 projections from R2 feeders (uses possibly-projected R2 from step above)
  const r3Pairings: { r3Idx: number; r2A: number; r2B: number; conf: "East" | "West" }[] = [
    { r3Idx: 0, r2A: 0, r2B: 1, conf: "East" },
    { r3Idx: 1, r2A: 2, r2B: 3, conf: "West" },
  ];
  for (const p of r3Pairings) {
    project(3, p.r3Idx, p.conf, findInOut(2, p.r2A), findInOut(2, p.r2B));
  }

  // Finals projection from R3 feeders
  project(4, 0, "Finals", findInOut(3, 0), findInOut(3, 1));

  return out;
}

function ProgressDots({ results, total }: { results: ("T1" | "T2")[]; total: number }) {
  const slots = Array.from({ length: 7 });
  return (
    <div className="flex items-center justify-center gap-[3px] mt-1.5">
      {slots.map((_, i) => {
        const r = results[i];
        const filled = r === "T1" ? "bg-accent" : r === "T2" ? "bg-success" : "bg-bg-hover";
        return <div key={i} className={`w-1.5 h-1.5 rounded-full ${filled}`} />;
      })}
      <span className="ml-1.5 text-[8px] font-mono uppercase tracking-[0.15em] text-text-secondary/60 tabular-nums">
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
          <span className="text-[10px] font-mono tabular-nums text-text-secondary/60 shrink-0">{team.seed}</span>
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

function SeriesCard({
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
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-center text-text-secondary/60 mt-1.5 flex items-center justify-center gap-1">
            <span className="w-1 h-1 rounded-full bg-accent-amber animate-pulse" />
            <span>{(s.team1Candidates?.length || s.team2Candidates?.length) ? "Awaiting opponent" : "Matchup set · upcoming"}</span>
          </div>
        ) : (
          <>
            <ProgressDots results={s.results} total={s.totalGames} />
            {finished && (
              <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-center text-[#FFD700] mt-1.5 font-bold flex items-center justify-center gap-1">
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
  const triSize = size === "lg" ? "text-sm" : "text-[10px]";
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

// Connector: bracket lines connecting two feeder rounds to one target round.
// Drawn as full-cell SVG with viewBox 0 0 100 100 so it stretches to fit any size.
function Connector({
  side,
  highlight,
}: {
  side: "left" | "right";
  highlight?: boolean;
}) {
  const enterX = side === "left" ? 5 : 95;
  const turnX = side === "left" ? 50 : 50;
  const exitX = side === "left" ? 95 : 5;
  const strokeColor = highlight ? "#FFD700" : "rgba(148,163,184,0.45)";
  const strokeW = highlight ? 2 : 1.5;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <path
        d={`M ${enterX} 25 L ${turnX} 25 L ${turnX} 50 M ${enterX} 75 L ${turnX} 75 L ${turnX} 50 M ${turnX} 50 L ${exitX} 50`}
        fill="none"
        strokeWidth={strokeW}
        vectorEffect="non-scaling-stroke"
        stroke={strokeColor}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface RoundLabelProps {
  label: string;
  sub: string;
  color: string;
  count: number;
}

function RoundLabel({ label, sub, color, count }: RoundLabelProps) {
  return (
    <div className="text-center pb-2 mb-2 border-b border-border/40">
      <p className="text-[8px] font-mono uppercase tracking-[0.25em] text-text-secondary/50">/ {sub}</p>
      <p className="text-xs font-bold font-mono uppercase tracking-[0.18em] mt-0.5" style={{ color }}>{label}</p>
      <p className="text-[9px] font-mono tabular-nums text-text-secondary/60 mt-0.5">{count} series</p>
    </div>
  );
}

/**
 * Render one half of the bracket using a SINGLE CSS Grid:
 * 5 columns: [R1 cards] [R1→R2 connector] [R2 cards] [R2→R3 connector] [R3 card]
 * Row 1: round headers (so columns are guaranteed wide enough for labels).
 * Rows 2-9 (8 rows): R1 cards span 2 rows each, R2 spans 4, R3 spans 8.
 *
 * For West (right side), card order is flipped (R3 on left, R1 on right) so the
 * bracket flows inward toward the centered Finals card.
 *
 * Card columns use minmax(170px, 1fr) so they never collapse; the whole bracket
 * sits inside an overflow-x-auto wrapper with min-width so it always renders.
 */
function ConfHalf({
  r1, r2, r3,
  side,
  championPath,
  conferenceColor,
  conferenceLabel,
  roundLabels,
}: {
  r1: Series[];
  r2: Series[];
  r3: Series[];
  side: "left" | "right";
  championPath: Set<string>;
  conferenceColor: string;
  conferenceLabel: string;
  roundLabels: Record<number, string>;
}) {
  const isLeft = side === "left";

  // Display order matches actual NBA bracket pairing.
  // R2.0 (top R2) = R1.0 + R1.3, so they must appear as displayR1[0] & [1].
  // R2.1 (bottom R2) = R1.1 + R1.2, so they must appear as displayR1[2] & [3].
  // Top→bottom visual order: 1v8, 4v5, 3v6, 2v7 → series indices [0, 3, 2, 1].
  // West mirrors with offset 4 → [4, 7, 6, 5].
  const r1Order = isLeft ? [0, 3, 2, 1] : [4, 7, 6, 5];
  const displayR1 = r1Order
    .map((idx) => r1.find((s) => s.seriesIndex === idx))
    .filter((s): s is Series => !!s);
  const displayR2 = [...r2].sort((a, b) => a.seriesIndex - b.seriesIndex);
  const displayR3 = [...r3].sort((a, b) => a.seriesIndex - b.seriesIndex);

  // Tight enough to fit ~990px wide for narrow viewports; gutters compact but still visible.
  const gridCols = isLeft
    ? "minmax(120px, 1fr) 28px minmax(125px, 1fr) 28px minmax(135px, 1fr)"
    : "minmax(135px, 1fr) 28px minmax(125px, 1fr) 28px minmax(120px, 1fr)";

  const cardWrap = "flex items-center";

  return (
    <div className="relative">
      {/* Conference badge */}
      <div className={`mb-3 ${isLeft ? "" : "text-right"}`}>
        <span
          className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.25em] px-2.5 py-1 rounded-md border"
          style={{
            background: `color-mix(in srgb, ${conferenceColor} 10%, transparent)`,
            borderColor: `color-mix(in srgb, ${conferenceColor} 30%, transparent)`,
            color: conferenceColor,
          }}
        >
          {isLeft && <span className="w-1.5 h-1.5 rounded-full" style={{ background: conferenceColor }} />}
          {conferenceLabel}
          {!isLeft && <span className="w-1.5 h-1.5 rounded-full" style={{ background: conferenceColor }} />}
        </span>
      </div>

      {/* Single unified grid — headers in row 1, cards/connectors in rows 2-9.
          Row min-height bumped from 54→72 so R1 pairs breathe; gap-y-2 (8px)
          puts visible vertical breathing room between adjacent cards. */}
      <div className="grid gap-x-1 gap-y-2" style={{
        gridTemplateColumns: gridCols,
        gridTemplateRows: "auto repeat(8, minmax(72px, auto))",
      }}>
        {/* Round headers — row 1 */}
        {isLeft ? (
          <>
            <div style={{ gridColumn: "1 / 2", gridRow: "1 / 2" }}>
              <RoundLabel label={roundLabels[1]} sub="Round 1" color="#94A3B8" count={displayR1.length} />
            </div>
            <div style={{ gridColumn: "3 / 4", gridRow: "1 / 2" }}>
              <RoundLabel label={roundLabels[2]} sub="Round 2" color="#94A3B8" count={r2.length} />
            </div>
            <div style={{ gridColumn: "5 / 6", gridRow: "1 / 2" }}>
              <RoundLabel label={roundLabels[3]} sub="Conference Final" color={conferenceColor} count={r3.length} />
            </div>
          </>
        ) : (
          <>
            <div style={{ gridColumn: "1 / 2", gridRow: "1 / 2" }}>
              <RoundLabel label={roundLabels[3]} sub="Conference Final" color={conferenceColor} count={r3.length} />
            </div>
            <div style={{ gridColumn: "3 / 4", gridRow: "1 / 2" }}>
              <RoundLabel label={roundLabels[2]} sub="Round 2" color="#94A3B8" count={r2.length} />
            </div>
            <div style={{ gridColumn: "5 / 6", gridRow: "1 / 2" }}>
              <RoundLabel label={roundLabels[1]} sub="Round 1" color="#94A3B8" count={displayR1.length} />
            </div>
          </>
        )}

        {/* R1 cards — rows 2-9, each spans 2 rows */}
        {displayR1.map((s, i) => (
          <div
            key={s.id}
            className={cardWrap}
            style={{
              gridColumn: isLeft ? "1 / 2" : "5 / 6",
              gridRow: `${i * 2 + 2} / ${i * 2 + 4}`,
            }}
          >
            <SeriesCard s={s} size="sm" onPath={championPath.has(s.id)} align={isLeft ? "left" : "right"} />
          </div>
        ))}

        {/* R1 → R2 connectors */}
        {displayR2.length > 0 && displayR1.length === 4 && [0, 1].map((pairIdx) => {
          const r2Match = displayR2[pairIdx];
          const highlight = r2Match && championPath.has(r2Match.id);
          return (
            <div
              key={`r1r2-${pairIdx}`}
              className="relative"
              style={{
                gridColumn: isLeft ? "2 / 3" : "4 / 5",
                gridRow: pairIdx === 0 ? "2 / 6" : "6 / 10",
              }}
            >
              <Connector side={side} highlight={highlight} />
            </div>
          );
        })}

        {/* R2 cards */}
        {displayR2.map((s, i) => (
          <div
            key={s.id}
            className={cardWrap}
            style={{
              gridColumn: "3 / 4",
              gridRow: `${i * 4 + 2} / ${i * 4 + 6}`,
            }}
          >
            <SeriesCard s={s} size="sm" onPath={championPath.has(s.id)} align={isLeft ? "left" : "right"} />
          </div>
        ))}

        {/* R2 → R3 connector */}
        {displayR3.length > 0 && displayR2.length === 2 && (
          <div
            className="relative"
            style={{
              gridColumn: isLeft ? "4 / 5" : "2 / 3",
              gridRow: "2 / 10",
            }}
          >
            <Connector side={side} highlight={championPath.has(displayR3[0].id)} />
          </div>
        )}

        {/* R3 card */}
        {displayR3.map((s) => (
          <div
            key={s.id}
            className={cardWrap}
            style={{
              gridColumn: isLeft ? "5 / 6" : "1 / 2",
              gridRow: "2 / 10",
            }}
          >
            <SeriesCard s={s} size="md" onPath={championPath.has(s.id)} align={isLeft ? "left" : "right"} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(function BracketTree({ games }: Props) {
  const { t } = useLocale();

  const sortedGames = [...games].sort((a, b) =>
    (a.gameCode || a.gameId).localeCompare(b.gameCode || b.gameId)
  );

  const seriesMap = new Map<string, Series>();
  for (const g of sortedGames) {
    const codes = [g.homeTeam.teamTricode, g.awayTeam.teamTricode].sort();
    const parsed = parseGameId(g.gameId);
    // Include round in the key so same teams meeting in different rounds (rare edge
    // case) don't get merged. In practice playoff teams can only meet once but
    // the test data sometimes has duplicates from re-runs of season simulation.
    const key = `R${parsed.round}-${codes.join("-")}`;
    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        id: key,
        gameIdSample: g.gameId,
        team1: { tricode: codes[0], teamId: 0, teamCity: "", teamName: "", wins: 0, seed: 0 },
        team2: { tricode: codes[1], teamId: 0, teamCity: "", teamName: "", wins: 0, seed: 0 },
        totalGames: 0,
        conference: getConference(codes[0], codes[1]),
        round: parsed.round,
        seriesIndex: parsed.seriesIndex,
        results: [],
      });
    }
    const series = seriesMap.get(key)!;
    series.totalGames++;
    const homeWon = g.homeTeam.score > g.awayTeam.score;
    const winner = homeWon ? g.homeTeam : g.awayTeam;
    const loser = homeWon ? g.awayTeam : g.homeTeam;
    if (winner.teamTricode === codes[0]) {
      series.team1.wins++;
      series.team1.teamId = winner.teamId;
      series.team1.teamCity = winner.teamCity;
      series.team1.teamName = winner.teamName;
      series.team1.seed = winner.seed;
      series.results.push("T1");
    } else {
      series.team2.wins++;
      series.team2.teamId = winner.teamId;
      series.team2.teamCity = winner.teamCity;
      series.team2.teamName = winner.teamName;
      series.team2.seed = winner.seed;
      series.results.push("T2");
    }
    if (loser.teamTricode === codes[0] && !series.team1.teamId) {
      series.team1.teamId = loser.teamId; series.team1.teamCity = loser.teamCity;
      series.team1.teamName = loser.teamName; series.team1.seed = loser.seed;
    } else if (loser.teamTricode === codes[1] && !series.team2.teamId) {
      series.team2.teamId = loser.teamId; series.team2.teamCity = loser.teamCity;
      series.team2.teamName = loser.teamName; series.team2.seed = loser.seed;
    }
  }

  const actualSeries = [...seriesMap.values()];
  if (actualSeries.length === 0) return null;
  // Round was set from gameId at series creation; no inference needed.

  // Project placeholder series for upcoming rounds (advanced teams pre-filled).
  const allSeries = projectFutureSeries(actualSeries);

  // Filter by conference; Finals is always round 4.
  // East/West get rounds 1-3 (R1, R2 / Semis, ConfFinals).
  const east = allSeries.filter((s) => s.conference === "East" && s.round >= 1 && s.round <= 3);
  const west = allSeries.filter((s) => s.conference === "West" && s.round >= 1 && s.round <= 3);
  const finals = allSeries.filter((s) => s.round === 4);

  const championPath = new Set<string>();
  for (const s of allSeries) {
    if (isOnChampionPath(s, allSeries)) championPath.add(s.id);
  }

  const champion = finals.find((s) => winnerOf(s));
  const championTeam = champion ? winnerOf(champion) : null;

  const completed = allSeries.filter((s) => winnerOf(s)).length;
  const active = allSeries.filter((s) => !winnerOf(s) && s.totalGames > 0).length;

  const roundLabels: Record<number, string> = {
    1: t.playoffBracket.firstRound,
    2: t.playoffBracket.confSemis,
    3: t.playoffBracket.confFinals,
    4: t.playoffBracket.finals,
  };

  const eastR1 = east.filter((s) => s.round === 1);
  const eastR2 = east.filter((s) => s.round === 2);
  const eastR3 = east.filter((s) => s.round === 3);
  const westR1 = west.filter((s) => s.round === 1);
  const westR2 = west.filter((s) => s.round === 2);
  const westR3 = west.filter((s) => s.round === 3);

  return (
    <section>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2.5">
          <Trophy size={18} className="text-accent-amber" />
          {t.playoffBracket.title}
          {championTeam && (
            <span className="ml-2 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] px-2.5 py-1 rounded-full bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30 animate-fade-in">
              <Crown size={11} />
              {championTeam.tricode} CHAMPION
            </span>
          )}
        </h2>
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded-full bg-bg-card border border-border text-text-secondary tabular-nums">
            {allSeries.length} {t.historyPage.series}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-accent-amber/15 text-accent-amber font-medium tabular-nums">
            {completed} {t.playoffBracket.completed}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-success/15 text-success font-medium tabular-nums">
            {active} {t.playoffBracket.active}
          </span>
        </div>
      </div>

      {/* Desktop tree (md+) — horizontal scroll on narrow screens */}
      <div className="hidden md:block overflow-x-auto pb-3 -mx-4 px-4">
        <div className="grid items-stretch gap-x-2 min-w-[960px]" style={{
          gridTemplateColumns: "minmax(0, 1fr) 160px minmax(0, 1fr)",
        }}>
          {/* East half */}
          <div className="relative">
            {eastR1.length > 0 ? (
              <ConfHalf
                r1={eastR1}
                r2={eastR2}
                r3={eastR3}
                side="left"
                championPath={championPath}
                conferenceColor="#3B82F6"
                conferenceLabel={t.playoffBracket.eastConference}
                roundLabels={roundLabels}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-text-secondary font-mono uppercase tracking-[0.15em]">East TBD</div>
            )}
          </div>

          {/* Finals center column */}
          <div className="relative flex flex-col items-center">
            {/* Finals label header */}
            <div className="text-center mb-3 pb-2 border-b border-[#FFD700]/30 w-full">
              <p className="text-[8px] font-mono uppercase tracking-[0.3em] text-text-secondary/50">/ NBA</p>
              <p className="text-sm font-bold font-mono uppercase tracking-[0.25em] text-[#FFD700] mt-0.5 flex items-center justify-center gap-1.5">
                <Trophy size={14} /> {t.playoffBracket.finals}
              </p>
              <p className="text-[9px] font-mono text-text-secondary/60 mt-0.5">championship</p>
            </div>

            {/* Centered Finals card */}
            <div className="relative flex-1 w-full flex items-center justify-center">
              <div className="absolute inset-0 bg-[#FFD700]/8 blur-3xl rounded-3xl pointer-events-none" />
              {finals.length > 0 ? (
                <div className="relative w-full">
                  <SeriesCard s={finals[0]} size="lg" onPath={!finals[0].isProjected} align="left" />
                </div>
              ) : (
                <div className="relative w-full glass-tile p-6 text-center bg-[#FFD700]/[0.02] ring-1 ring-[#FFD700]/20">
                  <Trophy size={32} className="mx-auto text-text-secondary/40 mb-2" />
                  <p className="text-xs font-mono uppercase tracking-[0.2em] text-text-secondary/60">Finals TBD</p>
                  <p className="text-[10px] font-mono text-text-secondary/40 mt-1">East champion<br />vs<br />West champion</p>
                </div>
              )}
            </div>
          </div>

          {/* West half */}
          <div className="relative">
            {westR1.length > 0 ? (
              <ConfHalf
                r1={westR1}
                r2={westR2}
                r3={westR3}
                side="right"
                championPath={championPath}
                conferenceColor="#F59E0B"
                conferenceLabel={t.playoffBracket.westConference}
                roundLabels={roundLabels}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-text-secondary font-mono uppercase tracking-[0.15em]">West TBD</div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile (< md): vertical stacked, round-grouped */}
      <div className="md:hidden space-y-5">
        {/* Finals on top */}
        {finals.length > 0 && (
          <div className="glass-tile p-4 bg-[#FFD700]/[0.04] ring-1 ring-[#FFD700]/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-[#FFD700]/5 blur-2xl pointer-events-none" />
            <div className="relative">
              <div className="text-center mb-3 pb-2 border-b border-[#FFD700]/20">
                <p className="text-[8px] font-mono uppercase tracking-[0.3em] text-text-secondary/50">/ NBA</p>
                <p className="text-sm font-bold font-mono uppercase tracking-[0.25em] text-[#FFD700] mt-0.5 flex items-center justify-center gap-1.5">
                  <Trophy size={14} /> {t.playoffBracket.finals}
                </p>
              </div>
              <div className="max-w-sm mx-auto">
                <SeriesCard s={finals[0]} size="lg" onPath={!finals[0].isProjected} align="left" />
              </div>
            </div>
          </div>
        )}

        {/* East/West sections — each with all rounds clearly separated */}
        {[
          { label: t.playoffBracket.eastConference, series: east, color: "#3B82F6", bg: "bg-accent/[0.04]" },
          { label: t.playoffBracket.westConference, series: west, color: "#F59E0B", bg: "bg-accent-amber/[0.04]" },
        ].map((conf) => {
          if (conf.series.length === 0) return null;
          const rounds = [
            { num: 3, label: roundLabels[3], sub: "Conference Final", list: conf.series.filter((s) => s.round === 3) },
            { num: 2, label: roundLabels[2], sub: "Round 2", list: conf.series.filter((s) => s.round === 2) },
            { num: 1, label: roundLabels[1], sub: "Round 1", list: conf.series.filter((s) => s.round === 1) },
          ];
          return (
            <div key={conf.label} className={`glass-tile p-4 ${conf.bg}`}>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border/40">
                <span className="w-2 h-2 rounded-full" style={{ background: conf.color }} />
                <h3 className="text-sm font-bold font-mono uppercase tracking-[0.2em]" style={{ color: conf.color }}>{conf.label}</h3>
              </div>
              <div className="space-y-4">
                {rounds.map((r) => r.list.length > 0 && (
                  <div key={r.num}>
                    <div className="flex items-baseline justify-between mb-2">
                      <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary">
                        / <span className="text-text-secondary/60">{r.sub}</span> · <span className="text-text-primary">{r.label}</span>
                      </p>
                      <span className="text-[9px] font-mono tabular-nums text-text-secondary/60">{r.list.length} series</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {r.list.map((s) => (
                        <SeriesCard key={s.id} s={s} size="sm" onPath={championPath.has(s.id)} align="left" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});
