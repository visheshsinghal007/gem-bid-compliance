import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assistedFindings,
  draftRequirements,
  validateGrounding,
} from '../backend/compliance.ts';
import { csvCell, newBidSchema } from '../backend/validation.ts';
import { extractDocument } from '../backend/documents.ts';
const req = {
  id: 'r1',
  clause: 'Bidder must provide an OEM authorization letter.',
  category: 'Eligibility',
  source: 'Clause 1',
  mandatory: true,
};
const doc = {
  id: 'd1',
  name: 'evidence.txt',
  kind: 'evidence',
  bidderId: 'b1',
  key: '',
  size: 50,
  sha256: 'test',
  uploadedAt: '',
  text: 'An OEM authorization letter is enclosed.',
  pages: 1,
};
test('text matching never declares a bidder compliant', () => {
  const [f] = assistedFindings([req], [doc]);
  assert.equal(f.status, 'needs_review');
  assert.equal(f.documentId, 'd1');
});
test('absence of evidence is a gap, not non-compliance', () => {
  assert.equal(assistedFindings([req], [])[0].status, 'gap');
});
test('fabricated AI quote is downgraded', () => {
  const [f] = validateGrounding(
    [
      {
        requirementId: 'r1',
        status: 'supported',
        reason: 'Valid',
        documentId: 'd1',
        quote: 'Invented quote',
      },
    ],
    [req],
    [doc],
  );
  assert.equal(f.status, 'needs_review');
  assert.equal(f.documentId, null);
});
test('cross-bidder document IDs cannot validate citations', () => {
  const [f] = validateGrounding(
    [
      {
        requirementId: 'r1',
        status: 'supported',
        reason: 'Valid',
        documentId: 'another',
        quote: doc.text,
      },
    ],
    [req],
    [doc],
  );
  assert.equal(f.status, 'needs_review');
});
test('complete exact citation is preserved', () => {
  const [f] = validateGrounding(
    [
      {
        requirementId: 'r1',
        status: 'supported',
        reason: 'Source supports clause',
        documentId: 'd1',
        quote: doc.text,
      },
    ],
    [req],
    [doc],
  );
  assert.equal(f.status, 'supported');
});
test('missing and duplicated AI requirements are rejected', () => {
  assert.throws(() => validateGrounding([], [req], [doc]));
  assert.throws(() =>
    validateGrounding([{ requirementId: 'other' }], [req], [doc]),
  );
});
test('draft extraction excludes prose and deduplicates clauses', () => {
  assert.equal(
    draftRequirements(
      'Welcome to our tender.\nBidder must provide a certificate.\nBidder must provide a certificate.',
      'Tender',
    ).length,
    1,
  );
});
test('spreadsheet formula injection is escaped', () => {
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(csvCell('normal'), '\"normal\"');
});
test('bid field validation rejects incomplete input', () => {
  assert.equal(newBidSchema.safeParse({ title: 'x' }).success, false);
});
test('UTF-8 extraction succeeds and empty text fails', async () => {
  assert.equal(
    (
      await extractDocument(
        new TextEncoder().encode('Valid evidence document text.'),
        'a.txt',
      )
    ).pages,
    1,
  );
  await assert.rejects(() => extractDocument(new Uint8Array(), 'a.txt'));
});
test('binary and mislabeled PDF files are rejected', async () => {
  await assert.rejects(() =>
    extractDocument(new Uint8Array([0, 1, 2]), 'a.pdf'),
  );
  await assert.rejects(() =>
    extractDocument(
      new TextEncoder().encode('hello\u0000 this is binary content'),
      'a.txt',
    ),
  );
  await assert.rejects(() =>
    extractDocument(
      new TextEncoder().encode('this file is not allowed'),
      'a.exe',
    ),
  );
});

test('a real text PDF extracts with page attribution', async () => {
 const stream='BT /F1 12 Tf 50 700 Td (Bidder must provide valid OEM authorization.) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'];
 let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const xref=pdf.length;pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
 const result=await extractDocument(new TextEncoder().encode(pdf),'actual.pdf');assert.equal(result.pages,1);assert.ok(result.text.includes('[Page 1]'));assert.ok(result.text.includes('OEM authorization'));
});
