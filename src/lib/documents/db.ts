import { createClient } from "@/lib/supabase/server";
import type {
  DocumentLibraryStats,
  DocumentListFilters,
  DocumentVersion,
  ErpDocument,
} from "@/lib/documents/types";
import { filterOwnedDocumentsForSigning } from "@/lib/documents/signed-url-auth";
import { assertCan } from "@/lib/platform/permissions";
import {
  isNextDynamicServerError,
  logSupabaseError,
  serializeUnknownError,
} from "@/lib/platform/supabase-errors";

/** Apply in Supabase SQL Editor when DMS columns (e.g. file_path) are missing. */
export const DOCUMENTS_DMS_MIGRATION =
  "supabase/migrations/20260804220000_documents_missing_columns_hotfix.sql";

/**
 * Full DMS select — only works after migration adds file_path / tags / created_at / etc.
 */
const DOCUMENT_DMS_COLUMNS = `
  id, entity_type, entity_id, document_type, title, file_name, file_path, storage_path,
  mime_type, file_size, version, version_no, tags, notes, uploaded_by, created_by,
  created_at, updated_at, uploaded_at, is_current, root_document_id,
  business_case_id, contract_id, shipment_id, invoice_id, payment_id,
  company_id, counterparty_id, product_id
`;

/**
 * Compatible with the pre-DMS live schema (uses storage_path, version_no, uploaded_at).
 * Avoids selecting file_path / created_at / tags / is_current / payment_id / product_id.
 */
const DOCUMENT_COMPAT_COLUMNS = `
  id, entity_type, entity_id, document_type, title, file_name, storage_path,
  mime_type, file_size, notes, uploaded_by, uploaded_at, version_no,
  business_case_id, contract_id, shipment_id, invoice_id, company_id, counterparty_id
`;

const DOCUMENT_MINIMAL_COLUMNS = `
  id, entity_type, entity_id, document_type, title, file_name, storage_path,
  mime_type, file_size, notes, uploaded_by, uploaded_at
`;

export type DocumentsQueryResult = {
  data: ErpDocument[];
  error: string | null;
  diagnostic: ReturnType<typeof serializeUnknownError> | null;
  /** Soft warning when schema is behind the DMS migration (page still renders). */
  schemaWarning: string | null;
};

function emptyResult(
  error: string | null,
  diagnostic: ReturnType<typeof serializeUnknownError> | null = null,
  schemaWarning: string | null = null
): DocumentsQueryResult {
  return { data: [], error, diagnostic, schemaWarning };
}

function isMissingColumnError(error: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    /column .* does not exist/i.test(error.message ?? "") ||
    /Could not find the .* column/i.test(error.message ?? "") ||
    /PGRST204/i.test(error.message ?? "")
  );
}

function migrationMessage(error: {
  message?: unknown;
  code?: unknown;
  hint?: unknown;
} | null): string {
  const detail = error?.message ? ` Database error: ${String(error.message)}` : "";
  const hint = error?.hint ? ` Hint: ${String(error.hint)}` : "";
  return (
    `Documents schema is incomplete (DMS columns such as file_path are missing).` +
    ` Apply ${DOCUMENTS_DMS_MIGRATION} in the Supabase SQL Editor, then reload.` +
    detail +
    hint
  );
}

