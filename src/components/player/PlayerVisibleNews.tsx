"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { PlayerNewsLoading } from "./PlayerDetailsLoading";
const PlayerNews = dynamic(() => import("./PlayerNews"), { loading: PlayerNewsLoading });
/** Keep the existing below-the-fold desktop request boundary after splitting the phone tabs. */
export default function PlayerVisibleNews({ playerName }: { playerName: string }) {
  return <VisibleNews key={playerName} playerName={playerName} />;
}
function VisibleNews({ playerName }: { playerName: string }) {
  const target = useRef<HTMLDivElement>(null);
  const [activated, setActivated] = useState(false);
  useEffect(() => {
    if (activated) return;
    let active = true;
    const activate = () => { if (active) setActivated(true); };
    if (typeof IntersectionObserver === "undefined") { queueMicrotask(activate); return () => { active = false; }; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); activate(); }
    }, { rootMargin: "300px 0px" });
    if (target.current) observer.observe(target.current);
    return () => { active = false; observer.disconnect(); };
  }, [activated]);
  return <div ref={target} tabIndex={0} onFocus={() => setActivated(true)} className="rounded-lg focus-visible:outline-2 focus-visible:outline-accent">
    {activated ? <PlayerNews playerName={playerName} showEmpty /> : <PlayerNewsLoading />}
  </div>;
}
