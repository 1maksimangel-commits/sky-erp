import { createClient } from "@/lib/supabase/server";

export type Invoice = {
  id: string;
  contract_id: string;
  invoice_number: string;
  amount: number | null;
  currency: string | null;
  status: string | null;
  due_date: string | null;
  paid_amount: number | null;
  outstanding: number | null;
  created_at: string | null;
};

export type Payment = {
  id: string;
  business_case_id: string | null;
  invoice_id: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  payment_date: string | null;
  notes: string | null;
  created_at: string | null;
};

export type ContractFinanceSummary = {
  contractAmount: number;
  paid: number;
  remaining: number;
  currency: string;
  invoiceCount: number;
  paymentCount: number;
  outstanding: number;
};

export type ContractFinanceResult =
  | {
      summary: ContractFinanceSummary;
      invoices: Invoice[];
      payments: Payment[];
      error: null;
    }
  | {
      summary: null;
      invoices: null;
      payments: null;
      error: string;
    };

export async function getContractFinance(
  contractId: string,
  _contractNumber: string,
  contractAmount: number | null,
  currency: string | null
): Promise<ContractFinanceResult> {
  const db = await createClient();
  const invoicesResult = await db.from("invoices")
    .select("id,contract_id,invoice_number,amount,currency,status,due_date,paid_amount,outstanding,created_at")
    .eq("contract_id", contractId).order("created_at", { ascending: false });
  const fail = (error: string): ContractFinanceResult => ({ summary: null, invoices: null, payments: null, error });
  if (invoicesResult.error) return fail(invoicesResult.error.message);
  const invoices = invoicesResult.data ?? [];
  const invoiceIds = invoices.map(row => row.id);
  const allocations = invoiceIds.length
    ? await db.from("payment_allocations").select("payment_id").in("invoice_id", invoiceIds)
    : { data: [], error: null };
  if (allocations.error) return fail(allocations.error.message);
  const paymentIds = [...new Set((allocations.data ?? []).map(row => row.payment_id))];
  // An allocation to another Contract does not attach every Deal payment here.
  const paymentsResult = await db.from("payments")
    .select("id,business_case_id,invoice_id,amount,currency,status,payment_date,notes,created_at")
    .or(`contract_id.eq.${contractId}${invoiceIds.length ? `,invoice_id.in.(${invoiceIds.join(",")})` : ""}${paymentIds.length ? `,id.in.(${paymentIds.join(",")})` : ""}`)
    .order("payment_date", { ascending: false, nullsFirst: false });
  if (paymentsResult.error) return fail(paymentsResult.error.message);
  const originalCurrency = currency ?? "USD";
  // Summary is explicitly in the Contract currency; individual rows retain all
  // original currencies. Settled allocation balances are the source of truth.
  const matching = invoices.filter(row => row.currency === originalCurrency && row.status !== "Cancelled");
  const paid = matching.reduce((sum, row) => sum + Number(row.paid_amount ?? 0), 0);
  const outstanding = matching.reduce((sum, row) => sum + Number(row.outstanding ?? 0), 0);
  const amount = contractAmount ?? 0;
  return {
    summary: { contractAmount: amount, paid, remaining: Math.max(amount - paid, 0),
      currency: originalCurrency, invoiceCount: invoices.length,
      paymentCount: paymentsResult.data?.length ?? 0, outstanding },
    invoices, payments: paymentsResult.data ?? [], error: null,
  };
}
