import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import PairDevicePage from '../../Pages/CheckIn/PairDevicePage'

/**
 * Deliberately unauthenticated. A tablet has no account — the pairing code is
 * the whole credential, and `POST /devices/pair` is the only route it can reach
 * before it has a token. Static path, so it wins over `$eventId`.
 */
export const Route = createFileRoute('/checkin/pair')({
  validateSearch: z.object({
    // Set when a revoked device is bounced here, so the page explains why
    // rather than showing a bare form.
    revoked: z.boolean().optional().default(false),
  }),
  component: PairDevicePage,
})
