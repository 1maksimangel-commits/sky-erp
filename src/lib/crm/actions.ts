"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import {
  sanitizeFileName,
  validateCrmAttachmentFile,
} from "@/lib/crm/validation";
import type {
  CrmCategory,
  CrmChannel,
  CrmContactFormInput,
  CrmCustomerFormInput,
  CrmStatus,
  CrmTaskStatus,
  CrmTimelineType,
} from "@/lib/crm/types";
import { resolveWritableCompanyId } from "@/lib/platform/company-scope";
import { assertCan } from "@/lib/platform/permissions";
import { createClient } from "@/lib/supabase/server";

export type CrmActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

const CRM_SCHEMA_HINT =
  "CRM tables are missing. Apply supabase/migrations/20260805020000_crm_module.sql and 20260805030000_crm_seafood_profile.sql.";

function nullIfEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "A unique constraint was violated.";
  if (error.code === "23502") return "A required field is missing.";
  if (error.code === "42501") {
    return "Permission denied. Check CRM RLS policies.";
  }
  if (/crm_|schema cache|PGRST205|does not exist/i.test(error.message)) {
    return CRM_SCHEMA_HINT;
  }
  return error.message || "Unable to complete CRM action.";
}

function formToRow(input: CrmCustomerFormInput) {
  const legalName =
    nullIfEmpty(input.legal_name) ?? nullIfEmpty(input.company_name);
  const companyName =
    nullIfEmpty(input.company_name) ?? legalName ?? "Untitled";

  return {
    company_name: companyName,
    legal_name: legalName,
    short_name: nullIfEmpty(input.short_name),
    contact_person: nullIfEmpty(input.contact_person),
    country: nullIfEmpty(input.country),
    city: nullIfEmpty(input.city),
    address: nullIfEmpty(input.address),
    phone: nullIfEmpty(input.phone),
    email: nullIfEmpty(input.email),
    wechat: nullIfEmpty(input.wechat),
    category: input.category,
    manager: nullIfEmpty(input.manager),
    status: input.status,
    last_contact_at: input.last_contact_at,
    next_follow_up_at: input.next_follow_up_at,
    website: nullIfEmpty(input.website),
    tax_id: nullIfEmpty(input.tax_id),
    notes_summary: nullIfEmpty(input.notes_summary),
    customer_type: nullIfEmpty(input.customer_type),
    interested_products: nullIfEmpty(input.interested_products),
    markets: nullIfEmpty(input.markets),
    annual_volume: nullIfEmpty(input.annual_volume),
    preferred_incoterms: nullIfEmpty(input.preferred_incoterms),
    preferred_currency: nullIfEmpty(input.preferred_currency),
    preferred_payment_terms: nullIfEmpty(input.preferred_payment_terms),
    counterparty_id: nullIfEmpty(input.counterparty_id),
  };
}

function revalidateCrm(customerId?: string) {
  revalidatePath("/crm");
  if (customerId) revalidatePath(`/crm/${customerId}`);
}

export async function createCrmCustomer(
  input: CrmCustomerFormInput
): Promise<CrmActionResult<{ id: string }>> {
  if (!input.company_name.trim() && !input.legal_name?.trim()) {
    return { success: false, error: "Legal name is required." };
  }

  const companyScope = resolveWritableCompanyId(null);
  if (!companyScope.ok) {
    return { success: false, error: companyScope.error };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_customers")
    .insert({
      ...formToRow(input),
      ...(companyScope.companyId
        ? { company_id: companyScope.companyId }
        : {}),
    })
    .select("id")
    .single();

  if (error) return { success: false, error: formatError(error) };

  if (input.contact_person?.trim()) {
    await supabase.from("crm_contacts").insert({
      customer_id: data.id,
      full_name: input.contact_person.trim(),
      mobile: nullIfEmpty(input.phone),
      phone: nullIfEmpty(input.phone),
      email: nullIfEmpty(input.email),
      wechat: nullIfEmpty(input.wechat),
      is_primary: true,
    });
  }

  revalidateCrm(data.id);
  return { success: true, data: { id: data.id } };
}

export async function updateCrmCustomer(
  id: string,
  input: CrmCustomerFormInput
): Promise<CrmActionResult<{ id: string }>> {
  if (!input.company_name.trim() && !input.legal_name?.trim()) {
    return { success: false, error: "Legal name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_customers")
    .update(formToRow(input))
    .eq("id", id);

  if (error) return { success: false, error: formatError(error) };
  revalidateCrm(id);
  return { success: true, data: { id } };
}

export async function archiveCrmCustomer(
  id: string
): Promise<CrmActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_customers")
    .update({
      archived_at: new Date().toISOString(),
      status: "Archived" satisfies CrmStatus,
    })
    .eq("id", id);

  if (error) return { success: false, error: formatError(error) };
  revalidateCrm(id);
  return { success: true, data: undefined };
}

export async function deleteCrmCustomer(
  id: string
): Promise<CrmActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_customers").delete().eq("id", id);
  if (error) return { success: false, error: formatError(error) };
  revalidateCrm();
  return { success: true, data: undefined };
}

