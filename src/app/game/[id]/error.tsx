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
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Link href="/" className="text-sm text-text-secondary hover:text-accent transition-colors">
        {t.common.backToGames}
      </Link>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center mb-5">
          <AlertTriangle size={28} className="text-danger" />
        </div>
        <h2 className="text-xl font-bold mb-2">{t.errors.gameLoadError}</h2>
        <p className="text-text-secondary mb-6 text-sm max-w-sm">
          {t.errors.gameLoadErrorDesc}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => unstable_retry()}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
          >
            <RotateCcw size={14} />
            {t.common.retry}
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 bg-bg-card border border-border text-text-primary rounded-lg text-sm font-medium hover:bg-bg-hover transition-colors"
          >
            <ArrowLeft size={14} />
            {t.common.backToHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
