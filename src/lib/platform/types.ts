export const ENTITY_TYPES = [
  "business_case",
  "contract",
  "shipment",
  "warehouse_lot",
  "warehouse",
  "invoice",
  "payment",
  "company",
  "counterparty",
  "product",
  "document",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_TABS = [
  "overview",
  "timeline",
  "documents",
  "financials",
  "linked",
  "activity",
] as const;

export type EntityTabId = (typeof ENTITY_TABS)[number];

export type EntityTab = {
  id: EntityTabId;
  label: string;
};

export const STANDARD_ENTITY_TABS: EntityTab[] = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline" },
  { id: "documents", label: "Documents" },
  { id: "financials", label: "Financials" },
  { id: "linked", label: "Linked Records" },
  { id: "activity", label: "Activity" },
];

export type RoleCode =
  | "admin"
  | "finance"
  | "sales"
  | "logistics"
  | "warehouse"
  | "management"
  | "readonly";

export const ROLE_CODES: RoleCode[] = [
  "admin",
  "finance",
  "sales",
  "logistics",
  "warehouse",
  "management",
  "readonly",
];
