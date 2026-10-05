# =============================================================================
# Stage: dev
# Digunakan untuk development dengan hot-reload via bind mount.
# Source code tidak di-COPY; di-mount dari host saat runtime.
# =============================================================================
FROM node:20-alpine AS dev

WORKDIR /app

# Install semua dependencies (termasuk devDependencies untuk tsx, typescript, dll.)
COPY package*.json ./
COPY prisma/ ./prisma/
RUN npm ci

EXPOSE 3001

CMD ["npx", "tsx", "watch", "src/server.ts"]


# =============================================================================
# Stage: builder
# Kompilasi TypeScript ke JavaScript untuk production build.
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install semua dependencies (dev deps diperlukan untuk kompilasi TypeScript)
COPY package*.json ./
COPY prisma/ ./prisma/
RUN npm ci --frozen-lockfile

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Generate Prisma Client lalu build TypeScript
RUN npx prisma generate
RUN npm run build


# =============================================================================
# Stage: runner
# Production image — hanya berisi compiled output dan production dependencies.
# Tidak mengandung source TypeScript maupun devDependencies.
# =============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Copy compiled output dari builder
COPY --from=builder /app/dist ./dist

# Install hanya production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy Prisma directory (schema + generated client diperlukan saat runtime)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3001

CMD ["node", "dist/index.js"]
