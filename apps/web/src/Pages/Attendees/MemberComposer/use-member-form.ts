/* eslint-disable no-useless-escape */
/**
 * The attendee composer's form state.
 *
 * The old form asked for a **role on the event** — organizer, co-host, staff,
 * volunteer — and wrote an `event_members` row. That table is gone. Its
 * replacement, `event_grants`, was only for delegating *management* of an event and has since been deleted;
 * it has nothing to do with attending one.
 *
 * So adding someone to an event is two things now, and the difference matters:
 *
 *   POST /people                puts them on the organization's roll
 *   POST /events/{id}/register  signs them up for one event, returning a pass
 *
 * Registering does not check anyone in. An `attendance` row means they turned
 * up, and it cannot be a side effect of filling in this form.
 */

import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import * as z from 'zod';
import { toast } from '@credopass/ui/components/sonner';
import {
  hasProblemCode,
  ProblemCode,
  useCreatePerson,
  useRegisterAttendee,
  useUpdatePerson,
  type Person,
  type PersonRow,
} from '@credopass/api-client';
import { errorMessage } from '../../../lib/errors';

export interface MemberFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
}

export const memberFormSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters.')
    .max(50, 'First name must be at most 50 characters.')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens and apostrophes.'),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters.')
    .max(50, 'Last name must be at most 50 characters.')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens and apostrophes.'),
  email: z
    .string()
    .email('Please enter a valid email address.')
    .max(100, 'Email must be at most 100 characters.')
    .or(z.literal(''))
    .default(''),
  phone: z
    .string()
    .regex(/^[\d\s\-\+\(\)]+$/, 'Phone number can only contain numbers, spaces, hyphens and parentheses.')
    .min(10, 'Phone number must be at least 10 characters.')
    .or(z.literal(''))
    .default(''),
  notes: z.string().max(500, 'Notes must be at most 500 characters.').or(z.literal('')).default(''),
});

/** Maps a person from the API onto form values. */
export const personToFormValues = (person: Person | PersonRow): MemberFormValues => ({
  firstName: person.firstName ?? '',
  lastName: person.lastName ?? '',
  email: person.email ?? '',
  phone: person.phone ?? '',
  notes: 'notes' in person ? (person.notes ?? '') : '',
});

interface UseMemberFormArgs {
  mode: 'create' | 'edit';
  personId?: string;
  /** When set, the new person is also registered onto this event. */
  eventId?: string;
  initialValues?: Partial<MemberFormValues>;
  onSaved?: (personId: string, passUrl: string | null) => void;
}

export function useMemberForm({
  mode,
  personId,
  eventId,
  initialValues,
  onSaved,
}: UseMemberFormArgs) {
  const isEditing = mode === 'edit';
  const [isMutating, setIsMutating] = useState(false);

  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson(personId ?? '');
  const register = useRegisterAttendee(eventId ?? '');

  const form = useForm({
    defaultValues: {
      firstName: initialValues?.firstName ?? '',
      lastName: initialValues?.lastName ?? '',
      email: initialValues?.email ?? '',
      phone: initialValues?.phone ?? '',
      notes: initialValues?.notes ?? '',
    } as MemberFormValues,
    validators: {
      // @ts-expect-error — zod schema output is narrower than the form values type
      onChange: memberFormSchema,
    },
    onSubmit: async ({ value }) => {
      const body = {
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email || null,
        phone: value.phone || null,
        notes: value.notes || null,
      };

      setIsMutating(true);
      try {
        if (isEditing && personId) {
          await updatePerson.mutateAsync(body);
          toast.success('Attendee updated');
          onSaved?.(personId, null);
          return;
        }

        // Our id is honoured, so a retry updates the same person rather than
        // creating a second one.
        const person = await createPerson.mutateAsync({ id: crypto.randomUUID(), ...body });

        if (!eventId) {
          toast.success('Attendee added');
          onSaved?.(person.id, null);
          return;
        }

        // Two calls, deliberately: being on the roll and being signed up for one
        // event are different facts.
        const result = await register.mutateAsync({ personId: person.id });
        toast.success('Added and registered for the event');
        onSaved?.(person.id, result.pass.url);
      } catch (error) {
        toast.error(
          hasProblemCode(error, ProblemCode.EMAIL_TAKEN)
            ? 'Someone with that email is already on this organization.'
            : errorMessage(error, `Could not ${isEditing ? 'update' : 'add'} that attendee`)
        );
      } finally {
        setIsMutating(false);
      }
    },
  });

  return { form, isMutating, isEditing };
}
