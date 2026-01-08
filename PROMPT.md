# DwellPass Nx Monorepo Refactoring Guide

## 🎯 Project Objective

Refactor the existing DwellPass application into a production-ready **Nx monorepo** that enables independent deployment of:
- **UI Frontend** → Vercel
- **API Server** → Google Cloud Run
- **Database** → Supabase Postgres
- **Shared UI Component Library** → Reusable across multiple frontends

## 📋 Current Architecture

The current DwellPass application is a monolithic structure with:
- **Runtime**: Bun >= 1.3.0
- **Frontend**: React 19.2.1 with TanStack Router, TanStack DB (local-first), AG Grid, FullCalendar
- **Backend**: Hono 4.10.7 API server with RESTful endpoints
- **Database**: Drizzle ORM 0.45.1 with PostgreSQL (currently using PGlite for dev)
- **Build Tool**: Vite (Rolldown) 7.3.0
- **Styling**: TailwindCSS 4.1.18 with shadcn/ui components

### Key Technologies from package.json
```json
{
  "dependencies": {
    "@base-ui/react": "^1.0.0",
    "@electric-sql/pglite": "^0.3.14",
    "@tanstack/react-db": "^0.1.60",
    "@tanstack/react-query": "^5.90.12",
    "@tanstack/react-router": "^1.140.5",
    "ag-grid-react": "^35.0.0",
    "drizzle-orm": "^0.45.1",
    "hono": "^4.10.7",
    "postgres": "^3.4.7",
    "recharts": "3.6.0",
    "zustand": "^5.0.9"
  }
}
```

## 🏗️ Target Monorepo Structure

Create an Nx monorepo with the following structure:

```
dwellpass-monorepo/
├── apps/
│   ├── web/                          # Main web application (Vercel)
│   │   ├── src/
│   │   │   ├── routes/              # TanStack Router routes
│   │   │   ├── components/          # App-specific components
│   │   │   ├── lib/                 # App-specific utilities
│   │   │   ├── stores/              # Zustand stores
│   │   │   └── main.tsx             # Entry point
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.ts
│   │   └── project.json             # Nx project config
│   │
│   ├── api/                          # Hono API server (Google Cloud Run)
│   │   ├── src/
│   │   │   ├── index.ts             # Server entry point
│   │   │   ├── routes/              # API route handlers
│   │   │   │   ├── users.ts
│   │   │   │   ├── events.ts
│   │   │   │   ├── attendance.ts
│   │   │   │   └── loyalty.ts
│   │   │   └── middleware/          # Hono middleware
│   │   ├── Dockerfile               # Container for Cloud Run
│   │   ├── .dockerignore
│   │   ├── tsconfig.json
│   │   └── project.json
│   │
│   └── api-admin/                    # Future: Admin API (optional)
│
├── packages/
│   ├── ui/                           # Shared UI component library
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/              # shadcn/ui primitives
│   │   │   │   │   ├── button.tsx
│   │   │   │   │   ├── card.tsx
│   │   │   │   │   ├── dialog.tsx
│   │   │   │   │   └── ...
│   │   │   │   ├── data-grid.tsx    # AG Grid wrapper
│   │   │   │   ├── calendar.tsx     # FullCalendar wrapper
│   │   │   │   ├── charts/          # Recharts wrappers
│   │   │   │   └── index.ts
│   │   │   ├── hooks/               # Shared React hooks
│   │   │   ├── lib/                 # Utilities (cn, etc.)
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.ts       # Base Tailwind config
│   │   └── project.json
│   │
│   ├── database/                     # Database schema & utilities
│   │   ├── src/
│   │   │   ├── schema/              # Drizzle schema definitions
│   │   │   │   ├── users.ts
│   │   │   │   ├── events.ts
│   │   │   │   ├── attendance.ts
│   │   │   │   ├── loyalty.ts
│   │   │   │   └── index.ts
│   │   │   ├── migrations/          # Drizzle migrations
│   │   │   ├── seed.ts              # Seed data
│   │   │   ├── migrate.ts           # Migration runner
│   │   │   ├── client.ts            # Database client factory
│   │   │   └── index.ts
│   │   ├── drizzle.config.ts
│   │   ├── tsconfig.json
│   │   └── project.json
│   │
│   ├── validation/                   # Shared Zod schemas & types
│   │   ├── src/
│   │   │   ├── schemas/
│   │   │   │   ├── user.schema.ts
│   │   │   │   ├── event.schema.ts
│   │   │   │   ├── attendance.schema.ts
│   │   │   │   └── loyalty.schema.ts
│   │   │   ├── types/               # TypeScript types
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── project.json
│   │
│   ├── api-client/                   # Type-safe API client for frontend
│   │   ├── src/
│   │   │   ├── client.ts            # Base fetch wrapper
│   │   │   ├── endpoints/
│   │   │   │   ├── users.ts
│   │   │   │   ├── events.ts
│   │   │   │   ├── attendance.ts
│   │   │   │   └── loyalty.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── project.json
│   │
│   ├── tanstack-db/                  # TanStack DB collections
│   │   ├── src/
│   │   │   ├── collections/
│   │   │   │   ├── users.ts
│   │   │   │   ├── events.ts
│   │   │   │   ├── attendance.ts
│   │   │   │   └── loyalty.ts
│   │   │   ├── db-instance.ts       # TanStack DB setup
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── project.json
│   │
│   └── config/                       # Shared configurations
│       ├── eslint/
│       ├── typescript/
│       └── tailwind/
│
├── tools/                            # Custom Nx generators/executors
├── nx.json                           # Nx workspace config
├── package.json                      # Root package.json
├── tsconfig.base.json               # Base TypeScript config
├── .env.example                      # Environment variables template
└── README.md                         # Updated documentation
```

