# Architecture

The frontend is in `app/page.tsx` and `app/globals.css`. The backend is in `backend/`, with the HTTP entry point at `app/api/[...path]/route.ts`. Both build together into a Cloudflare-compatible Worker using Vinext, React and TypeScript.

Browser -> authenticated API -> owner-scoped D1 records + R2 originals.
AI verification -> server-side OpenAI Responses API -> schema validation -> exact-quote validation -> saved run -> human review.

## Data and concurrency

D1 stores bid metadata and a bounded JSON aggregate containing requirements, bidders, document metadata and extracted text, runs, and audit events. Originals are in R2. Each mutation uses optimistic concurrency (UPDATE ... WHERE version = previous_version). A conflicting action returns HTTP 409 instead of silently overwriting changes. Uploaded orphan objects are removed if the database save fails.

Each input change increments a content version. Old runs are retained but cannot receive new decisions after input changes. A new run leaves previous reviews intact in history. Audit events and their associated mutation are saved atomically in the same record. Audit history is an application history, not a cryptographically tamper-proof legal record.

## Authentication

Development on localhost identifies a local reviewer. Production rejects access unless AUTH_MODE=sites and the trusted gateway supplies oai-authenticated-user-id. Every bid/document/read/write/report request checks owner membership. Never expose a direct Worker endpoint that lets callers forge these headers. For deployment outside Sites, replace backend/auth.ts with a verified session/JWT implementation first. No application passwords are stored.

## Limits

PDF or UTF-8 TXT only; 10 MB/file; 150 PDF pages; 150,000 extracted characters/file; 600,000 characters/bid; 30 documents; 10 bidders; 100 requirements; 50 runs. JSON aggregate size is additionally capped. AI input is limited to 180,000 characters per bidder per request. OCR, DOCX, issuer checks, automatic GeM import and bid submission are not implemented.

## Review boundaries

Draft clause extraction uses explicit English obligation keywords, not an exhaustive legal parser. Confirm extracted requirements and corrigendum precedence manually. Assisted matching is a transparent keyword retrieval fallback and never returns supported/compliant. AI suggestions are schema-validated and citations must exactly match an uploaded document assigned to the selected bidder. A matched quote does not prove authenticity or correct reasoning. Human review is required.
