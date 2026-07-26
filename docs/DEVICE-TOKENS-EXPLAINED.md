# Device tokens, explained

You said you didn't understand the need for this. Fair. Here is the case, and then an honest
account of which parts of it I think are actually earned.

---

## 1. The thing that is physically happening

A church buys a £90 Android tablet. On Sunday morning someone props it on a stand by the door,
opens the kiosk, and walks away. It sits there for three hours with nobody watching it. Anyone
who walks past can touch it. At the end of the service it goes in a drawer in an unlocked room,
or into a volunteer's bag.

Now, what credential was on that tablet before this change?

The kiosk is [`/checkin/$eventId`](../apps/web/src/routes/checkin/$eventId.tsx). It is a normal
route in the console. It is not in `STANDALONE_ROUTES` in
[`__root.tsx`](../apps/web/src/routes/__root.tsx), so it renders inside the full app shell —
left sidebar, org selector, top nav — and its "Back" button navigates to `/events/$eventId`.
It reads data through `getCollections()`, which attaches
`Authorization: Bearer <supabase access token>` from `supabase.auth.getSession()`
([`apps/web/src/supabase.ts:19`](../apps/web/src/supabase.ts)).

So the kiosk does not have a kiosk credential. **It is signed in as a person** — in practice as
you, because you are the one who set the tablet up. Two consequences:

- **Tap "Minimise", or Escape, or the browser back button, and you are in the console.** Events,
  the full attendee roll, analytics, member list, org settings. The maximised billboard is a
  `position: fixed` div, not a security boundary.
- **The Supabase session lives in the tablet's `localStorage`, and it includes a refresh
  token.** Pull that out — USB debugging, a devtools connection, a copied browser profile — and
  you have a credential that renews itself indefinitely from any machine on earth. It does not
  expire while nobody is looking; that is the whole point of a refresh token.

And there was no way to switch off *that one tablet*. The only revocation available was signing
the owner's account out everywhere, or changing their password. Losing a £90 tablet meant an
account-wide event.

The kiosk was, functionally, an unattended terminal holding the owner's login.

---

## 2. What changed

The tablet now holds its own credential instead of borrowing a person's. That credential names
one event, carries an explicit list of three things it may do, expires on a date, and can be
switched off from the console without touching anyone's sign-in. Getting it onto the tablet is a
two-step handshake: an admin generates an eight-character code on the event page, the tablet
types the code in, and the tablet — nobody else — receives the actual token. Nothing else about
how check-in works changes.

---

## 3. What a stolen tablet is worth

The permission list below is taken verbatim from
[`devices.test.ts:224`](../services/core/src/test/integration/devices.test.ts), the test named
*"a stolen tablet can record attendance and NOTHING else"*.

