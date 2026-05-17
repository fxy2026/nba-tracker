"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

// Chrome / Edge / Android beforeinstallprompt event shape.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISSED_KEY = "nba-tracker-install-dismissed";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Detect iOS Safari — that browser never fires beforeinstallprompt, so we
// show a manual "Share → Add to Home Screen" hint instead. UA sniff is the
// only way; standalone-mode check confirms we're not already installed.
function isIosSafariNonStandalone(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  if (!iOS) return false;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  if (!isSafari) return false;
  // Already installed → don't show
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window.navigator as any).standalone === true) return false;
  return true;
}

export default function InstallPrompt() {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    // Bail if previously dismissed within TTL
    try {
      const dismissedAt = parseInt(localStorage.getItem(DISMISSED_KEY) || "0", 10);
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;
    } catch { /* localStorage may be disabled — proceed */ }

    // Bail if already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // iOS Safari — no beforeinstallprompt event ever fires; show manual hint
    if (isIosSafariNonStandalone()) {
      // Defer slightly so it doesn't pop on first paint
      const id = setTimeout(() => { setIosHint(true); setVisible(true); }, 2000);
      return () => clearTimeout(id);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  if (!visible || (!deferredPrompt && !iosHint)) return null;

  const onInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "dismissed") {
        try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
      }
    } catch { /* ignore */ }
    setVisible(false);
    setDeferredPrompt(null);
  };

  const onDismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
    setVisible(false);
  };

  return (
    <div
      className="fixed bottom-20 sm:bottom-6 right-4 left-4 sm:left-auto sm:max-w-sm z-40 glass-tile shadow-xl border-accent/30 p-3 flex items-center gap-3"
      role="dialog"
      aria-label={isZh ? "安装 NBA Tracker 应用" : "Install NBA Tracker app"}
    >
      <div className="shrink-0 w-10 h-10 rounded-xl bg-accent-gradient flex items-center justify-center">
        <Download size={18} className="text-white" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary">
          {iosHint
            ? (isZh ? "添加到主屏" : "Add to Home Screen")
            : (isZh ? "安装到主屏" : "Install app")}
        </p>
        <p className="text-[11px] text-text-secondary leading-tight">
          {iosHint
            ? (isZh ? "点击 Safari 分享按钮 → 添加到主屏幕" : "Tap Safari Share button → Add to Home Screen")
            : (isZh ? "更快启动 · 全屏体验 · 主屏图标" : "Faster launches · full-screen experience")}
        </p>
      </div>
      {!iosHint && (
        <button
          onClick={onInstall}
          className="px-3 py-1.5 text-xs font-bold bg-accent-gradient text-white rounded-lg hover:opacity-90 transition-opacity shrink-0 cursor-pointer min-h-[44px]"
        >
          {isZh ? "安装" : "Install"}
        </button>
      )}
      <button
        onClick={onDismiss}
        aria-label={isZh ? "关闭" : "Dismiss"}
        className="p-1.5 text-text-secondary hover:text-text-primary transition-colors shrink-0 cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
