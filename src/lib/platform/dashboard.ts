import { createClient } from "@/lib/supabase/server";
import { toNumber } from "@/lib/finance/format";

export type DashboardData = {
  todaysShipments: {
    id: string;
    label: string;
    status: string | null;
    etd: string | null;
  }[];
  upcomingEta: {
    id: string;
    label: string;
    eta: string | null;
    status: string | null;
  }[];
  overdueInvoices: {
    id: string;
    invoice_number: string;
    outstanding: number;
    currency: string | null;
    due_date: string | null;
  }[];
  pendingPayments: {
    id: string;
    invoice_number: string;
    outstanding: number;
    currency: string | null;
  }[];
  recentContracts: {
    id: string;
    contract_number: string;
    status: string | null;
    amount: number | null;
    currency: string | null;
  }[];
  warehouseAlerts: {
    id: string;
    label: string;
    available: number;
  }[];
  topCustomers: { id: string; label: string; revenue: number }[];
  monthlyRevenue: number;
  cashPosition: number;
  error: string | null;
};

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const monthStart = new Date();
  monthStart.setDate(1);

  const empty: DashboardData = {
    todaysShipments: [],
    upcomingEta: [],
    overdueInvoices: [],
    pendingPayments: [],
    recentContracts: [],
    warehouseAlerts: [],
    topCustomers: [],
    monthlyRevenue: 0,
    cashPosition: 0,
    error: null,
  };

  try {
    const [
      todaysShipments,
      upcomingEta,
      invoices,
      contracts,
      inventory,
      banks,
    ] = await Promise.all([
      supabase
        .from("shipments")
        .select("id, container, vessel, status, etd")
        .eq("etd", today)
        .limit(8),
      supabase
        .from("shipments")
        .select("id, container, vessel, status, eta")
        .gte("eta", today)
        .lte("eta", inSevenDays)
        .order("eta")
        .limit(8),
      supabase
        .from("invoices")
        .select(
          "id, invoice_number, outstanding, currency, due_date, status, invoice_type, amount, buyer_id, issue_date, buyer:buyer_id(legal_name)"
        )
        .limit(200),
      supabase
        .from("contracts")
        .select("id, contract_number, status, amount, currency")
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("inventory")
        .select(
          "id, available_quantity, product:product_id(name, sku), warehouse:warehouse_id(code)"
        )
        .lte("available_quantity", 10)
        .gt("available_quantity", 0)
        .limit(8),
      supabase
        .from("bank_accounts")
        .select("current_balance, is_active"),
    ]);

    const invoiceRows = invoices.data ?? [];
    const overdueInvoices = invoiceRows
      .filter((item) => {
        const outstanding = toNumber(item.outstanding);
        return (
          outstanding > 0 &&
          item.due_date &&
          item.due_date < today &&
          item.status !== "Cancelled" &&
          item.status !== "Paid"
        );
      })
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        invoice_number: item.invoice_number,
        outstanding: toNumber(item.outstanding),
        currency: item.currency,
        due_date: item.due_date,
      }));

    const pendingPayments = invoiceRows
      .filter(
        (item) =>
          toNumber(item.outstanding) > 0 &&
          item.status !== "Cancelled" &&
          item.status !== "Paid"
      )
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        invoice_number: item.invoice_number,
        outstanding: toNumber(item.outstanding),
        currency: item.currency,
      }));

    const monthlyRevenue = invoiceRows
      .filter((item) => {
        const type = item.invoice_type ?? "Sales Invoice";
        return (
          (type === "Sales Invoice" || type === "Proforma Invoice") &&
          item.status !== "Cancelled" &&
          item.issue_date &&
          item.issue_date >= monthStart.toISOString().slice(0, 10)
        );
      })
      .reduce((sum, item) => sum + toNumber(item.amount), 0);

    const customerMap = new Map<string, { label: string; revenue: number }>();
    for (const item of invoiceRows) {
      const type = item.invoice_type ?? "Sales Invoice";
      if (
        (type !== "Sales Invoice" && type !== "Proforma Invoice") ||
        item.status === "Cancelled" ||
        !item.buyer_id
      ) {
        continue;
      }
      const buyer = Array.isArray(item.buyer) ? item.buyer[0] : item.buyer;
      const current = customerMap.get(item.buyer_id) ?? {
        label: buyer?.legal_name ?? item.buyer_id,
        revenue: 0,
      };
      current.revenue += toNumber(item.amount);
      customerMap.set(item.buyer_id, current);
    }

    const topCustomers = [...customerMap.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const cashPosition = (banks.data ?? [])
      .filter((item) => item.is_active)
      .reduce((sum, item) => sum + toNumber(item.current_balance), 0);

    return {
      todaysShipments: (todaysShipments.data ?? []).map((item) => ({
        id: item.id,
        label: item.container || item.vessel || "Shipment",
        status: item.status,
        etd: item.etd,
      })),
      upcomingEta: (upcomingEta.data ?? []).map((item) => ({
        id: item.id,
        label: item.container || item.vessel || "Shipment",
        eta: item.eta,
        status: item.status,
      })),
      overdueInvoices,
      pendingPayments,
      recentContracts: (contracts.data ?? []).map((item) => ({
        id: item.id,
        contract_number: item.contract_number,
        status: item.status,
        amount: item.amount,
        currency: item.currency,
      })),
      warehouseAlerts: (inventory.data ?? []).map((item) => {
        const product = Array.isArray(item.product)
          ? item.product[0]
          : item.product;
        const warehouse = Array.isArray(item.warehouse)
          ? item.warehouse[0]
          : item.warehouse;
        return {
          id: item.id,
          label: `${product?.sku ?? "SKU"} · ${warehouse?.code ?? "WH"}`,
          available: toNumber(item.available_quantity),
        };
      }),
      topCustomers,
      monthlyRevenue,
      cashPosition,
      error:
        todaysShipments.error?.message ||
        invoices.error?.message ||
        contracts.error?.message ||
        null,
    };
  } catch (error) {
    return {
      ...empty,
      error: error instanceof Error ? error.message : "Unable to load dashboard.",
    };
  }
}