| Permission | Before (owner's session) | After (device token) |
|---|---|---|
| `attendance:record` | ✅ | ✅ |
| `attendance:read` | ✅ | ✅ |
| `event:read` | ✅ | ✅ |
| `event:create` | ✅ | ❌ |
| `event:update` | ✅ | ❌ |
| `event:delete` | ✅ | ❌ |
| `event:cancel` | ✅ | ❌ |
| `person:create` | ✅ | ❌ |
| `person:update` | ✅ | ❌ |
| `person:delete` | ✅ | ❌ |
| `member:read` | ✅ | ❌ |
| `member:invite` | ✅ | ❌ |
| `member:remove` | ✅ | ❌ |
| `org:update` | ✅ | ❌ |
| `org:delete` | ✅ | ❌ |
| `org:billing` | ✅ | ❌ |
| `device:manage` | ✅ | ❌ |
| `analytics:read` | ✅ | ❌ |
| `analytics:export` | ✅ | ❌ |

Three further differences that are not permissions:

- **Blast radius.** Before: every event in the organisation. After: one. A token issued for the
  10am service returns `403 out_of_scope` on any other event.
- **Lifetime.** Before: renews itself forever. After: a fixed `expiresAt`.
- **Revocation.** Before: sign the owner out everywhere. After: one `DELETE`, and the tablet
  gets `401 token_revoked` on its next request. Nobody else notices.

---

## 4. Why a code, and not just "here is your token"

The original plan (§5.7) had `POST /events/{id}/devices` return the bearer token to the admin as
well as at pairing. I deliberately didn't do that, and this is the part most worth understanding.

A bearer token is a long random string that is valid for a week. If you show it to the admin,
the admin now has to get it onto the tablet somehow. Every route they could take makes a copy
that outlives the transfer:

- They can't type it — it's 43 characters of base64. So they copy it, which puts it in the
  clipboard, which on a synced desktop puts it on their phone too.
- They email or Slack it to themselves, so it's now in two mailboxes forever.
- They screenshot it.
- It sits in the response of a request in their browser's network tab and, depending on how the
  UI is built, in their history.

None of those copies get cleaned up, and none of them can be individually revoked. You have
carefully built a credential whose whole selling point is "only the tablet has it", and then
handed six copies to a laptop.

The pairing code avoids this because **it is not worth stealing**. It is eight characters, it
lives for fifteen minutes, it can be used exactly once, and redeeming it gives you nothing the
device row didn't already say. If a volunteer overhears it, they have a few minutes to race a
tablet that is about to claim it, and if they win you can see it (the device shows as `active`
when you didn't pair it) and revoke it in one click. Compare that to overhearing a week-long
token.

The property, stated plainly: **there is exactly one copy of the strong credential, and it is on
the device that uses it.** That is what makes revocation mean something. If you don't know how
many copies exist, "revoked" is a hope, not a fact.

Two supporting details do real work here. The token is stored only as a SHA-256, so a database
dump doesn't yield working credentials. And an unknown code, an expired code and an
already-used code all return the identical 404 — telling them apart would let someone probe for
codes that exist.

---

## 5. Honest assessment

**Was the security urgent? No.** You have no production users. The risk today is exactly zero.
Anyone who says otherwise is selling you something.

**Was it the right moment anyway? Mostly, and for a different reason.** The argument is
architectural, not defensive: a device is a *second kind of caller*, and the auth middleware is
being written right now. Look at
[`caller.ts:67`](../services/core/src/middleware/caller.ts) and `caller.ts:124` — a device takes
a different branch in both `requireCaller` and `requireTenant`, gets its tenant from its own row
rather than a header, and its permissions are the `checkin` role **intersected** with its scope
list. Retrofitting a second caller kind into an authorisation layer once forty routes depend on
its shape is genuinely unpleasant, and it means re-auditing every one of them. Adding it while
there are few is cheap.

**Could the kiosk have shipped on a normal session and this been added later?** Yes. The cost of
deferring would have been: bolting the device branch into two middlewares and `TenantContext`
later, re-testing route authorisation, and writing the kiosk screen twice — once as a console
page, once as a standalone paired app. Perhaps a day or two, against roughly half a day now.
Real, but not catastrophic. "This could have waited" is a defensible position. "This was wrong"
is not.

**What is genuinely over-engineered.** Four things, and I'd cut or fix all of them:

1. **`sweepExpiredPairings` is dead code.** It is called from exactly one place: its own test
   ([`device.ts:315`](../services/core/src/services/device.ts)). Nothing schedules it, and
   `pair()` already refuses an expired code on its own, so the sweep buys nothing but a tidier
   table. It is a function that exists in order to be tested. Delete it, or wire it to a job
   when there is a job.
2. **Org-wide devices (`eventId` NULL) are unreachable.** The only creation endpoint is
   `POST /events/{id}/devices`, which always sets an event. So the nullable column, the
   `if (device.eventId && ...)` guard in `assertEventInScope`, and the "an org-wide device is in
   scope for any of its events" test all cover a path no caller can reach. It's cheap, but it is
   speculative, and it weakens the headline — "one event and no other" is currently conditional
   on a branch nothing takes.
3. **The configurable scope list is more than you need.** Every device gets the same three
   scopes. The `scopes?` request field and the read-only-display test exist for a product
   feature nobody has asked for. In its defence, the array is what makes the intersection in
   `createTenantContext` honest, and the column costs nothing at rest.
4. **`timingSafeEqual` after an indexed hash lookup** is ceremony. Its own comment concedes it
   guards a theoretical collision. Harmless, but it is there to look rigorous rather than to do
   anything.

**One actual defect, while we're here.** `createDevice` selects `events.endAt` and never uses
it. The comment promises "a day past the event, or a week for an org-wide kiosk"; the code
always does seven days. For a Sunday service that means a live credential sitting in a drawer
for six days after it was last needed, which is precisely the exposure the feature exists to
close. Cheap fix, and it matters more than any of the four items above.

**Verdict:** keep it, cut items 1 and 2, fix the expiry. Roughly seventy per cent of what was
built is earned; the rest is me gold-plating, and you were right to ask.

---

## 6. What the UI rewrite must now provide

Strictly required, nothing more:

1. **A pairing screen on the tablet.** A standalone route — *outside* the console shell, unlike
   today's kiosk — with a large eight-character input. Posts to `POST /devices/pair`, stores the
   returned token, and sends it as the bearer from then on. Handles `404` ("that code isn't
   valid") and, on any later request, `401 token_revoked` by dropping the token and returning
   here.
2. **The kiosk screen must leave the console shell.** No sidebar, no org selector, no "Back to
   event" (a paired tablet has no console to go back to). Today's kiosk also loads the entire
   `users` collection to resolve a scanned ticket — a device token has no `person:read`, and
   shouldn't, so **ticket resolution must move server-side**. This is the one change in this
   list that is real work rather than a new screen.
3. **"Set up a door tablet"** on the event page. Creates the device, then shows the code large
   enough to read across a room, with the fifteen-minute countdown and a note that it works
   once.
4. **A device list with a Revoke control**, on the event page or in settings. `GET
   /organizations/{id}/devices` already returns a derived `status` word (`pending` / `active` /
   `revoked` / `expired`), plus `lastUsedAt`, so the UI just renders it. A still-claimable code
   comes back in the list, so "show me that code again" needs no new endpoint.

**One gap to note before you build 3 and 4:** there is no regenerate-code endpoint. If a code
expires before anyone pairs, the device is stranded in `pending` forever and the only recovery
is to create a second device. Either add `POST /devices/{id}/pairing-code`, or make the UI's
"expired" state offer "create a new one" and revoke the old.