export async function createCrmContact(input: {
  customerId: string;
  full_name: string;
  position?: string | null;
  mobile?: string | null;
  office_phone?: string | null;
  email?: string | null;
  wechat?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  language?: string | null;
  birthday?: string | null;
  notes?: string | null;
  is_primary?: boolean;
}): Promise<CrmActionResult<{ id: string }>> {
  if (!input.full_name.trim()) {
    return { success: false, error: "Contact name is required." };
  }

  const supabase = await createClient();
  if (input.is_primary) {
    await supabase
      .from("crm_contacts")
      .update({ is_primary: false })
      .eq("customer_id", input.customerId);
  }

  const { data, error } = await supabase
    .from("crm_contacts")
    .insert({
      customer_id: input.customerId,
      full_name: input.full_name.trim(),
      title: nullIfEmpty(input.position),
      position: nullIfEmpty(input.position),
      phone: nullIfEmpty(input.mobile),
      mobile: nullIfEmpty(input.mobile),
      office_phone: nullIfEmpty(input.office_phone),
      email: nullIfEmpty(input.email),
      wechat: nullIfEmpty(input.wechat),
      whatsapp: nullIfEmpty(input.whatsapp),
      telegram: nullIfEmpty(input.telegram),
      language: nullIfEmpty(input.language),
      birthday: nullIfEmpty(input.birthday),
      notes: nullIfEmpty(input.notes),
      is_primary: Boolean(input.is_primary),
    })
    .select("id")
    .single();

  if (error) return { success: false, error: formatError(error) };

  if (input.is_primary) {
    await supabase
      .from("crm_customers")
      .update({
        contact_person: input.full_name.trim(),
        phone: nullIfEmpty(input.mobile),
        email: nullIfEmpty(input.email),
        wechat: nullIfEmpty(input.wechat),
      })
      .eq("id", input.customerId);
  }

  revalidateCrm(input.customerId);
  return { success: true, data: { id: data.id } };
}

export async function updateCrmContact(input: {
  id: string;
  customerId: string;
  data: CrmContactFormInput;
}): Promise<CrmActionResult> {
  if (!input.data.full_name.trim()) {
    return { success: false, error: "Contact name is required." };
  }

  const supabase = await createClient();
  if (input.data.is_primary) {
    await supabase
      .from("crm_contacts")
      .update({ is_primary: false })
      .eq("customer_id", input.customerId)
      .neq("id", input.id);
  }

  const { error } = await supabase
    .from("crm_contacts")
    .update({
      full_name: input.data.full_name.trim(),
      title: nullIfEmpty(input.data.position),
      position: nullIfEmpty(input.data.position),
      phone: nullIfEmpty(input.data.mobile),
      mobile: nullIfEmpty(input.data.mobile),
      office_phone: nullIfEmpty(input.data.office_phone),
      email: nullIfEmpty(input.data.email),
      wechat: nullIfEmpty(input.data.wechat),
      whatsapp: nullIfEmpty(input.data.whatsapp),
      telegram: nullIfEmpty(input.data.telegram),
      language: nullIfEmpty(input.data.language),
      birthday: nullIfEmpty(input.data.birthday),
      notes: nullIfEmpty(input.data.notes),
      is_primary: Boolean(input.data.is_primary),
    })
    .eq("id", input.id);

  if (error) return { success: false, error: formatError(error) };

  if (input.data.is_primary) {
    await supabase
      .from("crm_customers")
      .update({
        contact_person: input.data.full_name.trim(),
        phone: nullIfEmpty(input.data.mobile),
        email: nullIfEmpty(input.data.email),
        wechat: nullIfEmpty(input.data.wechat),
      })
      .eq("id", input.customerId);
  }

  revalidateCrm(input.customerId);
  return { success: true, data: undefined };
}

