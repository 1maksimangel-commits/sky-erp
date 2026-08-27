# Mandatory AI Engineering Workflow

All medium and large tasks follow this sequence. Small, clearly scoped fixes may compress stages but must not skip security or human approval where the matrix requires them.

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

## Stage definitions

### 1. Request

User states a goal. Agents do not expand scope silently.

**Owner:** any role (intake) → Product Owner  

### 2. Product clarification

Define problem, user value, acceptance criteria, and out-of-scope.

**Owner:** Product Owner  
**Output:** criteria checklist  
**Stop:** inventing business rules  

### 3. Architecture plan

Identify modules, files, migrations, API surfaces, and alternatives.

**Owner:** Solution Architect (Chief Architect for cross-cutting)  
**Rule:** no direct implementation before architecture review for **medium or large** changes  

### 4. Risk assessment

Call out auth, RLS, data loss, OpenAI, uploads, multi-company, and rollback.

**Owner:** Solution Architect + Security Engineer (security-sensitive)  
**Output:** risk list with severity  

### 5. Implementation

Assigned engineers change only approved scope. Prefer small incremental diffs.

**Owners:** Backend / Frontend / Database / AI / Documentation as assigned  
**Rules:**

- no database change without migration review (Database Engineer + plan)  
- never edit applied migrations — add a new file  
- do not apply remote migrations in this stage  

### 6. Security review

Review authz, RLS, XSS, uploads, secrets, injection, SSRF, AI data handling.

**Owner:** Security Engineer  
**Rule:** no security-sensitive change proceeds without this review  

### 7. QA review

Run allowed local gates; document results and regressions.

**Owner:** QA Engineer  
**Rule:** no feature marked complete without QA evidence  

Default commands (when implementation occurred):

- `pnpm lint`  
- `pnpm build`  
- `pnpm exec tsc --noEmit`  

Do not suppress failures.

### 8. Human review

User reviews the plan, diff, and reports.

**Owner:** User  
**Stop:** agent must not self-approve high-risk work  

### 9. Commit approval

Commit only after **explicit user approval**. Follow AGENTS.md git rules.

**Owner:** User approves → implementer executes if asked  

### 10. Deployment approval

Production or remote environment changes only with **explicit user approval**.

**Rule:** **no production deployment by agents**  
**Includes:** `supabase db push`, remote SQL apply, hosting deploys  

## Size guidance (Planned workflow rule)

| Size | Examples | Required stages |
| --- | --- | --- |
| Small | Typo, single-file obvious bugfix | Risk skim → Implement → QA → Human if sensitive |
| Medium | Multi-file feature, one module | Full workflow |
| Large | Auth, RLS, cross-module, migrations + UI | Full workflow + Chief Architect + Security |

When uncertain, treat as medium.

## Cross-cutting rules

| Rule |
| --- |
| No commit or push without explicit user approval |
| No production deployment by agents |
| No database change without migration review |
| No security-sensitive change without Security Engineer review |
| No feature marked complete without QA evidence |
| `AGENTS.md` always wins on conflict |
| Runtime defects and approved local feature work follow `AGENTS.md` § Autonomous Development Loop (Director-owned through DoD or gated stop; Pattern F in `AI_DIRECTOR.md`) |
| Bugs (runtime / tsc / build / lint / failed user action) follow Autonomous Bug Resolution: reproduce → root cause → fix → validate → repeat; user never debugs |
| User Time Protection: if the AI can investigate/search/reproduce/patch/test/verify, it must; never ask the user to inspect code or logs when access exists |
| Continuous Development: after each completed task, E2E verify, scan module for related defects, fix, validate, then next highest-priority task |
| Business First: data integrity → workflows → automation → performance → UI polish → refactoring; never polish unfinished workflows |
| SKY ERP Vision (`VISION.md`): prioritize only work that improves Sales, Procurement, Logistics, Warehouse, Finance, Documents, Analytics, or AI Automation |
| Root Cause: never patch symptoms; fix root cause; fix the entire bug class when it can recur elsewhere |
| Do not ask the human to read intermediate logs or choose the next technical step |
| Cap implementation–validation retries at 10; then one blocker report |
| Temporary public INSERT RLS policies are development-only and need explicit DB approval + future company-scoped replacement |

## Handoff format (minimum)

Each stage handoff should state:

1. What changed or was decided  
2. Risks remaining  
3. Next role  
4. Whether approval is required  
