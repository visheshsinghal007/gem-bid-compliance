import type { BidData, Document, Requirement } from '@/lib/types';
import { assistedFindings, classify } from './compliance';
export const sampleTender =
  'DEMONSTRATION ONLY — Fictional tender, not a GeM rule set.\n1. Bidder must provide a valid GST registration certificate.\n2. Bidder must submit audited financial statements showing average annual turnover of INR 50 lakh for the last three financial years.\n3. Bidder shall provide an OEM authorization letter specific to this bid.\n4. Minimum warranty required is 36 months from installation.\n5. Bidder must submit a signed non-blacklisting declaration.\n6. Bidder shall deliver all equipment within 45 days of the purchase order.';
export const sampleEvidence =
  'DEMONSTRATION ONLY — Fictional bidder evidence.\nGST registration certificate: supplied as a sample only; authenticity has not been validated.\nAudited financial statements: turnover FY 2023-24 INR 42 lakh; FY 2024-25 INR 48 lakh; FY 2025-26 INR 54 lakh.\nWarranty offered is 24 months from installation.\nDelivery commitment: all equipment within 45 days of the purchase order.';
export function demoData(): BidData {
  const bidderId = crypto.randomUUID();
  const now = new Date().toISOString();
  const requirements: Requirement[] = sampleTender
    .split('\n')
    .slice(1)
    .map((clause) => ({
      id: crypto.randomUUID(),
      clause,
      source: 'Sample tender · Clauses 1–6',
      category: classify(clause),
      mandatory: true,
    }));
  const doc: Document = {
    id: crypto.randomUUID(),
    name: 'sample-bidder-evidence.txt',
    kind: 'evidence',
    bidderId,
    key: '',
    size: sampleEvidence.length,
    sha256: 'sample',
    uploadedAt: now,
    text: sampleEvidence,
    pages: 1,
  };
  return {
    demo: true,
    contentVersion: 1,
    requirements,
    bidders: [{ id: bidderId, name: 'Northstar Systems (sample)' }],
    documents: [doc],
    runs: [
      {
        id: crypto.randomUUID(),
        bidderId,
        at: now,
        mode: 'assisted',
        model: null,
        contentVersion: 1,
        requirements: structuredClone(requirements),
        findings: assistedFindings(requirements, [doc]),
        reviews: {},
      },
    ],
    audit: [],
  };
}
