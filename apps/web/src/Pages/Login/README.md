# Login route

Drop this whole `login/` folder into your TanStack Router `routes/` directory
(e.g. `apps/web/src/routes/login/`). Files prefixed with `-` are ignored by
the file-based router, so everything for this page lives in one place
without generating extra routes.

```
login/
  index.tsx                        the actual route (/login)
  -components/
    auth-card-shell.tsx
    email-password-form.tsx
    github-button.tsx
    guest-button.tsx
  -lib/
    auth.ts                        thin wrappers over supabase-js calls
    schemas.ts                     zod schema for email/password
    supabase-client.ts             standalone client — see note below
  -hooks/
    use-guest-auto-login.ts
```

## Assumptions I made

- **Route path is `/login`.** The brief said "registration page" but all
  three flows described are login flows, so I built one page that covers
  sign in, sign up, GitHub, and guest, rather than a separate register page.
  Rename the folder/`createFileRoute` path if you want it at `/register` too.
- **`createFileRoute('/login/')`** — adjust the trailing slash / path string
  if your generated route tree expects something different for an `index.tsx`
  inside a directory.
- **Redirect target after auth is `/dashboard`.** Change the `to:` values in
  `guest-button.tsx`, `use-guest-auto-login.ts`, `auth.ts` (GitHub
  `redirectTo`), and `email-password-form.tsx`.
- **`-lib/supabase-client.ts`** creates its own client from
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. If you already have a
  shared client elsewhere in the monorepo, delete this file and point
  `-lib/auth.ts`'s import at that instead.
- **Guest auto-login behavior**: landing on `/login` with no `?manual=true`
  in the URL silently checks for an existing session and, if there isn't
  one, calls `supabase.auth.signInAnonymously()` and redirects — no login
  screen is shown. Add `?manual=true` (e.g. from a "Log in" link) to see the
  actual page with all three options, including an explicit "Continue as
  guest" button.

## Supabase project setup required

- Enable the **GitHub** provider under Authentication → Providers, with a
  GitHub OAuth App configured to redirect back to your Supabase callback URL.
- Enable **Anonymous sign-ins** under Authentication → Settings for the
  guest flow to work.
- If email confirmation is on, sign-up won't return a session immediately —
  the form already handles that by showing a "check your inbox" message.

## Shadcn components used

`card`, `button`, `input`, `label`, `tabs`, `separator` — all imported from
`@credopass/ui/components/*` per your setup.
