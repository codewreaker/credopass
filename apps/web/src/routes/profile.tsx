import { createFileRoute } from "@tanstack/react-router";
import ProfilePage from "../Pages/Profile";

// Profile route - account settings, sign out, and organizations
export const Route = createFileRoute('/profile')({
  component: ProfilePage,
})
