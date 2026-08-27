# Module — Reports

## Purpose

Read-only analytics.

## Current state

| Surface | State |
| --- | --- |
| `/reports` | Placeholder EmptyState → points to finance reports |
| `/finance/reports` | Implemented finance reporting |
| `/dashboard` | Ops snapshot, not full BI |

## Confirmed rules

- Reports must never modify data.  
- Prefer server-side aggregation.  
- Explicit empty/error states.

## Constraints

- Do not treat `/reports` as complete.  
- Avoid N+1 in new analytics.

## Known risks / gaps

- No cross-module reporting workspace.  
- App-layer role scoping absent (permissions stub).

## Development rules

- Keep pages serializable/RSC-friendly.  
- Reuse finance formatters for money.

## Planned

- Cross-module KPIs · multi-company consolidation · optimized aggregates.
