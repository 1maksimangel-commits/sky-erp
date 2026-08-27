# Architecture Decision Log

ADR-style log for SKY ERP. Add new entries; do not silently rewrite history.

## Template

```markdown
## ADR-XXX — Title

- Status: Proposed | Accepted | Superseded
- Date: YYYY-MM-DD
- Decision makers: …
- Context: …
- Decision: …
- Consequences: …
- Related: links to knowledge / migrations / AGENTS
```

---

## ADR-001 — Supabase / PostgreSQL as system of record

- **Status:** Accepted  
- **Date:** Confirmed in project policy (2026)  
- **Context:** ERP needs relational data, auth integration path, and storage.  
- **Decision:** Use Supabase (PostgreSQL) as the database platform.  
- **Consequences:** Schema changes via SQL migrations; app uses Supabase clients.  
- **Related:** `knowledge/03_DATABASE_AND_MIGRATIONS.md`, `AGENTS.md`

## ADR-002 — Next.js App Router

- **Status:** Accepted  
- **Context:** Need server-first ERP UI with Server Actions and Route Handlers.  
- **Decision:** Next.js App Router (`src/app`), React Server Components preferred.  
- **Consequences:** Thin pages, fat `src/lib` modules; large uploads via Route Handlers.  
- **Related:** `knowledge/02_SYSTEM_ARCHITECTURE.md`

## ADR-003 — Migration-only schema changes

- **Status:** Accepted  
- **Context:** Prevent silent production drift and irreversible edits.  
- **Decision:** Schema changes only through new `supabase/migrations/*.sql` files; never edit applied migrations.  
- **Consequences:** Additive migrations; remote apply requires approval.  
- **Related:** `AGENTS.md` Database Rules, `knowledge/03_DATABASE_AND_MIGRATIONS.md`

## ADR-004 — RLS required

- **Status:** Accepted (enforcement incomplete)  
- **Context:** Multi-tenant ERP data must not rely on UI hiding alone.  
- **Decision:** Row Level Security must remain enabled; policies evolve via migrations.  
- **Consequences:** Current policies are development-open (`using (true)`); hardening Planned after auth.  
- **Related:** `knowledge/05_SECURITY_AND_AGENT_BOUNDARIES.md`, K-02

## ADR-005 — Multi-company ownership

- **Status:** Accepted (enforcement incomplete)  
- **Context:** Seafood trading operates multiple legal entities.  
- **Decision:** Records belong to a company; multi-company support is a core rule.  
- **Consequences:** App filtering/RLS must eventually enforce `company_id`; incomplete today (K-16).  
- **Related:** `AGENTS.md` Multi Company, business context

## ADR-006 — Human review before AI business-data changes

- **Status:** Accepted  
- **Context:** Contract PDF extraction can hallucinate or be prompt-injected.  
- **Decision:** AI may extract and suggest; humans confirm before durable business writes.  
- **Consequences:** Import review UX; no silent creates of contracts/invoices/payments/stock from AI.  
- **Related:** `AGENTS.md` OpenAI / AI Assistant, `knowledge/Modules/AI.md`

## ADR-007 — Repository-only agent boundary

- **Status:** Accepted  
- **Context:** Agents must not control the user’s machine or external accounts.  
- **Decision:** Agents work only inside this repository; no browser, email, banking, OS, or other projects.  
- **Consequences:** All roles inherit this boundary; see `management/README.md`.  
- **Related:** `AGENTS.md` Workspace / Absolute Security Boundary
