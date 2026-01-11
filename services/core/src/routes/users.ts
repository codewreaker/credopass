import { Hono } from 'hono';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { users } from '../db/schema';
import { UserSchema } from '@credopass/lib';

const usersRouter = new Hono();

// Validation schemas
const CreateUserSchema = UserSchema.omit({ createdAt: true, updatedAt: true });
const UpdateUserSchema = CreateUserSchema.partial().omit({ id: true });

// GET /api/users - Get all users
usersRouter.get('/', async (c) => {
  try {
    const db = await getDatabase();
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
    return c.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// GET /api/users/:id - Get user by ID
usersRouter.get('/:id', async (c) => {
  try {
    const db = await getDatabase();
    const id = c.req.param('id');
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!result[0]) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(result[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// POST /api/users - Create new user
usersRouter.post('/', async (c) => {
  try {
    const db = await getDatabase();
    const body = await c.req.json();
    const validated = CreateUserSchema.parse(body);

    // Check if email exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, validated.email))
      .limit(1);

    if (existing[0]) {
      return c.json({ error: 'User with this email already exists' }, 409);
    }

    // Add timestamps and id
    const now = new Date();
    const result = await db
      .insert(users)
      .values({
        ...validated,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json(result[0], 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.issues }, 400);
    }
    console.error('Error creating user:', error);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// PUT /api/users/:id - Update user
usersRouter.put('/:id', async (c) => {
  try {
    const db = await getDatabase();
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = UpdateUserSchema.parse(body);

    // If updating email, check for conflicts
    if (validated.email) {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, validated.email))
        .limit(1);

      if (existing[0] && existing[0].id !== id) {
        return c.json({ error: 'Email already in use' }, 409);
      }
    }

    const result = await db
      .update(users)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (!result[0]) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(result[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.issues }, 400);
    }
    console.error('Error updating user:', error);
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

// DELETE /api/users/:id - Delete user
usersRouter.delete('/:id', async (c) => {
  try {
    const db = await getDatabase();
    const id = c.req.param('id');

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existing[0]) {
      return c.json({ error: 'User not found' }, 404);
    }

    await db.delete(users).where(eq(users.id, id));

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('Error deleting user:', error);
    return c.json({ error: 'Failed to delete user' }, 500);
  }
});

export default usersRouter;
