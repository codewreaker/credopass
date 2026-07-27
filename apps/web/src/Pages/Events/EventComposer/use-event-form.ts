/**
 * The event composer's form state.
 *
 * Two fields the old form had are gone, and both for the same reason: the server
 * owns them now.
 *
 *   status           derived from the timestamps. There is no column to set, and
 *                    an event is cancelled or closed through its own endpoint —
 *                    not by picking a value from a dropdown.
 *   organizationId   the tenant comes from `X-Organization-Id`. `POST /events`
 *                    has no such field, so offering one would be a lie about
 *                    where the event was going to land.
 */

import { useForm } from '@tanstack/react-form';
import { toast } from '@credopass/ui/components/sonner';
import * as z from 'zod';
import { useCreateEvent, useUpdateEvent, type Event } from '@credopass/api-client';
import { errorMessage } from '../../../lib/errors';

export interface EventFormValues {
  name: string;
  description: string;
  start: Date | undefined;
  end: Date | undefined;
  location: string;
  capacity: string;
  allowSelfCheckIn: boolean;
}

export const eventFormSchema = z
  .object({
    name: z
      .string()
      .min(3, 'Event name must be at least 3 characters.')
      .max(100, 'Event name must be at most 100 characters.'),
    description: z.string().max(500, 'Description must be at most 500 characters.').default(''),
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

const browserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

/**
 * Maps an event from the API onto form values.
 *
 * `allowSelfCheckIn` is not on `EventSummary` — the list shape does not carry
 * door configuration. It seeds true here, and `PATCH` only sends what the form
 * actually touched, so editing an event never silently flips it.
 */
export const eventToFormValues = (event: Event): EventFormValues => ({
  name: event.name ?? '',
  description: event.description ?? '',
  start: event.startAt ? new Date(event.startAt) : undefined,
  end: event.endAt ? new Date(event.endAt) : undefined,
  location: event.location ?? '',
  capacity: event.capacity != null ? String(event.capacity) : '',
  allowSelfCheckIn: true,
});

interface UseEventFormArgs {
  mode: 'create' | 'edit';
  eventId?: string;
  initialValues?: Partial<EventFormValues>;
  onSaved?: (eventId: string) => void;
}

export function useEventForm({ mode, eventId, initialValues, onSaved }: UseEventFormArgs) {
  const isEditing = mode === 'edit';
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent(eventId ?? '');
  const isMutating = createEvent.isPending || updateEvent.isPending;

  // A new event opens pre-filled with "starting now, running an hour" so the
  // only thing left to type is the name.
  const start = initialValues?.start ?? (isEditing ? undefined : defaultStart());
  const end =
    initialValues?.end ?? (isEditing || !start ? undefined : new Date(start.getTime() + DEFAULT_DURATION_MS));

  const form = useForm({
    defaultValues: {
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      start,
      end,
      location: initialValues?.location ?? '',
      capacity: initialValues?.capacity ?? '',
      allowSelfCheckIn: initialValues?.allowSelfCheckIn ?? true,
    } as EventFormValues,
    validators: {
      // @ts-expect-error — zod schema output is narrower than the form values type
      onChange: eventFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (!value.start) {
        toast.error('Please select a start date');
        return;
      }

      // `endAt` may be omitted entirely on create: the server writes start + 1h.
      // Sending one only when the user set one keeps that default meaningful.
      const body = {
        name: value.name,
        description: value.description || null,
        startAt: value.start.toISOString(),
        endAt: value.end ? value.end.toISOString() : null,
        timezone: browserTimezone(),
        locationText: value.location,
        capacity: value.capacity ? parseInt(value.capacity, 10) : null,
        allowSelfCheckIn: value.allowSelfCheckIn,
      };

      try {
        if (isEditing && eventId) {
          // Moving `startAt` preserves the duration server-side, so the form
          // does not have to recompute the end.
          await updateEvent.mutateAsync(body);
          toast.success('Event updated');
          onSaved?.(eventId);
          return;
        }

        // The id we mint is honoured (D11), which makes create idempotent under
        // a retry rather than producing two events.
        const created = await createEvent.mutateAsync({ id: crypto.randomUUID(), ...body });
        toast.success('Event created');
        onSaved?.(created.id);
      } catch (error) {
        toast.error(errorMessage(error, `Could not ${isEditing ? 'update' : 'create'} the event`));
      }
    },
  });

  return { form, isMutating, isEditing };
}
