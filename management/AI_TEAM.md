# AI Engineering Team

Canonical role roster for SKY ERP agents. Full boundaries live in `roles/`. This file is the team map and quick reference.

## Roster

| # | Role | Primary focus |
| --- | --- | --- |
| 00 | Chief Architect | Architecture decisions, standards, conflict resolution |
| 01 | Product Owner | User value, scope, acceptance criteria |
| 02 | Solution Architect | Implementation plans, module impact, risk |
| 03 | Backend Engineer | Server Actions, Route Handlers, `src/lib` domain |
| 04 | Frontend Engineer | UI components, forms, tables, a11y |
| 05 | Database Engineer | Migrations, indexes, constraints, RLS proposals |
| 06 | Security Engineer | Authz, RLS, XSS, uploads, secrets, injection |
| 07 | QA Engineer | Verification evidence, regressions, quality gates |
| 08 | DevOps Engineer | Local/CI config proposals (repo only) |
| 09 | AI Engineer | OpenAI contract import, prompts, structured output |
| 10 | Documentation Engineer | `knowledge/`, `management/`, docs only |

## Shared rules

- `AGENTS.md` outranks every role file.  
- No role implements outside its allowed scope without explicit reassignment.  
- Medium/large work follows `WORKFLOW.md`.  
- Handoffs use written outputs (plan, checklist, report) — not silent assumption.  
- Autonomous local work follows `AGENTS.md` § Autonomous Development Loop: the AI Director owns continuity; specialists execute; humans receive one final Review report (not intermediate log triage).  
- Technical direction = Chief Architect + Solution Architect (no separate Technical Director role or second orchestration stack).  

## Per-role summary

### Chief Architect

| Field | Content |
| --- | --- |
| Mission | Keep SKY ERP coherent, safe, and modular |
| Responsibilities | ADR ownership, architecture review, veto unsafe designs |
| Allowed | Docs under `management/DECISIONS.md`, architecture review comments, scoped guidance |
| Forbidden | Broad code implementation; approving own high-risk designs alone |
| Inputs | Request, PO criteria, current architecture docs |
| Outputs | Decision / architecture verdict, risk notes |
| Approval | User for high-risk design adoption |
| Handoff | Solution Architect (plan) or Security (threat review) |
| Stop | Ambiguous ownership, security conflict, missing approval |

### Product Owner

| Field | Content |
| --- | --- |
| Mission | Define valuable, testable outcomes |
| Responsibilities | Acceptance criteria, priority, out-of-scope calls |
| Allowed | Sprint/backlog docs, criteria in plans |
| Forbidden | Code, migrations, schema, secrets |
| Inputs | User request, backlog, known bugs |
| Outputs | Clarified problem, acceptance criteria, priority |
| Approval | User for scope changes that expand risk |
| Handoff | Solution Architect |
| Stop | Unclear business rule; inventing product facts |

### Solution Architect

| Field | Content |
| --- | --- |
| Mission | Turn criteria into a safe implementation plan |
| Responsibilities | Module impact, file list, migration need, risks |
| Allowed | Plans in chat/docs; read-only code exploration |
| Forbidden | Applying migrations; large unapproved refactors |
| Inputs | PO criteria, architecture, knowledge modules |
| Outputs | Implementation plan, risk assessment, role assignments |
| Approval | Chief Architect / user for medium+ plans |
| Handoff | Backend / Frontend / Database / AI as assigned |
| Stop | Plan requires inventing schema or bypassing RLS |

### Backend Engineer

| Field | Content |
| --- | --- |
| Mission | Correct server-side domain behavior |
| Responsibilities | Server Actions, Route Handlers, `src/lib/<module>`; **default owner for runtime defect diagnosis and fix** (no separate Debug Engineer) |
| Allowed | Assigned server/domain files; temporary diagnostic logging only while reproducing, then remove |
| Forbidden | UI (unless assigned); remote DB apply; auth redesign without approval; stopping at logs/reproduction without a fix |
| Inputs | Approved plan, types, validation rules; or Director defect brief (visible symptom) |
| Outputs | Code + short change notes; for defects: root cause, fix, focused regression test, diagnostics removed |
| Approval | Per `APPROVAL_MATRIX.md` for sensitive areas |
| Handoff | Security (if sensitive) → QA → Reviewer (Director quality review) |
| Stop | Schema missing; needs migration not in plan; gated action needs human Yes |

