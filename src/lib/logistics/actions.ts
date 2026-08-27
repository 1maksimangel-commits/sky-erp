"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  assertLogisticsWrite,
  bindLogisticsWriteCompany,
} from "@/lib/logistics/auth";
import { shipmentColumns, type Shipment } from "@/lib/logistics/db";
import { insertTimelineEvent } from "@/lib/logistics/timeline";
import type {
  ShipmentFormInput,
  TimelineEventFormInput,
} from "@/lib/logistics/types";
import {
  companiesMatch,
  duplicateBlError,
  duplicateContainerError,
  validateShipmentFormInput,
} from "@/lib/logistics/validation";
import { recordEntityEvent } from "@/lib/platform/audit";

export type ShipmentActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

function nullIfEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatSupabaseError(error: { message: string }): string {
  return error.message || "Unable to save shipment. Please try again.";
}

function formInputToRow(input: ShipmentFormInput) {
  return {
    contract_id: input.contract_id.trim(),
    business_case_id: nullIfEmpty(input.business_case_id),
    company_id: nullIfEmpty(input.company_id),
    container: nullIfEmpty(input.container),
    container_type: nullIfEmpty(input.container_type),
    seal_number: nullIfEmpty(input.seal_number),
    bl_number: nullIfEmpty(input.bl_number),
    vessel: nullIfEmpty(input.vessel),
    voyage: nullIfEmpty(input.voyage),
    shipping_line: nullIfEmpty(input.shipping_line),
    booking_number: nullIfEmpty(input.booking_number),
    tracking_number: nullIfEmpty(input.tracking_number),
    freight_forwarder: nullIfEmpty(input.freight_forwarder),
    port_of_loading: nullIfEmpty(input.port_of_loading),
    port_of_destination: nullIfEmpty(input.port_of_destination),
    consignee: nullIfEmpty(input.consignee),
    notify_party: nullIfEmpty(input.notify_party),
    etd: nullIfEmpty(input.etd),
    eta: nullIfEmpty(input.eta),
    etd_actual: nullIfEmpty(input.etd_actual),
    eta_actual: nullIfEmpty(input.eta_actual),
    atd: nullIfEmpty(input.atd),
    ata: nullIfEmpty(input.ata),
    status: input.status.trim(),
    remarks: nullIfEmpty(input.remarks),
    updated_at: new Date().toISOString(),
  };
}

function formatActionError(error: { message: string }): string {
  if (/company_id|bl_number|consignee|notify_party/i.test(error.message)) {
    return "Logistics schema is incomplete. Apply supabase/migrations/20260805100000_logistics_p0_ownership_columns.sql in the Supabase SQL Editor.";
  }

  if (
    /voyage|business_case_id|tracking_number|booking_number|shipping_line|etd_actual|eta_actual|container_type|seal_number|freight_forwarder|remarks|shipment_timeline_events|schema cache|does not exist|42703|PGRST205/i.test(
      error.message
    )
  ) {
    return "Logistics schema is incomplete. Apply supabase/migrations/20260804160000_shipments_logistics_columns.sql in the Supabase SQL Editor.";
  }

  return formatSupabaseError(error);
}

function revalidateShipmentPaths(
  shipment?: Pick<Shipment, "id" | "contract_id"> | null
) {
  revalidatePath("/logistics");
  if (shipment?.id) {
    revalidatePath(`/logistics/${shipment.id}`);
  }
  if (shipment?.contract_id) {
    revalidatePath(`/contracts/${shipment.contract_id}/logistics`);
    revalidatePath(`/contracts/${shipment.contract_id}/history`);
  }
}

async function resolveShipmentOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: ShipmentFormInput
): Promise<
  { ok: true; input: ShipmentFormInput } | { ok: false; error: string }
