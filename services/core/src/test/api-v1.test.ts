/**
 * The /api/v1 skeleton: ops endpoints, the emitted contract, Scalar, and the
 * problem+json envelope. No database — Phase 0's "landed when" gate.
 */

import { describe, expect, it } from 'bun:test';
import { v1, V1_BASE_PATH } from '../api/v1';
import { expectMatchesContract, openApiDocument } from './contract';
import { getRouteDeclarations } from '../http/route-registry';
import { PROBLEM_CONTENT_TYPE } from '../http/problem';

/** Bodies are asserted field by field; the contract harness checks their shape. */
const json = async (res: Response): Promise<any> => res.clone().json();

describe('ops endpoints (§5.11)', () => {
  it('GET /health serves without auth and matches its contract', async () => {
    const res = await v1.request('/health');
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('commit');
    await expectMatchesContract(res, 'GET', '/health');
  });

  it('every response carries X-API-Version', async () => {
    const res = await v1.request('/health');
    expect(res.headers.get('X-API-Version')).toBe('v1');
  });

  it('GET /docs serves Scalar', async () => {
    const res = await v1.request('/docs');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });
});

describe('the emitted contract (rule 4 — no hand-written OpenAPI)', () => {
  it('GET /openapi.json serves a 3.1 document', async () => {
    const doc = await openApiDocument();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('CredoPass API');
    expect(doc.info.version).toBe('v1');
  });

  it('documents every route in the registry', async () => {
    const doc = await openApiDocument();
    for (const route of getRouteDeclarations()) {
      const item = doc.paths?.[route.path];
      expect(item, `${route.method.toUpperCase()} ${route.path} missing from openapi.json`).toBeDefined();
      expect(item?.[route.method]).toBeDefined();
    }
  });

  it('describes the Problem schema, so clients can code against one error shape', async () => {
    const doc = await openApiDocument();
    expect(doc.components?.schemas?.Problem).toBeDefined();
    const props = doc.components.schemas.Problem.properties;
    for (const field of ['type', 'title', 'status', 'code']) {
      expect(props).toHaveProperty(field);
    }
  });
});

describe('problem+json envelope (§5.0)', () => {
  it('an unknown path under /api/v1 returns problem+json, not { error }', async () => {
    const res = await v1.request('/no-such-endpoint');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain(PROBLEM_CONTENT_TYPE);

    const body = await json(res);
    expect(body.code).toBe('not_found');
    expect(body.status).toBe(404);
    expect(body.title).toBe('Not Found');
    expect(body.type).toContain('not_found');
    expect(body.instance).toBe('/no-such-endpoint');
  });

  it('does not leak internals in the 404 body', async () => {
    const res = await v1.request('/no-such-endpoint');
    const raw = JSON.stringify(await json(res));
    expect(raw).not.toContain('stack');
    expect(raw).not.toContain('at Object');
  });
});

describe('the contract harness itself (§12.1)', () => {
  // A harness that cannot fail proves nothing. These assert it rejects each of
  // the three ways a response can break the contract.
  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  it('rejects a response from an undocumented endpoint', async () => {
    await expect(
      expectMatchesContract(jsonResponse({ ok: true }), 'GET', '/not-in-the-document')
    ).rejects.toThrow(/not described in openapi.json/);
  });

  it('rejects a documented endpoint returning an undocumented status', async () => {
    await expect(
      expectMatchesContract(jsonResponse({ status: 'ok' }, 418), 'GET', '/health')
    ).rejects.toThrow(/document does not describe/);
  });

  it('rejects a body that does not match its schema', async () => {
    // `status` must be the literal "ok" and version/commit are required.
    await expect(
      expectMatchesContract(jsonResponse({ status: 'degraded' }), 'GET', '/health')
    ).rejects.toThrow(/does not match its schema/);
  });

  it('accepts a correct body', async () => {
    await expect(
      expectMatchesContract(
        jsonResponse({ status: 'ok', version: '1.0.0', commit: 'abc' }),
        'GET',
        '/health'
      )
    ).resolves.toBeUndefined();
  });
});

describe('mounting', () => {
  it('is mounted at /api/v1 on the main app', async () => {
    const { app } = await import('../index');
    const res = await app.request(`${V1_BASE_PATH}/health`);
    expect(res.status).toBe(200);
  });

  it('leaves /api/core untouched — Phase 0 is additive', async () => {
    const { app, API_BASE_PATH } = await import('../index');
    expect(API_BASE_PATH).toBe('/api/core');
    const res = await app.request(`${API_BASE_PATH}/health`);
    expect(res.status).toBe(200);
  });
});
