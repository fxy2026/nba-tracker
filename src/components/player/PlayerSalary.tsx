"use client";

import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

interface ContractData {
  season: number;
  base_salary: number;
  cap_hit: number;
}

export default function PlayerSalary({ playerName, teamAbbr }: { playerName: string; teamAbbr: string }) {
  const { t } = useLocale();
  const [contracts, setContracts] = useState<ContractData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/salary?player=${encodeURIComponent(playerName)}&team=${encodeURIComponent(teamAbbr)}`, { signal: controller.signal });
        if (!res.ok) { setLoading(false); return; }
        const json = await res.json();
        if (!controller.signal.aborted && json.data) setContracts(json.data);
      } catch { /* ignore */ }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => controller.abort();
  }, [playerName, teamAbbr]);

  if (loading) return null;
  if (contracts.length === 0) return null;

  const formatSalary = (amount: number) => {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
    return `$${amount}`;
  };

  return (
    <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <DollarSign size={14} className="text-success" />
        <h3 className="text-sm font-semibold">{t.playerSalary.title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-text-secondary">
              <th className="text-left py-2.5 px-4">{t.playerSalary.seasonCol}</th>
              <th className="text-right py-2.5 px-4">{t.playerSalary.baseSalary}</th>
              <th className="text-right py-2.5 px-4">{t.playerSalary.capHit}</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.season} className="border-b border-border/30 hover:bg-bg-hover/50">
                <td className="py-2.5 px-4 font-medium text-text-primary">{c.season}-{String(c.season + 1).slice(2)}</td>
                <td className="py-2.5 px-4 text-right font-medium text-success">{formatSalary(c.base_salary)}</td>
                <td className="py-2.5 px-4 text-right text-text-secondary">{formatSalary(c.cap_hit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
