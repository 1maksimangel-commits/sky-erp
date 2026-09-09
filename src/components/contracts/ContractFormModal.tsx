"use client";
import { ContractPartyFields, ContractLineFields } from "@/components/contracts/ContractLegalFields";

import { AlertCircle, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  ContractDocumentsAttachSection,
  type PendingContractDocument,
} from "@/components/contracts/ContractDocumentsAttachSection";
import { createContract, updateContract } from "@/lib/contracts/actions";
import type { Contract } from "@/lib/contracts/db";
import {
  CONTRACT_STATUSES,
  contractToFormInput,
  emptyContractForm,
  type ContractFormInput,
} from "@/lib/contracts/form-types";
import { validateContractFormInput } from "@/lib/contracts/validation";
import type { Company } from "@/lib/companies";
import type { Product } from "@/lib/products";
import type { Counterparty } from "@/lib/counterparties";
import {
  listLinkedDocuments,
  uploadDocument,
} from "@/lib/documents/actions";
import type { ErpDocument } from "@/lib/documents/types";
import { useResetWhenOpened } from "@/lib/ui/open-state";
import {
  defaultDocumentTitleFromFileName,
} from "@/lib/documents/upload-helpers";
import { validateContractAttachFile } from "@/lib/documents/validation";

type BusinessCaseOption = { id: string; case_number: string; title: string | null };

type ContractFormModalProps = {
  products?: Product[];
  open: boolean;
  contract?: Contract | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  companies: Company[];
  counterparties: Counterparty[];
  businessCases?: BusinessCaseOption[];
  /** Prefill when creating from a Business Case deep link. */
  defaultBusinessCaseId?: string | null;
};

type FormState = {
  parties: NonNullable<ContractFormInput["parties"]>;
  product_lines: NonNullable<ContractFormInput["product_lines"]>;
  legal_snapshot: Record<string, unknown>;
  payment_terms: string;
  delivery_place: string;
  loading_port: string;
  destination_port: string;
  expected_shipment_date: string;
  contract_number: string;
  title: string;
  company_id: string;
  buyer_id: string;
  supplier_id: string;
  consignee_id: string;
  business_case_id: string;
  deal_id: string;
  business_role: string;
  currency: string;
  amount: string;
  incoterms: string;
  contract_date: string;
  expiry_date: string;
  status: string;
};

type SavePhase =
  | "idle"
  | "creating"
  | "updating"
  | "uploading"
  | "finalizing";

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

const labelClassName = "mb-1.5 block text-xs font-medium text-muted-foreground";

const sectionClassName =
  "space-y-4 rounded-lg border border-border bg-accent/10 p-4";

function toFormState(values: ContractFormInput): FormState {
  return {
    parties: values.parties ?? [],
    product_lines: values.product_lines ?? [],
    legal_snapshot: values.legal_snapshot ?? {},
    payment_terms: values.payment_terms ?? "",
    delivery_place: values.delivery_place ?? "",
    loading_port: values.loading_port ?? "",
    destination_port: values.destination_port ?? "",
    expected_shipment_date: values.expected_shipment_date ?? "",
    contract_number: values.contract_number,
    title: values.title ?? "",
    company_id: values.company_id ?? "",
    buyer_id: values.buyer_id ?? "",
    supplier_id: values.supplier_id ?? "",
    consignee_id: values.consignee_id ?? "",
    business_case_id: values.business_case_id ?? "",
    deal_id: values.deal_id ?? values.business_case_id ?? "",
    business_role: values.business_role ?? "",
    currency: values.currency ?? "USD",
    amount: values.amount != null ? String(values.amount) : "",
    incoterms: values.incoterms ?? "",
    contract_date: values.contract_date ?? "",
    expiry_date: values.expiry_date ?? "",
    status: values.status,
  };
}

