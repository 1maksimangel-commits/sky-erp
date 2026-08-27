import { createClient } from "@/lib/supabase/server";
import type {
  CrmAttachment,
  CrmCommunication,
  CrmContact,
  CrmCustomer,
  CrmDashboardStats,
  CrmLinkedContract,
  CrmNote,
  CrmTask,
  CrmTimelineEvent,
} from "@/lib/crm/types";
import { assertCompanyAccess } from "@/lib/platform/company-scope";
import { assertCan } from "@/lib/platform/permissions";
import {
  logSupabaseError,
  serializeUnknownError,
} from "@/lib/platform/supabase-errors";

const customerColumns = [
  "id",
  "company_name",
  "legal_name",
  "short_name",
  "contact_person",
  "country",
  "city",
  "address",
  "phone",
  "email",
  "wechat",
  "category",
  "manager",
  "status",
  "last_contact_at",
  "next_follow_up_at",
  "website",
  "tax_id",
  "notes_summary",
  "customer_type",
  "interested_products",
  "markets",
  "annual_volume",
  "preferred_incoterms",
  "preferred_currency",
  "preferred_payment_terms",
  "counterparty_id",
  "company_id",
  "archived_at",
  "created_at",
  "updated_at",
].join(", ");

const CRM_SCHEMA_HINT =
  "CRM tables are missing. Apply supabase/migrations/20260805020000_crm_module.sql and 20260805030000_crm_seafood_profile.sql.";

function missingTable(message: string): boolean {
  return /crm_|schema cache|PGRST205|does not exist|relation/i.test(message);
}

function emptyStats(): CrmDashboardStats {
  return {
    totalCustomers: 0,
    activeCustomers: 0,
    prospects: 0,
    suppliers: 0,
    recentlyContacted: [],
    upcomingFollowUps: [],
  };
}

function dayMs(days: number) {
  return days * 24 * 60 * 60 * 1000;
}

export async function getCrmDashboardStats(): Promise<{
  data: CrmDashboardStats;
  error: string | null;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("crm_customers")
      .select(customerColumns)
      .is("archived_at", null)
      .order("updated_at", { ascending: false });

    if (error) {
      logSupabaseError("crm.getCrmDashboardStats", error);
      return {
        data: emptyStats(),
        error: missingTable(error.message) ? CRM_SCHEMA_HINT : error.message,
      };
    }

    const rows = (data ?? []) as unknown as CrmCustomer[];
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    const recentlyContacted = [...rows]
      .filter((row) => row.last_contact_at)
      .sort(
        (a, b) =>
          new Date(b.last_contact_at!).getTime() -
          new Date(a.last_contact_at!).getTime()
      )
      .slice(0, 8);

    const upcomingFollowUps = [...rows]
      .filter((row) => {
        if (!row.next_follow_up_at) return false;
        const due = new Date(row.next_follow_up_at).getTime();
        return due >= now - dayMs(1) && due <= now + weekMs;
      })
      .sort(
        (a, b) =>
          new Date(a.next_follow_up_at!).getTime() -
          new Date(b.next_follow_up_at!).getTime()
      )
      .slice(0, 8);

    return {
      data: {
        totalCustomers: rows.filter((r) => r.category === "Customer").length,
        activeCustomers: rows.filter(
          (r) => r.status === "Active" && r.category === "Customer"
        ).length,
        prospects: rows.filter(
          (r) => r.category === "Prospect" || r.status === "Prospect"
        ).length,
        suppliers: rows.filter((r) => r.category === "Supplier").length,
        recentlyContacted,
        upcomingFollowUps,
      },
      error: null,
    };
  } catch (error) {
    logSupabaseError("crm.getCrmDashboardStats.throw", error);
    return {
      data: emptyStats(),
      error: serializeUnknownError(error).message,
    };
  }
}

export async function getCrmCustomers(options?: {
  includeArchived?: boolean;
}): Promise<{ data: CrmCustomer[] | null; error: string | null }> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("crm_customers")
      .select(customerColumns)
      .order("company_name", { ascending: true });

    if (!options?.includeArchived) {
      query = query.is("archived_at", null);
    }

    const { data, error } = await query;
    if (error) {
      logSupabaseError("crm.getCrmCustomers", error);
      if (missingTable(error.message)) {
        return { data: [], error: CRM_SCHEMA_HINT };
      }
      return { data: null, error: error.message };
    }
    return { data: (data ?? []) as unknown as CrmCustomer[], error: null };
  } catch (error) {
    logSupabaseError("crm.getCrmCustomers.throw", error);
    return { data: null, error: serializeUnknownError(error).message };
  }
}

export async function getCrmCustomerById(id: string): Promise<{
  data: CrmCustomer | null;
  error: string | null;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("crm_customers")
      .select(customerColumns)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      logSupabaseError("crm.getCrmCustomerById", error);
      return { data: null, error: error.message };
    }
    if (!data) return { data: null, error: "Customer not found." };
    return { data: data as unknown as CrmCustomer, error: null };
  } catch (error) {
    logSupabaseError("crm.getCrmCustomerById.throw", error);
    return { data: null, error: serializeUnknownError(error).message };
  }
}

