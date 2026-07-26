/**
 * Write the OpenAPI document to disk.
 *
 * The spec is generated from code, so this is a snapshot rather than a source
 * of truth — never hand-edit the output. Two uses:
 *
 *   1. Import into the Scalar desktop client (or any other API client) so you
 *      can browse and send requests without the server running.
 *   2. Diff it in review: a PR that changes the API shows exactly how.
 *
 *   nx run coreservice:openapi:export
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { v1, V1_BASE_PATH } from '../src/api/v1/core';

const OUT = resolve(import.meta.dir, '../openapi.json');

const res = await v1.request('/openapi.json');
if (!res.ok) {
  console.error(`Failed to generate the document: HTTP ${res.status}`);
  process.exit(1);
}

const doc = await res.json();
await writeFile(OUT, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');

const paths = Object.keys(doc.paths ?? {}).length;
const operations = Object.values(doc.paths ?? {}).reduce(
  (n, item: any) => n + Object.keys(item).length,
  0
);

console.log(`
✅ Wrote ${OUT}
   ${paths} path(s), ${operations} operation(s)

Use it:
  · Browser        http://localhost:8080${V1_BASE_PATH}/docs
  · Scalar desktop https://scalar.com/download  →  Import  →  ${OUT}
  · Any client     import the same file, or point at
                   http://localhost:8080${V1_BASE_PATH}/openapi.json
`);
