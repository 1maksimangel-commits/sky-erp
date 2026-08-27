"use server";

import { createClient } from "@/lib/supabase/server";
import { toNumber } from "@/lib/finance/format";
import { getDashboardData } from "@/lib/platform/dashboard";

export type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export async function askErpAssistant(
  prompt: string
): Promise<{ answer: string; error: string | null }> {
  const question = prompt.trim();
  if (!question) {
    return { answer: "", error: "Enter a question." };
  }

  const q = question.toLowerCase();
  const supabase = await createClient();

  try {
    if (includesAny(q, ["overdue invoice", "overdue invoices"])) {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("invoices")
        .select("invoice_number, outstanding, currency, due_date, status")
        .gt("outstanding", 0)
        .lt("due_date", today)
        .neq("status", "Cancelled")
        .order("due_date")
        .limit(15);

      if (!data?.length) {
        return { answer: "There are no overdue invoices right now.", error: null };
      }

      const lines = data.map(
        (item) =>
          `• ${item.invoice_number}: ${item.outstanding} ${item.currency ?? ""} due ${item.due_date} (${item.status})`
      );
      return {
        answer: `Found ${data.length} overdue invoice(s):\n${lines.join("\n")}`,
        error: null,
      };
    }

    if (includesAny(q, ["dalian haiqing", "haiqing"])) {
      const { data: parties } = await supabase
        .from("counterparties")
        .select("id, legal_name")
        .ilike("legal_name", "%HAIQING%");

      const partyIds = (parties ?? []).map((item) => item.id);
      if (!partyIds.length) {
        return {
          answer: "No counterparty matching DALIAN HAIQING was found.",
          error: null,
        };
      }

      const { data: contracts } = await supabase
        .from("contracts")
        .select("id, contract_number, status, amount, currency")
        .or(
          partyIds
            .flatMap((id) => [`buyer_id.eq.${id}`, `supplier_id.eq.${id}`])
            .join(",")
        )
        .limit(20);

      if (!contracts?.length) {
        return {
          answer: "Counterparties matched DALIAN HAIQING, but no linked contracts were found.",
          error: null,
        };
      }

      return {
        answer: `Contracts linked to DALIAN HAIQING:\n${contracts
          .map(
            (item) =>
              `• ${item.contract_number} — ${item.status ?? "—"} — ${item.amount ?? 0} ${item.currency ?? ""}`
          )
          .join("\n")}`,
        error: null,
      };
    }

    if (includesAny(q, ["arriving this week", "eta this week", "containers arriving"])) {
      const today = new Date().toISOString().slice(0, 10);
      const week = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const { data } = await supabase
        .from("shipments")
        .select("container, vessel, eta, status, port_of_destination")
        .gte("eta", today)
        .lte("eta", week)
        .order("eta");

      if (!data?.length) {
        return {
          answer: "No containers with ETA in the next 7 days.",
          error: null,
        };
      }

      return {
        answer: `Containers arriving this week:\n${data
          .map(
            (item) =>
              `• ${item.container || "N/A"} / ${item.vessel || "—"} ETA ${item.eta} → ${item.port_of_destination || "—"} (${item.status})`
          )
          .join("\n")}`,
        error: null,
      };
    }

    const profitMatch = q.match(/business case\s+([a-z0-9\-_/]+)/i);
    if (includesAny(q, ["profit"]) && (profitMatch || includesAny(q, ["bc-"]))) {
      const caseNumber =
        profitMatch?.[1]?.toUpperCase() ||
        question.match(/BC-[A-Z0-9\-_/]+/i)?.[0]?.toUpperCase();

      if (!caseNumber) {
        return {
          answer: "Specify a business case number, e.g. Calculate profit for Business Case BC-001.",
          error: null,
        };
      }

      const { data: bc } = await supabase
        .from("business_cases")
        .select("id, case_number, contract_amount, currency")
        .ilike("case_number", caseNumber)
        .maybeSingle();

      if (!bc) {
        return { answer: `Business case ${caseNumber} was not found.`, error: null };
      }

      const [invoices, expenses] = await Promise.all([
        supabase
          .from("invoices")
          .select("amount, invoice_type, status")
          .eq("business_case_id", bc.id),
        supabase
          .from("expenses")
          .select("amount, status")
          .eq("business_case_id", bc.id),
      ]);

      const revenue = (invoices.data ?? [])
        .filter((item) => item.status !== "Cancelled")
        .reduce((sum, item) => {
          const type = item.invoice_type ?? "Sales Invoice";
          const amount = toNumber(item.amount);
          if (type === "Credit Note") return sum - amount;
          if (type === "Purchase Invoice") return sum;
          return sum + amount;
        }, 0);

      const expenseTotal = (expenses.data ?? [])
        .filter((item) => item.status !== "Cancelled")
        .reduce((sum, item) => sum + toNumber(item.amount), 0);

      const contractAmount = toNumber(bc.contract_amount);
      const profit = (revenue || contractAmount) - expenseTotal;

      return {
        answer: `Profit summary for ${bc.case_number}:\n• Contract amount: ${contractAmount} ${bc.currency ?? "USD"}\n• Invoice revenue: ${revenue}\n• Expenses: ${expenseTotal}\n• Estimated profit: ${profit}`,
        error: null,
      };
    }

    if (includesAny(q, ["commercial offer", "offer"])) {
      const { data } = await supabase
        .from("products")
        .select("sku, name, sale_price, currency, size")
        .eq("is_active", true)
        .limit(5);

      return {
        answer: `Draft commercial offer lines:\n${(data ?? [])
          .map(
            (item) =>
              `• ${item.sku} — ${item.name} (${item.size || "std"}) @ ${item.sale_price ?? "TBD"} ${item.currency ?? "USD"}`
          )
          .join("\n")}\n\nNext step: open a Business Case and attach the selected products.`,
        error: null,
      };
    }

    if (includesAny(q, ["prepare invoice", "invoice from contract"])) {
      const { data } = await supabase
        .from("contracts")
        .select("id, contract_number, amount, currency, status")
        .neq("status", "Cancelled")
        .order("updated_at", { ascending: false })
        .limit(5);

      return {
        answer: `Ready to prepare invoices from recent contracts:\n${(data ?? [])
          .map(
            (item) =>
              `• ${item.contract_number} — ${item.amount ?? 0} ${item.currency ?? "USD"} (${item.status}) → /contracts/${item.id}/finance`
          )
          .join("\n")}\n\nOpen Finance → Create Invoice and select the contract.`,
        error: null,
      };
    }

    if (includesAny(q, ["today", "operations", "summarize"])) {
      const dashboard = await getDashboardData();
      return {
        answer: [
          "Today's operations summary:",
          `• Shipments with ETD today: ${dashboard.todaysShipments.length}`,
          `• Upcoming ETA (7 days): ${dashboard.upcomingEta.length}`,
          `• Overdue invoices: ${dashboard.overdueInvoices.length}`,
          `• Pending payments: ${dashboard.pendingPayments.length}`,
          `• Warehouse low-stock alerts: ${dashboard.warehouseAlerts.length}`,
          `• Monthly revenue: ${dashboard.monthlyRevenue}`,
          `• Cash position: ${dashboard.cashPosition}`,
        ].join("\n"),
        error: null,
      };
    }

    const dashboard = await getDashboardData();
    return {
      answer: [
        "I can query live ERP data. Try:",
        "• Show overdue invoices",
        "• Find contracts with DALIAN HAIQING",
        "• Show containers arriving this week",
        "• Calculate profit for Business Case BC-001",
        "• Generate commercial offer",
        "• Prepare invoice from contract",
        "• Summarize today's operations",
        "",
        `Current snapshot: ${dashboard.overdueInvoices.length} overdue invoices, ${dashboard.upcomingEta.length} upcoming ETAs, cash ${dashboard.cashPosition}.`,
      ].join("\n"),
      error: null,
    };
  } catch (error) {
    return {
      answer: "",
      error: error instanceof Error ? error.message : "AI query failed.",
    };
  }
}
