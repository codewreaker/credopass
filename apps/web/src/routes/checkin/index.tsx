import { createFileRoute } from '@tanstack/react-router'
import CheckInPage from '../../Pages/CheckIn'


export const Route = createFileRoute('/checkin/')({
    component: CheckInPage
})