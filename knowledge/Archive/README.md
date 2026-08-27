# SKY ERP — Documentation Archive

This directory holds **historical snapshots** of documentation that was superseded during knowledge-base consolidation. These files are preserved for reference and audit; they are **not** the source of truth for day-to-day development.

## Canonical documentation (use these instead)

| Area | Location |
| --- | --- |
| Knowledge index & entry points | `knowledge/README.md`, `knowledge/DOCUMENTATION_INDEX.md`, and numbered foundation files (`00_`–`05_`) |
| Module-specific guides | `knowledge/Modules/` |
| Engineering workflow & standards | `knowledge/Development/` |
| Roadmap & release planning | `knowledge/Roadmap/` |
| Known issues & operational memory | `knowledge/Memory/` |
| Agent operating manual | `AGENTS.md` (repository root) |

When guidance in this archive conflicts with canonical docs or `AGENTS.md`, **canonical docs and `AGENTS.md` win**.

## Archive layout

| Subfolder | Contents |
| --- | --- |
| `knowledge-legacy/` | Former `knowledge/0X_*.md` module and domain documents (business rules, data model, AI rules, UI patterns, per-module notes, roadmaps, etc.) |
| `docs/` | Former `docs/*.md` governance files (architecture, database guidelines, development workflow, module template, project standards, UI guidelines) and `docs/audits/` |
| `root/` | Former repository-root stubs (`BUSINESS_CONTEXT.md`, `DATABASE.md`, `DEVELOPMENT_RULES.md`, `00_PROJECT_VISION.md`) |

## Maintenance

- Do not treat archive paths as links targets in new code or new docs unless explicitly documenting history.
- New documentation belongs under the canonical locations above, not under `Archive/`.
- If you need to refresh an archive snapshot, copy full file contents from the original source at consolidation time; do not edit archive files in place to “fix” current product behavior—fix canonical docs instead.
