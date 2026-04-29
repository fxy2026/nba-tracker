"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-20 sm:bottom-8 right-4 z-40 w-10 h-10 rounded-full bg-accent text-white shadow-lg flex items-center justify-center hover:bg-accent-hover transition-all"
      aria-label="Back to top"
    >
      <ChevronUp size={20} />
    </button>
  );
}
