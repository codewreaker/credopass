// ============================================================================
// FILE: src/server/routes/users.ts
// Hono routes for users
// ============================================================================

import { Hono } from "hono";
import { z } from "zod";
import { getDatabase, UserOperations } from "../db";
import { UserSchema } from '../../src/entities/schemas'

const users = new Hono();

// Get database and operations
const db = getDatabase();
const userOps = new UserOperations(db);

// Validation schemas
const CreateUserSchema = UserSchema.omit({ createdAt: true, updatedAt: true });
const UpdateUserSchema = CreateUserSchema.partial().omit({ id: true });

// GET /api/users - Get all users
users.get("/",(c) => {
    try {
        const allUsers = userOps.findAll();
        const d = c.json(allUsers)
        return d;
    } catch (error) {
        console.error("Error fetching users:", error);
        return c.json({ error: "Failed to fetch users" }, 500);
    }
});

// GET /api/users/:id - Get user by ID
users.get("/:id", (c) => {
    try {
        const id = c.req.param("id");
        const user = userOps.findById(id);

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
users.post("/", async (c) => {
    try {
        const body = await c.req.json();
        const validated = CreateUserSchema.parse(body);

        const user = userOps.create(validated);
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
users.put("/:id", async (c) => {
    try {
        const id = c.req.param("id");
        const body = await c.req.json();
        const validated = UpdateUserSchema.parse(body);

        const user = userOps.update(id, validated);

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
users.delete("/:id", (c) => {
    try {
        const id = c.req.param("id");
        const deleted = userOps.delete(id);

        if (!deleted) {
            return c.json({ error: "User not found" }, 404);
        }

        return c.json({ success: true }, 200);
    } catch (error) {
        console.error("Error deleting user:", error);
        return c.json({ error: "Failed to delete user" }, 500);
    }
});

export default users;