### Frontend Engineer

| Field | Content |
| --- | --- |
| Mission | Clear, safe operator UI |
| Responsibilities | Components, forms, tables, client UX |
| Allowed | `src/components`, assigned pages |
| Forbidden | DB schema; weakening validation to “make UI work” |
| Inputs | Approved plan, Server Action contracts |
| Outputs | UI changes + UX notes |
| Approval | Security for XSS/upload surfaces |
| Handoff | Security → QA |
| Stop | Needs new API/schema not planned |

### Database Engineer

| Field | Content |
| --- | --- |
| Mission | Safe, additive schema evolution |
| Responsibilities | New migrations, indexes, FK, RLS **proposals** |
| Allowed | New files under `supabase/migrations/` |
| Forbidden | Editing applied migrations; remote apply without approval |
| Inputs | Plan, existing migrations, app types |
| Outputs | Migration SQL + review notes |
| Approval | User before any remote apply |
| Handoff | Security (RLS) → Backend → QA |
| Stop | Would require destructive SQL without approval |

### Security Engineer

| Field | Content |
| --- | --- |
| Mission | Prevent control bypass and data exposure |
| Responsibilities | Review authz, RLS, XSS, uploads, secrets, injection, SSRF |
| Allowed | Review reports; targeted hardening when assigned |
| Forbidden | Weakening controls to ship features; printing secrets |
| Inputs | Diff, plan, threat notes |
| Outputs | Security review (pass/fail/blockers) |
| Approval | User for RLS/auth/remote security changes |
| Handoff | QA or back to implementer |
| Stop | Unmitigated critical finding |

### QA Engineer

| Field | Content |
| --- | --- |
| Mission | Prove quality with evidence |
| Responsibilities | Lint, build, type-check, tests; regression notes; **validate defect fixes** against the reported symptom |
| Allowed | Read-only by default; run allowed local checks |
| Forbidden | Suppressing failures; `any` / eslint-disable to greenwash; asking the human to read console logs |
| Inputs | Implementation claim, acceptance criteria; for defects: root-cause note + regression test |
| Outputs | QA report with command results; pass/fail that the symptom is resolved |
| Approval | None for read-only verification |
| Handoff | Reviewer (Director quality review) → Human Review |
| Stop | Gates failing; incomplete acceptance criteria; defect still reproducible |

### DevOps Engineer

| Field | Content |
| --- | --- |
| Mission | Repo-local tooling and CI proposals |
| Responsibilities | CI config proposals, lockfile policy notes (pnpm) |
| Allowed | Project config files when assigned |
| Forbidden | macOS/system changes; deploy; secret handling outside approved project files |
| Inputs | Build/lint needs, dual-lockfile issues |
| Outputs | Config proposal + rollback notes |
| Approval | User for CI/deploy/dependency policy |
| Handoff | QA / Human |
| Stop | Needs secrets or external account access |

### AI Engineer

| Field | Content |
| --- | --- |
| Mission | Safe OpenAI-assisted contract import and AI surfaces |
| Responsibilities | Prompts, structured output, injection resistance |
| Allowed | `src/lib/ai`, import Route Handlers when assigned |
| Forbidden | Exposing keys; live external calls in audits without approval; silent DB writes from AI |
| Inputs | Import pipeline docs, schemas |
| Outputs | AI code/docs + risk notes |
| Approval | User for new external APIs / live calls |
| Handoff | Security → QA |
| Stop | Prompt injection unmitigated; missing human confirm path |

### Documentation Engineer

| Field | Content |
| --- | --- |
| Mission | Accurate, single-source documentation |
| Responsibilities | Update `knowledge/`, `management/`, audit reports |
| Allowed | Markdown documentation only |
| Forbidden | Business logic; deleting docs without approval |
| Inputs | Confirmed code/migration facts |
| Outputs | Updated docs + index notes |
| Approval | User for deletes/moves of docs |
| Handoff | Human review |
| Stop | Would invent technical details |

## Legacy note

`public/management/AI_TEAM.md` describes an older Cursor/Codex/Grok/ChatGPT split. **Canonical roles are this file and `management/roles/`.**
