// ============================================================================
// FILE: server/api/BaseAPI.ts
// Base API with Database Manager - Simple pattern for all APIs
// ============================================================================

import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import * as schema from '../db/schema';

// ============================================================================
// Database Manager (Singleton)
// ============================================================================

class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private db: BunSQLiteDatabase<typeof schema> | null = null;
  private client: Database | null = null;
  private readonly dbPath: string;

  private constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'dwellpass.db');
  }

  public static getInstance(dbPath?: string): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(dbPath);
    }
    return DatabaseManager.instance;
  }

  public getDatabase(): BunSQLiteDatabase<typeof schema> {
    if (!this.db) {
      this.initializeDatabase();
    }
    return this.db!;
  }

  public getClient(): Database {
    if (!this.client) {
      this.initializeDatabase();
    }
    return this.client!;
  }

  private initializeDatabase(): void {
    if (!this.client) {
      this.client = new Database(this.dbPath, {
        create: true,
        strict: true,
      });

      // Optimize SQLite settings
      this.client.run('PRAGMA journal_mode = WAL;');
      this.client.run('PRAGMA synchronous = NORMAL;');
      this.client.run('PRAGMA cache_size = -64000;');
      this.client.run('PRAGMA temp_store = MEMORY;');
      this.client.run('PRAGMA foreign_keys = ON;');
      
      console.log(`✓ Database connected: ${this.dbPath}`);
    }

    if (!this.db) {
      this.db = drizzle(this.client, { schema });
    }
  }

  public close(): void {
    if (this.client) {
      this.client.close();
      this.client = null;
      this.db = null;
    }
  }
}

// ============================================================================
// Base API Class
// ============================================================================

/**
 * BaseAPI - Simple base class for CRUD operations with error handling
 * 
 * @template TEntity - The entity type (e.g., User)
 * @template TInsert - The insert type (e.g., NewUser)
 * @template TTable - The Drizzle table type
 * 
 * @example
 * ```typescript
 * class UserAPI extends BaseAPI<User, NewUser, typeof users> {
 *   protected readonly table = users;
 *   protected readonly tableName = 'users';
 * }
 * ```
 */
export abstract class BaseAPI<TEntity, TInsert, TTable> {
  protected readonly db: BunSQLiteDatabase<typeof schema>;
  protected readonly client: Database;
  protected abstract readonly table: TTable;
  protected abstract readonly tableName: string;

  constructor() {
    const dbManager = DatabaseManager.getInstance();
    this.db = dbManager.getDatabase();
    this.client = dbManager.getClient();
  }

  /**
   * Find by ID with error handling
   */
  async findById(id: string): Promise<TEntity | undefined> {
    try {
      const result = await this.db
        .select()
        .from(this.table as any)
        .where(eq((this.table as any).id, id))
        .limit(1);

      return result[0] as TEntity | undefined;
    } catch (error) {
      throw new Error(`Failed to find ${this.tableName} by ID: ${error}`);
    }
  }

  /**
   * Find all with error handling
   */
  async findAll(): Promise<TEntity[]> {
    try {
      const result = await this.db
        .select()
        .from(this.table as any);

      return result as TEntity[];
    } catch (error) {
      throw new Error(`Failed to find all ${this.tableName}: ${error}`);
    }
  }

  /**
   * Create with error handling
   */
  async create(data: TInsert): Promise<TEntity> {
    try {
      const result = await this.db
        .insert(this.table as any)
        .values(data)
        .returning();

      return result[0] as TEntity;
    } catch (error) {
      throw new Error(`Failed to create ${this.tableName}: ${error}`);
    }
  }

  /**
   * Update with error handling
   */
  async update(id: string, data: Partial<TInsert>): Promise<TEntity | undefined> {
    try {
      const result = await this.db
        .update(this.table as any)
        .set(data)
        .where(eq((this.table as any).id, id))
        .returning();

      return result[0] as TEntity | undefined;
    } catch (error) {
      throw new Error(`Failed to update ${this.tableName}: ${error}`);
    }
  }

  /**
   * Delete with error handling
   */
  async delete(id: string): Promise<boolean> {
    try {
      const existing = await this.findById(id);
      if (!existing) {
        return false;
      }

      await this.db
        .delete(this.table as any)
        .where(eq((this.table as any).id, id));

      return true;
    } catch (error) {
      throw new Error(`Failed to delete ${this.tableName}: ${error}`);
    }
  }
}
