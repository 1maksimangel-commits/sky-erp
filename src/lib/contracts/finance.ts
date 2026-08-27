import { createClient } from "@/lib/supabase/server";
import { getBusinessCaseIdForContract } from "@/lib/contracts/relations";

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

function sumPaidPayments(payments: Payment[]): number {
  return payments.reduce((sum, payment) => {
    if (payment.status?.toLowerCase() === "paid" && payment.amount != null) {
      return sum + payment.amount;
    }

    return sum;
  }, 0);
}

export async function getContractFinance(
  contractId: string,
  contractNumber: string,
  contractAmount: number | null,
  currency: string | null
): Promise<ContractFinanceResult> {
  const supabase = await createClient();

  const [invoicesResult, businessCaseId] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, contract_id, invoice_number, amount, currency, status, due_date, paid_amount, outstanding, created_at"
      )
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false }),
    getBusinessCaseIdForContract(contractNumber, contractId),
  ]);

  if (invoicesResult.error) {
    return {
      summary: null,
      invoices: null,
      payments: null,
      error: invoicesResult.error.message,
    };
  }

  const invoices = (invoicesResult.data ?? []) as Invoice[];
  const invoiceIds = invoices.map((invoice) => invoice.id);
  const paymentById = new Map<string, Payment>();

  if (invoiceIds.length) {
    const { data, error } = await supabase
      .from("payments")
      .select(
        "id, business_case_id, invoice_id, amount, currency, status, payment_date, notes, created_at"
      )
      .in("invoice_id", invoiceIds)
      .order("payment_date", { ascending: false, nullsFirst: false });

    if (error) {
      return {
        summary: null,
        invoices: null,
        payments: null,
        error: error.message,
      };
    }

    for (const row of (data ?? []) as Payment[]) {
      paymentById.set(row.id, row);
    }
  }

  // Include legacy BC-linked payments that may lack invoice_id.
  if (businessCaseId) {
    const { data, error } = await supabase
      .from("payments")
      .select(
        "id, business_case_id, invoice_id, amount, currency, status, payment_date, notes, created_at"
      )
      .eq("business_case_id", businessCaseId)
      .order("payment_date", { ascending: false, nullsFirst: false });

    if (error) {
      // Column may be missing until K-03 migration — keep invoice-linked payments.
      if (!/business_case_id|42703|PGRST204/i.test(error.message)) {
        return {
          summary: null,
          invoices: null,
          payments: null,
          error: error.message,
        };
      }
    } else {
      for (const row of (data ?? []) as Payment[]) {
        if (!paymentById.has(row.id)) {
          paymentById.set(row.id, row);
        }
      }
    }
  }

  const payments = [...paymentById.values()];
  const amount = contractAmount ?? 0;
  const paidFromPayments = sumPaidPayments(payments);
  const paidFromInvoices = invoices.reduce(
    (sum, invoice) => sum + (invoice.paid_amount ?? 0),
    0
  );
  const paid = Math.max(paidFromPayments, paidFromInvoices);
  const outstandingFromInvoices = invoices.reduce(
    (sum, invoice) => sum + (invoice.outstanding ?? 0),
    0
  );

  return {
    summary: {
      contractAmount: amount,
      paid,
      remaining: Math.max(amount - paid, 0),
      currency: currency ?? "USD",
      invoiceCount: invoices.length,
      paymentCount: payments.length,
      outstanding: outstandingFromInvoices || Math.max(amount - paid, 0),
    },
    invoices,
    payments,
    error: null,
  };
}
