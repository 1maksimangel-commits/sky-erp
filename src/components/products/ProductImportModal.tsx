"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Package,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { checkExistingSkus, importProducts } from "@/lib/products/actions";
import {
  applyDatabaseSkuConflicts,
  IMPORT_STEPS,
  parseProductExcel,
  type ImportStep,
  type ParsedImportRow,
} from "@/lib/products/import";
import { useResetWhenOpened } from "@/lib/ui/open-state";

type ProductImportModalProps = {
  open: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
};

function StepIndicator({ current }: { current: ImportStep }) {
  const currentIndex = IMPORT_STEPS.findIndex((step) => step.id === current);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {IMPORT_STEPS.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = step.id === current;

        return (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                isCurrent
                  ? "bg-foreground text-background"
                  : isComplete
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-accent text-muted-foreground"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                  isCurrent
                    ? "bg-background text-foreground"
                    : isComplete
                      ? "bg-emerald-500/20"
                      : "bg-background/10"
                }`}
              >
                {isComplete ? "✓" : index + 1}
              </span>
              {step.label}
            </div>
            {index < IMPORT_STEPS.length - 1 ? (
              <span className="text-muted-foreground">↓</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function ProductImportModal({
  open,
  onClose,
  onImported,
}: ProductImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>("excel");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const validRows = useMemo(
    () => rows.filter((row) => row.errors.length === 0),
    [rows]
  );
  const invalidRows = useMemo(
    () => rows.filter((row) => row.errors.length > 0),
    [rows]
  );
  const validationSkuKey = useMemo(
    () => rows.map((row) => row.data.sku).join("\u0000"),
    [rows]
  );

  useResetWhenOpened(open, () => {
    setStep("excel");
    setFileName(null);
    setRows([]);
    setParseError(null);
    setParsing(false);
    setValidating(false);
    setValidationError(null);
    setImporting(false);
    setImportError(null);
    setImportedCount(null);
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !parsing && !validating && !importing) {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose, parsing, validating, importing]);

  useEffect(() => {
    if (step !== "validation" || !validationSkuKey) {
      return;
    }

    let cancelled = false;

    async function runDatabaseValidation() {
      setValidating(true);
      setValidationError(null);

      const skus = validationSkuKey.split("\u0000");
      const result = await checkExistingSkus(skus);

      if (cancelled) {
        return;
      }

      setValidating(false);

      if (!result.success) {
        setValidationError(result.error);
        return;
      }

      setRows((current) =>
        applyDatabaseSkuConflicts(current, result.existingSkus)
      );
    }

    void runDatabaseValidation();

    return () => {
      cancelled = true;
    };
  }, [step, validationSkuKey]);

  if (!open) {
    return null;
  }

  async function handleFileSelect(file: File) {
    setParsing(true);
    setParseError(null);

    const result = await parseProductExcel(file);

    setParsing(false);

    if (!result.success) {
      setParseError(result.error);
      setRows([]);
      setFileName(null);
      return;
    }

    setFileName(result.fileName);
    setRows(result.rows);
    setStep("preview");
  }

  async function handleImport() {
    setImporting(true);
    setImportError(null);

    const result = await importProducts(validRows.map((row) => row.data));

    setImporting(false);

    if (!result.success) {
      setImportError(result.error);
      return;
    }

    setImportedCount(result.imported);
    onImported(result.imported);
    setStep("products");
  }

  function canContinue(): boolean {
    if (step === "excel") {
      return rows.length > 0;
    }

    if (step === "preview") {
      return rows.length > 0;
    }

    if (step === "validation") {
      return !validating && validRows.length > 0;
    }

    return false;
  }

  function goNext() {
    if (step === "excel" && rows.length > 0) {
      setStep("preview");
      return;
    }

    if (step === "preview") {
      setStep("validation");
      return;
    }

    if (step === "validation" && validRows.length > 0) {
      setStep("import");
    }
  }

  function goBack() {
    if (step === "preview") {
      setStep("excel");
      return;
    }

    if (step === "validation") {
      setStep("preview");
      return;
    }

    if (step === "import") {
      setStep("validation");
    }
  }

  const isBusy = parsing || validating || importing;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isBusy ? undefined : onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-import-title"
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="space-y-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="product-import-title"
                className="text-base font-semibold text-foreground"
              >
                Import Products
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Excel → Preview → Validation → Import → Products
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <StepIndicator current={step} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {step === "excel" ? (
            <div className="space-y-4">
              <div
                className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-accent/20 px-6 py-12 text-center"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files[0];
                  if (file) {
                    void handleFileSelect(file);
                  }
                }}
              >
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                <p className="mt-4 text-sm font-medium text-foreground">
                  Drop your Excel file here
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Supports .xlsx and .xls
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={parsing}
                  className="mt-5 inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {parsing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Reading file...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Choose file
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleFileSelect(file);
                    }
                    event.target.value = "";
                  }}
                />
              </div>

              {parseError ? (
                <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <p className="text-sm text-red-300">{parseError}</p>
                </div>
              ) : null}

              <div className="rounded-lg border border-border bg-accent/20 p-4">
                <p className="text-xs font-medium text-foreground">
                  Expected columns
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  SKU, Code, Product Name, Scientific Name, Category, Species,
                  Country, Origin, Brand, Size, Glaze %, Package Type, Net
                  Weight, Gross Weight, HS Code, Purchase Price, Sale Price,
                  Currency, Description, Active
                </p>
              </div>
            </div>
          ) : null}

          {step === "preview" ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground">{fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {rows.length} row{rows.length === 1 ? "" : "s"} detected
                </p>
              </div>

              <div className="overflow-hidden rounded-lg border border-border">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-accent/30">
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                          Row
                        </th>
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                          SKU
                        </th>
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                          Product Name
                        </th>
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                          Category
                        </th>
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                          Country
                        </th>
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                          Active
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.slice(0, 50).map((row) => (
                        <tr key={row.rowNumber} className="hover:bg-accent/20">
                          <td className="px-4 py-3 text-muted-foreground">
                            {row.rowNumber}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {row.data.sku || "—"}
                          </td>
                          <td className="px-4 py-3">{row.data.name || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {row.data.category ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {row.data.country ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            {row.data.is_active ? "Active" : "Inactive"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {rows.length > 50 ? (
                <p className="text-xs text-muted-foreground">
                  Showing first 50 of {rows.length} rows.
                </p>
              ) : null}
            </div>
          ) : null}

          {step === "validation" ? (
            <div className="space-y-4">
              {validating ? (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-accent/20 p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Checking SKU uniqueness against catalog...
                  </p>
                </div>
              ) : null}

              {validationError ? (
                <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <p className="text-sm text-red-300">{validationError}</p>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-accent/20 p-4">
                  <p className="text-xs text-muted-foreground">Total rows</p>
                  <p className="mt-1 text-2xl font-semibold">{rows.length}</p>
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="text-xs text-emerald-300">Valid</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-400">
                    {validRows.length}
                  </p>
                </div>
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                  <p className="text-xs text-red-300">Invalid</p>
                  <p className="mt-1 text-2xl font-semibold text-red-400">
                    {invalidRows.length}
                  </p>
                </div>
              </div>

              {invalidRows.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-border bg-accent/30">
                          <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                            Row
                          </th>
                          <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                            SKU
                          </th>
                          <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                            Product Name
                          </th>
                          <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                            Issues
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {invalidRows.map((row) => (
                          <tr key={row.rowNumber} className="bg-red-500/5">
                            <td className="px-4 py-3 text-muted-foreground">
                              {row.rowNumber}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">
                              {row.data.sku || "—"}
                            </td>
                            <td className="px-4 py-3">{row.data.name || "—"}</td>
                            <td className="px-4 py-3 text-red-300">
                              {row.errors.join("; ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : !validating ? (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <p className="text-sm text-emerald-300">
                    All rows passed validation and are ready to import.
                  </p>
                </div>
              ) : null}

              {validRows.length === 0 && !validating ? (
                <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <p className="text-sm text-red-300">
                    Fix validation errors in your file before importing.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "import" ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-accent/20 p-5">
                <p className="text-sm font-medium text-foreground">
                  Ready to import
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {validRows.length} valid product
                  {validRows.length === 1 ? "" : "s"} from{" "}
                  <span className="text-foreground">{fileName}</span> will be
                  inserted into Supabase.
                </p>
                {invalidRows.length > 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {invalidRows.length} invalid row
                    {invalidRows.length === 1 ? "" : "s"} will be skipped.
                  </p>
                ) : null}
              </div>

              {importError ? (
                <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <p className="text-sm text-red-300">{importError}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "products" ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
                <Package className="h-6 w-6 text-emerald-400" />
              </div>
              <p className="mt-4 text-base font-medium text-foreground">
                Products imported
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {importedCount ?? 0} product
                {(importedCount ?? 0) === 1 ? "" : "s"} added to the catalog.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                The products list and KPI cards have been refreshed.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-between sm:px-6">
          <div>
            {step !== "excel" && step !== "products" ? (
              <button
                type="button"
                onClick={goBack}
                disabled={isBusy}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              {step === "products" ? "Done" : "Cancel"}
            </button>

            {step === "import" ? (
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={importing || validRows.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>Import {validRows.length} products</>
                )}
              </button>
            ) : step === "products" ? null : (
              <button
                type="button"
                onClick={goNext}
                disabled={!canContinue() || parsing || validating}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
