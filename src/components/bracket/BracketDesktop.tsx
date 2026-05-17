"use client";

import { Trophy } from "lucide-react";
import type { Series } from "@/lib/playoffs";
import SeriesCard from "./SeriesCard";
import ConfHalf from "./ConfHalf";

export default function BracketDesktop({
  eastR1, eastR2, eastR3,
  westR1, westR2, westR3,
  finals,
  championPath,
  roundLabels,
  eastLabel,
  westLabel,
  finalsLabel,
}: {
  eastR1: Series[];
  eastR2: Series[];
  eastR3: Series[];
  westR1: Series[];
  westR2: Series[];
  westR3: Series[];
  finals: Series[];
  championPath: Set<string>;
  roundLabels: Record<number, string>;
  eastLabel: string;
  westLabel: string;
  finalsLabel: string;
}) {
  return (
    <div className="hidden md:block overflow-x-auto pb-3 -mx-4 px-4">
      <div className="grid items-stretch gap-x-2 min-w-[960px]" style={{
        gridTemplateColumns: "minmax(0, 1fr) 160px minmax(0, 1fr)",
      }}>
        {/* East half */}
        <div className="relative">
          {eastR1.length > 0 ? (
            <ConfHalf
              r1={eastR1}
              r2={eastR2}
              r3={eastR3}
              side="left"
              championPath={championPath}
              conferenceColor="#3B82F6"
              conferenceLabel={eastLabel}
              roundLabels={roundLabels}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-text-secondary font-mono uppercase tracking-[0.15em]">East TBD</div>
          )}
        </div>

        {/* Finals center column */}
        <div className="relative flex flex-col items-center">
          <div className="text-center mb-3 pb-2 border-b border-[#FFD700]/30 w-full">
            <p className="text-[8px] font-mono uppercase tracking-[0.3em] text-text-secondary/50">/ NBA</p>
            <p className="text-sm font-bold font-mono uppercase tracking-[0.25em] text-[#FFD700] mt-0.5 flex items-center justify-center gap-1.5">
              <Trophy size={14} /> {finalsLabel}
            </p>
            <p className="text-[9px] font-mono text-text-secondary/60 mt-0.5">championship</p>
          </div>

          <div className="relative flex-1 w-full flex items-center justify-center">
            <div className="absolute inset-0 bg-[#FFD700]/8 blur-3xl rounded-3xl pointer-events-none" />
            {finals.length > 0 ? (
              <div className="relative w-full">
                <SeriesCard s={finals[0]} size="lg" onPath={!finals[0].isProjected} align="left" />
              </div>
            ) : (
              <div className="relative w-full glass-tile p-6 text-center bg-[#FFD700]/[0.02] ring-1 ring-[#FFD700]/20">
                <Trophy size={32} className="mx-auto text-text-secondary/40 mb-2" />
                <p className="text-xs font-mono uppercase tracking-[0.2em] text-text-secondary/60">Finals TBD</p>
                <p className="text-[10px] font-mono text-text-secondary/40 mt-1">East champion<br />vs<br />West champion</p>
              </div>
            )}
          </div>
        </div>

        {/* West half */}
        <div className="relative">
          {westR1.length > 0 ? (
            <ConfHalf
              r1={westR1}
              r2={westR2}
              r3={westR3}
              side="right"
              championPath={championPath}
              conferenceColor="#F59E0B"
              conferenceLabel={westLabel}
              roundLabels={roundLabels}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-text-secondary font-mono uppercase tracking-[0.15em]">West TBD</div>
          )}
        </div>
      </div>
    </div>
  );
}
