import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import CheckoutPage from '../../Pages/Upgrade/Checkout';
import { requireAuth } from '../../lib/auth-guard';

/**
 * The mock checkout. `?plan=` is validated against the same four ids the API
 * accepts; anything else falls back to `pro` rather than rendering a broken
 * screen, and the page still refuses to submit a plan the catalogue doesn't
 * know about.
 */
export const Route = createFileRoute('/upgrade/checkout')({
  beforeLoad: requireAuth,
  validateSearch: z.object({
    plan: z.enum(['free', 'starter', 'pro', 'enterprise']).catch('pro'),
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { plan } = Route.useSearch();
  return <CheckoutPage plan={plan} />;
}
