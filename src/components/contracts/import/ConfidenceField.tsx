"use client";

import { AlertTriangle, Info } from "lucide-react";
import { useState } from "react";
import {
  confidenceLevel,
  type ExtractedField,
} from "@/lib/ai/contracts/schema";

type ConfidenceFieldProps = {
  label: string;
  field?: ExtractedField<unknown> | null;
  children: React.ReactNode;
  onFocusSource?: (page: number | null) => void;
};

export function ConfidenceField({
  label,
  field,
  children,
  onFocusSource,
}: ConfidenceFieldProps) {
  const [open, setOpen] = useState(false);
  const level = confidenceLevel(field);
  const indicatorClass =
    level === "high"
      ? "bg-emerald-500/20 text-emerald-300"
      : level === "medium"
        ? "bg-amber-500/20 text-amber-300"
        : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${indicatorClass}`}
          onClick={() => {
            setOpen((value) => !value);
            onFocusSource?.(field?.page_number ?? null);
          }}
          title="Show extraction confidence"
        >
          {level === "high" ? (
            <Info className="h-3 w-3" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          {level === "low" ? "review" : level}
        </button>
      </div>
      <div
        onFocusCapture={() => onFocusSource?.(field?.page_number ?? null)}
        onClick={() => onFocusSource?.(field?.page_number ?? null)}
      >
        {children}
      </div>
      {open && field ? (
        <div className="rounded-md border border-border bg-background/80 p-2 text-[11px] text-muted-foreground">
          <p>
            Confidence: {Math.round((field.confidence || 0) * 100)}%
            {field.page_number != null ? ` · Page ${field.page_number}` : ""}
          </p>
          {field.source_text ? (
            <p className="mt-1 text-foreground/80">“{field.source_text}”</p>
          ) : (
            <p className="mt-1">No source text captured.</p>
          )}
          {field.warning ? (
            <p className="mt-1 text-amber-300">{field.warning}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
