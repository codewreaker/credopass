# Recurring events — paused, and what it will take to do properly

> **Status: PAUSED on 2026-11-07, deliberately, the same day it was built.**
>
> The implementation was removed. The **UI is still there** and shows an "in development" notice
> when you pick a pattern, because the design is right and worth keeping in front of us.
>
> This file is the whole reason the pause is safe: it carries what was learned, what was wrong,
> and what the next attempt has to handle. **Read all of §2 before writing a line of it.**

---

## 1. Why it was paused

Not because the arithmetic was wrong — it was tested, including DST — but because an attendance
product that loses an event is worse than one that never offered to repeat it, and two of the
gaps were about a programme going wrong **quietly, after creation**:

| | What | Why it is disqualifying |
|---|---|---|
| **R-1** | A series materialised at most 104 occurrences and then stopped. No top-up job, and nothing in the product mentioned it after creation. | "Every Sunday until 2030" silently became two years. A church finds the calendar empty one week and nobody is told. |
| **R-2** | No way to edit or cancel a whole programme. | One tap created 104 rows; undoing it was 104 actions — and `DELETE /events/{id}` returns 409 once anyone has registered, so the fallback was cancelling each by hand. |
| **R-3** | The series was reckoned in the **browser's** timezone. | An organiser creating a London programme while travelling pinned it to wherever they were standing. `organizations.timezone` exists for this and was not read. |

And two defects that only surfaced when the behaviour was probed rather than assumed — both fixed
before the pause, both worth knowing because the next version can reintroduce them:

- **The count shown before committing was wrong by 3×.** The composer approximated occurrences as
  `span / averageMonthLength`; a monthly series on a *fifth* weekday skips most months, so it
  promised ~22 events and the server wrote 8.
- **A long sparse monthly series truncated silently.** The step loop ran out before the end date
  because a fifth-weekday pattern only occurs ~5 times a year.

**The pattern in all five: the system quietly produced fewer events than the organiser asked for.**
That is the failure mode to design against, and it is the bar for un-pausing.

---

## 2. The edge cases. All of them.

### 2.1 Time zones and DST — the ones that actually bite

1. **A recurrence is wall-clock, not an interval.** "Every Sunday at 10am" means 10am *local*.
   Across a DST boundary that is a different UTC instant — 10:00 Europe/London is 10:00Z in
   January and 09:00Z in July. **`startAt + n × 7 × 86400000` is wrong** and moves a service by an
   hour twice a year, in opposite directions. Advance the *calendar*, then resolve to an instant.
2. **Non-existent wall times (spring forward).** On 29 March 2026 the London clock goes
   01:00 → 02:00, so **01:30 does not exist**. A 01:30 weekly event must still produce an
   occurrence that week. Decide explicitly: roll forward (02:30), roll back (00:30), or reject.
   *The old code rolled forward.* Never drop the occurrence.
3. **Ambiguous wall times (clocks going back).** On 25 October 2026, 01:30 happens **twice**.
   Pick first or second occurrence deliberately and write it down. Produce exactly one event, not
   two, and not zero.
4. **An event that spans the boundary.** 23:00–01:00 on a transition night is 1h or 3h long in
   real time. Decide whether duration or wall-clock end time is preserved. *The old code preserved
   duration*, so the clock end stayed 01:00.
5. **Which timezone is authoritative** — the organisation's, the event's, or the browser's? (R-3.)
   Store it on the series and show it in the UI, because the organiser cannot otherwise tell.
6. **Southern-hemisphere and half-hour zones.** Australia/Lord_Howe shifts by **30 minutes**.
   Pacific/Chatham is +12:45. Anything assuming whole-hour offsets is wrong.
7. **Zones that change their rules.** Governments move DST dates with months of notice; the IANA
   database updates, and **already-materialised rows do not**. Decide whether a stored occurrence
   is a promise or a projection.

### 2.2 The recurrence pattern itself

8. **Monthly means two different things.** "The 8th" vs "the second Sunday". A congregation meets
   on a weekday, so by-weekday is usually right — but then:
9. **"The fifth Sunday" barely exists.** Most months have no fifth week. Skipping is honest but
   produces a surprising sparse series; nudging to the fourth invents events nobody asked for.
   **"Last Sunday of the month" is what most people actually mean** and was never offered.
10. **Monthly on the 29th/30th/31st.** February. Clamp, skip, or roll — pick one.
11. **Yearly on 29 February.** Only exists every four years. *The old code clamped to the 28th.*
12. **Week-start conventions.** ISO weeks start Monday; the US starts Sunday. Matters for
    "every 2 weeks" alignment and for any BYWEEKNO rule.
13. **Exceptions (`EXDATE`).** "Every Sunday except Christmas." Not supported at all. Any real
    programme needs it.
14. **Moving one occurrence.** A single week shifts to a different hall or time. The row must
    detach from the pattern without detaching from the series.

### 2.3 Lifecycle — the R-1/R-2 territory

15. **The horizon.** Materialising is right (see §3) but finite. There must be a top-up job **and**
    the end must be visible in the product, not just at creation.
16. **Editing the series.** "This event" / "this and all future" / "all events" — and what happens
    to occurrences that already have attendance. **An occurrence with attendance must never be
    deleted or rewritten silently.**
17. **Cancelling the series.** Everyone holding a pass for a cancelled occurrence needs to resolve
    to something truthful; passes are the only copy, since there is no email (D18).
18. **Changing the pattern after creation.** Almost certainly "end this series, start a new one"
    rather than mutating 104 rows.
