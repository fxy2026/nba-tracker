"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { useToast } from "@/components/ToastProvider";

interface TeamRecord { tricode: string; wins: number; losses: number; }

export default function ExportStandings({ east, west, season, archive }: { east: TeamRecord[]; west: TeamRecord[]; season: string; archive: boolean }) {
  const [copied, setCopied] = useState(false);
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const scope = isZh ? "每个联盟前 8 队" : "Top 8 per conference";
  const { toast } = useToast();

  const handleExport = async () => {
    const lines = [`NBA Standings ${season}`, scope];
    if (archive) lines.push(isZh
      ? "本地存档中的常规赛终场记录，并非实时或近期核验的数据。计算排名，非官方种子排名；未应用 NBA 官方同胜率排名规则。"
      : "Recorded regular-season finals from the local archive, not live or recently verified data. Computed order, not official seeding; official NBA tiebreakers are not applied.");
    lines.push("");
    lines.push(t.export.eastConf);
    east.slice(0, 8).forEach((tm, i) => lines.push(`  ${i + 1}. ${tm.tricode} ${tm.wins}-${tm.losses}`));
    lines.push("");
    lines.push(t.export.westConf);
    west.slice(0, 8).forEach((tm, i) => lines.push(`  ${i + 1}. ${tm.tricode} ${tm.wins}-${tm.losses}`));
    lines.push("", "via NBA Tracker — nba.xpy.me");

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      toast(t.export.copied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(t.export.clipboardError, "warning");
    }
  };

  return (
    <button
      onClick={handleExport}
      className="flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-accent gap-1.5 px-3 py-1.5 bg-bg-card border border-border rounded-lg text-xs text-text-secondary hover:text-accent hover:border-accent/50 transition-colors"
    >
      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
      {copied ? t.export.copied : `${t.export.exportBtn} · ${scope}`}
    </button>
  );
}
