"use client";

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  moveReportedScoreSelection, nearestReportedScorePoint, reportedScorePoints,
  scoreChartDomain, scoreChartPointsForPeriod,
  type ReportedScoreChartProps, type ScorePeriod,
} from "@/lib/reported-score-chart";

const HOME = "var(--accent)";
const AWAY = "var(--accent-amber)";
const PLOT_HEIGHT = 236;

export default function ReportedScoreChart({ rows, homeTricode, awayTricode, sourceUrl, isZh }: ReportedScoreChartProps) {
  const id = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [period, setPeriod] = useState<ScorePeriod>(0);
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, rows.length - 1));
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
  const pointerSelect = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const index = nearestReportedScorePoint(visible, event.clientX - bounds.left, event.clientY - bounds.top, bounds.width, bounds.height, domain, maxScore);
    if (index !== null) setSelectedIndex(index);
  };
  const selectPeriod = (value: ScorePeriod) => {
    setPeriod(value);
    if (value && selected.period !== value) setSelectedIndex(points.find(point => point.period === value)!.sourceIndex);
  };
  const move = (delta: number) => {
    const index = moveReportedScoreSelection(visible, selected.sourceIndex, delta);
    if (index !== null) setSelectedIndex(index);
  };

  return (
    <div className="mt-5" data-reported-score-chart>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs font-semibold" aria-label={isZh ? "球队图例" : "Team legend"}>
          <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-accent" />{homeTricode}<span className="font-normal text-text-secondary">{isZh ? "主" : "Home"}</span></span>
          <span className="flex items-center gap-2"><span className="size-2.5 bg-accent-amber" />{awayTricode}<span className="font-normal text-text-secondary">{isZh ? "客" : "Away"}</span></span>
        </div>
        <div className="flex rounded-lg border border-border bg-bg-secondary p-0.5" role="group" aria-label={isZh ? "图表范围" : "Chart range"}>
          {([0, 1, 2, 3, 4] as const).map(value => (
            <button key={value} type="button" aria-pressed={period === value} onClick={() => selectPeriod(value)}
              className={`min-h-11 min-w-11 rounded-md px-2 text-xs font-medium transition-colors ${period === value ? "bg-bg-card text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}>
              {value === 0 ? (isZh ? "全场" : "Game") : quarter(value)}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-[11px] text-text-secondary">{isZh ? "累计得分" : "Cumulative score"}</p>
      <div className="relative mt-2 pb-7 pl-8 pr-2">
        <div className="absolute bottom-7 left-0 top-0 w-6 text-right text-[11px] tabular-nums text-text-secondary" aria-hidden="true">
          {[0, 1, 2, 3, 4].map(tick => <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${tick * 25}%` }}>{maxScore * (1 - tick / 4)}</span>)}
        </div>
        <div ref={plotRef} className="relative" style={{ height: PLOT_HEIGHT }}>
          <svg width="100%" height={PLOT_HEIGHT} viewBox={`0 0 ${width} ${PLOT_HEIGHT}`}
            role="img" aria-labelledby={`${id}-title ${id}-description`} className="overflow-visible touch-pan-y"
            onPointerDown={pointerSelect} onPointerMove={event => { if (event.pointerType === "mouse" || event.buttons === 1) pointerSelect(event); }}>
            <title id={`${id}-title`}>{isZh ? `${homeTricode} 与 ${awayTricode} 比分走势` : `${homeTricode} and ${awayTricode} score trend`}</title>
            <desc id={`${id}-description`}>{isZh
              ? `${points.length} 条带时间的官方比分记录。圆点为 ${homeTricode}，方点为 ${awayTricode}。虚线仅连接记录，不表示连续事件。用下方滑块与按钮查看每条记录，完整数据表可展开。`
              : `${points.length} timed official score observations. Circles represent ${homeTricode}; squares represent ${awayTricode}. Dashed connectors do not represent a continuous event feed. Use the slider and buttons below to inspect every row, or expand the data table.`}</desc>
            <g aria-hidden="true">
              {[0, 1, 2, 3, 4].map(tick => <line key={tick} x1={0} x2={width} y1={PLOT_HEIGHT * tick / 4} y2={PLOT_HEIGHT * tick / 4} stroke="var(--border)" />)}
              {(period === 0 ? [1, 2, 3] : []).map(value => <line key={value} x1={toX(value * 720)} x2={toX(value * 720)} y1={0} y2={PLOT_HEIGHT} stroke="var(--border)" strokeDasharray="3 5" />)}
              {(["homeScore", "awayScore"] as const).map((team, teamIndex) => <path key={team} data-score-connector={team}
                d={visible.map((point, index) => `${index ? "L" : "M"}${toX(point.elapsedSeconds)},${toY(point[team])}`).join(" ")}
                fill="none" stroke={teamIndex === 0 ? HOME : AWAY} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.55} />)}
              {visible.map(point => <g key={point.sourceIndex} data-score-observation={point.sourceIndex}>
                <circle cx={toX(point.elapsedSeconds)} cy={toY(point.homeScore)} r={2.6} fill={HOME} />
                <rect x={toX(point.elapsedSeconds) - 2.3} y={toY(point.awayScore) - 2.3} width={4.6} height={4.6} fill={AWAY} />
              </g>)}
              <line x1={toX(selected.elapsedSeconds)} x2={toX(selected.elapsedSeconds)} y1={0} y2={PLOT_HEIGHT} stroke="var(--text-secondary)" strokeDasharray="2 4" opacity={0.7} />
              <circle cx={toX(selected.elapsedSeconds)} cy={toY(selected.homeScore)} r={5} fill={HOME} stroke="var(--bg-card)" strokeWidth={2} />
              <rect x={toX(selected.elapsedSeconds) - 4.5} y={toY(selected.awayScore) - 4.5} width={9} height={9} fill={AWAY} stroke="var(--bg-card)" strokeWidth={2} />
            </g>
          </svg>
          <div className="absolute left-0 right-0 top-full mt-2 flex text-[11px] text-text-secondary" aria-hidden="true">
            {period === 0 ? [1, 2, 3, 4].map(value => <span key={value} className="w-1/4 text-center">{quarter(value)}</span>) : <><span>{isZh ? "12:00 剩余" : "12:00 remaining"}</span><span className="ml-auto">{isZh ? "本节结束" : "End of quarter"}</span></>}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-border bg-bg-secondary px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2" aria-live="polite" aria-atomic="true">
          <div className="text-xs text-text-secondary"><span className="font-semibold text-text-primary">{quarter(selected.period)} · <span className="font-mono">{selected.clockAsPrinted}</span></span><span className="ml-2">{isZh ? "剩余" : "remaining"}</span><p className="mt-1 text-[11px]">{recordLabel}</p></div>
          <p className="flex items-center gap-3 font-mono text-sm tabular-nums"><span><span className="mr-1.5 text-xs text-text-secondary">{homeTricode}</span><strong className="text-lg text-accent">{selected.homeScore}</strong></span><span className="text-text-secondary" aria-hidden="true">:</span><span><strong className="text-lg text-accent-amber">{selected.awayScore}</strong><span className="ml-1.5 text-xs text-text-secondary">{awayTricode}</span></span></p>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button type="button" onClick={() => move(-1)} disabled={selectedPosition === 0} aria-label={isZh ? "上一条记录" : "Previous record"} className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-bg-hover disabled:opacity-30"><ChevronLeft size={17} aria-hidden="true" /></button>
          <input type="range" min={0} max={visible.length - 1} value={selectedPosition} step={1}
            aria-label={isZh ? "按原文顺序查看比分记录" : "Inspect score records in source order"} aria-valuetext={selectionLabel}
            onChange={event => setSelectedIndex(visible[Number(event.currentTarget.value)].sourceIndex)}
            className="h-11 min-w-0 flex-1 cursor-pointer accent-accent" />
          <button type="button" onClick={() => move(1)} disabled={selectedPosition === visible.length - 1} aria-label={isZh ? "下一条记录" : "Next record"} className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-bg-hover disabled:opacity-30"><ChevronRight size={17} aria-hidden="true" /></button>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-secondary">
          <span>{isZh ? "轻点图表或拖动滑块 · 方向键逐条查看" : "Tap the chart or drag the slider · Arrow keys inspect each row"}</span>
          <a href={`${sourceUrl}#page=${selected.sourcePage}`} target="_blank" rel="noopener noreferrer" className="min-h-8 content-center text-accent hover:underline"
            aria-label={isZh ? `NBA 官方赛后报告 PDF 第 ${selected.sourcePage} 页（外部链接）` : `NBA official gamebook PDF page ${selected.sourcePage} (external link)`}>{isZh ? `原文第 ${selected.sourcePage} 页` : `Source page ${selected.sourcePage}`} ↗</a>
        </div>
      </div>
    </div>
  );
}
