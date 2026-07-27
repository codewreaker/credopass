/**
 * The `/api/v1` surface. docs/API-FIRST-REBUILD.md §5.
 *
 * Phase 0 mounts the skeleton only: ops endpoints, the generated OpenAPI
 * document and Scalar. Phases 1-6 add the real routes; every one of them goes
 * through `defineRoute`, so the document and the authorization registry stay in
 * step with the code by construction.
 *
 * `/api/core/*` is untouched and keeps serving the current web app. It starts
 * answering 308 in Phase 3, once nothing calls it.
 */

import { OpenAPIHono, z } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { defineRoute, problemResponse } from '../../../http/define-route';
import { ProblemError, problem, PROBLEM_CONTENT_TYPE } from '../../../http/problem';
import { isDevelopment } from 'std-env';
import { isDBConnected } from '../../../db/client';
import { checkSchema } from '../../../db/schema-check';
import { me } from './me';
import { organizations } from './organizations';
import { eventRoutes } from './events';
import { peopleRoutes } from './people';
import { attendanceRoutes } from './attendance';
import { publicRoutes } from './public';

export const V1_BASE_PATH = '/api/v1/core';

const VERSION = process.env.npm_package_version ?? '0.0.1';
const COMMIT = process.env.GIT_COMMIT ?? 'unknown';

/**
 * `defaultHook` turns every Zod validation failure into problem+json. Without
 * it, zod-openapi emits its own shape and the API would have two error formats
 * — the thing §5.0 exists to prevent.
 */
export const v1 = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (result.success) return;
    const err = problem.badRequest(
      'validation_failed',
      'The request did not match the expected schema.',
      result.error.issues.map((i) => ({
        path: i.path.join('.') || '(root)',
        message: i.message,
      }))
    );
    return c.json(err.toBody(c.req.path), 400, {
      'Content-Type': PROBLEM_CONTENT_TYPE,
    });
  },
});

// Every response carries the API version (§5.0).
v1.use('*', async (c, next) => {
  await next();
  c.header('X-API-Version', 'v1');
});

// ---------------------------------------------------------------------------
// Ops (§5.11)
// ---------------------------------------------------------------------------

const HealthSchema = z
  .object({
    status: z.literal('ok'),
    version: z.string(),
    commit: z.string(),
  })
  .openapi('Health');

v1.openapi(
  defineRoute({
    method: 'get',
    path: '/health',
    scope: 'public',
    summary: 'Liveness probe',
    tags: ['Ops'],
    responses: {
      200: {
        description: 'The service is running',
        content: { 'application/json': { schema: HealthSchema } },
      },
    },
  }),
  (c) => c.json({ status: 'ok' as const, version: VERSION, commit: COMMIT })
);

const ReadySchema = z
  .object({
    db: z.boolean(),
    storage: z.boolean(),
    /** False when migrations have not been applied to this database. */
    schema: z.boolean(),
    /** Named so an operator can see WHICH migration is missing, not just that one is. */
    missingTables: z.array(z.string()),
  })
  .openapi('Readiness');

v1.openapi(
  defineRoute({
    method: 'get',
    path: '/health/ready',
    scope: 'public',
    summary: 'Readiness probe — real dependency checks',
    tags: ['Ops'],
    responses: {
      200: {
        description: 'All dependencies reachable',
        content: { 'application/json': { schema: ReadySchema } },
      },
      503: problemResponse('A dependency is unreachable'),
    },
  }),
  async (c) => {
    const db = await isDBConnected().catch(() => false);
    // Storage lands in Phase 6 (§9.1); reporting `true` before it exists would
    // make this probe a lie, so it reports the absence honestly.
    const storage = false;

    // An unreachable database is a 503 through the same problem+json envelope
    // as everything else — a readiness probe that answers in a bespoke shape is
    // one more thing for an operator to learn.
    if (!db) {
      throw new ProblemError(503 as 500, 'internal_error', 'Database unreachable');
    }

    const schema = await checkSchema().catch(() => ({ ok: false, missing: ['(check failed)'] }));

    // A reachable database with the wrong schema is NOT ready. Reporting 200
    // here would let a deploy go live and then 500 on every real request.
    if (!schema.ok) {
      throw new ProblemError(
        503 as 500,
        'internal_error',
        `Migrations not applied. Missing: ${schema.missing.join(', ')}`
      );
    }

    return c.json({ db, storage, schema: schema.ok, missingTables: schema.missing }, 200);
  }
);

