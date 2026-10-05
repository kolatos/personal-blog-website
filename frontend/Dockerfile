# =============================================================================
# Stage: dev
# Digunakan untuk development dengan hot-reload via bind mount.
# Source code tidak di-COPY; di-mount dari host saat runtime.
# =============================================================================
FROM node:20-alpine AS dev

WORKDIR /app

# Install semua dependencies (termasuk devDependencies untuk Vite, TypeScript, dll.)
COPY package*.json ./
RUN npm ci

EXPOSE 5173

# --host 0.0.0.0 diperlukan agar Vite dapat diakses dari browser di host
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]


# =============================================================================
# Stage: builder
# Build production bundle dengan Vite.
# VITE_API_URL di-inject sebagai build argument agar ter-embed ke dalam bundle.
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install semua dependencies (dev deps diperlukan untuk kompilasi TypeScript + Vite build)
COPY package*.json ./
RUN npm ci

# VITE_API_URL harus dideklarasikan sebagai ARG dan di-set ke ENV
# agar Vite meng-embed nilainya saat proses build (import.meta.env.VITE_API_URL)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Copy seluruh source code
COPY . .

# Build production bundle ke dist/
RUN npm run build


# =============================================================================
# Stage: runner
# Production image — static files dilayani via Nginx.
# Tidak mengandung Node.js, source TypeScript, maupun devDependencies.
# =============================================================================
FROM nginx:alpine AS runner

# Copy compiled static assets dari builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy konfigurasi Nginx untuk SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
