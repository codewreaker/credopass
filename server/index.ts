// ============================================================================
// FILE: server/index.ts
// Main Hono server entry point
// ============================================================================

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import { getDatabase, initializeSchema } from "./db";
import usersRoutes from "./routes/users";
import { createMiddleware } from "hono/factory";
import { isDevelopment } from 'std-env'

const THROTTLE_DELAY = 0;

// Initialize database
const db = getDatabase();
initializeSchema(db);

// Create Hono app
const app = new Hono();

// Throttle middleware for testing purposes
const throttleMiddleware = (delayMs = 500) => createMiddleware(async (c, next) => {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await next();
});

// Middleware
app.use("*", logger());
app.use("*", cors());

// Apply throttle to API routes if THROTTLE_DELAY env var is set
if (THROTTLE_DELAY > 0) {
    app.use("/api/*", throttleMiddleware(THROTTLE_DELAY));
}

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

// API routes
app.route("/api/users", usersRoutes);

// Serve static files in production
if (!isDevelopment) {
    app.use("/*", serveStatic({ root: "./dist" }));
    app.get("*", serveStatic({ path: "./dist/index.html" }));
}

// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
    console.error("Server error:", err);
    return c.json({ error: "Internal server error" }, 500);
});

// Start server
const port = Number(process.env.PORT) || 3000;

export default {
    port,
    fetch: app.fetch,
};

console.log(`🚀 Server running on http://localhost:${port}`);
console.log(`📦 Mode: ${isDevelopment ? "development" : "production"}`);