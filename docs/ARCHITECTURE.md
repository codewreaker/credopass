# Architecture Guide

This document provides detailed architectural patterns, code examples, and design decisions for the CredoPass monorepo.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Routing Architecture](#routing-architecture)
- [State Management](#state-management)
- [API Communication](#api-communication)
- [Validation Layer](#validation-layer)
- [Database Layer](#database-layer)
- [Code Examples](#code-examples)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │         React App (apps/web)                     │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌──────────┐│  │
│  │  │  TanStack  │  │   Zustand    │  │ TanStack ││  │
│  │  │   Router   │  │    Stores    │  │    DB    ││  │
│  │  └────────────┘  └──────────────┘  └──────────┘│  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTP/Fetch
┌─────────────────────────────────────────────────────────┐
│              Hono API Server (services/core)            │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Middleware Stack                         │  │
│  │  [CORS] → [Logger] → [Throttle] → [Router]     │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Route Handlers                           │  │
│  │  /api/users | /api/events | /api/attendance    │  │
│  └──────────────────────────────────────────────────┘  │
│                          ↓                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Drizzle ORM                              │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              PostgreSQL Database                        │
│     Tables: users, events, attendance, loyalty          │
└─────────────────────────────────────────────────────────┘
```

### Monorepo Structure Pattern

**Apps** (deployable applications):
- `apps/web` - User-facing React SPA
- `services/core` - Backend API server

**Packages** (shared libraries):
- `packages/lib` - Validation schemas, utilities, constants
- `packages/ui` - Reusable UI components

**Design Principle**: Each package has a single, clear responsibility. No circular dependencies between packages.

---

## Routing Architecture

### TanStack Router - Explicit Route Tree

CredoPass uses TanStack Router with an **explicit route tree** pattern (not file-based convention).

#### Route Definition Pattern

**File**: `apps/web/src/routes.tsx`

```typescript
import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Layout } from './Pages/Layout';
import HomePage from './Pages/Home/HomePage';
import MembersPage from './Pages/Members/MembersPage';
import EventsPage from './Pages/Events/EventsPage';
import AnalyticsPage from './Pages/Analytics/AnalyticsPage';
import DatabasePage from './Pages/Tables/DatabasePage';

// Root route - provides layout for all pages
const rootRoute = createRootRoute({
  component: Layout,
});

// Define individual routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const membersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/members',
  component: MembersPage,
});

const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events',
  component: EventsPage,
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/analytics',
  component: AnalyticsPage,
});

const databaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/database',
  component: DatabasePage,
});

// Assemble route tree
export const routeTree = rootRoute.addChildren([
  indexRoute,
  membersRoute,
  eventsRoute,
  analyticsRoute,
  databaseRoute,
]);

// Create router instance
export const router = createRouter({ routeTree });

// Type augmentation for TypeScript
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```

#### Benefits of Explicit Route Tree

1. **Type Safety**: Full TypeScript autocomplete for route paths
2. **Clarity**: Easy to see all routes in one place
3. **Flexibility**: Programmatic route configuration
4. **No Magic**: Explicit parent-child relationships

#### Router Integration

**File**: `apps/web/src/main.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './routes';
import './index.css';

const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
}
```

---

## State Management

### Three-Layer State Architecture

CredoPass uses a **three-layer state management strategy**:

1. **Global UI State** (Zustand) - Sidebar, modals, UI-only state
2. **Server State** (TanStack Query) - API data, caching, mutations
3. **Local-First State** (TanStack DB) - Offline collections, sync

---

### Layer 1: Global UI State (Zustand)

**File**: `apps/web/src/stores/store.ts`

```typescript
import { create } from 'zustand';

// App Store - Sidebar and Events
interface AppState {
  sidebarOpen: boolean;
  events: Array<{ id: string; title: string; date: Date }>;
  toggleSidebar: () => void;
  addEvent: (event: { id: string; title: string; date: Date }) => void;
  removeEvent: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  events: [],
  
  toggleSidebar: () => 
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  
  addEvent: (event) => 
    set((state) => ({ events: [...state.events, event] })),
  
  removeEvent: (id) => 
    set((state) => ({ 
      events: state.events.filter((e) => e.id !== id) 
    })),
}));

// Launcher Store - Modal Management
interface LauncherState {
  launcher: {
    isOpen: boolean;
    content: React.ReactNode | null;
    onClose: () => void;
    onOpen: (content: React.ReactNode) => void;
  };
}

