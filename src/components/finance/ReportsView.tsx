"use client";

import { AlertCircle } from "lucide-react";
import type { FinanceReportBundle } from "@/lib/finance/db";
import { formatMoney } from "@/lib/finance/format";

type ReportsViewProps = {
  reports: FinanceReportBundle | null;
  error: string | null;
};

function ReportTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {!rows.length ? (
        <div className="rounded-lg border border-card-border bg-card p-8 text-center text-sm text-muted-foreground">
          No data yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-card-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-accent/30">
                  {headers.map((header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-xs font-medium text-muted-foreground"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, index) => (
                  <tr key={index} className="hover:bg-accent/20">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-3">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

export function ReportsView({ reports, error }: ReportsViewProps) {
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!reports) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Legacy reports — unverified until the Deal economics phase. These read-only diagnostics are not the canonical financial position. Cash-flow and profit totals sum nominal amounts across
        currencies without FX conversion — treat multi-currency aggregates as
        indicative only.
      </div>

      <ReportTable
        title="Accounts Receivable"
        headers={["Invoice", "Buyer", "Currency", "Balance", "Status"]}
        rows={reports.accountsReceivable.map((item) => [
          item.invoice_number,
          item.buyer?.legal_name ?? "—",
          item.currency ?? "USD",
          formatMoney(item.outstanding, item.currency),
          item.status ?? "—",
        ])}
      />

      <ReportTable
        title="Accounts Payable"
        headers={["Invoice", "Supplier", "Currency", "Balance", "Status"]}
        rows={reports.accountsPayable.map((item) => [
          item.invoice_number,
          item.supplier?.legal_name ?? "—",
          item.currency ?? "USD",
          formatMoney(item.outstanding, item.currency),
          item.status ?? "—",
        ])}
      />

      <ReportTable
        title="Cash Flow"
        headers={["Month", "Inflow", "Outflow", "Net"]}
        rows={reports.cashFlow.map((item) => [
          item.label,
          formatMoney(item.inflow),
          formatMoney(item.outflow),
          formatMoney(item.net),
        ])}
      />

      <ReportTable
        title="Profit by Business Case"
        headers={["Business Case", "Revenue", "Expenses", "Profit"]}
        rows={reports.profitByBusinessCase.map((item) => [
          item.label,
          formatMoney(item.revenue),
          formatMoney(item.expenses),
          formatMoney(item.profit),
        ])}
      />

      <ReportTable
        title="Profit by Contract"
        headers={["Contract", "Revenue", "Expenses", "Profit"]}
        rows={reports.profitByContract.map((item) => [
          item.label,
          formatMoney(item.revenue),
          formatMoney(item.expenses),
          formatMoney(item.profit),
        ])}
      />

      <ReportTable
        title="Revenue by Customer"
        headers={["Customer", "Revenue"]}
        rows={reports.revenueByCustomer.map((item) => [
          item.label,
          formatMoney(item.revenue),
        ])}
      />

      <ReportTable
        title="Expenses by Supplier"
        headers={["Supplier", "Expenses"]}
        rows={reports.expensesBySupplier.map((item) => [
          item.label,
          formatMoney(item.expenses),
        ])}
      />
    </div>
  );
}
