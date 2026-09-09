"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { setDefaultDocumentTemplate, setDocumentTemplateActive, uploadDocumentTemplate } from "@/lib/document-templates/actions";
import { DOCUMENT_TEMPLATE_LABELS, DOCUMENT_TEMPLATE_TYPES, type DocumentTemplate, type DocumentTemplateType } from "@/lib/document-templates/types";
import type { Company } from "@/lib/companies";
import { TemplateConfigureDialog } from "@/components/document-templates/TemplateConfigureDialog";
import { TemplateTestGenerateButton } from "@/components/document-templates/TemplateTestGenerateButton";

const fieldClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const buttonClass = "rounded-md border border-border px-3 py-2 text-xs disabled:opacity-50";
function label(type: DocumentTemplateType) { return type === "invoice" ? "Commercial Invoice" : DOCUMENT_TEMPLATE_LABELS[type]; }

export function DocumentTemplatesView({ templates, companies, error }: { templates: DocumentTemplate[]; companies: Company[]; error: string | null }) {
  const router = useRouter();
  const uploadRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<DocumentTemplateType>("contract");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [companyId, setCompanyId] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [replacement, setReplacement] = useState<DocumentTemplate | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  function action(fn: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      try { const result = await fn(); setMessage(result.success ? "Saved." : result.error ?? "Operation failed."); if (result.success) router.refresh(); }
      catch (failure) { setMessage(failure instanceof Error ? failure.message : "Operation failed."); }
    });
  }
  function chooseUpload(kind: DocumentTemplateType, previous?: DocumentTemplate) {
    setType(kind); setReplacement(previous ?? null); setName(previous?.name ?? "");
    setLanguage(previous?.language ?? "en"); setCompanyId(previous?.company_id ?? "");
    setMakeDefault(previous?.is_default ?? false); setFile(null);
    uploadRef.current?.reset(); uploadRef.current?.scrollIntoView({ behavior: "smooth" });
  }
  function submit() {
    if (!file || !name.trim()) { setMessage("Enter a template name and choose a DOCX file."); return; }
    startTransition(async () => {
      try {
        const form = new FormData();
        form.set("documentType", type); form.set("name", name); form.set("language", language);
        form.set("companyId", companyId); form.set("isDefault", String(makeDefault)); form.set("file", file);
        if (replacement) form.set("replacesId", replacement.id);
        const result = await uploadDocumentTemplate(form);
        setMessage(result.success ? "Template uploaded. Known fields are configured automatically; custom fields can be configured under Advanced." : result.error);
        if (result.success) { setFile(null); setName(""); setReplacement(null); uploadRef.current?.reset(); router.refresh(); }
      } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Upload failed."); }
    });
  }
  return <main className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold">Document Templates</h1><p className="mt-1 text-sm text-muted-foreground">Reuse your Word documents with their original layout and language.</p></div><Link href="/documents/generate" className={buttonClass}>Generate documents</Link></header>
    {error ? <p role="alert" className="rounded-lg border border-red-500/30 p-4 text-sm text-red-300">{error}</p> : null}
    {message ? <p role="status" className="rounded-lg border border-border p-3 text-sm">{message}</p> : null}
    {DOCUMENT_TEMPLATE_TYPES.filter((kind) => ["contract", "supplement", "invoice"].includes(kind) || templates.some((item) => item.document_type === kind)).map((kind) => <section key={kind} className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold">{label(kind)}</h2><button type="button" disabled={pending} onClick={() => chooseUpload(kind)} className={buttonClass}>Upload DOCX</button></div>
      <div className="space-y-4">{templates.filter((item) => item.document_type === kind).map((item) => <article key={item.id} className="space-y-3 border-t border-border pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-medium">{item.name}</h3><p className="mt-1 text-xs text-muted-foreground">{item.company_id ? companies.find((company) => company.id === item.company_id)?.name ?? "Company template" : "Global"} · {item.language.toUpperCase()} · v{item.version} · {item.is_active ? "Active" : "Inactive"}{item.is_default ? " · Default" : ""} · {item.status === "Ready" ? "Ready" : "Needs configuration"}</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" disabled={pending} onClick={() => chooseUpload(kind, item)} className={buttonClass}>Replace with new version</button><TemplateTestGenerateButton template={item} /><a href={"/api/document-templates/" + item.id + "/download"} className={buttonClass}>Download Original</a></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">{!item.is_default && item.is_active ? <button type="button" disabled={pending} onClick={() => action(() => setDefaultDocumentTemplate(item.id))} className={buttonClass}>Use as default</button> : null}<button type="button" disabled={pending} onClick={() => action(() => setDocumentTemplateActive(item.id, !item.is_active))} className={buttonClass}>{item.is_active ? "Deactivate" : "Activate"}</button><details className="text-xs"><summary className="cursor-pointer text-muted-foreground">Advanced: custom fields</summary><div className="mt-2"><TemplateConfigureDialog template={item} /></div></details></div>
      </article>)}</div>
      {!templates.some((item) => item.document_type === kind) ? <p className="text-sm text-muted-foreground">Upload a DOCX to get started.</p> : null}
    </section>)}
    <form ref={uploadRef} onSubmit={(event) => { event.preventDefault(); submit(); }} className="space-y-4 rounded-xl border border-border bg-card p-4">
      <h2 className="font-medium">{replacement ? "Replace " + replacement.name + " with a new version" : "Upload Word template"}</h2>
      <p className="text-xs text-muted-foreground">Your original file is retained unchanged. Replacing a template preserves every previous version and generated document.</p>
      <fieldset disabled={pending} className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">Document type<select disabled={!!replacement} value={type} onChange={(event) => { const value = DOCUMENT_TEMPLATE_TYPES.find((kind) => kind === event.target.value); if (value) setType(value); }} className={fieldClass}>{DOCUMENT_TEMPLATE_TYPES.map((kind) => <option key={kind} value={kind}>{label(kind)}</option>)}</select></label>
        <label className="text-sm">Template name<input required value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} /></label>
        <label className="text-sm">Internal company<select disabled={!!replacement} value={companyId} onChange={(event) => setCompanyId(event.target.value)} className={fieldClass}><option value="">Global (Admin only)</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label className="text-sm">Language<select disabled={!!replacement} value={language} onChange={(event) => setLanguage(event.target.value)} className={fieldClass}><option value="en">English</option><option value="ru">Russian</option><option value="zh">Chinese</option></select></label>
        <label className="text-sm md:col-span-2">Original Word file<input type="file" required accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className={fieldClass} /></label>
        <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} />Default for this document type, company, and language</label>
      </fieldset>
      <div className="flex gap-3"><button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">{pending ? "Uploading…" : replacement ? "Upload new version" : "Upload template"}</button>{replacement ? <button type="button" disabled={pending} className={buttonClass} onClick={() => chooseUpload(type)}>Cancel replacement</button> : null}</div>
    </form>
  </main>;
}
