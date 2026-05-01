"use client";

import { memo } from "react";
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
}

function inferRound(series: Series[], s: Series): number {
  // Count how many series exist for this conference to infer rounds
  const confSeries = series.filter((x) => x.conference === s.conference);
  if (s.conference === "Finals") return 4;

  // If seeds are known and valid, use matchup logic
  if (s.team1.seed > 0 && s.team2.seed > 0) {
    const seedSum = s.team1.seed + s.team2.seed;
    if (seedSum === 9) return 1;
    if ([3, 4, 5, 6, 7, 8, 10, 11, 12, 13].includes(seedSum)) {
      // Could be first round (non-standard) or later rounds
      // If 8 series exist for a conference = first round
      if (confSeries.length >= 6) return 1;
      if (confSeries.length >= 3) return seedSum <= 5 ? 2 : 1;
      return seedSum <= 3 ? 3 : 2;
    }
  }
  // Fallback
  if (confSeries.length <= 1) return 3;
  if (confSeries.length <= 2) return 2;
  return 1;
}

function getConference(tricode1: string, tricode2: string): "East" | "West" | "Finals" {
  const t1 = TEAM_META[tricode1];
  const t2 = TEAM_META[tricode2];
  if (!t1 || !t2) return "East";
  if (t1.conference !== t2.conference) return "Finals";
  return t1.conference;
}

// roundLabels moved inside component to access translations