export function normalizeDocument(row: Record<string, unknown>): ErpDocument {
  const filePath =
    (row.file_path as string | null) ??
    (row.storage_path as string | null) ??
    null;

  return {
    id: String(row.id),
    entity_type: (row.entity_type as string | null) ?? null,
    entity_id: (row.entity_id as string | null) ?? null,
    document_type: (row.document_type as string | null) ?? null,
    title: (row.title as string | null) ?? null,
    file_name: (row.file_name as string | null) ?? null,
    file_path: filePath,
    storage_path: (row.storage_path as string | null) ?? filePath,
    mime_type: (row.mime_type as string | null) ?? null,
    file_size: toNumber(row.file_size),
    version: toNumber(row.version) ?? toNumber(row.version_no) ?? 1,
    tags: normalizeTags(row.tags),
    notes: (row.notes as string | null) ?? null,
    uploaded_by:
      (row.uploaded_by as string | null) ??
      (row.created_by as string | null) ??
      null,
    created_at:
      (row.created_at as string | null) ??
      (row.uploaded_at as string | null) ??
      null,
    updated_at:
      (row.updated_at as string | null) ??
      (row.uploaded_at as string | null) ??
      null,
    uploaded_at: (row.uploaded_at as string | null) ?? null,
    is_current: row.is_current === false ? false : true,
    root_document_id: (row.root_document_id as string | null) ?? String(row.id),
    business_case_id: (row.business_case_id as string | null) ?? null,
    contract_id: (row.contract_id as string | null) ?? null,
    shipment_id: (row.shipment_id as string | null) ?? null,
    invoice_id: (row.invoice_id as string | null) ?? null,
    payment_id: (row.payment_id as string | null) ?? null,
    company_id: (row.company_id as string | null) ?? null,
    counterparty_id: (row.counterparty_id as string | null) ?? null,
    product_id: (row.product_id as string | null) ?? null,
  };
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function applyClientFilters(
  rows: ErpDocument[],
  filters: DocumentListFilters
): ErpDocument[] {
  let next = rows;

  if (filters.currentOnly !== false) {
    next = next.filter((item) => item.is_current !== false);
  }
  if (filters.entityType && filters.entityType !== "all") {
    next = next.filter((item) => item.entity_type === filters.entityType);
  }
  if (filters.documentType && filters.documentType !== "all") {
    next = next.filter((item) => item.document_type === filters.documentType);
  }
  if (filters.uploadedBy && filters.uploadedBy !== "all") {
    next = next.filter((item) => item.uploaded_by === filters.uploadedBy);
  }
  if (filters.fileType && filters.fileType !== "all") {
    const ft = filters.fileType.toLowerCase();
    next = next.filter((item) =>
      (item.file_name ?? "").toLowerCase().endsWith(`.${ft}`)
    );
  }
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom).getTime();
    next = next.filter((item) => {
      const ts = new Date(item.created_at ?? item.uploaded_at ?? 0).getTime();
      return ts >= from;
    });
  }
  if (filters.dateTo) {
    const to = new Date(`${filters.dateTo}T23:59:59`).getTime();
    next = next.filter((item) => {
      const ts = new Date(item.created_at ?? item.uploaded_at ?? 0).getTime();
      return ts <= to;
    });
  }

  const q = filters.query?.trim().toLowerCase();
  if (q) {
    next = next.filter((item) =>
      [
        item.title,
        item.file_name,
        item.document_type,
        item.entity_type,
        item.entity_label,
        item.notes,
        item.uploaded_by,
        ...(item.tags ?? []),
      ].some((field) => field?.toLowerCase().includes(q))
    );
  }

  return next;
}

async function enrichEntityLabels(rows: ErpDocument[]): Promise<ErpDocument[]> {
  if (!rows.length) return rows;

  try {
    const supabase = await createClient();

    const idsByType = {
      business_case: new Set<string>(),
      contract: new Set<string>(),
      shipment: new Set<string>(),
      invoice: new Set<string>(),
      company: new Set<string>(),
      counterparty: new Set<string>(),
      product: new Set<string>(),
    };

    for (const row of rows) {
      if (!row.entity_id || !row.entity_type) continue;
      if (row.entity_type in idsByType) {
        idsByType[row.entity_type as keyof typeof idsByType].add(row.entity_id);
      }
    }

    const [
      cases,
      contracts,
      shipments,
      invoices,
      companies,
      counterparties,
      products,
    ] = await Promise.all([
      idsByType.business_case.size
        ? supabase
            .from("business_cases")
            .select("id, case_number")
            .in("id", [...idsByType.business_case])
        : Promise.resolve({ data: [] as { id: string; case_number: string }[] }),
      idsByType.contract.size
        ? supabase
            .from("contracts")
            .select("id, contract_number")
            .in("id", [...idsByType.contract])
        : Promise.resolve({
            data: [] as { id: string; contract_number: string }[],
          }),
      idsByType.shipment.size
        ? supabase
            .from("shipments")
            .select("id, container")
            .in("id", [...idsByType.shipment])
        : Promise.resolve({
            data: [] as { id: string; container: string | null }[],
          }),
      idsByType.invoice.size
        ? supabase
            .from("invoices")
            .select("id, invoice_number")
            .in("id", [...idsByType.invoice])
        : Promise.resolve({
            data: [] as { id: string; invoice_number: string }[],
          }),
      idsByType.company.size
        ? supabase
            .from("companies")
            .select("id, name")
            .in("id", [...idsByType.company])
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      idsByType.counterparty.size
        ? supabase
            .from("counterparties")
            .select("id, legal_name")
            .in("id", [...idsByType.counterparty])
        : Promise.resolve({
            data: [] as { id: string; legal_name: string }[],
          }),
      idsByType.product.size
        ? supabase
            .from("products")
            .select("id, name, sku")
            .in("id", [...idsByType.product])
        : Promise.resolve({
            data: [] as { id: string; name: string; sku: string | null }[],
          }),
    ]);

    const labels = new Map<string, string>();
    for (const item of cases.data ?? []) {
      labels.set(`business_case:${item.id}`, item.case_number);
    }
    for (const item of contracts.data ?? []) {
      labels.set(`contract:${item.id}`, item.contract_number);
    }
    for (const item of shipments.data ?? []) {
      labels.set(`shipment:${item.id}`, item.container || item.id.slice(0, 8));
    }
    for (const item of invoices.data ?? []) {
      labels.set(`invoice:${item.id}`, item.invoice_number);
    }
    for (const item of companies.data ?? []) {
      labels.set(`company:${item.id}`, item.name);
    }
    for (const item of counterparties.data ?? []) {
      labels.set(`counterparty:${item.id}`, item.legal_name);
    }
    for (const item of products.data ?? []) {
      labels.set(
        `product:${item.id}`,
        item.sku ? `${item.sku} — ${item.name}` : item.name
      );
    }

    return rows.map((row) => ({
      ...row,
      entity_label:
        row.entity_type && row.entity_id
          ? (labels.get(`${row.entity_type}:${row.entity_id}`) ?? null)
          : null,
    }));
  } catch (error) {
    if (isNextDynamicServerError(error)) throw error;
    logSupabaseError("documents.enrichEntityLabels", error);
    return rows;
  }
}

