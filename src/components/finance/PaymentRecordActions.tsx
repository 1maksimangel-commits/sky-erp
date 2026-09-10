"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { allocatePayment, setPaymentStatus } from "@/lib/finance/operational-actions";

export function PaymentRecordActions({ id, status, invoices, allocations }: {
  id: string; status: string | null;
  invoices: { id: string; invoice_number: string; currency: string | null; outstanding: number }[];
  allocations: { id: string; invoice_id: string; amount: number }[];
}) {
  const router = useRouter(), [error, setError] = useState("");
  async function change(next: "Paid" | "Cancelled") {
    const result = await setPaymentStatus(id, next);
    if (!result.success) setError(result.error); else router.refresh();
  }
  return <div className="space-y-3 rounded-md border border-border p-4">
    <p className="text-sm">Allocated payments settle an invoice only when the payment is Paid.</p>
    {allocations.map(a => <p key={a.id} className="text-sm">{invoices.find(i => i.id === a.invoice_id)?.invoice_number ?? a.invoice_id}: {a.amount}</p>)}
    {status !== "Cancelled" && <div className="flex gap-3">{status === "Pending" && <button className="underline" onClick={() => change("Paid")}>Mark posted</button>}<button className="underline" onClick={() => change("Cancelled")}>Cancel payment record</button></div>}
    {status !== "Cancelled" && <form className="flex flex-wrap gap-2" action={async form => {
      const result = await allocatePayment(id, String(form.get("invoice") ?? ""), Number(form.get("amount")));
      if (!result.success) setError(result.error); else router.refresh();
    }}>
      <select name="invoice" required className="rounded-md border border-border bg-background p-2"><option value="">Allocate to invoice</option>{invoices.filter(i => i.outstanding > 0).map(i => <option key={i.id} value={i.id}>{i.invoice_number} — {i.currency} {i.outstanding}</option>)}</select>
      <input name="amount" type="number" step="0.01" min="0.01" required placeholder="Amount" className="rounded-md border border-border bg-background p-2" />
      <button className="rounded-md border border-border px-3 py-2">Allocate</button>
    </form>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div>;
}
