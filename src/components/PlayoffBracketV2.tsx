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

interface Series {
  team1: { tricode: string; teamId: number; teamCity: string; teamName: string; wins: number; seed: number };
  team2: { tricode: string; teamId: number; teamCity: string; teamName: string; wins: number; seed: number };
  totalGames: number;
  conference: "East" | "West" | "Finals";
  round: number; // 1=First Round, 2=Conf Semis, 3=Conf Finals, 4=Finals
  results: ("T1" | "T2")[]; // sequence of game winners in series order
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

function getConference(tricode1: string, tricode2: string): "East" | "West" | "Finals" {
  const t1 = TEAM_META[tricode1];
  const t2 = TEAM_META[tricode2];
  if (!t1 || !t2) return "East";
  if (t1.conference !== t2.conference) return "Finals";
  return t1.conference as "East" | "West";
}

function ProgressDots({ results, t1Tri }: { results: ("T1" | "T2")[]; t1Tri: string }) {
  const slots = Array.from({ length: 7 });
  return (
    <div className="flex items-center justify-center gap-1 mt-2">
      {slots.map((_, i) => {
        const r = results[i];
        const filled = r === "T1" ? "bg-accent" : r === "T2" ? "bg-success" : "bg-bg-hover";
        return (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${filled}`}
            title={r ? `Game ${i + 1}: ${r === "T1" ? t1Tri : "opp"} won` : `Game ${i + 1}: not played`}
          />
        );
      })}
    </div>
  );
}

function TeamRow({
  team,
  leading,
  isWinner,
  isLoser,
  primaryColor,
  hero,
}: {
  team: Series["team1"];
  leading: boolean;
  isWinner: boolean;
  isLoser: boolean;
  primaryColor?: string;
  hero: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 ${hero ? "py-2" : "py-1.5"} ${isLoser ? "opacity-45" : ""} relative`}
      style={primaryColor && leading ? { boxShadow: `inset 3px 0 0 0 ${primaryColor}` } : undefined}
    >
      <TeamLogo teamId={team.teamId} tricode={team.tricode} size={hero ? 32 : 20} />
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {team.seed > 0 && (
          <span className="text-[10px] font-mono tabular-nums text-text-secondary/60 shrink-0">
            {team.seed}
          </span>
        )}
        <span className={`${hero ? "text-base" : "text-xs"} font-bold font-mono ${leading ? "text-text-primary" : "text-text-secondary"} truncate`}>
          {team.tricode}
        </span>
        {isWinner && <Crown size={hero ? 16 : 12} className="text-[#FFD700] shrink-0" />}
      </div>
      <span className={`${hero ? "text-2xl" : "text-base"} font-light font-mono tabular-nums shrink-0 ${leading ? "text-accent-amber" : "text-text-secondary"}`}>
        {team.wins}
      </span>
    </div>
  );
}

function SeriesCard({ s, hero = false }: { s: Series; hero?: boolean }) {
  const finished = s.team1.wins === 4 || s.team2.wins === 4;
  const t1Leading = s.team1.wins > s.team2.wins;
  const t2Leading = s.team2.wins > s.team1.wins;
  const winner = finished ? (t1Leading ? s.team1 : s.team2) : null;
  const meta1 = TEAM_META[s.team1.tricode];
  const meta2 = TEAM_META[s.team2.tricode];

  return (
    <div
      className={`glass-tile relative overflow-hidden ${hero ? "p-4" : "p-2.5"} ${finished ? "ring-1 ring-[#FFD700]/30 bg-[#FFD700]/[0.03]" : ""}`}
    >
      <TeamRow
        team={s.team1}
        leading={t1Leading}
        isWinner={finished && winner?.tricode === s.team1.tricode}
        isLoser={finished && winner?.tricode !== s.team1.tricode}
        primaryColor={meta1?.primaryColor}
        hero={hero}
      />
      <TeamRow
        team={s.team2}
        leading={t2Leading}
        isWinner={finished && winner?.tricode === s.team2.tricode}
        isLoser={finished && winner?.tricode !== s.team2.tricode}
        primaryColor={meta2?.primaryColor}
        hero={hero}
      />

      <ProgressDots results={s.results} t1Tri={s.team1.tricode} />

      {finished ? (
        <div className={`text-[9px] font-mono uppercase tracking-[0.18em] text-center text-[#FFD700] mt-1.5 font-bold flex items-center justify-center gap-1`}>
          <Crown size={10} />
          <span>{winner?.tricode} wins {Math.max(s.team1.wins, s.team2.wins)}-{Math.min(s.team1.wins, s.team2.wins)}</span>
        </div>
      ) : s.totalGames > 0 ? (
        <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-center text-text-secondary mt-1">
          GM <span className="tabular-nums">{s.totalGames + 1}</span> next
        </div>
      ) : null}
    </div>
  );
}

function ConfColumn({
  series,
  title,
  side,
  color,
  roundLabels,
  flip,
}: {
  series: Series[];
  title: string;
  side: "left" | "right";
  color: string;
  roundLabels: Record<number, string>;
  flip?: boolean;
}) {
  const byRound = new Map<number, Series[]>();
  for (const s of series) {
    const arr = byRound.get(s.round) || [];
    arr.push(s);
    byRound.set(s.round, arr);
  }
  // sort rounds 1→3 (R1 outer, ConfFinals inner)
  const rounds = [...byRound.keys()].sort((a, b) => a - b);

  // For left side: render R1 → R2 → R3 (left-to-right)
  // For right side: render R3 → R2 → R1 (mirrored)
  const orderedRounds = flip ? [...rounds].reverse() : rounds;

  return (
    <div className="flex-1 min-w-0">
      <div className={`flex items-center gap-2 mb-3 ${flip ? "justify-end" : ""}`}>
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <h3 className="text-[10px] font-mono uppercase tracking-[0.25em]" style={{ color }}>{title}</h3>
        <span className="h-px flex-1" style={{ background: `${color}33` }} />
      </div>
      <div className="flex gap-2 items-stretch">
        {orderedRounds.map((round) => (
          <div key={round} className="flex-1 flex flex-col justify-around gap-2 min-w-0">
            <p className={`text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60 text-center mb-1`}>
              {roundLabels[round]}
            </p>
            {byRound.get(round)!.map((s, i) => (
              <SeriesCard key={`${side}-${round}-${i}-${s.team1.tricode}-${s.team2.tricode}`} s={s} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(function PlayoffBracketV2({ games }: Props) {
  const { t } = useLocale();
  const roundLabels: Record<number, string> = {
    1: t.playoffBracket.firstRound,
    2: t.playoffBracket.confSemis,
    3: t.playoffBracket.confFinals,
    4: t.playoffBracket.finals,
  };

  // Sort games chronologically (gameCode often encodes date)
  const sortedGames = [...games].sort((a, b) =>
    (a.gameCode || a.gameId).localeCompare(b.gameCode || b.gameId)
  );

  // Group by series (same two teams)
  const seriesMap = new Map<string, Series>();

  for (const g of sortedGames) {
    const codes = [g.homeTeam.teamTricode, g.awayTeam.teamTricode].sort();
    const key = codes.join("-");

    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
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
      series.team1.teamId = loser.teamId;
      series.team1.teamCity = loser.teamCity;
      series.team1.teamName = loser.teamName;
      series.team1.seed = loser.seed;
    } else if (loser.teamTricode === codes[1] && !series.team2.teamId) {
      series.team2.teamId = loser.teamId;
      series.team2.teamCity = loser.teamCity;
      series.team2.teamName = loser.teamName;
      series.team2.seed = loser.seed;
    }
  }

  const allSeries = [...seriesMap.values()];
  if (allSeries.length === 0) return null;

  for (const s of allSeries) {
    s.round = inferRound(allSeries, s);
  }

  const eastSeries = allSeries.filter((s) => s.conference === "East").sort((a, b) => a.round - b.round || a.team1.seed - b.team1.seed);
  const westSeries = allSeries.filter((s) => s.conference === "West").sort((a, b) => a.round - b.round || a.team1.seed - b.team1.seed);
  const finalsSeries = allSeries.filter((s) => s.conference === "Finals");

  const completed = allSeries.filter((s) => s.team1.wins === 4 || s.team2.wins === 4).length;
  const active = allSeries.filter((s) => s.team1.wins < 4 && s.team2.wins < 4 && s.totalGames > 0).length;
  const champion = finalsSeries.find((s) => s.team1.wins === 4 || s.team2.wins === 4);
  const championTeam = champion
    ? (champion.team1.wins === 4 ? champion.team1 : champion.team2)
    : null;

  return (
    <section>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2.5">
          <Trophy size={18} className="text-accent-amber" />
          {t.playoffBracket.title}
          {championTeam && (
            <span className="ml-2 flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.2em] px-2 py-0.5 rounded-full bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30">
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

      {/* Desktop: East | Finals | West with bracket alignment */}
      <div className="hidden md:block">
        <div className="flex gap-3 items-stretch">
          {/* East column */}
          {eastSeries.length > 0 && (
            <div className="flex-1 min-w-0 glass-tile p-3 bg-accent/[0.04]">
              <ConfColumn
                series={eastSeries}
                title={t.playoffBracket.eastConference}
                side="left"
                color="#3B82F6"
                roundLabels={roundLabels}
              />
            </div>
          )}

          {/* Finals hero card */}
          {finalsSeries.length > 0 && (
            <div className="w-64 shrink-0 flex flex-col items-stretch justify-center">
              <div className="text-center mb-3">
                <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ Championship</p>
                <h3 className="text-base font-bold text-[#FFD700] tracking-tight flex items-center justify-center gap-1.5 mt-0.5">
                  <Trophy size={14} />
                  {t.playoffBracket.finals}
                </h3>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-[#FFD700]/5 blur-2xl rounded-3xl pointer-events-none" />
                <div className="relative space-y-3">
                  {finalsSeries.map((s, i) => (
                    <SeriesCard key={`finals-${i}-${s.team1.tricode}-${s.team2.tricode}`} s={s} hero />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* West column (mirrored) */}
          {westSeries.length > 0 && (
            <div className="flex-1 min-w-0 glass-tile p-3 bg-accent-amber/[0.04]">
              <ConfColumn
                series={westSeries}
                title={t.playoffBracket.westConference}
                side="right"
                color="#F59E0B"
                roundLabels={roundLabels}
                flip
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile: stacked sections */}
      <div className="md:hidden space-y-5">
        {finalsSeries.length > 0 && (
          <div className="glass-tile p-4 bg-[#FFD700]/[0.04] ring-1 ring-[#FFD700]/20">
            <div className="text-center mb-3">
              <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ Championship</p>
              <h3 className="text-sm font-bold text-[#FFD700] tracking-tight flex items-center justify-center gap-1.5 mt-0.5">
                <Trophy size={12} />
                {t.playoffBracket.finals}
              </h3>
            </div>
            <div className="space-y-2 max-w-xs mx-auto">
              {finalsSeries.map((s, i) => (
                <SeriesCard key={`m-finals-${i}-${s.team1.tricode}-${s.team2.tricode}`} s={s} hero />
              ))}
            </div>
          </div>
        )}
        {eastSeries.length > 0 && (
          <div className="glass-tile p-3 bg-accent/[0.04]">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-accent">{t.playoffBracket.eastConference}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {eastSeries.map((s, i) => (
                <SeriesCard key={`m-east-${i}-${s.team1.tricode}-${s.team2.tricode}`} s={s} />
              ))}
            </div>
          </div>
        )}
        {westSeries.length > 0 && (
          <div className="glass-tile p-3 bg-accent-amber/[0.04]">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-accent-amber" />
              <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-accent-amber">{t.playoffBracket.westConference}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {westSeries.map((s, i) => (
                <SeriesCard key={`m-west-${i}-${s.team1.tricode}-${s.team2.tricode}`} s={s} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
});
