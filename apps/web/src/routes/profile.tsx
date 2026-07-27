import { createFileRoute, redirect } from "@tanstack/react-router";

// Profile folded into the Account page. Keep old links working.
export const Route = createFileRoute('/profile')({
  beforeLoad: () => {
    throw redirect({ to: '/account', search: { tab: 'profile' } });
  },
})
