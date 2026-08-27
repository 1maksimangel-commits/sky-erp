export const CRM_CATEGORIES = [
  "Customer",
  "Prospect",
  "Supplier",
  "Partner",
  "Other",
] as const;

export const CRM_STATUSES = [
  "Active",
  "Inactive",
  "Prospect",
  "Archived",
] as const;

export const CRM_CUSTOMER_TYPES = [
  "Importer",
  "Distributor",
  "Retailer",
  "Processor",
  "Trader",
  "Other",
] as const;

export const CRM_CHANNELS = [
  "Email",
  "Phone",
  "WeChat",
  "Meeting",
  "Other",
] as const;

export const CRM_TIMELINE_TYPES = [
  "Call",
  "Meeting",
  "Email",
  "Quote",
  "Contract",
  "Shipment",
  "Payment",
  "Note",
] as const;

export const CRM_TASK_STATUSES = ["Open", "Done", "Cancelled"] as const;

export const CRM_LANGUAGES = [
  "English",
  "Chinese",
  "Russian",
  "Japanese",
  "Korean",
  "Spanish",
  "Other",
] as const;

export type CrmCategory = (typeof CRM_CATEGORIES)[number];
export type CrmStatus = (typeof CRM_STATUSES)[number];
export type CrmCustomerType = (typeof CRM_CUSTOMER_TYPES)[number];
export type CrmChannel = (typeof CRM_CHANNELS)[number];
export type CrmTimelineType = (typeof CRM_TIMELINE_TYPES)[number];
export type CrmTaskStatus = (typeof CRM_TASK_STATUSES)[number];

export type CrmCustomer = {
  id: string;
  company_name: string;
  legal_name: string | null;
  short_name: string | null;
  contact_person: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  wechat: string | null;
  category: CrmCategory;
  manager: string | null;
  status: CrmStatus;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  website: string | null;
  tax_id: string | null;
  notes_summary: string | null;
  customer_type: string | null;
  interested_products: string | null;
  markets: string | null;
  annual_volume: string | null;
  preferred_incoterms: string | null;
  preferred_currency: string | null;
  preferred_payment_terms: string | null;
  counterparty_id: string | null;
  company_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmContact = {
  id: string;
  customer_id: string;
  full_name: string;
  title: string | null;
  position: string | null;
  phone: string | null;
  mobile: string | null;
  office_phone: string | null;
  email: string | null;
  wechat: string | null;
  whatsapp: string | null;
  telegram: string | null;
  language: string | null;
  birthday: string | null;
  is_primary: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmNote = {
  id: string;
  customer_id: string;
  body: string;
  body_html: string | null;
  is_rich_text: boolean;
  created_by_name: string | null;
  created_at: string;
};

export type CrmCommunication = {
  id: string;
  customer_id: string;
  channel: CrmChannel;
  subject: string | null;
  body: string | null;
  direction: "Inbound" | "Outbound";
  contacted_at: string;
  created_by_name: string | null;
  created_at: string;
};

export type CrmTask = {
  id: string;
  customer_id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  status: CrmTaskStatus;
  assignee: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmTimelineEvent = {
  id: string;
  customer_id: string;
  event_type: CrmTimelineType;
  title: string;
  description: string | null;
  event_at: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_by_name: string | null;
  created_at: string;
};

export type CrmAttachment = {
  id: string;
  customer_id: string;
  title: string | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
  signed_url?: string | null;
};

export type CrmDashboardStats = {
  totalCustomers: number;
  activeCustomers: number;
  prospects: number;
  suppliers: number;
  recentlyContacted: CrmCustomer[];
  upcomingFollowUps: CrmCustomer[];
};

export type CrmCustomerFormInput = {
  company_name: string;
  legal_name: string | null;
  short_name: string | null;
  contact_person: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  wechat: string | null;
  category: CrmCategory;
  manager: string | null;
  status: CrmStatus;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  website: string | null;
  tax_id: string | null;
  notes_summary: string | null;
  customer_type: string | null;
  interested_products: string | null;
  markets: string | null;
  annual_volume: string | null;
  preferred_incoterms: string | null;
  preferred_currency: string | null;
  preferred_payment_terms: string | null;
  counterparty_id: string | null;
};

export const emptyCrmCustomerForm = (): CrmCustomerFormInput => ({
  company_name: "",
  legal_name: null,
  short_name: null,
  contact_person: null,
  country: null,
  city: null,
  address: null,
  phone: null,
  email: null,
  wechat: null,
  category: "Customer",
  manager: null,
  status: "Active",
  last_contact_at: null,
  next_follow_up_at: null,
  website: null,
  tax_id: null,
  notes_summary: null,
  customer_type: null,
  interested_products: null,
  markets: null,
  annual_volume: null,
  preferred_incoterms: null,
  preferred_currency: null,
  preferred_payment_terms: null,
  counterparty_id: null,
});

export type CrmContactFormInput = {
  full_name: string;
  position: string | null;
  mobile: string | null;
  office_phone: string | null;
  email: string | null;
  wechat: string | null;
  whatsapp: string | null;
  telegram: string | null;
  language: string | null;
  birthday: string | null;
  notes: string | null;
  is_primary: boolean;
};

export type CrmLinkedContract = {
  id: string;
  contract_number: string;
  title: string | null;
  status: string | null;
  currency: string | null;
  amount: number | null;
  contract_date: string | null;
};

export function displayLegalName(customer: CrmCustomer): string {
  return customer.legal_name?.trim() || customer.company_name;
}
