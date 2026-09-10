import { database } from '@/db';
import type { Bid, BidData } from '@/lib/types';
import { HttpError } from './validation';
type Row = {
  id: string;
  title: string;
  reference: string;
  buyer: string;
  deadline: string;
  version: number;
  created_at: string;
  updated_at: string;
  payload: string;
};
function decode(row: Row): Bid {
  return {
    id: row.id,
    title: row.title,
    reference: row.reference,
    buyer: row.buyer,
    deadline: row.deadline,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    data: JSON.parse(row.payload),
  };
}
export async function listBids(owner: string) {
  const { results } = await database()
    .prepare(
      'SELECT * FROM bids WHERE owner=? ORDER BY updated_at DESC LIMIT 100',
    )
    .bind(owner)
    .all<Row>();
  return results.map(decode);
}
export async function getBid(id: string, owner: string) {
  const row = await database()
    .prepare('SELECT * FROM bids WHERE id=? AND owner=?')
    .bind(id, owner)
    .first<Row>();
  if (!row) throw new HttpError(404, 'Bid not found');
  return decode(row);
}
export function audit(bid: Bid, actor: string, action: string, detail: string) {
  bid.data.audit.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor,
    action,
    detail,
  });
}
export async function createBid(
  owner: string,
  actor: string,
  fields: Pick<Bid, 'title' | 'reference' | 'buyer' | 'deadline'>,
  data?: BidData,
) {
  const now = new Date().toISOString();
  const bid: Bid = {
    id: crypto.randomUUID(),
    ...fields,
    version: 1,
    createdAt: now,
    updatedAt: now,
    data: data || {
      requirements: [],
      bidders: [],
      documents: [],
      runs: [],
      audit: [],
      contentVersion: 1,
    },
  };
  audit(bid, actor, 'Bid created', fields.reference);
  await database()
    .prepare(
      'INSERT INTO bids (id,owner,title,reference,buyer,deadline,version,created_at,updated_at,payload) VALUES (?,?,?,?,?,?,?,?,?,?)',
    )
    .bind(
      bid.id,
      owner,
      bid.title,
      bid.reference,
      bid.buyer,
      bid.deadline,
      1,
      now,
      now,
      JSON.stringify(bid.data),
    )
    .run();
  return bid;
}
export async function saveBid(bid: Bid, owner: string) {
  const payload = JSON.stringify(bid.data);
  if (new TextEncoder().encode(payload).length > 1_800_000)
    throw new HttpError(
      422,
      'This bid has reached its storage limit; start a separate review.',
    );
  const now = new Date().toISOString();
  const result = await database()
    .prepare(
      'UPDATE bids SET title=?,reference=?,buyer=?,deadline=?,payload=?,version=version+1,updated_at=? WHERE id=? AND owner=? AND version=?',
    )
    .bind(
      bid.title,
      bid.reference,
      bid.buyer,
      bid.deadline,
      payload,
      now,
      bid.id,
      owner,
      bid.version,
    )
    .run();
  if (result.meta.changes !== 1)
    throw new HttpError(
      409,
      'The bid changed during this action. Reload and try again.',
    );
  return { ...bid, version: bid.version + 1, updatedAt: now };
}
export function publicBid(bid: Bid) {
  return {
    ...bid,
    data: {
      ...bid.data,
      documents: bid.data.documents.map(({ key, ...d }) => ({ ...d, key: '' })),
    },
  };
}
