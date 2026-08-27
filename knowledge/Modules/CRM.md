# Module — CRM

## Purpose

Seafood trading CRM: customers, contacts, business profile, timeline, attachments, notes.

## Current state

Routes `/crm`, `/crm/[id]` · `src/components/crm/*` · `src/lib/crm/*` · migrations `20260805020000`, `20260805030000`.

Profile tabs: Company · Contacts · Business · Timeline · Attachments · Notes.

Tables: `crm_customers`, `crm_contacts`, `crm_notes`, `crm_communications`, `crm_tasks`, `crm_timeline_events`, `crm_attachments`.

## Confirmed rules

- Unlimited contacts with trading channels (WeChat, WhatsApp, Telegram, etc.).  
- Business fields: type, products, markets, volume, Incoterms, currency, payment terms.  
- Timeline types include Call, Meeting, Email, Quote, Contract, Shipment, Payment, Note.  
- Never lose CRM history.

## Constraints

- Prefer additive timeline/notes.  
- Do not hardcode company IDs when linking.

## Known risks / gaps

- Seafood columns require migration applied.  
- Rich notes XSS risk without sanitization.  
- Attachment MIME validation weaker than DMS.  
- Permissions stub / open RLS.

## Development rules

- Extend `src/lib/crm` only.  
- Check SQL timeline triggers before duplicating in UI.

## Planned

- Sanitize HTML notes · stronger counterparty/contract links · company-scoped lists.