## 🔧 Step-by-Step Refactoring Instructions

### Phase 1: Initialize Nx Workspace

1. **Create new Nx workspace with Bun support**:
```bash
# Create a new directory
mkdir dwellpass-monorepo
cd dwellpass-monorepo

# Initialize Nx workspace (using npm temporarily for init)
npx create-nx-workspace@latest . --preset=empty --packageManager=bun --nx-cloud=skip

# Install Nx with Bun
bun add -D @nx/js @nx/vite @nx/eslint nx
```

2. **Configure Nx for Bun runtime**:
   - Update `nx.json` to use Bun for all executor commands
   - Add Bun-specific configuration to `nx.json`:
```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "lint", "test"]
      }
    }
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "cache": true
    }
  }
}
```

### Phase 2: Extract Database Package

3. **Create `packages/database`**:
```bash
bun nx generate @nx/js:library database --directory=packages/database --bundler=none
```

4. **Move database-related files**:
   - Copy all files from `src/server/db/schema/*.ts` → `packages/database/src/schema/`
   - Move `src/server/db/migrate.ts` → `packages/database/src/migrate.ts`
   - Move `src/server/db/seed.ts` → `packages/database/src/seed.ts`
   - Create `packages/database/src/client.ts`:
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function createDatabaseClient(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDatabaseClient>;
export * from './schema';
```

5. **Configure Drizzle**:
   - Create `packages/database/drizzle.config.ts`:
```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/dwellpass'
  }
} satisfies Config;
```

6. **Add package scripts** to `packages/database/project.json`:
```json
{
  "targets": {
    "db:generate": {
      "executor": "nx:run-commands",
      "options": {
        "command": "drizzle-kit generate",
        "cwd": "packages/database"
      }
    },
    "db:migrate": {
      "executor": "nx:run-commands",
      "options": {
        "command": "bun src/migrate.ts",
        "cwd": "packages/database"
      }
    },
    "db:seed": {
      "executor": "nx:run-commands",
      "options": {
        "command": "bun src/seed.ts",
        "cwd": "packages/database"
      }
    }
  }
}
```

### Phase 3: Extract Validation Package

7. **Create `packages/validation`**:
```bash
bun nx generate @nx/js:library validation --directory=packages/validation --bundler=none
```

8. **Extract Zod schemas**:
   - Move all Zod schema definitions from database schema files to `packages/validation/src/schemas/`
   - Create separate files: `user.schema.ts`, `event.schema.ts`, `attendance.schema.ts`, `loyalty.schema.ts`
   - Generate TypeScript types using Zod's `.infer` utility
   - Example structure:
```typescript
// packages/validation/src/schemas/user.schema.ts
import { z } from 'zod';

export const insertUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional()
});

