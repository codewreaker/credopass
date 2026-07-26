/**
 * Seed a realistic dev dataset.
 *
 *   nx run coreservice:seed
 *
 * Deliberately NOT the old seed, which produced ~30 `*@example.com` fixtures
 * that showed up in the product as "Member" rows and made every count
 * meaningless (D10). This one seeds a shape you can actually reason about:
 *
 *   · TWO organisations, so tenancy is visible rather than theoretical. If a
 *     query ever leaks, you see Fitness Club rows in the church's list.
 *   · Events spanning every derived status — past, live right now, upcoming,
 *     and cancelled — so `deriveStatus` is exercised by looking at a screen.
 *   · Attendance in every state, so `standing` has something to say.
 *
 * Idempotent by slug: re-running wipes and reseeds the same two orgs and leaves
 * anything you created by hand alone.
 */

import { inArray } from 'drizzle-orm';
import { attendance, events, organizations, people } from '@credopass/lib/schemas/tables';
import { getDatabase } from './client';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = Date.now();

const db = await getDatabase();

const shortCode = () =>
  crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase() +
  '-' +
  crypto.randomUUID().slice(0, 3).toUpperCase();

const SEEDED_SLUGS = ['kharis-church', 'fitness-club'];

console.log('\nSeeding…\n');

// Wipe only what this script owns. Anything you made through the API survives.
const existing = await db
  .select({ id: organizations.id })
  .from(organizations)
  .where(inArray(organizations.slug, SEEDED_SLUGS));

if (existing.length > 0) {
  await db.delete(organizations).where(inArray(organizations.slug, SEEDED_SLUGS));
  console.log(`   cleared ${existing.length} previously seeded organisation(s)`);
}

interface EventSpec {
  name: string;
  startAt: Date;
  durationHours?: number;
  cancelledAt?: Date;
  cancellationReason?: string;
  closedAt?: Date;
  capacity?: number;
}

const seedOrg = async (
  name: string,
  slug: string,
  timezone: string,
  peopleNames: Array<[string, string]>,
  eventSpecs: EventSpec[]
) => {
  const [org] = await db
    .insert(organizations)
    .values({ name, slug, timezone })
    .returning({ id: organizations.id });

  const personRows = await db
    .insert(people)
    .values(
      peopleNames.map(([firstName, lastName]) => ({
        organizationId: org.id,
        firstName,
        lastName,
        email: `${firstName}.${lastName}@${slug}.test`.toLowerCase(),
      }))
    )
    .returning({ id: people.id });

  const eventRows = await db
    .insert(events)
    .values(
      eventSpecs.map((e) => ({
        organizationId: org.id,
        name: e.name,
        startAt: e.startAt,
        endAt: new Date(e.startAt.getTime() + (e.durationHours ?? 1.5) * HOUR),
        timezone,
        locationText: `${name} main hall`,
        shortCode: shortCode(),
        capacity: e.capacity ?? null,
        cancelledAt: e.cancelledAt ?? null,
        cancellationReason: e.cancellationReason ?? null,
        closedAt: e.closedAt ?? null,
      }))
    )
    .returning({ id: events.id, startAt: events.startAt, endAt: events.endAt });

  // Attendance only for events that have started. Registering for something
  // three weeks out and being marked `attended` would be nonsense data.
  let attendanceCount = 0;
  for (const event of eventRows) {
    if (event.startAt.getTime() > now) continue;

    const rows = personRows.map((person, i) => ({
      organizationId: org.id,
      eventId: event.id,
      personId: person.id,
      // A mix: most attended, some no-showed, some still just registered.
      state: (i % 4 === 3 ? 'no_show' : i % 5 === 4 ? 'registered' : 'attended') as
        | 'attended'
        | 'no_show'
        | 'registered',
      registeredAt: new Date(event.startAt.getTime() - 3 * DAY),
      checkInTime: i % 4 === 3 || i % 5 === 4 ? null : new Date(event.startAt.getTime() + i * 60_000),
      checkInMethod: (i % 3 === 0 ? 'qr' : i % 3 === 1 ? 'manual' : 'self') as 'qr' | 'manual' | 'self',
    }));

    await db.insert(attendance).values(rows);
    attendanceCount += rows.length;
  }

  console.log(
    `   ${name}: ${personRows.length} people, ${eventRows.length} events, ${attendanceCount} attendance rows`
  );
  return org.id;
};

await seedOrg(
  'Kharis Church',
  'kharis-church',
  'Europe/London',
  [
    ['Ada', 'Lovelace'], ['Alan', 'Turing'], ['Grace', 'Hopper'], ['Edsger', 'Dijkstra'],
    ['Barbara', 'Liskov'], ['Donald', 'Knuth'], ['Margaret', 'Hamilton'], ['Tony', 'Hoare'],
  ],
  [
    { name: 'Sunday Service', startAt: new Date(now - 7 * DAY), closedAt: new Date(now - 7 * DAY + 2 * HOUR) },
    { name: 'Midweek Prayer', startAt: new Date(now - 3 * DAY), closedAt: new Date(now - 3 * DAY + HOUR) },
    // Started 30 minutes ago — reads `ongoing` right now.
    { name: 'Evening Service', startAt: new Date(now - 0.5 * HOUR), durationHours: 2 },
    { name: 'Sunday Service', startAt: new Date(now + 3 * DAY), capacity: 200 },
    { name: 'Youth Night', startAt: new Date(now + 10 * DAY), capacity: 60 },
    // Cancelled but still in the future — belongs in `past`, not `upcoming`.
    {
      name: 'Church Picnic',
      startAt: new Date(now + 14 * DAY),
      cancelledAt: new Date(now - DAY),
      cancellationReason: 'Venue double-booked',
    },
  ]
);

await seedOrg(
  'Fitness Club',
  'fitness-club',
  'Europe/London',
  [['Simone', 'Biles'], ['Usain', 'Bolt'], ['Serena', 'Williams']],
  [
    { name: 'Morning HIIT', startAt: new Date(now - 2 * DAY), durationHours: 1, closedAt: new Date(now - 2 * DAY + HOUR) },
    { name: 'Spin Class', startAt: new Date(now + 2 * DAY), durationHours: 1, capacity: 20 },
  ]
);

console.log(`
✅ Seeded.

   Two organisations — if one ever shows the other's rows, tenancy has leaked.
   Events cover every derived status: completed, ongoing, scheduled, cancelled.

   You are not a member of either yet — so GET /events will be empty. To join:

     nx run coreservice:token                    mint a JWT (creates your account)
     GET /api/v1/core/me                         copy your account id
     nx run coreservice:db join <account-id>     become an owner of Kharis Church
`);

// Deliberately no process.exit() — this module is imported by scripts/db.ts,
// and exiting here would kill the reset before it verifies its own work.
