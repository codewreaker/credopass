/**
 * App bootstrap.
 *
 * `GET /me/context` is the first call every screen makes (API-SECOND-REBUILD
 * §1.7). It returns the account, the caller's memberships, the active
 * organization, the effective `permissions[]` for that organization, and
 * `needsOnboarding`. Everything downstream — the org switcher, every permission
 * gate, the greeting, the onboarding redirect — reads from here rather than
 * asking again.
 *
 * This replaces `contexts/premium.tsx`, which kept entitlements in
 * `localStorage`. Entitlements are the server's answer now.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@credopass/lib/supabase';
import {
  resolveActiveOrganization,
  useActiveOrganizationId,
  useMeContext,
  type MeContext,
  type Permission,
} from '@credopass/api-client';
import { supabase } from '../supabase';
import { readDeviceCredential } from '../lib/device-token';

interface SessionContextValue {
  /** The Supabase session, or null for a signed-out visitor / paired device. */
  session: Session | null;
  /** True until Supabase has replayed the persisted session. */
  isAuthLoading: boolean;
  /** `/me/context`. Undefined until it resolves, or when signed out. */
  context: MeContext | undefined;
  isContextLoading: boolean;
  /** The caller belongs to no organization — send them to `/onboarding`. */
  needsOnboarding: boolean;
  /** The active organization id, or null when there is none yet. */
  organizationId: string | null;
  /** True when this browser is a paired door tablet rather than a person. */
  isPairedDevice: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const organizationId = useActiveOrganizationId();

  // A paired tablet is decided once, at mount: pairing navigates afterwards, so
  // there is no state in which this needs to change under a rendered tree.
  const [isPairedDevice] = useState(() => readDeviceCredential() !== null);

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

  // A paired device has no account and must never be asked for one, so the
  // account-scoped bootstrap simply does not run for it.
  const { data: context, isLoading: isContextLoading } = useMeContext({
    enabled: !isAuthLoading && !!session && !isPairedDevice,
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

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      isAuthLoading,
      context,
      isContextLoading,
      needsOnboarding: context?.needsOnboarding ?? false,
      organizationId,
      isPairedDevice,
    }),
    [session, isAuthLoading, context, isContextLoading, organizationId, isPairedDevice]
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

/** The caller's display name, for greetings. `GET /me` is the only source. */
export function useDisplayName(): string {
  const { context } = useSession();
  const name = context?.account.displayName?.trim();
  if (name) return name;
  const email = context?.account.email;
  return email ? email.split('@')[0] : 'there';
}
