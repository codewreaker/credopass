# `website` — CredoPass Marketing Site

> The public front door at **credopass.com**. A fast, static-feeling Vite + React marketing site that explains the product and funnels people to the app.

**Nx project:** `website` · **Dev port:** `4200`.
**Depends on:** `@credopass/ui`, `@credopass/lib` (theme), `lucide-react`.

---

## Pages

| Path | Page | File |
|------|------|------|
| `/` | Landing page — hero, features, pricing, testimonials, persona journeys. | `src/pages/Home.tsx` |
| `/how-it-works` | **Deep per-persona walkthrough** — horizontal-scrolling, parallax journeys for each type of user, ending in the shared data-flow. | `src/pages/HowItWorks.tsx` |

## Routing

No router dependency. `src/App.tsx` holds a ~30-line History-API router (`usePathname` + `navigate()`), and Vercel rewrites every path to `index.html` (`vercel.json`) so deep links resolve. Link internally with the exported `navigate('/how-it-works')`.

## The `/how-it-works` page

The centerpiece. Each persona (Organizer, Steward, Walk-in Guest, Regular) is a **pinned horizontal-scroll track**: as you scroll vertically, the panels translate sideways and parallax layers drift at different rates.

- `src/components/HorizontalStory.tsx` — the reusable scroll engine. A tall section with a `sticky` viewport; vertical scroll progress (0→1) maps to a horizontal `translate3d` of the track. Honours `prefers-reduced-motion` by collapsing to a plain sideways-scroll strip.
- `src/pages/HowItWorks.tsx` — persona data + panels + the "under the hood" data-flow finale.

## Components

`Home.tsx` uses a `Reveal` scroll-in wrapper and `JourneyFlow.tsx` (a compact three-lane persona diagram). `ImageWithFallback.tsx` guards screenshot loads.

## Commands

```bash
nx run website:serve     # dev → http://localhost:4200
nx run website:build     # production build → dist/
nx run website:preview
```

## Deploy

Vercel (`vercel.json`): SPA fallback rewrite + `/api/*` proxied to `https://api.credopass.com`. Build runs from the repo root via Nx.

---

## `/how-to` — every screen, with real screenshots

A reference page listing every screen in the product: what it is for, what you can do there, and a
screenshot of it. Distinct from `/how-it-works`, which is the narrative sell (four personas, told
as journeys); this one is the index you check when you want to know what a screen does.

**One list drives it.** [`src/pages/how-to/screens.ts`](src/pages/how-to/screens.ts) is read by
both the page and the capture script, so a screen cannot be documented without an image, and an
image cannot go stale without the page noticing. Adding a screen to the product means adding a row
there.

### Re-taking the screenshots

Google is the only sign-in and it will not complete in a headless browser, so the session is
captured once by hand and reused.

```bash
nx run web:serve:remote                 # or web:serve — whichever app you want to photograph
nx run website:shots:login              # opens a window; sign in; it saves the session
nx run website:shots                    # headless, writes public/how-to/*.png
```

- `apps/website/capture.config.json` holds the app URL and the **real ids** the fixture routes need
  (an event, a person, a pass token). Gitignored, and the first run writes you a starter.
- `apps/website/.auth/state.json` holds the saved session. Gitignored — it is a credential.
- Public screens are captured in a **separate anonymous context** on purpose. A public page has to
  be proved to work with no session; shooting it signed in would hide exactly the bug worth
  catching.
- `--only=id,id` captures a subset, `--mobile-only` skips the desktop pass.

**Note on the published images:** the pass and public-event shots are taken from a real event, so
the pass image contains a scannable QR for a live pass. It is a demo event with no real attendees,
but point `capture.config.json` at a seeded local event if you would rather it were not.

`/invitations/$token` has no screenshot, and cannot have one until `NEXT-UI-LIST.md` U6 is fixed —
no invitation link can be recovered to point the capture at.
