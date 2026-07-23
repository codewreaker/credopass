import { createFileRoute, redirect } from "@tanstack/react-router";

// Organizations now live inside the Profile page. Keep the old path working
// by redirecting any bookmarks/deep links to /profile.
export const Route = createFileRoute('/organizations')({
  beforeLoad: () => {
    throw redirect({ to: '/profile' });
  },
})
