import { createClient } from "@/lib/supabase/server";
import type { EntityType } from "@/lib/platform/types";

export type LinkedRecord = {
  id: string;
  type: string;
  label: string;
  href: string;
  meta?: string | null;
};

export async function getLinkedRecords(
  entityType: EntityType | string,
  entityId: string
): Promise<{ data: LinkedRecord[]; error: string | null }> {
  const supabase = await createClient();
  const links: LinkedRecord[] = [];

  try {
    if (entityType === "business_case") {
      const [contracts, shipments, invoices, payments] = await Promise.all([
        supabase
          .from("contracts")
          .select("id, contract_number, status")
          .eq("business_case_id", entityId),
        supabase
          .from("shipments")
          .select("id, container, vessel, status")
          .eq("business_case_id", entityId),
        supabase
          .from("invoices")
          .select("id, invoice_number, status, amount, currency")
          .eq("business_case_id", entityId),
        supabase
          .from("payments")
          .select("id, amount, currency, status, payment_date")
          .eq("business_case_id", entityId),
      ]);

      // Also soft-link by contract_number
      const { data: bc } = await supabase
        .from("business_cases")
        .select("contract_number")
        .eq("id", entityId)
        .maybeSingle();

      if (bc?.contract_number) {
        const { data: softContracts } = await supabase
          .from("contracts")
          .select("id, contract_number, status")
          .eq("contract_number", bc.contract_number);
        for (const item of softContracts ?? []) {
          if (!links.some((l) => l.id === item.id)) {
            links.push({
              id: item.id,
              type: "Contract",
              label: item.contract_number,
              href: `/contracts/${item.id}`,
              meta: item.status,
            });
          }
        }
      }

      for (const item of contracts.data ?? []) {
        links.push({
          id: item.id,
          type: "Contract",
          label: item.contract_number,
          href: `/contracts/${item.id}`,
          meta: item.status,
        });
      }
      for (const item of shipments.data ?? []) {
        links.push({
          id: item.id,
          type: "Shipment",
          label: item.container || item.vessel || item.id.slice(0, 8),
          href: `/logistics/${item.id}`,
          meta: item.status,
        });
      }
      for (const item of invoices.data ?? []) {
        links.push({
          id: item.id,
          type: "Invoice",
          label: item.invoice_number,
          href: `/finance/invoices/${item.id}`,
          meta: item.status,
        });
      }
      for (const item of payments.data ?? []) {
        links.push({
          id: item.id,
          type: "Payment",
          label: `${item.amount ?? 0} ${item.currency ?? ""}`.trim(),
          href: `/finance/payments/${item.id}`,
          meta: item.status,
        });
      }
    }

    if (entityType === "contract") {
      const { data: contract } = await supabase
        .from("contracts")
        .select("id, business_case_id, contract_number, buyer_id, supplier_id, company_id")
        .eq("id", entityId)
        .maybeSingle();

      if (contract?.business_case_id) {
        const { data: bc } = await supabase
          .from("business_cases")
          .select("id, case_number")
          .eq("id", contract.business_case_id)
          .maybeSingle();
        if (bc) {
          links.push({
            id: bc.id,
            type: "Business Case",
            label: bc.case_number,
            href: `/business-cases/${bc.id}`,
          });
        }
      }

      const [shipments, invoices] = await Promise.all([
        supabase
          .from("shipments")
          .select("id, container, vessel, status")
          .eq("contract_id", entityId),
        supabase
          .from("invoices")
          .select("id, invoice_number, status")
          .eq("contract_id", entityId),
      ]);

      for (const item of shipments.data ?? []) {
        links.push({
          id: item.id,
          type: "Shipment",
          label: item.container || item.vessel || "Shipment",
          href: `/logistics/${item.id}`,
          meta: item.status,
        });
      }
      for (const item of invoices.data ?? []) {
        links.push({
          id: item.id,
          type: "Invoice",
          label: item.invoice_number,
          href: `/finance/invoices/${item.id}`,
          meta: item.status,
        });
      }

      if (contract?.company_id) {
        links.push({
          id: contract.company_id,
          type: "Company",
          label: "Company",
          href: `/companies/${contract.company_id}`,
        });
      }
      if (contract?.buyer_id) {
        links.push({
          id: contract.buyer_id,
          type: "Buyer",
          label: "Buyer",
          href: `/counterparties/${contract.buyer_id}`,
        });
      }
      if (contract?.supplier_id) {
        links.push({
          id: contract.supplier_id,
          type: "Supplier",
          label: "Supplier",
          href: `/counterparties/${contract.supplier_id}`,
        });
      }
    }

    if (entityType === "shipment") {
      const { data: shipment } = await supabase
        .from("shipments")
        .select("id, contract_id, business_case_id")
        .eq("id", entityId)
        .maybeSingle();

      if (shipment?.contract_id) {
        links.push({
          id: shipment.contract_id,
          type: "Contract",
          label: "Contract",
          href: `/contracts/${shipment.contract_id}`,
        });
      }
      if (shipment?.business_case_id) {
        links.push({
          id: shipment.business_case_id,
          type: "Business Case",
          label: "Business Case",
          href: `/business-cases/${shipment.business_case_id}`,
        });
      }

      const { data: movements } = await supabase
        .from("stock_movements")
        .select("id, movement_type, quantity, lot_number, created_at")
        .eq("shipment_id", entityId)
        .limit(20);

      for (const item of movements ?? []) {
        links.push({
          id: item.id,
          type: "Stock Movement",
          label: `${item.movement_type} ${item.quantity}`,
          href: "/warehouse",
          meta: item.lot_number,
        });
      }

      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, status")
        .eq("shipment_id", entityId);

      for (const item of invoices ?? []) {
        links.push({
          id: item.id,
          type: "Invoice",
          label: item.invoice_number,
          href: `/finance/invoices/${item.id}`,
          meta: item.status,
        });
      }
    }

    if (entityType === "invoice") {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("id, contract_id, business_case_id, shipment_id")
        .eq("id", entityId)
        .maybeSingle();

      if (invoice?.contract_id) {
        links.push({
          id: invoice.contract_id,
          type: "Contract",
          label: "Contract",
          href: `/contracts/${invoice.contract_id}`,
        });
      }
      if (invoice?.business_case_id) {
        links.push({
          id: invoice.business_case_id,
          type: "Business Case",
          label: "Business Case",
          href: `/business-cases/${invoice.business_case_id}`,
        });
      }
      if (invoice?.shipment_id) {
        links.push({
          id: invoice.shipment_id,
          type: "Shipment",
          label: "Shipment",
          href: `/logistics/${invoice.shipment_id}`,
        });
      }

      const { data: payments } = await supabase
        .from("payments")
        .select("id, amount, currency, status, payment_date")
        .eq("invoice_id", entityId);

      for (const item of payments ?? []) {
        links.push({
          id: item.id,
          type: "Payment",
          label: `${item.amount ?? 0} ${item.currency ?? ""}`.trim(),
          href: `/finance/payments/${item.id}`,
          meta: item.status,
        });
      }
    }

    if (entityType === "payment") {
      const { data: payment } = await supabase
        .from("payments")
        .select("id, invoice_id, business_case_id, contract_id")
        .eq("id", entityId)
        .maybeSingle();

      if (payment?.invoice_id) {
        links.push({
          id: payment.invoice_id,
          type: "Invoice",
          label: "Invoice",
          href: `/finance/invoices/${payment.invoice_id}`,
        });
      }
      if (payment?.business_case_id) {
        links.push({
          id: payment.business_case_id,
          type: "Business Case",
          label: "Business Case",
          href: `/business-cases/${payment.business_case_id}`,
        });
      }
      if (payment?.contract_id) {
        links.push({
          id: payment.contract_id,
          type: "Contract",
          label: "Contract",
          href: `/contracts/${payment.contract_id}`,
        });
      }
    }

    if (entityType === "warehouse_lot") {
      const { data: lot } = await supabase
        .from("inventory_lots")
        .select("id, inventory_id, lot_number")
        .eq("id", entityId)
        .maybeSingle();

      if (lot?.inventory_id) {
        const { data: inventory } = await supabase
          .from("inventory")
          .select("id, product_id, warehouse_id")
          .eq("id", lot.inventory_id)
          .maybeSingle();

        if (inventory?.product_id) {
          links.push({
            id: inventory.product_id,
            type: "Product",
            label: "Product",
            href: `/products/${inventory.product_id}`,
          });
        }

        const { data: movements } = await supabase
          .from("stock_movements")
          .select("id, movement_type, quantity, shipment_id, created_at")
          .eq("lot_number", lot.lot_number)
          .limit(20);

        for (const item of movements ?? []) {
          links.push({
            id: item.id,
            type: "Stock Movement",
            label: `${item.movement_type} ${item.quantity}`,
            href: item.shipment_id
              ? `/logistics/${item.shipment_id}`
              : "/warehouse",
          });
        }
      }
    }

    if (entityType === "product") {
      const { data: inventory } = await supabase
        .from("inventory")
        .select("id, warehouse_id, quantity, available_quantity")
        .eq("product_id", entityId);

      for (const item of inventory ?? []) {
        links.push({
          id: item.id,
          type: "Inventory",
          label: `Qty ${item.quantity}`,
          href: "/warehouse",
          meta: `Available ${item.available_quantity}`,
        });
      }
    }

    if (entityType === "company" || entityType === "counterparty") {
      const field =
        entityType === "company"
          ? "company_id"
          : // buyer or supplier
            null;

      if (field) {
        const { data: contracts } = await supabase
          .from("contracts")
          .select("id, contract_number, status")
          .eq(field, entityId)
          .limit(20);
        for (const item of contracts ?? []) {
          links.push({
            id: item.id,
            type: "Contract",
            label: item.contract_number,
            href: `/contracts/${item.id}`,
            meta: item.status,
          });
        }
      } else {
        const [asBuyer, asSupplier] = await Promise.all([
          supabase
            .from("contracts")
            .select("id, contract_number, status")
            .eq("buyer_id", entityId)
            .limit(20),
          supabase
            .from("contracts")
            .select("id, contract_number, status")
            .eq("supplier_id", entityId)
            .limit(20),
        ]);
        for (const item of [...(asBuyer.data ?? []), ...(asSupplier.data ?? [])]) {
          if (!links.some((l) => l.id === item.id)) {
            links.push({
              id: item.id,
              type: "Contract",
              label: item.contract_number,
              href: `/contracts/${item.id}`,
              meta: item.status,
            });
          }
        }
      }
    }
  } catch (error) {
    return {
      data: links,
      error: error instanceof Error ? error.message : "Unable to load linked records.",
    };
  }

  return { data: links, error: null };
}
