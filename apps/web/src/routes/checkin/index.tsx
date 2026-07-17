import { createFileRoute } from '@tanstack/react-router'
import CheckInSelectorPage from '../../Pages/CheckIn/CheckInSelectorPage'

export const Route = createFileRoute('/checkin/')({
  component: CheckInSelectorPage,
})