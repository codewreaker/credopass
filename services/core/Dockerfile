# =============================================================================
# Dockerfile - Core API Service (services/core)
# =============================================================================
# Multi-stage build for Google Cloud Run deployment
# Runtime: Bun
# Build: Nx monorepo
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM oven/bun:1.3-alpine AS deps

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json bun.lock ./
COPY nx.json tsconfig.base.json ./

# Copy all workspace package.json files for dependency resolution
COPY packages/lib/package.json ./packages/lib/
COPY packages/ui/package.json ./packages/ui/
COPY services/core/package.json ./services/core/

# Install all dependencies (including dev for building)
RUN bun install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: Build
# -----------------------------------------------------------------------------
FROM deps AS build

WORKDIR /app

# Copy source code
COPY packages/ ./packages/
COPY services/core/ ./services/core/

# Build the coreservice using Nx
RUN bun nx build coreservice

# -----------------------------------------------------------------------------
# Stage 3: Production
# -----------------------------------------------------------------------------
FROM oven/bun:1.3-alpine AS production

WORKDIR /app

# Environment variables for Cloud Run
ENV NODE_ENV=production
ENV PORT=8080

# Copy only production dependencies
COPY package.json bun.lock ./
COPY packages/lib/package.json ./packages/lib/
COPY services/core/package.json ./services/core/
RUN bun install --frozen-lockfile --production

# Copy built application from build stage
COPY --from=build /app/dist/services/core ./dist

# Copy shared packages needed at runtime
COPY --from=build /app/packages/lib ./packages/lib

# Set up non-root user for security (Cloud Run best practice)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Cloud Run uses PORT env var
EXPOSE 8080

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/core/health || exit 1

# Start the server
CMD ["bun", "dist/index.js"]
