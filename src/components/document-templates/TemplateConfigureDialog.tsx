"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { bindTemplateExampleValues, configureDocumentTemplate, discoverTemplatePlaceholders, getTemplateMappings } from "@/lib/document-templates/actions";
import { TEMPLATE_VARIABLES, type DocumentTemplate } from "@/lib/document-templates/types";

export function TemplateConfigureDialog({ template }: { template: DocumentTemplate }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [required, setRequired] = useState<Record<string, boolean>>({});
  const [text, setText] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [variable, setVariable] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setMessage(null);
    try {
      const [detected, saved] = await Promise.all([discoverTemplatePlaceholders(template.id), getTemplateMappings(template.id)]);
      if (detected.error || saved.error) throw new Error(detected.error ?? saved.error ?? "Could not inspect template.");
      setPlaceholders(detected.data); setText(detected.text);
      const next: Record<string, string> = {};
      for (const key of detected.data) next[key] = saved.data.find((item) => item.placeholder === key)?.sky_variable ?? TEMPLATE_VARIABLES.find((item) => item.key === key)?.key ?? "";
      setMapping(next); setRequired(Object.fromEntries(saved.data.map((item) => [item.placeholder, item.required])));
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Could not inspect template."); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setMessage(null);
    try {
      const result = await configureDocumentTemplate({ templateId: template.id, mappings: placeholders.map((placeholder) => ({
        placeholder, skyVariable: mapping[placeholder] || null, required: required[placeholder] ?? false,
        isRepeatingProductRow: (mapping[placeholder] ?? placeholder).startsWith("product."),
      })) });
      if (!result.success) throw new Error(result.error);
      router.refresh(); dialog.current?.close();
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Configuration failed."); }
    finally { setBusy(false); }
  }
  async function bind() {
    setBusy(true); setMessage(null);
    try {
      const result = await bindTemplateExampleValues(template.id, [{ text: selectedText, variable }]);
      if (!result.success) throw new Error(result.error);
      setSelectedText(""); setVariable(""); router.refresh(); await load();
      setMessage("Selected example text is now a reusable field. The original Word file is unchanged.");
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Could not configure example text."); }
    finally { setBusy(false); }
  }
  const control = "w-full rounded border border-border bg-background px-2 py-2 text-sm";
  return <>
    <button type="button" onClick={() => { dialog.current?.showModal(); void load(); }} className="rounded-md border border-border px-3 py-2 text-xs">Configure custom fields</button>
    <dialog ref={dialog} className="fixed inset-0 m-auto max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-background p-5 text-foreground backdrop:bg-black/70" aria-labelledby={"configure-" + template.id}>
      <div className="flex items-start justify-between gap-3"><div><h2 id={"configure-" + template.id} className="font-semibold">Advanced template configuration</h2><p className="mt-1 text-xs text-muted-foreground">{template.name} · v{template.version}</p></div><button type="button" aria-label="Close configuration" onClick={() => dialog.current?.close()} className="rounded border border-border px-3 py-1">Close</button></div>
      <p className="my-4 text-sm text-muted-foreground">Known fields are configured automatically. Choose a business field for custom names and mark only genuinely required values.</p>
      <fieldset disabled={busy} className="space-y-3">
        {placeholders.map((placeholder) => <div key={placeholder} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <span className="break-all text-xs">{placeholder}</span>
          <select aria-label={"Business field for " + placeholder} className={control} value={mapping[placeholder] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [placeholder]: event.target.value }))}><option value="">Choose business field</option>{TEMPLATE_VARIABLES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={required[placeholder] ?? false} onChange={(event) => setRequired((current) => ({ ...current, [placeholder]: event.target.checked }))} />Required</label>
        </div>)}
        {!placeholders.length ? <p className="text-sm text-muted-foreground">{busy ? "Reading Word document…" : "No reusable fields found. Select example text below to configure it."}</p> : null}
        <button type="button" disabled={!placeholders.length || busy} onClick={() => void save()} className="rounded bg-foreground px-3 py-2 text-sm text-background disabled:opacity-50">Save configuration</button>
      </fieldset>
      <details className="mt-5 border-t border-border pt-4" open={!placeholders.length && !!text}><summary className="cursor-pointer text-sm font-medium">Convert example values into reusable fields</summary><div className="mt-3 space-y-3">
        <p className="text-xs text-muted-foreground">Highlight the exact example value in the text below, then choose its business meaning. Only the selected text is replaced in a configured copy.</p>
        <textarea aria-label="Template text: select an example value" readOnly value={text} rows={10} className={control} onSelect={(event) => { const input = event.currentTarget; setSelectedText(input.value.slice(input.selectionStart, input.selectionEnd)); }} />
        <label className="block text-sm">Selected example text<input className={control} value={selectedText} onChange={(event) => setSelectedText(event.target.value)} /></label>
        <label className="block text-sm">Business field<select className={control} value={variable} onChange={(event) => setVariable(event.target.value)}><option value="">Choose business field</option>{TEMPLATE_VARIABLES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        <button type="button" disabled={busy || !selectedText || !variable} onClick={() => void bind()} className="rounded border border-border px-3 py-2 text-sm disabled:opacity-50">Bind selected text</button>
      </div></details>
      {message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}
    </dialog>
  </>;
}
