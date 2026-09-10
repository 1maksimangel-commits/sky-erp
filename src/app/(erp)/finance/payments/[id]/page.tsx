import { notFound } from "next/navigation";
import { DetailGrid, DetailItem } from "@/components/platform/DetailGrid";
import { EntityWorkspace } from "@/components/platform/EntityWorkspace";
import { getFinancePaymentById, getFinanceInvoices } from "@/lib/finance/db";
import { createClient } from "@/lib/supabase/server";
import { PaymentRecordActions } from "@/components/finance/PaymentRecordActions";
import { formatFinanceDate, formatMoney } from "@/lib/finance/format";
import { getEntityWorkspaceBundle } from "@/lib/platform/entity-bundle";
import { getAccessContext } from "@/lib/platform/permissions";

export default async function PaymentDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const [{ data: payment }, bundle] = await Promise.all([
    getFinancePaymentById(id),
    getEntityWorkspaceBundle("payment", id),
  ]);

  if (!payment) {
    notFound();
  }
  const db = await createClient();
  const context = await getAccessContext();
  const [invoices, allocations] = await Promise.all([getFinanceInvoices(), db.from("payment_allocations").select("id,invoice_id,amount").eq("payment_id", id)]);
  if (allocations.error || invoices.error) throw new Error(allocations.error?.message ?? invoices.error ?? "Unable to load allocations");

  return (
    <EntityWorkspace
      entityType="payment"
      entityId={id}
      title={formatMoney(payment.amount, payment.currency)}
      subtitle={payment.reference || payment.invoice?.invoice_number}
      status={payment.status}
      breadcrumbHref="/finance/payments"
      breadcrumbLabel="Payments"
      timeline={bundle.timeline}
      activity={bundle.activity}
      documents={bundle.documents}
      documentUrls={bundle.documentUrls}
      linked={bundle.linked}
      paymentId={id}
      overview={
        <div className="space-y-4"><PaymentRecordActions id={id} status={payment.status} invoices={invoices.data ?? []} allocations={allocations.data ?? []} /><DetailGrid>
          <DetailItem label="Company perspective" value={context?.companyId && payment.payer_company_id === context.companyId ? "Outgoing" : context?.companyId && payment.payee_company_id === context.companyId ? "Incoming" : "Select an internal company perspective"} />
          <DetailItem
            label="Date"
            value={formatFinanceDate(payment.payment_date)}
          />
          <DetailItem
            label="Invoice"
            value={payment.invoice?.invoice_number}
          />
          <DetailItem
            label="Business Case"
            value={payment.business_case?.case_number}
          />
          <DetailItem
            label="Contract"
            value={payment.contract?.contract_number}
          />
          <DetailItem label="Bank" value={payment.bank_account?.name} />
          <DetailItem
            label="Amount"
            value={formatMoney(payment.amount, payment.currency)}
          />
          <DetailItem label="Reference" value={payment.reference} />
          <DetailItem label="Status" value={payment.status} />
          <DetailItem label="Notes" value={payment.notes} />
        </DetailGrid></div>
      }
    />
  );
}
