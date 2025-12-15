// ============================================================================
// FILE: server/db/seed.ts
// Database seeding script with Drizzle ORM
// ============================================================================

import { desc } from 'drizzle-orm';
import { getDatabase } from "./index.js";
import { users, events, attendance, loyalty } from "./schema.js";
import type { UserInsert, EventInsert, AttendanceInsert, LoyaltyInsert } from "./schema.js";

console.log("🌱 Starting database seed...\n");

async function seed() {
    try {
        const db = getDatabase();

        // Check if data already exists
        const existingUsers = await db.select().from(users).orderBy(desc(users.createdAt));

        if (existingUsers.length > 0) {
            console.log(`ℹ️  Database already has ${existingUsers.length} user(s), skipping seed`);
            console.log("✅ Database seed completed (skipped)!");
            process.exit(0);
        }

        // Generate sample data
        console.log("📝 Generating seed data...\n");

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

        console.log("👥 Creating users...");
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

        console.log("🎉 Creating events...");
        const createdEvents: EventInsert[] = [];
        const nowTime = Date.now();
        const nowDate = new Date();

        for (let i = 0; i < 10; i++) {
            const daysOffset = Math.floor(Math.random() * 60) - 30; // -30 to +30 days
            const startTime = new Date(nowTime + daysOffset * 24 * 60 * 60 * 1000);
            const duration = (Math.floor(Math.random() * 6) + 2) * 60 * 60 * 1000; // 2-8 hours
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
                capacity: Math.floor(Math.random() * 150) + 50, // 50-200 capacity
                hostId: createdUsers[Math.floor(Math.random() * Math.min(5, createdUsers.length))]!.id,
                createdAt: nowDate,
                updatedAt: nowDate,
            };

            createdEvents.push(eventData);
        }

        await db.insert(events).values(createdEvents);
        console.log(`✓ Created ${createdEvents.length} events\n`);

        // 3. Create Attendance Records
        console.log("✓ Creating attendance records...");
        const attendanceRecords: AttendanceInsert[] = [];

        for (const event of createdEvents) {
            // Skip draft and cancelled events
            if (event.status === 'draft' || event.status === 'cancelled') continue;

            // Random number of attendees (40-90% of capacity or all users, whichever is smaller)
            const maxAttendees = Math.min(event.capacity || 100, createdUsers.length);
            const numAttendees = Math.floor(maxAttendees * (0.4 + Math.random() * 0.5));

            // Randomly select attendees
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
        console.log("🏆 Creating loyalty records...");
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
            // Calculate user's event attendance
            const userAttendance = attendanceRecords.filter(a => a.patronId === user.id && a.attended);
            const attendedCount = userAttendance.length;
            const points = attendedCount * 10; // 10 points per event

            // Determine tier based on points
            let tier: 'bronze' | 'silver' | 'gold' | 'platinum' = 'bronze';
            if (points >= 300) tier = 'platinum';
            else if (points >= 200) tier = 'gold';
            else if (points >= 100) tier = 'silver';

            // Create loyalty account record
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

            // Add some rewards for active users
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
        console.log("📊 Seed Summary:");
        console.log(`   Users: ${createdUsers.length}`);
        console.log(`   Events: ${createdEvents.length}`);
        console.log(`   Attendance Records: ${attendanceRecords.length}`);
        console.log(`   Loyalty Records: ${loyaltyRecords.length}`);
        console.log("\n✅ Database seed completed successfully!");
        process.exit(0);

    } catch (error) {
        console.error("\n❌ Seed failed:", error);
        console.error(error);
        process.exit(1);
    }
}

seed();
