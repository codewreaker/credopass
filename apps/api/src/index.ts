// ============================================================================
// FILE: apps/api/src/index.ts
// Main Hono server entry point for DwellPass API
// ============================================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import { createMiddleware } from 'hono/factory';
import { isDevelopment } from 'std-env';
import { getDatabase } from '@dwellpass/server';
import { usersRouter, eventsRouter, attendanceRouter, loyaltyRouter } from './routes';

const THROTTLE_DELAY = Number(process.env.THROTTLE_DELAY) || 0;

// Initialize database connection
await getDatabase();
console.log('✓ Database initialized');

// Create Hono app
const app = new Hono();

// Throttle middleware for testing purposes
const throttleMiddleware = (delayMs = 500) => createMiddleware(async (c, next) => {
  await new Promise(resolve => setTimeout(resolve, delayMs));
  await next();
});

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Apply throttle to API routes if THROTTLE_DELAY env var is set
if (THROTTLE_DELAY > 0) {
  app.use('/api/*', throttleMiddleware(THROTTLE_DELAY));
}

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

// API routes
app.route('/api/users', usersRouter);
app.route('/api/events', eventsRouter);
app.route('/api/attendance', attendanceRouter);
app.route('/api/loyalty', loyaltyRouter);

// Serve static files in production
if (!isDevelopment) {
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));
}

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Start server
const port = Number(process.env.PORT) || 3000;

console.log(`\n🔧 [apps/api] Attempting to start API server on port ${port}`);
console.log(`   PORT env: ${process.env.PORT || 'not set (using default 3000)'}`);
console.log(`📦 Mode: ${isDevelopment ? 'development' : 'production'}`);

export default {
  port,
  fetch: app.fetch,
};

console.log(`🚀 [apps/api] API Server successfully started on http://localhost:${port}`);
