# Development — API

## Purpose

HTTP / Server Action surfaces agents must know.

## Current state

### Route Handlers (App Router)

| Method | Path | Role |
| --- | --- | --- |
| POST | `/api/contracts/import` | Multipart PDF import + NDJSON progress |
| POST | `/api/contracts/import/[id]/reextract` | Re-run extraction for stored PDF |

Config notes: `runtime = "nodejs"`, `maxDuration = 300`, `proxyClientMaxBodySize: "50mb"` in Next config for large bodies.

### Server Actions

Primary mutation style under `src/lib/<module>/actions.ts` (`"use server"`), e.g. companies, counterparties, products, contracts, logistics, warehouse, finance, documents, CRM, business cases.

### When to use which

| Use Route Handler | Use Server Action |
| --- | --- |
| Large multipart uploads | Normal form mutations |
| Streaming progress (NDJSON) | `revalidatePath` after writes |
| Long AI I/O | Typical CRUD |

## Confirmed rules

- Validate inputs server-side.  
- Do not expose secrets in responses.  
- Prefer publishable Supabase client + RLS.  
- PDF field name for import: `file`.

## Constraints

- Server Action body size limited (config ~2mb for actions) — do not put 50MB PDFs in actions.  
- No ad-hoc external HTTP to user-controlled URLs (SSRF).

## Known risks / gaps

- Permission checks uneven across actions.  
- Import fails if `contract_imports` missing remotely.

## Development rules

- Document new public routes here.  
- Keep error messages actionable without leaking internals/secrets.

## Planned

- Auth-gated APIs · consistent error envelope.
