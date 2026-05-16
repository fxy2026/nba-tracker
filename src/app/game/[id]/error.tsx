"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";

export default function GameError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12" role="alert">
      <Link href="/" className="text-[11px] font-mono uppercase tracking-[0.2em] text-text-secondary hover:text-accent transition-colors cursor-pointer">
        ← {t.common.backToGames}
      </Link>
      <div className="glass-tile mt-4 p-10 sm:p-12 text-center">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-3">/ Error</p>
        <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mb-5 mx-auto">
          <AlertTriangle size={26} className="text-danger" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-text-primary">{t.errors.gameLoadError}</h2>
        <p className="text-text-secondary text-sm max-w-sm mx-auto mt-2">{t.errors.gameLoadErrorDesc}</p>
        <div className="flex gap-3 justify-center mt-6">
          <button
            onClick={() => unstable_retry()}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-gradient text-white rounded-xl text-xs font-bold uppercase tracking-[0.15em] hover:opacity-90 transition-colors cursor-pointer shadow-lg shadow-accent/30"
          >
            <RotateCcw size={14} />
            {t.common.retry}
          </button>
          <Link href="/" className="chip cursor-pointer">
            <ArrowLeft size={14} />
            {t.common.backToHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
