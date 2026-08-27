import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailGrid, DetailItem } from "@/components/platform/DetailGrid";
import { EntityWorkspace } from "@/components/platform/EntityWorkspace";
import { getBusinessCaseById } from "@/lib/business-cases";
import { getBusinessCaseProfitResult } from "@/lib/finance/db";
import { formatMoney } from "@/lib/finance/format";
import { getEntityWorkspaceBundle } from "@/lib/platform/entity-bundle";

export default async function BusinessCaseDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const [{ data: businessCase, error }, bundle, profitResult] =
    await Promise.all([
      getBusinessCaseById(id),
      getEntityWorkspaceBundle("business_case", id),
      getBusinessCaseProfitResult(id),
    ]);

  if (error || !businessCase) {
    notFound();
  }

  const profit = profitResult.data;
  const currency = profit?.currency ?? businessCase.currency;

  return (
    <EntityWorkspace
      entityType="business_case"
      entityId={id}
      title={businessCase.case_number}
      subtitle={businessCase.title}
      status={businessCase.status}
      breadcrumbHref="/business-cases"
      breadcrumbLabel="Business Cases"
      timeline={bundle.timeline}
      activity={bundle.activity}
      documents={bundle.documents}
      documentUrls={bundle.documentUrls}
      linked={bundle.linked}
      businessCaseId={id}
      overview={
        <div className="space-y-4">
          <DetailGrid>
            <DetailItem label="Case Number" value={businessCase.case_number} />
            <DetailItem label="Type" value={businessCase.case_type} />
            <DetailItem label="Title" value={businessCase.title} />
            <DetailItem label="Status" value={businessCase.status} />
            <DetailItem label="Contract" value={businessCase.contract_number} />
            <DetailItem label="Company" value={businessCase.company?.name} />
            <DetailItem label="Buyer" value={businessCase.buyer?.legal_name} />
            <DetailItem
              label="Supplier"
              value={businessCase.supplier?.legal_name}
            />
            <DetailItem
              label="Contract Amount"
              value={formatMoney(
                businessCase.contract_amount,
                businessCase.currency
              )}
            />
            <DetailItem label="Incoterms" value={businessCase.incoterms} />
            <DetailItem
              label="Revenue (invoices)"
              value={formatMoney(profit?.revenue ?? 0, currency)}
            />
            <DetailItem
              label="Expenses"
              value={formatMoney(profit?.expenses ?? 0, currency)}
            />
            <DetailItem
              label="Profit result"
              value={formatMoney(profit?.profit ?? 0, currency)}
            />
            <DetailItem
              label="Invoices / Payments"
              value={`${profit?.invoiceCount ?? 0} / ${profit?.paymentCount ?? 0}`}
            />
          </DetailGrid>
          {profitResult.error ? (
            <p className="text-sm text-amber-300">{profitResult.error}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Profit = sales/credit invoice totals − posted expenses for this
              business case.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/contracts?new=1&business_case_id=${id}`}
              className="inline-flex items-center rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background hover:opacity-90"
            >
              Create Contract
            </Link>
            <Link
              href="/finance/reports"
              className="inline-flex items-center rounded-md border border-border px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent"
            >
              Finance reports
            </Link>
            <Link
              href="/logistics?new=1"
              className="inline-flex items-center rounded-md border border-border px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent"
            >
              Logistics
            </Link>
          </div>
        </div>
      }
    />
  );
}
