import {
  Bot,
  Box,
  Briefcase,
  Clock,
  Container,
  CreditCard,
  Factory,
  FileSignature,
  FileText,
  Globe,
  HeartPulse,
  Package,
  Percent,
  Receipt,
  Ship,
  TrendingUp,
  User,
  type LucideIcon,
} from "lucide-react";

export type WorkflowStepId =
  | "business_case"
  | "buyer"
  | "supplier"
  | "products"
  | "purchase_contract"
  | "sales_contract"
  | "invoice"
  | "packing"
  | "health"
  | "origin"
  | "bl"
  | "container"
  | "payments"
  | "commission"
  | "profit"
  | "timeline"
  | "ai_check";

export type WorkflowStep = {
  id: WorkflowStepId;
  label: string;
  icon: LucideIcon;
  description: string;
};

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "business_case",
    label: "Business Case",
    icon: Briefcase,
    description: "Deal overview, margin target, and commercial terms",
  },
  {
    id: "buyer",
    label: "Buyer",
    icon: User,
    description: "Customer details and payment terms",
  },
  {
    id: "supplier",
    label: "Supplier",
    icon: Factory,
    description: "Supplier details and procurement terms",
  },
  {
    id: "products",
    label: "Products",
    icon: Package,
    description: "Product lines, quantities, and pricing",
  },
  {
    id: "purchase_contract",
    label: "Purchase Contract",
    icon: FileText,
    description: "Purchase agreement and supplier obligations",
  },
  {
    id: "sales_contract",
    label: "Sales Contract",
    icon: FileSignature,
    description: "Sales agreement and buyer obligations",
  },
  {
    id: "invoice",
    label: "Invoice",
    icon: Receipt,
    description: "Billing details and due dates",
  },
  {
    id: "packing",
    label: "Packing",
    icon: Box,
    description: "Packing list, cartons, and weights",
  },
  {
    id: "health",
    label: "Health",
    icon: HeartPulse,
    description: "Health certificate and inspection records",
  },
  {
    id: "origin",
    label: "Origin",
    icon: Globe,
    description: "Certificate of origin",
  },
  {
    id: "bl",
    label: "BL",
    icon: Ship,
    description: "Bill of lading and shipping route",
  },
  {
    id: "container",
    label: "Container",
    icon: Container,
    description: "Container number, seal, and reefer settings",
  },
  {
    id: "payments",
    label: "Payments",
    icon: CreditCard,
    description: "Payment schedule and settlement status",
  },
  {
    id: "commission",
    label: "Commission",
    icon: Percent,
    description: "Agent commission and fees",
  },
  {
    id: "profit",
    label: "Profit",
    icon: TrendingUp,
    description: "Margin analysis and net profit",
  },
  {
    id: "timeline",
    label: "Timeline",
    icon: Clock,
    description: "Deal milestones and key dates",
  },
  {
    id: "ai_check",
    label: "AI Check",
    icon: Bot,
    description: "Automated compliance and risk review",
  },
];

export function getWorkflowStepIndex(stepId: WorkflowStepId): number {
  return WORKFLOW_STEPS.findIndex((step) => step.id === stepId);
}

export function getWorkflowStep(stepId: WorkflowStepId): WorkflowStep {
  return WORKFLOW_STEPS[getWorkflowStepIndex(stepId)] ?? WORKFLOW_STEPS[0];
}

export function getNextStep(stepId: WorkflowStepId): WorkflowStepId | null {
  const index = getWorkflowStepIndex(stepId);
  return WORKFLOW_STEPS[index + 1]?.id ?? null;
}

export function getPreviousStep(stepId: WorkflowStepId): WorkflowStepId | null {
  const index = getWorkflowStepIndex(stepId);
  return WORKFLOW_STEPS[index - 1]?.id ?? null;
}
