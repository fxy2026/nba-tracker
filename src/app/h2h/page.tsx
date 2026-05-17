import type { Metadata } from "next";
import { getFullSchedule } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import TeamLogo from "@/components/TeamLogo";
import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { Swords } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getTranslations(locale);
  return {
    title: t.meta.h2hTitle,
    description: t.meta.h2hDesc,
  };
}

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ t1?: string; t2?: string }>;
}

export default async function H2HPage({ searchParams }: PageProps) {
  const locale = await getLocale();
  const t = getTranslations(locale);
  const params = await searchParams;
  const t1 = params.t1?.toUpperCase();
  const t2 = params.t2?.toUpperCase();

  const teams = Object.values(TEAM_META).sort((a, b) => a.city.localeCompare(b.city));

  // If both teams selected, compute h2h data
  const games: { gameId: string; date: string; homeTricode: string; awayTricode: string; homeScore: number; awayScore: number; homeId: number; awayId: number }[] = [];
  let t1Wins = 0, t2Wins = 0;

  if (t1 && t2 && t1 !== t2 && TEAM_META[t1] && TEAM_META[t2]) {
    const schedule = await getFullSchedule().catch(() => []);
    for (const gd of schedule) {
      for (const g of gd.games) {
        if (g.gameStatus !== 3) continue;
        if (g.gameId.startsWith("001")) continue; // skip preseason
        const isMatch =
          (g.homeTeam.teamTricode === t1 && g.awayTeam.teamTricode === t2) ||
          (g.homeTeam.teamTricode === t2 && g.awayTeam.teamTricode === t1);
        if (!isMatch) continue;
        const dateStr = gd.gameDate.split(" ")[0];
        const [month, day, year] = dateStr.split("/");
        games.push({
          gameId: g.gameId,
          date: `${year}-${month}-${day}`,
          homeTricode: g.homeTeam.teamTricode,
          awayTricode: g.awayTeam.teamTricode,
          homeScore: g.homeTeam.score,
          awayScore: g.awayTeam.score,
          homeId: g.homeTeam.teamId,
          awayId: g.awayTeam.teamId,
        });
        if (
          (g.homeTeam.teamTricode === t1 && g.homeTeam.score > g.awayTeam.score) ||
          (g.awayTeam.teamTricode === t1 && g.awayTeam.score > g.homeTeam.score)
        ) {
          t1Wins++;
        } else {
          t2Wins++;
        }
      }
    }
    games.sort((a, b) => b.date.localeCompare(a.date));
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <PageHeader eyebrow="Tool" icon={Swords} title={t.h2hPage.title} subtitle={t.h2hPage.selectHint} />

      {/* Team Selectors */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
        <TeamSelector teams={teams} selected={t1} paramName="t1" other={t2} />
        <span className="text-base font-light font-mono uppercase tracking-[0.25em] text-accent-amber">{t.common.vs}</span>
        <TeamSelector teams={teams} selected={t2} paramName="t2" other={t1} />
      </div>

      {/* Results */}
      {t1 && t2 && t1 !== t2 && TEAM_META[t1] && TEAM_META[t2] && (
        <>
          {/* Score Summary */}
          <div className="glass-tile p-6 mb-6">
            <div className="flex items-center justify-center gap-8">
              <div className="flex flex-col items-center gap-2">
                <TeamLogo teamId={TEAM_META[t1].teamId} tricode={t1} size={48} />
                <span className="font-semibold text-sm">{TEAM_META[t1].city} {TEAM_META[t1].name}</span>
                <span className={`text-4xl font-light font-mono tabular-nums ${t1Wins >= t2Wins ? "text-accent-amber" : "text-text-secondary"}`}>{t1Wins}</span>
              </div>
              <div className="text-text-secondary text-xl">-</div>
              <div className="flex flex-col items-center gap-2">
                <TeamLogo teamId={TEAM_META[t2].teamId} tricode={t2} size={48} />
                <span className="font-semibold text-sm">{TEAM_META[t2].city} {TEAM_META[t2].name}</span>
                <span className={`text-4xl font-light font-mono tabular-nums ${t2Wins >= t1Wins ? "text-accent-amber" : "text-text-secondary"}`}>{t2Wins}</span>
              </div>
            </div>
            {/* Season record context */}
            {games.length > 0 && (
              <p className="text-xs text-text-secondary text-center mt-2">
                {games.length} {t.h2hPage.gamesThisSeason}
                {games.length >= 3 && t1Wins > t2Wins && ` — ${TEAM_META[t1]?.name} ${t.h2hPage.dominates}`}
                {games.length >= 3 && t2Wins > t1Wins && ` — ${TEAM_META[t2]?.name} ${t.h2hPage.dominates}`}
                {t1Wins === t2Wins && games.length >= 2 && ` — ${t.h2hPage.seriesTied}`}
              </p>
            )}
            {/* Win percentage donut */}
            {games.length > 0 && (() => {
              const total = t1Wins + t2Wins;
              const t1Pct = total > 0 ? t1Wins / total : 0.5;
              const circumference = 2 * Math.PI * 30;
              const t1Dash = t1Pct * circumference;
              const t2Dash = (1 - t1Pct) * circumference;
              return (
                <div className="flex justify-center mt-4">
                  <svg width={80} height={80} viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="30" fill="none" stroke="var(--bg-hover)" strokeWidth="8" />
                    <circle cx="40" cy="40" r="30" fill="none" stroke="var(--accent)" strokeWidth="8"
                      strokeDasharray={`${t1Dash} ${t2Dash}`}
                      strokeDashoffset={circumference / 4}
                      strokeLinecap="round"
                    />
                    <text x="40" y="40" textAnchor="middle" dominantBaseline="central" fill="var(--text-primary)" fontSize="11" fontWeight="bold">
                      {(t1Pct * 100).toFixed(0)}%
                    </text>
                  </svg>
                </div>
              );
            })()}
            {games.length === 0 && (
              <p className="text-center text-text-secondary text-sm mt-4">{t.h2hPage.noGames}</p>
            )}
            {games.length > 0 && (() => {
              const t1Total = games.reduce((s, g) => {
                if (g.homeTricode === t1) return s + g.homeScore;
                return s + g.awayScore;
              }, 0);
              const t2Total = games.reduce((s, g) => {
                if (g.homeTricode === t2) return s + g.homeScore;
                return s + g.awayScore;
              }, 0);
              return (
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-center gap-6 text-xs text-text-secondary">
                  <span>{t.h2hPage.avgScore}{t1} {(t1Total / games.length).toFixed(1)} - {(t2Total / games.length).toFixed(1)} {t2}</span>
                  <span>{games.length} {t.h2hPage.gamesPlayed}</span>
                </div>
              );
            })()}
          </div>

          {/* Blowout Wins + Biggest Wins — single pass */}
          {games.length > 0 && (() => {
            let t1Blowouts = 0, t2Blowouts = 0;
            let t1Best = { diff: 0, game: null as typeof games[0] | null };
            let t2Best = { diff: 0, game: null as typeof games[0] | null };
            for (const g of games) {
              const diff = Math.abs(g.homeScore - g.awayScore);
              const winnerTricode = g.homeScore > g.awayScore ? g.homeTricode : g.awayTricode;
              if (diff > 15) {
                if (winnerTricode === t1) t1Blowouts++;
                else t2Blowouts++;
              }
              if (winnerTricode === t1 && diff > t1Best.diff) t1Best = { diff, game: g };
              if (winnerTricode === t2 && diff > t2Best.diff) t2Best = { diff, game: g };
            }
            return (
              <>
                {(t1Blowouts + t2Blowouts > 0) && (
                  <div className="glass-tile p-4 mb-6">
                    <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3 flex items-center gap-2"><span className="w-1 h-3 bg-accent-amber rounded-full" />{t.h2hPage.blowoutWins}</h3>
                    <div className="flex items-center justify-center gap-6">
                      <div className="text-center">
                        <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">{t1Blowouts}</p>
                        <p className="text-xs text-text-secondary">{t1}</p>
                      </div>
                      <span className="text-text-secondary">-</span>
                      <div className="text-center">
                        <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">{t2Blowouts}</p>
                        <p className="text-xs text-text-secondary">{t2}</p>
                      </div>
                    </div>
                  </div>
                )}
                {(t1Best.game || t2Best.game) && (
                  <div className="glass-tile p-4 mb-6">
                    <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3 flex items-center gap-2"><span className="w-1 h-3 bg-accent-amber rounded-full" />{t.h2hPage.biggestWins}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {t1Best.game && (
                        <div className="bg-bg-secondary/60 backdrop-blur-sm rounded-lg p-3 text-center">
                          <p className="text-xs text-text-secondary">{t1}</p>
                          <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">+{t1Best.diff}</p>
                          <p className="text-[10px] text-text-secondary">{t1Best.game.awayTricode} {t1Best.game.awayScore}-{t1Best.game.homeScore} {t1Best.game.homeTricode}</p>
                        </div>
                      )}
                      {t2Best.game && (
                        <div className="bg-bg-secondary/60 backdrop-blur-sm rounded-lg p-3 text-center">
                          <p className="text-xs text-text-secondary">{t2}</p>
                          <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">+{t2Best.diff}</p>
                          <p className="text-[10px] text-text-secondary">{t2Best.game.awayTricode} {t2Best.game.awayScore}-{t2Best.game.homeScore} {t2Best.game.homeTricode}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* Feature 8: Scoring Distribution */}
          {games.length > 0 && (() => {
            const allScores = games.map(g => g.homeScore + g.awayScore);
            const avgTotal = (allScores.reduce((s, v) => s + v, 0) / allScores.length).toFixed(1);
            const highest = Math.max(...allScores);
            const lowest = Math.min(...allScores);
            const highGame = games.find(g => g.homeScore + g.awayScore === highest);
            const lowGame = games.find(g => g.homeScore + g.awayScore === lowest);
            return (
              <div className="glass-tile p-4 mb-6">
                <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3 flex items-center gap-2"><span className="w-1 h-3 bg-accent-amber rounded-full" />{t.h2hPage.scoringDist}</h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-bg-secondary rounded-lg p-3">
                    <p className="text-[10px] text-text-secondary uppercase">{t.h2hPage.avgTotal}</p>
                    <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">{avgTotal}</p>
                  </div>
                  <div className="bg-bg-secondary rounded-lg p-3">
                    <p className="text-[10px] text-text-secondary uppercase">{t.h2hPage.highest}</p>
                    <p className="text-2xl font-light font-mono tabular-nums text-success">{highest}</p>
                    {highGame && <p className="text-[9px] text-text-secondary">{highGame.awayTricode} {highGame.awayScore}-{highGame.homeScore} {highGame.homeTricode}</p>}
                  </div>
                  <div className="bg-bg-secondary rounded-lg p-3">
                    <p className="text-[10px] text-text-secondary uppercase">{t.h2hPage.lowest}</p>
                    <p className="text-2xl font-light font-mono tabular-nums text-danger">{lowest}</p>
                    {lowGame && <p className="text-[9px] text-text-secondary">{lowGame.awayTricode} {lowGame.awayScore}-{lowGame.homeScore} {lowGame.homeTricode}</p>}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Home/Away Split */}
          {games.length > 0 && (() => {
            let t1HomeWins = 0, t1HomeLosses = 0, t1AwayWins = 0, t1AwayLosses = 0;
            for (const g of games) {
              const t1IsHome = g.homeTricode === t1;
              const t1Won = t1IsHome ? g.homeScore > g.awayScore : g.awayScore > g.homeScore;
              if (t1IsHome) {
                if (t1Won) t1HomeWins++; else t1HomeLosses++;
              } else {
                if (t1Won) t1AwayWins++; else t1AwayLosses++;
              }
            }
            return (
              <div className="glass-tile p-4 mb-6">
                <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3 flex items-center gap-2"><span className="w-1 h-3 bg-accent-amber rounded-full" />{t.h2hPage.homeAwaySplit}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-text-primary mb-1">{t1}</p>
                    <p className="text-text-secondary">
                      {t.h2hPage.homeLabel} <span className="text-success font-medium">{t1HomeWins}{t.common.wins}</span> - <span className="text-danger font-medium">{t1HomeLosses}{t.common.losses}</span>
                    </p>
                    <p className="text-text-secondary">
                      {t.h2hPage.awayLabel} <span className="text-success font-medium">{t1AwayWins}{t.common.wins}</span> - <span className="text-danger font-medium">{t1AwayLosses}{t.common.losses}</span>
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-text-primary mb-1">{t2}</p>
                    <p className="text-text-secondary">
                      {t.h2hPage.homeLabel} <span className="text-success font-medium">{t1AwayLosses}{t.common.wins}</span> - <span className="text-danger font-medium">{t1AwayWins}{t.common.losses}</span>
                    </p>
                    <p className="text-text-secondary">
                      {t.h2hPage.awayLabel} <span className="text-success font-medium">{t1HomeLosses}{t.common.wins}</span> - <span className="text-danger font-medium">{t1HomeWins}{t.common.losses}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Last Meeting Highlight */}
          {games.length > 0 && (() => {
            const lastGame = games[0]; // games are sorted desc by date
            const homeWon = lastGame.homeScore > lastGame.awayScore;
            const winner = homeWon ? lastGame.homeTricode : lastGame.awayTricode;
            return (
              <div className="glass-tile glass-tile-featured p-4 mb-6">
                <h3 className="text-xs font-medium text-accent uppercase mb-2">{t.h2hPage.lastMeeting}</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TeamLogo teamId={lastGame.awayId} tricode={lastGame.awayTricode} size={28} />
                    <span className={`text-sm font-bold ${!homeWon ? "text-accent" : "text-text-secondary"}`}>{lastGame.awayTricode} {lastGame.awayScore}</span>
                    <span className="text-text-secondary text-xs">@</span>
                    <span className={`text-sm font-bold ${homeWon ? "text-accent" : "text-text-secondary"}`}>{lastGame.homeScore} {lastGame.homeTricode}</span>
                    <TeamLogo teamId={lastGame.homeId} tricode={lastGame.homeTricode} size={28} />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-text-secondary">{lastGame.date}</p>
                    <p className="text-[10px] text-accent font-medium">{winner} won by {Math.abs(lastGame.homeScore - lastGame.awayScore)}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Point Differential Trend */}
          {games.length >= 2 && t1 && (() => {
            const chronological = [...games].reverse();
            const diffs = chronological.map(g => {
              const t1Score = g.homeTricode === t1 ? g.homeScore : g.awayScore;
              const t2Score = g.homeTricode === t1 ? g.awayScore : g.homeScore;
              return t1Score - t2Score;
            });
            const maxAbs = Math.max(...diffs.map(Math.abs), 1);
            const w = 300;
            const h = 100;
            const midY = h / 2;
            const padX = 20;
            const plotW = w - padX * 2;
            const xStep = diffs.length > 1 ? plotW / (diffs.length - 1) : 0;
            const points = diffs.map((d, i) => ({
              x: padX + i * xStep,
              y: midY - (d / maxAbs) * (midY - 10),
            }));
            const polyline = points.map(p => `${p.x},${p.y}`).join(" ");
            return (
              <div className="glass-tile p-4 mb-6">
                <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3 flex items-center gap-2"><span className="w-1 h-3 bg-accent-amber rounded-full" />{t.h2hPage.pointDiffTrend} ({t1})</h3>
                <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-md" preserveAspectRatio="xMidYMid meet">
                  <line x1={padX} y1={midY} x2={w - padX} y2={midY} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4 2" />
                  <polyline points={polyline} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  {points.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="4" fill={diffs[i] >= 0 ? "var(--success)" : "var(--danger)"} />
                      <text x={p.x} y={p.y - 8} textAnchor="middle" fill="var(--text-secondary)" fontSize="8">
                        {diffs[i] > 0 ? "+" : ""}{diffs[i]}
                      </text>
                    </g>
                  ))}
                  <text x={padX} y={h - 2} fill="var(--text-secondary)" fontSize="7">{chronological[0]?.date.slice(5)}</text>
                  <text x={w - padX} y={h - 2} textAnchor="end" fill="var(--text-secondary)" fontSize="7">{chronological[chronological.length - 1]?.date.slice(5)}</text>
                </svg>
              </div>
            );
          })()}

          {/* Game List */}
          {games.length > 0 && (
            <div className="glass-tile overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">{t.h2hPage.gameResults}</h3>
              </div>
              <div className="divide-y divide-border/50">
                {games.map((g) => {
                  const homeWon = g.homeScore > g.awayScore;
                  return (
                    <Link key={g.gameId} href={`/game/${g.gameId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors">
                      <span className="text-xs text-text-secondary w-20">{g.date}</span>
                      <div className="flex items-center gap-2 flex-1">
                        <TeamLogo teamId={g.awayId} tricode={g.awayTricode} size={20} />
                        <span className={`text-sm font-medium ${!homeWon ? "text-text-primary" : "text-text-secondary"}`}>{g.awayTricode}</span>
                        <span className={`text-sm font-bold font-mono tabular-nums ${!homeWon ? "text-accent" : "text-text-secondary"}`}>{g.awayScore}</span>
                      </div>
                      <span className="text-text-secondary text-xs">@</span>
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <span className={`text-sm font-bold font-mono tabular-nums ${homeWon ? "text-accent" : "text-text-secondary"}`}>{g.homeScore}</span>
                        <span className={`text-sm font-medium ${homeWon ? "text-text-primary" : "text-text-secondary"}`}>{g.homeTricode}</span>
                        <TeamLogo teamId={g.homeId} tricode={g.homeTricode} size={20} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TeamSelector({ teams, selected, paramName, other }: {
  teams: { tricode: string; city: string; name: string; teamId: number }[];
  selected?: string; paramName: string; other?: string;
}) {
  return (
    <div className="flex-1 w-full">
      <div className="flex flex-wrap gap-1.5 justify-center">
        {teams.map((t) => {
          const isSelected = selected === t.tricode;
          const otherParam = paramName === "t1" ? "t2" : "t1";
          const href = `/h2h?${paramName}=${t.tricode}${other ? `&${otherParam}=${other}` : ""}`;
          return (
            <Link
              key={t.tricode}
              href={href}
              className={`chip font-mono ${isSelected ? "chip-active" : ""}`}
            >
              <TeamLogo teamId={t.teamId} tricode={t.tricode} size={16} />
              {t.tricode}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
