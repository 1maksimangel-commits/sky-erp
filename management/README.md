# SKY ERP — AI Engineering Department

## Purpose

This directory defines how AI agents collaborate on SKY ERP with **separated responsibilities**, **controlled handoffs**, and **mandatory review gates**.

It does **not** replace `AGENTS.md`. It organizes work so medium and large tasks are planned, reviewed, and approved before risky changes land.

**Autonomous Development Loop: ENABLED.** Default mode is `AGENTS.md` § Autonomous Development Loop and `AI_DIRECTOR.md` Pattern F — the human reports a business task or defect; the Director owns continuity through DoD or a gated stop.

## Authority

1. **`AGENTS.md` (repository root)** — highest priority. No role may weaken or bypass it.  
2. **Code + `supabase/migrations/`** — override outdated prose.  
3. **`knowledge/`** — product and engineering truth for modules and policy.  
4. **`management/`** — role workflow, sprint, backlog, and gates for agents.  
5. **`public/management/`** — legacy placeholders; **not** the canonical department (do not treat as current).

## Hard boundaries (all roles)

| Rule |
| --- |
| Work **only inside this repository** |
| No role may bypass security rules in `AGENTS.md` |
| No browser control, email, messaging, banking, or OS changes |
| No remote Supabase apply, commit, or push without **explicit user approval** |
| No inventing schema, APIs, or business facts — mark unknowns **Planned** |

## Reading order

1. `AGENTS.md`  
2. `management/README.md` (this file)  
3. `management/WORKFLOW.md`  
4. `management/APPROVAL_MATRIX.md`  
5. Relevant file under `management/roles/`  
6. `management/CURRENT_SPRINT.md` / `BACKLOG.md` / `KNOWN_BUGS.md` as needed  
7. `knowledge/README.md` and the relevant `knowledge/Modules/*` doc  

## Roles

| Role | File |
| --- | --- |
| Chief Architect | `roles/00_CHIEF_ARCHITECT.md` |
| Product Owner | `roles/01_PRODUCT_OWNER.md` |
| Solution Architect | `roles/02_SOLUTION_ARCHITECT.md` |
| Backend Engineer | `roles/03_BACKEND_ENGINEER.md` |
| Frontend Engineer | `roles/04_FRONTEND_ENGINEER.md` |
| Database Engineer | `roles/05_DATABASE_ENGINEER.md` |
| Security Engineer | `roles/06_SECURITY_ENGINEER.md` |
| QA Engineer | `roles/07_QA_ENGINEER.md` |
| DevOps Engineer | `roles/08_DEVOPS_ENGINEER.md` |
| AI Engineer | `roles/09_AI_ENGINEER.md` |
| Documentation Engineer | `roles/10_DOCUMENTATION_ENGINEER.md` |

Team overview: `AI_TEAM.md`.

## Workflow stages (mandatory)

```text
Request
  → Product clarification
  → Architecture plan
  → Risk assessment
  → Implementation
  → Security review
  → QA review
  → Human review
  → Commit approval
  → Deployment approval
```

Details: `WORKFLOW.md`.

## Approval gates

High-risk actions require explicit user approval. See `APPROVAL_MATRIX.md`.

Examples: dependencies, auth, RLS, remote DB, migration apply, deletes/moves/renames, large refactors, commit, push, production deploy, secrets/env, browser automation, external APIs, data migrations, destructive SQL.

Safe **read-only** analysis does not require approval.

## Auth foundation (design)

| Document | Purpose |
| --- | --- |
| `AUTH_SYSTEM.md` | Current auth report, middleware flow, risks |
| `ROLE_MODEL.md` | Target ERP roles |
| `PERMISSION_MATRIX.md` | Module × role grants |
| `COMPANY_MODEL.md` | Company isolation + table ownership inventory |
| `AUDIT_LOG_MODEL.md` | Audit event catalog |
| Proposal SQL | `supabase/migrations/20260805070000_auth_foundation_proposal.sql` (not applied) |

## Related documentation

| Area | Location |
| --- | --- |
| Engineering policy | `knowledge/01_ENGINEERING_POLICY.md` |
| Architecture | `knowledge/02_SYSTEM_ARCHITECTURE.md` |
| Database | `knowledge/03_DATABASE_AND_MIGRATIONS.md` |
| Security | `knowledge/05_SECURITY_AND_AGENT_BOUNDARIES.md` |
| Audits | `docs/audits/`, `knowledge/Archive/docs/audits/` |
| Known issues memory | `knowledge/Memory/KNOWN_ISSUES.md` |