> {
  const companyBind = bindLogisticsWriteCompany(input.company_id);
  if (!companyBind.ok) {
    return { ok: false, error: companyBind.error };
  }

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("id, company_id, business_case_id")
    .eq("id", input.contract_id.trim())
    .maybeSingle();

  if (contractError) {
    return { ok: false, error: formatActionError(contractError) };
  }
  if (!contract) {
    return { ok: false, error: "Selected contract was not found." };
  }

  const companyId =
    companyBind.companyId ??
    nullIfEmpty(input.company_id) ??
    nullIfEmpty(contract.company_id);

  if (!companyId) {
    return {
      ok: false,
      error: "Company is required. Set company_id on the linked contract.",
    };
  }

  const scopeDenied = assertLogisticsWrite(companyId);
  if (scopeDenied) {
    return { ok: false, error: scopeDenied };
  }

  if (contract.company_id && companyId !== contract.company_id) {
    return {
      ok: false,
      error: "Shipment company must match the selected contract company.",
    };
  }

  // Active-company mode: contract must belong to the same company.
  if (
    companyBind.companyId &&
    contract.company_id &&
    contract.company_id !== companyBind.companyId
  ) {
    return {
      ok: false,
      error: "Contract belongs to another company.",
    };
  }

  const businessCaseId =
    nullIfEmpty(input.business_case_id) ??
    nullIfEmpty(contract.business_case_id);
  if (!businessCaseId) {
    return {
      ok: false,
      error:
        "Business case is required. Link a business case on the shipment or contract.",
    };
  }

  const { data: businessCase, error: bcError } = await supabase
    .from("business_cases")
    .select("id, company_id")
    .eq("id", businessCaseId)
    .maybeSingle();

  if (bcError) {
    return { ok: false, error: formatActionError(bcError) };
  }
  if (!businessCase) {
    return { ok: false, error: "Selected business case was not found." };
  }
  if (!companiesMatch(businessCase.company_id, companyId)) {
    return {
      ok: false,
      error: "Business case company must match the shipment company.",
    };
  }

  return {
    ok: true,
    input: {
      ...input,
      company_id: companyId,
      business_case_id: businessCaseId,
    },
  };
}

async function assertNoDuplicateIdentifiers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: ShipmentFormInput,
  excludeId?: string
): Promise<string | null> {
  const container = nullIfEmpty(input.container);
  const blNumber = nullIfEmpty(input.bl_number);
  const booking = nullIfEmpty(input.booking_number);
  const companyId = nullIfEmpty(input.company_id);

  if (container) {
    let query = supabase
      .from("shipments")
      .select("id, status")
      .eq("container", container)
      .neq("status", "Delivered")
      .limit(1);

    if (companyId) {
      query = query.eq("company_id", companyId);
    }
    if (excludeId) query = query.neq("id", excludeId);

    const { data, error } = await query;
    if (error && /company_id|42703|PGRST204/i.test(error.message)) {
      // Retry without company filter when column missing.
      let fallback = supabase
        .from("shipments")
        .select("id, status")
        .eq("container", container)
        .neq("status", "Delivered")
        .limit(1);
      if (excludeId) fallback = fallback.neq("id", excludeId);
      const retry = await fallback;
      if (retry.error && !/does not exist|42703/i.test(retry.error.message)) {
        return formatActionError(retry.error);
      }
      if (retry.data?.length) {
        return duplicateContainerError(container);
      }
    } else if (error && !/does not exist|42703/i.test(error.message)) {
      return formatActionError(error);
    } else if (data?.length) {
      return duplicateContainerError(container);
    }
  }

  if (blNumber) {
    let query = supabase.from("shipments").select("id").eq("bl_number", blNumber).limit(1);

    if (companyId) {
      query = query.eq("company_id", companyId);
    }
    if (excludeId) query = query.neq("id", excludeId);

    const { data, error } = await query;
    if (error) {
      if (/bl_number|42703|PGRST204|does not exist/i.test(error.message)) {
        return "Logistics schema is incomplete. Apply supabase/migrations/20260805100000_logistics_p0_ownership_columns.sql in the Supabase SQL Editor.";
      }
      return formatActionError(error);
    }
    if (data?.length) {
      return duplicateBlError(blNumber);
    }
  }

  if (booking && companyId) {
    let query = supabase
      .from("shipments")
      .select("id")
      .eq("booking_number", booking)
      .eq("company_id", companyId)
      .neq("status", "Delivered")
      .limit(1);
    if (excludeId) query = query.neq("id", excludeId);
    const { data, error } = await query;
    if (error && /company_id|42703|PGRST204/i.test(error.message)) {
      // skip when column missing
    } else if (error) {
      return formatActionError(error);
    } else if (data?.length) {
      return `Booking number ${booking} is already used on an active shipment for this company.`;
    }
  }

  return null;
}

