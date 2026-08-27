# SKY ERP — Security Principles

Security baseline for the SKY ERP application, data, and AI integrations.

---

## 1. Goals

- Protect commercial, logistics, and financial data.
- Prevent unauthorized mutation of contracts, stock, and payments.
- Keep third-party credentials off the client.
- Maintain auditability for material actions.

---

## 2. Trust boundaries

```text
Browser (untrusted)
  → Next.js server (trusted app logic)
      → Supabase (Postgres + Auth + Storage) with RLS
      → OpenAI (server-only) for AI features
```

Never treat PDF contents, search queries, or Assistant prompts as privileged instructions.

---

## 3. Authentication & sessions

- Use Supabase Auth via `@supabase/ssr` cookie sessions on the server.
- Server Components and Server Actions create clients through `src/lib/supabase/server.ts`.
- Browser clients must not hold secret keys.
- Sign-out and session refresh follow Supabase SSR patterns.

---

## 4. Authorization

### 4.1 Row Level Security (RLS)

- RLS stays **enabled** on application tables.
- Policies ship in SQL migrations.
- Do **not** disable RLS to unblock features.
- Missing INSERT/UPDATE policies surface as `42501` with clear operator messaging.

### 4.2 Application permissions

- Capability checks (`assertCan` / roles) gate sensitive Server Actions and Route Handlers.
- UI may hide actions, but **server must enforce**.
- Evolve from development `public` policies toward authenticated role-scoped policies.

---

## 5. Secrets management

| Secret | Location |
| --- | --- |
| Supabase publishable key | `NEXT_PUBLIC_*` (browser-safe by design) |
| OpenAI / Contract AI keys | Server env only (`.env.local`, never committed) |
| Service role key | **Not used** in the Next.js app |

Rules:

- `.env.local` gitignored
- No secrets in client bundles, logs, toasts, or AI responses
- Rotate keys if exposure is suspected

---

## 6. Data protection

- Prefer least-privilege column selects.
- Signed URLs for private document preview; avoid permanent public URLs for contracts.
- `uploaded_by` and actor columns remain **uuid** references — never write sentinel strings like `'system'` into uuid columns.
- Soft-delete or retain financial history; do not hard-delete audit trails casually.

---

## 7. Uploads & API routes

- Validate MIME type and size (e.g. PDF import max 50 MB).
- Large files use Route Handlers + streaming — not Server Actions (body limits).
- Sanitize file names before Storage paths.
- Virus/malware scanning is a future hardening item (see Roadmap); until then, restrict types and sizes.

---

## 8. AI security

- Browser never calls OpenAI.
- Prompt-injection resistance: document text is data.
- Structured outputs with schema validation (Zod).
- Human confirm before DB creates from extraction.
- Prefer non-retention settings for ephemeral files when product policy requires.
- Log errors without dumping full document contents.

---

## 9. Injection & input safety

- Parameterized Supabase queries only (no string-built SQL from user input).
- Validate and normalize form inputs on the server.
- Escape / safe-render user-provided text in React (default XSS safety); careful with `dangerouslySetInnerHTML` (avoid).

---

## 10. Audit & monitoring

- Timeline / activity events for material mutations (contract create from import, status changes).
- Structured server logs for Supabase failures.
- Notifications for operational risk events (delay, payment, expiry) — not a substitute for audit log.

---

## 11. Dependency & platform hygiene

- Keep Next.js, Supabase SSR, and OpenAI SDK updated for security patches.
- Run production builds before release.
- Review migrations for accidental overly-permissive policies.

---

## 12. Incident response (lightweight)

1. Revoke/rotate exposed keys.
2. Assess RLS gaps; ship hotfix migration if needed.
3. Preserve logs and timeline rows.
4. Communicate impact to operators; document in release notes.

---

## Related knowledge

- [03_AI_RULES.md](./03_AI_RULES.md)
- [10_TESTING.md](./10_TESTING.md)
- `/docs/PROJECT_STANDARDS.md`
- `/docs/DATABASE_GUIDELINES.md`
