import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";
import usersRoutes from "./routes/users";
import organizationsRoutes from "./routes/organizations";
import orgMembershipsRoutes from "./routes/org-memberships";
import eventsRoutes from "./routes/events";
import eventMembersRoutes from "./routes/event-members";
import attendanceRoutes from "./routes/attendance";
import loyaltyRoutes from "./routes/loyalty";
import analyticsRoutes from "./routes/analytics";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { isDevelopment } from 'std-env';
import { createAuthMiddleware } from "./middleware/auth";

const THROTTLE_DELAY = process.env.THROTTLE_DELAY ? Number(process.env.THROTTLE_DELAY) : 0;

// Create Hono app
export const app = new Hono();

// Export API Base URL for testing and client usage consistency
export const API_BASE_PATH = "/api/core";

// Middleware
app.use("*", logger());

// CORS configuration
if (isDevelopment) {
    console.log("⚙️  CORS: Development mode - allowing all origins");
    // Development: Allow all origins
    app.use("*", cors());

    // Apply throttle to API routes if THROTTLE_DELAY env var is set in dev mode
    if (THROTTLE_DELAY > 0) {
        // Throttle middleware for testing purposes
        const throttleMiddleware = (delayMs = 500) => createMiddleware(async (c, next) => {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            await next();
        });

        app.use(`${API_BASE_PATH}/*`, throttleMiddleware(THROTTLE_DELAY));
    }
} else {
    console.log("⚙️  CORS: Production mode - restricting origins");
    // Production: Restrict origins
    app.use("*", cors({
        origin: [
            "https://app.credopass.com",
            "https://credopass.com"
        ],
        credentials: true,
    }));
}

// Swagger UI documentation
app.get(`${API_BASE_PATH}/docs`, swaggerUI({
    url: `${API_BASE_PATH}/openapi.json`,
}));

// OpenAPI spec endpoint (you can expand this with your full API spec)
app.get(`${API_BASE_PATH}/openapi.json`, (c) => c.json({
    openapi: "3.0.0",
    info: {
        title: "CredoPass Core API",
        version: "2.0.0",
        description: "Multi-tenant attendance tracking platform API",
    },
    servers: [
        { url: isDevelopment ? "http://localhost:3000" : "https://api.credopass.com" }
    ],
    paths: {
        [`${API_BASE_PATH}/health`]: {
            get: {
                summary: "Health check",
                responses: { "200": { description: "Service is healthy" } }
            }
        },
        // Organizations (multi-tenancy)
        [`${API_BASE_PATH}/organizations`]: {
            get: { summary: "List organizations", tags: ["Organizations"] },
            post: { summary: "Create organization", tags: ["Organizations"] }
        },
        [`${API_BASE_PATH}/org-memberships`]: {
            get: { summary: "List org memberships", tags: ["Organizations"] },
            post: { summary: "Invite user to org", tags: ["Organizations"] }
        },
        // Users
        [`${API_BASE_PATH}/users`]: {
            get: { summary: "Get users", tags: ["Users"] },
            post: { summary: "Create user", tags: ["Users"] }
        },
        // Events
        [`${API_BASE_PATH}/events`]: {
            get: { summary: "Get events (filter by organizationId)", tags: ["Events"] },
            post: { summary: "Create event", tags: ["Events"] }
        },
        [`${API_BASE_PATH}/event-members`]: {
            get: { summary: "List event members", tags: ["Events"] },
            post: { summary: "Add member to event", tags: ["Events"] }
        },
        // Attendance
        [`${API_BASE_PATH}/attendance`]: {
            get: { summary: "Get attendance records", tags: ["Attendance"] },
            post: { summary: "Record attendance", tags: ["Attendance"] }
        },
        // Loyalty
        [`${API_BASE_PATH}/loyalty`]: {
            get: { summary: "Get loyalty data", tags: ["Loyalty"] },
            post: { summary: "Update loyalty", tags: ["Loyalty"] }
        },
        // Analytics (fabricated)
        [`${API_BASE_PATH}/analytics`]: {
            get: { summary: "Get analytics for a scope + range (scope=all|<eventId>, range=week|month|year)", tags: ["Analytics"] }
        }
    }
}));

// Health check
app.get(`${API_BASE_PATH}/health`, (c) => c.json({ status: "ok", timestamp: Date.now() }));

// Authentication: every API route below requires a verified Supabase JWT
app.use(`${API_BASE_PATH}/*`, createAuthMiddleware());

// API routes - Multi-tenancy
app.route(`${API_BASE_PATH}/organizations`, organizationsRoutes);
app.route(`${API_BASE_PATH}/org-memberships`, orgMembershipsRoutes);

// API routes - Core resources
app.route(`${API_BASE_PATH}/users`, usersRoutes);
app.route(`${API_BASE_PATH}/events`, eventsRoutes);
app.route(`${API_BASE_PATH}/event-members`, eventMembersRoutes);
app.route(`${API_BASE_PATH}/attendance`, attendanceRoutes);
app.route(`${API_BASE_PATH}/loyalty`, loyaltyRoutes);

// Analytics (fabricated for now; see services/core/src/analytics)
app.route(`${API_BASE_PATH}/analytics`, analyticsRoutes);


// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
    // Auth failures (and other HTTP exceptions) keep their status, e.g. 401
    if (err instanceof HTTPException) {
        return err.getResponse();
    }
    console.error("Server error:", err);
    return c.json({ error: "Internal server error" }, 500);
});

// Start server
const port = Number(process.env.PORT) || 3000;

console.log(`\n🔧 [server.ts] Attempting to start server on port ${port}`);
console.log(`   PORT env: ${process.env.PORT || 'not set (using default 3000)'}`);
console.log(`📦 Mode: ${isDevelopment ? "development" : "production"}`);
// Presence-only env check (never log values) so a misconfigured deploy is obvious.
const envStatus = (name: string) => `${name}=${process.env[name] ? '✓' : '✗ missing'}`;
console.log(`🔑 Env: ${['SUPABASE_URL', 'DATABASE_URL'].map(envStatus).join('  ')}`);

export default {
    port,
    fetch: app.fetch,
};

console.log(`🚀 [server.ts] Server successfully started on http://localhost:${port}`);