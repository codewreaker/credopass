import LoginPage from "../Pages/Login";
import {z} from 'zod'
import { createFileRoute } from "@tanstack/react-router";


export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    // `manual` is gone with anonymous sign-in: there is no longer an automatic
    // path to opt out of, so every visitor sees the sign-in options.
    /**
     * Determing which view to show (e.g. a "Log in" nav item). 
     * social - Present social links e.g github, gmail
     * email - type username and password
     */

    view: z.enum(['social', 'email']).catch('social'),
    // out - true when the user just signed out; shows the goodbye variant.
    out: z.boolean().optional().default(false),
    // redirect - where to return after auth, set by the private-route guard
    // (requireAuth). Honoured by the sign-in watcher on the login page.
    redirect: z.string().optional(),
  }),
  component: LoginPage,
})