import "server-only";
import { createHash, randomUUID } from "crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { can, getAccessContext } from "@/lib/platform/permissions";
import { getContractById, type Contract } from "@/lib/contracts/db";
import { contractDocumentValues } from "./source";
import { inspectDocx, renderDocx } from "./docx-engine";
import { isCanonicalVariable, scalarAt, variableLabel } from "./variables";
import { DOCUMENT_TEMPLATE_TYPES, type DocumentTemplate } from "./types";

export const generationInput = z.object({
  templateId: z.string().uuid(), contractId: z.string().uuid().optional(),
  documentType: z.enum(DOCUMENT_TEMPLATE_TYPES),
  details: z.object({ number: z.string().trim().max(120).default(""), date: z.string().date(), notes: z.string().max(20000).default(""), supplementReference: z.string().max(120).default("") }),
  preview: z.boolean().default(false), test: z.boolean().default(false), reviewHash: z.string().optional(), supersedesId: z.string().uuid().optional(),
  amendment: z.object({ paymentTerms: z.string().max(10000).optional(), deliveryTerms: z.string().max(10000).optional(),
    products: z.array(z.object({ product_id: z.string().uuid().nullable(), description: z.string().trim().min(1), quantity: z.number().positive(), unit: z.string().min(1), unit_price: z.number().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/), net_weight: z.number().nonnegative().nullable().optional(), gross_weight: z.number().nonnegative().nullable().optional(), size_grade: z.string().nullable().optional(), packing: z.string().nullable().optional(), origin: z.string().nullable().optional(), notes: z.string().nullable().optional(), agreed_amount: z.number().nullable().optional(), id: z.string().uuid().optional() })).min(1).optional(),
  }).optional(),
}).strict();
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function fictionalContract(): Contract {
  return { id: "00000000-0000-4000-8000-000000000001", company_id: null, contract_number: "FICTIONAL-CONTRACT-001", contract_date: "2026-01-15", title: "Fictional test only", status: "Draft", currency: "USD", amount: 1400, incoterms: "FOB", payment_terms: "Fictional 30 days", delivery_place: "Fictional Test Port", legal_snapshot: { delivery_terms: "Fictional shipment terms" },
    expiry_date: null, destination_port: null, loading_port: null, expected_shipment_date: null, business_case_id: null, deal_id: null, business_role: null, company: null, buyer: null, supplier: null, consignee: null,
    parties: ["seller", "buyer", "consignee", "payer", "beneficiary"].map((role, i) => ({ role_code: z.enum(["seller", "buyer", "consignee", "payer", "beneficiary"]).parse(role), internal_company_id: null, counterparty_id: null, snapshot: { legal_name: `FICTIONAL ${role.toUpperCase()} LTD`, address: `${i+1} Fictional Street`, bank_name: "FICTIONAL BANK", bank_account: "TEST-NOT-A-REAL-ACCOUNT", bank_swift: "TESTONLY", bank_address: "Fictional Bank Street", signatory_name: "Fictional Person", signatory_title: "Test Director" } })),
    product_lines: ["Pacific Cod", "Pollock", "Halibut"].map((name, i) => ({ product_id: null, description: `Fictional ${name}`, quantity: (i+1)*10, unit: "kg", unit_price: 10, currency: "USD", net_weight: (i+1)*10, gross_weight: (i+1)*11 })),
  };
}