type QueryAttempt = {
  columns: string;
  orderColumn: "created_at" | "uploaded_at";
  label: string;
};

async function queryDocumentsTable(
  attempts: QueryAttempt[],
  limit: number
): Promise<{
  rows: Record<string, unknown>[];
  schemaWarning: string | null;
  diagnostic: ReturnType<typeof serializeUnknownError> | null;
  fatalError: ReturnType<typeof serializeUnknownError> | null;
  usedLabel: string | null;
}> {
  const supabase = await createClient();
  let lastError: ReturnType<typeof serializeUnknownError> | null = null;
  let schemaWarning: string | null = null;

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from("documents")
      .select(attempt.columns)
      .order(attempt.orderColumn, { ascending: false, nullsFirst: false })
      .limit(limit);

    if (!error) {
      return {
        rows: (data ?? []) as unknown as Record<string, unknown>[],
        schemaWarning,
        diagnostic: lastError,
        fatalError: null,
        usedLabel: attempt.label,
      };
    }

    logSupabaseError(`documents.listDocuments.${attempt.label}`, error);
    lastError = serializeUnknownError(error);

    if (isMissingColumnError(error)) {
      schemaWarning = migrationMessage(error);
      continue;
    }

    // Non-schema errors (network, RLS, etc.) — stop and surface.
    return {
      rows: [],
      schemaWarning: null,
      diagnostic: lastError,
      fatalError: lastError,
      usedLabel: null,
    };
  }

  return {
    rows: [],
    schemaWarning:
      schemaWarning ??
      (lastError ? migrationMessage(lastError) : migrationMessage(null)),
    diagnostic: lastError,
    fatalError: null,
    usedLabel: null,
  };
}

async function probeDmsSchema(): Promise<{
  ready: boolean;
  warning: string | null;
  diagnostic: ReturnType<typeof serializeUnknownError> | null;
}> {
  try {
    const supabase = await createClient();
    // file_path is the column that currently fails in production (42703).
    const { error } = await supabase
      .from("documents")
      .select("file_path")
      .limit(1);

    if (!error) {
      return { ready: true, warning: null, diagnostic: null };
    }

    const diagnostic = serializeUnknownError(error);
    logSupabaseError("documents.probeDmsSchema", error);

    if (isMissingColumnError(error)) {
      return {
        ready: false,
        warning: migrationMessage(error),
        diagnostic,
      };
    }

    // Unexpected probe failure — still try compat reads.
    return {
      ready: false,
      warning: null,
      diagnostic,
    };
  } catch (error) {
    if (isNextDynamicServerError(error)) throw error;
    logSupabaseError("documents.probeDmsSchema.throw", error);
    return {
      ready: false,
      warning: null,
      diagnostic: serializeUnknownError(error),
    };
  }
}

