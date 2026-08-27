# Review: Signed URL ownership checks (K-09)

**Date:** 2026-08-06  
**Director selection:** Next highest unfinished P0 Security item after K-08 (MIME allowlist).  
**Specialists:** Security → Backend → QA  
**Approval gates:** No migration, no RLS change, no auth redesign, no commit/push, no remote Supabase.

## Problem

Path-based `createSignedUrl` could sign any registered storage object without checking `company_id` (or CRM customer company). Registration alone was insufficient ACL.

## Implementation

| Area | Change |
| --- | --- |
| `src/lib/documents/signed-url-auth.ts` | Path validation, ownership pure helpers, resolve owner from `documents` / `document_versions` / `crm_attachments`→customer, `assertCanSignStoragePath` |
| `getSignedUrlForPath` | Uses full gate (permission + registration + company) |
| `getDocumentSignedUrls` | `documents.read` + filter by `company_id` before signing |
| `getDocumentDownloadUrls` (contracts) | Selects `company_id`; same filter + permission |
| `getCrmAttachments` | Loads customer `company_id`, `assertCompanyAccess` before signing |
| Tests | `src/lib/documents/signed-url-auth.test.mjs` |

## Behavior notes

- When `SKY_ACTIVE_COMPANY_ID` is unset and role is admin (current stub), company check is a no-op — same as other modules until session company lands.
- When active company **is** set, records with null/`other` `company_id` are denied (fail closed for scoped mode).
- Storage RLS / bucket policies remain Planned (separate backlog item; requires approval).

## Validation (QA)

- `node --test src/lib/documents/signed-url-auth.test.mjs`
- `pnpm exec tsc --noEmit`
- `pnpm build`
- `git diff --check`

## Residual risks / human review required

1. **Auth still stubbed** — `getCurrentRole()` is always admin; company env is optional. Real isolation needs session company + RLS (approval-gated).
2. **Contract import preview URLs** — still path-based on import rows (different bucket/flow); out of K-09 DMS/CRM scope; track separately if needed.
3. **Documents with null `company_id`** — denied only when company scope is active; backfill ownership remains an ops concern.
4. **No migration / no remote apply** in this pass.

## Stop

Ready for **human Review**. Do not commit, push, or apply migrations until approved.
