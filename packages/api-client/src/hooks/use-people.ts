/**
 * People.
 *
 * `standing` and `eventsAttended` arrive pre-computed. The page that used to
 * derive them scanned every attendance row in the browser to do it (§2.5); if
 * you find yourself reaching for a `useMemo` here, the value is already on the
 * row.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api } from '../client';
import { peopleScope, queryKeys } from '../query-keys';
import { useActiveOrganizationId } from '../active-organization';
import type {
  PeopleList,
  PeopleListQuery,
  PeopleSummary,
  Person,
  PersonCreate,
  PersonCreated,
  PersonUpdate,
} from '../types';
import { compact, unwrap } from './internal';

export function usePeople(
  query: PeopleListQuery = {},
  options?: { enabled?: boolean }
): UseQueryResult<PeopleList> {
  const organizationId = useActiveOrganizationId();
  const params = compact(query);

  return useQuery({
    queryKey: queryKeys.people(organizationId, params),
    queryFn: () => unwrap(api.GET('/people', { params: { query: params } })),
    enabled: (options?.enabled ?? true) && !!organizationId,
  });
}

/** The billboard tiles. Scope to one event with `eventId`. */
export function usePeopleSummary(
  eventId?: string,
  options?: { enabled?: boolean }
): UseQueryResult<PeopleSummary> {
  const organizationId = useActiveOrganizationId();

  return useQuery({
    queryKey: queryKeys.peopleSummary(organizationId, eventId),
    queryFn: () =>
      unwrap(api.GET('/people/summary', { params: { query: compact({ eventId }) } })),
    enabled: (options?.enabled ?? true) && !!organizationId,
  });
}

/** One person, with lifetime stats. */
export function usePerson(id: string | undefined): UseQueryResult<Person> {
  const organizationId = useActiveOrganizationId();

  return useQuery({
    queryKey: queryKeys.person(organizationId, id ?? ''),
    queryFn: () => unwrap(api.GET('/people/{id}', { params: { path: { id: id! } } })),
    enabled: !!id && !!organizationId,
    retry: false,
  });
}

function useInvalidatePeople() {
  const queryClient = useQueryClient();
  const organizationId = useActiveOrganizationId();
  return () => queryClient.invalidateQueries({ queryKey: peopleScope(organizationId) });
}

/** Email is unique **per organization** — a clash is `409 email_taken`. */
export function useCreatePerson(): UseMutationResult<PersonCreated, Error, PersonCreate> {
  const invalidate = useInvalidatePeople();
  return useMutation({
    mutationFn: (body) => unwrap(api.POST('/people', { body })),
    onSuccess: invalidate,
  });
}

export function useUpdatePerson(
  id: string
): UseMutationResult<PersonCreated, Error, PersonUpdate> {
  const invalidate = useInvalidatePeople();
  return useMutation({
    mutationFn: (body) => unwrap(api.PATCH('/people/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  });
}

/** Soft delete — the person leaves the roll, their attendance history stays. */
export function useDeletePerson(): UseMutationResult<void, Error, string> {
  const invalidate = useInvalidatePeople();
  return useMutation({
    mutationFn: async (id) => {
      await api.DELETE('/people/{id}', { params: { path: { id } } });
    },
    onSuccess: invalidate,
  });
}
