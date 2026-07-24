# Next steps — resume plan

Scratch plan for the check-in / event tweaks. Website + favicon work is **done and building**;
the app-side work below is **not started** except one schema edit. Delete this file when finished.

## ✅ Done (this session)
- **Favicons**: added `apps/web/public/credopass.svg` + `apps/website/public/credopass.svg` (lime QR mark);
  removed `vite.svg` and the website `favicon.ico`; both `index.html` files point at `/credopass.svg`.
- **Website `/how-it-works`**:
  - Renamed persona **"The Door Team" → "The Steward"** (id `door-team` → `steward`) in
    `apps/website/src/pages/HowItWorks.tsx`; also updated `README.md` + `apps/website/README.md`.
  - Hero headline **"Four people…" → "Every role. One attendance record"**; subtext now says "steward".
  - Persona hot-links now smooth-scroll (no flash-to-home): `navigate()` in `apps/website/src/App.tsx`
    gained an optional `elementId` arg that scrolls after route mount; nav + hero pills call
    `navigate('/how-it-works', p.id)` with `preventDefault`.
  - Home now **features How-It-Works** where the old "Three steps" section was: 4 clickable persona
    cards (`PERSONAS` is now exported from `HowItWorks.tsx`) + "See how CredoPass works" CTA.
  - `nx build website` passes.

## ⚠️ In progress — finish first
**`packages/lib/src/schemas/tables/events.ts`** already has a new column added:
```ts
allowSelfCheckIn: boolean('allowSelfCheckIn').notNull().default(true),
```
It is additive/safe, but there is **no migration yet** and **nothing downstream reads it**. Either finish
the wiring below or revert the column if descoping.

1. **Generate the migration** (no DB needed for `generate`):
   ```bash
   cd services/core && DATABASE_URL="" npx drizzle-kit generate
   # then apply against the dev DB:
   nx run coreservice:migrate
   ```
   Confirm a new `drizzle/000X_*.sql` + `drizzle/meta` snapshot appear.
2. **Expose it publicly** — `services/core/src/routes/public.ts` → `toPublicEvent()` should return
   `allowSelfCheckIn: event.allowSelfCheckIn ?? true`.
3. **Client type** — add `allowSelfCheckIn: boolean` to `PublicEvent` in
   `apps/web/src/Pages/Events/use-public-event.ts`.
4. **Composer toggle** — add a self-check-in switch to the "Event Options" list in
   `apps/web/src/Pages/Events/EventComposer/event-composer.tsx` (new field in
   `fields/option-fields.tsx`, e.g. a `ToggleRow`); thread `allowSelfCheckIn` through
   `use-event-form.ts` (`EventFormValues`, `eventFormSchema`, `defaultValues`, `eventToFormValues`,
   and the insert/update `eventData`). Default `true`.

## ⬜ Remaining tasks (app = `apps/web`)

### 1. Guest public flow: register → pass → optional self check-in
File: `apps/web/src/Pages/Events/EventView/index.tsx` (`AttendeeSelfServiceDialog`).
- On submit, **always `register`** (attended=false) and show the pass QR — never auto check-in.
- On the pass screen, if `event.allowSelfCheckIn` is true, show a **"Check in now"** button that calls
  `attend(event.id, details, 'checkin', 'manual')` to flip attended=true. If false, show copy like
  "A host will scan your pass to check you in."
