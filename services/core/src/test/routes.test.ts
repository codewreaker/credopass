
/**
 * Can test as below (ensure Postgres is running and DATABASE_URL is set):
 * DATABASE_URL='postgresql://postgres:Ax!rtrysoph123@localhost:5432/dwellpass_db' bun test services/core/src/test/routes.test.ts
 */

import { describe, expect, it } from "bun:test";
import { app, API_BASE_PATH } from "../index"; // We probably need to export 'app' from index.ts to test it.

// Mock data
const testUser = {
  email: `test-${crypto.randomUUID()}@example.com`,
  firstName: "Test",
  lastName: "User",
};

let userId: string;
let eventId: string;

describe("CRUD API Integration Tests", () => {

  it("should create a new user", async () => {
    const res = await app.request(`${API_BASE_PATH}/users`, {
        method: "POST",
        body: JSON.stringify(testUser),
        headers: { "Content-Type": "application/json" }
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.email).toBe(testUser.email);
    expect(data.id).toBeDefined();
    userId = data.id;
    console.log("Created User ID:", userId);
  });

  it("should create a new event for the user", async () => {
    // Requires a valid user ID as hostId
    expect(userId).toBeDefined();
    
    const testEvent = {
        name: "Test Event",
        description: "A test event description",
        status: "scheduled",
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        location: "Test Location",
        capacity: 100,
        hostId: userId 
    };

    const res = await app.request(`${API_BASE_PATH}/events`, {
        method: "POST",
        body: JSON.stringify(testEvent),
        headers: { "Content-Type": "application/json" }
    });
    
    // Debugging hooks
    if (res.status !== 201) {
        const err = await res.json();
        console.error("Create Event Failed:", err);
    }

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.hostId).toBe(userId);
    expect(data.id).toBeDefined();
    eventId = data.id;
  });

  it("should retrieve the created event", async () => {
    expect(eventId).toBeDefined();

    const res = await app.request(`${API_BASE_PATH}/events/${eventId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(eventId);
  });
});