export async function listDocuments(
  filters: DocumentListFilters = {}
): Promise<DocumentsQueryResult> {
  const limit = filters.limit ?? 300;

  try {
    const probe = await probeDmsSchema();
    const attempts: QueryAttempt[] = probe.ready
      ? [
          {
            columns: DOCUMENT_DMS_COLUMNS,
            orderColumn: "created_at",
            label: "dms",
          },
          {
            columns: DOCUMENT_COMPAT_COLUMNS,
            orderColumn: "uploaded_at",
            label: "compat",
          },
          {
            columns: DOCUMENT_MINIMAL_COLUMNS,
            orderColumn: "uploaded_at",
            label: "minimal",
          },
        ]
      : [
          {
            columns: DOCUMENT_COMPAT_COLUMNS,
            orderColumn: "uploaded_at",
            label: "compat",
          },
          {
            columns: DOCUMENT_MINIMAL_COLUMNS,
            orderColumn: "uploaded_at",
            label: "minimal",
          },
        ];

    const result = await queryDocumentsTable(attempts, limit);

    if (result.usedLabel) {
      const rows = applyClientFilters(
        result.rows.map((row) => normalizeDocument(row)),
        filters
      );
      return {
        data: await enrichEntityLabels(rows),
        error: null,
        diagnostic: result.diagnostic ?? probe.diagnostic,
        schemaWarning:
          result.usedLabel === "dms"
            ? null
            : result.schemaWarning ?? probe.warning,
      };
    }

    // Schema incomplete and every select failed — still do not throw.
    if ((result.schemaWarning || probe.warning) && !result.fatalError) {
      return {
        data: [],
        error: null,
        diagnostic: result.diagnostic ?? probe.diagnostic,
        schemaWarning: result.schemaWarning ?? probe.warning,
      };
    }

    return emptyResult(
      result.fatalError?.message ??
        result.schemaWarning ??
        probe.warning ??
        "Failed to load documents.",
      result.diagnostic ?? probe.diagnostic,
      result.schemaWarning ?? probe.warning
    );
  } catch (error) {
    if (isNextDynamicServerError(error)) throw error;
    logSupabaseError("documents.listDocuments.throw", error);
    const diagnostic = serializeUnknownError(error);
    return emptyResult(diagnostic.message, diagnostic, null);
  }
}

export async function getDocumentLibraryStats(
  documents: ErpDocument[]
): Promise<DocumentLibraryStats> {
  const current = documents.filter((item) => item.is_current !== false);
  return {
    total: current.length,
    contracts: current.filter((item) => item.entity_type === "contract").length,
    logistics: current.filter((item) => item.entity_type === "shipment").length,
    finance: current.filter((item) =>
      ["invoice", "payment"].includes(item.entity_type ?? "")
    ).length,
    certificates: current.filter((item) =>
      /certificate|origin|veterinary|health/i.test(item.document_type ?? "")
    ).length,
  };
}

