import type { Document, Finding, Requirement } from '../lib/types.ts';
export function classify(clause: string): Requirement['category'] {
  if (
    /turnover|financial|balance sheet|revenue|emd|earnest|security deposit/i.test(
      clause,
    )
  )
    return 'Financial';
  if (
    /technical|specification|warranty|capacity|iso|bis|delivery/i.test(clause)
  )
    return 'Technical';
  if (/declar|undertak|blacklist|local content/i.test(clause))
    return 'Declarations';
  if (/experience|registration|gst|pan|eligib/i.test(clause))
    return 'Eligibility';
  return 'Other';
}
export function draftRequirements(text: string, source: string): Requirement[] {
  const lines = text
    .split(/\n|(?<=[.;])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length >= 12 &&
        /\b(must|shall|required|minimum|mandatory)\b/i.test(s),
    );
  return [...new Set(lines)]
    .slice(0, 60)
    .map((clause) => ({
      id: crypto.randomUUID(),
      clause: clause.slice(0, 3000),
      source,
      category: classify(clause),
      mandatory: true,
    }));
}
export function assistedFindings(
  requirements: Requirement[],
  documents: Document[],
): Finding[] {
  return requirements.map((req) => {
    const terms = [
      ...new Set(req.clause.toLowerCase().match(/[a-z]{4,}/g) || []),
    ].filter(
      (t) =>
        ![
          'shall',
          'must',
          'with',
          'from',
          'that',
          'have',
          'should',
          'minimum',
          'required',
          'bidder',
          'provide',
          'submit',
        ].includes(t),
    );
    let best: { doc: Document; line: string; score: number } | null = null;
    for (const doc of documents) {
      for (const line of doc.text.split(/\n|(?<=\.)\s+/)) {
        const score = terms.filter((t) =>
          line.toLowerCase().includes(t),
        ).length;
        if (
          score >= (Math.min(2, terms.length) || 1) &&
          (!best || score > best.score)
        )
          best = { doc, line, score };
      }
    }
    return {
      requirementId: req.id,
      status: best ? 'needs_review' : 'gap',
      reason: best
        ? 'Related text found. A reviewer must verify validity, thresholds, dates, exemptions and applicability.'
        : 'No matching evidence found in the extracted text. This is an evidence gap, not proof of non-compliance.',
      documentId: best?.doc.id || null,
      quote: best?.line.slice(0, 1000) || '',
    };
  });
}
export function validateGrounding(
  findings: Finding[],
  requirements: Requirement[],
  documents: Document[],
): Finding[] {
  if (
    findings.length !== requirements.length ||
    new Set(findings.map((f) => f.requirementId)).size !==
      requirements.length ||
    findings.some((f) => !requirements.some((r) => r.id === f.requirementId))
  )
    throw new Error('AI returned an incomplete requirement mapping');
  return requirements.map((req) => {
    const f = findings.find((f) => f.requirementId === req.id)!;
    const doc = documents.find((d) => d.id === f.documentId);
    if (f.documentId && doc && f.quote.trim() && doc.text.includes(f.quote))
      return f;
    if (f.status === 'gap' && !f.documentId && !f.quote) return f;
    return {
      ...f,
      status: 'needs_review',
      documentId: null,
      quote: '',
      reason:
        'The suggested evidence could not be verified against the source. Review this clause manually.',
    };
  });
}
