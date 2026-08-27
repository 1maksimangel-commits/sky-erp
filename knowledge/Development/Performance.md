# Development — Performance

## Purpose

Performance expectations for SKY ERP.

## Current state

Guidance from `AGENTS.md` and architecture docs; no formal benchmark suite in repo.

## Confirmed rules

- Avoid unnecessary queries and N+1 patterns.  
- Prefer server-side filtering/pagination for large lists.  
- Use indexes (FK/filter/unique) in migrations.  
- Reports/analytics should be optimized and read-only.  
- Large uploads stream; do not buffer huge PDFs in Server Actions.  
- Optimize rendering: Server Components first; client only for interactivity.

## Constraints

- Do not add caching that serves stale financial/stock truth without an explicit strategy.  
- `revalidatePath` after mutations that operators expect to see immediately.

## Known risks / gaps

- Some list pages may over-fetch; not fully profiled.  
- Dashboard aggregations depend on live data volume.

## Development rules

- Measure before large “optimization” refactors.  
- Prefer SQL/index fixes over premature client memoization.

## Planned

- Targeted indexes from audit gaps · optional materialized report RPCs · upload resume for large PDFs.
