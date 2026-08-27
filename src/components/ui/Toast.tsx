"use client";

import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";

type ToastProps = {
  message: string;
  onClose: () => void;
  duration?: number;
  variant?: "success" | "error";
};

export function Toast({
  message,
  onClose,
  duration = 4000,
  variant = "success",
}: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-sm">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex w-full items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${
          variant === "error"
            ? "border-red-500/30 bg-card"
            : "border-border bg-card"
        }`}
      >
        {variant === "error" ? (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        )}
        <p className="flex-1 text-sm text-foreground">{message}</p>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onClose}
          className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
