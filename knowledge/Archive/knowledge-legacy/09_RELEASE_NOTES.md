# SKY ERP — Release Notes Template

Copy this template for every production release. Keep language operator-friendly; link PRs/migrations for engineers.

---

## Release metadata

| Field | Value |
| --- | --- |
| Version | `X.Y.Z` |
| Codename (optional) | |
| Date (UTC) | `YYYY-MM-DD` |
| Environment | `staging` / `production` |
| Released by | |
| Requires migrations | `yes` / `no` |
| Requires env changes | `yes` / `no` |
| Downtime expected | `none` / `minutes` |

---

## Summary

> One short paragraph: why this release matters to seafood export operators.

---

## What's new

- 
- 
- 

---

## Improvements

- 
- 

---

## Fixes

- 
- 

---

## Security

- 
- _(Write “None” if no security-relevant changes.)_

---

## AI / integrations

- Model or prompt changes:
- New API routes:
- External dependency bumps:

---

## Database migrations

List files applied in order:

```text
supabase/migrations/YYYYMMDDHHMMSS_description.sql
```

Notes for operators/DBAs:

- 
- RLS policy changes:
- Backfills:

---

## Environment variables

| Variable | Required | Change |
| --- | --- | --- |
| `CONTRACT_AI_API_KEY` | | added / changed / unchanged |
| `OPENAI_API_KEY` | | |
| `NEXT_PUBLIC_SUPABASE_URL` | | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | | |

---

## Breaking changes

- None

_(If any: describe old vs new behavior and migration steps for operators.)_

---

## Upgrade steps

1. Take DB backup / confirm PITR.
2. Pull release tag / deploy application.
3. Apply migrations (`supabase db push` or approved pipeline).
4. Verify RLS probes for critical tables (companies, contracts, documents).
5. Smoke test checklist (below).
6. Monitor logs 30–60 minutes post-release.

---

## Smoke test checklist

- [ ] Login / session
- [ ] Dashboard loads
- [ ] Companies list + create modal
- [ ] Contracts list + open workspace tabs
- [ ] Logistics shipment list
- [ ] Warehouse lots
- [ ] Finance invoices / payments
- [ ] Documents upload/preview
- [ ] ⌘K search returns entities
- [ ] Notifications drawer opens
- [ ] Contract PDF import (if AI configured): upload → review → confirm
- [ ] `pnpm build` already green in CI

---

## Known issues

| Issue | Workaround | Tracking |
| --- | --- | --- |
| | | |

---

## Rollback plan

1. Redeploy previous application artifact.
2. DB rollback only if migration is reversible; otherwise forward-fix with hotfix migration.
3. Revert env vars if required.
4. Communicate status to operators.

---

## Credits

- 
- 

---

## Appendix — links

- PR:
- Commit:
- Incident / Linear:
