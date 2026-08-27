"use client";

import {
  Building2,
  ChartColumn,
  ContactRound,
  FileText,
  Package,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Serializable icon keys for Server → Client boundaries. */
export type EmptyStateIconName =
  | "chart-column"
  | "contact-round"
  | "building-2"
  | "file-text"
  | "package"
  | "wallet";

const ICONS: Record<EmptyStateIconName, LucideIcon> = {
  "chart-column": ChartColumn,
  "contact-round": ContactRound,
  "building-2": Building2,
  "file-text": FileText,
  package: Package,
  wallet: Wallet,
};

type EmptyStateProps = {
  iconName: EmptyStateIconName;
  title: string;
  description: string;
  /** Prefer for Server Components — serializable CTA. */
  actionHref?: string;
  actionLabel?: string;
  /** Client-only composition (modals, local handlers). */
  action?: ReactNode;
};

export function EmptyState({
  iconName,
  title,
  description,
  actionHref,
  actionLabel,
  action,
}: EmptyStateProps) {
  const Icon = ICONS[iconName] ?? FileText;

  const resolvedAction =
    action ??
    (actionHref && actionLabel ? (
      <Link
        href={actionHref}
        className="inline-flex rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background"
      >
        {actionLabel}
      </Link>
    ) : null);

  return (
    <div className="erp-panel flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-accent/70 shadow-inner">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {resolvedAction ? <div className="mt-5">{resolvedAction}</div> : null}
    </div>
  );
}
