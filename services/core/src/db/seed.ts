// ============================================================================
// FILE: services/core/src/db/seed.ts
// Database seeding script with Drizzle ORM (PostgreSQL)
// ============================================================================

import { desc } from 'drizzle-orm';
import { getDatabase, closeDatabase } from './client';
import { 
  users, 
  organizations, 
  orgMemberships,
  events, 
  eventMembers,
  attendance, 
  loyalty 
} from '@credopass/lib/schemas/tables';

console.log('🌱 Starting database seed...\n');

// Types for seed data
interface UserInsert {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

interface OrganizationInsert {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  createdAt: Date;
  updatedAt: Date;
}

interface OrgMembershipInsert {
  id: string;
  userId: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  acceptedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface EventInsert {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  status: 'draft' | 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  checkInMethods: string[];
  startTime: Date;
  endTime: Date;
  location: string;
  capacity: number;
  createdAt: Date;
  updatedAt: Date;
}

interface EventMemberInsert {
  id: string;
  eventId: string;
  userId: string;
  role: 'organizer' | 'co-host' | 'staff' | 'volunteer';
  createdAt: Date;
  updatedAt: Date;
}

interface AttendanceInsert {
  id: string;
  organizationId: string;
  eventId: string;
  patronId: string;
  attended: boolean;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  checkInMethod: 'qr' | 'manual' | 'external_auth' | null;
}

interface LoyaltyInsert {
  id: string;
  organizationId: string;
  patronId: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | null;
  points: number | null;
  reward: string | null;
  issuedAt: Date;
  expiresAt: Date | null;
}

async function seed() {
  try {
    const db = await getDatabase();

    // Check if data already exists
    const existingUsers = await db.select().from(users).orderBy(desc(users.createdAt));

    if (existingUsers.length > 0) {
      console.log(`ℹ️  Database already has ${existingUsers.length} user(s), skipping seed`);
      console.log('✅ Database seed completed (skipped)!');
      await closeDatabase();
      process.exit(0);
    }

    // Generate sample data
    console.log('📝 Generating seed data...\n');
    const now = new Date();

    // 0. Create Organizations first (multi-tenancy)
    console.log('🏢 Creating organizations...');
    const createdOrganizations: OrganizationInsert[] = [
      {
        id: crypto.randomUUID(),
        name: 'Kharis Church',
        slug: 'kharis-church',
        plan: 'pro',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        name: 'Tech Community Hub',
        slug: 'tech-community-hub',
        plan: 'starter',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        name: 'Fitness Club',
        slug: 'fitness-club',
        plan: 'free',
        createdAt: now,
        updatedAt: now,
      }
    ];

    await db.insert(organizations).values(createdOrganizations);
    console.log(`✓ Created ${createdOrganizations.length} organizations\n`);

    // Use first org as default for seed data
    const defaultOrgId = createdOrganizations[0]!.id;

    // 1. Create Users (Patrons)
    const firstNames: string[] = [
      'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'Chris', 'Lisa', 'James',
      'Maria', 'Robert', 'Emily', 'William', 'Sophia', 'Daniel', 'Olivia', 'Matthew',
      'Isabella', 'Andrew', 'Mia', 'Joseph', 'Charlotte', 'Ryan', 'Amelia', 'Kevin'
    ];
    const lastNames: string[] = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
      'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
      'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
      'White', 'Harris'
    ];

    console.log('👥 Creating users...');
    const createdUsers: UserInsert[] = [];

    for (let i = 0; i < 25; i++) {
      const userData: UserInsert = {
        id: crypto.randomUUID(),
        email: `${firstNames[i]?.toLowerCase()}.${lastNames[i]?.toLowerCase()}@example.com`,
        firstName: firstNames[i]!,
        lastName: lastNames[i]!,
        phone: `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
        createdAt: now,
        updatedAt: now,
      };
      createdUsers.push(userData);
    }

    await db.insert(users).values(createdUsers);
    console.log(`✓ Created ${createdUsers.length} users\n`);

    // 1.5 Create Org Memberships (link users to organizations)
    console.log('🔗 Creating organization memberships...');
    const createdOrgMemberships: OrgMembershipInsert[] = [];

    // First user is owner of first org
    createdOrgMemberships.push({
      id: crypto.randomUUID(),
      userId: createdUsers[0]!.id,
      organizationId: defaultOrgId,
      role: 'owner',
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Next 4 users are admins
    for (let i = 1; i < 5; i++) {
      createdOrgMemberships.push({
        id: crypto.randomUUID(),
        userId: createdUsers[i]!.id,
        organizationId: defaultOrgId,
        role: 'admin',
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Rest are members
    for (let i = 5; i < createdUsers.length; i++) {
      createdOrgMemberships.push({
        id: crypto.randomUUID(),
        userId: createdUsers[i]!.id,
        organizationId: defaultOrgId,
        role: 'member',
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    await db.insert(orgMemberships).values(createdOrgMemberships);
    console.log(`✓ Created ${createdOrgMemberships.length} organization memberships\n`);

    // 2. Create Events (now with organizationId)
    const eventNames: string[] = [
      'Sunday Service',
      'Youth Fellowship',
      'Community Meetup',
      'Bible Study Group',
      'Prayer Meeting',
      'Startup Pitch Night',
      'Networking Breakfast',
      'Worship Night',
      'Leadership Workshop',
      'Annual Conference',
      'Easter Celebration'
    ];

    const locations: string[] = [
      'Main Auditorium',
      'Youth Hall',
      'Community Center',
      'Room 101',
      'Chapel',
      'Innovation Hub',
      'Fellowship Hall',
      'Outdoor Pavilion',
      'Conference Room A',
      'Grand Hall',
      'Sanctuary'
    ];

    console.log('🎉 Creating events...');
    const createdEvents: EventInsert[] = [];
    const nowTime = Date.now();
    const nowDate = new Date();

    for (let i = 0; i < 11; i++) {
      const daysOffset = Math.floor(Math.random() * 60) - 30;
      const startTime = new Date(nowTime + daysOffset * 24 * 60 * 60 * 1000);
      const duration = (Math.floor(Math.random() * 6) + 2) * 60 * 60 * 1000;
      const endTime = new Date(startTime.getTime() + duration);

      let status: 'draft' | 'scheduled' | 'ongoing' | 'completed' | 'cancelled' = 'scheduled';
      if (startTime.getTime() < nowTime - 24 * 60 * 60 * 1000) {
        status = 'completed';
      } else if (startTime.getTime() < nowTime && endTime.getTime() > nowTime) {
        status = 'ongoing';
      } else if (Math.random() < 0.1) {
        status = 'cancelled';
      } else if (Math.random() < 0.15) {
        status = 'draft';
      }

      const eventData: EventInsert = {
        id: crypto.randomUUID(),
        organizationId: defaultOrgId,
        name: eventNames[i % eventNames.length]!,
        description: `Join us for an amazing ${eventNames[i % eventNames.length]?.toLowerCase()}! This will be an unforgettable experience.`,
        status,
        checkInMethods: ['qr', 'manual'],
        startTime,
        endTime,
        location: locations[Math.floor(Math.random() * locations.length)]!,
        capacity: Math.floor(Math.random() * 150) + 50,
        createdAt: nowDate,
        updatedAt: nowDate,
      };

      createdEvents.push(eventData);
    }

    await db.insert(events).values(createdEvents);
    console.log(`✓ Created ${createdEvents.length} events\n`);

    // 2.5 Create Event Members (organizers for each event)
    console.log('👔 Creating event members...');
    const createdEventMembers: EventMemberInsert[] = [];

    for (const event of createdEvents) {
      // First admin user is the organizer
      createdEventMembers.push({
        id: crypto.randomUUID(),
        eventId: event.id,
        userId: createdUsers[0]!.id,
        role: 'organizer',
        createdAt: nowDate,
        updatedAt: nowDate,
      });

      // Add 1-2 co-hosts from admins
      const numCoHosts = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < numCoHosts; i++) {
        createdEventMembers.push({
          id: crypto.randomUUID(),
          eventId: event.id,
          userId: createdUsers[1 + i]!.id,
          role: 'co-host',
          createdAt: nowDate,
          updatedAt: nowDate,
        });
      }
    }

    await db.insert(eventMembers).values(createdEventMembers);
    console.log(`✓ Created ${createdEventMembers.length} event members\n`);

    // 3. Create Attendance Records (with organizationId)
    console.log('✓ Creating attendance records...');
    const attendanceRecords: AttendanceInsert[] = [];
    const checkInMethods: ('qr' | 'manual')[] = ['qr', 'manual'];

    for (const event of createdEvents) {
      if (event.status === 'draft' || event.status === 'cancelled') continue;

      const maxAttendees = Math.min(event.capacity || 100, createdUsers.length);
      const numAttendees = Math.floor(maxAttendees * (0.4 + Math.random() * 0.5));

      const shuffledUsers = [...createdUsers].sort(() => Math.random() - 0.5);
      const attendees = shuffledUsers.slice(0, numAttendees);

      for (const patron of attendees) {
        const attended = event.status === 'completed' ? Math.random() > 0.1 : Math.random() > 0.3;
        let checkInTime: Date | null = null;
        let checkOutTime: Date | null = null;
        let checkInMethod: 'qr' | 'manual' | null = null;

        if (attended && event.status === 'completed') {
          checkInTime = new Date(event.startTime.getTime() + Math.floor(Math.random() * 30 * 60 * 1000));
          const remainingTime = event.endTime.getTime() - checkInTime.getTime();
          checkOutTime = new Date(checkInTime.getTime() + Math.floor(Math.random() * remainingTime));
          checkInMethod = checkInMethods[Math.floor(Math.random() * checkInMethods.length)]!;
        } else if (attended && event.status === 'ongoing') {
          checkInTime = new Date(event.startTime.getTime() + Math.floor(Math.random() * 30 * 60 * 1000));
          checkOutTime = null;
          checkInMethod = checkInMethods[Math.floor(Math.random() * checkInMethods.length)]!;
        }

        const attendanceData: AttendanceInsert = {
          id: crypto.randomUUID(),
          organizationId: event.organizationId,
          eventId: event.id,
          patronId: patron.id,
          attended,
          checkInTime,
          checkOutTime,
          checkInMethod,
        };

        attendanceRecords.push(attendanceData);
      }
    }

    await db.insert(attendance).values(attendanceRecords);
    console.log(`✓ Created ${attendanceRecords.length} attendance records\n`);

    // 4. Create Loyalty Records (with organizationId)
    console.log('🏆 Creating loyalty records...');
    const rewardTypes: string[] = [
      'Free Event Ticket',
      '20% Discount Voucher',
      'VIP Access Pass',
      'Exclusive Merchandise',
      'Early Bird Registration',
      'Meet & Greet Pass',
      'Premium Seating Upgrade',
      'Complimentary Food & Beverage',
      'Guest Pass',
      'Limited Edition Swag'
    ];

    const loyaltyRecords: LoyaltyInsert[] = [];

    for (const user of createdUsers) {
      const userAttendance = attendanceRecords.filter(a => a.patronId === user.id && a.attended);
      const attendedCount = userAttendance.length;
      const points = attendedCount * 10;

      let tier: 'bronze' | 'silver' | 'gold' | 'platinum' = 'bronze';
      if (points >= 300) tier = 'platinum';
      else if (points >= 200) tier = 'gold';
      else if (points >= 100) tier = 'silver';

      const issuedAt = new Date(Date.now() - Math.floor(Math.random() * 60 * 24 * 60 * 60 * 1000));

      const loyaltyData: LoyaltyInsert = {
        id: crypto.randomUUID(),
        organizationId: defaultOrgId,
        patronId: user.id,
        description: `Loyalty account - ${tier.charAt(0).toUpperCase() + tier.slice(1)} member`,
        tier,
        points,
        reward: null,
        issuedAt,
        expiresAt: null,
      };

      loyaltyRecords.push(loyaltyData);

      if (points > 50 && Math.random() > 0.3) {
        const numRewards = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < numRewards; i++) {
          const rewardIssuedAt = new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));
          const rewardExpiresAt = new Date(rewardIssuedAt.getTime() + (90 * 24 * 60 * 60 * 1000));

          const rewardData: LoyaltyInsert = {
            id: crypto.randomUUID(),
            organizationId: defaultOrgId,
            patronId: user.id,
            description: `Reward earned for attending ${Math.floor(Math.random() * 10) + 5} events`,
            tier: null,
            points: null,
            reward: rewardTypes[Math.floor(Math.random() * rewardTypes.length)]!,
            issuedAt: rewardIssuedAt,
            expiresAt: rewardExpiresAt,
          };

          loyaltyRecords.push(rewardData);
        }
      }
    }

    await db.insert(loyalty).values(loyaltyRecords);
    console.log(`✓ Created ${loyaltyRecords.length} loyalty records\n`);

    // Summary
    console.log('📊 Seed Summary:');
    console.log(`   Organizations: ${createdOrganizations.length}`);
    console.log(`   Users: ${createdUsers.length}`);
    console.log(`   Org Memberships: ${createdOrgMemberships.length}`);
    console.log(`   Events: ${createdEvents.length}`);
    console.log(`   Event Members: ${createdEventMembers.length}`);
    console.log(`   Attendance Records: ${attendanceRecords.length}`);
    console.log(`   Loyalty Records: ${loyaltyRecords.length}`);
    console.log('\n✅ Database seed completed successfully!');
    await closeDatabase();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    console.error(error);
    await closeDatabase();
    process.exit(1);
  }
}

seed();
