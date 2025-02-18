# Build environment
FROM node:22-alpine AS builder

# App directory
WORKDIR /app

# Install build-time dependencies
COPY package.json pnpm-lock.yaml ./
RUN corepack enable
RUN pnpm install --frozen-lockfile

# Run the Typescript build
COPY . .
RUN pnpm build

# Production environment
FROM node:22-alpine

# App directory
WORKDIR /app

# Install runtime dependencies
COPY package.json pnpm-lock.yaml ./
RUN corepack enable
RUN pnpm install --frozen-lockfile --prod

# Copy build output
COPY --from=builder /app/dist ./dist

# Start the server
CMD ["node", "dist/server.js"]
