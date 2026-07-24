# CredoPass — Review 2 Implementation Brief

Branch: `feat/ui-rebuild`. Web app only (`apps/web`, `packages/ui`, `packages/lib`).

Obey the existing design language: lime `--primary` billboard heroes on dark layered
surfaces, pill/rounded-full controls, tabular numerals, borderless sharp-corner list
rows, one lime "moment" per page. Match the visual weight of the Luma reference
screenshots but never their palette.

Ground rules that apply to every section below:

- Reuse `SheetDialog` (`packages/ui/src/components/sheet-dialog.tsx`) for any popup
  that contains an input — it bottom-anchors on mobile and tracks the software
  keyboard through `useVisualViewport`. Do not reach for the plain `Dialog`.
- Full forms are standalone pages/routes. Dialogs are only for granular,
  single-value edits opened from a row on that page.
- Data comes from `getCollections()` (`@credopass/api-client/collections`) read via
  `useLiveQuery`. Available collections: `users`, `organizations`, `events`,
  `attendance`, `eventMembers`.
- Every group below should typecheck (`npx tsc -p apps/web/tsconfig.json --noEmit`),
  lint clean, and build (`npx nx build web`).

---

## 1. Event composer — fixes and polish

Files: `apps/web/src/Pages/Events/EventComposer/`

1. **Cover placeholder.** Add an inline SVG image placeholder as the default cover
   at the top of the create/edit composer — a decorative, self-contained SVG (no
   remote asset), styled to the design language. Presentation only for now: there is
   no cover column on `events`, so it must not pretend to be an upload.

2. **Fix the location popup.** The Mapbox autofill inside `LocationField` is not
   usable in the dialog. Diagnose before changing anything — the two likely causes:
   - `@mapbox/search-js-react`'s `AddressAutofill` renders its suggestion listbox in
     a portal on `document.body`, outside the dialog's DOM. base-ui's modal layer
     blocks pointer events / focus outside the popup, and the listbox also sits in a
     different stacking context to the `z-50` sheet.
   - `MAPBOX_ACCESS_TOKEN` resolves from `VITE_MAPBOX_ACCESS_TOKEN`
     (`apps/web/src/config.ts`) and falls back to `''` with only a console warning.
     Confirm it is actually set in the environment you are testing.
   Fix so suggestions render above the sheet and are clickable, and keep the map
   preview centring on the chosen coordinates.

3. **Split date from time.** Restructure the date/time popup so the calendar and the
   time selection are two distinct steps/panels rather than a calendar with a time
   input bolted underneath — follow the Luma screenshots.

4. **Make the date popup fill the sheet.** The calendar is too small. It should
   occupy the popup the way the phone screenshots show: full-width grid, generous
   touch targets, month/year header, `Reset` and a circular confirm in the footer.
   Use the same date element you are sing in the event page which is next to the list of events for reusability


5. **Fix post-create navigation.** Creating an event does not land on the new event.
   Candidate causes, in order of likelihood — verify, don't assume:
   - `useEventForm` navigates to the **client-generated** `crypto.randomUUID()` id,
     but `onInsert` in `packages/api-client/src/collections/events.ts` POSTs to the
     REST API and returns `response.json()`. If the server assigns its own id, that
     route param points at a row that will never exist.
   - `EventDetailPage` renders "Event Not Found" as soon as `isLoading` is false,
     which can fire before the collection has refetched the new row.
   - `getStatus()` in the events `queryFn` rewrites any event whose `startTime` is in
     the past to `completed`. Since new events now default to *now*, they flip to
     `completed` on the very next fetch. Fix this too — it is almost certainly wrong
     for a just-created event.

6. **Responsive width.** The phone layout is right and should not change. On
   tablet/desktop the composer should claim more width and sit more deliberately
   centred — step the max width up at `md`/`lg` instead of staying pinned at the
   mobile column width.

7. **Connect Start to End with a line.** `DateTimeField` renders the two dot markers
   (filled for Start, hollow for End) but nothing joining them. The reference
   screenshots draw a short vertical connector between the two dots, which is what
   makes the pair read as a single span rather than two unrelated rows. Add it — a
   thin line running dot-to-dot, tolerant of the rows changing height. This is the
   same motif reused across the event list in §6.3, so build it in a way that can be
   shared rather than hard-coding it to this one card.



---

## 2. Members — rebuild around events

Files: `apps/web/src/Pages/Members/index.tsx`

The members section exists to answer two questions: *who has attended our past
events* and *who is signed up for an upcoming one*. Redesign the page around that.

- A scope switcher (pill/segmented control) with an **All** option — everyone who has
  ever attended any of your programmes — alongside per-event scopes.
- Ability to select a specific planned event and see the people signed up for it, and
  for a past event, who attended.
