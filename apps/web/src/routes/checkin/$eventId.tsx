import CheckInPage from "../../Pages/CheckIn";
import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from "../../lib/auth-guard";

/**
 * The door.
 *
 * One credential: a signed-in account. Whoever is working the entrance holds
 * the `checkin` role, which can read the event and record arrivals and nothing
 * else — see the role matrix in `services/core/src/authz/permissions.ts`.
 *
 * This used to accept a second credential, a `cpd_…` token belonging to a
 * paired tablet, and redirect it home if it was pointed at the wrong event.
 * Device tokens are gone (D24): the role does the same job without a second
 * authentication system to keep correct.
 */
export const Route = createFileRoute('/checkin/$eventId')({
    beforeLoad: requireAuth,
    component: CheckInPage
})
