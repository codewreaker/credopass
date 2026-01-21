# =============================================================================
# Dockerfile - Core API Service (services/core)
# =============================================================================
# Lightweight production image for pre-built application
# Deployed to: Google Cloud Run
# Runtime: Bun
#
# PREREQUISITE: Build the application first with: nx build coreservice
# =============================================================================

FROM oven/bun:1.3-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy package.json for dependency installation
COPY services/core/package.json ./

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# Copy pre-built application from host machine (dist/services/core)
COPY dist/services/core ./dist

# Copy shared packages if needed at runtime
# Adjust this based on what your service actually needs
COPY packages/lib ./packages/lib

# Set up non-root user for security (Cloud Run best practice)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Cloud Run uses PORT env var (default 8080)
EXPOSE 8080
ENV PORT=8080

# Health check endpoint (optional, Cloud Run has its own)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start the server
CMD ["bun", "dist/index.js"]
