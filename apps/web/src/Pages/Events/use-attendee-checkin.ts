import { useCallback, useState } from 'react';
import { getCollections, resolvePersistedUserId } from '@credopass/api-client/collections';
import type { EventType } from '@credopass/lib/schemas';
import { toast } from '@credopass/ui/components/sonner';

export interface CheckInDetails {
  firstName: string;
  lastName: string;
  email: string;
}

export interface CheckInResult {
  userId: string;
  /** True when this person already had an attendance row for the event. */
  alreadyCheckedIn: boolean;
}

/**
 * Self-service attendee check-in, wired to the real attendance API.
 *
 * Finds (by email) or creates a `users` row, then records an `attendance` row
 * for the event. Reused by the public event page and the kiosk's manual/scan
 * paths. The org id is denormalised from the event, matching the attendance
 * table's shape.
 */
export function useAttendeeCheckIn() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const checkIn = useCallback(
    async (
      event: EventType,
      details: CheckInDetails,
      method: 'qr' | 'manual' | 'external_auth' = 'manual'
    ): Promise<CheckInResult | null> => {
      const { users: userCollection, attendance: attendanceCollection } = getCollections();
      setIsSubmitting(true);
      const now = new Date();
      const email = details.email.trim().toLowerCase();

      try {
        // Find an existing user by email, else create one.
        const existing = userCollection.toArray.find((u) => u.email?.toLowerCase() === email);
        let userId = existing?.id;

        if (!userId) {
          const optimisticId = crypto.randomUUID();
          const tx = userCollection.insert({
            id: optimisticId,
            firstName: details.firstName.trim(),
            lastName: details.lastName.trim(),
            email: details.email.trim(),
            phone: null,
            createdAt: now,
            updatedAt: now,
          });
          await tx.isPersisted.promise;
          // The server assigns its own id — resolve it before the FK write.
          userId = resolvePersistedUserId(optimisticId);
        }

        // Don't double-record — one attendance row per (event, patron).
        const already = attendanceCollection.toArray.find(
          (a) => a.eventId === event.id && a.patronId === userId
        );
        if (already) {
          return { userId, alreadyCheckedIn: true };
        }

        const tx = attendanceCollection.insert({
          id: crypto.randomUUID(),
          organizationId: event.organizationId,
          eventId: event.id,
          patronId: userId,
          attended: true,
          checkInTime: now,
          checkOutTime: null,
          checkInMethod: method,
          notes: null,
        });
        await tx.isPersisted.promise;

        return { userId, alreadyCheckedIn: false };
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Check-in failed. Please try again.');
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return { checkIn, isSubmitting };
}
