"use client";

import {
  AlertCircle,
  Banknote,
  Building2,
  Landmark,
  Receipt,
} from "lucide-react";
import type { FinanceDashboardStats } from "@/lib/finance/db";
import { formatMoney } from "@/lib/finance/format";

type FinanceDashboardProps = {
  stats: FinanceDashboardStats | null;
  error: string | null;
};

function KpiCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-card-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <div className="rounded-md bg-accent p-2 text-muted-foreground">{icon}</div>
      </div>
    </div>
  );
}

export function FinanceDashboard({ stats, error }: FinanceDashboardProps) {
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <h3 className="text-sm font-medium text-red-300">
              Failed to load finance dashboard
            </h3>
            <p className="mt-1 text-sm text-red-400/90">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!stats?.companyId) return <p className="text-sm text-muted-foreground">Select an internal company in Settings to view its financial position.</p>;
  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">Selected company perspective. Original currencies are shown separately; no FX conversion or Deal profit is calculated.</p>
    {stats.unreviewedInvoices > 0 && <p className="text-sm text-muted-foreground">{stats.unreviewedInvoices} legacy invoice(s) require explicit party review before inclusion.</p>}
    {stats.currencies.map(row => <section key={row.currency} className="space-y-3">
      <h2 className="font-semibold">{row.currency}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Invoice amount" value={formatMoney(row.invoiceAmount,row.currency)} icon={<Receipt className="h-4 w-4" />} />
        <KpiCard title="Receivable" value={formatMoney(row.receivable,row.currency)} icon={<Receipt className="h-4 w-4" />} />
        <KpiCard title="Payable" value={formatMoney(row.payable,row.currency)} icon={<Building2 className="h-4 w-4" />} />
        <KpiCard title="Bank balance" value={formatMoney(row.bankBalance,row.currency)} icon={<Landmark className="h-4 w-4" />} />
        <KpiCard title="Posted expenses" value={formatMoney(row.expenses,row.currency)} icon={<Banknote className="h-4 w-4" />} />
      </div>
    </section>)}
  </div>;
}
