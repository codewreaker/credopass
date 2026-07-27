/**
 * Identity — `/me` and `/me/context`.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '../client';
import { queryKeys } from '../query-keys';
import { useActiveOrganizationId } from '../active-organization';
import type { Account, MeContext, Permission } from '../types';
import { unwrap } from './internal';

/** The signed-in account. */
export function useMe(options?: { enabled?: boolean }): UseQueryResult<Account> {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => unwrap(api.GET('/me')),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60_000,
  });
}

/**
 * The first call every screen makes.
 *
 * Re-fetched under a new key whenever the active organization changes, because
 * `membership.permissions` is the *effective* permission set for that
 * organization — a caller who is an owner of one and a viewer of another must
 * not carry the owner's controls across the switch.
 */
export function useMeContext(options?: { enabled?: boolean }): UseQueryResult<MeContext> {
  const organizationId = useActiveOrganizationId();

  return useQuery({
    queryKey: queryKeys.meContext(organizationId),
    queryFn: () => unwrap(api.GET('/me/context')),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}

/**
 * Permission gate.
 *
 * Reads `membership.permissions` verbatim. Never infer a capability from the
 * role string — the matrix is the server's and only the server's.
 */
export function hasPermission(
  context: MeContext | undefined,
  permission: Permission
): boolean {
  return context?.membership?.permissions.includes(permission) ?? false;
}
