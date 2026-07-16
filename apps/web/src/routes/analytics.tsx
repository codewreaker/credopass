import Analytics from "../Pages/Analytics";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute('/analytics')({
  component: Analytics,
})