// ============================================================================
// FILE: server/db/push.ts
// Manual schema push using Bun SQLite
// ============================================================================

import { Database } from 'bun:sqlite';
import path from 'node:path';

const dbPath = path.join(process.cwd(), 'data', 'dwellpass.db');
console.log('🔄 Pushing schema to database...');
console.log(`📁 Database: ${dbPath}`);

const db = new Database(dbPath, { create: true });

try {
  // Enable foreign keys
  db.run("PRAGMA foreign_keys = ON;");
  
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      phone TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);
  
  // Events table
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK(status IN ('draft', 'scheduled', 'ongoing', 'completed', 'cancelled')),
      startTime INTEGER NOT NULL,
      endTime INTEGER NOT NULL,
      location TEXT NOT NULL,
      capacity INTEGER,
      hostId TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (hostId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  
  // Attendance table
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      eventId TEXT NOT NULL,
      patronId TEXT NOT NULL,
      attended INTEGER NOT NULL DEFAULT 0,
      checkInTime INTEGER,
      checkOutTime INTEGER,
      FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (patronId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  
  // Loyalty table
  db.run(`
    CREATE TABLE IF NOT EXISTS loyalty (
      id TEXT PRIMARY KEY,
      patronId TEXT NOT NULL,
      description TEXT NOT NULL,
      tier TEXT CHECK(tier IS NULL OR tier IN ('bronze', 'silver', 'gold', 'platinum')),
      points INTEGER DEFAULT 0,
      reward TEXT,
      issuedAt INTEGER NOT NULL,
      expiresAt INTEGER,
      FOREIGN KEY (patronId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  
  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_createdAt ON users(createdAt)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_hostId ON events(hostId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_startTime ON events(startTime)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_eventId ON attendance(eventId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_patronId ON attendance(patronId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_attended ON attendance(attended)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_unique ON attendance(eventId, patronId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_loyalty_patronId ON loyalty(patronId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_loyalty_tier ON loyalty(tier)`);
  
  console.log('✅ Schema pushed successfully!');
} catch (error) {
  console.error('❌ Schema push failed:', error);
  process.exit(1);
} finally {
  db.close();
}
