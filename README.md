# BidScope — GeM Bid Compliance Platform

A full-stack, evidence-led workspace for reviewing GeM procurement bids. Includes a React frontend, TypeScript API backend, persistent database, document storage, and optional AI verification.

**Status:** working pilot. It is an independent review tool, not an official GeM integration or an automated eligibility authority. AI requires a server-side API key.

## Features

- Create bids and keep bidders' evidence separate.
- Upload text-based PDF and UTF-8 TXT documents, with SHA-256 fingerprints and duplicate detection.
- Extract draft obligation clauses, confirm/edit their wording and source references.
- Run transparent assisted text matching without credentials, or structured OpenAI verification with a configured key.
- Inspect exact source quotes and record human decisions with notes.
- Preserve run history and invalidate results when inputs change.
- Download original documents and CSV compliance reports.
- Owner-scoped access, input validation, cross-origin protection and optimistic concurrency.

## Run locally

Use Node.js 24 LTS and npm.

```bash
npm ci
npm run db:migrate
npm run dev
```

Open the Local URL printed by the server (normally http://localhost:3000).
The local database and object storage persist in .wrangler/state. Development is for trusted localhost use only.

To enable AI, copy .env.example to .env and supply your own OPENAI_API_KEY. Restart the dev server. OPENAI_MODEL defaults to gpt-5.4-mini. Keys are never sent to the browser. AI verification sends the selected bidder's extracted document text and confirmed requirements to OpenAI only when that mode is run. Assisted matching does not make an AI request.

## Validate

```bash
npm test
npm run typecheck
npm run build
# With npm run dev running:
node tests/integration.mjs
```

The integration test creates a clearly labeled fictional test bid in the local database. Use an isolated local workspace when running tests. Actual AI inference needs your API key and is not covered by offline tests.

## Source map

- app/page.tsx — frontend dashboard, forms, documents and compliance matrix
- app/globals.css — responsive design
- app/api/[...path]/route.ts — backend REST entry point
- backend/ — authentication, storage repository, parsing, validation, matching and AI
- db/schema.ts and drizzle/ — schema and generated migrations
- lib/types.ts — shared contracts
- tests/ — unit and API integration tests
- samples/ — fictional example tender and evidence
- docs/ — architecture, API, verification and limitations

## Database migrations

`npm run db:generate` generates append-only Drizzle SQL and snapshots using its direct API. The direct API avoids a Windows user-info limitation in the standard CLI loader. Review migrations before applying. `npm run db:migrate` applies them locally only.

## Deployment

The project builds a Cloudflare-compatible Worker and static assets. Sites metadata is in .openai/hosting.json; Sites provisions D1/R2 and applies migrations during publication. AUTH_MODE=sites is valid only behind the authenticated Sites gateway. A copied project must obtain its own Site identity. For another host, implement verified authentication before exposing the API; see docs/ARCHITECTURE.md. GitHub stores the source code and does not by itself host this backend.

## Procurement context

Each bid's terms and latest amendments must be checked individually. Reference: [GeM bid portal](https://bidplus-global.gem.gov.in/) and [an official example of buyer-added bid terms](https://www.bis.gov.in/wp-content/uploads/2025/12/GeM-BID-Documents-for-Security-services31122025-1.pdf). No generic financial threshold, exemption or policy is treated as universally applicable. Sample figures are fictional.

The AI adapter follows [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). See docs/VERIFICATION.md for the tested scope and remaining limitations.
