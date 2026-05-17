import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Swords } from "lucide-react";
import { getFullSchedule } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import { getLocale } from "@/lib/locale";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Rivalries",
  description: "Most-played matchups this season and the tightest series — find the league's biggest rivalries.",
};

export const revalidate = 600;

interface SeriesData {
  key: string;
  triA: string;
  triB: string;
  teamIdA: number;
  teamIdB: number;
  meetings: number;
  winsA: number;
  winsB: number;
  totalMargin: number;
  avgMargin: number;
  totalScore: number;
  avgScore: number;
  lastGameId: string | null;
  isDivisionRival: boolean;
}

async function compute(): Promise<SeriesData[]> {
  const schedule = await getFullSchedule().catch(() => []);
  const map = new Map<string, SeriesData>();

  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      if (!g.gameId.startsWith("002")) continue; // regular season only

      const a = g.homeTeam.teamTricode;
      const b = g.awayTeam.teamTricode;
      // canonical key: sorted tricodes
      const [t1, t2] = a < b ? [a, b] : [b, a];
      const key = `${t1}-${t2}`;

      const t1Id = a === t1 ? g.homeTeam.teamId : g.awayTeam.teamId;
      const t2Id = a === t1 ? g.awayTeam.teamId : g.homeTeam.teamId;

      const homeWon = g.homeTeam.score > g.awayTeam.score;
      const t1Won = (a === t1 && homeWon) || (b === t1 && !homeWon);

      const margin = Math.abs(g.homeTeam.score - g.awayTeam.score);
      const total = g.homeTeam.score + g.awayTeam.score;

      const isDivisionRival = !!(TEAM_META[t1]?.division && TEAM_META[t2]?.division && TEAM_META[t1].division === TEAM_META[t2].division);

      const cur = map.get(key) || {
        key, triA: t1, triB: t2, teamIdA: t1Id, teamIdB: t2Id,
        meetings: 0, winsA: 0, winsB: 0,
        totalMargin: 0, avgMargin: 0,
        totalScore: 0, avgScore: 0,
        lastGameId: null,
        isDivisionRival,
      };
      cur.meetings++;
      if (t1Won) cur.winsA++; else cur.winsB++;
      cur.totalMargin += margin;
      cur.totalScore += total;
      cur.lastGameId = g.gameId;
      map.set(key, cur);
    }
  }

  const out: SeriesData[] = [];
  for (const s of map.values()) {
    s.avgMargin = s.totalMargin / s.meetings;
    s.avgScore = s.totalScore / s.meetings;
    out.push(s);
  }
  return out;
}

function SeriesCard({ s, badge, badgeColor, badgeLabel, isZh }: { s: SeriesData; badge: string; badgeColor: string; badgeLabel: string; isZh: boolean }) {
  const lead = s.winsA - s.winsB;
  const leader = lead > 0 ? s.triA : lead < 0 ? s.triB : null;
  return (
    <Link
      href={s.lastGameId ? `/game/${s.lastGameId}` : `/h2h?t1=${s.triA}&t2=${s.triB}`}
      className="glass-tile p-4 group cursor-pointer relative overflow-hidden"
    >
      <div className="absolute inset-y-0 left-0 w-1 opacity-70" style={{ background: badgeColor }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Image src={`https://cdn.nba.com/logos/nba/${s.teamIdA}/global/L/logo.svg`} alt={s.triA} width={36} height={36} unoptimized />
            <span className="text-base font-bold font-mono">{s.triA}</span>
            <span className="text-text-secondary/40 mx-1">vs</span>
            <span className="text-base font-bold font-mono">{s.triB}</span>
            <Image src={`https://cdn.nba.com/logos/nba/${s.teamIdB}/global/L/logo.svg`} alt={s.triB} width={36} height={36} unoptimized />
          </div>
          {s.isDivisionRival && (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-danger/15 text-danger uppercase tracking-[0.15em] shrink-0">
              {isZh ? "同区" : "Division"}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">{badgeLabel}</p>
            <p className="text-2xl font-light font-mono tabular-nums" style={{ color: badgeColor }}>{badge}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">
              {isZh ? `${s.meetings} 次交手` : `${s.meetings} meeting${s.meetings === 1 ? "" : "s"}`}
            </p>
            <p className="text-sm font-mono tabular-nums text-text-secondary">
              {s.triA} <span className={lead > 0 ? "text-text-primary font-bold" : ""}>{s.winsA}</span>
              <span className="mx-1">-</span>
              <span className={lead < 0 ? "text-text-primary font-bold" : ""}>{s.winsB}</span> {s.triB}
            </p>
            {leader && <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-accent mt-0.5">{isZh ? `${leader} 领先` : `${leader} leads`}</p>}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function RivalriesPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const all = await compute();

  if (all.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader eyebrow={isZh ? "对决" : "Matchups"} icon={Swords} title={isZh ? "宿敌对决" : "Rivalries"} />
        <EmptyState
          icon={Swords}
          title={isZh ? "暂无数据" : "No data"}
          description={isZh ? "球队在常规赛交手后，系列数据会显示在这里。" : "Series data populates once teams have played each other in the regular season."}
        />
      </div>
    );
  }

  const multiMeeting = all.filter((s) => s.meetings >= 2);

  const mostPlayed = [...multiMeeting].sort((a, b) => b.meetings - a.meetings || a.avgMargin - b.avgMargin).slice(0, 8);
  const closest = [...multiMeeting].sort((a, b) => a.avgMargin - b.avgMargin || b.meetings - a.meetings).slice(0, 8);
  const highestScoring = [...multiMeeting].sort((a, b) => b.avgScore - a.avgScore || b.meetings - a.meetings).slice(0, 8);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? "对决" : "Matchups"}
        icon={Swords}
        title={isZh ? "宿敌对决" : "Rivalries"}
        subtitle={
          isZh
            ? `${all.length} 组独特对战 · ${multiMeeting.length} 组本赛季至少交手两次`
            : `${all.length} unique matchups · ${multiMeeting.length} played at least twice this season`
        }
      />

      {mostPlayed.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent flex items-center gap-2">
              <Swords size={14} className="text-accent" />
              {isZh ? "交手最多" : "Most Played"}
            </h2>
            <span className="h-px flex-1 bg-accent/30" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mostPlayed.map((s) => (
              <SeriesCard key={s.key} s={s} badge={String(s.meetings)} badgeLabel={isZh ? "交手" : "Meetings"} badgeColor="#3B82F6" isZh={isZh} />
            ))}
          </div>
        </section>
      )}

      {closest.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-danger flex items-center gap-2">
              <Swords size={14} className="text-danger" />
              {isZh ? "最胶着系列" : "Tightest Series"}
            </h2>
            <span className="h-px flex-1 bg-danger/30" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {closest.map((s) => (
              <SeriesCard key={s.key} s={s} badge={`±${s.avgMargin.toFixed(1)}`} badgeLabel={isZh ? "均差" : "Avg Margin"} badgeColor="#DF1B41" isZh={isZh} />
            ))}
          </div>
        </section>
      )}

      {highestScoring.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-success flex items-center gap-2">
              <Swords size={14} className="text-success" />
              {isZh ? "最高得分" : "Highest Scoring"}
            </h2>
            <span className="h-px flex-1 bg-success/30" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {highestScoring.map((s) => (
              <SeriesCard key={s.key} s={s} badge={s.avgScore.toFixed(0)} badgeLabel={isZh ? "均总分" : "Avg Total"} badgeColor="#22C55E" isZh={isZh} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
