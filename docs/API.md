# API

All endpoints are under /api and require an authenticated workspace owner (except local development). JSON endpoints require Content-Type: application/json. Errors use {"error":"..."} and a meaningful HTTP status.

| Method | Endpoint                        | Purpose                                                       |
| ------ | ------------------------------- | ------------------------------------------------------------- |
| GET    | /status                         | AI configuration and reviewer identity                        |
| GET    | /bids                           | List owned bids                                               |
| POST   | /bids                           | Create: title, reference, buyer, deadline (YYYY-MM-DD)        |
| GET    | /bids/:id                       | Load a bid                                                    |
| POST   | /demo                           | Load an idempotent, clearly fictional sample                  |
| POST   | /bids/:id/bidders               | Add bidder: name                                              |
| POST   | /bids/:id/requirements          | Add clause, category, source, mandatory                       |
| POST   | /bids/:id/edit-requirement      | Same fields plus requirement id                               |
| POST   | /bids/:id/import-requirements   | Confirm a requirements array                                  |
| POST   | /bids/:id/documents             | Multipart file, kind (tender/evidence), bidderId for evidence |
| GET    | /bids/:id/documents/:documentId | Download original                                             |
| POST   | /bids/:id/extract               | Draft obligation clauses: documentId                          |
| POST   | /bids/:id/run                   | Verify: bidderId, mode (assisted/ai)                          |
| POST   | /bids/:id/review                | Record runId, requirementId, status, note                     |
| GET    | /bids/:id/report                | CSV of all runs and reviewer decisions                        |

Categories: Eligibility, Financial, Technical, Declarations, Other.
Reviewer statuses: compliant, non_compliant, clarification.
AI suggestions: supported, gap, needs_review. These are separate from reviewer decisions.
Reports flag stale runs and escape spreadsheet formulas. Downloads use attachment disposition.
