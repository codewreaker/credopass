import LoginPage from "../Pages/Login";
import {z} from 'zod'
import { createFileRoute } from "@tanstack/react-router";


export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    // manual - true prevents auto guest sign in and presents user with sign-in options
    manual: z.boolean().optional().default(true),
    /**
     * Determing which view to show (e.g. a "Log in" nav item). 
     * social - Present social links e.g github, gmail
     * email - type username and password
     */

    view: z.enum(['social', 'email']).catch('social')
  }),
  component: LoginPage,
})