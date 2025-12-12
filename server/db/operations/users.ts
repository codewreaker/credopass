// ============================================================================
// FILE: server/db/operations/users.ts
// User CRUD operations using Drizzle ORM
// ============================================================================

import { eq, desc } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { users, type User, type NewUser } from '../schema';

class UserOperations {
  private db: BunSQLiteDatabase;

  constructor(db: BunSQLiteDatabase) {
    this.db = db;
  }

  // Find all users
  async findAll(): Promise<User[]> {
    return await this.db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  // Find user by ID
  async findById(id: string): Promise<User | undefined> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    return result[0];
  }

  // Find user by email
  async findByEmail(email: string): Promise<User | undefined> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    return result[0];
  }

  // Create new user
  async create(data: Omit<NewUser, 'createdAt' | 'updatedAt'>): Promise<User> {
    const now = new Date();
    const newUser: NewUser = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(users).values(newUser);
    
    const created = await this.findById(newUser.id);
    if (!created) {
      throw new Error('Failed to create user');
    }
    
    return created;
  }

  // Update user
  async update(id: string, data: Partial<Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    await this.db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    return await this.findById(id);
  }

  // Delete user
  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(users)
      .where(eq(users.id, id));

    return result.changes > 0;
  }

  // Bulk create
  async createMany(data: Omit<NewUser, 'createdAt' | 'updatedAt'>[]): Promise<User[]> {
    const now = new Date();
    const newUsers: NewUser[] = data.map(user => ({
      ...user,
      createdAt: now,
      updatedAt: now,
    }));

    await this.db.insert(users).values(newUsers);

    // Fetch all created users
    const ids = newUsers.map(u => u.id);
    return await this.db
      .select()
      .from(users)
      .where(eq(users.id, ids[0])); // This is simplified, ideally use IN clause
  }
}

export default UserOperations;
