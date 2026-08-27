import { Suspense } from "react";
import { InvoicesView } from "@/components/finance/InvoicesView";
import { getFinanceInvoices, getFinanceOptions } from "@/lib/finance/db";

export default async function FinanceInvoicesPage() {
  const [{ data, error }, options] = await Promise.all([
    getFinanceInvoices(),
    getFinanceOptions(),
  ]);

  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <InvoicesView invoices={data} error={error} options={options} />
    </Suspense>
  );
}
