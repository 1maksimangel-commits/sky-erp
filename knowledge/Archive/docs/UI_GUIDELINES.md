# SKY ERP — UI Guidelines

Visual and interaction standards for the dark SKY ERP shell. Follow existing components before inventing new patterns.

---

## 1. Design intent

- Dense, professional, operations-first.
- Dark theme only inside the ERP shell.
- High signal, low decoration: no marketing hero layouts, no glow, no pill clusters.
- One primary action per page header region (e.g. **New Company**).
- Tables and forms do the work; cards are for KPI or interactive containers, not ornament.

---

## 2. Colors

Semantic tokens from `src/app/globals.css`:

| Token | Usage |
| --- | --- |
| `bg-background` / `text-foreground` | Page canvas and primary text |
| `bg-sidebar` | Navigation rail |
| `bg-card` / `border-card-border` | Panels and tables |
| `bg-accent` | Row hover, subtle fills, icon wells |
| `border-border` | Dividers, inputs, dialogs |
| `text-muted-foreground` | Labels, secondary copy, empty hints |
| `ring-ring` / `focus:ring-1` | Focus |

**Status accents** (translucent + ring, never flat neon):

| State | Classes (pattern) |
| --- | --- |
| Success / Active | `bg-emerald-500/10 text-emerald-400 ring-emerald-500/20` |
| Error | `border-red-500/30 bg-red-500/10 text-red-300` |
| Warning | `border-amber-500/30 bg-amber-500/10 text-amber-100` |
| Neutral / Inactive | `bg-zinc-500/10 text-zinc-400 ring-zinc-500/20` |

Do not introduce purple-on-white or cream/serif marketing themes in ERP screens.

---

## 3. Typography

- Font: Geist Sans (app), Geist Mono for codes.
- Page description under header: `text-sm text-muted-foreground`.
- Table headers: `text-xs font-medium text-muted-foreground`.
- Table body: `text-sm`; primary name `font-medium text-foreground`.
- Codes: `font-mono text-xs text-muted-foreground`.
- Dialog title: `text-base font-semibold`.
- KPI value: `text-2xl font-semibold tracking-tight`.
- Required field marker: red asterisk on label (`text-red-400`).

---

## 4. Spacing

| Context | Guidance |
| --- | --- |
| Page stack | `space-y-6` |
| Header row | `flex` + `gap-4`; stack on small screens |
| Form grid | `grid gap-4 sm:grid-cols-2` |
| Dialog padding | `px-5 py-4` / `sm:px-6` |
| Table cells | `px-4 py-3` |
| Button gaps | `gap-2` icon+label |

Prefer consistent 4px grid multiples via Tailwind (`1`, `1.5`, `2`, `3`, `4`, `5`, `6`).

---

## 5. Buttons

### Primary

```text
rounded-md bg-foreground px-3.5|px-4 py-2 text-xs|text-sm font-medium text-background
hover:opacity-90 disabled:opacity-50
```

Use for **New …**, **Save**, **Start Extraction**, confirmations that advance work.

### Secondary / Cancel

```text
rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground
hover:bg-accent disabled:opacity-50
```

### Icon button (close)

```text
rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground
```

### Rules

- Always `type="button"` unless submit.
- Disable while `saving` / `busy`.
- Show `Loader2` + label when in-flight.
- Header CTA includes Lucide icon (`Plus`, etc.) at `h-3.5 w-3.5`.

---

## 6. Tables

Shell:

```text
rounded-lg border border-card-border bg-card overflow-hidden
overflow-x-auto → table min-w-[640px]
thead: border-b border-border bg-accent/30
tbody: divide-y divide-border
tr: hover:bg-accent/20
```

**Rules**

- First column often links to detail (`Link` + `hover:underline`).
- Empty numeric/text → em dash `—`.
- Status via badge component pattern (pill + ring).
- No zebra striping beyond hover.
- Keep column set aligned with real DB fields.

---

## 7. Forms

