# =============================================================================
# Dockerfile - Core API Service (services/core)
# =============================================================================
# Optimized for CI/CD pipeline where build happens in GitHub Actions:
#
# CI WORKFLOW (GitHub Actions):
#   1. Install dependencies (bun install)
#   2. Build application (nx build coreservice)
#   3. Build Docker image (copies pre-built files)
#   4. Push to Artifact Registry
#   5. Deploy to Cloud Run
#
# The Docker image only contains the runtime - no build tools needed.
# This results in faster builds, smaller images, and better caching.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Production runtime image
# -----------------------------------------------------------------------------
FROM oven/bun:1.2-alpine AS runtime

WORKDIR /app


# Copy root package files for workspace resolution
# COPY package.json bun.lock ./
# COPY nx.json tsconfig.base.json ./

# # Copy all workspace package.json files for dependency resolution
# COPY packages/lib/package.json ./packages/lib/
# COPY packages/ui/package.json ./packages/ui/
# COPY services/core/package.json ./services/core/

# Environment variables for Cloud Run
ENV NODE_ENV=production
ENV PORT=8080

# Copy pre-built application (from CI: nx build coreservice)
COPY dist/services/core ./services/core

# Set up non-root user for security (Cloud Run best practice)
RUN addgroup -g 1001 -S bunjs && \
    adduser -S bunjs -u 1001 && \
    chown -R bunjs:bunjs /app

USER bunjs

# Cloud Run uses PORT env var
EXPOSE 8080

# Health check endpoint
HEALTHCHECK --interval=60s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/core/health || exit 1

# Start the server
CMD ["bun", "run", "services/core/index.js"]
