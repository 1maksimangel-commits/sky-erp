# SKY ERP — System Architecture

## Purpose

Authoritative application architecture (layers, stack, module map).

## Current state

Merged from prior `02_SYSTEM_ARCHITECTURE.md` and `docs/ARCHITECTURE.md` (archived).

## Confirmed architecture

```text
Browser (ERP UI)
  → Server Components (load) | Server Actions (mutate) | Route Handlers (large upload / streams)
  → Supabase Postgres + Auth SSR + Storage (RLS)
  → OpenAI (server only) for contract PDF extraction
```

### Stack

Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS v4 · Supabase JS/SSR · OpenAI SDK · Zod · Lucide icons

### Layers

| Layer | Location |
| --- | --- |
| Routes / layouts | `src/app/(erp)/` |
| Feature UI | `src/components/<module>/` |
| Platform UI | `src/components/platform/`, `layout/` |
| Domain logic | `src/lib/<module>/` |
| Platform / AI | `src/lib/platform/`, `src/lib/ai/` |
| Supabase | `src/lib/supabase/` |
| Schema | `supabase/migrations/` |

### Navigation modules (`src/lib/navigation.ts`)

Dashboard · CRM · Companies · Counterparties · Products · Business Cases · Contracts · Warehouse · Logistics · Finance · Documents · Reports · AI · Settings

### Cross-cutting platform

Timeline · activity · documents panels · search · notifications · permissions foundation — under `src/lib/platform/` and `src/components/platform/`.

### Principles

1. Server-first data loading and mutations.  
2. Supabase is system of record.  
3. Thin pages, fat modules.  
4. Client components for interactivity only.  
5. Contracts as hub (`contract_id` links).  
6. Fail loudly; never cascade-delete parents because a child upload failed.  
7. No `service_role` in the Next.js app.  
8. Large PDFs → Route Handlers, not Server Action bodies.

## Constraints

- Do not call OpenAI from the browser.  
- Do not invent a second UI system.  
- Never hardcode company IDs.

## Known risks / gaps

See `Memory/KNOWN_ISSUES.md` for business-module gaps. Phase 2 replaces the Admin
stub and public policies with verified sessions and company membership RLS;
[AuthRLS.md](./Development/AuthRLS.md) documents the model and adoption boundary.

## Development rules

- New domain code → `src/lib/<module>/` + `src/components/<module>/`.  
- Reuse EntityWorkspace / table / modal patterns.  
- Document module specifics under `Modules/`.

## Planned

- Adoption of the verified auth/company model in an existing environment requires separate approval.
- Unified reporting layer.
