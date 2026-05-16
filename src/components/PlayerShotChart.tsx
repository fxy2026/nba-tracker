"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { getPlayerHeadshotUrl, type ShotAction, type PlayerInfo } from "@/lib/api";
import {
  BASKET_PCT_X,
  FT_LINE_PCT_X,
  PAINT_WIDTH_PCT,
  CORNER_3_PCT_Y,
  CORNER_3_EXT_PCT_X,
  THREE_PT_ARC_PCT,
  FT_CIRCLE_FT,
  RESTRICTED_AREA_FT,
  COURT_WIDTH_FT,
} from "@/lib/court";
import { X } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

interface Props {
  playerName: string;
  playerId: number;
  shots: ShotAction[];
  playerInfo?: PlayerInfo | null;
}

/* ── Court constants (computed once, mapped from shared lib/court NBA facts) ── */
const CW_TOTAL = 370, CH_TOTAL = 700, PAD = 20;
const CW = CW_TOTAL - PAD * 2, CH = CH_TOTAL - PAD * 2;
const CCX = PAD + CW / 2, MID_Y = PAD + CH / 2;
const toSvgX = (pctY: number) => PAD + (pctY / 100) * CW;
const toSvgY = (pctX: number) => PAD + (pctX / 100) * CH;
const BASKET_X = BASKET_PCT_X, FT_X = FT_LINE_PCT_X, PAINT_W = PAINT_WIDTH_PCT;
const FT_R = (FT_CIRCLE_FT / COURT_WIDTH_FT) * CW;
const RESTRICTED_R = (RESTRICTED_AREA_FT / COURT_WIDTH_FT) * CW;
const CENTER_R = (FT_CIRCLE_FT / COURT_WIDTH_FT) * CW, RIM_R = 5;
const C3_Y = CORNER_3_PCT_Y, C3_EXT_X = CORNER_3_EXT_PCT_X;

/* Static court SVG elements – never re-rendered */
function CourtLines() {
  const halfCourt = (top: boolean) => {
    const bx = top ? BASKET_X : 100 - BASKET_X;
    const fx = top ? FT_X : 100 - FT_X;
    const basketY = toSvgY(bx);
    const ftLineY = toSvgY(fx);
    const paintHW = (PAINT_W / 100) * CW / 2;
    const c3x1 = toSvgX(C3_Y), c3x2 = toSvgX(100 - C3_Y);
    const c3y = toSvgY(top ? C3_EXT_X : 100 - C3_EXT_X);
    const arcY = toSvgY(top ? BASKET_X + THREE_PT_ARC_PCT : 100 - BASKET_X - THREE_PT_ARC_PCT);
    const bbY = top ? basketY - 5 : basketY + 5;
    const paintTop = top ? PAD : ftLineY;
    const paintH = top ? ftLineY - PAD : PAD + CH - ftLineY;
    const c3Start = top ? PAD : PAD + CH;
    return (
      <>
        <rect x={CCX - paintHW} y={paintTop} width={paintHW * 2} height={paintH} fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
        <circle cx={CCX} cy={ftLineY} r={FT_R} fill="none" stroke="#2a2a2a" strokeWidth="1" strokeDasharray="4,4" />
        <circle cx={CCX} cy={basketY} r={RIM_R} fill="none" stroke="#928CEE" strokeWidth="1.5" />
        <line x1={CCX - 15} y1={bbY} x2={CCX + 15} y2={bbY} stroke="#444" strokeWidth="2" />
        <circle cx={CCX} cy={basketY} r={RESTRICTED_R} fill="none" stroke="#2a2a2a" strokeWidth="1" />
        <path d={`M ${c3x1} ${c3Start} L ${c3x1} ${c3y} Q ${c3x1} ${arcY} ${CCX} ${arcY} Q ${c3x2} ${arcY} ${c3x2} ${c3y} L ${c3x2} ${c3Start}`} fill="none" stroke="#333" strokeWidth="1.5" />
      </>
    );
  };
  return (
    <>
      <rect x="0" y="0" width={CW_TOTAL} height={CH_TOTAL} fill="#141414" rx="8" />
      <rect x={PAD} y={PAD} width={CW} height={CH} fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
      <line x1={PAD} y1={MID_Y} x2={PAD + CW} y2={MID_Y} stroke="#2a2a2a" strokeWidth="1.5" />
      <circle cx={CCX} cy={MID_Y} r={CENTER_R} fill="none" stroke="#2a2a2a" strokeWidth="1" strokeDasharray="4,4" />
      {halfCourt(true)}
      {halfCourt(false)}
    </>
  );
}

