# SKY ERP — Project Vision

## Purpose

Mission, users, and product intent for SKY ERP.

## Current state

Canonical vision lives here. Root `00_PROJECT_VISION.md` is archived; use this file.

## Confirmed vision

| Item | Fact |
| --- | --- |
| Product | **SKY ERP** — enterprise ERP for international **seafood trading** |
| Mission | Build the best seafood ERP for real export/import operations |
| Reliability | Data integrity over speed (`AGENTS.md`) |
| Hub model | **Contract-centric** operations linking logistics, warehouse, finance, documents |
| AI role | Assists extraction/suggestions; **humans confirm** before core mutations |
| UI intent | Dark, dense, professional operator UI |

### Target users

Export companies · Import companies · Seafood processors · Cold storages · International traders

### Languages (product intent)

Russian · English · Chinese · Japanese

### Capability domains

Companies · Counterparties · CRM · Products · Business Cases · Contracts · Logistics · Warehouse · Finance · Documents · Reports · AI · Multi-company

### Named companies (business context names only)

ALTAY FISH LLC · ORDA FZCO · MAREX CARGO · DALIAN TIANYUAN · Global Star Logistics

### Non-goals (from project standards)

- Generic multi-tenant SaaS before domain depth  
- Client-side secrets / browser OpenAI  
- Inventing DB columns not in Supabase  
- Disabling RLS to unblock features  

## Constraints

- Multi-company ownership is a first-class rule.  
- Never hardcode company IDs.  
- Never destroy imported contract data.

## Known risks / gaps

- Multi-company UX/enforcement incomplete in app.  
- Some vision items (full multi-language UI) remain **Planned**.

## Development rules

- Prefer features that close: masters → contract → shipment → invoice → payment.  
- Align with `04_BUSINESS_CONTEXT.md` and `Modules/Contracts.md`.

## Planned

- Deeper Russia→China lane tooling, certificates, multi-container — see `Roadmap/Future.md`.
