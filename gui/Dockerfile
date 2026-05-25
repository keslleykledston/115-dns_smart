# === Build Stage ===
FROM node:22-slim AS builder
WORKDIR /build

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
COPY public/ ./public/
COPY compile-frontend.js ./
RUN node compile-frontend.js
RUN npm run build

# === Runtime Stage ===
FROM node:22-slim

# SQLite needs build tools during npm ci sometimes, but we install pre-compiled binaries
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /build/dist ./dist
COPY src/db/ ./dist/db/
COPY healthcheck.js ./
COPY --from=builder /build/public ./public

# Set production env
ENV NODE_ENV=production

# Expose API/Web port
EXPOSE 3000

# SQLite database will reside in /app/data volume
RUN mkdir -p /app/data && chown -R node:node /app

# Run as non-root
USER node

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "dist/index.js"]