- Join `users` against `eventMembers` / `attendance` to derive these lists.
- Distinguish signed-up vs attended vs no-show in the row treatment.
- Keep the approved member-row styling: borderless full-width sharp-corner cards,
  tight `gap-1.5`, trailing meta from tablet up, plain Avatar with no tier ring, and
  no in-page search (the toolbar already provides it).

---

## 3. Add Member — standalone page

Members can only be added *onto an event*, so this is scoped by event.

- Convert the launcher-based `UserForm` into a standalone route, mirroring the event
  composer exactly: one page serving create and edit, granular `SheetDialog` popups
  per field, autofocus the first meaningful field, sensible pre-filled defaults, and
  a sticky full-width rounded-full submit.
- Add an entry point on the events page (an icon on the event row / detail page) that
  opens it with that event already bound.
- Migrate every existing `launchUserForm` call site and delete the old container.

---

## 4. Premium gating

- Create a **premium context provider** exposing a simple boolean (no backend yet —
  wire it to real entitlements later).
- Add a toggle in the **Profile** section that switches premium on and off, so any
  user can be made premium for testing.
- Analytics: leave the first four cards (AVG attendance and the other three) fully
  visible. Everything below them gets a **glassmorphism blur layer** with an upgrade
  button on top when the user is not premium; unblurred when they are.

---

## 5. Charts — migrate to Apache ECharts

Charts render locally but not in the deployed build, and the cause has not been
identifiable. Replace the charting engine outright rather than debug further.

- Swap the base charting library from Recharts to **Apache ECharts** everywhere.
- Recreate the existing charts like-for-like. Current inventory: an `AreaChart`
  sparkline in the hero, and two `BarChart`s (weekly check-ins; monthly mix,
  stacked) — all in `apps/web/src/Pages/Analytics/index.tsx`.
- Keep them wrapped in the shadcn chart API in `@credopass/ui`
  (`packages/ui/src/components/chart.tsx` — `ChartContainer`, `ChartTooltip`,
  `ChartTooltipContent`, `ChartConfig`, `ChartLegend`). Reimplement that wrapper on
  top of ECharts so consumers keep the same props and the `ChartConfig` token/theme
  colour resolution survives.
- If its hard to re-implement the shadcn chart API, have a simple chart wrapper
  for this app that renders charts within a shadcn react-like way so they can exist in a nice panel 
  similar to what we have
- Remove the Recharts dependency once nothing imports it.

---

## 6. Events page — filters and upgrade CTA

Files: `apps/web/src/Pages/Events/index.tsx`,
`packages/lib/src/hooks/use-status-filter.ts`

1. **The action buttons are not a filter.** Today the shortcut/action cards are
   switched on by putting the pseudo-status `'actions'` into `selectedFilters` — the
   same array that holds real event statuses — which also persists it in the filter
   cookie and exposes it as a chip in the filter UI. That is wrong: showing or hiding
   shortcut icons has nothing to do with which events are listed.

   Remove `'actions'` from the filter system entirely — drop it from
   `EventTypeFilters`, `DEFAULT_FILTERS`, `allFilters` and the `ChipFilter` options,
   and delete `toggleActions` from `use-status-filter.ts`. The
   `lucide-fast-forward` button becomes a plain independent toggle owning its own
   (persisted) boolean that simply enables/disables the action buttons. It must never
   affect the event list.

2. **Collapse the status filters to Upcoming / Past.** Five status chips is too many.
   Derive two:
   - **Upcoming** — `scheduled`, `ongoing`
   - **Past** — everything else (`completed`, `cancelled`, `draft`)

   Do this as a derived grouping in the filtering layer only. **Do not modify
   `STATUS_MAPPING`** (`packages/ui/src/components/event-row/index.tsx`) — rows keep
   their existing per-status badge, icon and colour. Only the filter chips collapse.
   Inside the Past group, keep a secondary layer of categorisation so the individual
   statuses are still distinguishable once you're looking at past events (a sub-chip
   row, section headers, or grouped ordering — your call, follow the design
   language). Remember `DEFAULT_FILTERS` and the persisted cookie/IndexedDB values
   currently store raw statuses, so handle migrating or ignoring stale entries.

3. **Trace a connector line between events.** The reference screenshots join the
   Start and End rows with a vertical connector between their two dots, which reads
   as one continuous span (see §1.7). Carry that motif into the event list: run the
   same line between consecutive event rows so the list reads as a timeline. Keep it
   subtle — it should sit behind the rows and never compete with the content.

4. **Move the upgrade CTA into the page.** Remove `UpgradeCTA` from the top bar
   (`apps/web/src/containers/TopNavBar/index.tsx`) and instead surface it as a card
   in the events scroll flow, styled like the "Up next" spotlight so it reads as part
   of the list rather than chrome.
