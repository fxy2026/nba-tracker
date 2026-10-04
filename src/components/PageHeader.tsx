import type { LucideIcon } from "lucide-react";
import UpdatedPill from "./UpdatedPill";

interface PageHeaderProps {
  eyebrow?: string;
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  // Elapsed ms since this server loaded its schedule cache (getScheduleAge).
  // This is not a provider update timestamp or a claim of data freshness.
  updatedAt?: number | null;
}

export default function PageHeader({ eyebrow, icon: Icon, title, subtitle, action, className = "", updatedAt }: PageHeaderProps) {
  return (
    <div className={`flex flex-col items-start sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 mb-6 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">
            / {eyebrow}
          </p>
        )}
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2 mt-1 text-balance">
          {Icon && <Icon size={20} className="text-accent-amber shrink-0" aria-hidden="true" />}
          <span className="text-text-primary">{title}</span>
        </h1>
        {subtitle && <p className="text-sm text-text-secondary mt-1.5 text-pretty">{subtitle}</p>}
        {updatedAt !== undefined && updatedAt !== null && (
          <div className="mt-1.5"><UpdatedPill ageMs={updatedAt} meaning="cache" /></div>
        )}
      </div>
      {action && <div className="max-w-full min-w-0 sm:shrink-0">{action}</div>}
    </div>
  );
}
