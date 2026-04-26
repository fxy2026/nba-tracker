"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { ShotAction, PlayerInfo } from "@/lib/api";
import { X } from "lucide-react";

interface Props {
  playerName: string;
  playerId: number;
  shots: ShotAction[];
  playerInfo?: PlayerInfo | null;
}

export default function PlayerShotChart({ playerName, playerId, shots, playerInfo }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const playerShots = shots.filter((s) => s.personId === playerId);
  const hasShots = playerShots.length > 0;

  const made = playerShots.filter((s) => s.shotResult === "Made");
  const fg = hasShots ? `${made.length}/${playerShots.length}` : "";
  const pct = hasShots ? ((made.length / playerShots.length) * 100).toFixed(1) : "0";

  const threes = playerShots.filter((s) => s.actionType === "3pt");
  const threesMade = threes.filter((s) => s.shotResult === "Made");
  const twos = playerShots.filter((s) => s.actionType === "2pt");
  const twosMade = twos.filter((s) => s.shotResult === "Made");

  const headshotUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;
  const courtWidth = 500;
  const courtHeight = 340;

  const info = playerInfo;

  const modal = open && mounted ? createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
      <div
        className="bg-bg-secondary rounded-2xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Player header with headshot */}
        <div className="relative overflow-hidden rounded-t-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-bg-secondary via-bg-secondary/90 to-transparent z-10" />
          <div className="relative z-20 flex items-center gap-4 p-5">
            {/* Headshot */}
            <div className="w-20 h-20 rounded-full overflow-hidden bg-bg-card border-2 border-accent/30 shrink-0">
              {!imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={headshotUrl}
                  alt={playerName}
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
              <div className="bg-bg-card rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-text-secondary uppercase tracking-wide">Seasons</p>
                <p className="text-lg font-bold text-text-primary">{info.toYear && info.fromYear ? parseInt(info.toYear) - parseInt(info.fromYear) + 1 : "-"}</p>
              </div>
              <div className="bg-bg-card rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-text-secondary uppercase tracking-wide">PPG</p>
                <p className="text-lg font-bold text-accent">{info.pts}</p>
              </div>
              <div className="bg-bg-card rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-text-secondary uppercase tracking-wide">RPG</p>
                <p className="text-lg font-bold text-text-primary">{info.reb}</p>
              </div>
              <div className="bg-bg-card rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-text-secondary uppercase tracking-wide">APG</p>
                <p className="text-lg font-bold text-text-primary">{info.ast}</p>
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
        {hasShots && (
          <>
            <div className="px-5 pt-2 pb-1">
              <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide">This Game</h4>
            </div>
            <div className="grid grid-cols-3 gap-2 px-5 pb-3">
              <div className="bg-bg-card rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-text-secondary">Total FG</p>
                <p className="text-lg font-bold">{made.length}/{playerShots.length}</p>
                <p className="text-xs text-accent">{pct}%</p>
              </div>
              <div className="bg-bg-card rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-text-secondary">2PT</p>
                <p className="text-lg font-bold">{twosMade.length}/{twos.length}</p>
                <p className="text-xs text-accent">{twos.length > 0 ? ((twosMade.length / twos.length) * 100).toFixed(1) : "0"}%</p>
              </div>
              <div className="bg-bg-card rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-text-secondary">3PT</p>
                <p className="text-lg font-bold">{threesMade.length}/{threes.length}</p>
                <p className="text-xs text-accent">{threes.length > 0 ? ((threesMade.length / threes.length) * 100).toFixed(1) : "0"}%</p>
              </div>
            </div>

            {/* Court */}
            <div className="px-5 pb-3">
              <svg viewBox={`0 0 ${courtWidth} ${courtHeight}`} className="w-full">
                <rect x="0" y="0" width={courtWidth} height={courtHeight} fill="#141414" rx="8" />
                {/* Landscape half-court: basket on left */}
                <line x1="40" y1="20" x2="40" y2="320" stroke="#2a2a2a" strokeWidth="1.5" />
                <line x1="40" y1="20" x2="480" y2="20" stroke="#2a2a2a" strokeWidth="1.5" />
                <line x1="40" y1="320" x2="480" y2="320" stroke="#2a2a2a" strokeWidth="1.5" />
                <line x1="480" y1="20" x2="480" y2="320" stroke="#2a2a2a" strokeWidth="1" />
                <rect x="40" y="100" width="110" height="140" fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
                <circle cx="150" cy="170" r="55" fill="none" stroke="#2a2a2a" strokeWidth="1" strokeDasharray="4,4" />
                <circle cx="55" cy="170" r="7" fill="none" stroke="#928CEE" strokeWidth="1.5" />
                <line x1="47" y1="150" x2="47" y2="190" stroke="#444" strokeWidth="2" />
                <path d="M 40 145 A 25 25 0 0 1 40 195" fill="none" stroke="#2a2a2a" strokeWidth="1" />
                <path d="M 40 50 L 100 50 Q 310 50 310 170 Q 310 290 100 290 L 40 290" fill="none" stroke="#333" strokeWidth="1.5" />

                {playerShots.map((shot, i) => {
                  const halfY = shot.y <= 50 ? shot.y : 100 - shot.y;
                  const halfX = shot.y <= 50 ? shot.x : 100 - shot.x;
                  const svgX = 40 + (halfY / 50) * 440;
                  const svgY = 20 + (halfX / 100) * 300;
                  const isMade = shot.shotResult === "Made";
                  const is3pt = shot.actionType === "3pt";
                  return isMade ? (
                    <circle key={i} cx={svgX} cy={svgY} r={is3pt ? 7 : 6} fill={is3pt ? "#928CEE" : "#22c55e"} fillOpacity={0.85} />
                  ) : (
                    <g key={i} transform={`translate(${svgX}, ${svgY})`}>
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
                  </svg> Miss
                </span>
              </div>
            </div>

            {/* Shot log */}
            <div className="px-5 pb-5">
              <h4 className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wide">Shot Log</h4>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {playerShots.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${s.shotResult === "Made" ? "bg-success" : "bg-danger"}`} />
                    <span className="text-text-secondary">Q{s.period}</span>
                    <span className="text-text-primary">{s.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {!hasShots && (
          <div className="px-5 pb-5 text-center text-sm text-text-secondary py-6">
            No shot data for this game
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
