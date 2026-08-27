import { createClient } from "@/lib/supabase/server";
import { getBusinessCaseForContract } from "@/lib/contracts/relations";
import { getContractDocuments } from "@/lib/contracts/documents";
import { getContractFinance } from "@/lib/contracts/finance";
import { getShipmentsByContractId } from "@/lib/logistics/db";
import type { Contract } from "@/lib/contracts/db";

export type HistoryEventType =
  | "created"
  | "updated"
  | "status"
  | "payment"
  | "document"
  | "shipment";

export type HistoryEvent = {
  id: string;
  type: HistoryEventType;
  title: string;
  description: string | null;
  timestamp: string;
};

export type ContractHistoryResult =
  | { data: HistoryEvent[]; error: null }
  | { data: null; error: string };

type ContractMeta = Contract & {
  created_at?: string | null;
  updated_at?: string | null;
};

export async function getContractHistory(
  contract: ContractMeta
): Promise<ContractHistoryResult> {
  const supabase = await createClient();

  const { data: contractMeta, error: contractError } = await supabase
    .from("contracts")
    .select("created_at, updated_at, status")
    .eq("id", contract.id)
    .maybeSingle();

  if (contractError) {
    return { data: null, error: contractError.message };
  }

  const events: HistoryEvent[] = [];

  if (contractMeta?.created_at) {
    events.push({
      id: `contract-created-${contract.id}`,
      type: "created",
      title: "Contract created",
      description: contract.contract_number,
      timestamp: contractMeta.created_at,
    });
  }

  if (
    contractMeta?.updated_at &&
    contractMeta.updated_at !== contractMeta.created_at
  ) {
    events.push({
      id: `contract-updated-${contract.id}`,
      type: "updated",
      title: "Contract updated",
      description: contract.status ?? null,
      timestamp: contractMeta.updated_at,
    });
  }

  if (contractMeta?.status) {
    events.push({
      id: `contract-status-${contract.id}`,
      type: "status",
      title: "Current status",
      description: contractMeta.status,
      timestamp: contractMeta.updated_at ?? contractMeta.created_at ?? new Date().toISOString(),
    });
  }

  const [shipmentsResult, financeResult, documentsResult, businessCaseResult] =
    await Promise.all([
      getShipmentsByContractId(contract.id),
      getContractFinance(
        contract.id,
        contract.contract_number,
        contract.amount,
        contract.currency
      ),
      getContractDocuments(contract.contract_number, contract.id),
      getBusinessCaseForContract({
        contractId: contract.id,
        contractNumber: contract.contract_number,
      }),
    ]);

  if (shipmentsResult.error) {
    return { data: null, error: shipmentsResult.error };
  }

  if (financeResult.error) {
    return { data: null, error: financeResult.error };
  }

  if (documentsResult.error) {
    return { data: null, error: documentsResult.error };
  }

  if (businessCaseResult.error) {
    return { data: null, error: businessCaseResult.error };
  }

  for (const shipment of shipmentsResult.data ?? []) {
    events.push({
      id: `shipment-${shipment.id}`,
      type: "shipment",
      title: "Shipment recorded",
      description: [shipment.container, shipment.vessel, shipment.status]
        .filter(Boolean)
        .join(" · "),
      timestamp:
        shipment.created_at ?? shipment.updated_at ?? new Date().toISOString(),
    });
  }

  for (const payment of financeResult.payments ?? []) {
    events.push({
      id: `payment-${payment.id}`,
      type: "payment",
      title: "Payment registered",
      description: [payment.status, payment.amount, payment.currency]
        .filter((value) => value != null && value !== "")
        .join(" · "),
      timestamp:
        payment.payment_date ??
        payment.created_at ??
        new Date().toISOString(),
    });
  }

  for (const document of documentsResult.data ?? []) {
    events.push({
      id: `document-${document.id}`,
      type: "document",
      title: "Document uploaded",
      description: [document.document_type, document.title]
        .filter(Boolean)
        .join(" · "),
      timestamp: document.uploaded_at ?? new Date().toISOString(),
    });
  }

  if (businessCaseResult.data?.created_at) {
    events.push({
      id: `business-case-${businessCaseResult.data.id}`,
      type: "created",
      title: "Business case linked",
      description: businessCaseResult.data.case_number,
      timestamp: businessCaseResult.data.created_at,
    });
  }

  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return { data: events, error: null };
}
