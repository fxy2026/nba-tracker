"use client";

import { memo } from "react";
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
  team1: SeriesTeam;
  team2: SeriesTeam;
  totalGames: number;
  conference: "East" | "West" | "Finals";
  round: number;
  results: ("T1" | "T2")[];
}

function getConference(tricode1: string, tricode2: string): "East" | "West" | "Finals" {
  const t1 = TEAM_META[tricode1];
  const t2 = TEAM_META[tricode2];
  if (!t1 || !t2) return "East";
  if (t1.conference !== t2.conference) return "Finals";
  return t1.conference as "East" | "West";
}

function inferRound(series: Series[], s: Series): number {
  const confSeries = series.filter((x) => x.conference === s.conference);
  if (s.conference === "Finals") return 4;
  if (s.team1.seed > 0 && s.team2.seed > 0) {
    const seedSum = s.team1.seed + s.team2.seed;
    if (seedSum === 9) return 1;
    if ([3, 4, 5, 6, 7, 8, 10, 11, 12, 13].includes(seedSum)) {
      if (confSeries.length >= 6) return 1;
      if (confSeries.length >= 3) return seedSum <= 5 ? 2 : 1;
      return seedSum <= 3 ? 3 : 2;
    }
  }
  if (confSeries.length <= 1) return 3;
  if (confSeries.length <= 2) return 2;
  return 1;
}

function winnerOf(s: Series): SeriesTeam | null {
  if (s.team1.wins === 4) return s.team1;
  if (s.team2.wins === 4) return s.team2;
  return null;
}

function isOnChampionPath(s: Series, allSeries: Series[]): boolean {
  // A series is on the champion path if its winner ultimately won the title.
  const champion = allSeries.find((x) => x.conference === "Finals" && winnerOf(x));
  if (!champion) return false;
  const championTri = winnerOf(champion)!.tricode;
  const winner = winnerOf(s);
  return winner?.tricode === championTri;
}

