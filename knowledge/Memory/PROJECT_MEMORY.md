# Memory — Project Memory

## Purpose

Short living summary of what SKY ERP is and how the repo is organized—for agents starting cold.

## Snapshot

- **Product:** Seafood trading ERP (SKY ERP) for companies like ALTAY FISH and related trading entities (names in business context).  
- **Stack:** Next.js 16 · React 19 · Supabase · OpenAI (contracts) · Tailwind v4 · Zod.  
- **Hub:** Contracts link logistics, warehouse, finance, documents, business cases.  
- **Docs:** Canonical knowledge under `knowledge/`; `AGENTS.md` highest policy authority.  
- **Package tool:** pnpm per AGENTS (npm lockfile may still exist historically).

## Where things live

| Need | Go to |
| --- | --- |
| Policy / safety | `AGENTS.md`, `05_SECURITY_AND_AGENT_BOUNDARIES.md` |
| Schema | `supabase/migrations/`, `03_DATABASE_AND_MIGRATIONS.md` |
| Module behavior | `knowledge/Modules/*` |
| Import/AI | `Modules/Contracts.md`, `Modules/AI.md` |
| Known breaks | `Memory/KNOWN_ISSUES.md` |
| History of decisions | `Memory/ARCHITECTURE_DECISIONS.md` |

## Working agreements

- Extend, don’t rewrite.  
- Migrations append-only.  
- Human confirm AI extractions commercial data.  
- Repository-only agent work.
