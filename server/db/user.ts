import type {
    User
} from '../../src/schemas'

import type { Database } from "bun:sqlite";

// ============================================================================
// FILE: src/server/db/operations/users.ts
// User CRUD operations
// ============================================================================


class UserOperations {
    private db: Database;

    // Prepared statements (cached automatically by Bun)
    private insertStmt;
    private updateStmt;
    private deleteStmt;
    private findByIdStmt;
    private findAllStmt;

    constructor(db: Database) {
        this.db = db;
        try {
            // Prepare all statements once
            this.insertStmt = db.query(`
      INSERT INTO users (id, email, firstName, lastName, phone, createdAt, updatedAt)
      VALUES ($id, $email, $firstName, $lastName, $phone, $createdAt, $updatedAt)
    `);

            this.updateStmt = db.query(`
      UPDATE users 
      SET email = $email, 
          firstName = $firstName, 
          lastName = $lastName, 
          phone = $phone,
          updatedAt = $updatedAt
      WHERE id = $id
    `);

            this.deleteStmt = db.query(`DELETE FROM users WHERE id = $id`);
            this.findByIdStmt = db.query(`SELECT * FROM users WHERE id = $id`);
            this.findAllStmt = db.query(`SELECT * FROM users ORDER BY createdAt DESC`);
        } catch (error) {
            if ((error as Error)?.message?.includes("no such table")) {
                throw new Error(
                    `❌ Database not seeded! The 'users' table doesn't exist.\n\n` +
                    `Please run the seed script first:\n` +
                    `  bun run src/server/db/seed.ts\n\n` +
                    `Original error: ${(error as Error).message}`
                );
            }
            throw error;
        }
    }

    // Convert DB row (with timestamp) to User object (with Date)
    private rowToUser(row: User): User {
        return {
            ...row,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    findAll(): User[] {
        const rows = this.findAllStmt.all() as User[];
        return rows.map(this.rowToUser);
    }

    findById(id: string): User | null {
        const row = this.findByIdStmt.get({ id }) as User;
        return row ? this.rowToUser(row) : null;
    }

    create(user: Omit<User, "createdAt" | "updatedAt">): User {
        const now = Date.now();
        const newUser: User = {
            ...user,
            createdAt: now,
            updatedAt: now,
        };

        this.insertStmt.run({
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            phone: newUser.phone ?? null,
            createdAt: newUser.createdAt,
            updatedAt: newUser.updatedAt,
        });

        return newUser;
    }

    update(id: string, updates: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>): User | null {
        const existing = this.findById(id);
        if (!existing) return null;

        const updated: User = {
            ...existing,
            ...updates,
            updatedAt: Date.now(),
        };

        this.updateStmt.run({
            id: updated.id,
            email: updated.email,
            firstName: updated.firstName,
            lastName: updated.lastName,
            phone: updated.phone ?? null,
            updatedAt: updated.updatedAt,
        });

        return updated;
    }

    delete(id: string): boolean {
        const result = this.deleteStmt.run({ id });
        return result.changes > 0;
    }

    // Bulk operations with transactions
    createMany(users: Omit<User, "createdAt" | "updatedAt">[]): User[] {
        const insertMany = this.db.transaction((users: Omit<User, "createdAt" | "updatedAt">[]) => {
            const created: User[] = [];
            for (const user of users) {
                created.push(this.create(user));
            }
            return created;
        });

        return insertMany(users);
    }
}

export default UserOperations;