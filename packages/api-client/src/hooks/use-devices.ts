/**
 * Devices — the paired door tablet.
 *
 * The console never sees a device token. Creating a device returns a **pairing
 * code**; the tablet redeems that code itself at `POST /devices/pair` and is the
 * only party that ever holds the resulting `cpd_…` token. That is the point of
 * the split: a screenshot of the console cannot check anyone in.
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
import type { ApiBody, Device, DevicePaired, DevicePairingCode } from '../types';
import { compact, unwrap } from './internal';

export function useDevices(
  organizationId: string | undefined,
  eventId?: string
): UseQueryResult<Device[]> {
  return useQuery({
    queryKey: queryKeys.organizationDevices(organizationId ?? '', eventId),
    queryFn: () =>
      unwrap(
        api.GET('/organizations/{id}/devices', {
          params: { path: { id: organizationId! }, query: compact({ eventId }) },
        })
      ),
    enabled: !!organizationId,
  });
}

/**
 * Mint a pairing code for one event.
 *
 * The code expires in 15 minutes and works once, so display it large and
 * legible — someone is reading it off this screen onto a tablet across the room.
 */
export function useCreateDevice(
  eventId: string,
  organizationId: string | undefined
): UseMutationResult<DevicePairingCode, Error, ApiBody<'/events/{id}/devices', 'post'>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      unwrap(api.POST('/events/{id}/devices', { params: { path: { id: eventId } }, body })),
    onSuccess: () => {
      if (organizationId) {
        queryClient.invalidateQueries({
          queryKey: ['organizations', organizationId, 'devices'],
        });
      }
    },
  });
}

/** Revoking takes effect on the tablet's next request as `401 token_revoked`. */
export function useRevokeDevice(
  organizationId: string | undefined
): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deviceId) => {
      await api.DELETE('/devices/{deviceId}', { params: { path: { deviceId } } });
    },
    onSuccess: () => {
      if (organizationId) {
        queryClient.invalidateQueries({
          queryKey: ['organizations', organizationId, 'devices'],
        });
      }
    },
  });
}

/**
 * Redeem a pairing code. Unauthenticated — this is the tablet's only way in.
 *
 * The token comes back **once**. Persist it before doing anything else with the
 * response; there is no endpoint that will hand it over a second time.
 */
export function usePairDevice(): UseMutationResult<DevicePaired, Error, string> {
  return useMutation({
    mutationFn: (pairingCode) => unwrap(api.POST('/devices/pair', { body: { pairingCode } })),
  });
}
