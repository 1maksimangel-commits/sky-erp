# Development — Coding Standards

## Purpose

Code style, UI system, and module coding conventions (single place).

## Current state

Merged from `DEVELOPMENT_RULES.md`, `docs/PROJECT_STANDARDS.md`, `docs/UI_GUIDELINES.md`, `knowledge/06_UI_*` (archived).

## TypeScript & structure

- Strict TypeScript; avoid `any`.  
- Zod for external/form validation.  
- Domain logic in `src/lib/<module>/`; UI in `src/components/<module>/`.  
- Types in `types.ts`; formatters in `format.ts`; DB helpers in `db.ts`; mutations in `actions.ts`.  
- Empty string → `null` for optional DB fields where that pattern exists.

## UI / design system

- Dark ERP shell; semantic tokens (`background`, `foreground`, `card`, `border`, `muted-foreground`, `accent`, `ring`).  
- Dense tables/forms; one primary header action.  
- Status: translucent emerald/amber/red/zinc patterns already used.  
- Reuse modals, `EmptyState`, table shells, EntityWorkspace.  
- No marketing hero layouts, purple/cream themes, or glow stacks in ERP.  
- Fonts: Geist Sans / Mono.  
- Server→Client props must be serializable.

## Quality habits

- Meaningful errors; no swallowed failures.  
- No secrets in logs/toasts.  
- Prefer extending existing components.  
- `pnpm lint` + `pnpm build` before completion.

## Constraints

- Next.js version in repo has breaking changes — read local Next docs under `node_modules/next/dist/docs/` when unsure (`AGENTS.md` / CLAUDE note).  
- Do not invent columns.

## Known risks / gaps

- Widespread lint: setState in effects in modals.  
- Some orphaned components remain.

## Development rules

Follow `01_ENGINEERING_POLICY.md` + this file. New UI copy should use glossary terms from `04_BUSINESS_CONTEXT.md`.

## Planned

- Clear lint debt · shared DataTable consolidation where beneficial.
