import { createClient } from "@/lib/supabase/server";
import {
  assertLogisticsRead,
  logisticsActiveCompanyId,
} from "@/lib/logistics/auth";
import { SHIPMENT_STATUSES } from "@/lib/logistics/types";

export type Shipment = {
  id: string;
  contract_id: string;
  business_case_id: string | null;
  company_id: string | null;
  container: string | null;
  container_type: string | null;
  seal_number: string | null;
  bl_number: string | null;
  vessel: string | null;
  voyage: string | null;
  shipping_line: string | null;
  booking_number: string | null;
  tracking_number: string | null;
  freight_forwarder: string | null;
  port_of_loading: string | null;
  port_of_destination: string | null;
  consignee: string | null;
  notify_party: string | null;
  etd: string | null;
  eta: string | null;
  etd_actual: string | null;
  eta_actual: string | null;
  atd: string | null;
  ata: string | null;
  status: string | null;
  remarks: string | null;
  created_at: string | null;
  updated_at: string | null;
  contract: {
    id: string;
    contract_number: string;
    title: string | null;
    company_id: string | null;
  } | null;
  business_case: { id: string; case_number: string } | null;
  company: { id: string; name: string } | null;
};

export type ShipmentStats = {
  total: number;
  planned: number;
  inTransit: number;
  delivered: number;
  delayed: number;
};

export type ShipmentsResult =
  | { data: Shipment[]; stats: ShipmentStats; error: null }
  | { data: null; stats: null; error: string };

export type ShipmentResult =
  | { data: Shipment; error: null }
  | { data: null; error: string };

type ShipmentRow = Omit<Shipment, "contract" | "business_case" | "company">;

export const shipmentColumns = `
  id,
  contract_id,
  business_case_id,
  company_id,
  container,
  container_type,
  seal_number,
  bl_number,
  vessel,
  voyage,
  shipping_line,
  booking_number,
  tracking_number,
  freight_forwarder,
  port_of_loading,
  port_of_destination,
  consignee,
  notify_party,
  etd,
  eta,
  etd_actual,
  eta_actual,
  atd,
  ata,
  status,
  remarks,
  created_at,
  updated_at
` as const;

/** Fallback select when P0 ownership columns are not applied yet. */
export const shipmentColumnsLegacy = `
  id,
  contract_id,
  business_case_id,
  container,
  container_type,
  seal_number,
  vessel,
  voyage,
  shipping_line,
  booking_number,
  tracking_number,
  freight_forwarder,
  port_of_loading,
  port_of_destination,
  etd,
  eta,
  etd_actual,
  eta_actual,
  atd,
  ata,
  status,
  remarks,
  created_at,
  updated_at
` as const;

const MISSING_SCHEMA_HINT =
  "Logistics schema is incomplete. Apply supabase/migrations/20260804160000_shipments_logistics_columns.sql and supabase/migrations/20260805100000_logistics_p0_ownership_columns.sql in the Supabase SQL Editor, then reload the API schema.";

function formatLoadError(message: string): string {
  if (
    /voyage|business_case_id|company_id|bl_number|consignee|notify_party|tracking_number|booking_number|shipping_line|etd_actual|eta_actual|container_type|seal_number|freight_forwarder|remarks|shipment_timeline_events|schema cache|does not exist|42703|PGRST205/i.test(
      message
    )
  ) {
    return MISSING_SCHEMA_HINT;
  }

  return message || "Unable to load shipments from Supabase.";
}

function isMissingColumnError(message: string): boolean {
  return /company_id|bl_number|consignee|notify_party|42703|PGRST204|schema cache|does not exist/i.test(
    message
  );
}