export async function deleteCrmContact(
  id: string,
  customerId: string
): Promise<CrmActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_contacts").delete().eq("id", id);
  if (error) return { success: false, error: formatError(error) };
  revalidateCrm(customerId);
  return { success: true, data: undefined };
}

export async function createCrmNote(input: {
  customerId: string;
  body?: string;
  /** Ignored. Rich HTML is not accepted (XSS mitigation — plain text only). */
  bodyHtml?: string | null;
  createdByName?: string | null;
}): Promise<CrmActionResult<{ id: string }>> {
  // Intentionally ignore bodyHtml: never persist or trust client HTML for notes.
  void input.bodyHtml;
  const plain = nullIfEmpty(input.body);
  if (!plain) {
    return { success: false, error: "Note body is required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_notes")
    .insert({
      customer_id: input.customerId,
      body: plain,
      body_html: null,
      is_rich_text: false,
      created_by_name: nullIfEmpty(input.createdByName) ?? "Operator",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: formatError(error) };
  revalidateCrm(input.customerId);
  return { success: true, data: { id: data.id } };
}

export async function createCrmTimelineEvent(input: {
  customerId: string;
  event_type: CrmTimelineType;
  title: string;
  description?: string | null;
  event_at?: string | null;
}): Promise<CrmActionResult<{ id: string }>> {
  if (!input.title.trim()) {
    return { success: false, error: "Timeline title is required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_timeline_events")
    .insert({
      customer_id: input.customerId,
      event_type: input.event_type,
      title: input.title.trim(),
      description: nullIfEmpty(input.description),
      event_at: input.event_at ?? new Date().toISOString(),
      created_by_name: "Operator",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: formatError(error) };

  if (["Call", "Meeting", "Email"].includes(input.event_type)) {
    await supabase
      .from("crm_customers")
      .update({ last_contact_at: input.event_at ?? new Date().toISOString() })
      .eq("id", input.customerId);
  }

  revalidateCrm(input.customerId);
  return { success: true, data: { id: data.id } };
}

export async function uploadCrmAttachment(input: {
  customerId: string;
  formData: FormData;
  title?: string | null;
}): Promise<CrmActionResult<{ id: string }>> {
  const denied = assertCan("documents.write");
  if (denied) {
    return { success: false, error: denied };
  }

  if (!input.customerId?.trim()) {
    return { success: false, error: "Customer id is required." };
  }

  const file = input.formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "File is required." };
  }

  const fileError = validateCrmAttachmentFile(file);
  if (fileError) {
    return { success: false, error: fileError };
  }

  const attachmentId = randomUUID();
  const safeName = sanitizeFileName(file.name);
  const filePath = `crm_customer/${input.customerId}/${attachmentId}/${safeName}`;
  const title =
    nullIfEmpty(input.title) ||
    (typeof input.formData.get("title") === "string"
      ? nullIfEmpty(String(input.formData.get("title")))
      : null) ||
    safeName;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(filePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return {
      success: false,
      error: /bucket not found|NoSuchBucket/i.test(uploadError.message)
        ? "Storage bucket `documents` is missing. Apply the documents DMS migrations."
        : uploadError.message,
    };
  }

  const { data, error } = await supabase
    .from("crm_attachments")
    .insert({
      id: attachmentId,
      customer_id: input.customerId,
      title,
      file_name: safeName,
      file_path: filePath,
      mime_type: file.type || null,
      file_size: file.size,
    })
    .select("id")
    .single();

  if (error) {
    await supabase.storage.from("documents").remove([filePath]);
    return { success: false, error: formatError(error) };
  }

  await supabase.from("crm_timeline_events").insert({
    customer_id: input.customerId,
    event_type: "Note",
    title: "Attachment uploaded",
    description: title,
    event_at: new Date().toISOString(),
    created_by_name: "Operator",
  });

  revalidateCrm(input.customerId);
  return { success: true, data: { id: data.id } };
}

export async function deleteCrmAttachment(input: {
  id: string;
  customerId: string;
  /** Ignored — path is loaded from the database for ownership safety. */
  filePath?: string;
}): Promise<CrmActionResult> {
  const denied = assertCan("documents.write");
  if (denied) {
    return { success: false, error: denied };
  }

  if (!input.id?.trim() || !input.customerId?.trim()) {
    return { success: false, error: "Attachment id and customer id are required." };
  }

  const supabase = await createClient();
  const { data: existing, error: loadError } = await supabase
    .from("crm_attachments")
    .select("id, customer_id, file_path")
    .eq("id", input.id)
    .maybeSingle();

  if (loadError) {
    return { success: false, error: formatError(loadError) };
  }
  if (!existing || existing.customer_id !== input.customerId) {
    return { success: false, error: "Attachment was not found for this customer." };
  }

  const { error } = await supabase
    .from("crm_attachments")
    .delete()
    .eq("id", input.id)
    .eq("customer_id", input.customerId);

  if (error) return { success: false, error: formatError(error) };

  if (existing.file_path) {
    await supabase.storage.from("documents").remove([existing.file_path]);
  }

  revalidateCrm(input.customerId);
  return { success: true, data: undefined };
}

export async function createCrmCommunication(input: {
  customerId: string;
  channel: CrmChannel;
  subject?: string | null;
  body?: string | null;
  direction?: "Inbound" | "Outbound";
  contacted_at?: string | null;
}): Promise<CrmActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_communications")
    .insert({
      customer_id: input.customerId,
      channel: input.channel,
      subject: nullIfEmpty(input.subject),
      body: nullIfEmpty(input.body),
      direction: input.direction ?? "Outbound",
      contacted_at: input.contacted_at ?? new Date().toISOString(),
      created_by_name: "Operator",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: formatError(error) };
  revalidateCrm(input.customerId);
  return { success: true, data: { id: data.id } };
}

export async function createCrmTask(input: {
  customerId: string;
  title: string;
  description?: string | null;
  due_at?: string | null;
  assignee?: string | null;
}): Promise<CrmActionResult<{ id: string }>> {
  if (!input.title.trim()) {
    return { success: false, error: "Task title is required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_tasks")
    .insert({
      customer_id: input.customerId,
      title: input.title.trim(),
      description: nullIfEmpty(input.description),
      due_at: input.due_at,
      assignee: nullIfEmpty(input.assignee),
      status: "Open" satisfies CrmTaskStatus,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: formatError(error) };
  revalidateCrm(input.customerId);
  return { success: true, data: { id: data.id } };
}

export async function updateCrmTaskStatus(input: {
  id: string;
  customerId: string;
  status: CrmTaskStatus;
}): Promise<CrmActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_tasks")
    .update({
      status: input.status,
      completed_at:
        input.status === "Done" ? new Date().toISOString() : null,
    })
    .eq("id", input.id);

  if (error) return { success: false, error: formatError(error) };
  revalidateCrm(input.customerId);
  return { success: true, data: undefined };
}

export async function updateCrmCustomerCategoryStatus(input: {
  id: string;
  category?: CrmCategory;
  status?: CrmStatus;
}): Promise<CrmActionResult> {
  const supabase = await createClient();
  const patch: Record<string, string | null> = {};
  if (input.category) patch.category = input.category;
  if (input.status) patch.status = input.status;
  if (input.status === "Archived") {
    patch.archived_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("crm_customers")
    .update(patch)
    .eq("id", input.id);

  if (error) return { success: false, error: formatError(error) };
  revalidateCrm(input.id);
  return { success: true, data: undefined };
}
