# Roadmap — Future

## Purpose

Next / later / not-approved work. Nothing here is complete.

## Next (high priority)

- Apply pending migrations (CRM, contract import ensure, documents) with approval  
- New migration: `payments.business_case_id`  
- Real auth + stop admin stub  
- Replace open public RLS with authenticated/company policies  
- Sanitize CRM rich-text notes  
- Clear ESLint failures  
- pnpm-only lockfile cleanup (approval to remove npm lockfile)  
- Critical master-data update/archive flows  

## Later

- First-class Containers + multi-container UX  
- Certificate packs / QC inspection records  
- Claims & credit notes  
- Cross-module reporting  
- Notification generators  
- CRM ↔ contract activity graph  
- Document templates (human-saved)  
- Tracking / banking integrations  
- Multi-company consolidation  
- Approval workflow engine  
- Malware scanning on uploads  
- Multi-language UI  
- Catch/traceability, buyer portal, LC module (backlog ideas)

## Not yet approved

Do not start without explicit approval:

- Large refactors / rewrites  
- Auth/RLS redesign beyond reviewed plan  
- Major dependency upgrades  
- Remote destructive SQL / production data rewrites  
- Browser automation suites  
- Bulk deletion of archived docs or orphaned components  
- Replacing PDF import pipeline wholesale  

## Prioritization principles

1. Contract hub integrity over new satellites  
2. Compliance docs before vanity dashboards  
3. RLS/permissions before external portals  
4. AI assists; never auto-posts finance or stock  
