export type RouteMeta = {
  title: string;
  description: string;
  breadcrumbs: { label: string; href?: string }[];
};

const routes: { match: RegExp; meta: (pathname: string) => RouteMeta }[] = [
  {
    match: /^\/dashboard\/?$/,
    meta: () => ({
      title: "Dashboard",
      description: "Operations snapshot across contracts, logistics, and finance.",
      breadcrumbs: [{ label: "Dashboard" }],
    }),
  },
  {
    match: /^\/crm\/[^/]+/,
    meta: () => ({
      title: "Customer",
      description: "CRM profile, contacts, tasks, and communication history.",
      breadcrumbs: [
        { label: "CRM", href: "/crm" },
        { label: "Customer" },
      ],
    }),
  },
  {
    match: /^\/crm\/?$/,
    meta: () => ({
      title: "CRM",
      description: "Customers, prospects, suppliers, and follow-ups.",
      breadcrumbs: [{ label: "CRM" }],
    }),
  },
  {
    match: /^\/companies\/[^/]+/,
    meta: () => ({
      title: "Company",
      description: "Legal entity details, documents, and linked activity.",
      breadcrumbs: [
        { label: "Companies", href: "/companies" },
        { label: "Detail" },
      ],
    }),
  },
  {
    match: /^\/companies\/?$/,
    meta: () => ({
      title: "Companies",
      description: "Manage legal entities, subsidiaries, and organizational structure.",
      breadcrumbs: [{ label: "Companies" }],
    }),
  },
  {
    match: /^\/counterparties\/[^/]+/,
    meta: () => ({
      title: "Counterparty",
      description: "Partner profile, documents, and linked commercial activity.",
      breadcrumbs: [
        { label: "Counterparties", href: "/counterparties" },
        { label: "Detail" },
      ],
    }),
  },
  {
    match: /^\/counterparties\/?$/,
    meta: () => ({
      title: "Counterparties",
      description: "Customers, suppliers, and business partners in one place.",
      breadcrumbs: [{ label: "Counterparties" }],
    }),
  },
  {
    match: /^\/products\/[^/]+/,
    meta: () => ({
      title: "Product",
      description: "SKU details and commercial usage.",
      breadcrumbs: [
        { label: "Products", href: "/products" },
        { label: "Detail" },
      ],
    }),
  },
  {
    match: /^\/products\/?$/,
    meta: () => ({
      title: "Products",
      description: "Catalog of sellable and purchasable products.",
      breadcrumbs: [{ label: "Products" }],
    }),
  },
  {
    match: /^\/business-cases\/[^/]+/,
    meta: () => ({
      title: "Deal",
      description: "Opportunity details and conversion path.",
      breadcrumbs: [
        { label: "Deals", href: "/business-cases" },
        { label: "Detail" },
      ],
    }),
  },
  {
    match: /^\/business-cases\/?$/,
    meta: () => ({
      title: "Deals",
      description: "Track commercial opportunities before contract creation.",
      breadcrumbs: [{ label: "Deals" }],
    }),
  },
  {
    match: /^\/contracts\/[^/]+\/([^/]+)/,
    meta: (pathname) => {
      const tab = pathname.split("/")[3] ?? "overview";
      const label = tab
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      return {
        title: "Contract",
        description: "Contract workspace and linked operational modules.",
        breadcrumbs: [
          { label: "Contracts", href: "/contracts" },
          { label: "Workspace", href: pathname.split("/").slice(0, 3).join("/") },
          { label },
        ],
      };
    },
  },
  {
    match: /^\/contracts\/[^/]+/,
    meta: () => ({
      title: "Contract",
      description: "Contract workspace and linked operational modules.",
      breadcrumbs: [
        { label: "Contracts", href: "/contracts" },
        { label: "Workspace" },
      ],
    }),
  },
  {
    match: /^\/contracts\/?$/,
    meta: () => ({
      title: "Contracts",
      description: "Purchase and sales agreements linked to companies and counterparties.",
      breadcrumbs: [{ label: "Contracts" }],
    }),
  },
  {
    match: /^\/warehouse\/lots\/[^/]+/,
    meta: () => ({
      title: "Warehouse Lot",
      description: "Lot detail, movements, and stock status.",
      breadcrumbs: [
        { label: "Warehouse", href: "/warehouse" },
        { label: "Lot" },
      ],
    }),
  },
  {
    match: /^\/warehouse\/?$/,
    meta: () => ({
      title: "Warehouse",
      description: "Lots, stock levels, and warehouse operations.",
      breadcrumbs: [{ label: "Warehouse" }],
    }),
  },
  {
    match: /^\/logistics\/[^/]+/,
    meta: () => ({
      title: "Shipment",
      description: "Shipment milestones, parties, and tracking.",
      breadcrumbs: [
        { label: "Logistics", href: "/logistics" },
        { label: "Shipment" },
      ],
    }),
  },
  {
    match: /^\/logistics\/?$/,
    meta: () => ({
      title: "Logistics",
      description: "Shipments, transport status, and delivery operations.",
      breadcrumbs: [{ label: "Logistics" }],
    }),
  },
  {
    match: /^\/finance\/invoices\/[^/]+/,
    meta: () => ({
      title: "Invoice",
      description: "Invoice detail and payment allocation.",
      breadcrumbs: [
        { label: "Finance", href: "/finance" },
        { label: "Invoices", href: "/finance/invoices" },
        { label: "Detail" },
      ],
    }),
  },
  {
    match: /^\/finance\/invoices\/?$/,
    meta: () => ({
      title: "Invoices",
      description: "Customer and supplier invoices.",
      breadcrumbs: [
        { label: "Finance", href: "/finance" },
        { label: "Invoices" },
      ],
    }),
  },
  {
    match: /^\/finance\/payments\/[^/]+/,
    meta: () => ({
      title: "Payment",
      description: "Payment detail and allocations.",
      breadcrumbs: [
        { label: "Finance", href: "/finance" },
        { label: "Payments", href: "/finance/payments" },
        { label: "Detail" },
      ],
    }),
  },
  {
    match: /^\/finance\/payments\/?$/,
    meta: () => ({
      title: "Payments",
      description: "Incoming and outgoing payments.",
      breadcrumbs: [
        { label: "Finance", href: "/finance" },
        { label: "Payments" },
      ],
    }),
  },
  {
    match: /^\/finance\/bank-accounts\/?$/,
    meta: () => ({
      title: "Bank Accounts",
      description: "Company bank accounts and balances.",
      breadcrumbs: [
        { label: "Finance", href: "/finance" },
        { label: "Bank Accounts" },
      ],
    }),
  },
  {
    match: /^\/finance\/exchange-rates\/?$/,
    meta: () => ({
      title: "Exchange Rates",
      description: "Currency rates used across finance documents.",
      breadcrumbs: [
        { label: "Finance", href: "/finance" },
        { label: "Exchange Rates" },
      ],
    }),
  },
  {
    match: /^\/finance\/reports\/?$/,
    meta: () => ({
      title: "Finance Reports",
      description: "AR/AP and operational finance summaries.",
      breadcrumbs: [
        { label: "Finance", href: "/finance" },
        { label: "Reports" },
      ],
    }),
  },
  {
    match: /^\/finance\/?$/,
    meta: () => ({
      title: "Finance",
      description: "Invoices, payments, accounts, and financial health.",
      breadcrumbs: [{ label: "Finance" }],
    }),
  },
  {
    match: /^\/documents\/?$/,
    meta: () => ({
      title: "Documents",
      description: "Enterprise document library and entity attachments.",
      breadcrumbs: [{ label: "Documents" }],
    }),
  },
  {
    match: /^\/document-templates\/?$/,
    meta: () => ({
      title: "Document Templates",
      description: "Manage reusable contract and operational document templates.",
      breadcrumbs: [{ label: "Document Templates" }],
    }),
  },
  {
    match: /^\/reports\/?$/,
    meta: () => ({
      title: "Reports",
      description: "Cross-module analytics and operational reporting.",
      breadcrumbs: [{ label: "Reports" }],
    }),
  },
  {
    match: /^\/ai\/?$/,
    meta: () => ({
      title: "AI Assistant",
      description: "Ask questions and get guided help across SKY ERP.",
      breadcrumbs: [{ label: "AI" }],
    }),
  },
  {
    match: /^\/settings\/?$/,
    meta: () => ({
      title: "Settings",
      description: "Organization preferences, roles, and integrations.",
      breadcrumbs: [{ label: "Settings" }],
    }),
  },
];

export function getRouteMeta(pathname: string): RouteMeta {
  for (const route of routes) {
    if (route.match.test(pathname)) {
      return route.meta(pathname);
    }
  }

  return {
    title: "SKY ERP",
    description: "Enterprise operations workspace.",
    breadcrumbs: [{ label: "Workspace" }],
  };
}
