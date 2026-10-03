"use client";

import { useEffect, useRef, useState, memo } from "react";
import { Share2, Check } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { useToast } from "@/components/ToastProvider";

interface ShareButtonProps {
  text: string;
  subject?: "game" | "player" | "team" | "quiz";
}

export default memo(function ShareButton({ text, subject = "game" }: ShareButtonProps) {
  const { t } = useLocale();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const label = { game: t.share.shareGame, player: t.share.sharePlayer, team: t.share.shareTeam, quiz: t.share.shareQuiz }[subject];

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
    };
  }, []);

  const copyToClipboard = async () => {
    if (!mounted.current) return;
    try {
      await navigator.clipboard.writeText(text);
      if (!mounted.current) return;
      setCopied(true);
      toast(t.share.copied);
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => {
        copiedTimer.current = null;
        if (mounted.current) setCopied(false);
      }, 2000);
    } catch {
      // Clipboard access can be unavailable or denied; do not report success.
    }
  };

  const handleShare = async () => {
    // A ref also blocks repeated clicks before React commits disabled=true.
    if (inFlight.current || !mounted.current) return;
    inFlight.current = true;
    setSharing(true);
    try {
      if (navigator.share) {
        try {
          await navigator.share({ text });
          return;
        } catch (error) {
          // Dismissing the native share sheet must never change the clipboard.
          if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") return;
        }
      }
      await copyToClipboard();
    } finally {
      inFlight.current = false;
      if (mounted.current) setSharing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={sharing}
      aria-busy={sharing}
      className="p-1.5 rounded-lg text-text-secondary hover:text-accent transition-colors relative inline-flex items-center justify-center min-h-[44px] min-w-[44px]"
      title={label}
      aria-label={label}
    >
      {copied ? (
        <Check size={16} className="text-success" aria-hidden="true" />
      ) : (
        <Share2 size={16} aria-hidden="true" />
      )}
      {copied && (
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-success whitespace-nowrap">
          {t.share.copied}
        </span>
      )}
    </button>
  );
});