export async function createShipment(
  input: ShipmentFormInput
): Promise<ShipmentActionResult> {
  const supabase = await createClient();
  const ownership = await resolveShipmentOwnership(supabase, input);
  if (!ownership.ok) {
    return { success: false, error: ownership.error };
  }

  const validationError = validateShipmentFormInput(ownership.input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const duplicateError = await assertNoDuplicateIdentifiers(
    supabase,
    ownership.input
  );
  if (duplicateError) {
    return { success: false, error: duplicateError };
  }

  const { data, error } = await supabase
    .from("shipments")
    .insert(formInputToRow(ownership.input))
    .select(
      "id, contract_id, business_case_id, company_id, container, etd, eta, status"
    )
    .single();

  if (error) {
    return { success: false, error: formatActionError(error) };
  }

  await insertTimelineEvent(
    data.id,
    "Shipment created",
    `Status: ${ownership.input.status.trim()}`
  );

  const label = data.container || data.id.slice(0, 8);
  await recordEntityEvent({
    entityType: "shipment",
    entityId: data.id,
    action: "created",
    eventType: "shipment_planned",
    title: "Shipment planned",
    summary: `Shipment ${label} planned`,
    eventDate: data.etd,
    newValue: {
      status: data.status,
      etd: data.etd,
      eta: data.eta,
      container: data.container,
      company_id: data.company_id,
    },
    notify: {
      title: "Shipment planned",
      body: label,
      category: "logistics",
      href: `/logistics/${data.id}`,
    },
    fanout: [
      ...(data.contract_id
        ? [{ entityType: "contract", entityId: data.contract_id as string }]
        : []),
      ...(data.business_case_id
        ? [
            {
              entityType: "business_case",
              entityId: data.business_case_id as string,
            },
          ]
        : []),
    ],
  });

  revalidateShipmentPaths(data);
  return { success: true, id: data.id };
}

export async function updateShipment(
  id: string,
  input: ShipmentFormInput,
  previousStatus?: string | null
): Promise<ShipmentActionResult> {
  if (!id?.trim()) {
    return { success: false, error: "Shipment id is required." };
  }

  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("shipments")
    .select("id, status, contract_id, company_id")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return { success: false, error: formatActionError(existingError) };
  }
  if (!existing) {
    return { success: false, error: "Shipment not found." };
  }

  const existingDenied = assertLogisticsWrite(existing.company_id);
  if (existingDenied) {
    return { success: false, error: existingDenied };
  }

  const ownership = await resolveShipmentOwnership(supabase, input);
  if (!ownership.ok) {
    return { success: false, error: ownership.error };
  }

  if (
    existing.company_id &&
    ownership.input.company_id &&
    existing.company_id !== ownership.input.company_id
  ) {
    return {
      success: false,
      error: "Cannot move a shipment to another company.",
    };
  }

  const fromStatus = previousStatus ?? existing.status;
  const validationError = validateShipmentFormInput(ownership.input, {
    previousStatus: fromStatus,
  });
  if (validationError) {
    return { success: false, error: validationError };
  }

  const duplicateError = await assertNoDuplicateIdentifiers(
    supabase,
    ownership.input,
    id
  );
  if (duplicateError) {
    return { success: false, error: duplicateError };
  }

  const { data, error } = await supabase
    .from("shipments")
    .update(formInputToRow(ownership.input))
    .eq("id", id)
    .select(shipmentColumns)
    .single();

  if (error) {
    return { success: false, error: formatActionError(error) };
  }

  const newStatus = ownership.input.status.trim();
  if (fromStatus && fromStatus !== newStatus) {
    await insertTimelineEvent(
      id,
      "Status changed",
      `${fromStatus} → ${newStatus}`
    );
  } else {
    await insertTimelineEvent(id, "Shipment updated");
  }

  const delayed = /delay/i.test(newStatus);
  const arrived = /arrived|delivered|ata/i.test(newStatus);
  await recordEntityEvent({
    entityType: "shipment",
    entityId: id,
    action: "updated",
    eventType: delayed
      ? "shipment_delayed"
      : arrived
        ? "container_arrived"
        : "shipment_updated",
    title: delayed
      ? "Shipment delayed"
      : arrived
        ? "Container arrived"
        : "Shipment updated",
    summary:
      fromStatus && fromStatus !== newStatus
        ? `${fromStatus} → ${newStatus}`
        : `Shipment ${data.container || id.slice(0, 8)} updated`,
    oldValue: { status: fromStatus ?? null },
    newValue: {
      status: newStatus,
      etd: ownership.input.etd,
      eta: ownership.input.eta,
    },
    notify: delayed
      ? {
          title: "Shipment delayed",
          body: data.container || id,
          category: "logistics",
          severity: "warning",
          href: `/logistics/${id}`,
        }
      : arrived
        ? {
            title: "Container arrived",
            body: data.container || id,
            category: "logistics",
            href: `/logistics/${id}`,
          }
        : null,
  });

  revalidateShipmentPaths(data as Pick<Shipment, "id" | "contract_id">);
  return { success: true, id: data.id };
}