function normalizeRow(row: Record<string, unknown>): ShipmentRow {
  return {
    id: String(row.id),
    contract_id: String(row.contract_id),
    business_case_id: (row.business_case_id as string | null) ?? null,
    company_id: (row.company_id as string | null) ?? null,
    container: (row.container as string | null) ?? null,
    container_type: (row.container_type as string | null) ?? null,
    seal_number: (row.seal_number as string | null) ?? null,
    bl_number: (row.bl_number as string | null) ?? null,
    vessel: (row.vessel as string | null) ?? null,
    voyage: (row.voyage as string | null) ?? null,
    shipping_line: (row.shipping_line as string | null) ?? null,
    booking_number: (row.booking_number as string | null) ?? null,
    tracking_number: (row.tracking_number as string | null) ?? null,
    freight_forwarder: (row.freight_forwarder as string | null) ?? null,
    port_of_loading: (row.port_of_loading as string | null) ?? null,
    port_of_destination: (row.port_of_destination as string | null) ?? null,
    consignee: (row.consignee as string | null) ?? null,
    notify_party: (row.notify_party as string | null) ?? null,
    etd: (row.etd as string | null) ?? null,
    eta: (row.eta as string | null) ?? null,
    etd_actual: (row.etd_actual as string | null) ?? null,
    eta_actual: (row.eta_actual as string | null) ?? null,
    atd: (row.atd as string | null) ?? null,
    ata: (row.ata as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    remarks: (row.remarks as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
  };
}

function computeStats(shipments: Shipment[]): ShipmentStats {
  return {
    total: shipments.length,
    planned: shipments.filter((item) => item.status === "Planned").length,
    inTransit: shipments.filter((item) => item.status === "In Transit").length,
    delivered: shipments.filter((item) => item.status === "Delivered").length,
    delayed: shipments.filter((item) => item.status === "Delayed").length,
  };
}

async function hydrateShipments(rows: ShipmentRow[]): Promise<Shipment[]> {
  if (rows.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const contractIds = [...new Set(rows.map((row) => row.contract_id))];
  const businessCaseIds = [
    ...new Set(
      rows
        .map((row) => row.business_case_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const companyIds = [
    ...new Set(
      rows
        .map((row) => row.company_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [{ data: contracts }, { data: businessCases }, { data: companies }] =
    await Promise.all([
      supabase
        .from("contracts")
        .select("id, contract_number, title, company_id")
        .in("id", contractIds),
      businessCaseIds.length
        ? supabase
            .from("business_cases")
            .select("id, case_number")
            .in("id", businessCaseIds)
        : Promise.resolve({ data: [] as { id: string; case_number: string }[] }),
      companyIds.length
        ? supabase
            .from("companies")
            .select("id, name")
            .in("id", companyIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

  const contractsById = new Map(
    (contracts ?? []).map((item) => [item.id, item])
  );
  const businessCasesById = new Map(
    (businessCases ?? []).map((item) => [item.id, item])
  );
  const companiesById = new Map(
    (companies ?? []).map((item) => [item.id, item])
  );

  return rows.map((row) => {
    const contract = contractsById.get(row.contract_id) ?? null;
    const companyId = row.company_id ?? contract?.company_id ?? null;
    return {
      ...row,
      company_id: companyId,
      contract: contract
        ? {
            id: contract.id,
            contract_number: contract.contract_number,
            title: contract.title,
            company_id: contract.company_id ?? null,
          }
        : null,
      business_case: row.business_case_id
        ? (businessCasesById.get(row.business_case_id) ?? null)
        : null,
      company: companyId ? (companiesById.get(companyId) ?? null) : null,
    };
  });
}

async function selectShipments(
  query: (columns: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<{ rows: ShipmentRow[]; error: string | null }> {
  const primary = await query(shipmentColumns);
  if (!primary.error) {
    return {
      rows: (primary.data ?? []).map((row) =>
        normalizeRow(row as Record<string, unknown>)
      ),
      error: null,
    };
  }

  if (!isMissingColumnError(primary.error.message)) {
    return { rows: [], error: formatLoadError(primary.error.message) };
  }

  const legacy = await query(shipmentColumnsLegacy);
  if (legacy.error) {
    return { rows: [], error: formatLoadError(legacy.error.message) };
  }

  return {
    rows: (legacy.data ?? []).map((row) =>
      normalizeRow(row as Record<string, unknown>)
    ),
    error: null,
  };
}

async function filterShipmentsByActiveCompany(shipments: Shipment[]): Promise<Shipment[]> {
  const active = await logisticsActiveCompanyId();
  if (!active) return shipments;
  return shipments.filter((item) => {
    const companyId = item.company_id ?? item.contract?.company_id ?? null;
    return companyId === active;
  });
}

export async function getShipments(): Promise<ShipmentsResult> {
  const supabase = await createClient();
  const activeCompanyId = await logisticsActiveCompanyId();

  const { rows, error } = await selectShipments(async (columns) => {
    let query = supabase
      .from("shipments")
      .select(columns)
      .order("etd", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (activeCompanyId) {
      query = query.eq("company_id", activeCompanyId);
    }

    const result = await query;
    return { data: result.data as unknown[] | null, error: result.error };
  });

  if (error) {
    // Legacy schema without company_id: load unfiltered then filter via contract.
    if (
      activeCompanyId &&
      /company_id|42703|PGRST204|does not exist/i.test(error)
    ) {
      const legacy = await selectShipments(async (columns) => {
        const result = await supabase
          .from("shipments")
          .select(columns)
          .order("etd", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });
        return { data: result.data as unknown[] | null, error: result.error };
      });
      if (legacy.error) {
        return { data: null, stats: null, error: legacy.error };
      }
      const shipments = await filterShipmentsByActiveCompany(
        await hydrateShipments(legacy.rows)
      );
      return { data: shipments, stats: computeStats(shipments), error: null };
    }

    return { data: null, stats: null, error };
  }

  const shipments = await filterShipmentsByActiveCompany(
    await hydrateShipments(rows)
  );

  return {
    data: shipments,
    stats: computeStats(shipments),
    error: null,
  };
}

export async function getShipmentsByContractId(
  contractId: string
): Promise<{ data: Shipment[]; error: string | null }> {
  const supabase = await createClient();
  const activeCompanyId = await logisticsActiveCompanyId();

  const { rows, error } = await selectShipments(async (columns) => {
    let query = supabase
      .from("shipments")
      .select(columns)
      .eq("contract_id", contractId)
      .order("etd", { ascending: false, nullsFirst: false });

    if (activeCompanyId) {
      query = query.eq("company_id", activeCompanyId);
    }

    const result = await query;
    return { data: result.data as unknown[] | null, error: result.error };
  });

  if (error) {
    return { data: [], error };
  }

  return {
    data: await filterShipmentsByActiveCompany(await hydrateShipments(rows)),
    error: null,
  };
}

export async function getShipmentById(id: string): Promise<ShipmentResult> {
  const supabase = await createClient();

  const { rows, error } = await selectShipments(async (columns) => {
    const result = await supabase
      .from("shipments")
      .select(columns)
      .eq("id", id)
      .maybeSingle();
    const data = result.data ? [result.data] : [];
    return { data: data as unknown[], error: result.error };
  });

  if (error) {
    return { data: null, error };
  }

  if (!rows[0]) {
    return { data: null, error: "Shipment not found." };
  }

  const [shipment] = await hydrateShipments([rows[0]]);
  const companyId = shipment.company_id ?? shipment.contract?.company_id ?? null;
  const denied = await assertLogisticsRead(companyId);
  if (denied) {
    return { data: null, error: denied };
  }

  return {
    data: shipment,
    error: null,
  };
}

export type ContractOption = {
  id: string;
  contract_number: string;
  title: string | null;
  company_id: string | null;
  business_case_id: string | null;
};

export type BusinessCaseOption = {
  id: string;
  case_number: string;
  contract_number: string | null;
  company_id: string | null;
};

export async function getContractOptions(): Promise<ContractOption[]> {
  const supabase = await createClient();
  const activeCompanyId = await logisticsActiveCompanyId();

  let query = supabase
    .from("contracts")
    .select("id, contract_number, title, company_id, business_case_id")
    .order("contract_number");

  if (activeCompanyId) {
    query = query.eq("company_id", activeCompanyId);
  }

  const { data, error } = await query;

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    contract_number: row.contract_number,
    title: row.title,
    company_id: row.company_id ?? null,
    business_case_id: row.business_case_id ?? null,
  }));
}

export async function getBusinessCaseOptions(): Promise<BusinessCaseOption[]> {
  const supabase = await createClient();
  const activeCompanyId = await logisticsActiveCompanyId();

  let query = supabase
    .from("business_cases")
    .select("id, case_number, contract_number, company_id")
    .order("case_number");

  if (activeCompanyId) {
    query = query.eq("company_id", activeCompanyId);
  }

  const { data, error } = await query;

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    case_number: row.case_number,
    contract_number: row.contract_number ?? null,
    company_id: row.company_id ?? null,
  }));
}

export { SHIPMENT_STATUSES };
