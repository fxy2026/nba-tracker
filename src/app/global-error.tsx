"use client";

import { RotateCcw } from "lucide-react";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  // global-error renders outside LocaleProvider, so read cookie directly
  const isZh = typeof document !== "undefined" && document.cookie.includes("locale=zh");
  const retryText = isZh ? "重试" : "Retry";
  const errorTitle = isZh ? "发生了严重错误" : "A critical error occurred";
  const errorDesc = isZh ? "应用出现了未预期的问题，请刷新页面重试。" : "An unexpected error occurred. Please refresh and try again.";
  const backHome = isZh ? "或返回首页" : "or back to Home";

  return (
    <html lang={isZh ? "zh-CN" : "en"}>
      <body style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", padding: "0 1rem" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏀</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "8px" }}>{errorTitle}</h2>
          <p style={{ color: "#888", marginBottom: "24px" }}>{errorDesc}</p>
          <button
            onClick={() => unstable_retry()}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 20px", background: "#928CEE", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
          >
            <RotateCcw size={16} />
            {retryText}
          </button>
          <br />
          <a href="/" style={{ display: "inline-block", marginTop: "12px", fontSize: "12px", color: "#888" }}>{backHome}</a>
        </div>
      </body>
    </html>
  );
}
