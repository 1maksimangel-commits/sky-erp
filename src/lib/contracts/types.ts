import type { WorkflowStepId } from "@/lib/contracts/workflow";

export type ContractProductLine = {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  salePrice: number;
};

export type PaymentLine = {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  status: "pending" | "paid" | "overdue";
};

export type TimelineEvent = {
  id: string;
  label: string;
  date: string;
  status: "done" | "current" | "upcoming";
};

export type AiCheckItem = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  message: string;
};

export type ContractData = {
  id: string;
  case_number: string;
  title: string;
  currentStep: WorkflowStepId;
  updatedAt: string;

  businessCase: {
    case_type: string;
    contract_number: string;
    contract_date: string;
    currency: string;
    contract_amount: string;
    incoterms: string;
  };

  buyer: {
    legal_name: string;
    contact: string;
    country: string;
    paymentTerms: string;
  };

  supplier: {
    legal_name: string;
    contact: string;
    country: string;
    paymentTerms: string;
  };

  products: ContractProductLine[];

  purchaseContract: {
    number: string;
    date: string;
    amount: string;
    currency: string;
    terms: string;
  };

  salesContract: {
    number: string;
    date: string;
    amount: string;
    currency: string;
    terms: string;
  };

  invoice: {
    number: string;
    date: string;
    amount: string;
    dueDate: string;
  };

  packing: {
    reference: string;
    cartons: string;
    netWeight: string;
    grossWeight: string;
  };

  health: {
    certificateNo: string;
    issuedDate: string;
    expiryDate: string;
    authority: string;
  };

  origin: {
    certificateNo: string;
    country: string;
    issuedDate: string;
  };

  bl: {
    number: string;
    vessel: string;
    portOfLoading: string;
    portOfDischarge: string;
    etd: string;
    eta: string;
  };

  container: {
    number: string;
    sealNo: string;
    type: string;
    temperature: string;
  };

  payments: PaymentLine[];

  commission: {
    agent: string;
    rate: string;
    amount: string;
  };

  profit: {
    purchaseTotal: string;
    salesTotal: string;
    logisticsCost: string;
    commissionCost: string;
  };

  timeline: TimelineEvent[];

  aiCheck: AiCheckItem[];
};

export function createEmptyContract(id: string, case_number: string): ContractData {
  return {
    id,
    case_number,
    title: "New business case",
    currentStep: "business_case",
    updatedAt: new Date().toISOString(),
    businessCase: {
      case_type: "",
      contract_number: "",
      contract_date: "",
      currency: "USD",
      contract_amount: "",
      incoterms: "CFR",
    },
    buyer: { legal_name: "", contact: "", country: "", paymentTerms: "" },
    supplier: { legal_name: "", contact: "", country: "", paymentTerms: "" },
    products: [],
    purchaseContract: {
      number: "",
      date: "",
      amount: "",
      currency: "USD",
      terms: "",
    },
    salesContract: {
      number: "",
      date: "",
      amount: "",
      currency: "USD",
      terms: "",
    },
    invoice: { number: "", date: "", amount: "", dueDate: "" },
    packing: {
      reference: "",
      cartons: "",
      netWeight: "",
      grossWeight: "",
    },
    health: {
      certificateNo: "",
      issuedDate: "",
      expiryDate: "",
      authority: "",
    },
    origin: { certificateNo: "", country: "", issuedDate: "" },
    bl: {
      number: "",
      vessel: "",
      portOfLoading: "",
      portOfDischarge: "",
      etd: "",
      eta: "",
    },
    container: { number: "", sealNo: "", type: "40' RF", temperature: "-18°C" },
    payments: [],
    commission: { agent: "", rate: "", amount: "" },
    profit: {
      purchaseTotal: "",
      salesTotal: "",
      logisticsCost: "",
      commissionCost: "",
    },
    timeline: [],
    aiCheck: [],
  };
}

export function createSampleContract(): ContractData {
  const contract = createEmptyContract("demo-1", "BC-2026-001");
  contract.title = "Atlantic Salmon — Oslo to Shanghai";
  contract.currentStep = "purchase_contract";
  contract.businessCase = {
    case_type: "Import",
    contract_number: "PC-2026-014",
    contract_date: "2026-01-15",
    currency: "USD",
    contract_amount: "148800",
    incoterms: "CFR",
  };
  contract.buyer = {
    legal_name: "Nordic Foods AS",
    contact: "Anna Larsen",
    country: "Norway",
    paymentTerms: "LC at sight",
  };
  contract.supplier = {
    legal_name: "Pacific Seafood Co.",
    contact: "James Chen",
    country: "Chile",
    paymentTerms: "30 days net",
  };
  contract.products = [
    {
      id: "p1",
      sku: "SAL-001",
      name: "Atlantic Salmon Fillet",
      quantity: 24000,
      unit: "kg",
      purchasePrice: 6.2,
      salePrice: 7.45,
    },
  ];
  contract.purchaseContract = {
    number: "PC-2026-014",
    date: "2026-01-15",
    amount: "148800",
    currency: "USD",
    terms: "Signed, awaiting deposit",
  };
  contract.timeline = [
    { id: "t1", label: "Business case opened", date: "2026-01-10", status: "done" },
    { id: "t2", label: "Buyer confirmed", date: "2026-01-12", status: "done" },
    { id: "t3", label: "Supplier confirmed", date: "2026-01-13", status: "done" },
    { id: "t4", label: "Purchase contract", date: "2026-01-15", status: "current" },
    { id: "t5", label: "Sales contract", date: "2026-01-18", status: "upcoming" },
    { id: "t6", label: "Shipment", date: "2026-02-05", status: "upcoming" },
  ];
  contract.aiCheck = [
    {
      id: "a1",
      label: "Margin vs target",
      status: "pass",
      message: "Estimated margin 12.4% meets the 12% target.",
    },
    {
      id: "a2",
      label: "Document completeness",
      status: "warn",
      message: "Health certificate not yet uploaded.",
    },
    {
      id: "a3",
      label: "Payment terms alignment",
      status: "pass",
      message: "Buyer LC covers supplier payment window.",
    },
  ];
  return contract;
}
