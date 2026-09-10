import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://localhost:3000';
async function call(path, body, status = 200) {
  const r = await fetch(
    base + '/api/' + path,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers:
            body instanceof FormData
              ? {}
              : { 'content-type': 'application/json' },
          body: body instanceof FormData ? body : JSON.stringify(body),
        },
  );
  const data = await r.json();
  assert.equal(r.status, status, JSON.stringify(data));
  return data;
}
assert.equal(typeof (await call('status')).ai, 'boolean');
await call('bids', { title: 'x' }, 400);
let bid = await call(
  'bids',
  {
    title: 'Integration verification bid',
    reference: 'TEST/' + Date.now(),
    buyer: 'Fictional test buyer',
    deadline: '2026-12-31',
  },
  201,
);
bid = await call('bids/' + bid.id + '/bidders', { name: 'Integration Bidder' });
const bidder = bid.data.bidders[0].id;
bid = await call('bids/' + bid.id + '/requirements', {
  clause: 'Bidder must provide an OEM authorization letter.',
  category: 'Eligibility',
  source: 'Test tender section 1',
  mandatory: true,
});
await call(
  'bids/' + bid.id + '/run',
  { bidderId: bidder, mode: 'assisted' },
  422,
);
function upload(text, name = 'evidence.txt', kind = 'evidence') {
  const f = new FormData();
  f.set('file', new Blob([text]), name);
  f.set('kind', kind);
  f.set('bidderId', bidder);
  return f;
}
bid = await call(
  'bids/' + bid.id + '/documents',
  upload('The OEM authorization letter is enclosed for this bid.'),
  201,
);
const doc = bid.data.documents[0];
assert.ok(doc.text.includes('OEM'));
assert.equal(doc.sha256.length, 64);
await call(
  'bids/' + bid.id + '/documents',
  upload('The OEM authorization letter is enclosed for this bid.'),
  409,
);
await call(
  'bids/' + bid.id + '/documents',
  upload('not a PDF', 'wrong.pdf'),
  415,
);
bid = await call('bids/' + bid.id + '/run', {
  bidderId: bidder,
  mode: 'assisted',
});
const run = bid.data.runs.at(-1);
assert.equal(run.findings[0].status, 'needs_review');
bid = await call('bids/' + bid.id + '/review', {
  runId: run.id,
  requirementId: bid.data.requirements[0].id,
  status: 'clarification',
  note: 'Please provide the signed authorization letter.',
});
assert.equal(
  bid.data.runs.at(-1).reviews[bid.data.requirements[0].id].status,
  'clarification',
);
const report = await fetch(base + '/api/bids/' + bid.id + '/report');
assert.equal(report.status, 200);
assert.ok((await report.text()).includes('Please provide'));
const original = await fetch(
  base + '/api/bids/' + bid.id + '/documents/' + doc.id,
);
assert.equal(original.status, 200);
assert.ok((await original.text()).includes('OEM'));
const crossSite = await fetch(base + '/api/bids/' + bid.id + '/bidders', {
  method: 'POST',
  headers: {
    origin: 'https://evil.example',
    'content-type': 'application/json',
  },
  body: JSON.stringify({ name: 'Cross site' }),
});
assert.equal(crossSite.status, 403);
bid = await call('bids/' + bid.id + '/edit-requirement', {
  ...bid.data.requirements[0],
  clause: 'Bidder must provide a signed OEM authorization letter.',
});
await call(
  'bids/' + bid.id + '/review',
  {
    runId: run.id,
    requirementId: bid.data.requirements[0].id,
    status: 'compliant',
    note: 'Should fail because this run is stale.',
  },
  409,
);
bid = await call(
  'bids/' + bid.id + '/documents',
  upload(
    'Bidder must submit a valid GST registration certificate.',
    'tender.txt',
    'tender',
  ),
  201,
);
const extraction = await call('bids/' + bid.id + '/extract', {
  documentId: bid.data.documents.at(-1).id,
});
assert.equal(extraction.drafts.length, 1);
bid = await call('bids/' + bid.id + '/import-requirements', {
  requirements: extraction.drafts.map(({ id, ...r }) => r),
});
assert.equal(bid.data.requirements.length, 2);
assert.ok((await call('bids/' + bid.id)).data.audit.length >= 7);
console.log(
  'PASS: validation, create, upload, duplicate detection, verification, review, CSV, original download, cross-origin protection, stale-result rejection, extraction, import and persistence.',
);
console.log('Test bid: ' + bid.id);
