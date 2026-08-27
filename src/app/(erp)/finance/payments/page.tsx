import { Suspense } from "react";
import { PaymentsView } from "@/components/finance/PaymentsView";
import {
  getFinanceInvoices,
  getFinanceOptions,
  getFinancePayments,
} from "@/lib/finance/db";

export default async function FinancePaymentsPage() {
  const [paymentsResult, invoicesResult, options] = await Promise.all([
    getFinancePayments(),
    getFinanceInvoices(),
    getFinanceOptions(),
  ]);

  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted-foreground">Loading payments…</div>
      }
    >
      <PaymentsView
        payments={paymentsResult.data}
        invoices={invoicesResult.data ?? []}
        options={options}
        error={paymentsResult.error}
      />
    </Suspense>
  );
}
