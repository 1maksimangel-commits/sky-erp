"use client";

import {
  AlertCircle,
  Download,
  Loader2,
  RefreshCw,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ConfidenceField } from "@/components/contracts/import/ConfidenceField";
import type { Company } from "@/lib/companies";
import {
  asBoolean,
  asNumber,
  asString,
  type ContractExtractionResult,
  type ExtractedField,
  type ExtractedProductLine,
} from "@/lib/ai/contracts/schema";
import {
  confirmContractImport,
  createCounterpartyFromImport,
  createProductFromImport,
} from "@/lib/contracts/import/actions";
import { reextractContractImportViaApi } from "@/lib/contracts/import/browser-upload";
import {
  extractionToFormDefaults,
  validateImportReview,
} from "@/lib/contracts/import/review-validation";
import type {
  ContractImportRecord,
  ReviewedProductLine,
} from "@/lib/contracts/import/types";
import {
  CONTRACT_STATUSES,
  emptyContractForm,
  type ContractFormInput,
} from "@/lib/contracts/form-types";
import type { Counterparty } from "@/lib/counterparties";
import type { Product } from "@/lib/products";

type ContractImportReviewWorkspaceProps = {
  importRecord: ContractImportRecord;
  previewUrl: string | null;
  companies: Company[];
  counterparties: Counterparty[];
  products: Product[];
  onClose: () => void;
  onCompleted: (message: string, href?: string) => void;
};

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

