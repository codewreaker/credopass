import LoginPage from "../Pages/Login";
import {z} from 'zod'
import { createFileRoute } from "@tanstack/react-router";


export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    // manual - true prevents auto guest sign in and presents user with sign-in options.
    // Defaults to false so first-time visitors get the silent guest sign-in;
    // "Log in" links opt into the form with ?manual=true.
    manual: z.boolean().optional().default(false),
    /**
     * Determing which view to show (e.g. a "Log in" nav item). 
     * social - Present social links e.g github, gmail
     * email - type username and password
     */

    view: z.enum(['social', 'email']).catch('social')
  }),
  component: LoginPage,
})