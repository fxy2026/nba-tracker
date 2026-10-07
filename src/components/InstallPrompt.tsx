"use client";

import { useEffect, useRef, useState } from "react";
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

function wasRecentlyDismissed(dismissedAt: number): boolean {
  try {
    dismissedAt = Math.max(dismissedAt, parseInt(localStorage.getItem(DISMISSED_KEY) || "0", 10) || 0);
  } catch { /* Keep the in-memory dismissal when storage is unavailable. */ }
  return dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_TTL_MS;
}

function recordDismissal(): number {
  const dismissedAt = Date.now();
  try { localStorage.setItem(DISMISSED_KEY, String(dismissedAt)); } catch {}
  return dismissedAt;
}

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
  const dismissedAt = useRef(0);
  const installRequest = useRef<{ event: BeforeInstallPromptEvent; started: boolean } | null>(null);

  useEffect(() => {
    // Bail if previously dismissed within TTL
    if (wasRecentlyDismissed(dismissedAt.current)) return;

    // Bail if already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // iOS Safari — no beforeinstallprompt event ever fires; show manual hint
    if (isIosSafariNonStandalone()) {
      // Defer slightly so it doesn't pop on first paint
      const id = setTimeout(() => {
        if (wasRecentlyDismissed(dismissedAt.current)) return;
        setIosHint(true);
        setVisible(true);
      }, 2000);
      return () => clearTimeout(id);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      // The root layout survives SPA navigation, and browsers can fire this
      // event again after Close, Escape, or a dismissed native install dialog.
      if (wasRecentlyDismissed(dismissedAt.current)) return;
      const event = e as BeforeInstallPromptEvent;
      installRequest.current = { event, started: false };
      setDeferredPrompt(event);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      installRequest.current = null;
      setVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      installRequest.current = null;
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  // ESC dismisses — keep the prompt non-blocking but give keyboard users
  // an easy out. No focus trap: this is a corner toast, not a modal.
  // Must run before the early return below to satisfy rules-of-hooks.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        installRequest.current = null;
        dismissedAt.current = recordDismissal();
        setVisible(false);
        setDeferredPrompt(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible]);

  if (!visible || (!deferredPrompt && !iosHint)) return null;

  const onInstall = async () => {
    const request = installRequest.current;
    if (!request || request.event !== deferredPrompt || request.started) return;
    // Consume each browser event once, including clicks before React rerenders.
    request.started = true;
    try {
      await request.event.prompt();
      const choice = await request.event.userChoice;
      if (installRequest.current !== request) return;
      if (choice.outcome === "dismissed") {
        dismissedAt.current = recordDismissal();
      }
    } catch { /* ignore */ }
    // A newer event, dismissal, installation, or unmount owns the UI now.
    if (installRequest.current !== request) return;
    installRequest.current = null;
    setVisible(false);
    setDeferredPrompt(null);
  };

  const onDismiss = () => {
    installRequest.current = null;
    dismissedAt.current = recordDismissal();
    setVisible(false);
    setDeferredPrompt(null);
  };

  return (
    <div
      className="mobile-floating right-4 left-4 sm:left-auto sm:max-w-sm z-40 glass-tile shadow-xl border-accent/30 p-3 flex items-center gap-3"
      // The unlayered .glass-tile position:relative overrides Tailwind utilities.
      // Keep viewport anchoring explicit so left/right insets constrain its width.
      style={{ position: "fixed" }}
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
          type="button"
          onClick={onInstall}
          className="px-3 py-1.5 text-xs font-bold bg-accent-gradient text-white rounded-lg hover:opacity-90 transition-opacity shrink-0 cursor-pointer min-h-[44px] min-w-[44px]"
        >
          {isZh ? "安装" : "Install"}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={isZh ? "关闭" : "Dismiss"}
        className="p-1.5 text-text-secondary hover:text-text-primary transition-colors shrink-0 cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