/* ── Main component ── */
export default function PlayerShotChart({ playerName, playerId, shots, playerInfo }: Props) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [imgError, setImgError] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration pattern
  useEffect(() => { setMounted(true); }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  /* ── ALL heavy computation deferred until modal opens ── */
  const data = useMemo(() => {
    if (!open) return null;

    const playerShots: typeof shots = [];
    const fieldGoalShots: typeof shots = [];
    let madeCount = 0, threes = 0, threesMade = 0, twos = 0, twosMade = 0, fts = 0, ftsMade = 0;
    const perPeriod = new Map<number, { fg2: number; fg3: number; ft: number }>();

    for (const s of shots) {
      if (s.personId !== playerId) continue;
      playerShots.push(s);
      const isMade = s.shotResult === "Made";
      if (s.actionType === "2pt") {
        twos++; fieldGoalShots.push(s);
        if (isMade) { twosMade++; madeCount++; }
      } else if (s.actionType === "3pt") {
        threes++; fieldGoalShots.push(s);
        if (isMade) { threesMade++; madeCount++; }
      } else if (s.actionType === "freethrow") {
        fts++;
        if (isMade) ftsMade++;
      }
      if (isMade) {
        const q = perPeriod.get(s.period) || { fg2: 0, fg3: 0, ft: 0 };
        if (s.actionType === "2pt") q.fg2++;
        else if (s.actionType === "3pt") q.fg3++;
        else if (s.actionType === "freethrow") q.ft++;
        perPeriod.set(s.period, q);
      }
    }

    const quarterScoring = Array.from(perPeriod.entries())
      .sort(([a], [b]) => a - b)
      .map(([period, q]) => ({ period, pts: q.fg2 * 2 + q.fg3 * 3 + q.ft, ...q }));

    return {
      playerShots,
      fieldGoalShots,
      madeCount,
      fieldGoalTotal: twos + threes,
      threes, threesMade, twos, twosMade, fts, ftsMade,
      quarterScoring,
      hasShots: playerShots.length > 0,
    };
  }, [open, shots, playerId]);

  const info = playerInfo;
  const headshotUrl = getPlayerHeadshotUrl(playerId);

  const modal = open && mounted && data ? createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(false)}>
      <div
        className="bg-bg-secondary rounded-2xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Player header with headshot */}
        <div className="relative overflow-hidden rounded-t-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-bg-secondary via-bg-secondary/90 to-transparent z-10" />
          <div className="relative z-20 flex items-center gap-4 p-5">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-bg-card border-2 border-accent/30 shrink-0">
              {!imgError ? (
                <Image
                  src={headshotUrl}
                  alt={playerName}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover object-top"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-text-secondary">
                  {playerName.split(" ").map((n) => n[0]).join("")}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-xl text-text-primary">{playerName}</h3>
              {info && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm text-accent font-medium">#{info.jersey} {info.position}</span>
                  <span className="text-sm text-text-secondary">{info.teamCity} {info.teamName}</span>
                </div>
              )}
              {info && (
                <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                  <span>{info.height} · {info.weight} lbs</span>
                  {info.country && <span>{info.country}</span>}
                </div>
              )}
            </div>

            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Career info */}
        {info && (
          <div className="px-5 pb-3">
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-bg-card/80 backdrop-blur-md rounded-lg p-2.5 text-center">
                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary">Seasons</p>
                <p className="text-lg font-light font-mono tabular-nums text-text-primary mt-0.5">{info.toYear && info.fromYear ? parseInt(info.toYear) - parseInt(info.fromYear) + 1 : "-"}</p>
              </div>
              <div className="bg-bg-card/80 backdrop-blur-md rounded-lg p-2.5 text-center">
                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary">PPG</p>
                <p className="text-lg font-light font-mono tabular-nums text-accent-amber mt-0.5">{info.pts}</p>
              </div>
              <div className="bg-bg-card/80 backdrop-blur-md rounded-lg p-2.5 text-center">
                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary">RPG</p>
                <p className="text-lg font-light font-mono tabular-nums text-text-primary mt-0.5">{info.reb}</p>
              </div>
              <div className="bg-bg-card/80 backdrop-blur-md rounded-lg p-2.5 text-center">
                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary">APG</p>
                <p className="text-lg font-light font-mono tabular-nums text-text-primary mt-0.5">{info.ast}</p>
              </div>
            </div>
            {info.college && (
              <p className="text-xs text-text-secondary mt-2">
                {info.college} · Draft {info.draftYear} R{info.draftRound} Pick {info.draftNumber}
              </p>
            )}
          </div>
        )}

        {/* This game shot stats */}
        {data.hasShots && (
          <>
            <div className="px-5 pt-2 pb-1">
              <h4 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary tracking-wide">{t.playerShotChart.thisGame}</h4>
            </div>
            <div className="grid grid-cols-4 gap-2 px-5 pb-3">
              <div className="bg-bg-card/80 backdrop-blur-md rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-text-secondary">{t.playerShotChart.totalFg}</p>
                <p className="text-lg font-bold">{data.madeCount}/{data.fieldGoalTotal}</p>
                <p className="text-xs text-accent">{data.fieldGoalTotal > 0 ? ((data.madeCount / data.fieldGoalTotal) * 100).toFixed(1) : "0"}%</p>
              </div>
              <div className="bg-bg-card/80 backdrop-blur-md rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-text-secondary">2PT</p>
                <p className="text-lg font-bold">{data.twosMade}/{data.twos}</p>
                <p className="text-xs text-accent">{data.twos > 0 ? ((data.twosMade / data.twos) * 100).toFixed(1) : "0"}%</p>
              </div>
              <div className="bg-bg-card/80 backdrop-blur-md rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-text-secondary">3PT</p>
                <p className="text-lg font-bold">{data.threesMade}/{data.threes}</p>
                <p className="text-xs text-accent">{data.threes > 0 ? ((data.threesMade / data.threes) * 100).toFixed(1) : "0"}%</p>
              </div>
              <div className="bg-bg-card/80 backdrop-blur-md rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-text-secondary">FT</p>
                <p className="text-lg font-bold">{data.ftsMade}/{data.fts}</p>
                <p className="text-xs text-accent">{data.fts > 0 ? ((data.ftsMade / data.fts) * 100).toFixed(1) : "0"}%</p>
              </div>
            </div>

            {/* Per-quarter scoring */}
            {data.quarterScoring.length > 0 && (
              <div className="px-5 pb-3">
                <h4 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary tracking-wide mb-2">{t.gameDetail.scoringPerQ}</h4>
                <div className="flex gap-2">
                  {data.quarterScoring.map((q) => (
                    <div key={q.period} className="flex-1 bg-bg-card rounded-lg p-2 text-center">
                      <p className="text-[10px] text-text-secondary">
                        {q.period <= 4 ? `${t.playByPlayComp.quarter}${q.period}` : `${t.playByPlayComp.overtime}${q.period - 4}`}
                      </p>
                      <p className="text-lg font-bold text-accent">{q.pts}</p>
                      <div className="text-[10px] text-text-secondary leading-tight">
                        {q.fg2 > 0 && <span>{q.fg2}×2</span>}
                        {q.fg2 > 0 && (q.fg3 > 0 || q.ft > 0) && <span> </span>}
                        {q.fg3 > 0 && <span>{q.fg3}×3</span>}
                        {q.fg3 > 0 && q.ft > 0 && <span> </span>}
                        {q.ft > 0 && <span>{q.ft}FT</span>}
                      </div>
                    </div>
                  ))}
                  <div className="flex-1 bg-accent/10 rounded-lg p-2 text-center border border-accent/20">
                    <p className="text-[10px] text-text-secondary">{t.gameDetail.total}</p>
                    <p className="text-lg font-bold text-accent">
                      {data.quarterScoring.reduce((sum, q) => sum + q.pts, 0)}
                    </p>
                    <p className="text-[10px] text-text-secondary">pts</p>
                  </div>
                </div>
              </div>
            )}

            {/* Court */}
            <div className="px-5 pb-3">
              <svg viewBox={`0 0 ${CW_TOTAL} ${CH_TOTAL}`} className="w-full">
                <CourtLines />
                {data.fieldGoalShots.map((shot, i) => {
                  const sx = toSvgX(shot.y), sy = toSvgY(shot.x);
                  const isMade = shot.shotResult === "Made";
                  const is3 = shot.actionType === "3pt";
                  return isMade ? (
                    <circle key={i} cx={sx} cy={sy} r={is3 ? 7 : 6} fill={is3 ? "#928CEE" : "#22c55e"} fillOpacity={0.85} />
                  ) : (
                    <g key={i} transform={`translate(${sx}, ${sy})`}>
                      <line x1="-4" y1="-4" x2="4" y2="4" stroke="#ef4444" strokeWidth="2" strokeOpacity={0.7} />
                      <line x1="4" y1="-4" x2="-4" y2="4" stroke="#ef4444" strokeWidth="2" strokeOpacity={0.7} />
                    </g>
                  );
                })}
              </svg>
              <div className="flex items-center justify-center gap-4 mt-2">
                <span className="flex items-center gap-1 text-xs text-text-secondary">
                  <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#22c55e" /></svg> 2PT
                </span>
                <span className="flex items-center gap-1 text-xs text-text-secondary">
                  <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#928CEE" /></svg> 3PT
                </span>
                <span className="flex items-center gap-1 text-xs text-text-secondary">
                  <svg width="12" height="12">
                    <line x1="2" y1="2" x2="10" y2="10" stroke="#ef4444" strokeWidth="1.5" />
                    <line x1="10" y1="2" x2="2" y2="10" stroke="#ef4444" strokeWidth="1.5" />
                  </svg> {t.playerShotChart.miss}
                </span>
              </div>
            </div>

            {/* Shot log */}
            <div className="px-5 pb-5">
              <h4 className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wide">{t.playerShotChart.shotLog}</h4>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {data.playerShots.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${s.shotResult === "Made" ? "bg-success" : "bg-danger"}`} />
                    <span className="text-text-secondary">{t.playByPlayComp.quarter}{s.period}</span>
                    <span className="text-text-primary">{s.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {!data.hasShots && (
          <div className="px-5 pb-5 text-center text-sm text-text-secondary py-6">
            {t.playerShotChart.noShotData}
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-left hover:text-accent transition-colors underline decoration-dotted underline-offset-2"
      >
        {playerName}
      </button>
      {modal}
    </>
  );
}
