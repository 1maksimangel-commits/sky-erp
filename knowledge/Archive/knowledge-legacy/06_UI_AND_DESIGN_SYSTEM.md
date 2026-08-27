# SKY ERP — UI and Design System

## Purpose

Keep the ERP visually consistent and operations-dense.

## Current state

- Dark ERP shell via `src/app/globals.css` tokens and `(erp)` layout.
- Guidelines: `docs/UI_GUIDELINES.md`, patterns in `knowledge/06_UI_PATTERNS.md`.
- Icons: `lucide-react`.
- Fonts: Geist Sans / Geist Mono (app setup).

## Confirmed design rules

| Topic | Rule |
| --- | --- |
| Theme | Dark mode primary inside ERP |
| Density | Professional tables/forms; not marketing landing pages |
| Tokens | Use `background`, `foreground`, `card`, `border`, `muted-foreground`, `accent`, `ring` |
| Status colors | Translucent emerald/amber/red/zinc patterns already used |
| Buttons | Primary = foreground fill; secondary = border |
| Panels | `erp-panel` / existing table shells |
| Empty states | Shared `EmptyState` with serializable props |
| Modals | Existing form modal patterns (border, card, header/footer) |

### Anti-patterns (do not introduce in ERP)

- Purple-on-white / cream-serif marketing aesthetics
- Glow stacks, emoji decoration, hero marketing layouts
- Inventing new color systems when tokens exist

## Constraints

- Reuse components before creating new primitives.
- Do not invent spacing/color systems outside Tailwind tokens already in use.
- Server → Client props must stay serializable (no functions/class instances as props).

## Known risks / gaps

- Lint flags many `setState` calls inside `useEffect` in modals (React Compiler rules).
- Some orphaned components remain (`ContractWorkflow`, etc.) — prefer active workspace shells.

## Development rules

- Match neighboring screens in the same module.
- One primary action in page headers.
- Keep filters/tables predictable across modules.

## Planned

- Broader shared DataTable standardization where not already shared.
- Accessibility pass on modals and tables.
