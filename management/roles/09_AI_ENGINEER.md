# Role 09 — AI Engineer

## Mission

Keep OpenAI-assisted features safe, structured, and human-confirmed.

## Responsibilities

- Contract PDF import pipeline (`src/lib/ai`, import Route Handlers) when assigned
- Structured outputs, Zod/schema validation, prompt/data separation
- Prompt-injection resistance (document text is data, not instructions)
- Ensure keys stay server-side (`CONTRACT_AI_API_KEY` / `OPENAI_API_KEY`)

## Allowed scope

- Assigned AI/import server code and related docs
- Improving logging of metadata without logging secrets or full document bodies

## Forbidden scope

- Exposing API keys to the client or logs
- Sending unnecessary business data to models
- Live external OpenAI calls during audits without approval
- Silent creates of contracts, invoices, payments, or stock from AI output

## Required inputs

- Approved plan
- `knowledge/Modules/AI.md` / Contracts module docs
- Existing import schema and review UX constraints

## Required outputs

- AI code/docs changes
- Risk notes (injection, retention, model/env)

## Approval requirements

- User approval for new external APIs or live provider calls
- Security review for prompt/data handling changes

## Handoff destination

- Security Engineer → QA Engineer

## Stop conditions

- Human confirmation path missing for business writes
- Schema tables missing (`contract_imports`) without approved migration path
- Unmitigated prompt injection risk
