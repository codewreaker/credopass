/**
 * RFC 9457 `application/problem+json` error envelope.
 *
 * Every error the API emits — validation, authorization, not-found, conflict,
 * unhandled — leaves through here, so a client only ever has to parse one shape.
 * See docs/API-FIRST-REBUILD.md §5.0.
 *
 * `code` is the field clients should branch on. `type`/`title` are for humans;
 * `code` is a stable machine string that survives copy edits.
 */

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/**
 * Base URI for the `type` field.
 *
 * Per RFC 9457 this is an IDENTIFIER, not a link that has to work: clients
 * compare it, they do not fetch it. A page there is a courtesy, not a
 * requirement, so nothing is broken while `/problems/*` 404s.
 *
 * It points at `app.credopass.com` because that is the application;
 * `credopass.com` is the marketing site and should not be answering for API
 * error semantics. Override with PROBLEM_TYPE_BASE if the docs move.
 */
const TYPE_BASE = process.env.PROBLEM_TYPE_BASE ?? 'https://app.credopass.com/problems';

/**
 * Stable machine-readable error codes. Adding one is additive; changing the
 * string of an existing one is a breaking API change.
 */
export const ProblemCode = {
  // 400
  VALIDATION_FAILED: 'validation_failed',
  ORGANIZATION_REQUIRED: 'organization_required',
  INVALID_PASS: 'invalid_pass',
  PASS_EXPIRED: 'pass_expired',
  PUBLIC_SUFFIX: 'public_suffix',
  // 401
  UNAUTHENTICATED: 'unauthenticated',
  // 403
  INSUFFICIENT_PERMISSION: 'insufficient_permission',
  NOT_A_MEMBER: 'not_a_member',
  SELF_CHECKIN_DISABLED: 'self_checkin_disabled',
  INVITATION_MISMATCH: 'invitation_mismatch',
  // 404
  NOT_FOUND: 'not_found',
  EVENT_NOT_FOUND: 'event_not_found',
  PERSON_NOT_FOUND: 'person_not_found',
  // 409
  CONFLICT: 'conflict',
  SLUG_TAKEN: 'slug_taken',
  EMAIL_TAKEN: 'email_taken',
  ISSUER_TAKEN: 'issuer_taken',
  ALREADY_MEMBER: 'already_member',
  LAST_OWNER: 'last_owner',
  CAPACITY_REACHED: 'capacity_reached',
  EVENT_CLOSED: 'event_closed',
  HAS_EVENTS: 'has_events',
  DNS_NOT_FOUND: 'dns_not_found',
  IDEMPOTENCY_KEY_REUSE: 'idempotency_key_reuse',
  // 410
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  // 402 / 429 / 500
  PLAN_REQUIRED: 'plan_required',
  PLAN_LIMIT: 'plan_limit',
  RATE_LIMITED: 'rate_limited',
  INTERNAL: 'internal_error',
} as const;

export type ProblemCodeValue = (typeof ProblemCode)[keyof typeof ProblemCode];

export interface ProblemFieldError {
  path: string;
  message: string;
}

export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: ProblemCodeValue;
  errors?: ProblemFieldError[];
}

const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  410: 'Gone',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

/**
 * The one error type services and routes throw. The HTTP layer turns it into a
 * problem+json response; nothing else in the codebase constructs error bodies.
 */
export class ProblemError extends Error {
  readonly status: number;
  readonly code: ProblemCodeValue;
  readonly detail?: string;
  readonly errors?: ProblemFieldError[];

  constructor(
    status: number,
    code: ProblemCodeValue,
    detail?: string,
    errors?: ProblemFieldError[]
  ) {
    super(detail ?? code);
    this.name = 'ProblemError';
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.errors = errors;
  }

  toBody(instance?: string): ProblemBody {
    return {
      type: `${TYPE_BASE}/${this.code}`,
      title: TITLES[this.status] ?? 'Error',
      status: this.status,
      ...(this.detail ? { detail: this.detail } : {}),
      ...(instance ? { instance } : {}),
      code: this.code,
      ...(this.errors?.length ? { errors: this.errors } : {}),
    };
  }
}

/**
 * Constructors for the statuses worth naming.
 *
 * `notFound` is the workhorse: a resource in another tenant returns 404, never
 * 403, so existence is never leaked (§5.0). 403 is reserved for "your own
 * tenant, insufficient role" — see `forbidden`.
 */
export const problem = {
  badRequest: (code: ProblemCodeValue = ProblemCode.VALIDATION_FAILED, detail?: string, errors?: ProblemFieldError[]) =>
    new ProblemError(400, code, detail, errors),
  unauthenticated: (detail?: string) =>
    new ProblemError(401, ProblemCode.UNAUTHENTICATED, detail),
  paymentRequired: (code: ProblemCodeValue = ProblemCode.PLAN_REQUIRED, detail?: string) =>
    new ProblemError(402, code, detail),
  forbidden: (code: ProblemCodeValue = ProblemCode.INSUFFICIENT_PERMISSION, detail?: string) =>
    new ProblemError(403, code, detail),
  notFound: (code: ProblemCodeValue = ProblemCode.NOT_FOUND, detail?: string) =>
    new ProblemError(404, code, detail),
  conflict: (code: ProblemCodeValue = ProblemCode.CONFLICT, detail?: string) =>
    new ProblemError(409, code, detail),
  gone: (code: ProblemCodeValue = ProblemCode.EXPIRED, detail?: string) =>
    new ProblemError(410, code, detail),
  rateLimited: (detail?: string) =>
    new ProblemError(429, ProblemCode.RATE_LIMITED, detail),
  internal: (detail?: string) =>
    new ProblemError(500, ProblemCode.INTERNAL, detail),
};