export async function prepareGeneration(raw: unknown) {
  const input = generationInput.parse(raw);
  if (!input.test && !["contract", "supplement", "invoice"].includes(input.documentType)) throw new Error("This phase supports Contract, Supplement and Commercial Invoice generation.");
  const context = await getAccessContext();
  if (!context?.hasAccess) throw new Error("Authentication required.");
  const client = await createClient();
  const templateResult = await client.from("document_templates").select("*").eq("id", input.templateId).single();
  if (templateResult.error || !templateResult.data) throw new Error("Template is unavailable.");
  const template = templateResult.data as unknown as DocumentTemplate;
  if (!template.is_active || template.document_type !== input.documentType) throw new Error("Choose an active template for this document type.");
  let contract: Contract;
  if (input.test) contract = fictionalContract();
  else {
    if (!input.contractId) throw new Error("Select a Contract with reviewed legal parties.");
    const loaded = await getContractById(input.contractId);
    if (loaded.error || !loaded.data) throw new Error(loaded.error ?? "Contract unavailable.");
    contract = loaded.data;
  }
  const ownerId = input.test ? template.company_id ?? context.companyId : contract.company_id;
  if (!await can("documents.write", ownerId)) throw new Error("Document generation is not permitted for this company.");
  const companyIds = [contract.company_id, ...contract.parties.filter(p => p.role_code === "seller" || p.role_code === "buyer").map(p => p.internal_company_id)].filter(Boolean);
  if (!input.test && template.company_id && !companyIds.includes(template.company_id)) throw new Error("Template belongs to a company outside this Contract.");
  let previous: { id: string; document_number: string; version: number } | null = null;
  if (input.supersedesId) {
    const found = await client.from("generated_documents").select("id,contract_id,document_type,document_number,version").eq("id", input.supersedesId).single();
    if (found.error || !found.data || found.data.contract_id !== contract.id || found.data.document_type !== input.documentType) throw new Error("Previous version does not match the selected Contract and document type.");
    previous = found.data;
  }
  const number = previous?.document_number || (input.documentType === "contract" ? contract.contract_number : input.details.number || `${input.documentType === "invoice" ? "INV" : "SUP"}-${randomUUID()}`);
  const details = { ...input.details, number, date: input.documentType === "contract" ? contract.contract_date ?? input.details.date : input.details.date };
  let deal: { number: string; title: string } | undefined;
  if (!input.test && contract.deal_id) {
    const loaded = await client.from("business_cases").select("case_number,title").eq("id", contract.deal_id).single();
    if (loaded.error) throw new Error("Linked Deal is unavailable.");
    deal = { number: loaded.data.case_number, title: loaded.data.title ?? "" };
  }
  if (input.amendment && input.documentType !== "supplement") throw new Error("Amendments are only supported for Supplements.");
  const amended = input.amendment ? { ...contract, product_lines: input.amendment.products ?? contract.product_lines, payment_terms: input.amendment.paymentTerms ?? contract.payment_terms, legal_snapshot: { ...contract.legal_snapshot, delivery_terms: input.amendment.deliveryTerms ?? contract.legal_snapshot.delivery_terms } } : contract;
  if (amended.product_lines.some(line => line.currency !== amended.currency)) throw new Error("Product currencies must match the document currency before calculating a total.");
  const values = contractDocumentValues(amended, details, deal);
  const path = template.configured_storage_path || template.storage_path;
  if (!path) throw new Error("Upload a DOCX version of this template first.");
  const download = await client.storage.from("documents").download(path);
  if (download.error || !download.data) throw new Error("Template original is unavailable.");
  const bytes = new Uint8Array(await download.data.arrayBuffer());
  const fileHash = digest(bytes);
  const expectedHash = template.configured_storage_path ? template.configured_hash : template.original_hash;
  if (!expectedHash) throw new Error("Replace this legacy template with a verified DOCX upload before generating. Its original is retained.");
  if (expectedHash && expectedHash !== fileHash) throw new Error("Template checksum mismatch; generation stopped.");
  const inspection = inspectDocx(bytes);
  const mappingResult = await client.from("template_mappings").select("placeholder,sky_variable,required").eq("template_id", template.id);
  if (mappingResult.error) throw new Error(mappingResult.error.message);
  const mappings = Object.fromEntries((mappingResult.data ?? []).filter(m => m.sky_variable).map(m => [m.placeholder, String(m.sky_variable)]));
  const missing: string[] = [];
  if (!inspection.placeholders.length) missing.push("Configure the example values in this template before generating.");
  for (const placeholder of inspection.placeholders) {
    const key = placeholder.replace(/^[#^/]/, "");
    if (!isCanonicalVariable(mappings[key] || key)) missing.push(`Configure the custom field “${key}” in this template.`);
  }
  for (const m of mappingResult.data ?? []) if (m.required) {
    const key = m.sky_variable || m.placeholder;
    if (key.startsWith("product.")) {
      if (!values.products.length || values.products.some(line => scalarAt(line, key.slice(8)) === "")) missing.push(`${variableLabel(key)} is required by this template.`);
    } else if (scalarAt(values, key) === "") missing.push(`${variableLabel(key)} is required by this template.`);
  }
  const reviewHash = digest(JSON.stringify({ values, templateId: template.id, templateVersion: template.version, fileHash, mappings, required: mappingResult.data, supersedesId: input.supersedesId }));
  return { input, client, context, template, contract, ownerId, bytes, values, mappings, missing: [...new Set(missing)], reviewHash, previous, fileHash };
}

export async function generateDocument(raw: unknown) {
  const prepared = await prepareGeneration(raw);
  const { input, client, template, contract, ownerId, mappings, bytes, reviewHash } = prepared;
  if (input.preview) return { preview: true as const, values: prepared.values, reviewHash, missing: prepared.missing };
  if (prepared.missing.length) throw new Error(prepared.missing.join(" "));
  if (!input.test && input.reviewHash !== reviewHash) throw new Error("Source data or template changed. Review the current values before generating.");
  const id = randomUUID();
  const number = prepared.values.document.number === "Assigned when generated" ? `${input.documentType === "invoice" ? "INV" : "SUP"}-${id}` : prepared.values.document.number;
  const values = { ...prepared.values, document: { ...prepared.values.document, number }, invoice: { ...prepared.values.invoice, number }, supplement: { ...prepared.values.supplement, number } };
  const output = renderDocx(bytes, values, mappings);
  if (input.test) return { test: true as const, bytes: output };
  if (!ownerId) throw new Error("An owning company is required.");
  const path = `companies/${ownerId}/generated/${id}/document.docx`;
  const uploaded = await client.storage.from("documents").upload(path, output, { contentType: DOCX_MIME, upsert: false });
  if (uploaded.error) throw new Error(uploaded.error.message);
  const snapshot = { values, templateHash: prepared.fileHash, templateVersion: template.version, mappings, oneOff: input.details, amendment: input.amendment ?? null, reviewedHash: reviewHash };
  const saved = await client.from("generated_documents").insert({ id, company_id: ownerId, contract_id: contract.id, deal_id: contract.deal_id, business_case_id: contract.deal_id,
    document_type: input.documentType, document_number: number, title: `${input.documentType === "invoice" ? "Commercial Invoice" : input.documentType} ${number}`, source_template_id: template.id, source_template_version: template.version,
    status: "Draft", snapshot_data: snapshot, snapshot_hash: digest(JSON.stringify(snapshot)), output_hash: digest(output), docx_storage_path: path, storage_path: path, supersedes_id: input.supersedesId ?? null }).select("id,document_number,version").single();
  if (saved.error || !saved.data) throw new Error(saved.error?.code === "23505" ? "This document number or version already exists. Open its history and generate a new version." : saved.error?.message ?? "Unable to retain generated document.");
  return { id: saved.data.id, number: saved.data.document_number, version: saved.data.version, downloadUrl: `/api/documents/generated/${saved.data.id}` };
}
