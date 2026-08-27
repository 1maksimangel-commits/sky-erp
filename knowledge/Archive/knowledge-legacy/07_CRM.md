# SKY ERP — CRM

## Purpose

Relationship management for customers, prospects, suppliers, and partners in seafood trading.

## Current state

| Item | Location |
| --- | --- |
| Routes | `/crm`, `/crm/[id]` |
| UI | `src/components/crm/*` |
| Lib | `src/lib/crm/*` |
| Migrations | `20260805020000_crm_module.sql`, `20260805030000_crm_seafood_profile.sql` |

### Profile sections (customer card)

Company · Contacts (unlimited) · Business · Timeline · Attachments · Notes

### Confirmed entities

`crm_customers`, `crm_contacts`, `crm_notes`, `crm_communications`, `crm_tasks`, `crm_timeline_events`, `crm_attachments`

## Confirmed architecture / rules

- Clicking a customer opens a **full-page** profile.
- Contacts support trading channels (mobile, WeChat, WhatsApp, Telegram, language, birthday, etc. per seafood migration).
- Business fields: customer type, interested products, markets, annual volume, preferred Incoterms/currency/payment terms.
- Timeline event types include Call, Meeting, Email, Quote, Contract, Shipment, Payment, Note.
- Notes support rich HTML fields (`body_html`) in schema/UI.
- Design language should match existing ERP shell.

## Constraints

- Never lose CRM history.
- Prefer additive contact/timeline records over destructive resets.
- Do not hardcode company IDs when linking CRM to companies/counterparties.

## Known risks / gaps

- Seafood columns (`legal_name`, etc.) require `20260805030000` applied remotely or queries fail.
- Rich notes rendered with `dangerouslySetInnerHTML` — XSS risk without sanitization.
- CRM attachment upload validates size but MIME allowlist is weaker than DMS.
- App-layer permissions not enforced for CRM mutations today.
- Multi-company ownership on CRM rows is incomplete.

## Development rules

- Extend `src/lib/crm` types/actions rather than parallel CRM stacks.
- Keep unlimited contacts model.
- Auto-timeline triggers exist in SQL — do not duplicate blindly in UI without checking triggers.

## Planned

- Stronger link CRM customer ↔ counterparty ↔ contracts.
- Sanitize rich-text notes.
- Company-scoped CRM lists.
