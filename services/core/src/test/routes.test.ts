/**
 * Integration tests for the Core API against the live schema.
 *
 * Requires a reachable Postgres (DATABASE_URL) and Supabase project
 * (SUPABASE_URL + SUPABASE_ANON_KEY) so a real guest JWT can be minted
 * for the now-authenticated routes. When those aren't set the suite
 * skips itself rather than failing, so it's safe in a bare CI checkout.
 *
 * Run locally:
 *   DATABASE_URL='postgres://...' \
 *   SUPABASE_URL='https://<ref>.supabase.co' \
 *   SUPABASE_ANON_KEY='<anon key>' \
 *   bun test services/core/src/test/routes.test.ts
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { createClient } from "@supabase/supabase-js";
import { app, API_BASE_PATH } from "../index";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const hasEnv = Boolean(process.env.DATABASE_URL && SUPABASE_URL && SUPABASE_ANON_KEY);

const suite = hasEnv ? describe : describe.skip;

let authHeaders: Record<string, string> = {};

const unique = () => crypto.randomUUID().slice(0, 8);

suite("Core API integration (live schema, authenticated)", () => {
  let orgId: string;
  let userId: string;
  let eventId: string;

  beforeAll(async () => {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.session) {
      throw new Error(`Could not mint a test token: ${error?.message}`);
    }
    authHeaders = {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    };
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await app.request(`${API_BASE_PATH}/events`);
    expect(res.status).toBe(401);
  });

  it("creates an organization (plan is server-forced to 'free')", async () => {
    const res = await app.request(`${API_BASE_PATH}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: `Test Org ${unique()}`,
        slug: `test-org-${unique()}`,
        // Attempt to self-assign enterprise: must be ignored.
        plan: "enterprise",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.plan).toBe("free");
    orgId = data.id;
  });

  it("creates a user", async () => {
    const res = await app.request(`${API_BASE_PATH}/users`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        email: `test-${unique()}@example.com`,
        firstName: "Test",
        lastName: "User",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    userId = data.id;
  });

  it("creates an event scoped to the organization", async () => {
    expect(orgId).toBeDefined();
    const res = await app.request(`${API_BASE_PATH}/events`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        organizationId: orgId,
        name: "Test Event",
        description: "A test event description",
        status: "scheduled",
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        location: "Test Location",
        capacity: 100,
      }),
    });
    if (res.status !== 201) console.error("Create Event Failed:", await res.clone().json());
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.organizationId).toBe(orgId);
    eventId = data.id;
  });

  it("links the user to the event via event_members (replaces the old hostId)", async () => {
    expect(eventId).toBeDefined();
    expect(userId).toBeDefined();
    const res = await app.request(`${API_BASE_PATH}/event-members`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ eventId, userId, role: "organizer" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.eventId).toBe(eventId);
    expect(data.userId).toBe(userId);
    expect(data.role).toBe("organizer");
  });

  it("retrieves the created event", async () => {
    const res = await app.request(`${API_BASE_PATH}/events/${eventId}`, { headers: authHeaders });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(eventId);
  });
});
