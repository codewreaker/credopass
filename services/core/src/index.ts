/**
 * CredoPass API.
 *
 * One surface: `/api/v1/core`. The old `/api/core` CRUD layer is gone, along
 * with the tables it served — `users`, `event_members`, `loyalty` — and the
 * TanStack DB collections that cached them in the browser.
 *
 * Everything the product can do is reachable here with curl, and the OpenAPI
 * document at /api/v1/core/openapi.json is the contract.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { isDevelopment } from 'std-env';
import { v1, V1_BASE_PATH } from './api/v1/core';
import { assertRouteRegistryComplete, getRouteDeclarations } from './http/route-registry';
import { reportSchemaAtBoot } from './db/schema-check';

export const app = new Hono();

app.use('*', logger());

if (isDevelopment) {
  console.log('⚙️  CORS: development — all origins allowed');
  app.use('*', cors());
} else {
  console.log('⚙️  CORS: production — allow-list only');
  app.use(
    '*',
    cors({
      // `app.credopass.com` is the product. `credopass.com` is the marketing
      // site and does not call the API.
      origin: ['https://app.credopass.com'],
      credentials: true,
    })
  );
}

app.route(V1_BASE_PATH, v1);

app.get('/', (c) =>
  c.json({
    name: 'CredoPass API',
    docs: `${V1_BASE_PATH}/docs`,
    openapi: `${V1_BASE_PATH}/openapi.json`,
  })
);

app.notFound((c) =>
  c.json(
    {
      type: 'https://app.credopass.com/problems/not_found',
      title: 'Not Found',
      status: 404,
      code: 'not_found',
      detail: `Nothing at ${c.req.path}. The API is served under ${V1_BASE_PATH}.`,
    },
    404,
    { 'Content-Type': 'application/problem+json' }
  )
);

// ---------------------------------------------------------------------------
// Boot assertions (§6.4). A route that failed to declare its scope or
// permission crashes the service HERE, before it serves a single request.
// ---------------------------------------------------------------------------
assertRouteRegistryComplete();
console.log(`🔒 Route registry: ${getRouteDeclarations().length} route(s), all declared`);

// Non-fatal: a schema/DATABASE_URL mismatch is reported loudly at boot rather
// than as an opaque 500 on every request.
void reportSchemaAtBoot();

const port = Number(process.env.PORT) || 3000;

console.log(`📦 Mode: ${isDevelopment ? 'development' : 'production'}`);
const envStatus = (name: string) => `${name}=${process.env[name] ? '✓' : '✗ missing'}`;
console.log(`🔑 Env: ${['SUPABASE_URL', 'DATABASE_URL'].map(envStatus).join('  ')}`);
console.log(`🚀 http://localhost:${port}${V1_BASE_PATH}/docs`);

export default { port, fetch: app.fetch };
