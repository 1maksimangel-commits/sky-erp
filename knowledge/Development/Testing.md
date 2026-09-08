# Development — Testing

## Purpose

Quality gates and testing expectations.

## Current state

| Gate | Command | Notes |
| --- | --- | --- |
| Lint | `pnpm lint` | Required; may currently fail on React hook rules |
| Build | `pnpm build` | Required |
| Types | build TS step or `./node_modules/.bin/tsc --noEmit` | No `typecheck` script in package.json |
| Unit/E2E | Not in package scripts | Playwright only with explicit approval, localhost only |
| Schema checker unit tests | `pnpm db:test` | Negative tests for missing objects, FK/RPC drift, mandatory columns |
| Database source inventory | `pnpm db:check` | Offline only; not a reconstruction PASS |
| Clean Supabase replay | `pnpm db:replay` | Real isolated stack, canonical history, catalog comparison, rollback-only SQL fixtures |

See [DatabaseReconstruction.md](./DatabaseReconstruction.md). The database replay
workflow runs these gates plus TypeScript, lint, build, and diff checks in CI.

## Confirmed rules

- Fix TypeScript errors before done.  
- If tests exist, run them.  
- No browser automation by default (`AGENTS.md`).  
- Prefer small fixtures; avoid committing PII-heavy PDFs.

## Constraints

- Do not install test frameworks without approval.  
- Build green ≠ lint green.

## Known risks / gaps

- No comprehensive automated suite yet.  
- Many issues need manual UI / remote DB confirmation.

## Development rules

- Reproduce with smallest case.  
- For import: test invalid MIME, size, abort, missing-table error paths.

## Planned

- CI lint+build · unit tests for validation/matching/money · approved localhost smoke tests.
