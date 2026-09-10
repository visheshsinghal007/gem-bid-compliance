import { env } from 'cloudflare:workers';
export function database() {
  if (!env.DB) throw new Error('Database binding is unavailable');
  return env.DB;
}
export function bucket() {
  if (!env.DOCUMENTS)
    throw new Error('Document storage binding is unavailable');
  return env.DOCUMENTS;
}
