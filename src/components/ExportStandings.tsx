"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { CURRENT_SEASON } from "@/lib/constants";
import { useLocale } from "@/components/LocaleProvider";

interface TeamRecord { tricode: string; wins: number; losses: number; }

export default function ExportStandings({ east, west }: { east: TeamRecord[]; west: TeamRecord[] }) {
  const [copied, setCopied] = useState(false);
  const { t } = useLocale();

  const handleExport = () => {
    const lines = [`NBA Standings ${CURRENT_SEASON}`, ""];
    lines.push(t.export.eastConf);
    east.slice(0, 8).forEach((tm, i) => lines.push(`  ${i + 1}. ${tm.tricode} ${tm.wins}-${tm.losses}`));
    lines.push("");
    lines.push(t.export.westConf);
    west.slice(0, 8).forEach((tm, i) => lines.push(`  ${i + 1}. ${tm.tricode} ${tm.wins}-${tm.losses}`));
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
      {copied ? t.export.copied : t.export.exportBtn}
    </button>
  );
}
