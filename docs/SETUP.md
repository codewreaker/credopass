# Setup Guide

Complete setup instructions for getting CredoPass running locally and in production.

**CredoPass** is an event attendance tracking system (not a ticketing system) designed for organizations that need detailed check-in/check-out data. Perfect for churches, clubs, recurring meetups, and events where attendance tracking matters more than ticket sales.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Development Servers](#development-servers)
- [IDE Configuration](#ide-configuration)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

1. **Bun** (>= 1.3.0)
   ```bash
   # macOS/Linux
   curl -fsSL https://bun.sh/install | bash
   
   # Or with Homebrew (macOS)
   brew install oven-sh/bun/bun
   
   # Verify installation
   bun --version  # Should show 1.3.0 or higher
   ```

2. **Docker** (for PostgreSQL)
   - macOS: [Docker Desktop](https://www.docker.com/products/docker-desktop)
   - Linux: Docker Engine
   ```bash
   # Verify installation
   docker --version
   docker-compose --version
   ```

3. **Node.js** (optional, for compatibility)
   - Bun can handle most Node.js workflows
   - Only needed if you encounter compatibility issues

4. **Git**
   ```bash
   git --version
   ```

### Optional Software

- **Google Cloud SDK** (for Cloud Run deployment)
  ```bash
  # macOS
  brew install google-cloud-sdk
  
  # Verify
  gcloud --version
  ```

- **Vercel CLI** (for frontend deployment)
  ```bash
  bun add -g vercel
  ```

---

## Initial Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd credopass
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
bun install

# This will:
# - Install root dependencies
# - Install dependencies for apps/web
# - Install dependencies for services/core
# - Install dependencies for packages/lib
# - Install dependencies for packages/ui
```

### 3. Verify Installation

```bash
# Check Nx is available
bunx nx --version

# List all projects
bunx nx show projects

# Should show:
# - web
# - coreservice
# - lib
# - ui
```

---

## Environment Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Copy from example (if exists)
cp .env.example .env

# Or create manually
touch .env
```

### Required Environment Variables

Add the following to `.env`:

```env
#############################
# Database Configuration
#############################
DATABASE_URL=postgresql://postgres:Ax!rtrysoph123@localhost:5432/credopass_db

#############################
# API Configuration
#############################
API_BASE_URL=http://localhost:3000
NODE_ENV=development
PORT=3000

#############################
# Frontend Configuration
#############################
VITE_API_BASE_URL=http://localhost:3000

#############################
# Optional Features
#############################
# Enable throttle middleware (adds 1s delay to API requests for testing)
THROTTLE=false

# Enable debug logging
DEBUG=true
```

### Environment-Specific Configurations

#### Development (`.env`)
```env
NODE_ENV=development
DATABASE_URL=postgresql://postgres:Ax!rtrysoph123@localhost:5432/credopass_db
API_BASE_URL=http://localhost:3000
```

#### Production (Set in Vercel/Cloud Run)
```env
NODE_ENV=production
DATABASE_URL=<production-postgresql-url>
API_BASE_URL=https://api.credopass.com
```

---

## Database Setup

### 1. Start PostgreSQL Container

The project uses Docker Compose to run PostgreSQL locally.

```bash
# Start PostgreSQL in detached mode
bun run postgres:up

# This runs:
# docker-compose -f docker/docker-compose.yml up -d
```

**What this does**:
- Starts PostgreSQL 16 container
- Maps port 5432 to localhost
- Creates `credopass_db` database
- Credentials: `postgres` / `Ax!rtrysoph123`
- Data persisted in Docker volume `postgres_data`

### 2. Verify Database Connection

```bash
# Check container is running
docker ps

# Should see:
# CONTAINER ID   IMAGE                    STATUS
# <id>          postgres:16-alpine3.23   Up X seconds
```

**Test connection** (optional):
```bash
# Using psql (if installed)
psql -h localhost -p 5432 -U postgres -d credopass_db

# Password: Ax!rtrysoph123
```

### 3. Run Database Migrations

```bash
# Apply all pending migrations
nx run coreservice:migrate

# This runs:
# cd services/core && bun drizzle-kit migrate
```

**What migrations do**:
- Create `users` table
- Create `events` table
- Create `attendance` table
- Create `loyalty` table
- Create indexes for performance

### 4. Verify Migrations

```bash
# Open Drizzle Studio (database UI)
nx run coreservice:studio

# Opens: http://localhost:4983
# Browse tables, view data, run queries
```

### 5. Seed Database (Optional)

```bash
# If seed script exists
nx run coreservice:seed

# Or manually insert test data via Drizzle Studio
```

### Database Management Commands

```bash
# Stop PostgreSQL
bun run postgres:down

# Restart PostgreSQL
bun run postgres:down && bun run postgres:up

# View logs
docker logs -f <container-id>

# Delete all data (destructive!)
bun run postgres:down --volumes
```

---

## Development Servers

### Start All Services

```bash
# Option 1: Start both frontend and backend in separate terminals

# Terminal 1: Frontend (localhost:5173)
nx run web:serve

# Terminal 2: Backend (localhost:3000)
nx run coreservice:start
```

```bash
# Option 2: Start both in parallel (if configured)
nx run-many --target=serve --projects=web,coreservice --parallel
```

### Frontend Development Server

```bash
# Start web app
nx run web:serve

# Output:
# VITE v7.3.0  ready in 542 ms
#
# ➜  Local:   http://localhost:5173/
# ➜  Network: use --host to expose
# ➜  press h + enter to show help

# Features:
# - Hot Module Replacement (HMR)
# - React Fast Refresh
# - API proxy to localhost:3000
```

**Available at**: http://localhost:5173

**Routes**:
- `/` - Home/Dashboard
- `/members` - Members management
- `/events` - Events calendar
- `/analytics` - Analytics dashboard
- `/database` - Database tables viewer

### Backend Development Server

```bash
# Start API server
nx run coreservice:start

# Output:
# 🚀 Server running on http://localhost:3000

# Features:
# - Auto-restart on file changes (--watch)
# - CORS enabled for localhost:5173
# - Logger middleware
# - Hot reload with Bun
```

**Available at**: http://localhost:3000

**Endpoints**:
- `GET /api/health` - Health check
- `GET /api/users` - List users
- `GET /api/events` - List events
- `GET /api/attendance` - List attendance records
- `GET /api/loyalty` - List loyalty points

### Verify Setup

```bash
# Test backend health check
curl http://localhost:3000/api/health

# Should return:
# {"status":"ok","timestamp":"2026-01-11T..."}

# Test frontend
open http://localhost:5173
# Should load CredoPass home page
```

---

## IDE Configuration

### VS Code (Recommended)

**Install Extensions**:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "oven.bun-vscode",
    "ms-azuretools.vscode-docker"
  ]
}
```

**Settings** (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

**Tasks** (`.vscode/tasks.json`):
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Web",
      "type": "shell",
      "command": "nx run web:serve",
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    },
    {
      "label": "Start API",
      "type": "shell",
      "command": "nx run coreservice:start",
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    }
  ]
}
```

### IntelliJ IDEA / WebStorm

1. **Enable Bun Support**:
   - Settings → Languages & Frameworks → Node.js
   - Set package manager to "Bun"

2. **TypeScript Configuration**:
   - Use TypeScript from `node_modules/typescript`

3. **Run Configurations**:
   - Create "Bun" run config for `nx run web:serve`
   - Create "Bun" run config for `nx run coreservice:start`

---

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Problem**: Port 5173 or 3000 already taken

```bash
# Find process using port
lsof -i :5173
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 nx run coreservice:start
```

#### 2. Database Connection Failed

**Problem**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solutions**:
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# If not running, start it
bun run postgres:up

# Check DATABASE_URL is correct
echo $DATABASE_URL

# Test connection
docker exec -it <container-id> psql -U postgres -d credopass_db
```

#### 3. Migration Errors

**Problem**: `Error: relation "users" already exists`

**Solutions**:
```bash
# Reset database (destructive!)
bun run postgres:down --volumes
bun run postgres:up
nx run coreservice:migrate

# Or use Drizzle Studio to manually fix
nx run coreservice:studio
```

#### 4. Module Not Found

**Problem**: `Cannot find module '@credopass/lib'`

**Solutions**:
```bash
# Rebuild workspace
bun install

# Clear Nx cache
nx reset

# Rebuild packages
nx run lib:build
nx run ui:build
```

#### 5. Bun Watch Not Working

**Problem**: Backend not restarting on file changes

**Solution**:
```bash
# Use --watch flag explicitly
bun --watch --no-clear-screen services/core/src/index.ts
```

#### 6. TypeScript Errors in IDE

**Problem**: Red squiggly lines, "Cannot find type definitions"

**Solutions**:
```bash
# Restart TypeScript server
# VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server"

# Verify tsconfig.json paths
cat tsconfig.base.json | grep paths

# Ensure packages are built
nx run-many --target=build --projects=lib,ui
```

#### 7. CORS Errors

**Problem**: `Access-Control-Allow-Origin` errors in browser console

**Solutions**:
```bash
# Verify Vite proxy is configured (apps/web/vite.config.ts)
# Verify backend CORS allows localhost:5173
# Check services/core/src/index.ts CORS middleware
```

### Database Issues

#### Reset Database Completely

```bash
# Stop and remove all data
bun run postgres:down --volumes

# Start fresh
bun run postgres:up

# Run migrations
nx run coreservice:migrate
```

#### Check Database Tables

```bash
# Using psql
docker exec -it <container-id> psql -U postgres -d credopass_db

# List tables
\dt

# Describe table
\d users

# Query data
SELECT * FROM users;
```

### Performance Issues

#### Slow Builds

```bash
# Clear Nx cache
nx reset

# Clear Bun cache
rm -rf node_modules/.cache

# Reinstall dependencies
rm -rf node_modules
bun install
```

#### Slow Development Server

```bash
# Disable throttle middleware
echo "THROTTLE=false" >> .env

# Check Vite config for excessive plugins
cat apps/web/vite.config.ts
```

---

## Next Steps

After successful setup:

1. **Explore the codebase**: Start with [ARCHITECTURE.md](ARCHITECTURE.md)
2. **Review database schema**: See [DATABASE.md](DATABASE.md)
3. **Test API endpoints**: Check [API.md](API.md)
4. **Deploy to production**: Follow [DEPLOYMENT.md](DEPLOYMENT.md)

---

## Getting Help

- **Documentation**: See `/docs` directory
- **Nx Commands**: Run `nx help`
- **Project Structure**: See [README.md](../README.md)
- **Architecture**: See [ARCHITECTURE.md](ARCHITECTURE.md)
