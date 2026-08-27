import { notFound } from "next/navigation";
import { DetailGrid, DetailItem } from "@/components/platform/DetailGrid";
import { EntityWorkspace } from "@/components/platform/EntityWorkspace";
import { getFinancePaymentById } from "@/lib/finance/db";
import { formatFinanceDate, formatMoney } from "@/lib/finance/format";
import { getEntityWorkspaceBundle } from "@/lib/platform/entity-bundle";

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
        <DetailGrid>
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
        </DetailGrid>
      }
    />
  );
}