function toFormInput(form: FormState): ContractFormInput {
  const amount = form.amount.trim();
  const parsedAmount = amount ? Number(amount) : null;

  return {
    parties: form.parties,
    product_lines: form.product_lines,
    legal_snapshot: form.legal_snapshot,
    payment_terms: form.payment_terms || null,
    delivery_place: form.delivery_place || null,
    loading_port: form.loading_port || null,
    destination_port: form.destination_port || null,
    expected_shipment_date: form.expected_shipment_date || null,
    contract_number: form.contract_number.trim(),
    title: form.title.trim() || null,
    company_id: form.company_id,
    buyer_id: form.buyer_id,
    supplier_id: form.supplier_id,
    consignee_id: form.consignee_id,
    business_case_id: form.deal_id.trim() || form.business_case_id.trim() || null,
    deal_id: form.deal_id.trim() || null,
    business_role: null,
    currency: form.currency.trim() || "USD",
    amount:
      parsedAmount != null && Number.isFinite(parsedAmount) ? parsedAmount : null,
    incoterms: form.incoterms.trim() || null,
    contract_date: form.contract_date || null,
    expiry_date: form.expiry_date || null,
    status: form.status.trim(),
  };
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClassName}>
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={sectionClassName}>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function mergeSelectedCompany(
  companies: Company[],
  contract: Contract | null | undefined
): Company[] {
  if (!contract?.company) {
    return companies;
  }

  if (companies.some((item) => item.id === contract.company!.id)) {
    return companies;
  }

  return [
    {
      id: contract.company.id,
      business_role: null,
      name: contract.company.name,
      code: "",
      short_name: null,
      country: null,
      city: null,
      address: null,
      tax_id: null,
      registration_number: null,
      email: null,
      phone: null,
      website: null,
      authorized_signer_name: null,
      authorized_signer_title: null,
      seal_document_id: null,
      signature_document_id: null,
      bank_accounts: [],
      is_active: false,
    },
    ...companies,
  ];
}

function buildSuccessMessage(input: {
  isEditing: boolean;
  uploadedCount: number;
  failedCount: number;
  failedNames: string[];
}): string {
  const base = input.isEditing
    ? "Contract updated successfully"
    : "Contract created successfully";

  if (input.failedCount > 0) {
    const names =
      input.failedNames.length > 0
        ? ` (${input.failedNames.join(", ")})`
        : "";
    return `${input.isEditing ? "Contract updated" : "Contract created"}, but ${input.failedCount} document${input.failedCount === 1 ? "" : "s"} failed to upload${names}.`;
  }

  if (input.uploadedCount > 0) {
    return `${base}. ${input.uploadedCount} document${input.uploadedCount === 1 ? "" : "s"} uploaded`;
  }

  return base;
}

