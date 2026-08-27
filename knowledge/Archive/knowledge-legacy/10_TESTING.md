# SKY ERP — Testing Strategy

How SKY ERP is validated before release. Prefer proving the vertical seafood workflow over isolated UI snapshots.

---

## 1. Goals

- Prevent regressions in contract hub, stock, finance, and document flows.
- Catch RLS and migration mistakes before operators do.
- Keep AI paths safe: no silent writes, no client key exposure.
- Maintain a green production build as a merge gate.

---

## 2. Test layers

| Layer | What | When |
| --- | --- | --- |
| Static | TypeScript + `pnpm build` / `npm run build` | Every PR |
| Lint | ESLint | Every PR |
| Unit | Pure functions (formatters, matchers, validators, money alloc) | With logic changes |
| Integration | Server Actions / DB against dev Supabase | Module slices |
| Manual QA | Operator scripts per module | Before release |
| Security | RLS probes, secret scan, upload limits | Migrations & auth changes |
| AI | Import pipeline + review confirm | AI/prompt/schema changes |

---

## 3. Build gate (mandatory)

```bash
pnpm build
```

All TypeScript and Next.js build errors must be fixed before merge. Consult `node_modules/next/dist/docs/` when App Router APIs differ from expectations.

---

## 4. Manual QA — core seafood path

Run on a shared/dev Supabase project with migrations applied.

1. **Masters:** Create Company, Counterparty (buyer + supplier), Product.
2. **Business case:** Create case linking parties.
3. **Contract:** Create contract with product lines (or PDF import → review → confirm).
4. **Warehouse:** Inbound lot for product; verify quantity.
5. **Logistics:** Create shipment on contract; set vessel/voyage/ETD/ETA/container.
6. **Documents:** Upload packing list / certificate PDF to contract; preview.
7. **Finance:** Create invoice against contract; record payment; allocate; outstanding → 0.
8. **Shell:** ⌘K finds the contract; notifications drawer opens; quick create `?new=1` works.
9. **Negative:** Invalid PDF type rejected; Save disabled while submitting; RLS denial shows message (do not disable RLS).

---

## 5. Module checklists (abbreviated)

### Companies / Counterparties / Products

- Required field validation
- Unique code behavior
- List refresh after create (toast + row visible)
- Detail workspace loads

### Contracts

- Hub tabs render without mock data
- Edit/delete confirmations
- Import: progress stages, review confidence UI, confirm creates contract + doc link
- Partial document failure does not delete contract

### Warehouse

- Cannot ship more than available (when enforced)
- Lot detail navigation

### Logistics

- Filters; status badge; shipment detail timeline
- Delay messaging path (manual status)

### Finance

- Invoice filters/pagination
- Payment allocation ≤ outstanding
- Currency display formatting

### Documents

- MIME/size validation
- Versioning behavior as designed
- `uploaded_by` uuid integrity

---

## 6. AI testing

| Case | Expected |
| --- | --- |
| Missing API key | UI shows configured=false; no crash |
| Small valid PDF | Storage + extraction → review |
| Large PDF (&lt; 50 MB) | API route upload with progress; not Server Action |
| &gt; 50 MB | Client/server reject |
| Ambiguous party names | Matches with low confidence; user chooses |
| Confirm | Contract row + lines + timeline event |
| Re-extract | Overwrites staging extraction; user re-reviews |

Never assert on full model prose; assert on schema fields and DB side effects.

---

## 7. RLS & migration testing

After each migration:

1. `SELECT` smoke on new tables.
2. `INSERT` probe with the same key role the app uses.
3. Confirm expected `42501` when policy intentionally missing — then apply policy migration.
4. Verify no uuid/text coalesce hazards on actor columns.

Document required policies in release notes when ops must apply SQL manually.

---

## 8. Automated unit tests (guidance)

Prioritize pure modules:

- `src/lib/**/format.ts`
- `src/lib/**/validation.ts`
- AI match scoring (`src/lib/ai/contracts/match.ts`)
- Payment allocation math
- Import review validation

Colocate `*.test.ts` when the repo adopts a runner (Vitest/Jest). Until then, keep functions pure and manually assert edge cases in PR description.

---

## 9. Regression hotspots

Watch these historically fragile areas:

- Server Action body size vs file uploads
- DMS `uploaded_by` uuid vs text
- Contract import staging table absence (schema cache errors)
- Duplicate create on retry after partial success
- Shell `useSearchParams` without Suspense boundaries

---

## 10. Definition of done (feature)

- [ ] Migrations applied + RLS considered
- [ ] Manual path tested on real Supabase
- [ ] Build green
- [ ] No secrets committed
- [ ] Knowledge/docs updated if workflow or entity semantics changed
- [ ] Release notes draft if shipping to production

---

## Related knowledge

- [07_SECURITY.md](./07_SECURITY.md)
- [09_RELEASE_NOTES.md](./09_RELEASE_NOTES.md)
- `/docs/DEVELOPMENT_WORKFLOW.md`
