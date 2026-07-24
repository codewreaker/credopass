import Analytics from "../Pages/Analytics";
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "../lib/auth-guard";

export const Route = createFileRoute('/analytics')({
  beforeLoad: requireAuth,
  component: Analytics,
})