"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelInvoice } from "@/lib/finance/actions";
import type { FinanceOptionBundles } from "@/lib/finance/db";
import type { InvoiceFormInput } from "@/lib/finance/types";
import { InvoiceFormModal } from "./InvoiceFormModal";

export function InvoiceRecordActions({ id, initial, options, canCancel }: {
  id: string; initial: InvoiceFormInput; options: FinanceOptionBundles; canCancel: boolean;
}) {
  const [open, setOpen] = useState(false), [error, setError] = useState("");
  const router = useRouter();
  return <div className="flex flex-wrap gap-3">
    {initial.status === "Draft" && <button onClick={() => setOpen(true)} className="rounded-md border border-border px-3 py-2 text-sm">Edit Draft</button>}
    {canCancel && <button className="rounded-md border border-border px-3 py-2 text-sm" onClick={async () => {
      const result = await cancelInvoice(id); if (!result.success) setError(result.error); else router.refresh();
    }}>Cancel obligation</button>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <InvoiceFormModal invoiceId={id} initial={initial} options={options} open={open} onClose={() => setOpen(false)} onSaved={() => router.refresh()} />
  </div>;
}
