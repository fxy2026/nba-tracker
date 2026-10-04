"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export default function SkipToContent({ children }: { children: ReactNode }) {
  return (
    <Link
      href="#main-content"
      prefetch={false}
      // Hash history belongs to Next, but keyboard focus must reach main even
      // when a framework scroll handler intentionally leaves focus unchanged.
      onNavigate={() => document.getElementById("main-content")?.focus({ preventScroll: true })}
      className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg"
    >
      {children}
    </Link>
  );
}
