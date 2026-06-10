import type { LucideIcon } from "lucide-react";

export default function StatTile({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <div className="glass-tile p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-accent-amber/15 flex items-center justify-center text-accent-amber">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60">{label}</p>
        <p className="text-2xl font-light font-mono tabular-nums text-text-primary">{value}</p>
      </div>
    </div>
  );
}
