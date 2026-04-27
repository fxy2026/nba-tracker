"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Calendar, BarChart3, Search, AlertTriangle } from "lucide-react";

const links = [
  { href: "/", label: "Today", icon: Trophy },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/search", label: "Search", icon: Search },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/injuries", label: "Injuries", icon: AlertTriangle },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-secondary/95 backdrop-blur-md border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
                active ? "text-accent" : "text-text-secondary"
              }`}
            >
              <Icon size={18} />
              <span className="text-[9px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
