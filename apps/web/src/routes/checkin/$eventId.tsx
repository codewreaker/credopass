import CheckInPage from "../../Pages/CheckIn";
import { createFileRoute, redirect } from '@tanstack/react-router'
import { requireAuth } from "../../lib/auth-guard";
import { readDeviceCredential } from "../../lib/device-token";

/**
 * The door. Two credentials reach it: a signed-in account (staff kiosk) or a
 * paired device token (tablet). The guard accepts either — requiring a Supabase
 * session would lock every tablet out of the one screen it exists for.
 */
export const Route = createFileRoute('/checkin/$eventId')({
    beforeLoad: async (ctx) => {
        const device = readDeviceCredential();
        if (!device) return requireAuth(ctx);

        // A device token is scoped to one event. Sending it anywhere else would
        // only earn a 403, so send it home instead.
        if (device.eventId && device.eventId !== ctx.params.eventId) {
            throw redirect({ to: '/checkin/$eventId', params: { eventId: device.eventId } });
        }
    },
    component: CheckInPage
})
