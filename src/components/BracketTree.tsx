"use client";

import { memo } from "react";
import { Trophy, Crown } from "lucide-react";
import type { ScheduleGame } from "@/lib/api";
import {
  type Series,
  getConference,
  parseGameId,
  projectFutureSeries,
  winnerOf,
  isOnChampionPath,
} from "@/lib/playoffs";
import { useLocale } from "@/components/LocaleProvider";
import BracketDesktop from "@/components/bracket/BracketDesktop";
import BracketMobile from "@/components/bracket/BracketMobile";

interface Props {
  games: ScheduleGame[];
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

  const allSeries = projectFutureSeries(actualSeries);

  // Finals is always round 4; East/West get rounds 1-3.
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

      <BracketDesktop
        eastR1={eastR1} eastR2={eastR2} eastR3={eastR3}
        westR1={westR1} westR2={westR2} westR3={westR3}
        finals={finals}
        championPath={championPath}
        roundLabels={roundLabels}
        eastLabel={t.playoffBracket.eastConference}
        westLabel={t.playoffBracket.westConference}
        finalsLabel={t.playoffBracket.finals}
      />

      <BracketMobile
        finals={finals}
        finalsLabel={t.playoffBracket.finals}
        conferences={[
          { label: t.playoffBracket.eastConference, series: east, color: "#3B82F6", bg: "bg-accent/[0.04]" },
          { label: t.playoffBracket.westConference, series: west, color: "#F59E0B", bg: "bg-accent-amber/[0.04]" },
        ]}
        championPath={championPath}
        roundLabels={roundLabels}
      />
    </section>
  );
});
