export type ContractWorkspaceTabId =
  | "overview"
  | "business-case"
  | "logistics"
  | "warehouse"
  | "finance"
  | "documents"
  | "history";

export type ContractWorkspaceTab = {
  id: ContractWorkspaceTabId;
  label: string;
  segment: string;
  description: string;
};

export const CONTRACT_WORKSPACE_TABS: ContractWorkspaceTab[] = [
  {
    id: "overview",
    label: "Overview",
    segment: "",
    description: "Contract header and commercial summary",
  },
  {
    id: "business-case",
    label: "Business Case",
    segment: "business-case",
    description: "Deal pipeline and commercial case linked to this contract",
  },
  {
    id: "logistics",
    label: "Logistics",
    segment: "logistics",
    description: "Shipments and delivery tracking",
  },
  {
    id: "warehouse",
    label: "Warehouse",
    segment: "warehouse",
    description: "Product allocation and fulfillment status",
  },
  {
    id: "finance",
    label: "Finance",
    segment: "finance",
    description: "Invoices, payments, and settlement",
  },
  {
    id: "documents",
    label: "Documents",
    segment: "documents",
    description: "Contracts, certificates, and supporting files",
  },
  {
    id: "history",
    label: "History",
    segment: "history",
    description: "Audit timeline of contract activity",
  },
];

export function getContractTabHref(
  contractId: string,
  tab: ContractWorkspaceTab
): string {
  if (!tab.segment) {
    return `/contracts/${contractId}`;
  }

  return `/contracts/${contractId}/${tab.segment}`;
}

export function getActiveContractTab(pathname: string): ContractWorkspaceTabId {
  if (pathname.endsWith("/business-case")) return "business-case";
  if (pathname.endsWith("/logistics")) return "logistics";
  if (pathname.endsWith("/warehouse")) return "warehouse";
  if (pathname.endsWith("/finance")) return "finance";
  if (pathname.endsWith("/documents")) return "documents";
  if (pathname.endsWith("/history")) return "history";
  return "overview";
}