function fieldDisplay(field: ExtractedField<unknown> | null | undefined): string {
  const value = field?.value;
  if (value == null || value === "") {
    return "Not extracted — can be completed later";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function buildProductCreate(
  line: ExtractedProductLine | undefined,
  currency: string,
  lineIndex: number
): NonNullable<ReviewedProductLine["create"]> {
  return {
    sku: asString(line?.sku) ?? "",
    name:
      asString(line?.product_name) ||
      asString(line?.description) ||
      `Line ${lineIndex + 1}`,
    scientific_name: asString(line?.scientific_name),
    size: asString(line?.size),
    hs_code: asString(line?.hs_code),
    brand: asString(line?.brand),
    country: asString(line?.country_of_origin),
    currency: asString(line?.currency) ?? currency,
    sale_price: asNumber(line?.unit_price),
    description: asString(line?.description),
  };
}

function buildProductLines(
  extraction: ContractExtractionResult | null,
  matches: ContractImportRecord["match_json"],
  currency: string
): ReviewedProductLine[] {
  if (matches?.products?.length) {
    return matches.products.map((line) => {
      const extracted = extraction?.products[line.lineIndex];
      return {
        lineIndex: line.lineIndex,
        action:
          line.state === "exact"
            ? "link"
            : line.state === "ignore"
              ? "ignore"
              : line.state === "create" || line.state === "none"
                ? "create"
                : "link",
        productId: line.selectedProductId,
        quantity: line.quantity ?? asNumber(extracted?.quantity) ?? 0,
        create: buildProductCreate(extracted, currency, line.lineIndex),
      };
    });
  }

  return (extraction?.products ?? []).map((line, index) => ({
    lineIndex: index,
    action: "create" as const,
    productId: null,
    quantity: asNumber(line.quantity) ?? 0,
    create: buildProductCreate(line, currency, index),
  }));
}

export function ContractImportReviewWorkspace({
  importRecord: initialRecord,
  previewUrl: initialPreviewUrl,
  companies,
  counterparties,
  products,
  onClose,
  onCompleted,
}: ContractImportReviewWorkspaceProps) {
  const initialExtraction = initialRecord.extraction_json;
  const initialMatches = initialRecord.match_json;

  const [importRecord, setImportRecord] = useState(initialRecord);
  const [previewUrl, setPreviewUrl] = useState(initialPreviewUrl);
  const [form, setForm] = useState<ContractFormInput>(() => {
    if (!initialExtraction) return emptyContractForm();
    return {
      ...extractionToFormDefaults(initialExtraction),
      company_id: initialMatches?.company.selectedId ?? null,
      buyer_id: initialMatches?.buyer.selectedId ?? null,
      supplier_id: initialMatches?.supplier.selectedId ?? null,
    };
  });
  const [companyId, setCompanyId] = useState(
    initialMatches?.company.selectedId ?? ""
  );
  const [buyerId, setBuyerId] = useState(initialMatches?.buyer.selectedId ?? "");
  const [supplierId, setSupplierId] = useState(
    initialMatches?.supplier.selectedId ?? ""
  );
  const [productLines, setProductLines] = useState<ReviewedProductLine[]>(() =>
    buildProductLines(
      initialExtraction,
      initialMatches,
      (asString(initialExtraction?.commercial.currency) || "USD").toUpperCase()
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reextracting, setReextracting] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [search, setSearch] = useState("");
  const [activePage, setActivePage] = useState(1);
  const [localCounterparties, setLocalCounterparties] =
    useState(counterparties);
  const [localProducts, setLocalProducts] = useState(products);
  const submittingRef = useRef(false);

  const extraction = importRecord.extraction_json;
  const matches = importRecord.match_json;

  const pageTexts = useMemo(() => {
    const text = importRecord.extracted_text || "";
    return text
      .split(/\n----- PAGE \d+ -----\n|\n\n/)
      .map((part) => part.trim())
      .filter(Boolean);
  }, [importRecord.extracted_text]);

  const validation = useMemo(
    () =>
      validateImportReview({
        payload: {
          importId: importRecord.id,
          form: {
            ...form,
            company_id: companyId || null,
            buyer_id: buyerId || null,
            supplier_id: supplierId || null,
          },
          matches: {
            companyId: companyId || null,
            buyerId: buyerId || null,
            supplierId: supplierId || null,
            consigneeId: null,
          },
          productLines,
        },
        extraction,
      }),
    [
      importRecord.id,
      form,
      companyId,
      buyerId,
      supplierId,
      productLines,
      extraction,
    ]
  );

  const filteredText = useMemo(() => {
    const source = importRecord.extracted_text || "";
    if (!source.trim()) return "";
    if (!search.trim()) return source.slice(0, 4000);
    const idx = source.toLowerCase().indexOf(search.trim().toLowerCase());
    if (idx < 0) return "No matches in extracted text.";
    return source.slice(Math.max(0, idx - 120), idx + 400);
  }, [importRecord.extracted_text, search]);

  function focusSourcePage(page: number | null) {
    if (page != null && page > 0) setActivePage(page);
  }

  function updateForm<K extends keyof ContractFormInput>(
    key: K,
    value: ContractFormInput[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateProductLine(
    lineIndex: number,
    patch: Partial<ReviewedProductLine>
  ) {
    setProductLines((current) =>
      current.map((item) =>
        item.lineIndex === lineIndex ? { ...item, ...patch } : item
      )
    );
  }

  async function handleCreateCounterparty(role: "buyer" | "supplier") {
    if (!extraction) return;

    const legalName =
      role === "buyer"
        ? matches?.buyer.extractedName ||
          asString(extraction.buyer.buyer_legal_name)
        : matches?.supplier.extractedName ||
          asString(extraction.supplier.supplier_legal_name);

    if (!legalName) {
      setError(`Cannot create ${role}: no legal name extracted.`);
      return;
    }

    const address =
      role === "buyer"
        ? asString(extraction.buyer.buyer_address)
        : asString(extraction.supplier.supplier_address);
    const registrationNumber =
      role === "buyer"
        ? asString(extraction.buyer.buyer_registration_number)
        : asString(extraction.supplier.supplier_registration_number);
    const taxId =
      role === "buyer"
        ? asString(extraction.buyer.buyer_tax_id)
        : asString(extraction.supplier.supplier_tax_id);
    const email =
      role === "buyer"
        ? asString(extraction.buyer.buyer_email)
        : asString(extraction.supplier.supplier_email);
    const phone =
      role === "buyer"
        ? asString(extraction.buyer.buyer_phone)
        : asString(extraction.supplier.supplier_phone);
    const shortName =
      role === "buyer"
        ? asString(extraction.buyer.buyer_short_name)
        : asString(extraction.supplier.supplier_short_name);
    const country =
      role === "buyer"
        ? asString(extraction.buyer.buyer_country)
        : asString(extraction.supplier.supplier_country);
    const city =
      role === "buyer"
        ? asString(extraction.buyer.buyer_city)
        : asString(extraction.supplier.supplier_city);

    setError(null);
    const result = await createCounterpartyFromImport({
      legalName,
      address,
      registrationNumber,
      taxId,
      email,
      phone,
      type: role === "buyer" ? "Buyer" : "Supplier",
    });

    if (!result.success) {
      setError(result.error);
      return;
    }

    const created: Counterparty = {
      id: result.data.id,
      source_company_id: null,
      code: null,
      legal_name: legalName,
      short_name: shortName,
      counterparty_type: role === "buyer" ? "Buyer" : "Supplier",
      country,
      city,
      address,
      tax_id: taxId,
      registration_number: registrationNumber,
      email,
      phone,
      website: null,
      authorized_signer_name: null,
      authorized_signer_title: null,
      bank_account_name: null,
      bank_name: null,
      bank_address: null,
      account_number: null,
      iban: null,
      swift: null,
      bank_currency: "USD",
      is_active: true,
    };

    setLocalCounterparties((current) => [created, ...current]);
    if (role === "buyer") setBuyerId(result.data.id);
    else setSupplierId(result.data.id);
  }

  async function handleCreateProduct(lineIndex: number) {
    const line = productLines.find((item) => item.lineIndex === lineIndex);
    if (!line?.create?.name) return;

    setError(null);
    const result = await createProductFromImport({
      sku: line.create.sku,
      name: line.create.name,
      scientificName: line.create.scientific_name,
      size: line.create.size,
      hsCode: line.create.hs_code,
      brand: line.create.brand,
      country: line.create.country,
      currency: line.create.currency,
      salePrice: line.create.sale_price,
      description: line.create.description,
    });

    if (!result.success) {
      setError(result.error);
      return;
    }

    setLocalProducts((current) => [
      {
        id: result.data.id,
        sku: line.create?.sku || "NEW",
        name: line.create!.name,
        scientific_name: line.create?.scientific_name ?? null,
        category: null,
        country: line.create?.country ?? null,
        size: line.create?.size ?? null,
        purchase_price: null,
        sale_price: line.create?.sale_price ?? null,
        currency: line.create?.currency ?? null,
        image_url: null,
        is_active: true,
      },
      ...current,
    ]);

    updateProductLine(lineIndex, {
      action: "link",
      productId: result.data.id,
    });
  }

  async function handleReextract() {
    setReextracting(true);
    setError(null);
    try {
      const result = await reextractContractImportViaApi(importRecord.id);
      const nextRecord = result.importRecord;
      const nextExtraction = nextRecord.extraction_json;
      const nextMatches = nextRecord.match_json;

      setImportRecord(nextRecord);
      setPreviewUrl(result.previewUrl);

      if (nextExtraction) {
        const nextForm = {
          ...extractionToFormDefaults(nextExtraction),
          company_id: nextMatches?.company.selectedId ?? null,
          buyer_id: nextMatches?.buyer.selectedId ?? null,
          supplier_id: nextMatches?.supplier.selectedId ?? null,
        };
        setForm(nextForm);
        setCompanyId(nextMatches?.company.selectedId ?? "");
        setBuyerId(nextMatches?.buyer.selectedId ?? "");
        setSupplierId(nextMatches?.supplier.selectedId ?? "");
        setProductLines(
          buildProductLines(nextExtraction, nextMatches, nextForm.currency)
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-extraction failed.");
    } finally {
      setReextracting(false);
    }
  }

  async function handleConfirm(saveAsDraft = false) {
    if (submittingRef.current || saving) return;
    if (!saveAsDraft && validation.errors.length > 0) {
      setError(validation.errors.map((item) => item.message).join(" "));
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    setError(null);

    const result = await confirmContractImport({
      importId: importRecord.id,
      form: {
        ...form,
        company_id: companyId || null,
        buyer_id: buyerId || null,
        supplier_id: supplierId || null,
      },
      matches: {
        companyId: companyId || null,
        buyerId: buyerId || null,
        supplierId: supplierId || null,
        consigneeId: null,
      },
      productLines,
      saveAsDraft,
    });

    setSaving(false);
    submittingRef.current = false;

    if (!result.success) {
      setError(result.error);
      return;
    }

    onCompleted(result.data.message, result.data.href);
    onClose();
  }

  if (!extraction) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-red-300">
            Extraction data is missing for this import.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-md border border-border px-3 py-1.5 text-sm text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">
            Review imported contract
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {importRecord.file_name} · Edit every field before creating the
            contract
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={saving || reextracting}
            onClick={() => void handleReextract()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground disabled:opacity-50"
          >
            {reextracting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Re-extract
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleConfirm(true)}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleConfirm(false)}
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Confirm and Create Contract
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col border-r border-border">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <button
              type="button"
              onClick={() => setZoom((value) => Math.max(60, value - 10))}
              className="rounded border border-border p-1 text-foreground"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-muted-foreground">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom((value) => Math.min(160, value + 10))}
              className="rounded border border-border p-1 text-foreground"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            {previewUrl ? (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                download={importRecord.file_name || "contract.pdf"}
                className="ml-2 inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-foreground"
              >
                <Download className="h-3.5 w-3.5" />
                Download original
              </a>
            ) : null}
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-xs text-foreground"
                onClick={() => setActivePage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span className="text-xs text-muted-foreground">
                Page {activePage}
              </span>
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-xs text-foreground"
                onClick={() => setActivePage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-black/40 p-3">
            {previewUrl ? (
              <iframe
                title="Contract PDF preview"
                src={`${previewUrl}#page=${activePage}`}
                className="mx-auto h-full min-h-[70vh] w-full rounded border border-border bg-white"
                style={{ width: `${zoom}%`, maxWidth: "100%" }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                PDF preview unavailable.
              </p>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="mb-2 flex items-center gap-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search extracted text"
                className={inputClassName}
              />
            </div>
            <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded border border-border bg-accent/10 p-2 text-[11px] text-muted-foreground">
              {filteredText || pageTexts[0] || "No extracted text."}
            </pre>
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto px-4 py-4">
          <div className="space-y-5">
            <section className="space-y-3 rounded-lg border border-border p-3">
              <h3 className="text-sm font-medium text-foreground">General</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <ConfidenceField
                  label="Contract number"
                  field={extraction.general.contract_number}
                  onFocusSource={focusSourcePage}
                >
                  <input
                    className={inputClassName}
                    value={form.contract_number}
                    onChange={(e) =>
                      updateForm("contract_number", e.target.value)
                    }
                  />
                </ConfidenceField>
                <ConfidenceField
                  label="Title"
                  field={extraction.general.title}
                  onFocusSource={focusSourcePage}
                >
                  <input
                    className={inputClassName}
                    value={form.title ?? ""}
                    onChange={(e) =>
                      updateForm("title", e.target.value || null)
                    }
                  />
                </ConfidenceField>
                <ConfidenceField
                  label="Contract type"
                  field={extraction.general.contract_type}
                  onFocusSource={focusSourcePage}
                >
                  <input
                    className={inputClassName}
                    value={fieldDisplay(extraction.general.contract_type)}
                    readOnly
                  />
                </ConfidenceField>
                <ConfidenceField
                  label="Language"
                  field={extraction.general.language}
                  onFocusSource={focusSourcePage}
                >
                  <input
                    className={inputClassName}
                    value={fieldDisplay(extraction.general.language)}
                    readOnly
                  />
                </ConfidenceField>
                <ConfidenceField
                  label="Contract date"
                  field={extraction.general.contract_date}
                  onFocusSource={focusSourcePage}
                >
                  <input
                    type="date"
                    className={inputClassName}
                    value={form.contract_date ?? ""}
                    onChange={(e) =>
                      updateForm("contract_date", e.target.value || null)
                    }
                  />
                </ConfidenceField>
                <ConfidenceField
                  label="Expiry date"
                  field={extraction.general.expiry_date}
                  onFocusSource={focusSourcePage}
                >
                  <input
                    type="date"
                    className={inputClassName}
                    value={form.expiry_date ?? ""}
                    onChange={(e) =>
                      updateForm("expiry_date", e.target.value || null)
                    }
                  />
                </ConfidenceField>
                <ConfidenceField
                  label="Status"
                  field={extraction.general.status}
                  onFocusSource={focusSourcePage}
                >
                  <select
                    className={inputClassName}
                    value={form.status}
                    onChange={(e) => updateForm("status", e.target.value)}
                  >
                    {CONTRACT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </ConfidenceField>
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-border p-3">
              <h3 className="text-sm font-medium text-foreground">Parties</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs text-muted-foreground">
                    Company (internal)
                    {matches?.company.state
                      ? ` · ${matches.company.state} match`
                      : ""}
                    {matches?.company.extractedName
                      ? ` · extracted: ${matches.company.extractedName}`
                      : ""}
                  </label>
                  <select
                    className={inputClassName}
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                  >
                    <option value="">Select company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  {matches?.company.requiresConfirmation ? (
                    <p className="text-[11px] text-amber-300">
                      Probable/multiple company matches — confirm selection.
                    </p>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["company_legal_name", "Legal name"],
                        ["company_registration_number", "Registration no."],
                        ["company_tax_id", "Tax ID"],
                        ["company_address", "Address"],
                      ] as const
                    ).map(([key, label]) => (
                      <ConfidenceField
                        key={key}
                        label={label}
                        field={extraction.company[key]}
                        onFocusSource={focusSourcePage}
                      >
                        <input
                          className={inputClassName}
                          value={fieldDisplay(extraction.company[key])}
                          readOnly
                        />
                      </ConfidenceField>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs text-muted-foreground">
                      Buyer
                      {matches?.buyer.state
                        ? ` · ${matches.buyer.state} match`
                        : ""}
                      {matches?.buyer.extractedName
                        ? ` · extracted: ${matches.buyer.extractedName}`
                        : ""}
                    </label>
                    <button
                      type="button"
                      className="text-[11px] text-foreground underline"
                      onClick={() => void handleCreateCounterparty("buyer")}
                    >
                      Create new counterparty
                    </button>
                  </div>
                  <select
                    className={inputClassName}
                    value={buyerId}
                    onChange={(e) => setBuyerId(e.target.value)}
                  >
                    <option value="">Select buyer</option>
                    {localCounterparties.map((party) => (
                      <option key={party.id} value={party.id}>
                        {party.legal_name}
                      </option>
                    ))}
                  </select>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["buyer_legal_name", "Legal name"],
                        ["buyer_registration_number", "Registration no."],
                        ["buyer_tax_id", "Tax ID"],
                        ["buyer_address", "Address"],
                        ["buyer_country", "Country"],
                        ["buyer_city", "City"],
                        ["buyer_contact", "Contact"],
                        ["buyer_email", "Email"],
                        ["buyer_phone", "Phone"],
                      ] as const
                    ).map(([key, label]) => (
                      <ConfidenceField
                        key={key}
                        label={label}
                        field={extraction.buyer[key]}
                        onFocusSource={focusSourcePage}
                      >
                        <input
                          className={inputClassName}
                          value={fieldDisplay(extraction.buyer[key])}
                          readOnly
                        />
                      </ConfidenceField>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs text-muted-foreground">
                      Supplier
                      {matches?.supplier.state
                        ? ` · ${matches.supplier.state} match`
                        : ""}
                      {matches?.supplier.extractedName
                        ? ` · extracted: ${matches.supplier.extractedName}`
                        : ""}
                    </label>
                    <button
                      type="button"
                      className="text-[11px] text-foreground underline"
                      onClick={() => void handleCreateCounterparty("supplier")}
                    >
                      Create new counterparty
                    </button>
                  </div>
                  <select
                    className={inputClassName}
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                  >
                    <option value="">Select supplier</option>
                    {localCounterparties.map((party) => (
                      <option key={party.id} value={party.id}>
                        {party.legal_name}
                      </option>
                    ))}
                  </select>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["supplier_legal_name", "Legal name"],
                        ["supplier_registration_number", "Registration no."],
                        ["supplier_tax_id", "Tax ID"],
                        ["supplier_address", "Address"],
                        ["supplier_country", "Country"],
                        ["supplier_city", "City"],
                        ["supplier_contact", "Contact"],
                        ["supplier_email", "Email"],
                        ["supplier_phone", "Phone"],
                      ] as const
                    ).map(([key, label]) => (
                      <ConfidenceField
                        key={key}
                        label={label}
                        field={extraction.supplier[key]}
                        onFocusSource={focusSourcePage}
                      >
                        <input
                          className={inputClassName}
                          value={fieldDisplay(extraction.supplier[key])}
                          readOnly
                        />
                      </ConfidenceField>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs text-muted-foreground">
                    Consignee
                    {matches?.consignee.extractedName
                      ? ` · extracted: ${matches.consignee.extractedName}`
                      : ""}
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["consignee_legal_name", "Legal name"],
                        ["consignee_address", "Address"],
                        ["notify_party", "Notify party"],
                      ] as const
                    ).map(([key, label]) => (
                      <ConfidenceField
                        key={key}
                        label={label}
                        field={extraction.consignee[key]}
                        onFocusSource={focusSourcePage}
                      >
                        <input
                          className={inputClassName}
                          value={fieldDisplay(extraction.consignee[key])}
                          readOnly
                        />
                      </ConfidenceField>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-border p-3">
              <h3 className="text-sm font-medium text-foreground">Commercial</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <ConfidenceField
                  label="Currency"
                  field={extraction.commercial.currency}
                  onFocusSource={focusSourcePage}
                >
                  <select
                    className={inputClassName}
                    value={form.currency}
                    onChange={(e) => updateForm("currency", e.target.value)}
                  >
                    {["USD", "EUR", "GBP", "CNY", "JPY"].map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </ConfidenceField>
                <ConfidenceField
                  label="Total amount"
                  field={extraction.commercial.total_amount}
                  onFocusSource={focusSourcePage}
                >
                  <input
                    type="number"
                    className={inputClassName}
                    value={form.amount ?? ""}
                    onChange={(e) =>
                      updateForm(
                        "amount",
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                  />
                </ConfidenceField>
                <ConfidenceField
                  label="Incoterms"
                  field={extraction.commercial.incoterms}
                  onFocusSource={focusSourcePage}
                >
                  <input
                    className={inputClassName}
                    value={form.incoterms ?? ""}
                    onChange={(e) =>
                      updateForm("incoterms", e.target.value || null)
                    }
                  />
                </ConfidenceField>
                <ConfidenceField
                  label="Incoterms location"
                  field={extraction.commercial.incoterms_location}
                  onFocusSource={focusSourcePage}
                >
                  <input
                    className={inputClassName}
                    value={fieldDisplay(extraction.commercial.incoterms_location)}
                    readOnly
                  />
                </ConfidenceField>
                <ConfidenceField
                  label="Payment terms"
                  field={extraction.commercial.payment_terms}
                  onFocusSource={focusSourcePage}
                >
                  <input
                    className={inputClassName}
                    value={fieldDisplay(extraction.commercial.payment_terms)}
                    readOnly
                  />
                </ConfidenceField>
                <ConfidenceField
                  label="Advance payment %"
                  field={extraction.commercial.advance_payment_percent}
                  onFocusSource={focusSourcePage}
                >
                  <input
                    className={inputClassName}
                    value={fieldDisplay(
                      extraction.commercial.advance_payment_percent
                    )}
                    readOnly
                  />
                </ConfidenceField>
                <ConfidenceField
                  label="Balance payment %"
                  field={extraction.commercial.balance_payment_percent}
                  onFocusSource={focusSourcePage}
                >
                  <input
                    className={inputClassName}
                    value={fieldDisplay(
                      extraction.commercial.balance_payment_percent
                    )}
                    readOnly
                  />
                </ConfidenceField>
                <ConfidenceField
                  label="Delivery deadline"
                  field={extraction.commercial.delivery_deadline}
                  onFocusSource={focusSourcePage}
                >
                  <input
                    className={inputClassName}
                    value={fieldDisplay(extraction.commercial.delivery_deadline)}
                    readOnly
                  />
                </ConfidenceField>
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-border p-3">
              <h3 className="text-sm font-medium text-foreground">Logistics</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["port_of_loading", "Port of loading"],
                    ["port_of_discharge", "Port of discharge"],
                    ["final_destination", "Final destination"],
                    ["shipment_period", "Shipment period"],
                    ["vessel", "Vessel"],
                    ["voyage", "Voyage"],
                    ["container_requirements", "Container requirements"],
                    ["temperature_requirements", "Temperature requirements"],
                  ] as const
                ).map(([key, label]) => (
                  <ConfidenceField
                    key={key}
                    label={label}
                    field={extraction.logistics[key]}
                    onFocusSource={focusSourcePage}
                  >
                    <input
                      className={inputClassName}
                      value={fieldDisplay(extraction.logistics[key])}
                      readOnly
                    />
                  </ConfidenceField>
                ))}
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-border p-3">
              <h3 className="text-sm font-medium text-foreground">Products</h3>
              {productLines.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No product lines extracted.
                </p>
              ) : (
                <div className="space-y-3">
                  {productLines.map((line) => {
                    const extractedLine = extraction.products[line.lineIndex];
                    return (
                      <div
                        key={line.lineIndex}
                        className="space-y-3 rounded-md border border-border bg-accent/10 p-3"
                      >
                        <div>
                          <p className="text-sm text-foreground">
                            {asString(extractedLine?.product_name) ||
                              asString(extractedLine?.description) ||
                              `Line ${line.lineIndex + 1}`}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {[
                              asString(extractedLine?.sku),
                              asString(extractedLine?.grade),
                              asString(extractedLine?.size),
                              asString(extractedLine?.packaging),
                              asNumber(extractedLine?.unit_price) != null
                                ? `${asNumber(extractedLine?.unit_price)} ${asString(extractedLine?.price_unit) || form.currency}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "No extra product details"}
                          </p>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3">
                          <select
                            className={inputClassName}
                            value={line.action}
                            onChange={(e) =>
                              updateProductLine(line.lineIndex, {
                                action: e.target
                                  .value as ReviewedProductLine["action"],
                              })
                            }
                          >
                            <option value="link">Link product</option>
                            <option value="create">Create product</option>
                            <option value="ignore">Ignore line</option>
                          </select>
                          <input
                            type="number"
                            className={inputClassName}
                            value={line.quantity}
                            onChange={(e) =>
                              updateProductLine(line.lineIndex, {
                                quantity: Number(e.target.value) || 0,
                              })
                            }
                            placeholder="Quantity"
                          />
                          {line.action === "link" ? (
                            <select
                              className={inputClassName}
                              value={line.productId ?? ""}
                              onChange={(e) =>
                                updateProductLine(line.lineIndex, {
                                  productId: e.target.value || null,
                                })
                              }
                            >
                              <option value="">Select product</option>
                              {localProducts.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.sku} — {product.name}
                                </option>
                              ))}
                            </select>
                          ) : line.action === "create" ? (
                            <button
                              type="button"
                              className="rounded-md border border-border px-3 py-2 text-xs text-foreground"
                              onClick={() =>
                                void handleCreateProduct(line.lineIndex)
                              }
                            >
                              Create missing product
                            </button>
                          ) : (
                            <span className="flex items-center text-xs text-muted-foreground">
                              Line ignored
                            </span>
                          )}
                        </div>

                        {line.action === "create" ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              className={inputClassName}
                              placeholder="SKU (optional)"
                              value={line.create?.sku ?? ""}
                              onChange={(e) =>
                                updateProductLine(line.lineIndex, {
                                  create: {
                                    ...buildProductCreate(
                                      extractedLine,
                                      form.currency,
                                      line.lineIndex
                                    ),
                                    ...line.create,
                                    sku: e.target.value,
                                  },
                                })
                              }
                            />
                            <input
                              className={inputClassName}
                              placeholder="Product name"
                              value={line.create?.name ?? ""}
                              onChange={(e) =>
                                updateProductLine(line.lineIndex, {
                                  create: {
                                    ...buildProductCreate(
                                      extractedLine,
                                      form.currency,
                                      line.lineIndex
                                    ),
                                    ...line.create,
                                    name: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                        ) : null}

                        <div className="grid gap-2 sm:grid-cols-3">
                          {(
                            [
                              ["quantity", "Qty"],
                              ["quantity_unit", "Unit"],
                              ["net_weight_kg", "Net kg"],
                              ["gross_weight_kg", "Gross kg"],
                              ["unit_price", "Unit price"],
                              ["line_amount", "Line amount"],
                              ["hs_code", "HS code"],
                              ["country_of_origin", "Origin"],
                              ["brand", "Brand"],
                            ] as const
                          ).map(([key, label]) => (
                            <ConfidenceField
                              key={key}
                              label={label}
                              field={extractedLine?.[key]}
                              onFocusSource={focusSourcePage}
                            >
                              <input
                                className={inputClassName}
                                value={fieldDisplay(extractedLine?.[key])}
                                readOnly
                              />
                            </ConfidenceField>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-lg border border-border p-3">
              <h3 className="text-sm font-medium text-foreground">Signatures</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["seller_signature_present", "Seller signature"],
                    ["buyer_signature_present", "Buyer signature"],
                    ["seller_seal_present", "Seller seal"],
                    ["buyer_seal_present", "Buyer seal"],
                  ] as const
                ).map(([key, label]) => {
                  const field = extraction.signatures[key];
                  const boolValue = asBoolean(field);
                  return (
                    <ConfidenceField
                      key={key}
                      label={label}
                      field={field}
                      onFocusSource={focusSourcePage}
                    >
                      <input
                        className={inputClassName}
                        value={
                          boolValue == null
                            ? fieldDisplay(field)
                            : boolValue
                              ? "Present"
                              : "Not present"
                        }
                        readOnly
                      />
                    </ConfidenceField>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2 rounded-lg border border-border bg-accent/10 p-3">
              <h3 className="text-sm font-medium text-foreground">Warnings</h3>
              {validation.errors.length === 0 &&
              validation.warnings.length === 0 &&
              importRecord.warnings.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No validation warnings.
                </p>
              ) : (
                <>
                  {validation.errors.map((item) => (
                    <p
                      key={`e-${item.code}`}
                      className="flex gap-2 text-xs text-red-300"
                    >
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Error: {item.message}
                    </p>
                  ))}
                  {[
                    ...validation.warnings.map((w) => w.message),
                    ...importRecord.warnings,
                  ].map((message, index) => (
                    <p key={`w-${index}`} className="text-xs text-amber-300">
                      Warning: {message}
                    </p>
                  ))}
                </>
              )}
              <p className="pt-1 text-[11px] text-muted-foreground">
                Fields marked “review” are optional AI suggestions and do not
                block continuation. Only errors listed above must be corrected.
              </p>
              <p className="pt-1 text-[11px] text-muted-foreground">
                Original PDF will be linked to the new contract as document type
                “contract” on confirm.
              </p>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
