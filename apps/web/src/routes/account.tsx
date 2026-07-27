import { createFileRoute } from "@tanstack/react-router";
import { z } from 'zod';
import AccountPage, { ACCOUNT_TABS } from "../Pages/Account";
import { requireAuth } from "../lib/auth-guard";

/**
 * Replaces `/profile` and `/organizations`. Everything about the caller and the
 * organization they are in — profile, org switching, members, invitations,
 * devices, settings — lives behind one route with a tab in the URL, so any of
 * it can be linked to.
 */
export const Route = createFileRoute('/account')({
  beforeLoad: requireAuth,
  validateSearch: z.object({
    tab: z.enum(ACCOUNT_TABS).catch('profile'),
  }),
  component: AccountPage,
})