export const selectUserSchema = insertUserSchema.extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type SelectUser = z.infer<typeof selectUserSchema>;
```

### Phase 4: Extract UI Component Library

9. **Create `packages/ui`**:
```bash
bun nx generate @nx/react:library ui --directory=packages/ui --bundler=vite --unitTestRunner=none
```

10. **Move shadcn/ui components**:
    - Copy all files from `src/components/ui/` → `packages/ui/src/components/ui/`
    - Move utility functions (cn, etc.) to `packages/ui/src/lib/`
    - Configure Tailwind for the UI package:
```typescript
// packages/ui/tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          lime: '#d4ff00'
        }
      }
    }
  },
  plugins: []
} satisfies Config;
```

11. **Wrap third-party components**:
    - Create `packages/ui/src/components/data-grid.tsx` - wrapper for AG Grid
    - Create `packages/ui/src/components/calendar.tsx` - wrapper for FullCalendar
    - Create `packages/ui/src/components/charts/` - wrappers for Recharts components
    - Ensure all wrappers accept proper TypeScript props and maintain consistency

12. **Create component index**:
```typescript
// packages/ui/src/index.ts
export * from './components/ui';
export * from './components/data-grid';
export * from './components/calendar';
export * from './components/charts';
export * from './lib/utils';
```

### Phase 5: Create API Client Package

13. **Create `packages/api-client`**:
```bash
bun nx generate @nx/js:library api-client --directory=packages/api-client --bundler=none
```

14. **Build type-safe API client**:
```typescript
// packages/api-client/src/client.ts
import type { SelectUser, InsertUser } from '@dwellpass/validation';

