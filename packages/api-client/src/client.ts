/**
 * The typed CredoPass API client.
 *
 * Every read and write an app performs goes through here. Request and response
 * shapes come from `generated/schema.d.ts`, which is produced from the OpenAPI
 * document the service generates from the same Zod schemas that validate the
 * requests — so a contract change shows up as a TypeScript error rather than a
 * runtime surprise. Regenerate with:
 *
 *   nx run coreservice:openapi:export
 *   openapi-typescript services/core/openapi.json \
 *     -o packages/api-client/src/generated/schema.d.ts
 */

import createClient, { type Middleware } from 'openapi-fetch';
import { getActiveOrganizationId } from './active-organization';
import type { components, paths } from './generated/schema';

/** Matches the `servers` entry in the generated OpenAPI document. */
const DEFAULT_BASE_URL = '/api/v1/core';

// ============================================================================
// Errors
// ============================================================================

/** RFC 9457 problem+json body. Generated — mirrors `services/core/src/http/problem.ts`. */
export type ProblemBody = components['schemas']['Problem'];

export type ProblemFieldError = NonNullable<ProblemBody['errors']>[number];

/**
 * Stable machine-readable codes worth branching on, mirrored from
 * `services/core/src/http/problem.ts`. `ApiError.code` stays a plain `string`
 * so a code added server-side never fails to type-check here — this const is
 * for autocomplete and to keep literals out of call sites.
 */
export const ProblemCode = {
  VALIDATION_FAILED: 'validation_failed',
  ORGANIZATION_REQUIRED: 'organization_required',
  INVALID_PASS: 'invalid_pass',
  PASS_EXPIRED: 'pass_expired',
  UNAUTHENTICATED: 'unauthenticated',
  INSUFFICIENT_PERMISSION: 'insufficient_permission',
  NOT_A_MEMBER: 'not_a_member',
  SELF_CHECKIN_DISABLED: 'self_checkin_disabled',
  INVITATION_MISMATCH: 'invitation_mismatch',
  NOT_FOUND: 'not_found',
  EVENT_NOT_FOUND: 'event_not_found',
  PERSON_NOT_FOUND: 'person_not_found',
  CONFLICT: 'conflict',
  SLUG_TAKEN: 'slug_taken',
  EMAIL_TAKEN: 'email_taken',
  ALREADY_MEMBER: 'already_member',
  LAST_OWNER: 'last_owner',
  CAPACITY_REACHED: 'capacity_reached',
  EVENT_CLOSED: 'event_closed',
  HAS_EVENTS: 'has_events',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  PLAN_REQUIRED: 'plan_required',
  RATE_LIMITED: 'rate_limited',
  INTERNAL: 'internal_error',
} as const;

/**
 * A failed request.
 *
 * Branch on `code`, never on `detail` — `detail` is prose written for humans and
 * will be copy-edited. `status` distinguishes the two denials that look alike:
 * 404 means the resource is in another tenant or does not exist ("gone or never
 * existed"), 403 means your own tenant but the wrong role ("ask an admin").
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail?: string;
  readonly instance?: string;
  readonly errors?: ProblemFieldError[];

  constructor(body: ProblemBody) {
    super(body.detail ?? body.title ?? body.code);
    this.name = 'ApiError';
    this.status = body.status;
    this.code = body.code;
    this.title = body.title;
    this.detail = body.detail;
    this.instance = body.instance;
    this.errors = body.errors;
  }

  /** Field-level validation messages, flattened for a form or a toast. */
  get fieldErrors(): string {
    return (this.errors ?? []).map((e) => `${e.path}: ${e.message}`).join('; ');
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** True when `error` is an `ApiError` carrying one of `codes`. */
export function hasProblemCode(error: unknown, ...codes: string[]): boolean {
  return isApiError(error) && codes.includes(error.code);
}

/**
 * Build an `ApiError` from a failed response.
 *
 * The API answers every error as problem+json, but a request can also fail
 * before it reaches the app — a proxy 502, a gateway timeout — so fall back to
 * a synthetic body rather than throwing a parse error over the real failure.
 */
async function toApiError(response: Response): Promise<ApiError> {
  let body: Partial<ProblemBody> | undefined;
  try {
    body = (await response.clone().json()) as Partial<ProblemBody>;
  } catch {
    body = undefined;
  }

  if (typeof body?.code === 'string' && typeof body.status === 'number') {
    return new ApiError(body as ProblemBody);
  }

  return new ApiError({
    type: 'about:blank',
    title: response.statusText || 'Request failed',
    status: response.status,
    code: response.status >= 500 ? ProblemCode.INTERNAL : ProblemCode.CONFLICT,
    detail: `Request failed (HTTP ${response.status})`,
  });
}

// ============================================================================
// Configuration
// ============================================================================

export interface ApiClientConfig {
  /** Base URL including the version and service prefix, e.g. `/api/v1/core`. */
  baseURL?: string;

  /**
   * The caller's bearer credential, or null when signed out. Both credentials
   * the API accepts arrive this way: a Supabase JWT for a signed-in account,
   * and a `cpd_…` device token for a paired kiosk.
   */
  getAuthToken?: () => string | null | Promise<string | null>;

  /**
   * The active organization, sent as `X-Organization-Id`.
   *
   * Organization-scoped routes need it. Account-scoped routes (`/me`), public
   * routes and pass routes ignore it, and routes addressed as
   * `/organizations/{id}/…` take the id from the path instead — so sending it
   * everywhere is safe.
   *
   * Defaults to the active-organization store, which is what `useActiveOrganizationId`
   * and the org switcher read. Override only to point the client at something else.
   */
  getOrganizationId?: () => string | null | undefined;
}

let config: ApiClientConfig = {};

/**
 * Point the client at an API and tell it how to authenticate. Call once during
 * app bootstrap, before any request is made.
 */
export function configureAPIClient(next: ApiClientConfig): void {
  config = { ...config, ...next };
  client = undefined;
}

export function getAPIBaseURL(): string {
  return config.baseURL ?? DEFAULT_BASE_URL;
}

// ============================================================================
// Middleware
// ============================================================================

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const token = await config.getAuthToken?.();
    if (token) request.headers.set('Authorization', `Bearer ${token}`);

    const organizationId = config.getOrganizationId?.() ?? getActiveOrganizationId();
    if (organizationId) request.headers.set('X-Organization-Id', organizationId);

    return request;
  },

  async onResponse({ response }) {
    if (!response.ok) throw await toApiError(response);
    return response;
  },
};

type ApiClient = ReturnType<typeof createClient<paths>>;

let client: ApiClient | undefined;

/**
 * openapi-fetch reads `baseUrl` once, when the client is constructed — so the
 * client cannot be built at module load, before `configureAPIClient` has run.
 * Build it on first use instead, and drop it whenever the config changes.
 */
function getClient(): ApiClient {
  if (!client) {
    client = createClient<paths>({ baseUrl: getAPIBaseURL() });
    client.use(authMiddleware);
  }
  return client;
}

/**
 * The client. Paths and payloads are checked against the generated schema:
 *
 *   const { data } = await api.GET('/me/context');
 *   await api.POST('/events/{id}/check-in', {
 *     params: { path: { id: eventId } },
 *     body: { pass },
 *   });
 *
 * Failures throw `ApiError` rather than returning `{ error }`, so callers and
 * TanStack Query see a rejected promise.
 */
export const api: ApiClient = new Proxy({} as ApiClient, {
  get: (_target, property, receiver) => Reflect.get(getClient(), property, receiver),
});

export type { components, paths } from './generated/schema';
