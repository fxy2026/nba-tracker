"use client";

import { memo, useRef } from "react";
import type { PeriodScore } from "@/lib/nba-contracts";
import { useLocale } from "@/components/LocaleProvider";

interface ScoreEvent {
  period: number;
  clock: string;
  scoreHome: number;
  scoreAway: number;
}

interface Props {
  homePeriods: PeriodScore[];
  awayPeriods: PeriodScore[];
  homeTricode: string;
  awayTricode: string;
  /** Play-by-play actions with score — enables detailed per-play chart */
  scoreEvents?: ScoreEvent[];
}

// Convert period + clock to elapsed game minutes. Regulation quarters are 12
// min, OT periods are 5 min — keep them on separate scales so the x-axis
// matches the quarter boundary lines drawn at 48, 53, 58, …
function toGameMinutes(period: number, clock: string): number {
  let min = 0, sec = 0;
  const match = clock?.match?.(/PT(\d+)M([\d.]+)S/);
  if (match) { min = parseInt(match[1]); sec = parseFloat(match[2]); }
  const remaining = min + sec / 60;
  if (period <= 4) return (period - 1) * 12 + (12 - remaining);
  return 48 + (period - 5) * 5 + (5 - remaining);
}

export default memo(function ScoringFlow({ homePeriods, awayPeriods, homeTricode, awayTricode, scoreEvents }: Props) {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const chartScrollRef = useRef<HTMLDivElement>(null);
  if (homePeriods.length === 0) return null;

  // Build data points: use play-by-play if available, else quarter-level
  const points: { t: number; home: number; away: number }[] = [];
  const numPeriods = homePeriods.length;
  const totalMinutes = Math.min(numPeriods, 4) * 12 + Math.max(numPeriods - 4, 0) * 5;

  if (scoreEvents && scoreEvents.length > 10) {
    // Detailed: every score change from play-by-play
    points.push({ t: 0, home: 0, away: 0 });
    let prevHome = 0, prevAway = 0;
    for (const ev of scoreEvents) {
      const h = typeof ev.scoreHome === "string" ? parseInt(ev.scoreHome) : ev.scoreHome;
      const a = typeof ev.scoreAway === "string" ? parseInt(ev.scoreAway) : ev.scoreAway;
      if (isNaN(h) || isNaN(a)) continue;
      if (h !== prevHome || a !== prevAway) {
        const t = toGameMinutes(ev.period, ev.clock);
        points.push({ t, home: h, away: a });
        prevHome = h;
        prevAway = a;
      }
    }
  } else {
    // Fallback: quarter-by-quarter
    points.push({ t: 0, home: 0, away: 0 });
    let hTotal = 0, aTotal = 0;
    for (let i = 0; i < numPeriods; i++) {
      hTotal += homePeriods[i].score;
      aTotal += awayPeriods[i]?.score || 0;
      const t = i < 4 ? (i + 1) * 12 : 48 + (i - 3) * 5;
      points.push({ t, home: hTotal, away: aTotal });
    }
  }

  if (points.length < 2) return null;

  const maxScore = Math.max(...points.map(p => Math.max(p.home, p.away)), 1);
  const maxT = points[points.length - 1].t || totalMinutes;
  const w = 600, h = 180, pad = { top: 16, right: 48, bottom: 28, left: 36 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const toX = (t: number) => pad.left + (t / maxT) * plotW;
  const toY = (v: number) => pad.top + plotH - (v / maxScore) * plotH;

  const homeLine = points.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.t).toFixed(1)},${toY(p.home).toFixed(1)}`).join(" ");
  const awayLine = points.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.t).toFixed(1)},${toY(p.away).toFixed(1)}`).join(" ");

  // Quarter boundary lines
  const qLines: { t: number; label: string }[] = [];
  for (let q = 1; q <= Math.min(numPeriods, 4); q++) qLines.push({ t: q * 12, label: `${t.playByPlayComp.quarter}${q}` });
  for (let ot = 1; ot <= numPeriods - 4; ot++) qLines.push({ t: 48 + ot * 5, label: `${t.playByPlayComp.overtime}${ot}` });

  // Single pass: max leads, lead changes, ties, plus an expanded point list
  // with linear-interpolated crossings inserted at every sign reversal — used
  // below to build per-side lead-area polygons.
  let maxHomeLead = 0, maxAwayLead = 0;
  let leadChanges = 0;
  let ties = 0;
  let prevSign = 0;
  let prevTied = false;
  const expanded: { t: number; home: number; away: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    expanded.push(p);
    const diff = p.home - p.away;
    if (diff > maxHomeLead) maxHomeLead = diff;
    if (-diff > maxAwayLead) maxAwayLead = -diff;
    const sign = diff > 0 ? 1 : diff < 0 ? -1 : 0;
    if (sign === 0 && p.home > 0) {
      if (!prevTied) ties++;
      prevTied = true;
    } else {
      prevTied = false;
    }
    if (prevSign !== 0 && sign !== 0 && sign !== prevSign) leadChanges++;
    if (sign !== 0) prevSign = sign;

    if (i < points.length - 1) {
      const pNext = points[i + 1];
      const dNext = pNext.home - pNext.away;
      if (diff * dNext < 0) {
        const r = diff / (diff - dNext);
        const tCross = p.t + (pNext.t - p.t) * r;
        const vCross = p.home + (pNext.home - p.home) * r;
        expanded.push({ t: tCross, home: vCross, away: vCross });
      }
    }
  }

  // Slice expanded points into one polygon per lead run (one side strictly
  // ahead of the other). Sign-zero anchors are shared between adjacent runs
  // so the shading meets cleanly at ties.
  const leadSegs: { sign: 1 | -1; seg: { t: number; home: number; away: number }[] }[] = [];
  {
    let currentSign: 0 | 1 | -1 = 0;
    let seg: { t: number; home: number; away: number }[] = [];
    for (const p of expanded) {
      const d = p.home - p.away;
      const sign: 0 | 1 | -1 = d > 0 ? 1 : d < 0 ? -1 : 0;
      if (sign === 0) {
        seg.push(p);
        if (currentSign !== 0) {
          leadSegs.push({ sign: currentSign, seg });
          seg = [p];
          currentSign = 0;
        }
      } else if (currentSign === 0) {
        seg.push(p);
        currentSign = sign;
      } else if (sign === currentSign) {
        seg.push(p);
      } else {
        // Without a cross point this shouldn't happen, but guard anyway
        leadSegs.push({ sign: currentSign, seg });
        seg = [p];
        currentSign = sign;
      }
    }
    if (currentSign !== 0 && seg.length > 1) leadSegs.push({ sign: currentSign, seg });
  }

  const buildLeadArea = (seg: { t: number; home: number; away: number }[]) => {
    const top = seg.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.t).toFixed(1)},${toY(Math.max(p.home, p.away)).toFixed(1)}`).join(" ");
    const bot = seg.slice().reverse().map((p) => `L${toX(p.t).toFixed(1)},${toY(Math.min(p.home, p.away)).toFixed(1)}`).join(" ");
    return `${top} ${bot} Z`;
  };

  const isDetailed = scoreEvents && scoreEvents.length > 10;
  const last = points[points.length - 1];

  return (
    <div className="glass-tile min-w-0 max-w-full p-4 mt-4">
      <div className="flex flex-col items-start gap-2 mb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        <h3 className="text-sm font-semibold text-text-primary tracking-tight flex items-center gap-2">
          <span className="w-1 h-4 bg-accent-amber rounded-full" />
          {t.scoringFlow.title}
          {isDetailed && <span className="text-xs sm:text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-normal">{points.length} plays</span>}
        </h3>
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs sm:text-[10px] text-text-secondary sm:justify-end">
          {maxHomeLead > 0 && <span>{homeTricode} {t.scoringFlow.ledBy} {maxHomeLead}</span>}
          {maxAwayLead > 0 && <span>{awayTricode} {t.scoringFlow.ledBy} {maxAwayLead}</span>}
          {isDetailed && leadChanges > 0 && (
            <span className="tabular-nums">{leadChanges} {t.scoringFlow.leadChanges}</span>
          )}
          {isDetailed && ties > 0 && (
            <span className="tabular-nums">{ties} {t.scoringFlow.ties}</span>
          )}
        </div>
      </div>
      <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold tabular-nums sm:hidden">
        <span className="flex items-center gap-2 text-accent"><span className="h-0.5 w-4 bg-accent" aria-hidden="true" />{homeTricode} {last.home}</span>
        <span className="flex items-center gap-2 text-success"><span className="h-0.5 w-4 bg-success" aria-hidden="true" />{awayTricode} {last.away}</span>
      </div>
      <p className="mb-2 text-xs leading-relaxed text-text-secondary sm:hidden">
        {isZh ? "整场得分走势 · 左右滑动或使用方向键查看" : "Full-game scoring · Swipe or use arrow keys to explore"}
      </p>
      <div className="mb-2 flex flex-wrap gap-2 sm:hidden">
        <button type="button" className="min-h-[44px] min-w-[44px] rounded-md border border-border px-3 text-xs text-text-secondary hover:text-text-primary" onClick={() => chartScrollRef.current?.scrollTo({ left: 0 })}>
          {isZh ? "开场" : "Game start"}
        </button>
        <button type="button" className="min-h-[44px] min-w-[44px] rounded-md border border-border px-3 text-xs text-text-secondary hover:text-text-primary" onClick={() => chartScrollRef.current?.scrollTo({ left: chartScrollRef.current.scrollWidth })}>
          {isZh ? "最后得分" : "Last score"}
        </button>
      </div>
      <div ref={chartScrollRef} className="max-w-full overflow-x-auto overscroll-x-contain rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" role="region" tabIndex={0} aria-label={isZh ? "得分走势，可左右滚动查看整场比赛" : "Scoring flow: scroll horizontally to view the whole game"}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="block w-full min-w-[600px] sm:min-w-0"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={isZh
          ? `得分走势图 — ${awayTricode} ${last.away} vs ${homeTricode} ${last.home}`
          : `Scoring flow chart — ${awayTricode} ${last.away} vs ${homeTricode} ${last.home}`}
      >
        {/* Y-axis grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = pad.top + plotH * (1 - ratio);
          const val = Math.round(maxScore * ratio);
          return (
            <g key={ratio}>
              <line x1={pad.left} y1={y} x2={w - pad.right} y2={y} stroke="var(--border)" strokeWidth={0.3} />
              <text x={pad.left - 4} y={y} textAnchor="end" dominantBaseline="central" fill="var(--text-secondary)" fontSize={8} className="text-[12px] sm:text-[8px]">{val}</text>
            </g>
          );
        })}
        {/* Quarter boundary lines */}
        {qLines.map(({ t, label }) => (
          <g key={label}>
            <line x1={toX(t)} y1={pad.top} x2={toX(t)} y2={pad.top + plotH} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3,3" />
            <text x={toX(t)} y={h - 6} textAnchor="middle" fill="var(--text-secondary)" fontSize={8} className="text-[12px] sm:text-[8px]">{label}</text>
          </g>
        ))}
        {/* Lead-area shading — fills the gap between the two lines, colored by
            who is ahead in that run. Replaces the old per-team area fills. */}
        {leadSegs.map(({ sign, seg }, i) => (
          <path
            key={`lead-${i}`}
            d={buildLeadArea(seg)}
            fill={sign === 1 ? "var(--accent)" : "var(--success)"}
            fillOpacity={0.14}
          />
        ))}
        {/* Lines */}
        <path d={homeLine} fill="none" stroke="var(--accent)" strokeWidth={isDetailed ? 1.5 : 2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={awayLine} fill="none" stroke="var(--success)" strokeWidth={isDetailed ? 1.5 : 2} strokeLinejoin="round" strokeLinecap="round" />
        {/* End dots */}
        <circle cx={toX(last.t)} cy={toY(last.home)} r={3.5} fill="var(--accent)" stroke="var(--bg-card)" strokeWidth={1.5} />
        <circle cx={toX(last.t)} cy={toY(last.away)} r={3.5} fill="var(--success)" stroke="var(--bg-card)" strokeWidth={1.5} />
        {/* End labels with scores */}
        <text x={w - pad.right + 4} y={toY(last.home)} dominantBaseline="central" fill="var(--accent)" fontSize={9} fontWeight={600} className="hidden sm:block">{homeTricode} {last.home}</text>
        <text x={w - pad.right + 4} y={toY(last.away)} dominantBaseline="central" fill="var(--success)" fontSize={9} fontWeight={600} className="hidden sm:block">{awayTricode} {last.away}</text>
      </svg>
      </div>
    </div>
  );
});
