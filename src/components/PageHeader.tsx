import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  eyebrow?: string;
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Consistent editorial page header used across all routes.
 * Eyebrow → Title (with optional icon) → Subtitle on the left;
 * Action slot on the right.
 */
export default function PageHeader({ eyebrow, icon: Icon, title, subtitle, action, className = "" }: PageHeaderProps) {
  return (
    <div className={`flex items-end justify-between gap-4 mb-6 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">
            / {eyebrow}
          </p>
        )}
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2 mt-1">
          {Icon && <Icon size={20} className="text-accent-amber shrink-0" />}
          <span className="text-text-primary">{title}</span>
        </h1>
        {subtitle && <p className="text-sm text-text-secondary mt-1.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
