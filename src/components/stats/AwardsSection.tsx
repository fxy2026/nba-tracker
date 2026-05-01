"use client";

import { useState } from "react";
import awardsData from "@/data/awards.json";
import { useLocale } from "@/components/LocaleProvider";

const AWARD_CATS = [
  { key: "mvp", label: "MVP" },
  { key: "fmvp", label: "FMVP" },
  { key: "dpoy", label: "DPOY" },
  { key: "roy", label: "ROY" },
  { key: "smoy", label: "6MOY" },
  { key: "mip", label: "MIP" },
  { key: "nba1", label: "All-NBA 1st" },
] as const;

export default function AwardsSection() {
  const { t } = useLocale();
  const [cat, setCat] = useState("mvp");
  const entries = (awardsData as Record<string, { season: string; player: string; team: string }[]>)[cat] || [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap rounded-lg overflow-hidden border border-border">
          {AWARD_CATS.map((a) => (
            <button key={a.key} onClick={() => setCat(a.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${cat === a.key ? "bg-accent text-white" : "bg-bg-card text-text-secondary hover:text-text-primary"}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Multi-time winners */}
      {(() => {
        const counts: Record<string, number> = {};
        for (const e of entries) counts[e.player] = (counts[e.player] || 0) + 1;
        const multi = Object.entries(counts).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]);
        if (multi.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-2 mb-4">
            {multi.map(([name, count]) => (
              <span key={name} className="text-xs px-2.5 py-1 rounded-full bg-accent/15 text-accent font-medium">
                {name}: {count}x
              </span>
            ))}
          </div>
        );
      })()}

      <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary text-xs">
                <th className="text-left py-3 px-4">{t.common.season}</th>
                <th className="text-left py-3 px-2">{t.common.player}</th>
                <th className="text-left py-3 px-2">{t.common.team}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className={`border-b border-border/50 hover:bg-bg-hover transition-colors ${i === 0 ? "bg-accent/5" : ""}`}>
                  <td className="py-3 px-4 text-accent font-medium">{e.season}</td>
                  <td className="py-3 px-2 font-medium text-text-primary">{e.player}</td>
                  <td className="py-3 px-2 text-text-secondary">{e.team}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
