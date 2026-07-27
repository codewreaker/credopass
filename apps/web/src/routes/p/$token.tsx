import { createFileRoute } from '@tanstack/react-router'
import PassPage from '../../Pages/Pass'

/**
 * The pass. Bearer scope: the token in the URL *is* the credential, so this
 * route deliberately has no auth guard — asking someone to sign in to read a
 * pass they already hold would make the link useless.
 */
export const Route = createFileRoute('/p/$token')({
  component: PassPage,
})
