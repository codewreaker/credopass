/**
 * The contract test harness (§12.1).
 *
 * Every response the integration suites produce is validated against the
 * schema the API itself emits. A response the OpenAPI document does not
 * describe FAILS THE TEST — which is what keeps rule 4 ("no hand-written
 * OpenAPI, ever") honest in the other direction too: the document cannot drift
 * from the code, because the code is checked against the document.
 *
 * Uses ajv against the emitted OAS 3.1 schemas directly rather than a
 * spec-validator package, because 3.1 schemas ARE JSON Schema 2020-12 — so
 * there is nothing to translate, and one less dependency to trust.
 */

import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { v1, V1_BASE_PATH } from '../api/v1';

let documentPromise: Promise<any> | null = null;

/** The OpenAPI document, as the running service emits it. */
export async function openApiDocument(): Promise<any> {
  if (!documentPromise) {
    documentPromise = Promise.resolve(v1.request('/openapi.json')).then((res: Response) => {
      if (!res.ok) throw new Error(`openapi.json returned ${res.status}`);
      return res.json();
    });
  }
  return documentPromise;
}

let ajvInstance: Ajv2020 | null = null;

const ajvFor = () => {
  if (!ajvInstance) {
    ajvInstance = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajvInstance);
  }
  return ajvInstance;
};

/**
 * Response schemas reference shared components as `#/components/schemas/X`,
 * and in JSON Schema `#` means the root of the schema being compiled — not the
 * OpenAPI document. So the document's `components` block is carried alongside
 * the response schema, which makes those pointers resolve as written. Nested
 * and recursive refs work for free; hand-dereferencing would not survive them.
 */
const compiledCache = new Map<string, ReturnType<Ajv2020['compile']>>();

const compileResponseSchema = (doc: any, cacheKey: string, schema: any) => {
  const cached = compiledCache.get(cacheKey);
  if (cached) return cached;
  const validate = ajvFor().compile({ ...schema, components: doc.components ?? {} });
  compiledCache.set(cacheKey, validate);
  return validate;
};

/** Turn a request path into its OpenAPI template, e.g. /events/abc → /events/{id}. */
function matchPath(doc: any, method: string, path: string): [string, any] | null {
  const rel = path.startsWith(V1_BASE_PATH) ? path.slice(V1_BASE_PATH.length) : path;
  const bare = rel.split('?')[0];

  const exact = doc.paths?.[bare];
  if (exact?.[method]) return [bare, exact[method]];

  for (const [template, item] of Object.entries<any>(doc.paths ?? {})) {
    if (!item[method]) continue;
    const rx = new RegExp(
      '^' + template.replace(/\{[^}]+\}/g, '[^/]+').replace(/\//g, '\\/') + '$'
    );
    if (rx.test(bare)) return [template, item[method]];
  }
  return null;
}

export interface ContractViolation {
  message: string;
}

/**
 * Assert a response matches what the document says that endpoint returns.
 *
 * Throws when: the endpoint is undocumented, the status is undocumented, or the
 * body does not validate. Each of those is a genuine contract break — an
 * integration test that passes while producing an undocumented shape is exactly
 * the failure this harness exists to catch.
 */
export async function expectMatchesContract(
  res: Response,
  method: string,
  path: string
): Promise<void> {
  const doc = await openApiDocument();
  const found = matchPath(doc, method.toLowerCase(), path);

  if (!found) {
    throw new Error(
      `Contract: ${method.toUpperCase()} ${path} is not described in openapi.json. ` +
        `Every endpoint must be registered through defineRoute().`
    );
  }

  const [template, operation] = found;
  const spec = operation.responses?.[String(res.status)] ?? operation.responses?.default;

  if (!spec) {
    throw new Error(
      `Contract: ${method.toUpperCase()} ${template} returned ${res.status}, which the ` +
        `document does not describe. Documented: ${Object.keys(operation.responses ?? {}).join(', ')}`
    );
  }

  const contentType = res.headers.get('content-type')?.split(';')[0] ?? '';
  const schema = spec.content?.[contentType]?.schema;
  if (!schema) return; // Documented status with no body schema (204, text/calendar, …)

  const body = await res.clone().json();
  const validate = compileResponseSchema(
    doc,
    `${method.toLowerCase()} ${template} ${res.status} ${contentType}`,
    schema
  );

  if (!validate(body)) {
    const errors = (validate.errors ?? [])
      .map((e) => `    ${e.instancePath || '(root)'} ${e.message}`)
      .join('\n');
    throw new Error(
      `Contract: ${method.toUpperCase()} ${template} → ${res.status} body does not match its schema:\n${errors}\n` +
        `  got: ${JSON.stringify(body)}`
    );
  }
}

/**
 * Wrap a fetch-like call so every response it produces is contract-checked.
 * Integration suites use this instead of calling `app.request` directly.
 */
export function contractChecked(
  request: (path: string, init?: RequestInit) => Promise<Response>
) {
  return async (path: string, init?: RequestInit): Promise<Response> => {
    const res = await request(path, init);
    await expectMatchesContract(res, init?.method ?? 'GET', path);
    return res;
  };
}