export const useLauncherStore = create<LauncherState>((set) => ({
  launcher: {
    isOpen: false,
    content: null,
    
    onClose: () => 
      set((state) => ({
        launcher: { ...state.launcher, isOpen: false, content: null }
      })),
    
    onOpen: (content) => 
      set((state) => ({
        launcher: { ...state.launcher, isOpen: true, content }
      })),
  },
}));
```

**Usage in Components**:

```typescript
import { useAppStore } from '@/stores/store';

function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useAppStore();
  
  return (
    <div className={sidebarOpen ? 'open' : 'closed'}>
      <button onClick={toggleSidebar}>Toggle</button>
    </div>
  );
}
```

---

### Layer 2: Server State (TanStack Query)

TanStack Query is used **implicitly** through TanStack DB collections. Direct usage is minimal.

**Example**: Manual TanStack Query usage (if needed)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get('/api/users'),
  });
}

function useCreateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userData) => apiClient.post('/api/users', userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
```

---

### Layer 3: Local-First State (TanStack DB)

**File**: `apps/web/src/lib/tanstack-db/index.ts`

```typescript
import { Database } from '@tanstack/db';
import { usersCollection } from './collections/users';
import { eventsCollection } from './collections/events';
import { attendanceCollection } from './collections/attendance';
import { loyaltyCollection } from './collections/loyalty';

export const db = new Database({
  collections: {
    users: usersCollection,
    events: eventsCollection,
    attendance: attendanceCollection,
    loyalty: loyaltyCollection,
  },
});

export { db as tanstackDB };
```

**Collection Definition Pattern**:

**File**: `apps/web/src/lib/tanstack-db/collections/users.ts`

```typescript
import { defineCollection } from '@tanstack/db';
import { z } from 'zod';

export const usersCollection = defineCollection({
  name: 'users',
  schema: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
  // Sync with backend API
  syncUrl: '/api/users',
});
```

**Usage in Components**:

```typescript
import { tanstackDB } from '@/lib/tanstack-db';

function MembersList() {
  const users = tanstackDB.collections.users.useFind();
  
  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.firstName} {user.lastName}</div>
      ))}
    </div>
  );
}
```

---

## API Communication

### Frontend-Backend Communication Patterns

#### Development Environment

**Vite Proxy Configuration** (`apps/web/vite.config.ts`):

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

**Flow**:
```
Browser → http://localhost:5173/api/users
         ↓ Vite Proxy
         → http://localhost:3000/api/users
         ↓ Hono Server
         → Response
```

#### Production Environment

**Vercel Rewrite Configuration** (`apps/web/vercel.json`):

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.credopass.com/api/:path*"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

**Flow**:
```
Browser → https://credopass.vercel.app/api/users
         ↓ Vercel Rewrite
         → https://api.credopass.com/api/users
         ↓ Cloud Run
         → Response
```

---

### API Client Pattern

**File**: `services/core/src/api/client.ts`

```typescript
import { env } from '@/config';

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T> {
    const { params, ...fetchOptions } = options;
    
    let url = `${this.baseUrl}${endpoint}`;
    
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      url += `?${queryString}`;
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(env.API_BASE_URL);
```

**Usage**:

```typescript
import { apiClient } from '@/api/client';

// GET request
const users = await apiClient.get('/api/users');

// POST request
const newUser = await apiClient.post('/api/users', {
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
});

// PUT request
const updated = await apiClient.put(`/api/users/${userId}`, updateData);

// DELETE request
await apiClient.delete(`/api/users/${userId}`);
```

---

## Validation Layer

### Two-Schema Pattern

CredoPass uses **two separate schema systems** that must be kept in sync:

1. **Zod Schemas** (`packages/lib/src/schemas/`) - API validation
2. **Drizzle Schemas** (`services/core/src/db/schema/`) - Database tables

---

### Zod Validation Schemas

**File**: `packages/lib/src/schemas/user.schema.ts`

```typescript
import { z } from 'zod';

// Base schema - represents database row
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Insert schema - for creating new users (omits auto-generated fields)
export const InsertUserSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Create schema - for API request validation
export const CreateUserSchema = InsertUserSchema;

// Update schema - all fields optional except ID
export const UpdateUserSchema = UserSchema.omit({
  createdAt: true,
  updatedAt: true,
}).partial().required({ id: true });

// Type exports
export type User = z.infer<typeof UserSchema>;
export type InsertUser = z.infer<typeof InsertUserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
```

**Usage in API Routes**:

```typescript
import { CreateUserSchema } from '@credopass/lib';

app.post('/api/users', async (c) => {
  const body = await c.req.json();
  
  // Validate with Zod
  const validated = CreateUserSchema.parse(body);
  
  // Insert into database
  // ...
});
```

---

### Drizzle Database Schemas

**File**: `services/core/src/db/schema/user.schema.ts`

