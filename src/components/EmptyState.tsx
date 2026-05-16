import type { LucideIcon } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Optional CTA button */
  action?: { label: string; href?: string; onClick?: () => void };
  /** Eyebrow tag above the title (e.g., "/ 01" or "/ Empty") */
  eyebrow?: string;
  /** Tone: amber for opportunity / info, danger for error */
  tone?: "amber" | "danger" | "neutral";
  className?: string;
}

/**
 * Cohesive empty/error state used across pages.
 * Glass-tile + circular icon backdrop + helpful copy + optional CTA.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  eyebrow,
  tone = "amber",
  className = "",
}: EmptyStateProps) {
  const iconBg = tone === "danger" ? "bg-danger/10" : tone === "neutral" ? "bg-bg-hover" : "bg-accent-amber/10";
  const iconColor = tone === "danger" ? "text-danger" : tone === "neutral" ? "text-text-secondary" : "text-accent-amber";
  const eyebrowText = eyebrow ?? (tone === "danger" ? "/ Error" : "/ Empty");
  const isError = tone === "danger";

  return (
    <div
      className={`glass-tile p-8 sm:p-12 text-center ${className}`}
      role={isError ? "alert" : undefined}
    >
      <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-3">{eyebrowText}</p>
      <div className={`mx-auto w-16 h-16 rounded-2xl ${iconBg} flex items-center justify-center mb-4`}>
        <Icon size={26} className={iconColor} />
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-text-primary">{title}</h3>
      {description && (
        <p className="text-sm text-text-secondary mt-1.5 max-w-md mx-auto">{description}</p>
      )}
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-xl bg-accent-amber text-bg-primary text-xs font-bold uppercase tracking-[0.15em] hover:bg-accent-amber-hover transition-colors cursor-pointer"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-xl bg-accent-amber text-bg-primary text-xs font-bold uppercase tracking-[0.15em] hover:bg-accent-amber-hover transition-colors cursor-pointer"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