19. **Deleting the series row.** Must not cascade — the occurrences carry the attendance, which is
    the thing this product exists to keep. (The current FK is already `ON DELETE SET NULL`.)
20. **Capacity, codes and passes are per occurrence.** Confirm that is intended; it is a lot of
    short codes.
21. **Creation cost.** 104 occurrences meant 104 short-code queries before the transaction. Slow
    enough to risk a request timeout; batch it.
22. **Idempotency.** A retried create must not produce a second series. The client-supplied id
    (D11) covered the first occurrence only.

### 2.4 What the organiser sees

23. **The count must be exact, never estimated** — see the 3× lie above. If the UI shows a number,
    it must come from the same code the server runs.
24. **Say when it ends**, in words, before and after creation.
25. **Show the timezone** the pattern is reckoned in.
26. **Make undo proportionate to create.** One tap in, one tap out.

---

## 3. Keep this decision: materialise, don't compute

**D40 stands.** Store the rule for the record; write the occurrences as real `events` rows.

Everything in this product hangs off `events.id` — `attendance` is unique on
`(event_id, person_id)`, `passes` on `(event_id, person_id) WHERE revoked_at IS NULL`, plus
capacity, the short code and check-in state. A computed occurrence has no id, so the first time
anyone checks in to "the third Sunday" there is nothing to write the row against, and an id
invented at check-in time would differ between two doors. Luma, Eventbrite and Google Calendar all
materialise for the same reason.

A library should generate the **dates**. It should not own the rows.

---

## 4. Libraries worth using

Do not hand-roll the date arithmetic again. It was ~200 lines and 102 tests to cover a fraction of
§2.1.

### Recommended: Temporal for the time math, `rrule` only for the RFC 5545 string

**[`temporal-polyfill`](https://www.npmjs.com/package/temporal-polyfill)** — the TC39 Temporal API.
`Temporal.ZonedDateTime` is the only widely available primitive that models "a wall-clock time in
an IANA zone" as a first-class thing, which is exactly what a recurrence is. Crucially it makes the
hard cases **explicit rather than accidental**:

```ts
// The ambiguity in §2.1(2) and (3) becomes a parameter you must choose,
// not a behaviour you discover in production.
zdt.with({ day: 29 }, { disambiguation: 'compatible' })  // or 'earlier' | 'later' | 'reject'
```

It also gets `.add({ weeks: 1 })` right across DST by design — calendar arithmetic, not
milliseconds — and handles half-hour zones and 29 February without special cases.

**[`rrule`](https://www.npmjs.com/package/rrule)** — use it to **parse and serialise** RFC 5545
strings (`FREQ=WEEKLY;BYDAY=SU;UNTIL=…`), which is worth having for interoperability and ICS
export. Be careful using it to *generate* dates: it works in UTC or floating time and its
timezone handling is a known sharp edge — the usual advice is to expand in floating time and
convert each result yourself, which is where Temporal comes back in.

### Alternatives, honestly

| Library | Worth considering because | Watch out for |
|---|---|---|
| **[`rschedule`](https://gitlab.com/john.carroll.p/rschedule)** | Purpose-built for recurrence with `EXDATE`/`RDATE` and set operations — covers §2.2(13) out of the box. Pluggable Luxon/date-fns adapters. | Smaller community; check it is still maintained before adopting. |
| **[`luxon`](https://moment.github.io/luxon/)** | Mature, IANA-aware, `DateTime.plus({ weeks: 1 })` is calendar-correct. A safe, boring choice if Temporal feels early. | Bundle size; and it is a parallel date model to whatever else you use. |
| **[`date-fns`](https://date-fns.org/) + [`@date-fns/tz`](https://www.npmjs.com/package/@date-fns/tz)** | Already the idiom in a lot of React code; tree-shakes well. | Timezone support is newer than the rest of the library — verify the DST edge cases in §2.1 yourself. |
| **[`ical.js`](https://github.com/kewisch/ical.js) / [`ical-generator`](https://www.npmjs.com/package/ical-generator)** | If ICS export lands at the same time (it is already on the backlog as "Add to calendar"). | Different job from expansion — do not use it as the engine. |

**Suggested shape for the next attempt:**

```
rrule          →  parse/serialise the RFC 5545 rule (and ICS export later)
temporal-polyfill →  expand it into ZonedDateTimes, with explicit disambiguation
your code      →  materialise rows, manage the horizon, own the lifecycle
```

**Whatever you choose, write §2.1's cases as tests first and watch them fail.** That is how both of
the real defects above were found.

---

## 5. What still exists in the codebase

| | Status |
|---|---|
| `event_series` table, `events.series_id`, `events.series_index` | **Kept.** Migration `0005`, applied locally and to the remote. Additive and nullable, so it is inert — and dropping tables from production to un-ship a feature is a worse risk than leaving them. The next attempt starts with the schema already in place. |
| RLS policy `event_series_tenant` | Kept, with the table. |
| The expander, the series-creation path, their tests | **Deleted.** In git history at `1f68a38` if the DST handling is ever worth reading — it was correct, and §2.1 is its distilled lesson. |
| The Repeat UI | **Kept**, showing an "in development" notice. Picking a pattern does nothing. |
| `/events` request body | No `recurrence` field. The API cannot create a series. |

---

## 6. The bar for un-pausing

1. Every case in §2.1 has a test, written first.
2. R-1 is impossible: either the horizon tops itself up, or the end date is visible on every
   occurrence of a programme.
3. R-2 is answered: "this event / this and all future / all events", including what happens to
   occurrences that already have attendance.
4. R-3 is answered: the series carries a timezone the organiser chose and can see.
5. Undo is proportionate to create.
