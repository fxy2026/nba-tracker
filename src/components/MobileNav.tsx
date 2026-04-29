"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Calendar, BarChart3, Heart, MoreHorizontal } from "lucide-react";
import { useState } from "react";

const mainLinks = [
  { href: "/", label: "Today", icon: Trophy },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/favorites", label: "Favorites", icon: Heart },
];

const moreLinks = [
  { href: "/standings", label: "Standings" },
  { href: "/injuries", label: "Injuries" },
  { href: "/transactions", label: "Transactions" },
  { href: "/clutch", label: "Playoff Leaders" },
  { href: "/compare", label: "Compare" },
  { href: "/h2h", label: "H2H" },
  { href: "/search", label: "Search" },
  { href: "/history", label: "History" },
  { href: "/schedule", label: "Schedule" },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = moreLinks.some(({ href }) => pathname === href);

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div className="sm:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute bottom-14 left-0 right-0 bg-bg-card border-t border-border rounded-t-2xl p-4 safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-8 h-1 bg-border rounded-full mx-auto mb-4" />
            <div className="grid grid-cols-3 gap-2">
              {moreLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={`relative px-3 py-2.5 rounded-lg text-center text-xs font-medium transition-colors ${
                    pathname === href ? "bg-accent/15 text-accent" : "bg-bg-hover text-text-secondary"
                  }`}
                >
                  {label}
                  {pathname === href && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent" />
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-secondary/95 backdrop-blur-md border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {mainLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                  active ? "text-accent" : "text-text-secondary"
                }`}
              >
                <Icon size={20} />
                <span className="text-[9px] font-medium">{label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              moreOpen || isMoreActive ? "text-accent" : "text-text-secondary"
            }`}
          >
            <MoreHorizontal size={20} />
            <span className="text-[9px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