- Drop the status-driven `mode`/`attendMode` split for the *initial* action (it's always register now);
  keep the `publicCtaFor` "ended" gating. `usePublicAttend` already supports both modes — no API change.
- The public `POST /public/events/:id/attend` already flips a prior RSVP to attended on `mode:'checkin'`
  (`services/core/src/routes/public.ts`) — no server change needed.

### 2. Check-in naming clarity
- Organiser/kiosk = **"Check in guests"**: `apps/web/src/Pages/CheckIn/*` header/title, the kiosk toggle,
  and the two "Check-in" buttons in `apps/web/src/Pages/Events/index.tsx` (up-next card) +
  `EventView/index.tsx` (`organiserPassPrimary` already says "Check-in Guests" — make wording consistent).
- Attendee/public = **"Check in to event"**: labels in `EventView` `AttendeeSelfServiceDialog` + the
  sticky public CTA (`publicCtaFor`).

### 3. Up-next spotlight card — tappable, remove Details button
File: `apps/web/src/Pages/Events/index.tsx` (the expanded `nextEvent` block, ~L92–178).
- Remove the **"Details"** button (L166–173).
- Make the outer card navigate to `/events/$eventId` on click (add `role="button"`, `tabIndex`,
  `onKeyDown` Enter, `cursor-pointer`).
- Add `e.stopPropagation()` to the inner buttons that must NOT trigger navigation: minimize (L96),
  **Check-in** (L150), **Attendees** (L158).
- Leave the collapsed strip as-is.

### 4. Remove redundant "Copy link" button
File: `EventView/index.tsx` L345–347 — delete the Copy-link `Button` (the Share button already copies as
its fallback). Consider replacing that slot with the **Poster QR** button (task 6).

### 5. `/checkin/:eventId` QR maximise mode (tablet)
File: `apps/web/src/Pages/CheckIn/index.tsx` — display mode already shows the event QR (`GlowingQRCode`,
`shareUrl`). Add a **Maximize** button (lucide `Maximize2`) that opens a full-screen overlay
(`fixed inset-0 z-50 bg-background`) with a very large QR + event name + a close/minimise button. Optionally
call `document.documentElement.requestFullscreen()`. Good for a tablet at the door.

### 6. Share → downloadable QR image (PNG/SVG) for posters
`qrcode.react` is already a web dep. Build a small `EventQrPoster` (co-locate near `EventView`) that opens a
`SheetDialog` with a large QR of `shareUrl` and **Download PNG** / **Download SVG** buttons:
- PNG: render a hidden `<QRCodeCanvas value size={1024} includeMargin/>`, `canvas.toDataURL('image/png')`,
  trigger an `<a download>`.
- SVG: render a hidden `<QRCodeSVG/>`, serialize with `XMLSerializer`, download as a Blob.
Add a "Poster QR" button in the `EventView` pass row (reuse the slot freed by removing Copy link).

### 7. Event image storage — **document as TODO** (do not implement)
The composer already has an `EventImage` picker (`EventComposer/fields/event-image.tsx`) but it's
**preview-only** (comment in `event-composer.tsx` L67–69 confirms: "no cover column yet"). Needs:
- **Schema**: `events.imageUrl text` (+ optional `imageKey`/`imageWidth`/`imageHeight` metadata).
- **Storage**: signed-upload to an S3/Supabase Storage bucket; store only URL + metadata in Postgres.
- **API**: an upload endpoint (or Supabase Storage direct upload) + include `imageUrl` in event payloads.
- **UI**: persist the picked image via upload, then save its URL on the event; render it on
  `EventView` billboard and the event row date-icon slot.
Leave a `// TODO(event-image):` marker at `event-composer.tsx` L67.

### 8. Fix Mapbox disappearing at some widths
File: `apps/web/src/Pages/Events/EventDetails.tsx` L37–38. The map height resolves through a
`Card lg:h-full` → `lg:flex-1` chain that bottoms out at **0** when an ancestor has no definite height, so
the map collapses at `lg`. Give it concrete heights instead:
```tsx
<Card className={`p-2 ${className ?? ''}`} size='sm'>
  <MapWithMarker className="relative z-20 w-full h-[32vh] min-h-60 lg:h-[42vh]" />
```
(Remove `lg:h-full lg:flex lg:flex-col` from the Card; drop `lg:h-auto lg:flex-1 lg:min-h-[40vh]` from the
map.) The `Map` component already has a `ResizeObserver`, so a concrete height is all that's missing.
Note (separate, out of scope): `MapWithMarker` hardcodes NYC markers and ignores the event's real
location — worth geocoding later.

## Verify before done
```bash
nx run web:build          # or nx run web:typecheck
nx run website:build
nx run coreservice:build
```
