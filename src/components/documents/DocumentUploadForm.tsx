"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DocumentUploadModal } from "@/components/documents/DocumentUploadModal";
import type { DocumentEntityType } from "@/lib/documents/types";

type DocumentUploadFormProps = {
  entityType: DocumentEntityType | string;
  entityId: string;
  businessCaseId?: string | null;
  contractId?: string | null;
  shipmentId?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  companyId?: string | null;
  counterpartyId?: string | null;
  productId?: string | null;
  onUploaded?: () => void;
  compact?: boolean;
};

/** Thin trigger for the upload modal (kept for compatibility). */
export function DocumentUploadForm({
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
  onUploaded,
}: DocumentUploadFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background"
      >
        <Upload className="h-3.5 w-3.5" />
        Upload Document
      </button>
      <DocumentUploadModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => {
          onUploaded?.();
          startTransition(() => router.refresh());
        }}
        mode="upload"
        entityType={entityType}
        entityId={entityId}
        businessCaseId={businessCaseId}
        contractId={contractId}
        shipmentId={shipmentId}
        invoiceId={invoiceId}
        paymentId={paymentId}
        companyId={companyId}
        counterpartyId={counterpartyId}
        productId={productId}
      />
    </>
  );
}