export async function deleteShipment(id: string): Promise<ShipmentActionResult> {
  if (!id?.trim()) {
    return { success: false, error: "Shipment id is required." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("shipments")
    .select("id, contract_id, company_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return { success: false, error: "Shipment not found." };
  }

  const denied = assertLogisticsWrite(existing.company_id);
  if (denied) {
    return { success: false, error: denied };
  }

  const { error } = await supabase.from("shipments").delete().eq("id", id);

  if (error) {
    return { success: false, error: formatActionError(error) };
  }

  revalidateShipmentPaths(existing);
  return { success: true };
}

export async function addShipmentTimelineEvent(
  shipmentId: string,
  input: TimelineEventFormInput
): Promise<ShipmentActionResult> {
  if (!shipmentId?.trim()) {
    return { success: false, error: "Shipment id is required." };
  }

  if (!input.title.trim()) {
    return { success: false, error: "Event title is required." };
  }

  const supabase = await createClient();
  const { data: shipment } = await supabase
    .from("shipments")
    .select("id, company_id")
    .eq("id", shipmentId)
    .maybeSingle();

  if (!shipment) {
    return { success: false, error: "Shipment not found." };
  }

  const denied = assertLogisticsWrite(shipment.company_id);
  if (denied) {
    return { success: false, error: denied };
  }

  const { error } = await insertTimelineEvent(
    shipmentId,
    input.title.trim(),
    input.description,
    input.event_date
  );

  if (error) {
    if (
      /shipment_timeline_events|schema cache|does not exist|PGRST205/i.test(
        error
      )
    ) {
      return {
        success: false,
        error:
          "Logistics schema is incomplete. Apply supabase/migrations/20260804160000_shipments_logistics_columns.sql in the Supabase SQL Editor.",
      };
    }
    return { success: false, error };
  }

  revalidatePath(`/logistics/${shipmentId}`);
  return { success: true };
}

export async function createShipmentForContract(
  contractId: string,
  input: Omit<ShipmentFormInput, "contract_id">
): Promise<ShipmentActionResult> {
  return createShipment({
    ...input,
    contract_id: contractId,
  });
}
