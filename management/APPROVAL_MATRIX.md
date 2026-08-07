# Approval Matrix

Explicit **user** approval is required before an agent performs the actions below.  
Read-only analysis inside the repository does **not** require approval.

| Action | Approval required | Notes |
| --- | --- | --- |
| Read-only code/docs analysis | **No** | Stay inside repository |
| Small in-scope code fix (non-security) | Per task brief | Still follow AGENTS.md |
| Dependency installation | **Yes** | `pnpm add` / remove |
| Dependency removal | **Yes** | Including lockfile cleanup that deletes a lockfile |
| Authentication changes | **Yes** | Session, JWT, middleware, role resolution |
| RLS policy changes (effective) | **Yes** | Not proposal-only comments |
| Remote database changes | **Yes** | Any live Supabase/SQL |
| Migration application (local or remote) | **Yes** | Including SQL Editor apply / `db push` |
| File deletion | **Yes** | Docs or code |
| File moves or renames | **Yes** | Broad or targeted |
| Large refactors | **Yes** | Cross-module rewrites |
| Git commit | **Yes** | Never commit unless asked |
| Git push | **Yes** | Never push unless asked |
| Production deployment | **Yes** | Agents must not deploy |
| Secret or environment changes | **Yes** | No `.env` edits; never print secrets |
| Browser automation | **Yes** | Forbidden by default in AGENTS.md |
| External API additions | **Yes** | New providers / endpoints |
| Data migrations / backfills | **Yes** | Especially destructive or bulk |
| Destructive SQL | **Yes** | DROP, TRUNCATE, mass DELETE, etc. |
| OpenAI / live external calls during audits | **Yes** | AI Engineer boundary |
| Weakening security controls | **Forbidden** | Not approvable as a shortcut |

## Role participation (who reviews — not who alone approves)

| Action class | Must involve |
| --- | --- |
| Schema / migrations | Database Engineer + Security (if RLS) |
| Auth / RLS | Security Engineer + Chief Architect for design |
| UI XSS / uploads | Frontend + Security |
| OpenAI / import | AI Engineer + Security |
| CI / lockfiles | DevOps + user approval |
| Docs-only | Documentation Engineer |

Final **Yes** in the matrix always means the **human user** grants approval. Roles prepare evidence; they do not replace the user for gated actions.

## Autonomous Development Loop interaction

Authority: `AGENTS.md` § Autonomous Development Loop and `management/AI_DIRECTOR.md` Pattern F.

| Situation | Agent behavior |
| --- | --- |
| Local in-repo implementation, tests, docs, lint/tsc/build | **No** additional approval — continue the loop |
| Same gated action blocked again in one task | **Do not** re-ask; keep one consolidated approval package |
| Remote migration apply / remote Supabase write / deploy / secrets / service_role / weaken RLS / commit / push | **Stop** and return one consolidated approval request |

### Consolidated approval request (required fields)

1. Exact action  
2. Target environment  
3. Exact files or SQL  
4. Expected effect  
5. Risk  
6. Rollback  
7. Verification method  

### Development-only RLS policies

Temporary `TO public WITH CHECK (true)` INSERT policies (for example the prepared products INSERT migration) are **not** production architecture. They require explicit database approval to apply and must be replaced by authenticated company-scoped RLS before production.
