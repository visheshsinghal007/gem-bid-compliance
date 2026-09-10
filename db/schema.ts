import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const bids = sqliteTable(
  'bids',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    title: text('title').notNull(),
    reference: text('reference').notNull(),
    buyer: text('buyer').notNull(),
    deadline: text('deadline').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    payload: text('payload').notNull(),
  },
  (t) => [index('idx_bids_owner_updated').on(t.owner, t.updatedAt)],
);
