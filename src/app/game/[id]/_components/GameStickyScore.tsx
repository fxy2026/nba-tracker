"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { teamLogoUrl } from "@/lib/teamUrls";

interface Props {
  awayTricode: string;
  awayScore: number;
  awayTeamId: number;
  homeTricode: string;
  homeScore: number;
  homeTeamId: number;
  statusText: string;
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

  return (
    <div
      className={`fixed top-12 sm:top-16 left-0 right-0 z-40 bg-bg-secondary/95 backdrop-blur-md border-b border-border transition-transform duration-200 ${
        visible ? "translate-y-0" : "-translate-y-full pointer-events-none"
      }`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
    >
      <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-start">
          <Image src={teamLogoUrl(awayTeamId)} alt="" width={20} height={20} unoptimized />
          <span className="font-mono text-xs font-bold text-text-primary">{awayTricode}</span>
          <span className="font-mono text-base font-bold tabular-nums text-text-primary">{awayScore}</span>
        </div>
        <span className="text-[9px] uppercase tracking-[0.2em] text-text-secondary font-mono truncate shrink-0 max-w-[40%] text-center">
          {statusText}
        </span>
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          <span className="font-mono text-base font-bold tabular-nums text-text-primary">{homeScore}</span>
          <span className="font-mono text-xs font-bold text-text-primary">{homeTricode}</span>
          <Image src={teamLogoUrl(homeTeamId)} alt="" width={20} height={20} unoptimized />
        </div>
      </div>
    </div>
  );
}
