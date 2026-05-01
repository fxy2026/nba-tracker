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
    <div className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mb-6">
        <AlertTriangle size={32} className="text-danger" />
      </div>
      <h2 className="text-2xl font-bold mb-2">{t.errors.pageError}</h2>
      <p className="text-text-secondary mb-6 max-w-md">
        {t.errors.pageErrorDesc}
      </p>
      {error.digest && (
        <p className="text-[10px] text-text-secondary/50 mb-4 font-mono">{t.errors.errorId}{error.digest}</p>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={() => unstable_retry()}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors touch-target"
        >
          <RotateCcw size={16} />
          {t.common.retry}
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 bg-bg-card border border-border text-text-primary rounded-lg hover:bg-bg-hover transition-colors font-medium touch-target"
        >
          <Home size={16} />
          {t.common.home}
        </Link>
      </div>
    </div>
  );
}
