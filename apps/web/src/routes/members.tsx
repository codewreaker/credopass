import MembersPage from "../Pages/Members";
import { createFileRoute } from "@tanstack/react-router";


// Members route - Members management page
export const Route = createFileRoute('/members')({
  component: MembersPage,
})
