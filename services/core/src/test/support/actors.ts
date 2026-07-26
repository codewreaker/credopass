/**
 * Actors for the adversarial suite (§7.3).
 *
 * The suite's whole premise is two tenants that must not be able to see each
 * other, so the fixture is two of everything. `A` and `B` are named rather than
 * numbered because every test reads as a sentence: "A GETs B's event".
 *
 * Phase 0 note: the identity endpoints these lean on land in Phase 1. Until
 * then `as()` produces a caller whose token the API cannot yet resolve, so the
 * suite is RED — which is the point (§12.2). Nothing here should be softened to
 * make it pass early.
 */

import { v1, V1_BASE_PATH } from '../../api/v1';
import { expectMatchesContract } from '../contract';

export interface Actor {
  label: string;
  accountId: string;
  organizationId: string;
  token: string;
}

export interface RequestOptions {
  /** Sent as X-Organization-Id. Omit to exercise the "absent header" rules. */
  organizationId?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  /** Skip contract validation — only for asserting an undocumented response. */
  skipContract?: boolean;
}

/**
 * Response bodies in these suites are dynamic JSON asserted field by field, so
 * `json()` is typed loosely on purpose — the contract harness is what checks
 * shape, and it does so against the emitted schema rather than a hand-written
 * TS type that would just be a second source of truth.
 */
export type TestResponse = Omit<Response, 'json' | 'clone'> & {
  json(): Promise<any>;
  clone(): TestResponse;
};

/**
 * Issue a request as an actor. Every response is contract-checked on the way
 * out, so a tenancy fix that invents an undocumented error shape fails here too.
 */
export async function request(
  actor: Actor | null,
  method: string,
  path: string,
  opts: RequestOptions = {}
): Promise<TestResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...opts.headers,
  };

  if (actor) headers.Authorization = `Bearer ${actor.token}`;

  const org =
    opts.organizationId === null
      ? null
      : (opts.organizationId ?? actor?.organizationId ?? null);
  if (org) headers['X-Organization-Id'] = org;

  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  const res = await v1.request(path, {
    method,
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });

  if (!opts.skipContract) {
    await expectMatchesContract(res, method, `${V1_BASE_PATH}${path}`);
  }
  return res as TestResponse;
}

/** Read the RFC 9457 `code` from an error response. */
export async function problemCode(res: Response | TestResponse): Promise<string | undefined> {
  try {
    const body = (await (res as Response).clone().json()) as { code?: string };
    return body?.code;
  } catch {
    return undefined;
  }
}
