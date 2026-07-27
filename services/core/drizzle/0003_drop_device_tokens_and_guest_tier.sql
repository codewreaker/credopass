-- Drop the device tier and the guest tier. docs/API-THIRD-REBUILD.md D20, D24.
--
-- device_tokens: a door tablet is a person holding the `checkin` role now, which
--   already carried exactly these permissions. CASCADE takes the
--   `device_tokens_tenant` RLS policy from 0002 with it.
-- event_grants:  a per-event role map that nothing ever populated, so every
--   grant it was supposed to widen evaluated to false. Deleted rather than
--   wired up, because an authorization surface that silently does nothing is
--   worse than none.
-- accounts.is_guest: unsettable since anonymous sign-in was removed.
-- attendance.checked_in_by_device_id: no device can exist to be recorded.
--   `checked_in_by_account_id` answers "who checked this person in" alone.
--
-- Losing history is not a concern here: the column can only be non-null for a
-- check-in performed by a paired tablet, and pairing has never run outside dev.

DROP TABLE "device_tokens" CASCADE;--> statement-breakpoint
DROP TABLE "event_grants" CASCADE;--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "is_guest";--> statement-breakpoint
ALTER TABLE "attendance" DROP COLUMN "checked_in_by_device_id";--> statement-breakpoint
DROP TYPE "public"."event_role";