/**
 * Seed a dataset you can actually test against.
 *
 *   nx run coreservice:seed            the only account in the database
 *   SEED_ACCOUNT=me@example.com …      pick one by email or account id
 *
 * **Sign in first.** The seed attaches everything to a real account, because a
 * dataset you are not a member of shows up as an empty screen — which is what
 * the previous seed did, and why it ended with four lines of instructions for
 * joining an organisation by hand. There is nothing to join now: you already
 * own the organisation it builds.
 *
 * What it makes, and why each piece is there:
 *
 *   · YOUR organisation, kept if you already have one so the id, slug and name
 *     you have been using survive a reseed.
 *   · A SECOND organisation you are NOT a member of, which you attend. Two
 *     jobs: if a query ever leaks you see its rows in your own list, and it is
 *     the only way to get guest rows — the ones that carry a Pass action and no
 *     host controls.
 *   · Events across every derived status, every format (in person, online,
 *     placeless), with and without a poster, capped and uncapped.
 *   · Attendance in every state, including rows linked to YOUR account so
 *     `/me/tickets` is not empty.
 *
 * Destructive: it clears every tenant table first. Accounts and identities are
 * left alone — they are who you are, not data about an organisation, and
 * deleting them would sign you out of your own test data.
 */

import { eq, or, sql } from 'drizzle-orm';
import {
  accounts,
  attendance,
  events,
  orgMemberships,
  organizations,
  people,
} from '@credopass/lib/schemas/tables';
import { isGeneratedOrganizationName } from '@credopass/lib/schemas/organization-name';
import { getDatabase } from './client';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = Date.now();
const at = (offsetMs: number) => new Date(now + offsetMs);

const db = await getDatabase();

const shortCode = () =>
  crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase() +
  '-' +
  crypto.randomUUID().slice(0, 3).toUpperCase();

// ---------------------------------------------------------------------------
// Who is this for?
// ---------------------------------------------------------------------------

const wanted = process.env.SEED_ACCOUNT ?? process.argv[3];

const allAccounts = await db
  .select({ id: accounts.id, email: accounts.email, displayName: accounts.displayName })
  .from(accounts);

if (allAccounts.length === 0) {
  console.error(`
No accounts exist yet, so there is nobody to seed for.

  Sign in to the web app once — that creates your account — then run this again.
`);
  process.exit(1);
}

const me = wanted
  ? (
      await db
        .select({ id: accounts.id, email: accounts.email, displayName: accounts.displayName })
        .from(accounts)
        .where(
          or(
            sql`lower(${accounts.email}) = ${wanted.toLowerCase()}`,
            sql`${accounts.id}::text = ${wanted}`
          )
        )
        .limit(1)
    )[0]
  : allAccounts.length === 1
    ? allAccounts[0]
    : undefined;

if (!me) {
  console.error(
    wanted
      ? `\nNo account matches "${wanted}".\n`
      : `\n${allAccounts.length} accounts exist, so I cannot guess which is yours.\n`
  );
  console.error('Pick one:\n');
  for (const a of allAccounts) {
    console.error(`  SEED_ACCOUNT=${a.email ?? a.id}   ${a.displayName ?? '(no name)'}`);
  }
  console.error('');
  process.exit(1);
}

const myName = me.displayName ?? 'Me';
console.log(`\nSeeding for ${myName}${me.email ? ` <${me.email}>` : ''}\n`);

// ---------------------------------------------------------------------------
// Clear. Organisations cascade, which takes events, people, attendance,
// passes, invitations, assets and memberships with them.
// ---------------------------------------------------------------------------

// Keep the organisation you already own, so its id and slug survive a reseed —
// every link you have open, and every pass already issued, points at them.
const [mine] = await db
  .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
  .from(organizations)
  .innerJoin(orgMemberships, eq(orgMemberships.organizationId, organizations.id))
  .where(eq(orgMemberships.accountId, me.id))
  .limit(1);

const before = await db.select({ id: organizations.id }).from(organizations);
await db.delete(organizations).where(sql`1 = 1`);
console.log(`   cleared ${before.length} organisation(s) and everything under them`);

/**
 * Keep a name you chose; repair one you did not.
 *
 * The organisation name is published — it is on the public event page and on
 * every pass — so a leftover like `Israel's organization` is the one thing here
 * worth overwriting. Anything you actually named is left exactly as it is.
 */
const slugify = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'me';

const keepName = mine && !isGeneratedOrganizationName(mine.name);
const hostOrgName = keepName ? mine!.name : myName;
const hostOrgSlug = keepName ? mine!.slug : slugify(myName);

if (mine && !keepName) {
  console.log(`   renaming "${mine.name}" → "${hostOrgName}" (it was a generated default)`);
}

