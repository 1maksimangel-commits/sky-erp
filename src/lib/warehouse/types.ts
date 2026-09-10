export const WAREHOUSE_OPERATION_TYPES = [
  "receive",
  "issue",
  "transfer",
  "adjust",
] as const;

export type WarehouseOperationType = (typeof WAREHOUSE_OPERATION_TYPES)[number];

export const LOT_STATUSES = [
  "Available",
  "Reserved",
  "Quarantine",
  "Expired",
  "Depleted",
] as const;

export type ReceiveInventoryInput = {
  company_id?: string | null;
  warehouse_id: string;
  product_id: string;
  quantity: number;
  lot_number: string;
  production_date: string | null;
  expiry_date: string | null;
  reference: string | null;
  contract_id: string | null;
  shipment_id: string | null;
  business_case_id: string | null;
};

export type IssueInventoryInput = {
  company_id?: string | null;
  warehouse_id: string;
  product_id: string;
  quantity: number;
  lot_number: string;
  reference: string | null;
  contract_id: string | null;
  shipment_id: string | null;
  business_case_id: string | null;
};

export type TransferInventoryInput = {
  company_id?: string | null;
  contract_id?: string | null;
  shipment_id?: string | null;
  business_case_id?: string | null;
  from_location: string;
  to_location: string;
  product_id: string;
  quantity: number;
  lot_number: string;
  transfer_date: string | null;
  reference: string | null;
};

export type AdjustInventoryInput = {
  company_id?: string | null;
  contract_id?: string | null;
  shipment_id?: string | null;
  business_case_id?: string | null;
  warehouse_id: string;
  product_id: string;
  quantity: number;
  lot_number: string;
  reason: string | null;
  production_date: string | null;
  expiry_date: string | null;
};

export const LOW_STOCK_THRESHOLD = 10;
