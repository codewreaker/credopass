import LoginPage from "../Pages/Login";
import {z} from 'zod'
import { createFileRoute } from "@tanstack/react-router";


export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    // `view` is gone with the email form: Google is the only provider, so there
    // is no second screen to select between.
    // out - true when the user just signed out; shows the goodbye variant.
    out: z.boolean().optional().default(false),
    // redirect - where to return after auth, set by the private-route guard
    // (requireAuth). Honoured by the sign-in watcher on the login page.
    redirect: z.string().optional(),
  }),
  component: LoginPage,
})