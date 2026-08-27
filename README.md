This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Documentation

Canonical project documentation lives in **[knowledge/](./knowledge/README.md)**.

Start with:

1. [AGENTS.md](./AGENTS.md) (highest priority for agents)
2. [knowledge/README.md](./knowledge/README.md)
3. [knowledge/DOCUMENTATION_INDEX.md](./knowledge/DOCUMENTATION_INDEX.md)

Root stubs (`BUSINESS_CONTEXT.md`, `DATABASE.md`, `DEVELOPMENT_RULES.md`, `00_PROJECT_VISION.md`) and `docs/*` redirect to `knowledge/`. Historical copies are under `knowledge/Archive/`.

## Contract PDF Import (AI)

Uses the OpenAI **Responses API** (`POST /v1/responses`) with PDF `input_file` uploads via the Files API (`purpose: user_data`).

Server-only environment variables (do not expose to the browser):

| Variable | Required | Description |
|----------|----------|-------------|
| `CONTRACT_AI_API_KEY` | Recommended | Preferred API key |
| `OPENAI_API_KEY` | Fallback | Used if `CONTRACT_AI_API_KEY` is unset |
| `CONTRACT_AI_MODEL` | Optional | Default `gpt-5` |
| `CONTRACT_AI_BASE_URL` | Optional | Not required for official SDK client |
| `CONTRACT_AI_TIMEOUT_MS` | Optional | Reserved / documented |
| `CONTRACT_IMPORT_RETENTION_DAYS` | Optional | Retention hint for import records |

Apply migration:

`supabase/migrations/20260804230000_contract_pdf_import.sql`

If the AI key is missing, the Contracts page still loads and Import from PDF shows a configuration message.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
