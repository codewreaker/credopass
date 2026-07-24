import { Hono } from 'hono';
import { AnalyticsQuerySchema } from '@credopass/lib/analytics';
import { buildAnalytics } from '../analytics';
import { getDatabase } from '../db/client';
import { events } from '@credopass/lib/schemas';
import { eq } from 'drizzle-orm';

/**
 * Analytics endpoint.
 *
 * The numbers are fabricated for now (deterministic generator in ../analytics),
 * but this lives behind the same auth as the rest of the API and reads the real
 * event name for the scope label, so the wiring is production-shaped. Swapping
 * the generator for real aggregates later is a change inside ../analytics only.
 */
const analyticsRouter = new Hono();

// GET / - fabricated analytics for a scope + range
analyticsRouter.get('/', async (c) => {
  const parsed = AnalyticsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: 'Invalid query', details: parsed.error.issues }, 400);
  }
  const { scope, range } = parsed.data;

  // Resolve a human label so the UI header reads the event name, not the id.
  let scopeLabel: string | undefined;
  if (scope !== 'all') {
    try {
      const db = await getDatabase();
      const row = await db
        .select({ name: events.name })
        .from(events)
        .where(eq(events.id, scope))
        .limit(1);
      scopeLabel = row[0]?.name;
    } catch {
      // Label is cosmetic — fall back to the generic one if the lookup fails.
    }
  }

  return c.json(buildAnalytics({ scope, range, scopeLabel }));
});

export default analyticsRouter;
