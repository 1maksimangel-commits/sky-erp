import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailGrid, DetailItem } from "@/components/platform/DetailGrid";
import { EntityWorkspace } from "@/components/platform/EntityWorkspace";
import { getFinanceInvoiceById } from "@/lib/finance/db";
import { formatFinanceDate, formatMoney } from "@/lib/finance/format";
import { getEntityWorkspaceBundle } from "@/lib/platform/entity-bundle";

export default async function InvoiceDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const [{ data: invoice }, bundle] = await Promise.all([
    getFinanceInvoiceById(id),
    getEntityWorkspaceBundle("invoice", id),
  ]);

  if (!invoice) {
    notFound();
  }

  const canPay =
    invoice.outstanding > 0 &&
    invoice.status !== "Cancelled" &&
    invoice.status !== "Paid";

  return (
    <EntityWorkspace
      entityType="invoice"
      entityId={id}
      title={invoice.invoice_number}
      subtitle={invoice.invoice_type}
      status={invoice.status}
      breadcrumbHref="/finance/invoices"
      breadcrumbLabel="Invoices"
      timeline={bundle.timeline}
      activity={bundle.activity}
      documents={bundle.documents}
      documentUrls={bundle.documentUrls}
      linked={bundle.linked}
      invoiceId={id}
      contractId={invoice.contract_id}
      businessCaseId={invoice.business_case_id}
      overview={
        <div className="space-y-4">
          <DetailGrid>
            <DetailItem label="Invoice Number" value={invoice.invoice_number} />
            <DetailItem label="Type" value={invoice.invoice_type} />
            <DetailItem
              label="Business Case"
              value={invoice.business_case?.case_number}
            />
            <DetailItem
              label="Contract"
              value={invoice.contract?.contract_number}
            />
            <DetailItem label="Buyer" value={invoice.buyer?.legal_name} />
            <DetailItem label="Supplier" value={invoice.supplier?.legal_name} />
            <DetailItem
              label="Amount"
              value={formatMoney(invoice.amount, invoice.currency)}
            />
            <DetailItem
              label="Paid"
              value={formatMoney(invoice.paid_amount, invoice.currency)}
            />
            <DetailItem
              label="Balance"
              value={formatMoney(invoice.outstanding, invoice.currency)}
            />
            <DetailItem
              label="Due Date"
              value={formatFinanceDate(invoice.due_date)}
            />
            <DetailItem label="Status" value={invoice.status} />
          </DetailGrid>
          <div className="flex flex-wrap gap-2">
            {canPay ? (
              <Link
                href={`/finance/payments?new=1&invoice_id=${id}`}
                className="inline-flex items-center rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background hover:opacity-90"
              >
                Register Payment
              </Link>
            ) : null}
            {invoice.contract_id ? (
              <Link
                href={`/contracts/${invoice.contract_id}/finance`}
                className="inline-flex items-center rounded-md border border-border px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent"
              >
                Contract finance
              </Link>
            ) : null}
            {invoice.business_case_id ? (
              <Link
                href={`/business-cases/${invoice.business_case_id}`}
                className="inline-flex items-center rounded-md border border-border px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent"
              >
                Business case profit
              </Link>
            ) : null}
          </div>
        </div>
      }
    />
  );
}
