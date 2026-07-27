import { createFileRoute } from '@tanstack/react-router'
import ResetPasswordPage from '../Pages/ResetPassword'

/**
 * Where a recovery link lands.
 *
 * Supabase puts the recovery token in the URL FRAGMENT, which never reaches the
 * server and is consumed by the client library on load — so there is nothing to
 * validate here and no search params to declare.
 */
export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
})
