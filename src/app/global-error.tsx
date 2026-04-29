"use client";

import { RotateCcw } from "lucide-react";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-bg text-text-primary flex items-center justify-center">
        <div className="text-center px-4">
          <h2 className="text-2xl font-bold mb-4">发生了严重错误</h2>
          <p className="text-text-secondary mb-6">应用出现了未预期的问题。</p>
          <button
            onClick={() => unstable_retry()}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors"
          >
            <RotateCcw size={16} />
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
