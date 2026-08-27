# SKY ERP — UI Patterns

Reusable interface patterns for the dark enterprise workspace. Implement new screens by composing these patterns before inventing new ones. See also `/docs/UI_GUIDELINES.md`.

---

## 1. Application shell

| Pattern | Behavior |
| --- | --- |
| Collapsible sidebar | Desktop collapse to icon rail; mobile off-canvas drawer |
| Top bar search | Opens command palette (⌘K) |
| Quick Create | `+ New` dropdown → deep link `?new=1` to module create |
| Notification drawer | Right sheet; unread badge; category groups |
| User menu | Profile / settings / sign out affordances |
| Breadcrumbs | Home → module → detail/tab |
| Page header | Title + description + registered actions |

---

## 2. Page header & actions

```text
[Breadcrumbs]
Title                         [Secondary] [Primary CTA]
Description
```

- Module views register CTAs via `PageActions` (client).
- Do not duplicate the shell description inside the view body.
- Primary CTA: inverted button (`bg-foreground text-background`).

---

## 3. Command palette

- Shortcut ⌘K / Ctrl+K.
- Search companies, counterparties, products, contracts, invoices, shipments, documents.
- Keyboard: ↑↓, Enter, Esc.
- Group results by entity type with icons.

---

## 4. Data tables

**DataTable** (full featured)

- Sticky header
- Column sort
- Pagination + page size
- Column visibility
- Density compact / comfortable

**TableShell** (wrap existing markup)

- Sticky header chrome + density + record count
- Use when migrating tables incrementally

**Row click** → detail route; action icon buttons `stopPropagation`.

---

## 5. Empty states

Centered panel (`erp-panel`):

- Icon in bordered well
- Title + one-sentence description
- Optional primary action

Distinguish **no data** vs **filters matched nothing**.

---

## 6. Forms & dialogs

- Modal: backdrop blur, Escape, backdrop click (blocked while saving)
- Required fields marked with red asterisk
- Inline error banner at top of form
- Footer: Cancel (secondary) + Save (primary, shows spinner when saving)
- Reset form state when `open` becomes true

---

## 7. KPI cards

- `erp-panel` tile
- Label (xs muted) + large metric + icon well
- Grid: 2 cols tablet, 4 cols desktop

---

## 8. Filters bar

- Search input with leading icon
- Selects for status / company / party
- Filters are client-side unless dataset requires server query

---

## 9. Entity workspace (detail)

- Breadcrumb back to list
- Title = entity name; subtitle = code/number
- Status chip
- Tabs or panels: Overview, Documents, Timeline, Linked, Finance (as applicable)
- Prefer `EntityWorkspace` over custom detail chrome

---

## 10. Contract hub

- Persistent contract shell + tab routes under `/contracts/[id]/…`
- Overview editor + module tabs (logistics, warehouse, finance, documents, history)
- Import wizard → review workspace (two-pane PDF + fields) before create

---

## 11. Feedback

| State | Pattern |
| --- | --- |
| Success | Toast bottom-right + `router.refresh()` |
| Error | Red alert card / form banner |
| Loading button | Disabled + `Loader2` + label |
| Long job | Staged progress list + progress bar |

---

## 12. Documents

- Upload dropzone (MIME + size validation)
- Preview modal for PDFs/images
- Delete confirm dialog
- Partial upload failure must not destroy parent entity UI state

---

## 13. Responsive breakpoints

| Surface | Behavior |
| --- | --- |
| Mobile | Sidebar drawer; stacked headers; horizontal table scroll |
| Tablet | 2-column KPIs; condensed top bar |
| Desktop | Collapsible sidebar; wide tables; command palette |

---

## 14. Visual tokens

Use semantic classes only: `bg-background`, `bg-card`, `border-border`, `text-muted-foreground`, `erp-panel`, status emerald/red/amber/zinc chips.

No purple glow, no light marketing themes inside ERP.

---

## Related knowledge

- `/docs/UI_GUIDELINES.md`
- `/docs/PROJECT_STANDARDS.md`
