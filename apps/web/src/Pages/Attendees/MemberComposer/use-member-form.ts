/* eslint-disable no-useless-escape */
import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import * as z from 'zod';
import { toast } from '@credopass/ui/components/sonner';
import { getCollections, resolvePersistedUserId } from '@credopass/api-client/collections';
import type { EventRole, UserType } from '@credopass/lib/schemas';

export interface MemberFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Role on the event this member is being added to. */
  role: EventRole;
}

export const ROLE_OPTIONS: { value: EventRole; label: string; description: string }[] = [
  { value: 'organizer', label: 'Organizer', description: 'Full control of the event' },
  { value: 'co-host', label: 'Co-host', description: 'Edit details and check people in' },
  { value: 'staff', label: 'Staff', description: 'Check attendees in' },
  { value: 'volunteer', label: 'Volunteer', description: 'Limited check-in' },
];

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
    .max(100, 'Email must be at most 100 characters.'),
  phone: z
    .string()
    .regex(/^[\d\s\-\+\(\)]+$/, 'Phone number can only contain numbers, spaces, hyphens and parentheses.')
    .min(10, 'Phone number must be at least 10 characters.')
    .or(z.literal(''))
    .default(''),
  role: z.enum(['organizer', 'co-host', 'staff', 'volunteer'] as const),
});

/** Maps a persisted user onto form values. */
export const userToFormValues = (user: UserType, role: EventRole = 'staff'): MemberFormValues => ({
  firstName: user.firstName ?? '',
  lastName: user.lastName ?? '',
  email: user.email ?? '',
  phone: user.phone ?? '',
  role,
});

interface UseMemberFormArgs {
  mode: 'create' | 'edit';
  userId?: string;
  /** The event this member is scoped to — members only exist on an event. */
  eventId?: string;
  initialValues?: Partial<MemberFormValues>;
  onSaved?: (userId: string) => void;
}

export function useMemberForm({ mode, userId, eventId, initialValues, onSaved }: UseMemberFormArgs) {
  const [isMutating, setIsMutating] = useState(false);
  const isEditing = mode === 'edit';

  const form = useForm({
    defaultValues: {
      firstName: initialValues?.firstName ?? '',
      lastName: initialValues?.lastName ?? '',
      email: initialValues?.email ?? '',
      phone: initialValues?.phone ?? '',
      // Most people added to an event are there to check others in.
      role: (initialValues?.role ?? 'staff') as EventRole,
    } as MemberFormValues,
    validators: {
      // @ts-expect-error — zod schema output is narrower than the form values type
      onChange: memberFormSchema,
    },
    onSubmit: async ({ value }) => {
      const { users: userCollection, eventMembers: eventMemberCollection } = getCollections();
      setIsMutating(true);
      const now = new Date();
      const userData = {
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
        phone: value.phone || null,
      };

      try {
        if (isEditing && userId) {
          const tx = userCollection.update(userId, (draft) => {
            Object.assign(draft, userData, { updatedAt: now });
          });
          await tx.isPersisted.promise;

          if (eventId) await syncEventRole(eventId, userId, value.role);

          toast.success('Member updated!');
          onSaved?.(userId);
          return;
        }

        const optimisticId = crypto.randomUUID();
        const tx = userCollection.insert({
          ...userData,
          id: optimisticId,
          createdAt: now,
          updatedAt: now,
        });
        await tx.isPersisted.promise;

        // The server mints its own id, so the optimistic one is not a usable
        // foreign key — resolve the persisted id before linking to the event.
        const persistedId = resolvePersistedUserId(optimisticId);

        if (eventId) {
          const membership = eventMemberCollection.insert({
            id: crypto.randomUUID(),
            eventId,
            userId: persistedId,
            role: value.role,
            createdAt: now,
            updatedAt: now,
          });
          await membership.isPersisted.promise;
        }

        toast.success(eventId ? 'Member added to the event!' : 'Member added!');
        onSaved?.(persistedId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'An unexpected error occurred.');
      } finally {
        setIsMutating(false);
      }
    },
  });

  return { form, isMutating, isEditing };
}

/** Create or update this user's membership row for the event. */
async function syncEventRole(eventId: string, userId: string, role: EventRole) {
  const { eventMembers: eventMemberCollection } = getCollections();
  const existing = eventMemberCollection.toArray.find(
    (m) => m.eventId === eventId && m.userId === userId
  );

  const now = new Date();
  const tx = existing
    ? eventMemberCollection.update(existing.id, (draft) => {
        draft.role = role;
        draft.updatedAt = now;
      })
    : eventMemberCollection.insert({
        id: crypto.randomUUID(),
        eventId,
        userId,
        role,
        createdAt: now,
        updatedAt: now,
      });

  await tx.isPersisted.promise;
}
