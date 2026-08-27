# SKY ERP — Testing and Quality

## Purpose

Define the minimum quality gate before completing work.

## Current state

| Check | How | Notes |
| --- | --- | --- |
| Lint | `pnpm lint` (`eslint`) | Required by AGENTS; recently failing on React hook rules |
| Build | `pnpm build` | Required; Next.js production build |
| Type-check | `./node_modules/.bin/tsc --noEmit` or build’s TS step | No dedicated `typecheck` script in `package.json` |
| Unit/E2E | Not standardized in `package.json` | Playwright mentioned in AGENTS policy only with approval |

Audit snapshot (`docs/audits/PROJECT_AUDIT_2026-08-05.md`): build pass, lint fail (28 errors / 2 warnings), tsc pass.

## Confirmed rules

- Before finishing tasks: `pnpm lint` and `pnpm build`; fix TypeScript errors.
- If tests exist, run them (`DEVELOPMENT_RULES.md`).
- Never leave broken types, permission regressions, or secret commits.
- Browser automation disabled by default; localhost Playwright only with explicit approval.

## Constraints

- Do not install test frameworks without approval.
- Do not use UI automation against personal accounts or external sites.
- Do not treat “build green” as “lint green”.

## Known risks / gaps

- No comprehensive automated test suite visible in package scripts.
- Lint debt concentrated in modal `useEffect` setState patterns.
- Manual UI and remote DB verification still required for many modules.

## Development rules

1. Reproduce with the smallest fixture when fixing bugs.
2. Prefer server-side validation tests / pure function tests when adding a runner later.
3. For PDF import, verify error paths (missing table, invalid MIME, abort) not only happy path.
4. Keep fixtures small; never commit secrets or real customer PDFs with PII if avoidable.

## Planned

- CI pipeline for lint + build (+ tsc).
- Targeted unit tests for import validation, finance math, matching.
- Approved Playwright smoke against localhost only.
