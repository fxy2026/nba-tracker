"use client";

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  moveReportedScoreSelection, nearestReportedScorePoint, reportedScorePoints, reportedScoreStepPath,
  scoreChartDomain, scoreChartPointsForPeriod,
  type ReportedScoreChartProps, type ScorePeriod,
} from "@/lib/reported-score-chart";
import { scoreTeamName, scoreTeamStyle } from "@/lib/score-team-presentation";
import styles from "./ScorePanel.module.css";

const HOME = "var(--score-home)";
const AWAY = "var(--score-away)";
const PLOT_HEIGHT = 216;

export default function ReportedScoreChart({ rows, homeTricode, awayTricode, sourceUrl, isZh }: ReportedScoreChartProps) {
  const id = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [period, setPeriod] = useState<ScorePeriod>(0);
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, rows.length - 1));
  const [inspecting, setInspecting] = useState(false);
  const points = useMemo(() => reportedScorePoints(rows), [rows]);
  const visible = useMemo(() => scoreChartPointsForPeriod(points, period), [points, period]);
  const selected = visible.find(point => point.sourceIndex === selectedIndex) ?? visible.at(-1);
  const domain = scoreChartDomain(period);
  const maxScore = Math.max(20, Math.ceil(Math.max(...points.flatMap(point => [point.homeScore, point.awayScore])) / 20) * 20);

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const resize = () => setWidth(Math.max(1, plot.getBoundingClientRect().width));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(plot);
    return () => observer.disconnect();
  }, []);

  if (!selected || !visible.length) return null;
  const toX = (seconds: number) => (seconds - domain[0]) / (domain[1] - domain[0]) * width;
  const toY = (score: number) => PLOT_HEIGHT * (1 - score / maxScore);
  const selectedPosition = visible.findIndex(point => point.sourceIndex === selected.sourceIndex);
  const quarter = (value: number) => isZh ? `第 ${value} 节` : `Q${value}`;
  const recordLabel = isZh ? `第 ${selected.sourceIndex + 1} / ${points.length} 条记录` : `Record ${selected.sourceIndex + 1} of ${points.length}`;
  const selectionLabel = `${recordLabel}, ${quarter(selected.period)}, ${selected.clockAsPrinted}, ${homeTricode} ${selected.homeScore}, ${awayTricode} ${selected.awayScore}`;
  const select = (index: number) => { setSelectedIndex(index); setInspecting(true); };
  const pointerSelect = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const index = nearestReportedScorePoint(visible, event.clientX - bounds.left, event.clientY - bounds.top, bounds.width, bounds.height, domain, maxScore);
    if (index !== null) select(index);
  };
  const selectPeriod = (value: ScorePeriod) => {
    setPeriod(value);
    setInspecting(true);
    if (value && selected.period !== value) setSelectedIndex(points.find(point => point.period === value)!.sourceIndex);
  };
  const move = (delta: number) => {
    const index = moveReportedScoreSelection(visible, selected.sourceIndex, delta);
    if (index !== null) select(index);
  };

  return (
    <div className={`${styles.colors} mt-4`} style={scoreTeamStyle(homeTricode, awayTricode)} data-reported-score-chart>
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
        <div className="flex items-center gap-4 text-xs font-semibold" aria-label={isZh ? "球队图例" : "Team legend"}>
          {([{ tricode: awayTricode, side: "away" }, { tricode: homeTricode, side: "home" }] as const).map(team =>
            <span key={team.side} className="flex items-center gap-1.5">
              <span className={`relative h-0.5 w-4 rounded-full bg-current ${styles[team.side]}`} aria-hidden="true"><span className={`absolute -top-0.5 left-1 h-1.5 w-1.5 bg-current ${team.side === "home" ? "rounded-full" : ""}`} /></span>
              {scoreTeamName(team.tricode, isZh)}<span className="text-[10px] font-normal text-text-secondary">{team.tricode}</span>
            </span>)}
        </div>
        <span className="text-[10px] text-text-secondary">{isZh ? "累计得分" : "Cumulative score"}</span>
      </div>

      <div className="relative mt-5 pb-7 pl-8 pr-1">
        <div className="absolute bottom-7 left-0 top-0 w-6 text-right text-[11px] tabular-nums text-text-secondary" aria-hidden="true">
          {[0, 1, 2, 3, 4].map(tick => <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${tick * 25}%` }}>{maxScore * (1 - tick / 4)}</span>)}
        </div>
        <div ref={plotRef} className={`relative ${styles.plot}`}>
          <svg width="100%" height="100%" viewBox={`0 0 ${width} ${PLOT_HEIGHT}`} preserveAspectRatio="none"
            role="img" aria-labelledby={`${id}-title ${id}-description`} className="overflow-visible touch-pan-y"
            onPointerDown={pointerSelect} onPointerMove={event => { if (event.pointerType === "mouse" || event.buttons === 1) pointerSelect(event); }}>
            <title id={`${id}-title`}>{isZh ? `${homeTricode} 与 ${awayTricode} 比分走势` : `${homeTricode} and ${awayTricode} score trend`}</title>
            <desc id={`${id}-description`}>{isZh
              ? `${points.length} 条带时间的官方比分记录。两条实线以阶梯连接已记载比分；圆点表示 ${homeTricode}，方点表示 ${awayTricode} 的所选记录。不补写事件或节末时间。轻点图表或用下方滑块、方向键逐条查看；完整记录可展开。`
              : `${points.length} timed official score observations. Solid steps connect reported scores. Selected circles represent ${homeTricode}; squares represent ${awayTricode}. No events or period-end clocks are added. Tap the chart or use the slider and arrow keys to inspect each row; exact records can be expanded.`}</desc>
            <g aria-hidden="true">
              {(period === 0 ? [1, 2, 3, 4] : [period]).map((value, index) => <rect key={value} data-quarter-band={value}
                x={period === 0 ? toX((value - 1) * 720) : 0} y={0} width={period === 0 ? width / 4 : width} height={PLOT_HEIGHT}
                fill={index % 2 === 1 || period !== 0 ? "var(--score-band)" : "transparent"} />)}
              {[0, 1, 2, 3, 4].map(tick => <line key={tick} x1={0} x2={width} y1={PLOT_HEIGHT * tick / 4} y2={PLOT_HEIGHT * tick / 4} stroke="var(--border)" strokeDasharray={tick === 4 ? undefined : "2 4"} vectorEffect="non-scaling-stroke" />)}
              {(["awayScore", "homeScore"] as const).map(team => <path key={team} data-score-connector={team}
                d={reportedScoreStepPath(visible, team, toX, toY)}
                fill="none" stroke={team === "homeScore" ? HOME : AWAY} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
              {inspecting && <g data-score-observation={selected.sourceIndex}>
                <line x1={toX(selected.elapsedSeconds)} x2={toX(selected.elapsedSeconds)} y1={0} y2={PLOT_HEIGHT} stroke="var(--text-secondary)" strokeDasharray="3 4" opacity={0.6} vectorEffect="non-scaling-stroke" />
                <circle cx={toX(selected.elapsedSeconds)} cy={toY(selected.homeScore)} r={4.5} fill={HOME} stroke="var(--bg-card)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                <rect x={toX(selected.elapsedSeconds) - 4.5} y={toY(selected.awayScore) - 4.5} width={9} height={9} rx={1} fill={AWAY} stroke="var(--bg-card)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              </g>}
            </g>
          </svg>
          <div className="absolute left-0 right-0 top-full mt-2 flex text-[11px] text-text-secondary" aria-hidden="true">
            {period === 0 ? [1, 2, 3, 4].map(value => <span key={value} className="w-1/4 text-center">{quarter(value)}</span>) : <><span>{isZh ? "12:00 剩余" : "12:00 remaining"}</span><span className="ml-auto">{isZh ? "本节结束" : "End of quarter"}</span></>}
          </div>
        </div>
      </div>

      <div className="mt-2 flex rounded-xl border border-border bg-bg-secondary p-0.5" role="group" aria-label={isZh ? "图表范围" : "Chart range"}>
        {([0, 1, 2, 3, 4] as const).map(value => (
          <button key={value} type="button" aria-pressed={period === value} onClick={() => selectPeriod(value)}
            className={`min-h-11 min-w-11 flex-1 rounded-lg px-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${period === value ? "bg-bg-card text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}>
            {value === 0 ? (isZh ? "全场" : "Game") : quarter(value)}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-border bg-bg-secondary px-3 pb-1 pt-3" data-score-readout>
        <div className="flex items-center justify-between gap-2" aria-live="polite" aria-atomic="true">
          <div className="shrink-0 text-[10px] text-text-secondary">
            <p className="font-medium">{inspecting ? (isZh ? "所选记录" : "Selected record") : (isZh ? "最后记录" : "Last recorded")}</p>
            <p className="mt-0.5 text-xs font-semibold text-text-primary">{quarter(selected.period)} <span className="ml-1 font-mono">{selected.clockAsPrinted}</span><span className="ml-1 text-[9px] font-normal text-text-secondary">{isZh ? "剩余" : "left"}</span></p>
          </div>
          <p className="flex items-center gap-2 tabular-nums">
            <span className="flex min-w-10 flex-col items-center"><span className="text-[9px] text-text-secondary">{awayTricode}</span><strong className={`font-mono text-xl leading-tight ${styles.away}`}>{selected.awayScore}</strong></span>
            <span className="text-xs text-text-secondary" aria-hidden="true">:</span>
            <span className="flex min-w-10 flex-col items-center"><span className="text-[9px] text-text-secondary">{homeTricode}</span><strong className={`font-mono text-xl leading-tight ${styles.home}`}>{selected.homeScore}</strong></span>
          </p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <button type="button" onClick={() => move(-1)} disabled={selectedPosition === 0} aria-label={isZh ? "上一条记录" : "Previous record"} className="flex size-11 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover focus-visible:outline-2 disabled:opacity-30"><ChevronLeft size={17} aria-hidden="true" /></button>
          <input type="range" min={0} max={visible.length - 1} value={selectedPosition} step={1}
            aria-label={isZh ? "按原文顺序查看比分记录" : "Inspect score records in source order"} aria-valuetext={selectionLabel}
            onFocus={() => setInspecting(true)} onChange={event => select(visible[Number(event.currentTarget.value)].sourceIndex)}
            className="h-11 min-w-0 flex-1 cursor-pointer accent-accent" />
          <button type="button" onClick={() => move(1)} disabled={selectedPosition === visible.length - 1} aria-label={isZh ? "下一条记录" : "Next record"} className="flex size-11 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover focus-visible:outline-2 disabled:opacity-30"><ChevronRight size={17} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 text-[10px] text-text-secondary">
        <span>{inspecting ? recordLabel : (isZh ? "轻点曲线 · 滑动查看 · 方向键逐条浏览" : "Tap or slide to inspect · Arrow keys step through")}</span>
        <a href={`${sourceUrl}#page=${selected.sourcePage}`} target="_blank" rel="noopener noreferrer" className="min-h-8 content-center hover:text-accent hover:underline focus-visible:outline-2"
          aria-label={isZh ? `NBA 官方赛后报告 PDF 第 ${selected.sourcePage} 页（外部链接）` : `NBA official gamebook PDF page ${selected.sourcePage} (external link)`}>{isZh ? `原文第 ${selected.sourcePage} 页` : `Source page ${selected.sourcePage}`} ↗</a>
      </div>
    </div>
  );
}