export async function getEntityDocuments(
  entityType: string,
  entityId: string
): Promise<DocumentsQueryResult> {
  try {
    const supabase = await createClient();
    const probe = await probeDmsSchema();
    const orFilter = [
      `and(entity_type.eq.${entityType},entity_id.eq.${entityId})`,
      `business_case_id.eq.${entityId}`,
      `contract_id.eq.${entityId}`,
      `shipment_id.eq.${entityId}`,
      `invoice_id.eq.${entityId}`,
      `company_id.eq.${entityId}`,
      `counterparty_id.eq.${entityId}`,
    ].join(",");

    const attempts: Array<{
      columns: string;
      orderColumn: "created_at" | "uploaded_at";
      label: string;
      or?: string;
    }> = probe.ready
      ? [
          {
            columns: DOCUMENT_DMS_COLUMNS,
            orderColumn: "created_at",
            label: "dms",
            or: [
              orFilter,
              `payment_id.eq.${entityId}`,
              `product_id.eq.${entityId}`,
            ].join(","),
          },
          {
            columns: DOCUMENT_COMPAT_COLUMNS,
            orderColumn: "uploaded_at",
            label: "compat",
            or: orFilter,
          },
        ]
      : [
          {
            columns: DOCUMENT_COMPAT_COLUMNS,
            orderColumn: "uploaded_at",
            label: "compat",
            or: orFilter,
          },
          {
            columns: DOCUMENT_MINIMAL_COLUMNS,
            orderColumn: "uploaded_at",
            label: "minimal",
            or: `and(entity_type.eq.${entityType},entity_id.eq.${entityId}),contract_id.eq.${entityId},business_case_id.eq.${entityId}`,
          },
        ];

    let schemaWarning: string | null = probe.warning;
    let lastError: ReturnType<typeof serializeUnknownError> | null =
      probe.diagnostic;

    for (const attempt of attempts) {
      const { data, error } = await supabase
        .from("documents")
        .select(attempt.columns)
        .or(attempt.or ?? orFilter)
        .order(attempt.orderColumn, { ascending: false, nullsFirst: false });

      if (!error) {
        return {
          data: ((data ?? []) as unknown as Record<string, unknown>[])
            .map((row) => normalizeDocument(row))
            .filter((item) => item.is_current !== false),
          error: null,
          diagnostic: lastError,
          schemaWarning: attempt.label === "dms" ? null : schemaWarning,
        };
      }

      logSupabaseError(`documents.getEntityDocuments.${attempt.label}`, error);
      lastError = serializeUnknownError(error);
      if (isMissingColumnError(error)) {
        schemaWarning = migrationMessage(error);
        continue;
      }

      return emptyResult(error.message, lastError, schemaWarning);
    }

    return {
      data: [],
      error: null,
      diagnostic: lastError,
      schemaWarning:
        schemaWarning ?? lastError?.message ?? "Failed to load documents.",
    };
  } catch (error) {
    if (isNextDynamicServerError(error)) throw error;
    const diagnostic = serializeUnknownError(error);
    return emptyResult(diagnostic.message, diagnostic, null);
  }
}

export async function getDocumentVersions(
  documentId: string
): Promise<{ data: DocumentVersion[]; error: string | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("document_versions")
      .select(
        "id, document_id, version, title, file_name, file_path, mime_type, file_size, notes, uploaded_by, is_current, created_at"
      )
      .eq("document_id", documentId)
      .order("version", { ascending: false });

    if (error) {
      logSupabaseError("documents.getDocumentVersions", error);
      if (
        /document_versions|schema cache|PGRST205|does not exist/i.test(
          error.message
        )
      ) {
        return { data: [], error: null };
      }
      return { data: [], error: error.message };
    }

    return {
      data: (data ?? []).map((row) => ({
        id: row.id,
        document_id: row.document_id,
        version: Number(row.version) || 1,
        title: row.title,
        file_name: row.file_name,
        file_path: row.file_path,
        mime_type: row.mime_type,
        file_size: row.file_size == null ? null : Number(row.file_size),
        notes: row.notes,
        uploaded_by: row.uploaded_by,
        is_current: Boolean(row.is_current),
        created_at: row.created_at,
      })),
      error: null,
    };
  } catch (error) {
    if (isNextDynamicServerError(error)) throw error;
    return { data: [], error: serializeUnknownError(error).message };
  }
}

export async function getDocumentSignedUrls(
  documents: Array<{
    id: string;
    file_path?: string | null;
    storage_path?: string | null;
    company_id?: string | null;
  }>
): Promise<{ urls: Record<string, string>; error: string | null }> {
  const denied = assertCan("documents.read");
  if (denied) {
    return { urls: {}, error: denied };
  }

  const owned = filterOwnedDocumentsForSigning(documents);
  const withPath = owned.filter((doc) => doc.file_path || doc.storage_path);
  if (!withPath.length) return { urls: {}, error: null };

  try {
    const supabase = await createClient();
    const entries = await Promise.all(
      withPath.map(async (document) => {
        const path = document.file_path || document.storage_path;
        if (!path) return [document.id, ""] as const;
        try {
          const { data, error } = await supabase.storage
            .from("documents")
            .createSignedUrl(path, 60 * 60);
          if (error) {
            logSupabaseError(`documents.signedUrl path=${path}`, error);
            return [document.id, ""] as const;
          }
          return [document.id, data?.signedUrl ?? ""] as const;
        } catch (error) {
          logSupabaseError(`documents.signedUrl.throw path=${path}`, error);
          return [document.id, ""] as const;
        }
      })
    );

    return {
      urls: Object.fromEntries(entries.filter(([, url]) => Boolean(url))),
      error: null,
    };
  } catch (error) {
    if (isNextDynamicServerError(error)) throw error;
    return { urls: {}, error: serializeUnknownError(error).message };
  }
}
