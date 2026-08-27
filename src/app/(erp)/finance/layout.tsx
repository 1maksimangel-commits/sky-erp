import { FinanceNav } from "@/components/finance/FinanceNav";

export default function FinanceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Invoices, payments, banks, FX, and financial reporting across the trading cycle.
        </p>
      </div>
      <FinanceNav />
      {children}
    </div>
  );
}
