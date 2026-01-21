import { Hono } from 'hono';
import { z } from 'zod';
import { eq, desc, and } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import type { PgTable } from 'drizzle-orm/pg-core';

export type CrudOptions<T extends PgTable> = {
  table: T;
  createSchema: z.ZodType<any>;
  updateSchema: z.ZodType<any>;
  sortField?: any; // Drizzle column
  allowedFilters?: string[];
  uniqueFields?: string[];
  transformBody?: (body: any) => any;
};

export function createCrudRoute<T extends PgTable>(options: CrudOptions<T>) {
  const router = new Hono();
  const { table, createSchema, updateSchema, sortField, allowedFilters = [], uniqueFields = [], transformBody } = options;

  // GET / - List all with filtering
  router.get('/', async (c) => {
    try {
      const db = await getDatabase();
      //@ts-ignore todo investigate
      let query = db.select().from(table).$dynamic();

      // Apply filters
      const filters: any[] = [];
      const queryParams = c.req.query();

      for (const [key, value] of Object.entries(queryParams)) {
        if (allowedFilters.includes(key) && value) {
          // @ts-ignore - We trust the allowedFilters match table columns
          filters.push(eq(table[key], value));
        }
      }

      if (filters.length > 0) {
        query = query.where(and(...filters));
      }

      // Apply sorting
      if (sortField) {
        query = query.orderBy(desc(sortField));
      }

      const results = await query;
      return c.json(results);
    } catch (error) {
      console.log('// GET / - List all with filtering', error);
      return c.json({ error: 'Failed to fetch records' }, 500);
    }
  });

  // GET /:id - Get one by ID
  router.get('/:id', async (c) => {
    try {
      const db = await getDatabase();
      const id = c.req.param('id');

      const result = await db
        .select()
        //@ts-ignore todo investigate
        .from(table)
        // @ts-ignore - Assuming 'id' column exists
        .where(eq(table.id, id))
        .limit(1);

      if (!result[0]) {
        return c.json({ error: 'Record not found' }, 404);
      }

      return c.json(result[0]);
    } catch (error) {
      console.log('// GET /:id - Get one by ID', error);
      return c.json({ error: 'Failed to fetch record' }, 500);
    }
  });

  // POST / - Create
  router.post('/', async (c) => {
    try {
      const db = await getDatabase();
      let body = await c.req.json();

      if (transformBody) {
        body = transformBody(body);
      }

      const validated = createSchema.parse(body);

      // Check uniqueness
      for (const field of uniqueFields) {
        if (validated[field]) {
          const existing = await db
            .select()
            //@ts-ignore todo investigate
            .from(table)
            // @ts-ignore
            .where(eq(table[field], validated[field]))
            .limit(1);

          if (existing[0]) {
            return c.json({ error: `${field} must be unique` }, 409);
          }
        }
      }

      // Automatically generate ID and timestamps to ensure consistency
      const now = new Date();
      const values = {
        ...validated,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      };

      const result = await db
        .insert(table)
        .values(values)
        .returning();

      return c.json(result[0], 201);
    } catch (error) {
      console.log('// POST / - Create', error);
      if (error instanceof z.ZodError) {
        return c.json({ error: 'Validation failed', details: error.issues }, 400);
      }
      return c.json({ error }, 500);
    }
  });

  // PUT /:id - Update
  router.put('/:id', async (c) => {
    try {
      const db = await getDatabase();
      const id = c.req.param('id');
      let body = await c.req.json();

      if (transformBody) {
        body = transformBody(body);
      }

      const validated = updateSchema.parse(body);

      // Check uniqueness if updating unique fields
      for (const field of uniqueFields) {
        if (validated[field]) {
          // Check if another record has this value
          await db
            .select()
            //@ts-ignore todo investigate
            .from(table)
            // @ts-ignore
            .where(and(eq(table[field], validated[field]), ne(table.id, id))) // Note: ne needs import
            .limit(1);
        }
      }

      const now = new Date();
      const values = {
        ...validated,
        updatedAt: now,
      };

      const result = await db
        .update(table)
        .set(values)
        // @ts-ignore
        .where(eq(table.id, id))
        .returning();

      //@ts-ignore todo investigate
      if (!result[0]) {
        return c.json({ error: 'Record not found' }, 404);
      }

      //@ts-ignore todo investigate
      return c.json(result[0]);
    } catch (error) {
      console.log('// PUT /:id - Update', error);
      if (error instanceof z.ZodError) {
        return c.json({ error: 'Validation failed', details: error.issues }, 400);
      }
      console.error('Error updating record:', error);
      return c.json({ error }, 500);
    }
  });

  // DELETE /:id
  router.delete('/:id', async (c) => {
    try {
      const db = await getDatabase();
      const id = c.req.param('id');

      const result = await db
        .delete(table)
        // @ts-ignore
        .where(eq(table.id, id))
        .returning();

      if (!result[0]) {
        return c.json({ error: 'Record not found' }, 404);
      }

      return c.json({ message: 'Record deleted successfully' });
    } catch (error) {
      console.error('Error deleting record:', error);
      return c.json({ error: 'Failed to delete record' }, 500);
    }
  });

  return router;
}
