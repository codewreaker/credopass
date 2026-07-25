# Next steps — resume plan

Working scratchpad. The original check-in / event tweak list is **done**; what remains is the bigger
architectural work, which now has proper homes:

- 📋 **[docs/MVP-READINESS.md](docs/MVP-READINESS.md)** — forensic state of the app and distance to MVP.
- 🔐 **[docs/MULTI-TENANCY.md](docs/MULTI-TENANCY.md)** — the per-user / per-org refactor. **The one P0.**

---

## ✅ Done

**Earlier session** — favicons; website `/how-it-works` ("The Steward" rename, new hero, smooth-scroll
persona deep-links, home features How-It-Works).

**This session:**

- **`allowSelfCheckIn` fully wired** — migration `0002_happy_paladin.sql` generated **and applied to the
  remote Supabase instance**; exposed via `toPublicEvent()`; on `PublicEvent`; composer toggle live.
- **Create-event fixed.** Three compounding causes: the column was missing from the DB (no migration); the
  error chain turned any server error into the literal string `"undefined"`
  (`handleAPIErrors` read one shape, the server returned a raw `Error` that `JSON.stringify` flattens to
  `{}`); and `capacity` used `.nullable()` in the insert schema, which in Zod still *requires* the key.
- **Guest flow** — always register → pass → "Check in to event" only when `allowSelfCheckIn`.
- **Naming** — organiser "Check in guests" vs attendee "Check in to event".
- **Up-next card** tappable; Details button removed; inner buttons `stopPropagation`.
- **Copy link removed**; slot now holds **Poster QR** (PNG/SVG download at 1024px).
- **Kiosk maximise** — branded CredoPass billboard (lime panel, rings, logo lockup), event details as
  chips, rotating lime glow ring on a glass panel, cover-image slot reserved. Fills the *app window* only.
- **Map fixed** — `MapWithMarker` no longer hard-codes three NYC landmarks; it pins the event's real
  geocoded location. `LocationField` no longer keeps the previous pick's pin when reopened.
- **`drizzle.config.ts`** no longer logs the DB password.
- **CLAUDE.md** — `bun start` in the terminal is now the documented way to run the stack.

---

## ⬜ Remaining

### P0 — tenancy
See **[docs/MULTI-TENANCY.md](docs/MULTI-TENANCY.md)** for the full plan. Summary of the ordering, because
the order is load-bearing:

1. **Phase 0 — identity.** `users.authId` → `auth.uid()`, backfilled by email, kept current on sign-in.
   Nothing else is expressible until this exists.
2. **Phase 1 — server-side scoping.** Resolve the caller in middleware; make the CRUD factory scope by
   membership and fail closed on undeclared tables.
3. **Phase 2 — real RLS.** Replace `rls_dev_permissive.sql`; revoke `anon`.
4. **Phase 3 — onboarding.** First-run org creation; **delete the `organizations[0]` fallback in
   `OrgSelector`** — that line is what makes everyone share one identity.
5. **Phase 4 — hygiene.** Rotate the committed credentials, stop gitignoring `**/drizzle/`, add a local
   Postgres.

### P1
- **Event images** — `TODO(event-image)` in `event-composer.tsx`: `imageUrl` column, bucket + signed
  upload, payload plumbing, then render on the EventView billboard, event rows, and the kiosk cover slot
  (already reserved — a one-line change to `coverUrl` in `CheckIn/index.tsx`).
- **Real analytics** — `services/core/src/analytics/` is deterministic fiction behind a real contract.
- **Tests** — one 133-line API file today. The check-in flow deserves coverage first.
- **Dev CORS robustness** — a hand-rolled `bun src/index.ts` (no `NODE_ENV`) takes the production CORS
  branch and blocks `localhost:5000`. Either add the Vite proxy `apps/web/.env` already claims exists, or
  make the origin list env-driven.
- **Pre-existing lint error** — `use-public-event.ts:49`, setState in an effect.

---

Delete this file once the P0 phases have their own tracking.
