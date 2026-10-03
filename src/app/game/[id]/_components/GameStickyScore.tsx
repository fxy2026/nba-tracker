"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { teamLogoUrl } from "@/lib/teamUrls";

interface Props {
  awayTricode: string;
  awayScore: number;
  awayTeamId: number;
  homeTricode: string;
  homeScore: number;
  homeTeamId: number;
  statusText: string;
  isLive: boolean;
}

// Slides in from above the page once the GameHero scrolls past the viewport.
// Sits directly under the global navbar (top-12/16) and below it on z so the
// nav menu can still overlay if both are open.
export default function GameStickyScore({
  awayTricode,
  awayScore,
  awayTeamId,
  homeTricode,
  homeScore,
  homeTeamId,
  statusText,
  isLive,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById("game-hero-sentinel");
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        // Only show when the sentinel is *above* the viewport — i.e. user
        // scrolled past it, not when it hasn't been reached yet.
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { rootMargin: "0px" },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  if (!visible) return null;

  return createPortal(
    <div
      className={`fixed site-sticky-offset left-0 right-0 z-40 bg-bg-secondary/95 backdrop-blur-md border-b border-border transition-transform duration-200 ${
        visible ? "translate-y-0" : "-translate-y-full pointer-events-none"
      }`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
    >
      <div className="max-w-7xl mx-auto px-4 py-1.5 grid grid-cols-2 sm:flex items-center justify-between gap-x-3 gap-y-0.5">
        <div className="row-start-1 col-start-1 flex items-center gap-2 min-w-0 flex-1 justify-start">
          <Image src={teamLogoUrl(awayTeamId)} alt="" width={20} height={20} unoptimized />
          <span className="font-mono text-xs font-bold text-text-primary">{awayTricode}</span>
          <span className="font-mono text-base font-bold tabular-nums text-text-primary">{awayScore}</span>
        </div>
        {isLive ? (
          <span className="row-start-2 col-span-2 flex items-center gap-1.5 shrink min-w-0 justify-center text-center break-words text-xs font-bold font-mono tabular-nums text-success">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            {statusText}
          </span>
        ) : (
          <span className="row-start-2 col-span-2 text-[10px] sm:text-xs uppercase tracking-[0.15em] text-text-secondary font-mono truncate shrink-0 sm:max-w-[40%] text-center">
            {statusText}
          </span>
        )}
        <div className="row-start-1 col-start-2 flex items-center gap-2 min-w-0 flex-1 justify-end">
          <span className="font-mono text-base font-bold tabular-nums text-text-primary">{homeScore}</span>
          <span className="font-mono text-xs font-bold text-text-primary">{homeTricode}</span>
          <Image src={teamLogoUrl(homeTeamId)} alt="" width={20} height={20} unoptimized />
        </div>
      </div>
    </div>,
    document.body
  );
}
