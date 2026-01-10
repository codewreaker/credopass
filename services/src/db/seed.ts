// ============================================================================
// FILE: packages/database/src/seed.ts
// Database seeding script with Drizzle ORM (PGlite/PostgreSQL)
// ============================================================================

import { desc } from 'drizzle-orm';
import { getDatabase, closeDatabase } from './client';
import { users, events, attendance, loyalty } from './schema';

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

interface EventInsert {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  startTime: Date;
  endTime: Date;
  location: string;
  capacity: number;
  hostId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AttendanceInsert {
  id: string;
  eventId: string;
  patronId: string;
  attended: boolean;
  checkInTime: Date | null;
  checkOutTime: Date | null;
}

interface LoyaltyInsert {
  id: string;
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
    const now = new Date();

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

    // 2. Create Events
    const eventNames: string[] = [
      'Tech Conference 2024',
      'Summer Music Festival',
      'Community Meetup',
      'Art Exhibition',
      'Charity Gala',
      'Startup Pitch Night',
      'Networking Breakfast',
      'Product Launch Event',
      'Workshop: Web Development',
      'Annual Company Party'
    ];

    const locations: string[] = [
      'Main Conference Center',
      'City Park Amphitheater',
      'Downtown Community Hall',
      'Modern Art Gallery',
      'Grand Hotel Ballroom',
      'Innovation Hub',
      'Sunrise Cafe & Coworking',
      'Tech Campus Auditorium',
      'Learning Center Room 101',
      'Corporate HQ Rooftop'
    ];

    console.log('🎉 Creating events...');
    const createdEvents: EventInsert[] = [];
    const nowTime = Date.now();
    const nowDate = new Date();

    for (let i = 0; i < 10; i++) {
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
        name: eventNames[i]!,
        description: `Join us for an amazing ${eventNames[i]?.toLowerCase()}! This will be an unforgettable experience.`,
        status,
        startTime,
        endTime,
        location: locations[Math.floor(Math.random() * locations.length)]!,
        capacity: Math.floor(Math.random() * 150) + 50,
        hostId: createdUsers[Math.floor(Math.random() * Math.min(5, createdUsers.length))]!.id,
        createdAt: nowDate,
        updatedAt: nowDate,
      };

      createdEvents.push(eventData);
    }

    await db.insert(events).values(createdEvents);
    console.log(`✓ Created ${createdEvents.length} events\n`);

    // 3. Create Attendance Records
    console.log('✓ Creating attendance records...');
    const attendanceRecords: AttendanceInsert[] = [];

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

        if (attended && event.status === 'completed') {
          checkInTime = new Date(event.startTime.getTime() + Math.floor(Math.random() * 30 * 60 * 1000));
          const remainingTime = event.endTime.getTime() - checkInTime.getTime();
          checkOutTime = new Date(checkInTime.getTime() + Math.floor(Math.random() * remainingTime));
        } else if (attended && event.status === 'ongoing') {
          checkInTime = new Date(event.startTime.getTime() + Math.floor(Math.random() * 30 * 60 * 1000));
          checkOutTime = null;
        }

        const attendanceData: AttendanceInsert = {
          id: crypto.randomUUID(),
          eventId: event.id,
          patronId: patron.id,
          attended,
          checkInTime,
          checkOutTime,
        };

        attendanceRecords.push(attendanceData);
      }
    }

    await db.insert(attendance).values(attendanceRecords);
    console.log(`✓ Created ${attendanceRecords.length} attendance records\n`);

    // 4. Create Loyalty Records
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
    console.log(`   Users: ${createdUsers.length}`);
    console.log(`   Events: ${createdEvents.length}`);
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
