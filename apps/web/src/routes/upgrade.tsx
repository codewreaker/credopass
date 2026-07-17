import { createFileRoute } from "@tanstack/react-router";
import UpgradePage from "../Pages/Upgrade";

export const Route = createFileRoute('/upgrade')({
  component: UpgradePage,
});
