// ============================================================================
// FILE: server/api/users.ts
// Users API - Using BaseAPI pattern
// ============================================================================

import { Hono } from "hono";
import { z } from "zod";
import { desc, eq } from 'drizzle-orm';
import { BaseAPI } from './BaseAPI';
import { users, type User, type NewUser } from '../db/schema';
import { UserSchema } from '../../src/entities/schemas';

// ============================================================================
// UserAPI - Extends BaseAPI with custom methods
// ============================================================================

class UserAPI extends BaseAPI<User, NewUser, typeof users> {
  protected readonly table = users;
  protected readonly tableName = 'users';

  /**
   * Find user by email (custom query using Drizzle directly)
   */
  async findByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await this.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      
      return result[0];
    } catch (error) {
      throw new Error(`Failed to find user by email: ${error}`);
    }
  }

  /**
   * Find all users ordered by creation date (custom query)
   */
  async findAllOrdered(): Promise<User[]> {
    try {
      return await this.db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt));
    } catch (error) {
      throw new Error(`Failed to find ordered users: ${error}`);
    }
  }
}

// Initialize API
const userAPI = new UserAPI();

// ============================================================================
// HTTP Routes
// ============================================================================

const usersRouter = new Hono();

// Validation schemas
const CreateUserSchema = UserSchema.omit({ createdAt: true, updatedAt: true });
const UpdateUserSchema = CreateUserSchema.partial().omit({ id: true });

// GET /api/users - Get all users
usersRouter.get("/", async (c) => {
    try {
        const allUsers = await userAPI.findAllOrdered();
        return c.json(allUsers);
    } catch (error) {
        console.error("Error fetching users:", error);
        return c.json({ error: "Failed to fetch users" }, 500);
    }
});

// GET /api/users/:id - Get user by ID
usersRouter.get("/:id", async (c) => {
    try {
        const id = c.req.param("id");
        const user = await userAPI.findById(id);

        if (!user) {
            return c.json({ error: "User not found" }, 404);
        }

        return c.json(user);
    } catch (error) {
        console.error("Error fetching user:", error);
        return c.json({ error: "Failed to fetch user" }, 500);
    }
});

// POST /api/users - Create new user
usersRouter.post("/", async (c) => {
    try {
        const body = await c.req.json();
        const validated = CreateUserSchema.parse(body);

        // Check if email exists
        const existing = await userAPI.findByEmail(validated.email);
        if (existing) {
            return c.json({ error: "User with this email already exists" }, 409);
        }

        // Add timestamps
        const now = new Date();
        const user = await userAPI.create({
            ...validated,
            createdAt: now,
            updatedAt: now,
        });

        return c.json(user, 201);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: "Validation failed", details: error.issues }, 400);
        }
        console.error("Error creating user:", error);
        return c.json({ error: "Failed to create user" }, 500);
    }
});

// PUT /api/users/:id - Update user
usersRouter.put("/:id", async (c) => {
    try {
        const id = c.req.param("id");
        const body = await c.req.json();
        const validated = UpdateUserSchema.parse(body);

        // If updating email, check for conflicts
        if (validated.email) {
            const existing = await userAPI.findByEmail(validated.email);
            if (existing && existing.id !== id) {
                return c.json({ error: "Email already in use" }, 409);
            }
        }

        const user = await userAPI.update(id, {
            ...validated,
            updatedAt: new Date(),
        });

        if (!user) {
            return c.json({ error: "User not found" }, 404);
        }

        return c.json(user);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: "Validation failed", details: error.issues }, 400);
        }
        console.error("Error updating user:", error);
        return c.json({ error: "Failed to update user" }, 500);
    }
});

// DELETE /api/users/:id - Delete user
usersRouter.delete("/:id", async (c) => {
    try {
        const id = c.req.param("id");
        const deleted = await userAPI.delete(id);

        if (!deleted) {
            return c.json({ error: "User not found" }, 404);
        }

        return c.json({ success: true }, 200);
    } catch (error) {
        console.error("Error deleting user:", error);
        return c.json({ error: "Failed to delete user" }, 500);
    }
});

export default usersRouter;
