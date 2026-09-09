# Phase 5 — Document templates and retained DOCX versions

## Canonical workflow

`/documents/generate` selects an accessible Contract (optionally filtered by its
Deal), document types, company/language templates, and then shows the actual
server-loaded values for review. Contract links preselect the source. Confirmation
rechecks source values, template bytes and mappings; changed data requires review
again. Each output has its own retained download and history.

The existing `document_templates`, `template_mappings`, `generated_documents`,
`contracts`, `contract_parties`, and `contract_products` remain canonical. No
accounting invoice, payment, logistics or profitability records are created.

Seller and Buyer always come from explicit Contract party snapshots, never the
owning workspace or legacy Deal classifications. Legal descriptions and prices
come from Contract lines. Agreed bank/signatory values are supported within the
existing party snapshot and Draft Contract editor; they do not silently refresh
from changed master records. Missing required snapshot values must be reviewed
on the source Contract. Signed Contract restrictions remain intact.

## Templates and formatting

Upload preserves the exact original DOCX in private Storage. Metadata includes
company/global scope, language, name, document type, original name/MIME/SHA256,
uploader/time, family and version. Different templates of one type have different
families. Replace creates a new version; it does not overwrite the original.
Defaults are scoped by company, document type and language. Global template
management is Admin-only; eligible authenticated users can read them.

Canonical `{{seller.legal_name}}`, `{{contract.number}}`,
`{{commercial.payment_terms}}`, etc. are detected and usable automatically.
Advanced configuration maps unknown fields and marks template-specific required
values. Example-text binding changes only selected unambiguous text in a separate
configured DOCX copy. Original bytes remain unchanged. Configuration is locked
once a template has generated a business document.

The installed Docxtemplater/PizZip packages manipulate Word XML directly. There
is no DOCX-to-HTML-to-DOCX roundtrip. Styles, page settings, tables, headers,
footers, media and relationships remain in the package. Split-run variables work.
A table prototype row with `{{product.description}}`, `{{product.quantity}}`,
`{{product.unit_price}}`, and `{{product.amount}}` repeats for all Contract lines.
Optional blocks use `{{#consignee}}...{{/consignee}}` or inverse
`{{^consignee}}...{{/consignee}}`. Missing optional scalar values render empty.
Expressions and arbitrary code are not evaluated.

ZIP CRC, expansion bounds, XML structure, relationships and referenced resources
are validated before/after rendering. Encrypted, macro, embedded executable,
corrupt and unsafe packages are rejected. Resource bounds are not product-count
limits. Tests cover 1, 3 and 20 product rows and preserved style/image bytes.

Legacy text-only/hashless uploads remain retained but must be replaced by a
verified DOCX for this workflow. The old Contract generation endpoint now points
users to canonical review; its former owner-as-Seller and system-layout PDF path
cannot create misleading output. The accidentally literal-quoted legacy route
redirects to `/document-templates` without deleting its tracked file.

## Document types and snapshots

Contract, Supplement/Addendum and Commercial Invoice are supported. Template
categories also preserve existing types and allow Specification, Proforma Invoice,
Acceptance/Transfer Act and Other for later workflows. No automatic translation
occurs; EN/RU/ZH are template languages.

Contract uses its canonical number/date. Supplement and Invoice may have an
explicit number or a UUID-based number shown during review; root numbers are
unique by owning company/type. Versions retain the same number and lineage.
Supplements may explicitly amend quantities/prices/payment/delivery terms and
notes. These labelled one-off amendments are snapshotted and never update the
base Contract. This phase requires a Contract source; standalone Supplements are
not introduced without an existing canonical standalone party workflow.

Every generated record stores source Contract/Deal, template/version/hash,
actual rendered values, mappings, labelled overrides, reviewer hash, actor/time,
output path and SHA256. All retained outputs/snapshots are immutable, including
Draft. Status progresses Draft → Final → Issued. New Version requires review and
produces a new file, linked to the previous version. Concurrent duplicate versions
or document numbers fail explicitly. No prior output is silently replaced.