export class ApiClient {
  constructor(private baseUrl: string) {}

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Users endpoints
  users = {
    getAll: () => this.request<SelectUser[]>('/api/users'),
    getById: (id: string) => this.request<SelectUser>(`/api/users/${id}`),
    create: (data: InsertUser) =>
      this.request<SelectUser>('/api/users', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    update: (id: string, data: Partial<InsertUser>) =>
      this.request<SelectUser>(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
    delete: (id: string) =>
      this.request<void>(`/api/users/${id}`, { method: 'DELETE' })
  };

  // Add similar structures for events, attendance, loyalty
}

export function createApiClient(baseUrl: string) {
  return new ApiClient(baseUrl);
}
```

### Phase 6: Extract TanStack DB Package

15. **Create `packages/tanstack-db`**:
```bash
bun nx generate @nx/js:library tanstack-db --directory=packages/tanstack-db --bundler=none
```

16. **Move TanStack DB collections**:
    - Copy collection files from `src/server/collections/` → `packages/tanstack-db/src/collections/`
    - Create database instance setup:
```typescript
// packages/tanstack-db/src/db-instance.ts
import { createDB } from '@tanstack/react-db';
import { usersCollection } from './collections/users';
import { eventsCollection } from './collections/events';
import { attendanceCollection } from './collections/attendance';
import { loyaltyCollection } from './collections/loyalty';

export const db = createDB({
  collections: {
    users: usersCollection,
    events: eventsCollection,
    attendance: attendanceCollection,
    loyalty: loyaltyCollection
  }
});

export type DB = typeof db;
```

17. **Update collections to use API client**:
    - Modify each collection's `queryFn` to use the new `@dwellpass/api-client`
    - Ensure all CRUD operations (onInsert, onUpdate, onDelete) are properly typed

### Phase 7: Create API Application

18. **Create `apps/api`**:
```bash
bun nx generate @nx/js:application api --directory=apps/api --bundler=esbuild
```

19. **Move API server code**:
    - Move `src/server/routes/*.ts` → `apps/api/src/routes/`
    - Create new entry point `apps/api/src/index.ts`:
```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createDatabaseClient } from '@dwellpass/database';
import { usersRoutes } from './routes/users';
import { eventsRoutes } from './routes/events';
import { attendanceRoutes } from './routes/attendance';
import { loyaltyRoutes } from './routes/loyalty';

const app = new Hono();

// CORS configuration for Vercel frontend
app.use('/*', cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Database client
const db = createDatabaseClient(
  process.env.DATABASE_URL || 'postgresql://localhost:5432/dwellpass'
);

// Mount routes
app.route('/api/users', usersRoutes(db));
app.route('/api/events', eventsRoutes(db));
app.route('/api/attendance', attendanceRoutes(db));
app.route('/api/loyalty', loyaltyRoutes(db));

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;

// Start server
const port = parseInt(process.env.PORT || '3000');
console.log(`🚀 API Server running on port ${port}`);
Bun.serve({
  port,
  fetch: app.fetch
});
```

20. **Update route handlers** to accept database client:
```typescript
// apps/api/src/routes/users.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Database } from '@dwellpass/database';
import { users } from '@dwellpass/database';
import { insertUserSchema } from '@dwellpass/validation';

export function usersRoutes(db: Database) {
  const app = new Hono();

  app.get('/', async (c) => {
    const allUsers = await db.select().from(users);
    return c.json(allUsers);
  });

  app.post('/', zValidator('json', insertUserSchema), async (c) => {
    const data = c.req.valid('json');
    const [newUser] = await db.insert(users).values(data).returning();
    return c.json(newUser, 201);
  });

  // Add PUT, DELETE, GET by ID...

  return app;
}
```

21. **Create Dockerfile for Google Cloud Run**:
```dockerfile
# apps/api/Dockerfile
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package.json bun.lockb ./
COPY packages/database/package.json ./packages/database/
COPY packages/validation/package.json ./packages/validation/
RUN bun install --frozen-lockfile --production

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build --filter=api

# Production
FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/packages ./packages

EXPOSE 8080
CMD ["bun", "dist/apps/api/index.js"]
```

22. **Add Cloud Run configuration**:
```yaml
# apps/api/cloudrun.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: dwellpass-api
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: '10'
    spec:
      containerConcurrency: 80
      containers:
      - image: gcr.io/PROJECT_ID/dwellpass-api
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-url
              key: url
        - name: FRONTEND_URL
          value: https://dwellpass.vercel.app
        resources:
          limits:
            memory: 512Mi
            cpu: '1'
```

### Phase 8: Create Web Application

23. **Create `apps/web`**:
```bash
bun nx generate @nx/react:application web --directory=apps/web --bundler=vite --routing=true --style=none --e2eTestRunner=none --unitTestRunner=none
```

24. **Move frontend code**:
    - Move `src/routes/` → `apps/web/src/routes/` (TanStack Router routes)
    - Move app-specific components from `src/components/` → `apps/web/src/components/`
    - Move `src/stores/` → `apps/web/src/stores/` (Zustand stores)
    - Update imports to use `@dwellpass/ui`, `@dwellpass/api-client`, `@dwellpass/tanstack-db`

25. **Configure Vite**:
```typescript
// apps/web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', {}]]
      }
    }),
    TanStackRouterVite(),
    tailwindcss(),
    tsconfigPaths()
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'tanstack-vendor': [
            '@tanstack/react-router',
            '@tanstack/react-query',
            '@tanstack/react-db'
          ],
          'ag-grid-community': ['ag-grid-community'],
          'ag-grid-react': ['ag-grid-react'],
          'ui-vendor': ['lucide-react', 'zustand']
        }
      }
    }
  }
});
```

26. **Configure Tailwind**:
```typescript
// apps/web/tailwind.config.ts
import type { Config } from 'tailwindcss';
import baseConfig from '@dwellpass/ui/tailwind.config';

export default {
  ...baseConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}'
  ]
} satisfies Config;
```

27. **Update main entry point**:
```typescript
// apps/web/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DBProvider } from '@tanstack/react-db';
import { db } from '@dwellpass/tanstack-db';
import { routeTree } from './routeTree.gen';
import '@fontsource-variable/inter';
import './index.css';

const queryClient = new QueryClient();
const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <DBProvider value={db}>
        <RouterProvider router={router} />
      </DBProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
```

28. **Create Vercel configuration**:
```json
// apps/web/vercel.json
{
  "buildCommand": "cd ../.. && bun nx build web",
  "outputDirectory": "../../dist/apps/web",
  "framework": null,
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://dwellpass-api-XXXXX.run.app/api/:path*"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ]
}
```

### Phase 9: Configure TypeScript Path Mappings

29. **Update `tsconfig.base.json`**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "paths": {
      "@dwellpass/ui": ["packages/ui/src/index.ts"],
      "@dwellpass/database": ["packages/database/src/index.ts"],
      "@dwellpass/validation": ["packages/validation/src/index.ts"],
      "@dwellpass/api-client": ["packages/api-client/src/index.ts"],
      "@dwellpass/tanstack-db": ["packages/tanstack-db/src/index.ts"]
    }
  }
}
```

30. **Update individual tsconfig files** in each package/app to extend `tsconfig.base.json`

### Phase 10: Update Environment Configuration

31. **Create root `.env.example`**:
```bash
# Database (Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# API Configuration
PORT=3000
NODE_ENV=development

# Frontend Configuration
VITE_API_URL=http://localhost:3000

# Production URLs
FRONTEND_URL=https://dwellpass.vercel.app
API_URL=https://dwellpass-api-XXXXX.run.app
```

32. **Configure environment-specific files**:
    - Create `.env.development`, `.env.production`
    - Add `.env*` to `.gitignore`
    - Document all required variables

### Phase 11: Update Package Dependencies

33. **Root `package.json`**:
```json
{
  "name": "dwellpass-monorepo",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nx run-many --target=serve --projects=web,api --parallel",
    "build": "nx run-many --target=build --all",
    "build:web": "nx build web",
    "build:api": "nx build api",
    "lint": "nx run-many --target=lint --all",
    "test": "nx run-many --target=test --all",
    "db:generate": "nx run database:db:generate",
    "db:migrate": "nx run database:db:migrate",
    "db:seed": "nx run database:db:seed",
    "db:studio": "cd packages/database && drizzle-kit studio",
    "deploy:api": "cd apps/api && gcloud run deploy",
    "deploy:web": "cd apps/web && vercel --prod"
  },
  "dependencies": {
    "@tanstack/react-db": "^0.1.60",
    "@tanstack/react-query": "^5.90.12",
    "@tanstack/react-router": "^1.140.5",
    "@tanstack/react-form": "^1.27.7",
    "drizzle-orm": "^0.45.1",
    "hono": "^4.10.7",
    "postgres": "^3.4.7",
    "react": "^19.2.1",
    "react-dom": "^19.2.1",
    "zod": "^4.1.13",
    "zustand": "^5.0.9"
  },
  "devDependencies": {
    "@nx/js": "latest",
    "@nx/react": "latest",
    "@nx/vite": "latest",
    "@nx/eslint": "latest",
    "nx": "latest",
    "@types/bun": "^1.3.3",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "typescript": "~5.9.3",
    "vite": "npm:rolldown-vite@7.3.0",
    "drizzle-kit": "^0.31.8"
  },
  "engines": {
    "bun": ">=1.3.0"
  }
}
```

34. **Package-specific package.json files**:
    - Each package should have its own `package.json` with only its direct dependencies
    - Use workspace protocol for internal dependencies: `"@dwellpass/ui": "workspace:*"`

### Phase 12: Nx Build Configuration

35. **Configure each project's `project.json`**:

**apps/web/project.json**:
```json
{
  "name": "web",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/web/src",
  "projectType": "application",
  "tags": ["type:app", "scope:web"],
  "targets": {
    "serve": {
      "executor": "@nx/vite:dev-server",
      "options": {
        "buildTarget": "web:build",
        "port": 5173
      }
    },
    "build": {
      "executor": "@nx/vite:build",
      "outputs": ["{workspaceRoot}/dist/apps/web"],
      "options": {
        "configFile": "apps/web/vite.config.ts"
      },
      "dependsOn": ["^build"]
    },
    "preview": {
      "executor": "@nx/vite:preview-server",
      "options": {
        "buildTarget": "web:build",
        "port": 4173
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    }
  }
}
```

**apps/api/project.json**:
```json
{
  "name": "api",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/api/src",
  "projectType": "application",
  "tags": ["type:app", "scope:api"],
  "targets": {
    "serve": {
      "executor": "nx:run-commands",
      "options": {
        "command": "bun --watch src/index.ts",
        "cwd": "apps/api"
      }
    },
    "build": {
      "executor": "@nx/esbuild:esbuild",
      "outputs": ["{workspaceRoot}/dist/apps/api"],
      "options": {
        "main": "apps/api/src/index.ts",
        "outputPath": "dist/apps/api",
        "tsConfig": "apps/api/tsconfig.json",
        "platform": "node",
        "format": ["esm"],
        "bundle": true
      },
      "dependsOn": ["^build"]
    },
    "docker:build": {
      "executor": "nx:run-commands",
      "options": {
        "command": "docker build -t dwellpass-api -f apps/api/Dockerfile .",
        "cwd": "."
      }
    },
    "deploy": {
      "executor": "nx:run-commands",
      "options": {
        "command": "gcloud run deploy dwellpass-api --source . --region us-central1",
        "cwd": "apps/api"
      },
      "dependsOn": ["build"]
    }
  }
}
```

**packages/ui/project.json**:
```json
{
  "name": "ui",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "packages/ui/src",
  "projectType": "library",
  "tags": ["type:lib", "scope:shared"],
  "targets": {
    "build": {
      "executor": "@nx/vite:build",
      "outputs": ["{workspaceRoot}/dist/packages/ui"],
      "options": {
        "configFile": "packages/ui/vite.config.ts"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    }
  }
}
```

### Phase 13: Database Migration to Supabase

36. **Setup Supabase project**:
    - Create new project at https://supabase.com
    - Copy connection string (Settings → Database → Connection string)
    - Add to `.env`: `DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

37. **Run initial migration**:
```bash
# Generate migration files
bun nx run database:db:generate

# Apply to Supabase
DATABASE_URL="postgresql://..." bun nx run database:db:migrate

# Seed initial data
DATABASE_URL="postgresql://..." bun nx run database:db:seed
```

38. **Configure connection pooling** (optional but recommended):
    - Use Supabase connection pooler for production
    - Update `DATABASE_URL` to use pooler: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`

### Phase 14: Deployment Configuration

39. **Deploy API to Google Cloud Run**:
```bash
# Navigate to API app
cd apps/api

# Authenticate with Google Cloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Build and deploy
bun nx run api:docker:build
docker tag dwellpass-api gcr.io/YOUR_PROJECT_ID/dwellpass-api
docker push gcr.io/YOUR_PROJECT_ID/dwellpass-api
bun nx run api:deploy
```

40. **Configure Cloud Run secrets**:
```bash
# Create secret for DATABASE_URL
echo -n "postgresql://..." | gcloud secrets create database-url --data-file=-

# Grant access to Cloud Run service
gcloud secrets add-iam-policy-binding database-url \
  --member=serviceAccount:YOUR_SERVICE_ACCOUNT \
  --role=roles/secretmanager.secretAccessor
```

41. **Deploy Web to Vercel**:
```bash
# Navigate to web app
cd apps/web

# Install Vercel CLI
bun add -g vercel

# Link project
vercel link

# Set environment variables
vercel env add VITE_API_URL
# Enter: https://dwellpass-api-XXXXX.run.app

# Deploy
vercel --prod
```

### Phase 15: Testing & Validation

42. **Test local development**:
```bash
# Start database (if using local Postgres)
docker-compose -f docker/docker-compose.yml up -d

# Start all services
bun run dev

# Verify:
# - API: http://localhost:3000/health
# - Web: http://localhost:5173
```

43. **Verify builds**:
```bash
# Build all packages and apps
bun run build

# Check output directories
ls -la dist/apps/web
ls -la dist/apps/api
ls -la dist/packages/ui
```

44. **Test production deployments**:
    - Verify API health endpoint: `curl https://dwellpass-api-XXXXX.run.app/health`
    - Test frontend: Visit Vercel URL
    - Check API calls from frontend (Network tab)
    - Verify database connection

### Phase 16: Documentation Updates

45. **Update root README.md** with:
    - New monorepo structure
    - Development setup instructions
    - Deployment guides for each service
    - Environment variable documentation
    - Architecture diagram

46. **Create package-specific READMEs**:
    - `packages/ui/README.md` - Component library usage
    - `packages/database/README.md` - Schema and migration guide
    - `packages/api-client/README.md` - API client usage
    - `apps/web/README.md` - Frontend development guide
    - `apps/api/README.md` - API development and deployment guide

47. **Document deployment workflows**:
    - Create `docs/deployment.md` with step-by-step deployment instructions
    - Include troubleshooting section
    - Add CI/CD pipeline examples (GitHub Actions)

## 🎯 Critical Requirements & Constraints

### Must Preserve
1. **All existing functionality** - The refactored app must work identically to the current version
2. **TanStack DB local-first architecture** - Maintain reactive local database with server sync
3. **Type safety** - End-to-end TypeScript with Zod validation
4. **Bun runtime** - Continue using Bun for all execution (not Node.js)
5. **Dark UI with neon lime accent** - Preserve visual design (#d4ff00)
6. **Performance** - Maintain or improve current performance (code splitting, lazy loading)

### Must Enable
1. **Independent deployments** - Each service deployable without affecting others
2. **Reusable UI components** - Component library usable by future frontends
3. **Clear separation of concerns** - Database, validation, API, and UI are distinct packages
4. **Easy local development** - Simple `bun run dev` to start everything
5. **Production-ready** - Proper environment configuration, error handling, logging

### Must Avoid
1. **Breaking changes to existing code patterns** - Maintain similar component structure
2. **Over-abstraction** - Keep code pragmatic and understandable
3. **Circular dependencies** - Ensure clean dependency graph (use Nx's dependency rules)
4. **Losing PGlite** - Keep local development option with embedded database
5. **Complexity creep** - Don't add unnecessary layers or abstractions

## 📊 Success Criteria

The refactoring is successful when:

1. ✅ **Monorepo builds without errors**: `bun run build` completes successfully
2. ✅ **All apps run locally**: `bun run dev` starts web and API simultaneously
3. ✅ **Independent deployments work**: Can deploy API and web separately
4. ✅ **Existing features work**: All CRUD operations, calendar, attendance, loyalty system function
5. ✅ **Database migrations run**: Can generate and apply migrations to Supabase
6. ✅ **UI library is consumable**: Can import components from `@dwellpass/ui`
7. ✅ **Type safety is maintained**: No TypeScript errors, full IntelliSense
8. ✅ **API client works**: Frontend successfully communicates with API
9. ✅ **Production builds are optimized**: Proper code splitting, tree shaking
10. ✅ **Environment configuration works**: Different configs for dev/staging/production

## 🚨 Common Pitfalls to Avoid

1. **Path resolution issues**: Ensure all TypeScript path mappings are correct
2. **Circular dependencies**: Database → Validation (not Validation → Database)
3. **Missing dependencies**: Each package.json must list its own dependencies
4. **Build order problems**: Configure Nx `dependsOn` correctly
5. **Environment variable confusion**: Use correct prefixes (VITE_ for frontend)
6. **Database connection leaks**: Properly manage Postgres connections
7. **CORS issues**: Configure API CORS for Vercel domain
8. **Import path inconsistencies**: Always use `@dwellpass/package-name` aliases
9. **Tailwind config not loading**: Ensure UI package Tailwind config is imported
10. **Vite proxy not working**: Configure proxy correctly in development

## 🔍 Validation Checklist

Before marking the refactoring complete, verify:

- [ ] `bun install` works without errors
- [ ] `bun run build` builds all packages and apps
- [ ] `bun run lint` passes for all projects
- [ ] `bun run dev` starts web and API servers
- [ ] Web app loads at http://localhost:5173
- [ ] API responds at http://localhost:3000/health
- [ ] Can create/read/update/delete users
- [ ] Can create/read/update/delete events
- [ ] Can check in/out attendance
- [ ] Calendar displays events correctly
- [ ] AG Grid shows data tables
- [ ] Charts render on analytics dashboard
- [ ] TanStack DB live queries update UI
- [ ] Database migrations generate correctly
- [ ] Can deploy API to Cloud Run
- [ ] Can deploy web to Vercel
- [ ] Production API and web communicate correctly
- [ ] UI components can be imported from `@dwellpass/ui`
- [ ] All TypeScript types are properly inferred
- [ ] No console errors in browser
- [ ] Network requests show proper API calls

## 📝 Final Notes

- **Take your time**: This is a major refactoring, rushing will cause errors
- **Test incrementally**: After each phase, verify things still work
- **Commit frequently**: Use Git to save progress and enable rollback
- **Document as you go**: Update README files with any deviations
- **Ask for clarification**: If anything is unclear, stop and ask questions

## 🎓 Expected Outcome

After completing this refactoring, you will have:

- A **production-ready Nx monorepo** with clear separation of concerns
- **Independent deployability** for UI (Vercel), API (Cloud Run), and DB (Supabase)
- A **reusable UI component library** ready for future frontends
- **Type-safe API communication** between frontend and backend
- **Scalable architecture** that can grow with additional apps and features
- **Optimized build outputs** with proper code splitting
- **Clear documentation** for development and deployment
- **A working application** with zero functionality loss

Good luck with the refactoring! 🚀
