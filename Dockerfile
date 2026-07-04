# Build stage - Use Node for Next.js 16 compatibility (Bun lacks worker_threads support on arm64)
FROM node:22-slim AS builder

WORKDIR /app

# Install bun for dependency management
RUN npm install -g bun

# Install dependencies (separated for better cache utilization)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code and build
COPY . .
RUN npx next telemetry disable
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/db
RUN npm run build

# Runtime stage
FROM node:22-slim AS runner
WORKDIR /app

# Install bun for migrations
RUN npm install -g bun

# Copy built app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock

# Production-only dependencies (excludes devDeps, smaller image)
RUN bun install --production --frozen-lockfile

# Copy migration files
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/lib/db ./lib/db
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Copy entrypoint
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npx", "next", "start", "-H", "0.0.0.0"]