The forward migration `20260909150000_document_generation_history.sql` adds these
constraints and protects registered template/output Storage objects from update
and deletion. Historical migrations are unchanged. Existing RLS remains in force;
document ownership is independent from template company and legal perspective.
Using another internal party's template additionally requires existing template
read access. No browser service-role credentials or remote changes are needed.

## Regression and verification

Verified locally on 2026-09-09: 52 migrations, zero detected missing application
tables/columns/relationships/RPCs, all Phase 1–4 gates and Phase 5 golden outputs.
Final document replay evidence:
`.db-replay/sky-erp-replay-86da2cb1660f4812aec7/result.json`.
The required `db:replay`, `core:check`, `contracts:check`, and `documents:check`
commands were run independently against fresh isolated stacks. All owned test
servers and stacks stopped successfully. Run replay commands sequentially because
they use dedicated local ports; run TypeScript after their generated Next types
have finished updating.

`pnpm documents:check` runs the authored fictional DOCX fixture tests plus the
canonical fresh isolated database replay. The replay now includes real template
upload, Storage downloads, source review, three golden outputs, snapshots, hashes,
Draft/Final/Issued, revisions, company/global defaults and cross-company denial,
in addition to all Phase 1–4 assertions. CI uses the same replay and unit checks.
The fixture at `scripts/database/fixtures/fictional-document-template.docx` is
project-authored fictional test material; it contains no customer document.

Routes are checked through authenticated local HTTP/SSR, not browser automation.
Word and Apple Pages are not launched or controlled. Automated package checks
cannot certify every desktop application's visual pagination. Manual review:
upload a fictional formatted DOCX; select a three-product Contract; review and
generate each type; open the downloads in Word/Pages; inspect layout and headers;
mark a Draft Final/Issued and create a new version; confirm both downloads remain.

PDF conversion is PARTIAL: no reliable DOCX-to-PDF converter is configured.
Download DOCX and export with Word/Pages when PDF is needed. System-layout PDF is
not presented as a formatting-preserving conversion.

## Phase 5 changed-file inventory

`.github/workflows/database-replay.yml`
`knowledge/DOCUMENTATION_INDEX.md`
`knowledge/Modules/Documents.md`
`package.json`
`scripts/database/auth-http.mjs`
`scripts/database/core-source.mjs`
`scripts/database/core-ui.mjs`
`scripts/database/replay.mjs`
`src/app/'(erp)'/document-templates/page.tsx`
`src/app/(erp)/document-templates/page.tsx`
`src/app/(erp)/documents/generate/page.tsx`
`src/app/api/contracts/[id]/generate/route.ts`
`src/app/api/documents/generate/route.ts`
`src/components/contracts/ContractGenerateButton.tsx`
`src/components/contracts/ContractLegalFields.tsx`
`src/components/document-templates/DocumentTemplatesView.tsx`
`src/components/document-templates/TemplateConfigureDialog.tsx`
`src/components/document-templates/TemplateTestGenerateButton.tsx`
`src/components/documents/DocumentGenerationView.tsx`
`src/lib/document-templates/actions.ts`
`src/lib/document-templates/generated-actions.ts`
`src/lib/document-templates/types.ts`
`src/lib/documents/generation-actions.ts`
`supabase/replay/auth-rls.sql`
`knowledge/Development/DocumentGeneration.md`
`scripts/database/documents-engine.test.mjs`
`scripts/database/documents-http.mjs`
`scripts/database/fixtures/fictional-document-template.docx`
`src/app/api/documents/generated/[id]/route.ts`
`src/lib/document-templates/docx-engine.ts`
`src/lib/document-templates/generation.ts`
`src/lib/document-templates/source.ts`
`src/lib/document-templates/variables.ts`
`supabase/migrations/20260909150000_document_generation_history.sql`