const [hostOrg] = await db
  .insert(organizations)
  .values({
    ...(mine ? { id: mine.id } : {}),
    name: hostOrgName,
    slug: hostOrgSlug,
    timezone: 'Europe/London',
  })
  .returning({ id: organizations.id });

await db.insert(orgMemberships).values({
  organizationId: hostOrg.id,
  accountId: me.id,
  role: 'owner',
  status: 'active',
  provisionedBy: 'manual',
});

// The one you attend but do not run.
const [guestOrg] = await db
  .insert(organizations)
  .values({ name: 'Fitness Club', slug: 'fitness-club', timezone: 'Europe/London' })
  .returning({ id: organizations.id });

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/**
 * Real-looking names, deliberately.
 *
 * Ama Mensah and Kwame Boateng appear in the /how-it-works screenshots, so they
 * stay. Nothing here is prefixed or numbered: a roll full of "Test User 4" makes
 * every list unreadable and every count meaningless.
 */
const ROLL: Array<[string, string]> = [
  ['Ama', 'Mensah'], ['Kwame', 'Boateng'], ['Akosua', 'Asante'], ['Yaw', 'Darko'],
  ['Efua', 'Owusu'], ['Kofi', 'Annan'], ['Abena', 'Nyarko'], ['Kojo', 'Appiah'],
  ['Adwoa', 'Frimpong'], ['Kwabena', 'Osei'], ['Esi', 'Agyeman'], ['Yaa', 'Danso'],
];

const roll = await db
  .insert(people)
  .values(
    ROLL.map(([firstName, lastName]) => ({
      organizationId: hostOrg.id,
      firstName,
      lastName,
      email: `${firstName}.${lastName}@example.test`.toLowerCase(),
    }))
  )
  .returning({ id: people.id });

// You, on the other organisation's roll. This is what puts guest rows in your
// list and gives the Pass action something to reissue.
const guestRoll = await db
  .insert(people)
  .values([
    {
      organizationId: guestOrg.id,
      accountId: me.id,
      firstName: myName.split(' ')[0] ?? myName,
      lastName: myName.split(' ').slice(1).join(' ') || '—',
      email: me.email,
    },
    { organizationId: guestOrg.id, firstName: 'Simone', lastName: 'Biles', email: 'simone.biles@example.test' },
    { organizationId: guestOrg.id, firstName: 'Usain', lastName: 'Bolt', email: 'usain.bolt@example.test' },
  ])
  .returning({ id: people.id });

const meAsAttendee = guestRoll[0].id;

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

interface Spec {
  name: string;
  startAt: Date;
  hours?: number;
  /** omit for in person, `online` for a meeting URL, `placeless` for neither */
  format?: 'online' | 'placeless';
  location?: string;
  poster?: string;
  capacity?: number;
  enforce?: boolean;
  closed?: boolean;
  cancelled?: string;
  /** how many of the roll to put on it, and in what shape */
  fill?: 'full' | 'some' | 'none';
}

const MY_EVENTS: Spec[] = [
  // ── past ────────────────────────────────────────────────────────────────
  { name: 'Sunday Morning Service', startAt: at(-7 * DAY), hours: 2, poster: '/posters/chapel.svg', closed: true, fill: 'full' },
  { name: 'Midweek Prayer', startAt: at(-4 * DAY), hours: 1, closed: true, fill: 'some' },
  // Past but never closed — nobody ran the no_show job, so these read
  // "Registered" rather than "Missed". That distinction is the product.
  { name: 'Choir Rehearsal', startAt: at(-2 * DAY), hours: 1.5, fill: 'some' },
  { name: 'Prayer Walk', startAt: at(-36 * HOUR), hours: 1, format: 'placeless', fill: 'none' },

  // ── happening now ───────────────────────────────────────────────────────
  { name: 'Evening Service', startAt: at(-0.5 * HOUR), hours: 2, poster: '/posters/spotlight.svg', fill: 'some' },

  // ── upcoming ────────────────────────────────────────────────────────────
  { name: 'Sunday Morning Service', startAt: at(2 * DAY), hours: 2, poster: '/posters/chapel.svg', capacity: 200 },
  { name: 'Online Bible Study', startAt: at(3 * DAY), hours: 1, format: 'online', poster: '/posters/midnight-grid.svg' },
  // Capped AND enforced, nearly full — the capacity path is only interesting
  // when it is about to refuse somebody.
  { name: 'Youth Night', startAt: at(5 * DAY), hours: 3, poster: '/posters/confetti.svg', capacity: 10, enforce: true, fill: 'full' },
  { name: 'Baptism Service', startAt: at(9 * DAY), hours: 2, poster: '/posters/sunrise.svg' },
  { name: 'Volunteer Briefing', startAt: at(16 * DAY), hours: 1, format: 'placeless' },
  { name: 'Harvest Festival', startAt: at(24 * DAY), hours: 4, poster: '/posters/wave.svg', capacity: 400 },

  // ── cancelled, with a future date: belongs in Past, not Upcoming ────────
  { name: 'Church Picnic', startAt: at(12 * DAY), hours: 5, poster: '/posters/paper.svg', cancelled: 'Venue double-booked' },
];

