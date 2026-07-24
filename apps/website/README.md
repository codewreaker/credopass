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

The centerpiece. Each persona (Organizer, Door Team, Walk-in Guest, Regular) is a **pinned horizontal-scroll track**: as you scroll vertically, the panels translate sideways and parallax layers drift at different rates.

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
