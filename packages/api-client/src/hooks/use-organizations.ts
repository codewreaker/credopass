/**
 * Organizations, members and invitations.
 *
 * `GET /organizations` returns the caller's own organizations and nothing else,
 * so it is safe to render straight into a switcher. It also carries the name and
 * plan that `/me/context` omits — context ships ids, roles and permissions.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api } from '../client';
import { queryKeys } from '../query-keys';
import type {
  ApiBody,
  Invitation,
  InvitationCreated,
  Member,
  Organization,
  Role,
} from '../types';
import { unwrap } from './internal';

// ============================================================================
// Organizations
// ============================================================================

export function useOrganizations(options?: { enabled?: boolean }): UseQueryResult<Organization[]> {
  return useQuery({
    queryKey: queryKeys.organizations(),
    queryFn: () => unwrap(api.GET('/organizations')),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}

export function useOrganization(id: string | undefined): UseQueryResult<Organization> {
  return useQuery({
    queryKey: queryKeys.organization(id ?? ''),
    queryFn: () => unwrap(api.GET('/organizations/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
  });
}

/** Creating an organization makes you its owner in the same transaction. */
export function useCreateOrganization(): UseMutationResult<
  Organization,
  Error,
  ApiBody<'/organizations', 'post'>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => unwrap(api.POST('/organizations', { body })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations() });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useUpdateOrganization(
  id: string
): UseMutationResult<Organization, Error, ApiBody<'/organizations/{id}', 'patch'>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      unwrap(api.PATCH('/organizations/{id}', { params: { path: { id } }, body })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations() });
      queryClient.invalidateQueries({ queryKey: queryKeys.organization(id) });
    },
  });
}

/** 409 `has_events` when the organization still has events. Surface it, don't retry. */
export function useDeleteOrganization(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await api.DELETE('/organizations/{id}', { params: { path: { id } } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations() });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

// ============================================================================
// Members
// ============================================================================

export function useMembers(organizationId: string | undefined): UseQueryResult<Member[]> {
  return useQuery({
    queryKey: queryKeys.members(organizationId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/organizations/{id}/members', { params: { path: { id: organizationId! } } })
      ),
    enabled: !!organizationId,
  });
}

/** 409 `last_owner` — the only owner can be neither demoted nor removed. */
export function useUpdateMemberRole(
  organizationId: string
): UseMutationResult<Member, Error, { accountId: string; role: Role }> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, role }) =>
      unwrap(
        api.PATCH('/organizations/{id}/members/{accountId}', {
          params: { path: { id: organizationId, accountId } },
          body: { role },
        })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.members(organizationId) }),
  });
}

export function useRemoveMember(
  organizationId: string
): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId) => {
      await api.DELETE('/organizations/{id}/members/{accountId}', {
        params: { path: { id: organizationId, accountId } },
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.members(organizationId) }),
  });
}

// ============================================================================
// Invitations
// ============================================================================

export function useInvitations(
  organizationId: string | undefined
): UseQueryResult<Invitation[]> {
  return useQuery({
    queryKey: queryKeys.invitations(organizationId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/organizations/{id}/invitations', { params: { path: { id: organizationId! } } })
      ),
    enabled: !!organizationId,
  });
}

/**
 * The response carries `token` **once**. No email is sent yet, so the caller
 * must show the resulting link on screen — see API-SECOND-REBUILD §1.6.
 */
export function useCreateInvitation(
  organizationId: string
): UseMutationResult<InvitationCreated, Error, { email: string; role: Role }> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      unwrap(
        api.POST('/organizations/{id}/invitations', {
          params: { path: { id: organizationId } },
          body,
        })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations(organizationId) }),
  });
}

export function useRevokeInvitation(
  organizationId: string
): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId) => {
      await api.DELETE('/organizations/{id}/invitations/{invitationId}', {
        params: { path: { id: organizationId, invitationId } },
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations(organizationId) }),
  });
}

/**
 * Accepting requires a **verified** email matching the invitation. A mismatch is
 * `403 invitation_mismatch`, which means "sign in with the other address" — not
 * "you lack permission". Render it as its own case.
 */
export function useAcceptInvitation(): UseMutationResult<
  { organizationId: string; role: Role },
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token) =>
      unwrap(api.POST('/invitations/{token}/accept', { params: { path: { token } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations() });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
