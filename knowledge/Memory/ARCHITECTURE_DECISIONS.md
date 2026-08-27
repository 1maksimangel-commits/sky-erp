# Memory — Architecture Decisions

## Purpose

Record significant decisions visible in the repository (lightweight ADR log).

## Decisions

### ADR-001 — Contract as commercial hub
**Status:** Accepted  
**Decision:** Cross-module links prefer `contract_id` / contract workspace tabs.  
**Why:** Seafood deals center on contracts spanning logistics, stock, and finance.

### ADR-002 — Server-first Next.js + Supabase SSR
**Status:** Accepted  
**Decision:** RSC for load; Server Actions for most mutations; publishable Supabase key + cookies.  
**Why:** Aligns with App Router and RLS; avoids service_role in app.

### ADR-003 — PDF import via Route Handler + OpenAI Files/Responses
**Status:** Accepted  
**Decision:** `/api/contracts/import` multipart + NDJSON; Files API + structured Responses parse; review before create.  
**Why:** 50MB bodies and long AI latency unfit for Server Action limits; human confirmation required.

### ADR-004 — Append-only SQL migrations
**Status:** Accepted  
**Decision:** Never edit applied migrations; hotfixes are new files.  
**Why:** Reproducible schema history; AGENTS mandate.

### ADR-005 — Dark dense ERP UI tokens
**Status:** Accepted  
**Decision:** Tailwind semantic tokens in `globals.css`; reuse shell components.  
**Why:** Operator density; avoid marketing aesthetics.

### ADR-006 — Permissions helper present but stubbed
**Status:** Accepted (temporary)  
**Decision:** `assertCan` exists; `getCurrentRole()` returns `"admin"` until auth wired.  
**Why:** Scaffold roles early; **not** production authorization.  
**Follow-up:** Real session roles — see Roadmap/Future.

### ADR-007 — Dual AI surfaces
**Status:** Accepted  
**Decision:** OpenAI only on contract import path; `/ai` page is rule-based.  
**Why:** Cost/control; avoid implying full LLM assistant prematurely.
