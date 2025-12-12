// ============================================================================
// FILE: server/db/seed.ts
// Database seeding script with Drizzle ORM
// ============================================================================

import { getDatabase, UserOperations, EventOperations, AttendanceOperations, LoyaltyOperations } from "./index";
import type { NewUser, NewEvent, NewAttendance, NewLoyalty } from "./schema";

console.log("🌱 Starting database seed...\n");

async function seed() {
    try {
        const db = getDatabase();
        
        // Initialize operations
        const userOps = new UserOperations(db);
        const eventOps = new EventOperations(db);
        const attendanceOps = new AttendanceOperations(db);
        const loyaltyOps = new LoyaltyOperations(db);

        // Check if data already exists
        const existingUsers = await userOps.findAll();

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
        const users: Awaited<ReturnType<typeof userOps.create>>[] = [];
        
        for (let i = 0; i < 25; i++) {
            const userData: Omit<NewUser, 'createdAt' | 'updatedAt'> = {
                id: crypto.randomUUID(),
                email: `${firstNames[i]?.toLowerCase()}.${lastNames[i]?.toLowerCase()}@example.com`,
                firstName: firstNames[i]!,
                lastName: lastNames[i]!,
                phone: `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
            };
            const user = await userOps.create(userData);
            users.push(user);
        }
        
        console.log(`✓ Created ${users.length} users\n`);

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
        const events: Awaited<ReturnType<typeof eventOps.create>>[] = [];
        const now = Date.now();

        for (let i = 0; i < 10; i++) {
            const daysOffset = Math.floor(Math.random() * 60) - 30; // -30 to +30 days
            const startTime = new Date(now + daysOffset * 24 * 60 * 60 * 1000);
            const duration = (Math.floor(Math.random() * 6) + 2) * 60 * 60 * 1000; // 2-8 hours
            const endTime = new Date(startTime.getTime() + duration);

            let status: 'draft' | 'scheduled' | 'ongoing' | 'completed' | 'cancelled' = 'scheduled';
            if (startTime.getTime() < now - 24 * 60 * 60 * 1000) {
                status = 'completed';
            } else if (startTime.getTime() < now && endTime.getTime() > now) {
                status = 'ongoing';
            } else if (Math.random() < 0.1) {
                status = 'cancelled';
            } else if (Math.random() < 0.15) {
                status = 'draft';
            }

            const eventData: Omit<NewEvent, 'createdAt' | 'updatedAt'> = {
                id: crypto.randomUUID(),
                name: eventNames[i]!,
                description: `Join us for an amazing ${eventNames[i]?.toLowerCase()}! This will be an unforgettable experience.`,
                status,
                startTime,
                endTime,
                location: locations[Math.floor(Math.random() * locations.length)]!,
                capacity: Math.floor(Math.random() * 150) + 50, // 50-200 capacity
                hostId: users[Math.floor(Math.random() * Math.min(5, users.length))]!.id,
            };

            const event = await eventOps.create(eventData);
            events.push(event);
        }

        console.log(`✓ Created ${events.length} events\n`);

        // 3. Create Attendance Records
        console.log("✓ Creating attendance records...");
        let attendanceCount = 0;

        for (const event of events) {
            // Skip draft and cancelled events
            if (event.status === 'draft' || event.status === 'cancelled') continue;

            // Random number of attendees (40-90% of capacity or all users, whichever is smaller)
            const maxAttendees = Math.min(event.capacity || 100, users.length);
            const numAttendees = Math.floor(maxAttendees * (0.4 + Math.random() * 0.5));

            // Randomly select attendees
            const shuffledUsers = [...users].sort(() => Math.random() - 0.5);
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

                const attendanceData: NewAttendance = {
                    id: crypto.randomUUID(),
                    eventId: event.id,
                    patronId: patron.id,
                    attended,
                    checkInTime,
                    checkOutTime,
                };

                await attendanceOps.create(attendanceData);
                attendanceCount++;
            }
        }

        console.log(`✓ Created ${attendanceCount} attendance records\n`);

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

        let loyaltyCount = 0;

        for (const user of users) {
            // Calculate user's event attendance
            const userAttendance = await attendanceOps.findByPatronId(user.id);
            const attendedCount = userAttendance.filter(a => a.attended).length;
            const points = attendedCount * 10; // 10 points per event

            // Determine tier based on points
            let tier: 'bronze' | 'silver' | 'gold' | 'platinum' = 'bronze';
            if (points >= 300) tier = 'platinum';
            else if (points >= 200) tier = 'gold';
            else if (points >= 100) tier = 'silver';

            // Create loyalty account record
            const issuedAt = new Date(Date.now() - Math.floor(Math.random() * 60 * 24 * 60 * 60 * 1000));
            
            const loyaltyData: NewLoyalty = {
                id: crypto.randomUUID(),
                patronId: user.id,
                description: `Loyalty account - ${tier.charAt(0).toUpperCase() + tier.slice(1)} member`,
                tier,
                points,
                reward: null,
                issuedAt,
                expiresAt: null,
            };

            await loyaltyOps.create(loyaltyData);
            loyaltyCount++;

            // Add some rewards for active users
            if (points > 50 && Math.random() > 0.3) {
                const numRewards = Math.floor(Math.random() * 3) + 1;
                for (let i = 0; i < numRewards; i++) {
                    const rewardIssuedAt = new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));
                    const rewardExpiresAt = new Date(rewardIssuedAt.getTime() + (90 * 24 * 60 * 60 * 1000));

                    const rewardData: NewLoyalty = {
                        id: crypto.randomUUID(),
                        patronId: user.id,
                        description: `Reward earned for attending ${Math.floor(Math.random() * 10) + 5} events`,
                        tier: null,
                        points: null,
                        reward: rewardTypes[Math.floor(Math.random() * rewardTypes.length)]!,
                        issuedAt: rewardIssuedAt,
                        expiresAt: rewardExpiresAt,
                    };

                    await loyaltyOps.create(rewardData);
                    loyaltyCount++;
                }
            }
        }

        console.log(`✓ Created ${loyaltyCount} loyalty records\n`);

        // Summary
        console.log("📊 Seed Summary:");
        console.log(`   Users: ${users.length}`);
        console.log(`   Events: ${events.length}`);
        console.log(`   Attendance Records: ${attendanceCount}`);
        console.log(`   Loyalty Records: ${loyaltyCount}`);
        console.log("\n✅ Database seed completed successfully!");
        process.exit(0);

    } catch (error) {
        console.error("\n❌ Seed failed:", error);
        console.error(error);
        process.exit(1);
    }
}

seed();
