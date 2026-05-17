"use client";

import { useState, memo } from "react";
import { Share2, Check } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

interface ShareButtonProps {
  text: string;
}

export default memo(function ShareButton({ text }: ShareButtonProps) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // User cancelled or error — fall through to clipboard
        await copyToClipboard();
      }
    } else {
      await copyToClipboard();
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <button
      onClick={handleShare}
      className="p-1.5 rounded-lg text-text-secondary hover:text-accent transition-colors relative inline-flex items-center justify-center min-h-[44px] min-w-[44px]"
      title={t.share.shareGame}
      aria-label={t.share.shareGame}
    >
      {copied ? (
        <Check size={16} className="text-success" />
      ) : (
        <Share2 size={16} />
      )}
      {copied && (
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-success whitespace-nowrap">
          {t.share.copied}
        </span>
      )}
    </button>
  );
});
