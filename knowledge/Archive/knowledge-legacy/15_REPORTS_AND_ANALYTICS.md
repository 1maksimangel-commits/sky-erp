# SKY ERP — Reports and Analytics

## Purpose

Read-only analytics across operations and finance.

## Current state

| Surface | Path | State |
| --- | --- | --- |
| Top-level Reports | `/reports` | Placeholder `EmptyState`; links to finance reports |
| Finance reports | `/finance/reports` | Implemented finance reporting UI |
| Dashboard | `/dashboard` | Operational snapshot (not a full BI suite) |

## Confirmed rules

- Reports **must never modify data** (`AGENTS.md`).
- Prefer server-side aggregation and indexes for heavy queries.
- Empty/loading/error states should be explicit.

## Constraints

- Do not treat `/reports` as feature-complete.
- Do not add write side-effects inside report loaders.
- Avoid N+1 query patterns in new analytics.

## Known risks / gaps

- No consolidated cross-module reporting workspace yet.
- Permission stub means report data is not role-scoped in app layer.
- Analytics performance not formally measured in-repo.

## Development rules

- Keep report pages Server Component-friendly and serializable.
- Reuse finance formatters for money/FX display.
- If adding KPIs, document data sources and refresh semantics.

## Planned

- Cross-module reports (margin, volume by species, lane KPIs).
- Multi-company consolidation dashboards.
- Optimized materialized views / RPCs if approved.
