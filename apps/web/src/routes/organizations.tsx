import { createFileRoute, redirect } from "@tanstack/react-router";

// Organizations folded into the Account page. Keep old links working.
export const Route = createFileRoute('/organizations')({
  beforeLoad: () => {
    throw redirect({ to: '/account', search: { tab: 'organizations' } });
  },
})
