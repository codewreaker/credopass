// ============================================================================
// FILE: server/db/operations/loyalty.ts
// Loyalty CRUD operations using Drizzle ORM
// ============================================================================

import { eq, and, desc, gte, isNotNull } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { loyalty, type Loyalty, type NewLoyalty } from '../schema';

class LoyaltyOperations {
  private db: BunSQLiteDatabase;

  constructor(db: BunSQLiteDatabase) {
    this.db = db;
  }

  // Find all loyalty records
  async findAll(): Promise<Loyalty[]> {
    return await this.db
      .select()
      .from(loyalty)
      .orderBy(desc(loyalty.issuedAt));
  }

  // Find loyalty record by ID
  async findById(id: string): Promise<Loyalty | undefined> {
    const result = await this.db
      .select()
      .from(loyalty)
      .where(eq(loyalty.id, id))
      .limit(1);
    
    return result[0];
  }

  // Find loyalty records by patron ID
  async findByPatronId(patronId: string): Promise<Loyalty[]> {
    return await this.db
      .select()
      .from(loyalty)
      .where(eq(loyalty.patronId, patronId))
      .orderBy(desc(loyalty.issuedAt));
  }

  // Find loyalty records by tier
  async findByTier(tier: Loyalty['tier']): Promise<Loyalty[]> {
    return await this.db
      .select()
      .from(loyalty)
      .where(eq(loyalty.tier, tier))
      .orderBy(desc(loyalty.issuedAt));
  }

  // Find active (non-expired) loyalty records for patron
  async findActiveByPatronId(patronId: string): Promise<Loyalty[]> {
    const now = new Date();
    return await this.db
      .select()
      .from(loyalty)
      .where(
        and(
          eq(loyalty.patronId, patronId),
          gte(loyalty.expiresAt, now)
        )
      )
      .orderBy(desc(loyalty.issuedAt));
  }

  // Get total points for patron
  async getTotalPoints(patronId: string): Promise<number> {
    const records = await this.findActiveByPatronId(patronId);
    return records.reduce((sum, record) => sum + (record.points || 0), 0);
  }

  // Create new loyalty record
  async create(data: NewLoyalty): Promise<Loyalty> {
    await this.db.insert(loyalty).values(data);
    
    const created = await this.findById(data.id);
    if (!created) {
      throw new Error('Failed to create loyalty record');
    }
    
    return created;
  }

  // Award points to patron
  async awardPoints(patronId: string, points: number, description: string, id: string): Promise<Loyalty> {
    return await this.create({
      id,
      patronId,
      description,
      points,
      tier: null,
      reward: null,
      issuedAt: new Date(),
      expiresAt: null, // Points don't expire by default
    });
  }

  // Award reward to patron
  async awardReward(
    patronId: string, 
    reward: string, 
    description: string, 
    id: string,
    expiresAt?: Date
  ): Promise<Loyalty> {
    return await this.create({
      id,
      patronId,
      description,
      reward,
      tier: null,
      points: null,
      issuedAt: new Date(),
      expiresAt: expiresAt || null,
    });
  }

  // Update loyalty record
  async update(id: string, data: Partial<Omit<NewLoyalty, 'id'>>): Promise<Loyalty | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    await this.db
      .update(loyalty)
      .set(data)
      .where(eq(loyalty.id, id));

    return await this.findById(id);
  }

  // Delete loyalty record
  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(loyalty)
      .where(eq(loyalty.id, id));

    return result.changes > 0;
  }

  // Calculate and update patron tier based on total points
  async updatePatronTier(patronId: string): Promise<Loyalty['tier']> {
    const totalPoints = await this.getTotalPoints(patronId);
    
    let tier: Loyalty['tier'] = 'bronze';
    if (totalPoints >= 10000) tier = 'platinum';
    else if (totalPoints >= 5000) tier = 'gold';
    else if (totalPoints >= 2000) tier = 'silver';
    
    return tier;
  }
}

export default LoyaltyOperations;
