"use client";

import { Trophy } from "lucide-react";
import type { Series } from "@/lib/playoffs";
import SeriesCard from "./SeriesCard";

interface ConferenceBlock {
  label: string;
  series: Series[];
  color: string;
  bg: string;
}

export default function BracketMobile({
  finals,
  finalsLabel,
  conferences,
  championPath,
  roundLabels,
}: {
  finals: Series[];
  finalsLabel: string;
  conferences: ConferenceBlock[];
  championPath: Set<string>;
  roundLabels: Record<number, string>;
}) {
  return (
    <div className="md:hidden space-y-5">
      {/* Finals on top */}
      {finals.length > 0 && (
        <div className="glass-tile p-4 bg-[#FFD700]/[0.04] ring-1 ring-[#FFD700]/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-[#FFD700]/5 blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="text-center mb-3 pb-2 border-b border-[#FFD700]/20">
              <p className="text-[8px] font-mono uppercase tracking-[0.3em] text-text-secondary/50">/ NBA</p>
              <p className="text-sm font-bold font-mono uppercase tracking-[0.25em] text-[#FFD700] mt-0.5 flex items-center justify-center gap-1.5">
                <Trophy size={14} /> {finalsLabel}
              </p>
            </div>
            <div className="max-w-sm mx-auto">
              <SeriesCard s={finals[0]} size="lg" onPath={!finals[0].isProjected} align="left" />
            </div>
          </div>
        </div>
      )}

      {/* East/West sections — each with all rounds clearly separated */}
      {conferences.map((conf) => {
        if (conf.series.length === 0) return null;
        const rounds = [
          { num: 3, label: roundLabels[3], sub: "Conference Final", list: conf.series.filter((s) => s.round === 3) },
          { num: 2, label: roundLabels[2], sub: "Round 2", list: conf.series.filter((s) => s.round === 2) },
          { num: 1, label: roundLabels[1], sub: "Round 1", list: conf.series.filter((s) => s.round === 1) },
        ];
        return (
          <div key={conf.label} className={`glass-tile p-4 ${conf.bg}`}>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border/40">
              <span className="w-2 h-2 rounded-full" style={{ background: conf.color }} />
              <h3 className="text-sm font-bold font-mono uppercase tracking-[0.2em]" style={{ color: conf.color }}>{conf.label}</h3>
            </div>
            <div className="space-y-4">
              {rounds.map((r) => r.list.length > 0 && (
                <div key={r.num}>
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary">
                      / <span className="text-text-secondary/60">{r.sub}</span> · <span className="text-text-primary">{r.label}</span>
                    </p>
                    <span className="text-[9px] font-mono tabular-nums text-text-secondary/60">{r.list.length} series</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {r.list.map((s) => (
                      <SeriesCard key={s.id} s={s} size="sm" onPath={championPath.has(s.id)} align="left" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
