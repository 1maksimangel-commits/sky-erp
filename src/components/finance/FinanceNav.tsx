"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs: { href: string; label: string; exact?: boolean }[] = [
  { href: "/finance", label: "Dashboard", exact: true },
  { href: "/finance/invoices", label: "Invoices" },
  { href: "/finance/payments", label: "Payments" },
  { href: "/finance/expenses", label: "Expenses" },
  { href: "/finance/commissions", label: "Commissions" },
  { href: "/finance/bank-accounts", label: "Bank Accounts" },
  { href: "/finance/exchange-rates", label: "Exchange Rates" },
  { href: "/finance/reports", label: "Reports" },
];

export function FinanceNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-1 border-b border-border pb-3">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