```typescript
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  firstName: text('firstName').notNull(),
  lastName: text('lastName').notNull(),
  phone: text('phone'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
}, (table) => [
  index('idx_users_email').on(table.email),
  index('idx_users_created_at').on(table.createdAt),
]);
```

**⚠️ Important**: Zod and Drizzle schemas must match manually. There's no automatic sync.

---

## Database Layer

### Database Client Factory

**File**: `services/core/src/db/client.ts`

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePGlite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';
import { env } from '@/config';
import * as schema from './schema';

let dbInstance: ReturnType<typeof drizzle> | null = null;

export async function getDatabase() {
  if (dbInstance) return dbInstance;

  // Production: Use PostgreSQL
  if (env.DATABASE_URL) {
    const client = postgres(env.DATABASE_URL);
    dbInstance = drizzle(client, { schema });
    return dbInstance;
  }

  // Development fallback: Use PGlite
  console.warn('DATABASE_URL not set, using PGlite fallback');
  const pglite = new PGlite();
  dbInstance = drizzlePGlite(pglite, { schema });
  
  // Run migrations for PGlite
  // await migrate(dbInstance, { migrationsFolder: './drizzle' });
  
  return dbInstance;
}
```

**Auto-Detection Logic**:
- If `DATABASE_URL` exists → Use PostgreSQL
- If `DATABASE_URL` missing → Fall back to PGlite (in-memory)

---

## Code Examples

### Complete API Endpoint Example

**File**: `services/core/src/routes/users.ts`

```typescript
import { Hono } from 'hono';
import { desc } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { users } from '@/db/schema';
import { CreateUserSchema, UpdateUserSchema } from '@credopass/lib';

const usersRouter = new Hono();

// GET /api/users - List all users
usersRouter.get('/', async (c) => {
  const db = await getDatabase();
  const allUsers = await db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt));
  
  return c.json(allUsers);
});

// GET /api/users/:id - Get single user
usersRouter.get('/:id', async (c) => {
  const db = await getDatabase();
  const { id } = c.req.param();
  
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  
  if (!user[0]) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  return c.json(user[0]);
});

// POST /api/users - Create user
usersRouter.post('/', async (c) => {
  const db = await getDatabase();
  const body = await c.req.json();
  
  // Validate request
  const validated = CreateUserSchema.parse(body);
  
  // Insert into database
  const [newUser] = await db
    .insert(users)
    .values({
      ...validated,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  
  return c.json(newUser, 201);
});

// PUT /api/users/:id - Update user
usersRouter.put('/:id', async (c) => {
  const db = await getDatabase();
  const { id } = c.req.param();
  const body = await c.req.json();
  
  // Validate request
  const validated = UpdateUserSchema.parse({ ...body, id });
  
  // Update in database
  const [updated] = await db
    .update(users)
    .set({
      ...validated,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();
  
  if (!updated) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  return c.json(updated);
});

// DELETE /api/users/:id - Delete user
usersRouter.delete('/:id', async (c) => {
  const db = await getDatabase();
  const { id } = c.req.param();
  
  await db.delete(users).where(eq(users.id, id));
  
  return c.json({ message: 'User deleted' });
});

export default usersRouter;
```

---

### Complete Hono Server Setup

**File**: `services/core/src/index.ts`

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './config';
import usersRouter from './routes/users';
import eventsRouter from './routes/events';
import attendanceRouter from './routes/attendance';
import loyaltyRouter from './routes/loyalty';

const app = new Hono();

// Middleware
app.use('*', cors({
  origin: env.NODE_ENV === 'development' 
    ? '*' 
    : ['https://credopass.vercel.app', 'https://credopass.com'],
  credentials: true,
}));

app.use('*', logger());

// Optional throttle middleware for testing
if (env.THROTTLE) {
  app.use('*', async (c, next) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await next();
  });
}

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount route handlers
app.route('/api/users', usersRouter);
app.route('/api/events', eventsRouter);
app.route('/api/attendance', attendanceRouter);
app.route('/api/loyalty', loyaltyRouter);

// Start server
const port = env.PORT || 3000;
console.log(`🚀 Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
```

---

## Design Principles

1. **Separation of Concerns**: Clear boundaries between frontend, backend, and shared code
2. **Type Safety**: End-to-end TypeScript with Zod validation
3. **Offline-First**: TanStack DB for local data persistence
4. **API-First**: Backend provides RESTful API, frontend consumes it
5. **Developer Experience**: Fast builds, hot reload, excellent tooling
6. **Explicit Over Implicit**: Prefer explicit configuration (route tree, schemas)

---

For deployment architecture, see [DEPLOYMENT.md](DEPLOYMENT.md).
