import { createFileRoute } from '@tanstack/react-router'
import OnboardingPage from '../Pages/Onboarding'
import { requireAuth } from '../lib/auth-guard'

/**
 * Where a brand-new account lands. Standalone — no shell, no org switcher:
 * there is no organization to frame it with yet.
 */
export const Route = createFileRoute('/onboarding')({
  beforeLoad: requireAuth,
  component: OnboardingPage,
})