function SeriesCard({ s, t }: { s: Series; t: import("@/locales/types").Translations }) {
  const finished = s.team1.wins === 4 || s.team2.wins === 4;
  const t1Leading = s.team1.wins > s.team2.wins;
  const t2Leading = s.team2.wins > s.team1.wins;
  const winner = finished ? (t1Leading ? s.team1 : s.team2) : null;

  return (
    <div className={`bg-bg-card rounded-lg border p-2.5 ${finished ? "border-accent/40" : "border-border"}`}>
      {/* Team 1 */}
      <div className={`flex items-center gap-2 py-1 ${winner && winner.tricode === s.team1.tricode ? "opacity-100" : winner ? "opacity-50" : ""}`}>
        <TeamLogo teamId={s.team1.teamId} tricode={s.team1.tricode} size={20} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {s.team1.seed > 0 && <span className="text-[10px] text-text-secondary">{s.team1.seed}</span>}
            <span className={`text-xs font-medium truncate ${t1Leading ? "text-text-primary" : "text-text-secondary"}`}>
              {s.team1.tricode}
            </span>
          </div>
        </div>
        <span className={`text-sm font-bold tabular-nums ${t1Leading ? "text-accent" : "text-text-secondary"}`}>
          {s.team1.wins}
        </span>
      </div>
      {/* Team 2 */}
      <div className={`flex items-center gap-2 py-1 ${winner && winner.tricode === s.team2.tricode ? "opacity-100" : winner ? "opacity-50" : ""}`}>
        <TeamLogo teamId={s.team2.teamId} tricode={s.team2.tricode} size={20} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {s.team2.seed > 0 && <span className="text-[10px] text-text-secondary">{s.team2.seed}</span>}
            <span className={`text-xs font-medium truncate ${t2Leading ? "text-text-primary" : "text-text-secondary"}`}>
              {s.team2.tricode}
            </span>
          </div>
        </div>
        <span className={`text-sm font-bold tabular-nums ${t2Leading ? "text-accent" : "text-text-secondary"}`}>
          {s.team2.wins}
        </span>
      </div>
      {/* Series Progress Dots */}
      <div className="flex items-center justify-center gap-0.5 mt-1.5 pt-1 border-t border-border/50">
        {Array.from({ length: 7 }).map((_, i) => {
          const isT1 = i < s.team1.wins;
          const isT2 = i >= 7 - s.team2.wins && i >= s.team1.wins;
          return (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                isT1 ? "bg-accent" : isT2 ? "bg-success" : "bg-bg-hover"
              }`}
            />
          );
        })}
      </div>
      {/* Status */}
      {finished ? (
        <div className="text-[10px] text-center text-accent mt-1">
          {winner?.tricode} wins {Math.max(s.team1.wins, s.team2.wins)}-{Math.min(s.team1.wins, s.team2.wins)}
        </div>
      ) : s.totalGames > 0 ? (
        <div className="text-[10px] text-center text-text-secondary mt-0.5">
          {t.common.game} {s.totalGames + 1}
        </div>
      ) : null}
    </div>
  );
}

function BracketColumn({ series, title, t, roundLabels }: { series: Series[]; title: string; t: import("@/locales/types").Translations; roundLabels: Record<number, string> }) {
  const byRound = new Map<number, Series[]>();
  for (const s of series) {
    const arr = byRound.get(s.round) || [];
    arr.push(s);
    byRound.set(s.round, arr);
  }
  const rounds = [...byRound.keys()].sort((a, b) => a - b);

  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3 text-center">{title}</h3>
      <div className="flex gap-2 items-stretch">
        {rounds.map((round) => (
          <div key={round} className="flex-1 flex flex-col gap-2">
            <p className="text-[10px] text-text-secondary text-center mb-1">{roundLabels[round]}</p>
            {byRound.get(round)!.map((s) => (
              <SeriesCard key={`${s.team1.tricode}-${s.team2.tricode}`} s={s} t={t} />
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

  // Group by series (same two teams)
  const seriesMap = new Map<string, Series>();

  for (const g of games) {
    const codes = [g.homeTeam.teamTricode, g.awayTeam.teamTricode].sort();
    const key = codes.join("-");

    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        team1: { tricode: codes[0], teamId: 0, teamCity: "", teamName: "", wins: 0, seed: 0 },
        team2: { tricode: codes[1], teamId: 0, teamCity: "", teamName: "", wins: 0, seed: 0 },
        totalGames: 0,
        conference: getConference(codes[0], codes[1]),
        round: 1,
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
    } else {
      series.team2.wins++;
      series.team2.teamId = winner.teamId;
      series.team2.teamCity = winner.teamCity;
      series.team2.teamName = winner.teamName;
      series.team2.seed = winner.seed;
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

  // Infer rounds
  for (const s of allSeries) {
    s.round = inferRound(allSeries, s);
  }

  // Group by conference and round
  const eastSeries = allSeries.filter((s) => s.conference === "East").sort((a, b) => a.round - b.round || a.team1.seed - b.team1.seed);
  const westSeries = allSeries.filter((s) => s.conference === "West").sort((a, b) => a.round - b.round || a.team1.seed - b.team1.seed);
  const finalsSeries = allSeries.filter((s) => s.conference === "Finals");

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className="w-1 h-5 bg-accent rounded-full" />
          {t.playoffBracket.title}
        </h2>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="px-2 py-0.5 rounded-full bg-bg-card border border-border text-text-secondary">
            {allSeries.length} {t.historyPage.series}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
            {allSeries.filter(s => s.team1.wins === 4 || s.team2.wins === 4).length} {t.playoffBracket.completed}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-success/15 text-success font-medium">
            {allSeries.filter(s => s.team1.wins < 4 && s.team2.wins < 4 && s.totalGames > 0).length} {t.playoffBracket.active}
          </span>
        </div>
      </div>

      {/* Desktop: East | Finals | West */}
      <div className="hidden md:flex gap-4 items-start">
        {eastSeries.length > 0 && <BracketColumn series={eastSeries} title={t.playoffBracket.eastConference} t={t} roundLabels={roundLabels} />}
        {finalsSeries.length > 0 && (
          <div className="flex flex-col items-center justify-center px-2">
            <h3 className="text-xs font-semibold text-accent uppercase tracking-wide mb-3">{t.playoffBracket.finals}</h3>
            <div className="space-y-2">
              {finalsSeries.map((s) => (
                <SeriesCard key={`${s.team1.tricode}-${s.team2.tricode}`} s={s} t={t} />
              ))}
            </div>
          </div>
        )}
        {westSeries.length > 0 && <BracketColumn series={westSeries} title={t.playoffBracket.westConference} t={t} roundLabels={roundLabels} />}
      </div>

      {/* Mobile: stacked */}
      <div className="md:hidden space-y-6">
        {eastSeries.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">{t.playoffBracket.eastConference}</h3>
            <div className="grid grid-cols-2 gap-2">
              {eastSeries.map((s) => (
                <SeriesCard key={`${s.team1.tricode}-${s.team2.tricode}`} s={s} t={t} />
              ))}
            </div>
          </div>
        )}
        {finalsSeries.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-accent uppercase tracking-wide mb-2">{t.playoffBracket.finals}</h3>
            <div className="grid grid-cols-1 gap-2 max-w-xs mx-auto">
              {finalsSeries.map((s) => (
                <SeriesCard key={`${s.team1.tricode}-${s.team2.tricode}`} s={s} t={t} />
              ))}
            </div>
          </div>
        )}
        {westSeries.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">{t.playoffBracket.westConference}</h3>
            <div className="grid grid-cols-2 gap-2">
              {westSeries.map((s) => (
                <SeriesCard key={`${s.team1.tricode}-${s.team2.tricode}`} s={s} t={t} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
});
