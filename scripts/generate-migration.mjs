import {
  generateSQLiteDrizzleJson,
  generateSQLiteMigration,
} from 'drizzle-kit/api';
import * as schema from '../db/schema.ts';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
await mkdir('drizzle/meta', { recursive: true });
const files = (await readdir('drizzle/meta'))
  .filter((f) => f.endsWith('_snapshot.json'))
  .sort();
const prev = files.length
  ? JSON.parse(await readFile('drizzle/meta/' + files.at(-1), 'utf8'))
  : await generateSQLiteDrizzleJson({});
if (!files.length) prev.id = '00000000-0000-0000-0000-000000000000';
const next = await generateSQLiteDrizzleJson(schema, prev.id);
const sql = await generateSQLiteMigration(prev, next);
if (!sql.length) {
  console.log('No schema changes');
  process.exit(0);
}
const num = String(files.length).padStart(4, '0'),
  tag = num + '_bid_workspace';
const journal = files.length
  ? JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'))
  : { version: '7', dialect: 'sqlite', entries: [] };
journal.entries.push({
  idx: files.length,
  version: next.version,
  when: Date.now(),
  tag,
  breakpoints: true,
});
await writeFile(
  'drizzle/' + tag + '.sql',
  sql.join('\n--> statement-breakpoint\n') + '\n',
);
await writeFile(
  'drizzle/meta/' + num + '_snapshot.json',
  JSON.stringify(next, null, 2),
);
await writeFile('drizzle/meta/_journal.json', JSON.stringify(journal, null, 2));
console.log('Generated ' + sql.length + ' statements in ' + tag);
