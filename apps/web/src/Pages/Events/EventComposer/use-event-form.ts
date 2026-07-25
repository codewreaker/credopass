import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { toast } from '@credopass/ui/components/sonner';
import * as z from 'zod';
import { getCollections, resolvePersistedEventId } from '@credopass/api-client/collections';
import type { EventStatus, EventType } from '@credopass/lib/schemas';
import { useOrganizationStore } from '@credopass/lib/stores';

export interface EventFormValues {
  name: string;
  description: string;
  status: EventStatus;
  start: Date | undefined;
  end: Date | undefined;
  location: string;
  capacity: string;
  organizationId: string;
  allowSelfCheckIn: boolean;
}

export const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const eventFormSchema = z
  .object({
    name: z
      .string()
      .min(3, 'Event name must be at least 3 characters.')
      .max(100, 'Event name must be at most 100 characters.'),
    description: z.string().max(500, 'Description must be at most 500 characters.').default(''),
    status: z.enum(['draft', 'scheduled', 'ongoing', 'completed', 'cancelled'] as const),
    start: z.date({ message: 'Start date/time is required.' }),
    end: z.date().optional(),
    location: z
      .string()
      .min(3, 'Location must be at least 3 characters.')
      .max(200, 'Location must be at most 200 characters.'),
    capacity: z
      .string()
      .refine((val) => !val || (!isNaN(Number(val)) && Number(val) > 0), 'Capacity must be a positive number.')
      .default(''),
    organizationId: z.string().min(1, 'Organization is required.'),
    allowSelfCheckIn: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.start && data.end && data.end.getTime() <= data.start.getTime()) {
      ctx.addIssue({ code: 'custom', message: 'End time must be after start time.', path: ['end'] });
    }
  });

/** Now with seconds stripped — a start time of 14:32:07 reads as noise. */
export const defaultStart = () => {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
};

export const DEFAULT_DURATION_MS = 60 * 60 * 1000;

/** Maps a persisted event onto form values. */
export const eventToFormValues = (event: EventType): EventFormValues => ({
  name: event.name ?? '',
  description: event.description ?? '',
  status: event.status,
  // Collections synced from Supabase (PostgREST) can surface timestamps as ISO
  // strings on the initial read, so coerce rather than relying on instanceof.
  start: event.startTime ? new Date(event.startTime) : undefined,
  end: event.endTime ? new Date(event.endTime) : undefined,
  location: event.location ?? '',
  capacity: event.capacity != null ? String(event.capacity) : '',
  organizationId: event.organizationId ?? '',
  allowSelfCheckIn: event.allowSelfCheckIn ?? true,
});

interface UseEventFormArgs {
  mode: 'create' | 'edit';
  eventId?: string;
  initialValues?: Partial<EventFormValues>;
  onSaved?: (eventId: string) => void;
}

export function useEventForm({ mode, eventId, initialValues, onSaved }: UseEventFormArgs) {
  const [isMutating, setIsMutating] = useState(false);
  const { activeOrganizationId } = useOrganizationStore();
  const isEditing = mode === 'edit';

  // A new event opens pre-filled with "starting now, running an hour" so the
  // only thing left to type is the name.
  const start = initialValues?.start ?? (isEditing ? undefined : defaultStart());
  const end =
    initialValues?.end ?? (isEditing || !start ? undefined : new Date(start.getTime() + DEFAULT_DURATION_MS));

  const form = useForm({
    defaultValues: {
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      status: (initialValues?.status ?? 'scheduled') as EventStatus,
      start,
      end,
      location: initialValues?.location ?? '',
      capacity: initialValues?.capacity ?? '',
      organizationId: initialValues?.organizationId || activeOrganizationId || '',
      allowSelfCheckIn: initialValues?.allowSelfCheckIn ?? true,
    } as EventFormValues,
    validators: {
      // @ts-expect-error — zod schema output is narrower than the form values type
      onChange: eventFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (!value.organizationId) {
        toast.error('Please select an organization first');
        return;
      }
      if (!value.start) {
        toast.error('Please select a start date');
        return;
      }

      const { events: eventCollection } = getCollections();
      setIsMutating(true);
      const now = new Date();
      const eventData = {
        name: value.name,
        description: value.description || null,
        status: isEditing ? value.status : ('scheduled' as EventStatus),
        startTime: value.start,
        endTime: value.end ?? new Date(value.start.getTime() + DEFAULT_DURATION_MS),
        location: value.location,
        capacity: value.capacity ? parseInt(value.capacity, 10) : null,
        organizationId: value.organizationId,
        allowSelfCheckIn: value.allowSelfCheckIn,
      };

      try {
        const id = isEditing && eventId ? eventId : crypto.randomUUID();

        const tx =
          isEditing && eventId
            ? eventCollection.update(eventId, (draft) => {
                Object.assign(draft, eventData, { updatedAt: now });
              })
            : eventCollection.insert({
                ...eventData,
                id,
                checkInMethods: ['qr', 'manual'],
                requireCheckOut: false,
                deletedAt: null,
                createdAt: now,
                updatedAt: now,
              });

        await tx.isPersisted.promise;
        toast.success(isEditing ? 'Event updated!' : 'Event created!');
        // On create the server mints its own id and discards ours, so `id` is
        // only an optimistic key — resolve the persisted one before navigating.
        onSaved?.(isEditing ? id : resolvePersistedEventId(id));
      } catch (error) {
        // TanStack DB rejects with whatever the mutation handler threw, which is
        // not always an `Error` — and an `Error` with a blank message would
        // toast an empty string. Only trust a message that has content.
        const message =
          error instanceof Error && error.message
            ? error.message
            : typeof error === 'string' && error
              ? error
              : `Could not ${isEditing ? 'update' : 'create'} the event. Please try again.`;
        console.error('[event-form] save failed', error);
        toast.error(message);
      } finally {
        setIsMutating(false);
      }
    },
  });

  return { form, isMutating, isEditing };
}
