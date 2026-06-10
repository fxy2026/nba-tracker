"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Calendar, BarChart3, Search, MoreHorizontal, Newspaper } from "lucide-react";
import { useState, useMemo } from "react";
import { useLocale } from "@/components/LocaleProvider";
import CommandPalette from "@/components/CommandPalette";
import { useMoreGroups } from "@/lib/useMoreGroups";

export default function MobileNav() {
  const pathname = usePathname();
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const [moreOpen, setMoreOpen] = useState(false);

  // /news label is an inline ternary: t.nav has no "news" key and locales are
  // a shared file this component must not edit.
  const mainLinks = useMemo(() => [
    { href: "/", label: t.nav.today, icon: Trophy },
    { href: "/calendar", label: t.nav.calendar, icon: Calendar },
    { href: "/stats", label: t.nav.stats, icon: BarChart3 },
    { href: "/news", label: isZh ? "资讯" : "News", icon: Newspaper },
    { href: "/search", label: t.nav.search, icon: Search },
  ], [t, isZh]);

  // Reuse the SAME nav groups + CommandPalette as desktop. Previously mobile
  // had its own bottom-sheet implementation with hardcoded English labels and
  // a max-height bug that hid items behind the top Navbar. Unified now —
  // mobile gets focus trap, search, bilingual labels, keyboard nav for free.
  const moreGroups = useMoreGroups();
  const allMoreHrefs = useMemo(() => moreGroups.flatMap((g) => g.items.map((i) => i.href)), [moreGroups]);
  const isMoreActive = allMoreHrefs.some((href) => pathname === href);

  return (
    <>
      {/* Bottom nav bar */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-secondary/95 border-t border-border safe-area-bottom"
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-around h-14">
          {mainLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 min-w-[48px] min-h-[44px] justify-center px-2 py-1 rounded-lg transition-colors cursor-pointer relative ${
                  active ? "text-accent" : "text-text-secondary"
                }`}
              >
                {active && <span className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-accent rounded-full" />}
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span className={`text-[9px] ${active ? "font-bold" : "font-medium"}`}>{label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            aria-label={isZh ? "更多导航选项" : "More navigation options"}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={`flex flex-col items-center gap-0.5 min-w-[48px] min-h-[44px] justify-center px-2 py-1 rounded-lg transition-colors cursor-pointer relative ${
              moreOpen || isMoreActive ? "text-accent" : "text-text-secondary"
            }`}
          >
            {(moreOpen || isMoreActive) && <span className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-accent rounded-full" />}
            <MoreHorizontal size={20} strokeWidth={moreOpen || isMoreActive ? 2.5 : 2} />
            <span className={`text-[9px] ${moreOpen || isMoreActive ? "font-bold" : "font-medium"}`}>{t.nav.more}</span>
          </button>
        </div>
      </nav>

      {/* Same modal as desktop — centered, searchable, focus-trapped, fully translated */}
      <CommandPalette open={moreOpen} onClose={() => setMoreOpen(false)} groups={moreGroups} />
    </>
  );
}
