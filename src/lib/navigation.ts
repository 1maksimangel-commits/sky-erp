import {
  Bot,
  Briefcase,
  Building2,
  ChartColumn,
  ContactRound,
  FileText,
  LayoutDashboard,
  Package,
  Settings,
  Truck,
  Users,
  Warehouse,
  Wallet,
  FileSignature,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  section?: "main" | "system";
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, section: "main" },
  { label: "CRM", href: "/crm", icon: ContactRound, section: "main" },
  { label: "Companies", href: "/companies", icon: Building2, section: "main" },
  { label: "Counterparties", href: "/counterparties", icon: Users, section: "main" },
  { label: "Products", href: "/products", icon: Package, section: "main" },
  { label: "Business Cases", href: "/business-cases", icon: Briefcase, section: "main" },
  { label: "Contracts", href: "/contracts", icon: FileSignature, section: "main" },
  { label: "Warehouse", href: "/warehouse", icon: Warehouse, section: "main" },
  { label: "Logistics", href: "/logistics", icon: Truck, section: "main" },
  { label: "Finance", href: "/finance", icon: Wallet, section: "main" },
  { label: "Documents", href: "/documents", icon: FileText, section: "main" },
  { label: "Reports", href: "/reports", icon: ChartColumn, section: "main" },
  { label: "AI", href: "/ai", icon: Bot, section: "system" },
  { label: "Settings", href: "/settings", icon: Settings, section: "system" },
];

export type QuickCreateItem = {
  label: string;
  href: string;
  description: string;
};

export const quickCreateItems: QuickCreateItem[] = [
  {
    label: "Company",
    href: "/companies?new=1",
    description: "Add a legal entity",
  },
  {
    label: "CRM Customer",
    href: "/crm?new=1",
    description: "Add a CRM account",
  },
  {
    label: "Counterparty",
    href: "/counterparties?new=1",
    description: "Add a buyer or supplier",
  },
  {
    label: "Product",
    href: "/products?new=1",
    description: "Add a product SKU",
  },
  {
    label: "Contract",
    href: "/contracts?new=1",
    description: "Create a contract",
  },
  {
    label: "Invoice",
    href: "/finance/invoices?new=1",
    description: "Create an invoice",
  },
  {
    label: "Shipment",
    href: "/logistics?new=1",
    description: "Create a shipment",
  },
  {
    label: "Business Case",
    href: "/business-cases?new=1",
    description: "Start a business case",
  },
];
