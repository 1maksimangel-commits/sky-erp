"use client";

import {
  AlertCircle,
  Banknote,
  Building2,
  CircleDollarSign,
  Landmark,
  Receipt,
  TrendingUp,
  Wallet,
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

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="Total Revenue"
        value={formatMoney(stats?.totalRevenue ?? 0)}
        icon={<TrendingUp className="h-4 w-4" />}
      />
      <KpiCard
        title="Accounts Receivable"
        value={formatMoney(stats?.accountsReceivable ?? 0)}
        icon={<Receipt className="h-4 w-4" />}
      />
      <KpiCard
        title="Accounts Payable"
        value={formatMoney(stats?.accountsPayable ?? 0)}
        icon={<Building2 className="h-4 w-4" />}
      />
      <KpiCard
        title="Cash"
        value={formatMoney(stats?.cash ?? 0)}
        icon={<Wallet className="h-4 w-4" />}
      />
      <KpiCard
        title="Bank Balance"
        value={formatMoney(stats?.bankBalance ?? 0)}
        icon={<Landmark className="h-4 w-4" />}
      />
      <KpiCard
        title="Expenses"
        value={formatMoney(stats?.expenses ?? 0)}
        icon={<Banknote className="h-4 w-4" />}
      />
      <KpiCard
        title="Profit"
        value={formatMoney(stats?.profit ?? 0)}
        icon={<CircleDollarSign className="h-4 w-4" />}
      />
      <KpiCard
        title="Overdue Payments"
        value={String(stats?.overduePayments ?? 0)}
        icon={<AlertCircle className="h-4 w-4" />}
      />
    </div>
  );
}
