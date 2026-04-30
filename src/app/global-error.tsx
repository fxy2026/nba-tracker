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
      <body style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", padding: "0 1rem" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏀</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "8px" }}>发生了严重错误</h2>
          <p style={{ color: "#888", marginBottom: "24px" }}>应用出现了未预期的问题，请刷新页面重试。</p>
          <button
            onClick={() => unstable_retry()}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 20px", background: "#928CEE", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
          >
            <RotateCcw size={16} />
            重试
          </button>
          <br />
          <a href="/" style={{ display: "inline-block", marginTop: "12px", fontSize: "12px", color: "#888" }}>或返回首页</a>
        </div>
      </body>
    </html>
  );
}
