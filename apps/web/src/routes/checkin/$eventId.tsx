import CheckInPage from "../../Pages/CheckIn";
import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from "../../lib/auth-guard";

// CheckIn route - Check-in kiosk (organiser only) for a specific event
export const Route = createFileRoute('/checkin/$eventId')({
    beforeLoad: requireAuth,
    component: CheckInPage
})