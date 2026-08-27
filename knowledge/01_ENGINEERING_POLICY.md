# SKY ERP — Engineering Policy

## Purpose

How to change the codebase safely.

## Current state

Enforced by `AGENTS.md`, this file, and `Development/CodingStandards.md`.

## Confirmed policy

| Rule | Meaning |
| --- | --- |
| Inspect before changing | Read knowledge + existing `src/lib` / UI / migrations |
| Extend before replacing | Additive changes over rewrites |
| No duplicate business logic | Domain rules in `src/lib/`, not copy-pasted UI |
| Small incremental changes | One coherent concern per change set |
| Backward compatibility | Especially contracts & PDF import |
| No large refactors without approval | Moves/renames/deletes need explicit OK |
| Plan before code | Multi-file/schema work: outline when uncertain |
| Build and lint before completion | `pnpm lint` + `pnpm build`; fix TypeScript errors |

### Module workflow (condensed)

```text
Analysis → Database design → Migration → Server Action / Route Handler
  → UI → Testing → Review → Build → Git (when approved)
```

Details: `Development/CodingStandards.md`, archived `docs/DEVELOPMENT_WORKFLOW.md`.

### Prefer / avoid

| Prefer | Avoid |
| --- | --- |
| Server Components | Unnecessary client state |
| Server Actions / typed APIs | Untyped ad-hoc fetches |
| Zod validation | Untyped payloads |
| Migrations for schema | Manual production SQL |
| Existing design tokens | New visual systems |
| Strict TypeScript | `any`, silent ignores |

### Naming (canonical)

| Layer | Convention |
| --- | --- |
| DB tables/columns | `snake_case` |
| TS types / components | `PascalCase` |
| Functions / actions | `camelCase` verbs (`createContract`) |
| Routes | `kebab-case` |
| Migrations | `YYYYMMDDHHMMSS_description.sql` |

## Constraints

- Dependency install/remove, auth, RLS, env, destructive SQL → **approval**.  
- Repository-only workspace.  
- Standard package tool per AGENTS: **pnpm**.

## Known risks / gaps

- Lint may fail while build passes — both gates matter.  
- Dual lockfiles historically present — standardize on pnpm (**Planned** cleanup).

## Development rules

- Fill mental checklist: inspect → extend → validate → lint/build.  
- When uncertain: stop, explain, wait.

## Planned

- CI for lint + build.  
- Single lockfile after approval.
