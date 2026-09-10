# Verification and scope

Validated locally on Node.js 24 on Windows:

- TypeScript strict checking.
- Production Worker and client build.
- Twelve unit tests for matching, citation grounding, malformed AI mappings, clause extraction, CSV injection, field validation invalid uploads and real PDF extraction.
- API integration: create bid, add bidder/requirement, TXT upload, duplicate rejection, invalid PDF rejection, assisted run, decision recording, CSV export, original download, cross-origin rejection, stale-run rejection, draft extraction/import and persistence.
- Additional PDF and source-history checks are in the tests.

## Not verified or not implemented

- Live OpenAI inference: no API key was supplied. The real server-side adapter is implemented; assisted matching works without credentials.
- OCR and DOCX import, automatic GeM synchronization, issuer/authenticity checks, digital signatures, and bid submission.
- Multi-organization administration, reviewer role delegation, enterprise SSO outside Sites, malware scanning, retention controls, independent audit storage, and large-scale load testing.
- Browser interaction/visual tests were not performed. The development route returned HTTP 200 and the production build succeeded.

## Dependency review

The provided Sites starter contains npm-reported security advisories, including runtime/framework and development dependencies. The registry reported no automatic compatible fixes for the audited dependency graph at build time. The original audit report is saved in docs/dependency-audit.json. Do not treat this pilot as hardened for sensitive production procurement. Update the affected framework/runtime chain and repeat validation before such use. The hosted preview uses private owner-only access.

## Scope and data

The sample tender, bidder and amounts are fictional. No real bid files or credentials are included. GeM terms and corrigenda remain the authoritative source for the actual bid. Decisions recorded here are reviewer assertions, not independent certification.
