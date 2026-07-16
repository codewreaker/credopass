import { createFileRoute } from "@tanstack/react-router";
import OrganizationsPage from "../Pages/Organizations";

// Organizations route - Manage organizations
export const Route = createFileRoute('/organizations')({
  component: OrganizationsPage,
})