import CheckInPage from "../../Pages/CheckIn";
import { createFileRoute } from '@tanstack/react-router'

// CheckIn route - Check-in page for specific event
export const Route = createFileRoute('/checkin/$eventId')({
    component: CheckInPage
})