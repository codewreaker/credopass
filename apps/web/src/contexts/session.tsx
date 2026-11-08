/**
 * App bootstrap.
 *
 * `GET /me/context` is the first call every screen makes (API-SECOND-REBUILD
 * §1.7). It returns the account, the caller's memberships, the active
 * organization and the effective `permissions[]` for that organization.
 * Everything downstream — the org switcher, every permission gate, the greeting
 * — reads from here rather than asking again.
 *
 * It used to carry `needsOnboarding` too, which gated a redirect to a wizard.
 * Signing in commissions an organization, so the flag was permanently false and
 * the wizard permanently unreachable; both are gone (D22).
 *
 * This replaces `contexts/premium.tsx`, which kept entitlements in
 * `localStorage`. Entitlements are the server's answer now.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@credopass/lib/supabase';
import {
  resolveActiveOrganization,
  useActiveOrganizationId,
  useClaimTickets,
  useMeContext,
  type MeContext,
  type Permission,
} from '@credopass/api-client';
import { supabase } from '../supabase';

interface SessionContextValue {
  /** The Supabase session, or null for a signed-out visitor. */
  session: Session | null;
  /** True until Supabase has replayed the persisted session. */
  isAuthLoading: boolean;
  /** `/me/context`. Undefined until it resolves, or when signed out. */
  context: MeContext | undefined;
  isContextLoading: boolean;
  /** The active organization id, or null when there is none yet. */
  organizationId: string | null;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const organizationId = useActiveOrganizationId();

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setIsAuthLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setIsAuthLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const { data: context, isLoading: isContextLoading } = useMeContext({
    enabled: !isAuthLoading && !!session,
  });

  // Which organization the console opens on. Resolved from the caller's own
  // memberships and remembered per account — never "whatever is first in a
  // global list", which is the bug this replaced (§2.2).
  useEffect(() => {
    if (!context) return;
    resolveActiveOrganization(
      context.account.id,
      context.organizations.map((o) => o.id)
    );
  }, [context]);

  /**
   * Adopt registrations made before this account existed (D17).
   *
   * Someone registers for three events as a guest over a year and then signs
   * in for the first time. Those `people` rows carry no `account_id`, so
   * `/me/tickets` is empty and the product looks like it lost them. One call
   * on bootstrap links the ones whose address the identity provider asserted.
   *
   * Here rather than on the sign-in screen because that screen is not the only
   * way in: a session is also replayed from storage on every cold start, and
   * an OAuth round-trip can land on any route. This runs wherever the app
   * boots with a session.
   *
   * Once per account per page load. The call is idempotent and usually claims
   * nothing, so a repeat is harmless rather than wrong — but it is also
   * pointless, and `/me/context` re-resolves on every organisation switch.
   */
  const claim = useClaimTickets();
  const claimedFor = useRef<string | null>(null);
  const claimMutate = claim.mutate;
  useEffect(() => {
    const accountId = context?.account.id;
    if (!accountId || claimedFor.current === accountId) return;
    claimedFor.current = accountId;
    // Fire and forget. Nothing on screen waits for it, and a failure means a
    // guest registration stays unlinked — worth a retry next load, never worth
    // an error toast on top of a successful sign-in.
    claimMutate();
  }, [context?.account.id, claimMutate]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      isAuthLoading,
      context,
      isContextLoading,
      organizationId,
    }),
    [session, isAuthLoading, context, isContextLoading, organizationId]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used within a SessionProvider');
  return context;
}

/**
 * Can the caller do this, here?
 *
 * Reads `membership.permissions` for the **active** organization. Hide what the
 * answer is no to — do not render a control that will come back 403 (§2.9).
 */
export function useCan(permission: Permission): boolean {
  const { context } = useSession();
  return context?.membership?.permissions.includes(permission) ?? false;
}

/** The caller's display name. `GET /me/context` is the only source. */
export function useDisplayName(): string {
  const { context } = useSession();
  const name = context?.account.displayName?.trim();
  if (name) return name;
  const email = context?.account.email;
  return email ? email.split('@')[0] : 'there';
}

/**
 * The name to greet someone by, and whether we actually know it yet.
 *
 * Two things were wrong with greeting from `useDisplayName()` alone (F1, R2):
 *
 * 1. **It rendered before it knew.** `Good afternoon, there` sat on screen for
 *    the length of the bootstrap request — a greeting addressed to no one,
 *    indistinguishable from a real answer. `isKnown` is false until
 *    `/me/context` resolves, so the caller can render a skeleton instead of a
 *    confident wrong value. **Never greet when `isKnown` is false.**
 * 2. **It was the email local part.** That was a server bug — the name was read
 *    from a top-level `name` claim Supabase does not send — and it is fixed in
 *    `services/core/src/services/identity.ts`. The email fallback stays for the
 *    genuine case of a provider that asserts no name at all, but it is now the
 *    exception rather than what everybody saw.
 *
 * The first name is the display name split on whitespace: Google reliably sends
 * `full_name`/`name` and only sometimes `given_name`, so splitting is the
 * dependable half. An email fallback is never split — `israel.agyeman.prempeh`
 * would become `israel.agyeman.prempeh` anyway, and a local part with a dot in
 * it is not a first name.
 */
export function useGreetingName(): { firstName: string; isKnown: boolean } {
  const { context, isContextLoading, session } = useSession();

  const name = context?.account.displayName?.trim();
  if (name) return { firstName: name.split(/\s+/)[0], isKnown: true };

  const email = context?.account.email?.trim();
  if (email) return { firstName: email.split('@')[0], isKnown: true };

  // No context yet. Signed out is a settled answer ('there'); still loading is
  // not, and must not be rendered as one.
  return { firstName: 'there', isKnown: !session ? true : !isContextLoading };
}

/**
 * The active organization's name, straight off the bootstrap context.
 *
 * This is the B2 fix. The composer used to find it in `useOrganizations()` — a
 * SECOND request — and render `'No organization'` for however long that took,
 * which is a loading state wearing an error message. `/me/context` has shipped
 * the name since 2026-11-07, so there is nothing to race.
 *
 * `null` means "not known yet"; an empty-string name is impossible (the column
 * is NOT NULL and the API trims). A caller with genuinely no organization is
 * near-impossible too — `ensureDefaultOrganization` commissions one on the
 * first authenticated request (D22) — so treat `null` as "wait", not "none".
 */
export function useActiveOrganizationName(): string | null {
  const { context, organizationId } = useSession();
  if (!context) return null;
  const match = context.organizations.find((o) => o.id === organizationId);
  return match?.name ?? context.activeOrganization?.name ?? null;
}