function ProgressDots({ results, total }: { results: ("T1" | "T2")[]; total: number }) {
  const slots = Array.from({ length: 7 });
  return (
    <div className="flex items-center justify-center gap-[3px] mt-2">
      {slots.map((_, i) => {
        const r = results[i];
        const filled = r === "T1" ? "bg-accent" : r === "T2" ? "bg-success" : "bg-bg-hover";
        return (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${filled}`}
            title={r ? `Game ${i + 1}` : `Game ${i + 1} not played`}
          />
        );
      })}
      <span className="ml-1 text-[8px] font-mono uppercase tracking-[0.15em] text-text-secondary/60 tabular-nums">
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
}: {
  team: SeriesTeam;
  leading: boolean;
  isWinner: boolean;
  isLoser: boolean;
  primaryColor?: string;
  size: "sm" | "md" | "lg";
  align: "left" | "right";
}) {
  const logoSize = size === "lg" ? 32 : size === "md" ? 24 : 20;
  const triSize = size === "lg" ? "text-lg" : size === "md" ? "text-sm" : "text-xs";
  const winSize = size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-base";
  const pad = size === "lg" ? "py-2" : "py-1";

  const inner = (
    <>
      {align === "left" ? (
        <>
          <TeamLogo teamId={team.teamId} tricode={team.tricode} size={logoSize} />
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            {team.seed > 0 && (
              <span className="text-[10px] font-mono tabular-nums text-text-secondary/60 shrink-0">{team.seed}</span>
            )}
            <span className={`${triSize} font-bold font-mono ${leading ? "text-text-primary" : "text-text-secondary"} truncate`}>
              {team.tricode}
            </span>
            {isWinner && <Crown size={size === "lg" ? 16 : 12} className="text-[#FFD700] shrink-0" />}
          </div>
          <span className={`${winSize} font-light font-mono tabular-nums shrink-0 ${leading ? "text-accent-amber" : "text-text-secondary"}`}>
            {team.wins}
          </span>
        </>
      ) : (
        <>
          <span className={`${winSize} font-light font-mono tabular-nums shrink-0 ${leading ? "text-accent-amber" : "text-text-secondary"}`}>
            {team.wins}
          </span>
          <div className="flex-1 min-w-0 flex items-center justify-end gap-1.5">
            {isWinner && <Crown size={size === "lg" ? 16 : 12} className="text-[#FFD700] shrink-0" />}
            <span className={`${triSize} font-bold font-mono ${leading ? "text-text-primary" : "text-text-secondary"} truncate`}>
              {team.tricode}
            </span>
            {team.seed > 0 && (
              <span className="text-[10px] font-mono tabular-nums text-text-secondary/60 shrink-0">{team.seed}</span>
            )}
          </div>
          <TeamLogo teamId={team.teamId} tricode={team.tricode} size={logoSize} />
        </>
      )}
    </>
  );

  return (
    <div
      className={`flex items-center gap-2 ${pad} ${isLoser ? "opacity-40" : ""} relative`}
      style={
        primaryColor && leading
          ? align === "left"
            ? { boxShadow: `inset 3px 0 0 0 ${primaryColor}` }
            : { boxShadow: `inset -3px 0 0 0 ${primaryColor}` }
          : undefined
      }
    >
      {inner}
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

  const padClass = size === "lg" ? "p-4" : size === "md" ? "p-3" : "p-2.5";
  const ring = onPath
    ? "ring-1 ring-[#FFD700]/40 shadow-[0_0_20px_-4px_rgba(255,215,0,0.3)]"
    : finished
    ? "ring-1 ring-text-secondary/20"
    : "";

  return (
    <div className={`glass-tile relative overflow-hidden ${padClass} ${ring}`}>
      {onPath && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFD700]/[0.04] to-transparent pointer-events-none" />
      )}
      <div className="relative">
        <TeamRow
          team={s.team1}
          leading={t1Leading}
          isWinner={finished && winner?.tricode === s.team1.tricode}
          isLoser={finished && winner?.tricode !== s.team1.tricode}
          primaryColor={meta1?.primaryColor}
          size={size}
          align={align}
        />
        <TeamRow
          team={s.team2}
          leading={t2Leading}
          isWinner={finished && winner?.tricode === s.team2.tricode}
          isLoser={finished && winner?.tricode !== s.team2.tricode}
          primaryColor={meta2?.primaryColor}
          size={size}
          align={align}
        />
        <ProgressDots results={s.results} total={s.totalGames} />
        {finished && (
          <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-center text-[#FFD700] mt-1.5 font-bold flex items-center justify-center gap-1">
            <Crown size={10} />
            <span>{winner?.tricode} {Math.max(s.team1.wins, s.team2.wins)}-{Math.min(s.team1.wins, s.team2.wins)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Bracket connector: ┐ + ┘ converging into → going to next round
 * Drawn as overlay using positioned divs with borders.
 *
 * For each pair of feeder matches (top, bottom), we draw:
 *   - top: line right from card, then bend DOWN to converge point
 *   - bottom: line right from card, then bend UP to converge point
 *   - center: horizontal line from converge point to next round card
 */
function Connector({
  topPercent,
  bottomPercent,
  side,
  highlight,
}: {
  topPercent: number; // y position of top feeder's center, as % of grid
  bottomPercent: number; // y position of bottom feeder's center, as % of grid
  side: "left" | "right";
  highlight?: boolean;
}) {
  const midY = (topPercent + bottomPercent) / 2;
  const color = highlight ? "stroke-[#FFD700]" : "stroke-border-strong";
  const opacity = highlight ? "opacity-90" : "opacity-50";

  // We draw 3 path segments: top-feeder L, bottom-feeder L, and exit to next round
  // SVG viewBox: 100×100 with preserveAspectRatio: none for full stretch
  const leftEdge = side === "left" ? 0 : 100;
  const rightEdge = side === "left" ? 100 : 0;
  const turnX = side === "left" ? 50 : 50;
  const exitX = rightEdge;

  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none ${opacity}`}
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <path
        d={`M ${leftEdge} ${topPercent} L ${turnX} ${topPercent} L ${turnX} ${midY} M ${leftEdge} ${bottomPercent} L ${turnX} ${bottomPercent} L ${turnX} ${midY} M ${turnX} ${midY} L ${exitX} ${midY}`}
        fill="none"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        className={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Render one half of the bracket (East or West) with cards and connectors.
 *
 * Layout: CSS Grid 3-column for [R1, gutter1, R2, gutter2, R3] or mirrored for West.
 * Each conference uses 8 grid rows; R1 cards span 2 rows, R2 span 4, R3 spans 8.
 */
function ConfHalf({
  r1, r2, r3,
  side,
  championPath,
  conferenceColor,
}: {
  r1: Series[];
  r2: Series[];
  r3: Series[];
  side: "left" | "right";
  championPath: Set<string>;
  conferenceColor: string;
}) {
  const isLeft = side === "left";

  // Sort r1 so the pairing matches: r1[0]+r1[1] feed r2[0], r1[2]+r1[3] feed r2[1]
  // Best-effort: seed-based ordering (1v8, 4v5, 3v6, 2v7 pairing)
  const sortedR1 = [...r1].sort((a, b) => {
    const aSeed = Math.min(a.team1.seed || 99, a.team2.seed || 99);
    const bSeed = Math.min(b.team1.seed || 99, b.team2.seed || 99);
    return aSeed - bSeed;
  });
  // Standard NBA bracket pairing by top seed: [1, 4, 3, 2]
  // Convert to display order: r1[0]=1seed, r1[1]=8seed... order to standard top→bottom: 1,8,4,5,3,6,2,7
  // but we only have 4 series; standard pairing is [1v8, 4v5] -> top half; [3v6, 2v7] -> bottom half
  // We'll just trust the seed sort and pair adjacents.
  const displayR1 = sortedR1.length === 4
    ? [sortedR1[0], sortedR1[1], sortedR1[2], sortedR1[3]]
    : sortedR1;

  return (
    <div className="relative grid gap-x-1" style={{
      gridTemplateColumns: isLeft
        ? "minmax(0, 1fr) 28px minmax(0, 1fr) 28px minmax(0, 1.05fr)"
        : "minmax(0, 1.05fr) 28px minmax(0, 1fr) 28px minmax(0, 1fr)",
      gridTemplateRows: "repeat(8, minmax(70px, auto))",
    }}>
      {/* R1 cards — 4 cards, each spans 2 rows */}
      {displayR1.map((s, i) => (
        <div
          key={s.id}
          className="flex items-center"
          style={{
            gridColumn: isLeft ? "1 / 2" : "5 / 6",
            gridRow: `${i * 2 + 1} / ${i * 2 + 3}`,
          }}
        >
          <SeriesCard s={s} size="sm" onPath={championPath.has(s.id)} align={isLeft ? "left" : "right"} />
        </div>
      ))}

      {/* R1 → R2 connectors */}
      {r2.length > 0 && displayR1.length === 4 && [0, 1].map((pairIdx) => {
        const r2Match = r2[pairIdx];
        const highlight = r2Match && championPath.has(r2Match.id);
        return (
          <div
            key={`r1r2-conn-${pairIdx}`}
            className="relative"
            style={{
              gridColumn: isLeft ? "2 / 3" : "4 / 5",
              gridRow: pairIdx === 0 ? "1 / 5" : "5 / 9",
            }}
          >
            <Connector
              topPercent={pairIdx === 0 ? 25 : 25}
              bottomPercent={pairIdx === 0 ? 75 : 75}
              side={side}
              highlight={highlight}
            />
          </div>
        );
      })}

      {/* R2 cards — 2 cards, each spans 4 rows */}
      {r2.map((s, i) => (
        <div
          key={s.id}
          className="flex items-center"
          style={{
            gridColumn: isLeft ? "3 / 4" : "3 / 4",
            gridRow: `${i * 4 + 1} / ${i * 4 + 5}`,
          }}
        >
          <SeriesCard s={s} size="sm" onPath={championPath.has(s.id)} align={isLeft ? "left" : "right"} />
        </div>
      ))}

      {/* R2 → R3 connector */}
      {r3.length > 0 && r2.length === 2 && (
        <div
          className="relative"
          style={{
            gridColumn: isLeft ? "4 / 5" : "2 / 3",
            gridRow: "1 / 9",
          }}
        >
          <Connector
            topPercent={25}
            bottomPercent={75}
            side={side}
            highlight={championPath.has(r3[0].id)}
          />
        </div>
      )}

      {/* R3 card — spans full 8 rows */}
      {r3.map((s) => (
        <div
          key={s.id}
          className="flex items-center"
          style={{
            gridColumn: isLeft ? "5 / 6" : "1 / 2",
            gridRow: "1 / 9",
          }}
        >
          <SeriesCard s={s} size="md" onPath={championPath.has(s.id)} align={isLeft ? "left" : "right"} />
        </div>
      ))}

      {/* Round labels at top */}
      <div className="absolute inset-x-0 -top-7 grid gap-x-1 pointer-events-none" style={{
        gridTemplateColumns: isLeft
          ? "minmax(0, 1fr) 28px minmax(0, 1fr) 28px minmax(0, 1.05fr)"
          : "minmax(0, 1.05fr) 28px minmax(0, 1fr) 28px minmax(0, 1fr)",
      }}>
        {isLeft ? (
          <>
            <div className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 text-center" style={{ gridColumn: "1 / 2" }}>R1</div>
            <div />
            <div className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 text-center" style={{ gridColumn: "3 / 4" }}>R2</div>
            <div />
            <div className="text-[9px] font-mono uppercase tracking-[0.25em] text-center font-semibold" style={{ gridColumn: "5 / 6", color: conferenceColor }}>CONF · FINAL</div>
          </>
        ) : (
          <>
            <div className="text-[9px] font-mono uppercase tracking-[0.25em] text-center font-semibold" style={{ gridColumn: "1 / 2", color: conferenceColor }}>CONF · FINAL</div>
            <div />
            <div className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 text-center" style={{ gridColumn: "3 / 4" }}>R2</div>
            <div />
            <div className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 text-center" style={{ gridColumn: "5 / 6" }}>R1</div>
          </>
        )}
      </div>
    </div>
  );
}

export default memo(function BracketTree({ games }: Props) {
  const { t } = useLocale();

  // Build series from games
  const sortedGames = [...games].sort((a, b) =>
    (a.gameCode || a.gameId).localeCompare(b.gameCode || b.gameId)
  );

  const seriesMap = new Map<string, Series>();
  for (const g of sortedGames) {
    const codes = [g.homeTeam.teamTricode, g.awayTeam.teamTricode].sort();
    const key = codes.join("-");
    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        id: key,
        team1: { tricode: codes[0], teamId: 0, teamCity: "", teamName: "", wins: 0, seed: 0 },
        team2: { tricode: codes[1], teamId: 0, teamCity: "", teamName: "", wins: 0, seed: 0 },
        totalGames: 0,
        conference: getConference(codes[0], codes[1]),
        round: 1,
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

  const allSeries = [...seriesMap.values()];
  if (allSeries.length === 0) return null;
  for (const s of allSeries) s.round = inferRound(allSeries, s);

  const east = allSeries.filter((s) => s.conference === "East");
  const west = allSeries.filter((s) => s.conference === "West");
  const finals = allSeries.filter((s) => s.conference === "Finals");

  // Champion path — series whose winner ended up champion
  const championPath = new Set<string>();
  for (const s of allSeries) {
    if (isOnChampionPath(s, allSeries)) championPath.add(s.id);
  }

  const champion = finals.find((s) => winnerOf(s));
  const championTeam = champion ? winnerOf(champion) : null;

  const completed = allSeries.filter((s) => winnerOf(s)).length;
  const active = allSeries.filter((s) => !winnerOf(s) && s.totalGames > 0).length;

  const eastR1 = east.filter((s) => s.round === 1);
  const eastR2 = east.filter((s) => s.round === 2);
  const eastR3 = east.filter((s) => s.round === 3);
  const westR1 = west.filter((s) => s.round === 1);
  const westR2 = west.filter((s) => s.round === 2);
  const westR3 = west.filter((s) => s.round === 3);

  return (
    <section>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
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

      {/* Desktop tree */}
      <div className="hidden lg:block">
        <div className="relative pt-8">
          <div className="grid items-stretch gap-x-3" style={{
            gridTemplateColumns: "minmax(0, 1fr) 200px minmax(0, 1fr)",
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
                />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-text-secondary font-mono uppercase tracking-[0.15em]">East bracket TBD</div>
              )}
            </div>

            {/* Finals center */}
            <div className="relative flex flex-col items-center justify-center px-2">
              {/* Glow */}
              <div className="absolute inset-0 bg-[#FFD700]/10 blur-3xl rounded-3xl pointer-events-none" />

              {/* Trophy header */}
              <div className="relative text-center mb-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30">
                  <Trophy size={14} className="text-[#FFD700]" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#FFD700] font-bold">{t.playoffBracket.finals}</span>
                </div>
              </div>

              {/* Finals card */}
              {finals.length > 0 ? (
                <div className="relative w-full">
                  <SeriesCard s={finals[0]} size="lg" onPath align="left" />
                </div>
              ) : (
                <div className="relative w-full glass-tile p-6 text-center bg-[#FFD700]/[0.02]">
                  <Trophy size={28} className="mx-auto text-text-secondary/40 mb-2" />
                  <p className="text-xs font-mono uppercase tracking-[0.2em] text-text-secondary/60">Finals TBD</p>
                  <p className="text-[10px] font-mono text-text-secondary/40 mt-1">East champion vs West champion</p>
                </div>
              )}
            </div>

            {/* West half (mirrored) */}
            <div className="relative">
              {westR1.length > 0 ? (
                <ConfHalf
                  r1={westR1}
                  r2={westR2}
                  r3={westR3}
                  side="right"
                  championPath={championPath}
                  conferenceColor="#F59E0B"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-text-secondary font-mono uppercase tracking-[0.15em]">West bracket TBD</div>
              )}
            </div>
          </div>

          {/* Conference badges below */}
          <div className="grid mt-4 gap-x-3" style={{
            gridTemplateColumns: "minmax(0, 1fr) 200px minmax(0, 1fr)",
          }}>
            <div className="text-left">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.25em] text-accent px-2 py-1 rounded-md bg-accent/10">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                {t.playoffBracket.eastConference}
              </span>
            </div>
            <div />
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.25em] text-accent-amber px-2 py-1 rounded-md bg-accent-amber/10">
                {t.playoffBracket.westConference}
                <span className="w-1.5 h-1.5 rounded-full bg-accent-amber" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tablet/Mobile: vertical stacked */}
      <div className="lg:hidden space-y-5">
        {/* Finals on top */}
        {finals.length > 0 && (
          <div className="glass-tile p-4 bg-[#FFD700]/[0.04] ring-1 ring-[#FFD700]/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-[#FFD700]/5 blur-2xl pointer-events-none" />
            <div className="relative">
              <div className="text-center mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30">
                  <Trophy size={12} className="text-[#FFD700]" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#FFD700] font-bold">{t.playoffBracket.finals}</span>
                </span>
              </div>
              <div className="max-w-sm mx-auto">
                <SeriesCard s={finals[0]} size="lg" onPath align="left" />
              </div>
            </div>
          </div>
        )}

        {/* East/West sections */}
        {[
          { label: t.playoffBracket.eastConference, series: east, color: "#3B82F6", bg: "bg-accent/[0.04]" },
          { label: t.playoffBracket.westConference, series: west, color: "#F59E0B", bg: "bg-accent-amber/[0.04]" },
        ].map((conf) => {
          if (conf.series.length === 0) return null;
          const rounds = [
            { num: 3, label: t.playoffBracket.confFinals, list: conf.series.filter((s) => s.round === 3) },
            { num: 2, label: t.playoffBracket.confSemis, list: conf.series.filter((s) => s.round === 2) },
            { num: 1, label: t.playoffBracket.firstRound, list: conf.series.filter((s) => s.round === 1) },
          ];
          return (
            <div key={conf.label} className={`glass-tile p-4 ${conf.bg}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full" style={{ background: conf.color }} />
                <h3 className="text-[10px] font-mono uppercase tracking-[0.25em]" style={{ color: conf.color }}>{conf.label}</h3>
              </div>
              <div className="space-y-3">
                {rounds.map((r) => r.list.length > 0 && (
                  <div key={r.num}>
                    <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60 mb-1.5">/ {r.label}</p>
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
