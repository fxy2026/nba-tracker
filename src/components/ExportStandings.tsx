"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface TeamRecord { tricode: string; wins: number; losses: number; }

export default function ExportStandings({ east, west }: { east: TeamRecord[]; west: TeamRecord[] }) {
  const [copied, setCopied] = useState(false);

  const handleExport = () => {
    const lines = ["NBA Standings 2025-26", ""];
    lines.push("Eastern Conference:");
    east.slice(0, 8).forEach((t, i) => lines.push(`  ${i + 1}. ${t.tricode} ${t.wins}-${t.losses}`));
    lines.push("");
    lines.push("Western Conference:");
    west.slice(0, 8).forEach((t, i) => lines.push(`  ${i + 1}. ${t.tricode} ${t.wins}-${t.losses}`));
    lines.push("", "via NBA Tracker — nba.xpy.me");

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-card border border-border rounded-lg text-xs text-text-secondary hover:text-accent hover:border-accent/50 transition-colors"
    >
      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
      {copied ? "Copied!" : "Export"}
    </button>
  );
}
