# SKY ERP — Product Roadmap

Strategic roadmap for the seafood export ERP. Versions are capability milestones, not strict calendar promises.

---

## Version 1 — Operating core (current target)

**Theme:** Run a deal from master data through contract, logistics, warehouse, finance, and documents.

### Delivered / in progress

- Companies, Counterparties, Products CRUD
- Business Cases
- Contracts hub (tabs: overview, documents, logistics, warehouse, finance, history)
- AI contract PDF import (Files + Responses API, human review)
- Logistics shipments
- Warehouse lots / operations
- Finance: invoices, payments, bank accounts, FX, reports entry
- Documents DMS
- Enterprise shell: sidebar, ⌘K search, quick create, notifications, breadcrumbs
- Platform: timeline, activity, permissions foundation, notifications
- Governance docs (`/docs`, `/knowledge`)

### V1 exit criteria

- Operator can create masters → contract → shipment → invoice → payment with real Supabase data
- PDF import never bypasses review
- RLS enabled; critical INSERT policies documented/applied
- Production build green

---

## Version 2 — Export excellence

**Theme:** Russia → China lane depth and operational reliability.

### Planned

- First-class **Containers** entity (multi-container shipments, seals, weights)
- Certificate pack checklist per destination market
- QC / quality inspection records linked to lots
- Stronger booking workflow (carrier, cut-off, rollings)
- Claims & credit notes tied to contract/shipment
- Role-hardened RLS (authenticated policies replacing broad public policies)
- Notification generators for: contract expiry, payment received, shipment delay, warehouse hold
- CRM lite: activities on counterparties / business cases
- Reporting workspace beyond finance reports (margin, volume by species, lane KPI)
- Document templates (packing list / checklist generation with human save)

### V2 exit criteria

- Multi-container shipment is native
- Certificate readiness visible before customs
- Roles enforce write scopes in production-like env

---

## Version 3 — Connected enterprise

**Theme:** Integrations, automation, and scale.

### Planned

- Carrier / tracking integrations (ETA truth)
- Banking import / reconciliation assists
- EDI / broker document exchange (as partners allow)
- Advanced Permissions UI and user admin
- Multi-company consolidation dashboards
- Mobile-optimized ops views for warehouse gate
- Workflow engine: approval gates (contract confirm, payment release of B/L)
- Offline-tolerant upload resume for large PDFs
- Full audit export for compliance

### V3 exit criteria

- External tracking updates shipment status with audit trail
- Approvals block forbidden transitions
- Compliance pack exportable for a contract

---

## Future ideas (backlog)

| Idea | Notes |
| --- | --- |
| Catch certificate / traceability graph | Species-to-lot lineage |
| Buyer portal | Limited external status + docs |
| Glaze & yield calculators | Net/gross commercial tools |
| Price lists & seasonality | Product pricing versions |
| Cold-store IoT temperature hooks | Exception alerts |
| LC module | Letter of credit milestones |
| Multi-language UI (RU/EN/ZH) | Operator preference |
| Malware scanning on uploads | Security hardening |
| Anomaly detection on payments | AI assist, human confirm |
| Inventory valuation | Finance ↔ warehouse |

---

## Prioritization principles

1. Contract hub integrity over new satellite modules.
2. Compliance docs before vanity dashboards.
3. RLS/permissions before opening external portals.
4. AI assists operators; never auto-posts finance or stock.

---

## Related knowledge

- [01_BUSINESS_RULES.md](./01_BUSINESS_RULES.md)
- [09_RELEASE_NOTES.md](./09_RELEASE_NOTES.md)
- `/docs/ARCHITECTURE.md`