export function ContractFormModal({
  open,
  contract,
  onClose,
  onSaved,
  companies,
  products = [],
  counterparties,
  businessCases = [],
  defaultBusinessCaseId = null,
}: ContractFormModalProps) {
  const isEditing = Boolean(contract);
  const [form, setForm] = useState<FormState>(() =>
    toFormState(emptyContractForm())
  );
  const [pendingDocs, setPendingDocs] = useState<PendingContractDocument[]>(
    []
  );
  const [existingDocs, setExistingDocs] = useState<ErpDocument[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savePhase, setSavePhase] = useState<SavePhase>("idle");
  const [uploadIndex, setUploadIndex] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [persistedContractId, setPersistedContractId] = useState<string | null>(
    null
  );
  const submittingRef = useRef(false);

  const companyOptions = mergeSelectedCompany(companies, contract);

  useResetWhenOpened(open, () => {
    const next = toFormState(
      contract ? contractToFormInput(contract) : emptyContractForm()
    );
    if (!contract && defaultBusinessCaseId?.trim()) {
      next.business_case_id = defaultBusinessCaseId.trim();
      next.deal_id = defaultBusinessCaseId.trim();
    }
    setForm(next);
    setPendingDocs([]);
    setExistingDocs([]);
    setError(null);
    setSavePhase("idle");
    setUploadIndex(0);
    setUploadTotal(0);
    setPersistedContractId(null);
    submittingRef.current = false;
  });

  const existingLoadKey = open && contract?.id ? contract.id : null;
  const [prevExistingLoadKey, setPrevExistingLoadKey] = useState(existingLoadKey);
  if (existingLoadKey !== prevExistingLoadKey) {
    setPrevExistingLoadKey(existingLoadKey);
    setLoadingExisting(Boolean(existingLoadKey));
  }

  useEffect(() => {
    if (!open || !contract?.id) {
      return;
    }

    let cancelled = false;

    void listLinkedDocuments("contract", contract.id).then((result) => {
      if (cancelled) return;
      setExistingDocs(result.data);
      setLoadingExisting(false);
      if (result.error) {
        setError(result.error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, contract?.id]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose, saving]);

  if (!open) {
    return null;
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function patchPending(
    localId: string,
    patch: Partial<PendingContractDocument>
  ) {
    setPendingDocs((current) =>
      current.map((item) =>
        item.localId === localId ? { ...item, ...patch } : item
      )
    );
  }

  async function uploadPendingDocuments(contractId: string) {
    const queue = pendingDocs.filter((item) => item.status !== "done");
    setUploadTotal(queue.length);
    let uploadedCount = 0;
    const failedNames: string[] = [];

    for (let index = 0; index < queue.length; index += 1) {
      const item = queue[index];
      setUploadIndex(index + 1);
      setSavePhase("uploading");
      patchPending(item.localId, {
        status: "uploading",
        progress: 20,
        error: undefined,
      });

      const formData = new FormData();
      formData.set("file", item.file);
      formData.set(
        "title",
        item.title.trim() || defaultDocumentTitleFromFileName(item.file.name)
      );
      formData.set("document_type", item.documentType || "contract");
      formData.set("version", "1");

      const progressTimer = window.setInterval(() => {
        setPendingDocs((current) =>
          current.map((entry) =>
            entry.localId === item.localId && entry.status === "uploading"
              ? {
                  ...entry,
                  progress: entry.progress >= 85 ? entry.progress : entry.progress + 8,
                }
              : entry
          )
        );
      }, 200);

      try {
        const result = await uploadDocument({
          entityType: "contract",
          entityId: contractId,
          contractId,
          documentType: item.documentType || "contract",
          title:
            item.title.trim() ||
            defaultDocumentTitleFromFileName(item.file.name),
          version: 1,
          formData,
        });

        window.clearInterval(progressTimer);

        if (!result.success) {
          failedNames.push(item.file.name);
          patchPending(item.localId, {
            status: "error",
            progress: 0,
            error: result.error,
          });
          continue;
        }

        uploadedCount += 1;
        patchPending(item.localId, {
          status: "done",
          progress: 100,
          error: undefined,
        });
      } catch (uploadError) {
        window.clearInterval(progressTimer);
        failedNames.push(item.file.name);
        patchPending(item.localId, {
          status: "error",
          progress: 0,
          error:
            uploadError instanceof Error
              ? uploadError.message
              : "Upload failed.",
        });
      }
    }

    return { uploadedCount, failedNames };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current || saving) {
      return;
    }

    const validationError = validateContractFormInput(toFormInput(form));
    if (validationError) {
      setError(validationError);
      return;
    }

    for (const item of pendingDocs) {
      const fileError = validateContractAttachFile(item.file);
      if (fileError) {
        setError(`${item.file.name}: ${fileError}`);
        return;
      }
      if (!item.documentType) {
        setError(`${item.file.name}: Document type is required.`);
        return;
      }
    }

    submittingRef.current = true;
    setSaving(true);
    setError(null);

    const input = toFormInput(form);
    const existingId = contract?.id ?? persistedContractId;
    setSavePhase(existingId ? "updating" : "creating");

    const result = existingId
      ? await updateContract(existingId, input)
      : await createContract(input);

    if (!result.success) {
      setSaving(false);
      setSavePhase("idle");
      submittingRef.current = false;
      setError(result.error);
      return;
    }

    const contractId = result.id ?? existingId;
    if (!contractId) {
      setSaving(false);
      setSavePhase("idle");
      submittingRef.current = false;
      setError("Contract saved but no ID was returned.");
      return;
    }

    if (!contract?.id) {
      setPersistedContractId(contractId);
    }

    let uploadedCount = 0;
    let failedNames: string[] = [];

    const remainingUploads = pendingDocs.filter(
      (item) => item.status !== "done"
    );
    if (remainingUploads.length > 0) {
      const uploadResult = await uploadPendingDocuments(contractId);
      uploadedCount = uploadResult.uploadedCount;
      failedNames = uploadResult.failedNames;
    }

    setSavePhase("finalizing");

    const message = buildSuccessMessage({
      isEditing: Boolean(contract),
      uploadedCount,
      failedCount: failedNames.length,
      failedNames,
    });

    if (failedNames.length > 0) {
      setError(message);
      setSaving(false);
      setSavePhase("idle");
      submittingRef.current = false;
      onSaved(message);
      return;
    }

    setSaving(false);
    setSavePhase("idle");
    submittingRef.current = false;
    onSaved(message);
    onClose();
  }

  const saveLabel =
    savePhase === "creating"
      ? "Creating contract..."
      : savePhase === "updating"
        ? "Updating contract..."
        : savePhase === "uploading"
          ? `Uploading document ${uploadIndex} of ${uploadTotal}...`
          : savePhase === "finalizing"
            ? "Finalizing..."
            : saving
              ? "Saving..."
              : "Save";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={saving ? undefined : onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-form-title"
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2
              id="contract-form-title"
              className="text-base font-semibold text-foreground"
            >
              {isEditing ? "Edit Contract" : "New Contract"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isEditing
                ? "Update contract details and attach documents"
                : "Create a purchase or sales agreement"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            {error ? (
              <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            ) : null}

            <Section title="General">
              <Field label="Contract Number" required>
                <input
                  type="text"
                  value={form.contract_number}
                  onChange={(e) =>
                    updateField("contract_number", e.target.value)
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="Title">
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Owning workspace" required>
                <select
                  value={form.company_id}
                  onChange={(e) => updateField("company_id", e.target.value)}
                  className={inputClassName}
                >
                  <option value="">Select company</option>
                  {companyOptions.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Business Case">
                <select
                  value={form.business_case_id}
                  onChange={(e) =>
                    setForm(current => ({ ...current, business_case_id: e.target.value, deal_id: e.target.value }))
                  }
                  className={inputClassName}
                >
                  <option value="">No business case</option>
                  {businessCases.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.case_number}
                      {item.title ? ` — ${item.title}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </Section>
            <ContractPartyFields value={form.parties} onChange={parties => updateField("parties", parties)} companies={companies} counterparties={counterparties} />
            <ContractLineFields value={form.product_lines} onChange={lines => updateField("product_lines", lines)} currency={form.currency} products={products} />

            <Section title="Commercial">
              {(["payment_terms", "delivery_place", "loading_port", "destination_port", "expected_shipment_date"] as const).map(field => <Field key={field} label={field.replaceAll("_", " ")}><input className={inputClassName} type={field.endsWith("date") ? "date" : "text"} value={form[field]} onChange={event => updateField(field, event.target.value)} /></Field>)}
              <Field label="Commercial notes"><textarea className={inputClassName} value={typeof form.legal_snapshot.notes === "string" ? form.legal_snapshot.notes : ""} onChange={event => updateField("legal_snapshot", { ...form.legal_snapshot, notes: event.target.value })} /></Field>
              <Field label="Currency">
                <select
                  value={form.currency}
                  onChange={(e) => updateField("currency", e.target.value)}
                  className={inputClassName}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CNY">CNY</option>
                  <option value="JPY">JPY</option>
                </select>
              </Field>
              <Field label="Amount">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => updateField("amount", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Incoterms">
                  <input
                    type="text"
                    value={form.incoterms}
                    onChange={(e) => updateField("incoterms", e.target.value)}
                    placeholder="CFR, FOB, CIF..."
                    className={inputClassName}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Dates">
              <Field label="Contract Date">
                <input
                  type="date"
                  value={form.contract_date}
                  onChange={(e) =>
                    updateField("contract_date", e.target.value)
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="Expiry Date">
                <input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => updateField("expiry_date", e.target.value)}
                  className={inputClassName}
                />
              </Field>
            </Section>

            <Section title="Status">
              <Field label="Status" required>
                <select
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value)}
                  className={inputClassName}
                >
                  {CONTRACT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>
            </Section>

            <ContractDocumentsAttachSection
              pending={pendingDocs}
              onChange={setPendingDocs}
              existingDocuments={existingDocs}
              loadingExisting={loadingExisting}
              disabled={saving}
              isEditing={isEditing}
            />
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {saveLabel}
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
