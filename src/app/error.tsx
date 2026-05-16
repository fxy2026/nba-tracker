"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";

export default function ErrorPage({
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
    <div className="max-w-2xl mx-auto px-4 py-20" role="alert">
      <div className="glass-tile p-10 sm:p-12 text-center">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-3">/ Error</p>
        <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mb-5 mx-auto">
          <AlertTriangle size={26} className="text-danger" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary mb-2">{t.errors.pageError}</h2>
        <p className="text-text-secondary max-w-md mx-auto">{t.errors.pageErrorDesc}</p>
        {error.digest && (
          <p className="text-[10px] text-text-secondary/50 mt-3 font-mono uppercase tracking-[0.15em]">{t.errors.errorId} {error.digest}</p>
        )}
        <div className="flex items-center gap-3 justify-center mt-6">
          <button
            onClick={() => unstable_retry()}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-gradient text-white rounded-xl text-xs font-bold uppercase tracking-[0.15em] hover:opacity-90 transition-colors touch-target cursor-pointer shadow-lg shadow-accent/30"
          >
            <RotateCcw size={14} />
            {t.common.retry}
          </button>
          <Link
            href="/"
            className="chip cursor-pointer"
          >
            <Home size={14} />
            {t.common.home}
          </Link>
        </div>
      </div>
    </div>
  );
}
