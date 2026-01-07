# Build stage
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json bun.lock ./
COPY packages/validation/package.json ./packages/validation/
COPY services/api/package.json ./services/api/
RUN bun install --frozen-lockfile --production

# Build stage
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build:api

# Production stage
FROM base AS production
ENV NODE_ENV=production

# Copy node_modules and built files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist/services/api ./dist
COPY --from=build /app/packages ./packages

# Set up non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 8080
ENV PORT=8080

CMD ["bun", "dist/index.js"]
