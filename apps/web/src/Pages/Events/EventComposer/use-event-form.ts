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

import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { toast } from '@credopass/ui/components/sonner';
import * as z from 'zod';
import { useCreateEvent, useUpdateEvent, type Event } from '@credopass/api-client';
import { POSTER_TEMPLATES } from '@credopass/lib/schemas/poster-templates';
import { errorMessage } from '../../../lib/errors';

export interface EventFormValues {
  name: string;
  description: string;
  start: Date | undefined;
  end: Date | undefined;
  location: string;
  /** Join link for an online or hybrid event (B3/F16). '' when there is none. */
  meetingUrl: string;
  capacity: string;
  allowSelfCheckIn: boolean;
  /**
   * The poster (F14). An https URL that is saved, a `blob:` preview that is
   * not, or '' for the default illustration.
   */
  coverImageUrl: string;
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
    /**
     * Optional since B3/F16. It was `.min(3)`, which refused online events and
     * events whose venue is not settled yet — while the field's own helper text
     * offered "Offline location or virtual link".
     */
    location: z.string().max(200, 'Location must be at most 200 characters.').default(''),
    meetingUrl: z
      .string()
      .max(2048)
      .refine((v) => {
        if (v.trim() === '') return true;
        try {
          const { protocol } = new URL(v.trim());
          return protocol === 'http:' || protocol === 'https:';
        } catch {
          return false;
        }
      }, 'Enter a full link starting with http:// or https://')
      .default(''),
    capacity: z
      .string()
      .refine((val) => !val || (!isNaN(Number(val)) && Number(val) > 0), 'Capacity must be a positive number.')
      .default(''),
    allowSelfCheckIn: z.boolean().default(true),
    // Not validated beyond a length cap here: the picker only ever sets a
    // vetted https URL or a blob preview, and the API re-checks the protocol
    // because a client-side rule is not a boundary.
    coverImageUrl: z.string().max(2048).default(''),
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

/** Maps an event from the API onto form values. */
export const eventToFormValues = (event: Event): EventFormValues => ({
  name: event.name ?? '',
  description: event.description ?? '',
  start: event.startAt ? new Date(event.startAt) : undefined,
  end: event.endAt ? new Date(event.endAt) : undefined,
  location: event.location ?? '',
  meetingUrl: event.meetingUrl ?? '',
  capacity: event.capacity != null ? String(event.capacity) : '',
  allowSelfCheckIn: event.allowSelfCheckIn,
  coverImageUrl: event.coverImageUrl ?? '',
});

interface UseEventFormArgs {
  mode: 'create' | 'edit';
  eventId?: string;
  initialValues?: Partial<EventFormValues>;
  onSaved?: (eventId: string) => void;
}

export function useEventForm({ mode, eventId, initialValues, onSaved }: UseEventFormArgs) {
  const isEditing = mode === 'edit';
  const [initialPoster] = useState(
    () => POSTER_TEMPLATES[Math.floor(Math.random() * POSTER_TEMPLATES.length)].path
  );
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
      meetingUrl: initialValues?.meetingUrl ?? '',
      capacity: initialValues?.capacity ?? '',
      allowSelfCheckIn: initialValues?.allowSelfCheckIn ?? true,
      // A new event starts with a poster already on it.
      //
      // The slot used to open empty and almost always stayed that way: the
      // only ways to fill it were a file or an https URL, and someone making
      // an event on their phone has neither to hand. Starting from artwork
      // makes "change it" the decision instead of "find one", and an event
      // with a poster is the difference between an invitation that reads as a
      // flyer and one that reads as a naked QR code.
      //
      // Rotated rather than fixed, so a host's events do not all look
      // identical, and chosen once per composer mount rather than per render.
      // Editing never substitutes one: a blank cover on an existing event is a
      // choice its organiser made.
      coverImageUrl: initialValues?.coverImageUrl ?? (isEditing ? '' : initialPoster),
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
        // Blank means absent. The API coerces '' to NULL so there is one
        // representation of "no location" in the database (B3/F16).
        locationText: value.location.trim() || null,
        meetingUrl: value.meetingUrl.trim() || null,
        capacity: value.capacity ? parseInt(value.capacity, 10) : null,
        allowSelfCheckIn: value.allowSelfCheckIn,
        // Whatever the picker produced: a stored asset URL, or a pasted
        // https link. It never holds a `blob:` preview any more — the upload
        // completes before the form sees a value (F15).
        coverImageUrl: value.coverImageUrl || null,
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