- Labels: `text-xs font-medium text-muted-foreground` above controls.
- Inputs:

```text
w-full rounded-md border border-border bg-background px-3 py-2 text-sm
placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring
```

- Checkbox row: bordered height-matched control with Active/Inactive text.
- Client-side required checks before Server Action.
- Server errors shown in a red alert banner at the top of the form body.
- Trim strings; map empty optional fields to `null` in the action payload.
- Do not invent fields absent from schema.

---

## 8. Dialogs / modals

Standard structure (see Company / Counterparty modals):

1. Full-screen overlay `fixed inset-0 z-50`.
2. Backdrop button: `bg-black/60 backdrop-blur-sm` — click closes if not saving.
3. Panel: `max-w-3xl` (or `max-w-xl` for simple wizards), `rounded-xl border border-border bg-card shadow-2xl`.
4. Header with title + close (`X`).
5. Scrollable body; sticky footer with Cancel + Save.
6. Escape closes when not saving; lock `document.body.style.overflow`.
7. `role="dialog"` + `aria-modal` + labelled title id.

Confirm/delete dialogs: shorter width, destructive copy, explicit confirm label.

---

## 9. Cards

Allowed for:

- KPI tiles on list pages
- Error / warning callouts
- Empty states
- Interactive containers (upload dropzone)

Avoid wrapping every table or form section in nested cards. Prefer border on the table shell itself.

KPI card pattern:

```text
rounded-lg border border-card-border bg-card p-5
title: text-xs text-muted-foreground
value: text-2xl font-semibold
icon well: rounded-md bg-accent p-2
```

---

## 10. Icons

- Library: **lucide-react**.
- Nav icons from `src/lib/navigation.ts`.
- Default sizes: `h-4 w-4` inline; `h-3.5 w-3.5` in compact buttons; `h-5 w-5` in alerts; `h-8 w-8` empty states.
- Do not mix icon packs.
- No emoji as UI icons.

---

## 11. Dark theme

- Assume dark canvas always for `(erp)` shell.
- Prefer token classes over hardcoded hex.
- Maintain contrast for small `text-xs` muted labels.
- Scrollbars and focus rings should remain visible on `#09090b`.
- Toasts sit above dialogs (`z-[100]`).

---

## 12. Loading state

| Context | Pattern |
| --- | --- |
| Button submit | Disable + `Loader2` spin + “Saving…” |
| Long process (import) | Stage list + progress bar |
| Page | Prefer server render; avoid blank flash — show shell with content as ready |
| Re-extract / refresh | Local busy flag on the triggering control |

Never leave a primary button click with zero feedback.

---

## 13. Empty state

```text
rounded-lg border border-card-border bg-card p-12 text-center
icon (optional) muted
title: text-sm font-medium text-foreground
hint: text-sm text-muted-foreground
```

Distinguish **no data yet** vs **filters matched nothing**.

---

## 14. Error state

- List load failure: bordered red card with `AlertCircle`, title, message.
- Form/action failure: inline alert inside modal/page; keep user input.
- Permission / RLS: clear human message; do not fail silently.
- Partial success (e.g. entity created, file upload failed): keep parent; show error for the failed step.

---

## 15. Success state

- `Toast` bottom-right: success variant with check icon.
- Close modal on success.
- `router.refresh()` so tables show the new row.
- Optional redirect to detail after create when the flow is “create and open” (contracts); list modules usually stay on list + toast.

---

## 16. Layout chrome

- Sidebar + header from `src/components/layout/`.
- Page title often provided by layout/header; body starts with short description + primary CTA.
- Detail pages: `EntityWorkspace` with breadcrumb back to module list.

---

## 17. Motion

- Use sparingly: spinner rotation, progress width `transition-all`, opacity on buttons.
- No decorative parallax or page entrance choreography in ERP modules.

---

## Related documents

- [PROJECT_STANDARDS.md](./PROJECT_STANDARDS.md)
- [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md)
- [MODULE_TEMPLATE.md](./MODULE_TEMPLATE.md)
