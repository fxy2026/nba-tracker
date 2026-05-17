import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

// Lightweight breadcrumb trail. Pass items in order from root to current
// page. The last item is rendered without a link and as the current page.
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav
      className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.15em] text-text-secondary mb-4 overflow-x-auto"
      aria-label="Breadcrumb"
    >
      <Link
        href="/"
        className="hover:text-accent transition-colors cursor-pointer flex items-center gap-1 shrink-0"
        aria-label="Home"
      >
        <Home size={11} aria-hidden="true" />
      </Link>
      {items.map((c, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex items-center gap-1.5 shrink-0">
            <ChevronRight size={11} className="text-text-secondary/40" aria-hidden="true" />
            {c.href && !isLast ? (
              <Link href={c.href} className="hover:text-accent transition-colors cursor-pointer truncate max-w-[160px]">
                {c.label}
              </Link>
            ) : (
              <span className="text-text-primary truncate max-w-[200px]" aria-current={isLast ? "page" : undefined}>
                {c.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
