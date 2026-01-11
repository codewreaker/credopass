# Database Guide

Complete database schema documentation, relationships, migrations, and management for CredoPass.

---

## Table of Contents

- [Database Overview](#database-overview)
- [Schema Definitions](#schema-definitions)
- [Table Relationships](#table-relationships)
- [Indexes & Performance](#indexes--performance)
- [Migrations](#migrations)
- [Seeding Data](#seeding-data)
- [Database Management](#database-management)

---

## Database Overview

### Technology Stack

- **Database**: PostgreSQL 16 (production) / PGlite (development fallback)
- **ORM**: Drizzle ORM v0.45.1
- **Migration Tool**: Drizzle Kit v0.31.0
- **Container**: Docker Compose (local development)
- **GUI**: Drizzle Studio

### Connection Details

**Local Development**:
```
Host: localhost
Port: 5432
Database: dwellpass_db
User: postgres
Password: Ax!rtrysoph123
```

**Connection String**:
```
postgresql://postgres:Ax!rtrysoph123@localhost:5432/dwellpass_db
```

### Auto-Detection Logic

The backend automatically selects the database:
- **If `DATABASE_URL` is set**: Use PostgreSQL
- **If `DATABASE_URL` is missing**: Fall back to PGlite (in-memory)

See [`services/core/src/db/client.ts`](../services/core/src/db/client.ts) for implementation.

---

## Schema Definitions

### Users Table

**File**: [`services/core/src/db/schema/users.ts`](../services/core/src/db/schema/users.ts)

```typescript
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  firstName: text('firstName').notNull(),
  lastName: text('lastName').notNull(),
  phone: text('phone'),
  createdAt: timestamp('createdAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
});
```

**Columns**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT random | Unique user identifier |
| `email` | TEXT | NOT NULL, UNIQUE | User email address |
| `firstName` | TEXT | NOT NULL | User's first name |
| `lastName` | TEXT | NOT NULL | User's last name |
| `phone` | TEXT | NULL | Optional phone number |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation timestamp |
| `updatedAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_users_email` on `email` (for fast email lookups)
- `idx_users_createdAt` on `createdAt` (for sorting by join date)

---

### Events Table

**File**: [`services/core/src/db/schema/events.ts`](../services/core/src/db/schema/events.ts)

```typescript
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { 
    enum: ['draft', 'scheduled', 'ongoing', 'completed', 'cancelled'] 
  }).notNull(),
  startTime: timestamp('startTime', { mode: 'date', withTimezone: true }).notNull(),
  endTime: timestamp('endTime', { mode: 'date', withTimezone: true }).notNull(),
  location: text('location').notNull(),
  capacity: integer('capacity'),
  hostId: uuid('hostId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
});
```

**Columns**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique event identifier |
| `name` | TEXT | NOT NULL | Event name |
| `description` | TEXT | NULL | Event description |
| `status` | ENUM | NOT NULL | Event status (see values below) |
| `startTime` | TIMESTAMP | NOT NULL | Event start date/time |
| `endTime` | TIMESTAMP | NOT NULL | Event end date/time |
| `location` | TEXT | NOT NULL | Event location |
| `capacity` | INTEGER | NULL | Maximum attendees (optional) |
| `hostId` | UUID | FOREIGN KEY → users.id | Event organizer |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation |
| `updatedAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update |

**Status Enum Values**:
- `draft` - Event being planned
- `scheduled` - Event confirmed, not yet started
- `ongoing` - Event currently happening
- `completed` - Event finished
- `cancelled` - Event cancelled

**Indexes**:
- `idx_events_status` on `status` (filter by status)
- `idx_events_hostId` on `hostId` (find events by host)
- `idx_events_startTime` on `startTime` (sort chronologically)

**Foreign Keys**:
- `hostId` → `users.id` (CASCADE on delete - if user deleted, their events are deleted)

---

### Attendance Table

**File**: [`services/core/src/db/schema/attendance.ts`](../services/core/src/db/schema/attendance.ts)

```typescript
export const attendance = pgTable('attendance', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('eventId').notNull().references(() => events.id, { onDelete: 'cascade' }),
  patronId: uuid('patronId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  attended: boolean('attended').notNull().default(false),
  checkInTime: timestamp('checkInTime', { mode: 'date', withTimezone: true }),
  checkOutTime: timestamp('checkOutTime', { mode: 'date', withTimezone: true }),
});
```

**Columns**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique attendance record |
| `eventId` | UUID | FOREIGN KEY → events.id | Related event |
| `patronId` | UUID | FOREIGN KEY → users.id | Attendee |
| `attended` | BOOLEAN | NOT NULL, DEFAULT false | Attended or RSVP only |
| `checkInTime` | TIMESTAMP | NULL | When user checked in |
| `checkOutTime` | TIMESTAMP | NULL | When user checked out |

**Indexes**:
- `idx_attendance_eventId` on `eventId` (find attendees for an event)
- `idx_attendance_patronId` on `patronId` (find events attended by user)
- `idx_attendance_attended` on `attended` (filter by attendance status)
- `idx_attendance_unique` on `(eventId, patronId)` (prevent duplicate registrations)

**Foreign Keys**:
- `eventId` → `events.id` (CASCADE on delete)
- `patronId` → `users.id` (CASCADE on delete)

**Business Logic**:
- `attended = false` → User registered but didn't attend
- `attended = true` → User actually attended
- `checkInTime` set when user arrives
- `checkOutTime` set when user leaves (optional)

---

### Loyalty Table

**File**: [`services/core/src/db/schema/loyalty.ts`](../services/core/src/db/schema/loyalty.ts)

```typescript
export const loyalty = pgTable('loyalty', {
  id: uuid('id').primaryKey().defaultRandom(),
  patronId: uuid('patronId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  tier: text('tier', { 
    enum: ['bronze', 'silver', 'gold', 'platinum'] 
  }),
  points: integer('points').default(0),
  reward: text('reward'),
  issuedAt: timestamp('issuedAt', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expiresAt', { mode: 'date', withTimezone: true }),
});
```

**Columns**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique loyalty record |
| `patronId` | UUID | FOREIGN KEY → users.id | Member earning points |
| `description` | TEXT | NOT NULL | Why points were awarded |
| `tier` | ENUM | NULL | Member tier level |
| `points` | INTEGER | DEFAULT 0 | Points earned/spent |
| `reward` | TEXT | NULL | Reward description |
| `issuedAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | When points issued |
| `expiresAt` | TIMESTAMP | NULL | When points expire |

**Tier Enum Values**:
- `bronze` - Entry level (0-99 points)
- `silver` - Regular member (100-499 points)
- `gold` - Active member (500-999 points)
- `platinum` - VIP member (1000+ points)

**Indexes**:
- `idx_loyalty_patronId` on `patronId` (find loyalty records by user)
- `idx_loyalty_tier` on `tier` (filter by tier)

**Foreign Keys**:
- `patronId` → `users.id` (CASCADE on delete)

---

## Table Relationships

### Entity Relationship Diagram

```
┌─────────────┐
│    users    │
│─────────────│
│ id (PK)     │◄────────────────┐
│ email       │                 │
│ firstName   │                 │
│ lastName    │                 │
│ phone       │                 │
│ createdAt   │                 │
│ updatedAt   │                 │
└─────────────┘                 │
      ▲                         │
      │                         │
      │ hostId (FK)             │ patronId (FK)
      │                         │
┌─────────────┐           ┌─────────────┐
│   events    │           │  loyalty    │
│─────────────│           │─────────────│
│ id (PK)     │◄───┐      │ id (PK)     │
│ name        │    │      │ patronId    │
│ description │    │      │ description │
│ status      │    │      │ tier        │
│ startTime   │    │      │ points      │
│ endTime     │    │      │ reward      │
│ location    │    │      │ issuedAt    │
│ capacity    │    │      │ expiresAt   │
│ hostId      │    │      └─────────────┘
│ createdAt   │    │
│ updatedAt   │    │ eventId (FK)
└─────────────┘    │
                   │      patronId (FK)
             ┌─────────────┐
             │ attendance  │
             │─────────────│
             │ id (PK)     │
             │ eventId     │
             │ patronId    │
             │ attended    │
             │ checkInTime │
             │ checkOutTime│
             └─────────────┘
```

### Relationships Summary

**Users** (1) → (N) **Events** (`users.id` → `events.hostId`)
- One user can host many events
- Cascade delete: Deleting user deletes their events

**Users** (1) → (N) **Attendance** (`users.id` → `attendance.patronId`)
- One user can attend many events
- Cascade delete: Deleting user deletes their attendance records

**Events** (1) → (N) **Attendance** (`events.id` → `attendance.eventId`)
- One event can have many attendees
- Cascade delete: Deleting event deletes attendance records

**Users** (1) → (N) **Loyalty** (`users.id` → `loyalty.patronId`)
- One user can have many loyalty records
- Cascade delete: Deleting user deletes their loyalty points

---

## Indexes & Performance

### Index Strategy

**Purpose**: Speed up common queries

**Indexed Columns**:

**Users**:
- `email` - Fast login/lookup by email
- `createdAt` - Sort members by join date

**Events**:
- `status` - Filter events by status (scheduled, ongoing, etc.)
- `hostId` - Find events by organizer
- `startTime` - Sort events chronologically

**Attendance**:
- `eventId` - Find attendees for an event
- `patronId` - Find events attended by user
- `attended` - Filter confirmed attendees
- `(eventId, patronId)` - Composite unique constraint

**Loyalty**:
- `patronId` - Find loyalty records by user
- `tier` - Group users by tier

### Query Performance Tips

```sql
-- Good: Uses index on email
SELECT * FROM users WHERE email = 'john@example.com';

-- Good: Uses index on status
SELECT * FROM events WHERE status = 'scheduled';

-- Good: Uses composite index
SELECT * FROM attendance WHERE eventId = '...' AND patronId = '...';

-- Bad: Full table scan (no index on firstName)
SELECT * FROM users WHERE firstName = 'John';

-- Bad: Function prevents index usage
SELECT * FROM users WHERE LOWER(email) = 'john@example.com';
```

---

## Migrations

### Migration Workflow

```bash
# 1. Edit schema files in services/core/src/db/schema/

# 2. Generate migration from schema changes
nx run coreservice:generate

# This runs: drizzle-kit generate
# Output: services/core/drizzle/0001_new_migration.sql

# 3. Review generated SQL
cat services/core/drizzle/0001_new_migration.sql

# 4. Apply migration to database
nx run coreservice:migrate

# This runs: drizzle-kit migrate
```

### Migration Files

**Location**: `services/core/drizzle/`

**Structure**:
```
drizzle/
├── 0000_youthful_captain_midlands.sql  # Initial schema
├── meta/
│   ├── _journal.json                   # Migration history
│   └── 0000_snapshot.json              # Schema snapshot
```

**Example Migration** (Initial Schema):

```sql
-- 0000_initial_schema.sql
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL UNIQUE,
  "firstName" text NOT NULL,
  "lastName" text NOT NULL,
  "phone" text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "idx_users_createdAt" ON "users" ("createdAt");

-- ... (events, attendance, loyalty tables)
```

### Migration Best Practices

1. **Always review generated SQL** before applying
2. **Backup database** before running migrations in production
3. **Test migrations** on a copy of production data
4. **Never edit existing migrations** - create new ones
5. **Commit migrations to Git** with your schema changes

---

## Seeding Data

### Seed Script

**File**: `services/core/src/db/seed.ts`

**Purpose**: Populate database with test data for development

**Example Seed Script**:

```typescript
import { getDatabase } from './client';
import { users, events, attendance, loyalty } from './schema';

async function seed() {
  const db = await getDatabase();
  
  // Seed users
  const [user1, user2] = await db.insert(users).values([
    {
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
    },
    {
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
    },
  ]).returning();
  
  // Seed events
  const [event1] = await db.insert(events).values({
    name: 'Sunday Service',
    description: 'Weekly Sunday worship service',
    status: 'scheduled',
    startTime: new Date('2026-01-12T10:00:00Z'),
    endTime: new Date('2026-01-12T12:00:00Z'),
    location: 'Main Sanctuary',
    capacity: 500,
    hostId: user1.id,
  }).returning();
  
  // Seed attendance
  await db.insert(attendance).values([
    {
      eventId: event1.id,
      patronId: user1.id,
      attended: true,
      checkInTime: new Date('2026-01-12T09:55:00Z'),
    },
    {
      eventId: event1.id,
      patronId: user2.id,
      attended: true,
      checkInTime: new Date('2026-01-12T10:05:00Z'),
    },
  ]);
  
  // Seed loyalty
  await db.insert(loyalty).values({
    patronId: user1.id,
    description: 'Attendance at Sunday Service',
    tier: 'gold',
    points: 10,
  });
  
  console.log('✅ Seed completed');
}

seed().catch(console.error);
```

**Run Seed Script**:
```bash
nx run coreservice:seed
```

---

## Database Management

### Using Drizzle Studio

**Start Drizzle Studio**:
```bash
nx run coreservice:studio

# Opens: https://local.drizzle.studio
```

**Features**:
- Browse tables and data
- Run SQL queries
- Edit records visually
- View relationships
- Export data

### Common Database Tasks

#### View All Tables

```bash
# Using psql
docker exec -it <container-id> psql -U postgres -d dwellpass_db

# Inside psql
\dt
```

#### Export Database

```bash
# Dump entire database
docker exec -it <container-id> pg_dump -U postgres dwellpass_db > backup.sql

# Dump specific table
docker exec -it <container-id> pg_dump -U postgres -t users dwellpass_db > users.sql
```

#### Import Database

```bash
# Restore from dump
docker exec -i <container-id> psql -U postgres dwellpass_db < backup.sql
```

#### Reset Database

```bash
# Stop and remove all data
bun run postgres:down --volumes

# Start fresh
bun run postgres:up

# Run migrations
nx run coreservice:migrate

# Seed data (optional)
nx run coreservice:seed
```

### Production Database Considerations

1. **Use managed PostgreSQL** (e.g., Google Cloud SQL, AWS RDS, Supabase)
2. **Enable SSL/TLS** for connections
3. **Set up automated backups**
4. **Monitor query performance**
5. **Use connection pooling** (e.g., PgBouncer)
6. **Run migrations during deployment** with zero-downtime strategy

---

## Next Steps

- **API Endpoints**: See [API.md](API.md) for how to query this data
- **Architecture**: See [ARCHITECTURE.md](ARCHITECTURE.md) for ORM patterns
- **Deployment**: See [DEPLOYMENT.md](DEPLOYMENT.md) for production database setup
