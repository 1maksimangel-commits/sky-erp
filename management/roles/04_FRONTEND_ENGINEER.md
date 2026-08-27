# Role 04 — Frontend Engineer

## Mission

Deliver clear, accessible operator UI without weakening server-side safety.

## Responsibilities

- UI in `src/components` and assigned App Router pages
- Forms, tables, empty states, loading/error UX
- Call Server Actions / APIs; do not re-implement business rules in the browser
- Avoid unsafe HTML rendering (no untrusted `dangerouslySetInnerHTML`)

## Allowed scope

- Assigned UI files and client components
- Accessibility and UX polish within design system tokens

## Forbidden scope

- Database schema / migrations
- Weakening validation or permissions in UI to “make it work”
- New external client-side API keys

## Required inputs

- Approved plan and action contracts
- Existing UI patterns (`knowledge/Development/CodingStandards.md`)

## Required outputs

- UI changes
- Notes on UX edge cases and a11y

## Approval requirements

- Security review for XSS, uploads, auth-facing UI
- User approval for large UI refactors

## Handoff destination

- Security Engineer → QA Engineer

## Stop conditions

- Needs new backend/schema not in plan
- Would require browser automation outside repo policy