const GUEST_EVENTS: Spec[] = [
  { name: 'Morning HIIT', startAt: at(-3 * DAY), hours: 1, closed: true },
  { name: 'Spin Class', startAt: at(-1 * DAY), hours: 1, closed: true },
  { name: 'Saturday Bootcamp', startAt: at(4 * DAY), hours: 1.5, poster: '/posters/lime-arc.svg', capacity: 20 },
  { name: 'Yoga in the Park', startAt: at(11 * DAY), hours: 1, format: 'placeless' },
];

const insertEvents = async (organizationId: string, specs: Spec[], hall: string) =>
  db
    .insert(events)
    .values(
      specs.map((s) => ({
        organizationId,
        name: s.name,
        startAt: s.startAt,
        endAt: new Date(s.startAt.getTime() + (s.hours ?? 1.5) * HOUR),
        timezone: 'Europe/London',
        locationText: s.format ? null : (s.location ?? hall),
        meetingUrl: s.format === 'online' ? 'https://meet.example.com/credopass-demo' : null,
        coverImageUrl: s.poster ?? null,
        shortCode: shortCode(),
        capacity: s.capacity ?? null,
        enforceCapacity: s.enforce ?? false,
        closedAt: s.closed ? new Date(s.startAt.getTime() + (s.hours ?? 1.5) * HOUR) : null,
        cancelledAt: s.cancelled ? at(-DAY) : null,
        cancellationReason: s.cancelled ?? null,
      }))
    )
    .returning({ id: events.id, startAt: events.startAt, name: events.name });

const myEventRows = await insertEvents(hostOrg.id, MY_EVENTS, `${hostOrgName} main hall`);
const guestEventRows = await insertEvents(guestOrg.id, GUEST_EVENTS, 'Fitness Club studio');

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

let attendanceRows = 0;

for (const [i, event] of myEventRows.entries()) {
  const spec = MY_EVENTS[i];
  if (spec.fill === 'none' || spec.fill === undefined) continue;

  const started = event.startAt.getTime() <= now;
  const take = spec.fill === 'full' ? ROLL.length : Math.ceil(ROLL.length / 3);

  const rows = roll.slice(0, take).map((person, n) => {
    // Before an event starts, nobody has arrived — the only honest state is
    // `registered`. `attended` on a future event is what made the list claim
    // somebody had been to something that had not happened.
    const state = !started
      ? ('registered' as const)
      : n % 5 === 4
        ? ('no_show' as const)
        : n % 7 === 6
          ? ('registered' as const)
          : ('attended' as const);

    const method: 'qr' | 'manual' | 'self' =
      n % 3 === 0 ? 'qr' : n % 3 === 1 ? 'manual' : 'self';

    return {
      organizationId: hostOrg.id,
      eventId: event.id,
      personId: person.id,
      state,
      registeredAt: new Date(event.startAt.getTime() - 3 * DAY),
      checkInTime: state === 'attended' ? new Date(event.startAt.getTime() + n * 90_000) : null,
      checkInMethod: state === 'attended' ? method : null,
    };
  });

  if (rows.length > 0) {
    await db.insert(attendance).values(rows);
    attendanceRows += rows.length;
  }
}

// Your own tickets, in the organisation you do not run.
for (const [i, event] of guestEventRows.entries()) {
  const started = event.startAt.getTime() <= now;
  await db.insert(attendance).values({
    organizationId: guestOrg.id,
    eventId: event.id,
    personId: meAsAttendee,
    // One of the past ones is a no-show on purpose, so "Missed" has a row.
    state: !started ? 'registered' : i === 1 ? 'no_show' : 'attended',
    registeredAt: new Date(event.startAt.getTime() - 2 * DAY),
    checkInTime: started && i !== 1 ? new Date(event.startAt.getTime() + 120_000) : null,
    checkInMethod: started && i !== 1 ? 'qr' : null,
  });
  attendanceRows += 1;
}

console.log(`
✅ Seeded for ${myName}.

   ${hostOrgName}  — you own it
       ${myEventRows.length} events · ${roll.length} people
       past · happening now · upcoming · cancelled
       in person · online · placeless · with and without a poster
       one capped and enforced at 10, so capacity actually refuses somebody

   Fitness Club — you attend it, you do NOT run it
       ${guestEventRows.length} events, you are on the roll of all of them
       these are the guest rows: no host controls, a Pass action instead

   ${attendanceRows} attendance rows, in every state.

   Sign in and open /events. Nothing to join — you already own the first one.
`);

// Deliberately no process.exit(): scripts/db.ts imports this during `reset`
// and exiting here would kill the run before it verifies its own work.
