/**
 * The active organization, held outside React.
 *
 * Every organization-scoped request carries `X-Organization-Id`, so the client
 * needs the id before any component renders — which is why this lives in a
 * module-level store the openapi-fetch middleware can read synchronously rather
 * than in React state.
 *
 * The id is also part of every org-scoped query key. Switching organizations
 * therefore re-keys the cache instead of mutating it, and the old organization's
 * rows are never shown under the new one. That is what replaced the old
 * `window.location.reload()` on switch.
 *
 * Persistence is **per account**. The previous implementation auto-selected
 * `organizations[0]` from a list that contained every organization in the
 * database, which is how one tenant's console ended up showing another's events
 * (API-SECOND-REBUILD §2.2). The list is now the caller's memberships only, and
 * the remembered choice is stored under their account id, so signing in as
 * someone else on the same browser cannot inherit it.
 */

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'credopass:active-organization';

/** accountId → organizationId. */
type Remembered = Record<string, string>;

let boundAccountId: string | null = null;
let activeOrganizationId: string | null = null;

const listeners = new Set<() => void>();

function readRemembered(): Remembered {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Remembered) : {};
  } catch {
    return {};
  }
}

function writeRemembered(next: Remembered): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private browsing / storage disabled — the choice still holds for this session */
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function getActiveOrganizationId(): string | null {
  return activeOrganizationId;
}

export function setActiveOrganizationId(id: string | null): void {
  if (id === activeOrganizationId) return;
  activeOrganizationId = id;

  if (boundAccountId) {
    const remembered = readRemembered();
    if (id) remembered[boundAccountId] = id;
    else delete remembered[boundAccountId];
    writeRemembered(remembered);
  }

  emit();
}

/**
 * Decide which organization the console should open on, given who is signed in
 * and what they actually belong to.
 *
 * Returns null when the caller belongs to nothing — the onboarding case. The
 * caller is expected to route to `/onboarding` rather than render an empty
 * console.
 */
export function resolveActiveOrganization(
  accountId: string,
  membershipIds: readonly string[]
): string | null {
  boundAccountId = accountId;

  const remembered = readRemembered()[accountId];
  const next =
    remembered && membershipIds.includes(remembered)
      ? remembered
      : activeOrganizationId && membershipIds.includes(activeOrganizationId)
        ? activeOrganizationId
        : // No memory and more than one membership: open the first one the caller
          // belongs to. Unlike the behaviour this replaced, the list is scoped to
          // their own memberships, so this can only ever land on their own data.
          (membershipIds[0] ?? null);

  setActiveOrganizationId(next);
  return next;
}

/** Forget everything. Call on sign-out so the next account starts clean. */
export function clearActiveOrganization(): void {
  boundAccountId = null;
  activeOrganizationId = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The active organization id, re-rendering the component when it changes. */
export function useActiveOrganizationId(): string | null {
  return useSyncExternalStore(subscribe, getActiveOrganizationId, () => null);
}
