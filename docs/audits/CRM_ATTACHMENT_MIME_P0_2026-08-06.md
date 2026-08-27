# Review: CRM attachment MIME allowlist (K-08)

**Date:** 2026-08-06  
**Director selection:** Highest-priority unfinished P0 Security item not blocked on auth (title-order among tied P0s).  
**Specialists:** Security, Frontend, Backend (Server Actions).

## Scope implemented

1. **Server allowlist** — `uploadCrmAttachment` uses `validateCrmAttachmentFile` (DMS-aligned: PDF/Office/images/MP4/MOV, 50MB, MIME check). GIF removed.
2. **Permission gate** — `assertCan("documents.write")` on upload/delete.
3. **Delete hardening** — storage path loaded from `crm_attachments` by id + customer_id; client `filePath` ignored.
4. **UI** — `accept` and client pre-check match DMS allowlist via `CRM_ATTACHMENT_ACCEPT`.

## Files

| File | Change |
| --- | --- |
| `src/lib/crm/validation.ts` | New CRM validation wrapper |
| `src/lib/crm/actions.ts` | MIME allowlist, assertCan, delete path from DB |
| `src/components/crm/CustomerProfileView.tsx` | accept + client validate |
| `management/BACKLOG.md` | K-08 → Done |

## Validation

- `pnpm exec tsc --noEmit`
- `pnpm build`
- `git diff --check` (if clean)

## Residual risks

- Auth/RLS still stubbed; allowlist does not replace storage policy ownership (K-09 / storage RLS still open).
- No migration; no commit/push in this pass.
- Next unfinished P0 Security candidate: Signed URL ownership checks (K-09).

## Approval gates

- No migration apply requested.
- No commit/push.
