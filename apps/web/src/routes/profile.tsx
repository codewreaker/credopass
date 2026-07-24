import { createFileRoute } from "@tanstack/react-router";
import ProfilePage from "../Pages/Profile";
import { requireAuth } from "../lib/auth-guard";

// Profile route - account settings, sign out, and organizations
export const Route = createFileRoute('/profile')({
  beforeLoad: requireAuth,
  component: ProfilePage,
})
