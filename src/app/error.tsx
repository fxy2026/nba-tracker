"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mb-6">
        <AlertTriangle size={32} className="text-danger" />
      </div>
      <h2 className="text-2xl font-bold mb-2">出错了</h2>
      <p className="text-text-secondary mb-6 max-w-md">
        页面加载时出现问题，请稍后重试。
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => unstable_retry()}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors"
        >
          <RotateCcw size={16} />
          重试
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 bg-bg-card border border-border text-text-primary rounded-lg hover:bg-bg-hover transition-colors font-medium"
        >
          <Home size={16} />
          首页
        </Link>
      </div>
    </div>
  );
}
