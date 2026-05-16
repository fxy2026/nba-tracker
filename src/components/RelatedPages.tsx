import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

export interface RelatedPage {
  href: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
}

export default function RelatedPages({ pages, eyebrow = "Keep exploring" }: { pages: RelatedPage[]; eyebrow?: string }) {
  if (pages.length === 0) return null;
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center gap-3">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {eyebrow}</p>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {pages.map((p) => {
          const Icon = p.icon;
          return (
            <Link
              key={p.href}
              href={p.href}
              className="glass-tile p-3 flex items-center gap-3 group cursor-pointer"
            >
              {Icon && (
                <div className="shrink-0 w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Icon size={16} className="text-accent" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors truncate">{p.label}</p>
                {p.description && (
                  <p className="text-[10px] text-text-secondary leading-snug truncate">{p.description}</p>
                )}
              </div>
              <ArrowRight size={14} className="text-text-secondary group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