export async function getCrmContacts(customerId: string): Promise<{
  data: CrmContact[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_contacts")
    .select("*")
    .eq("customer_id", customerId)
    .order("is_primary", { ascending: false })
    .order("full_name");

  if (error) {
    logSupabaseError("crm.getCrmContacts", error);
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as CrmContact[], error: null };
}

export async function getCrmNotes(customerId: string): Promise<{
  data: CrmNote[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_notes")
    .select(
      "id, customer_id, body, body_html, is_rich_text, created_by_name, created_at"
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("crm.getCrmNotes", error);
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as CrmNote[], error: null };
}

export async function getCrmCommunications(customerId: string): Promise<{
  data: CrmCommunication[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_communications")
    .select("*")
    .eq("customer_id", customerId)
    .order("contacted_at", { ascending: false });

  if (error) {
    logSupabaseError("crm.getCrmCommunications", error);
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as CrmCommunication[], error: null };
}

export async function getCrmTasks(customerId: string): Promise<{
  data: CrmTask[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_tasks")
    .select("*")
    .eq("customer_id", customerId)
    .order("due_at", { ascending: true, nullsFirst: false });

  if (error) {
    logSupabaseError("crm.getCrmTasks", error);
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as CrmTask[], error: null };
}

export async function getCrmTimeline(customerId: string): Promise<{
  data: CrmTimelineEvent[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_timeline_events")
    .select(
      "id, customer_id, event_type, title, description, event_at, related_entity_type, related_entity_id, created_by_name, created_at"
    )
    .eq("customer_id", customerId)
    .order("event_at", { ascending: false })
    .limit(200);

  if (error) {
    logSupabaseError("crm.getCrmTimeline", error);
    if (missingTable(error.message)) {
      return { data: [], error: CRM_SCHEMA_HINT };
    }
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as CrmTimelineEvent[], error: null };
}

export async function getCrmAttachments(customerId: string): Promise<{
  data: CrmAttachment[];
  error: string | null;
}> {
  try {
    const readDenied = assertCan("documents.read");
    if (readDenied) {
      return { data: [], error: readDenied };
    }

    const supabase = await createClient();

    const { data: customer, error: customerError } = await supabase
      .from("crm_customers")
      .select("id, company_id")
      .eq("id", customerId)
      .maybeSingle();

    if (customerError) {
      logSupabaseError("crm.getCrmAttachments.customer", customerError);
      if (missingTable(customerError.message)) {
        return { data: [], error: CRM_SCHEMA_HINT };
      }
      return { data: [], error: customerError.message };
    }
    if (!customer) {
      return { data: [], error: "Customer was not found." };
    }

    const companyDenied = assertCompanyAccess(
      (customer.company_id as string | null) ?? null
    );
    if (companyDenied) {
      return { data: [], error: companyDenied };
    }

    const { data, error } = await supabase
      .from("crm_attachments")
      .select(
        "id, customer_id, title, file_name, file_path, mime_type, file_size, created_at"
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      logSupabaseError("crm.getCrmAttachments", error);
      if (missingTable(error.message)) {
        return { data: [], error: CRM_SCHEMA_HINT };
      }
      return { data: [], error: error.message };
    }

    const rows = (data ?? []) as CrmAttachment[];
    const withUrls = await Promise.all(
      rows.map(async (row) => {
        const { data: signed } = await supabase.storage
          .from("documents")
          .createSignedUrl(row.file_path, 60 * 60);
        return { ...row, signed_url: signed?.signedUrl ?? null };
      })
    );

    return { data: withUrls, error: null };
  } catch (error) {
    logSupabaseError("crm.getCrmAttachments.throw", error);
    return { data: [], error: serializeUnknownError(error).message };
  }
}

export async function getCrmLinkedContracts(customer: CrmCustomer): Promise<{
  data: CrmLinkedContract[];
  error: string | null;
}> {
  try {
    const supabase = await createClient();
    if (!customer.counterparty_id) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from("contracts")
      .select(
        "id, contract_number, title, status, currency, amount, contract_date, buyer_id, supplier_id"
      )
      .or(
        `buyer_id.eq.${customer.counterparty_id},supplier_id.eq.${customer.counterparty_id}`
      )
      .order("contract_date", { ascending: false })
      .limit(50);

    if (error) {
      logSupabaseError("crm.getCrmLinkedContracts", error);
      return { data: [], error: error.message };
    }

    return {
      data: (data ?? []).map((row) => ({
        id: row.id as string,
        contract_number: row.contract_number as string,
        title: (row.title as string | null) ?? null,
        status: (row.status as string | null) ?? null,
        currency: (row.currency as string | null) ?? null,
        amount: (row.amount as number | null) ?? null,
        contract_date: (row.contract_date as string | null) ?? null,
      })),
      error: null,
    };
  } catch (error) {
    return { data: [], error: serializeUnknownError(error).message };
  }
}