// ---------------------------------------------------------------------------
// Identity — the account scope (§5.1)
// ---------------------------------------------------------------------------
v1.route('/', me);
v1.route('/', organizations);
v1.route('/', eventRoutes);
v1.route('/', peopleRoutes);
v1.route('/', attendanceRoutes);
v1.route('/', publicRoutes);

// ---------------------------------------------------------------------------
// The contract itself
// ---------------------------------------------------------------------------

export const OPENAPI_DOC_PATH = `${V1_BASE_PATH}/openapi.json`;

/**
 * Declares HOW to authenticate. Which routes require it is decided per-route by
 * `defineRoute`'s scope, not here — this only gives the docs page a token box
 * and tells any generated client what header to send.
 */
v1.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description:
    'Supabase-issued JWT. Get one with: nx run coreservice:token',
});

v1.doc31('/openapi.json', (c) => ({
  openapi: '3.1.0',
  info: {
    title: 'CredoPass API',
    version: 'v1',
    description:
      'Attendance platform API. Every capability of CredoPass is reachable here; ' +
      'the web console is a rendering client over these endpoints.',
  },
  servers: [{ url: new URL(V1_BASE_PATH, c.req.url).toString().replace(/\/$/, '') }],
}));

/**
 * Scalar — reference docs AND the API client, on one page.
 *
 * Every endpoint has a "Test Request" panel that sends a real request to this
 * server, so you can exercise the API without Postman, curl or the web app.
 * `authentication` pre-fills the bearer token box, so a token pasted once is
 * reused for every request in the session.
 *
 * For the standalone desktop client, import the spec URL printed by
 * `nx run coreservice:openapi:export`.
 */
v1.get(
  '/docs',
  Scalar({
    url: OPENAPI_DOC_PATH,
    pageTitle: 'CredoPass API — docs & client',
    // Persist what you type between reloads; without this every page refresh
    // loses the token and the request bodies you were mid-way through.
    persistAuth: true,
    hideClientButton: false,
    defaultHttpClient: { targetKey: 'shell', clientKey: 'curl' },
    authentication: { preferredSecurityScheme: 'bearerAuth' },
  })
);

/**
 * Errors thrown anywhere under /api/v1 leave as problem+json. Routes and
 * services throw `ProblemError`; nothing else constructs an error body.
 */
v1.onError((err, c) => {
  if (err instanceof ProblemError) {
    return c.json(err.toBody(c.req.path), err.status as 400, {
      'Content-Type': PROBLEM_CONTENT_TYPE,
    });
  }

  console.error('Unhandled error:', err);

  // In development, put the actual cause in `detail`. A bare `internal_error`
  // gives the caller nothing to act on — the most common cause by far is a
  // missing table because DATABASE_URL points at a database the migrations have
  // not been applied to, and that is a one-line fix once you can see it.
  //
  // Never in production: driver messages carry table names, column names and
  // occasionally fragments of the data.
  const detail = isDevelopment
    ? `${(err as Error).name}: ${(err as Error).message}`
    : undefined;

  const wrapped = problem.internal(detail);
  return c.json(wrapped.toBody(c.req.path), 500, {
    'Content-Type': PROBLEM_CONTENT_TYPE,
  });
});

v1.notFound((c) => {
  const err = problem.notFound();
  return c.json(err.toBody(c.req.path), 404, {
    'Content-Type': PROBLEM_CONTENT_TYPE,
  });
});
