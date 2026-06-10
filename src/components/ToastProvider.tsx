"use client";

import {
  createContext,
  use,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, AlertTriangle, Info, X } from "lucide-react";

type ToastTone = "success" | "info" | "warning";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = use(ToastContext);
  // Outside a provider (e.g. in tests or server snapshots), fall back to a
  // no-op so call sites don't have to guard.
  if (!ctx) return { toast: () => {} };
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, tone }]);
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext value={value}>
      {children}
      {toasts.length > 0 && createPortal(
        <div
          className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 pointer-events-none"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon =
    toast.tone === "success" ? Check
    : toast.tone === "warning" ? AlertTriangle
    : Info;
  const iconColor =
    toast.tone === "success" ? "text-success"
    : toast.tone === "warning" ? "text-accent-amber"
    : "text-accent";

  return (
    <div
      className="pointer-events-auto glass-tile px-4 py-2.5 flex items-center gap-2.5 shadow-xl animate-toast-in min-w-[200px] max-w-[360px]"
    >
      <Icon size={16} className={iconColor} aria-hidden="true" />
      <span className="text-sm text-text-primary flex-1">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="text-text-secondary/60 hover:text-text-primary transition-colors shrink-0 -mr-1"
        aria-label="Dismiss"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
