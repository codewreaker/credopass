import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import usersRoutes from "./routes/users";
import eventsRoutes from "./routes/events";
import attendanceRoutes from "./routes/attendance";
import loyaltyRoutes from "./routes/loyalty";
import { createMiddleware } from "hono/factory";
import { isDevelopment } from 'std-env';

const THROTTLE_DELAY = process.env.THROTTLE_DELAY ? Number(process.env.THROTTLE_DELAY) : 0;

// Create Hono app
export const app = new Hono();

// Export API Base URL for testing and client usage consistency
export const API_BASE_PATH = "/api";

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

        app.use("/api/*", throttleMiddleware(THROTTLE_DELAY));
    }
} else {
    console.log("⚙️  CORS: Production mode - restricting origins");
    // Production: Restrict origins
    app.use("*", cors({
        origin: ["https://yourdomain.com"], // Add your production domain
        credentials: true,
    }));
}



// Health check
app.get(`${API_BASE_PATH}/health`, (c) => c.json({ status: "ok", timestamp: Date.now() }));

// API routes
app.route(`${API_BASE_PATH}/users`, usersRoutes);
app.route(`${API_BASE_PATH}/events`, eventsRoutes);
app.route(`${API_BASE_PATH}/attendance`, attendanceRoutes);
app.route(`${API_BASE_PATH}/loyalty`, loyaltyRoutes);


// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
    console.error("Server error:", err);
    return c.json({ error: "Internal server error" }, 500);
});

// Start server
const port = Number(process.env.PORT) || 3000;

console.log(`\n🔧 [server.ts] Attempting to start server on port ${port}`);
console.log(`   PORT env: ${process.env.PORT || 'not set (using default 3000)'}`);
console.log(`📦 Mode: ${isDevelopment ? "development" : "production"}`);

export default {
    port,
    fetch: app.fetch,
};

console.log(`🚀 [server.ts] Server successfully started on http://localhost:${port}`);