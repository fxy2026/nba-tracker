"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useLocale } from "@/components/LocaleProvider";
import { PlayerNewsLoading, PlayerSalaryLoading } from "./PlayerDetailsLoading";

const PlayerMeasurements = dynamic(() => import("./PlayerMeasurements"), { loading: () => null });
const PlayerSalary = dynamic(() => import("./PlayerSalary"), { loading: PlayerSalaryLoading });
const PlayerNews = dynamic(() => import("./PlayerNews"), { loading: PlayerNewsLoading });

interface Props {
  playerId: number;
  draftYear: number | null;
  playerName: string;
  teamAbbr: string;
}

export default function PlayerOptionalDetails(props: Props) {
  // Reset the observer and every child's state together on identity changes,
  // including A → B → A while either player's requests are still pending.
  return <VisiblePlayerDetails key={JSON.stringify([props.playerId, props.draftYear, props.playerName, props.teamAbbr])} {...props} />;
}

function VisiblePlayerDetails({ playerId, draftYear, playerName, teamAbbr }: Props) {
  const { t } = useLocale();
  const target = useRef<HTMLDivElement>(null);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (activated) return;
    let active = true;
    let started = false;
    let observer: IntersectionObserver | null = null;
    const activate = () => {
      // Disconnect alone cannot cancel an already queued observer callback.
      if (!active || started) return;
      started = true;
      observer?.disconnect();
      setActivated(true);
    };

    if (typeof IntersectionObserver === "undefined") {
      queueMicrotask(activate);
    } else {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) activate();
      }, { rootMargin: "300px 0px" });
      if (target.current) observer.observe(target.current);
    }
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [activated]);

  return (
    <div
      ref={target}
      role="region"
      aria-label={`${t.playerMeasurements.title}, ${t.playerSalary.title}, ${t.playerNews.title}`}
      tabIndex={0}
      onFocus={() => setActivated(true)}
      className="space-y-4 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    >
      {activated ? (
        <>
          <PlayerMeasurements playerId={playerId} draftYear={draftYear} />
          <PlayerSalary playerName={playerName} teamAbbr={teamAbbr} />
          <PlayerNews playerName={playerName} />
        </>
      ) : (
        <>
          <PlayerSalaryLoading />
          <PlayerNewsLoading />
        </>
      )}
    </div>
  );
}
