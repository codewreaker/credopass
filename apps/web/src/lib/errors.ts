/**
 * Turning an API failure into something a person can act on.
 *
 * Branch on `code`, never on `detail`. `detail` is prose written for humans and
 * will be copy-edited; `code` is the stable contract (§1.7). The messages here
 * are ours — the server's `detail` is only used as a fallback for codes we have
 * not given a voice to yet.
 */

import { isApiError, ProblemCode } from '@credopass/api-client';

/**
 * Copy for the codes worth handling by name.
 *
 * 404 and 403 read differently on purpose. Another tenant's resource is a 404 —
 * "gone or never existed" — because saying 403 would confirm the row exists. A
 * real 403 means your own organization, wrong role: "ask an admin" (§1.7).
 */
const MESSAGES: Record<string, string> = {
  [ProblemCode.NOT_A_MEMBER]: 'You are not a member of this organization.',
  [ProblemCode.ORGANIZATION_REQUIRED]: 'Pick an organization first.',
  [ProblemCode.INSUFFICIENT_PERMISSION]: 'Your role does not allow this — ask an admin.',
  [ProblemCode.LAST_OWNER]: 'An organization needs at least one owner.',
  [ProblemCode.CAPACITY_REACHED]: 'This event is full.',
  [ProblemCode.EVENT_CLOSED]: 'This event is closed — check-in has ended.',
  [ProblemCode.SELF_CHECKIN_DISABLED]: 'The organiser has turned off self check-in.',
  [ProblemCode.SLUG_TAKEN]: 'That web address is already taken.',
  [ProblemCode.EMAIL_TAKEN]: 'Someone with that email is already on this organization.',
  [ProblemCode.ALREADY_MEMBER]: 'They are already a member.',
  [ProblemCode.INVITATION_MISMATCH]:
    'This invitation was sent to a different address — sign in with that one.',
  [ProblemCode.HAS_EVENTS]: 'This organization still has events. Delete or move them first.',
  [ProblemCode.EXPIRED]: 'This has expired.',
  [ProblemCode.REVOKED]: 'This has been revoked.',
  [ProblemCode.TOKEN_REVOKED]: 'This device has been revoked — ask an admin to re-pair it.',
  [ProblemCode.INVALID_PASS]: 'That pass is not valid for this event.',
  [ProblemCode.PASS_EXPIRED]: 'That pass has expired.',
  [ProblemCode.NOT_FOUND]: 'Not found.',
  [ProblemCode.EVENT_NOT_FOUND]: 'That event does not exist, or has been removed.',
  [ProblemCode.PERSON_NOT_FOUND]: 'That person is not on this organization.',
  [ProblemCode.RATE_LIMITED]: 'Too many attempts. Wait a moment and try again.',
};

/** A message to show the user. `fallback` covers anything unmapped. */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (!isApiError(error)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  const mapped = MESSAGES[error.code];
  if (mapped) return mapped;

  // Validation failures carry field-level detail worth surfacing verbatim.
  if (error.code === ProblemCode.VALIDATION_FAILED && error.errors?.length) {
    return error.fieldErrors;
  }

  return error.detail ?? error.title ?? fallback;
}

/** True when the failure means "this does not exist, for you". */
export function isNotFound(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

/** True when the failure means "your organization, wrong role". */
export function isForbidden(error: unknown): boolean {
  return isApiError(error) && error.status === 403;
}

/** True when the credential itself is finished — expired pass, revoked device. */
export function isGone(error: unknown): boolean {
  return isApiError(error) && error.status === 410;
}
