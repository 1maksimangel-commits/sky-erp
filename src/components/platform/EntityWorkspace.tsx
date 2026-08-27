"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EntityActivityPanel } from "@/components/platform/EntityActivityPanel";
import { EntityDocumentsPanel } from "@/components/platform/EntityDocumentsPanel";
import { EntityFinancialsPanel } from "@/components/platform/EntityFinancialsPanel";
import { EntityLinkedPanel } from "@/components/platform/EntityLinkedPanel";
import { EntityTimelinePanel } from "@/components/platform/EntityTimelinePanel";
import type { ActivityEntry } from "@/lib/platform/activity-db";
import type { ErpDocument } from "@/lib/documents/types";
import type { LinkedRecord } from "@/lib/platform/linked";
import type { TimelineEvent } from "@/lib/platform/timeline-db";
import {
  STANDARD_ENTITY_TABS,
  type EntityTabId,
  type EntityType,
} from "@/lib/platform/types";

type EntityWorkspaceProps = {
  entityType: EntityType;
  entityId: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  breadcrumbHref: string;
  breadcrumbLabel: string;
  overview: React.ReactNode;
  financials?: React.ReactNode;
  timeline: TimelineEvent[];
  activity: ActivityEntry[];
  documents: ErpDocument[];
  documentUrls?: Record<string, string>;
  linked: LinkedRecord[];
  defaultTab?: EntityTabId;
  businessCaseId?: string | null;
  contractId?: string | null;
  shipmentId?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  companyId?: string | null;
  counterpartyId?: string | null;
  productId?: string | null;
};

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  return (
    <span className="inline-flex rounded-full bg-zinc-500/10 px-2 py-0.5 text-xs font-medium text-zinc-300 ring-1 ring-inset ring-zinc-500/20">
      {status}
    </span>
  );
}

export function EntityWorkspace({
  entityType,
  entityId,
  title,
  subtitle,
  status,
  breadcrumbHref,
  breadcrumbLabel,
  overview,
  financials,
  timeline,
  activity,
  documents,
  documentUrls = {},
  linked,
  defaultTab = "overview",
  businessCaseId,
  contractId,
  shipmentId,
  invoiceId,
  paymentId,
  companyId,
  counterpartyId,
  productId,
}: EntityWorkspaceProps) {
  const [tab, setTab] = useState<EntityTabId>(defaultTab);

  const content = useMemo(() => {
    switch (tab) {
      case "overview":
        return overview;
      case "timeline":
        return (
          <EntityTimelinePanel
            entityType={entityType}
            entityId={entityId}
            events={timeline}
          />
        );
      case "documents":
        return (
          <EntityDocumentsPanel
            entityType={entityType}
            entityId={entityId}
            documents={documents}
            urls={documentUrls}
            businessCaseId={businessCaseId}
            contractId={contractId}
            shipmentId={shipmentId}
            invoiceId={invoiceId}
            paymentId={paymentId}
            companyId={companyId}
            counterpartyId={counterpartyId}
            productId={productId}
          />
        );
      case "financials":
        return financials ?? (
          <EntityFinancialsPanel entityType={entityType} entityId={entityId} linked={linked} />
        );
      case "linked":
        return <EntityLinkedPanel records={linked} />;
      case "activity":
        return <EntityActivityPanel entries={activity} />;
      default:
        return overview;
    }
  }, [
    tab,
    overview,
    financials,
    timeline,
    documents,
    documentUrls,
    linked,
    activity,
    entityType,
    entityId,
    businessCaseId,
    contractId,
    shipmentId,
    invoiceId,
    paymentId,
    companyId,
    counterpartyId,
    productId,
  ]);

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm">
        <Link
          href={breadcrumbHref}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          {breadcrumbLabel}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono text-xs text-foreground">{title}</span>
      </nav>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-mono text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <StatusBadge status={status} />
        </div>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-3">
        {STANDARD_ENTITY_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === item.id
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {content}
    </div>
  );
}
