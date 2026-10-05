# Implementation Plan

## Overview

Mengimplementasikan Docker integration untuk Personal Blog Website dengan membuat semua file infrastruktur (Dockerfiles, Docker Compose files, nginx config, env templates, dan dokumentasi). Tidak ada perubahan kode aplikasi.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2", "3", "6", "7", "8"] },
    { "id": 1, "tasks": ["4", "5"] },
    { "id": 2, "tasks": ["9", "10"] }
  ]
}
```

## Tasks

- [x] 1. Buat `backend/Dockerfile` dengan multi-stage build
  - Tambahkan stage `dev`: base `node:20-alpine`, `WORKDIR /app`, copy `package*.json` dan `prisma/`, `npm ci`, `EXPOSE 3001`, CMD `npx tsx watch src/server.ts`
  - Tambahkan stage `builder`: copy `package*.json` dan `prisma/`, `npm ci`, copy `src/`, jalankan `npx prisma generate` lalu `npm run build`
  - Tambahkan stage `runner`: base `node:20-alpine`, copy `dist/`, prod `node_modules`, dan `prisma/` dari `builder`, `EXPOSE 3001`, CMD `["node", "dist/index.js"]`
  - Tidak ada instruksi `ENV` yang meng-hardcode nilai secret
  - **Files:** `backend/Dockerfile`
  - **Requires:** (none)

- [x] 2. Buat `frontend/Dockerfile` dengan multi-stage build
  - Tambahkan stage `dev`: base `node:20-alpine`, copy `package*.json`, `npm ci`, `EXPOSE 5173`, CMD jalankan Vite dev server dengan flag listen semua interface
  - Tambahkan stage `builder`: deklarasikan `ARG VITE_API_URL` dan `ENV VITE_API_URL`, copy source, jalankan `npm run build`
  - Tambahkan stage `runner`: base `nginx:alpine`, copy `dist/` ke `/usr/share/nginx/html`, copy `nginx.conf`, `EXPOSE 80`
  - **Files:** `frontend/Dockerfile`
  - **Requires:** (none)

- [x] 3. Buat `frontend/nginx.conf` untuk SPA routing
  - Definisikan blok `server` dengan `listen 80`, `root /usr/share/nginx/html`, `index index.html`
  - Tambahkan `location /` dengan `try_files` fallback ke `index.html` untuk client-side routing React
  - Tambahkan lokasi cache untuk static assets (js, css, images, fonts)
  - Tambahkan `location = /index.html` dengan no-cache header
  - **Files:** `frontend/nginx.conf`
  - **Requires:** (none)

- [x] 4. Buat `docker-compose.yml` untuk lingkungan development
  - Service `db`: image `postgres:16-alpine`, `env_file: ./backend/.env`, named volume `postgres_data`, ports `5432:5432`, health check pg_isready (retries=5, interval=10s, timeout=5s)
  - Service `backend`: build `./backend` target `dev`, `env_file: ./backend/.env`, bind mounts `./backend/src` dan `./backend/prisma`, ports `3001:3001`, `depends_on: db: condition: service_healthy`
  - Service `frontend`: build `./frontend` target `dev`, bind mount `./frontend/src`, ports `5173:5173`, env `VITE_API_URL=http://localhost:3001`
  - Deklarasikan named volume `postgres_data` di top-level
  - **Files:** `docker-compose.yml`
  - **Requires:** 1, 2

- [x] 5. Buat `docker-compose.prod.yml` untuk lingkungan production
  - Service `db`: image `postgres:16-alpine`, named volume, tanpa mapping ports, health check pg_isready (retries=8, interval=5s, timeout=5s), `restart: unless-stopped`, network `blog_network`
  - Service `migrate`: build `./backend` target `runner`, command `npx prisma migrate deploy`, `depends_on: db: condition: service_healthy`, `restart: "no"`, network `blog_network`
  - Service `backend`: build `./backend` target `runner`, ports `3001:3001`, `depends_on: migrate: condition: service_completed_successfully`, `restart: unless-stopped`, network `blog_network`
  - Service `frontend`: build `./frontend` target `runner`, build arg `VITE_API_URL`, ports `80:80`, `restart: unless-stopped`, network `blog_network`
  - Deklarasikan named volume `postgres_data` dan named network `blog_network` (driver: bridge) di top-level
  - **Files:** `docker-compose.prod.yml`
  - **Requires:** 1, 2, 3

- [x] 6. Buat root `.env.example` sebagai template konfigurasi Docker
  - Sertakan `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` dengan nilai placeholder non-fungsional
  - Sertakan `DATABASE_URL` dengan hostname `db` (bukan `localhost`)
  - Sertakan `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_USER_EXPIRES_IN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `PORT`, `NODE_ENV`
  - Tambahkan komentar yang menjelaskan setiap grup variabel
  - **Files:** `.env.example`
  - **Requires:** (none)

- [x] 7. Perbarui `backend/.env.example` untuk konteks Docker
  - Ubah `DATABASE_URL` agar menggunakan hostname `db` sebagai nilai default
  - Tambahkan `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` jika belum ada
  - **Files:** `backend/.env.example`
  - **Requires:** (none)

- [x] 8. Verifikasi dan perbarui root `.gitignore`
  - Pastikan entri `.env` sudah ada di root `.gitignore`
  - Tambahkan entri jika belum ada: `.env`, `backend/.env`, `frontend/.env`
  - **Files:** `.gitignore`
  - **Requires:** (none)

- [x] 9. Buat `README.Docker.md` dengan dokumentasi setup Docker
  - Tulis seksi Prasyarat: Docker Engine 20.10+ dan Docker Compose v2.0+
  - Tulis seksi Setup Awal: salin `.env.example` ke `.env`, isi nilai, jalankan stack
  - Tulis seksi Development dan Production dengan perintah lengkap
  - Tulis tabel perbandingan Dev vs Prod (hot-reload, port, migration, restart policy)
  - Tulis seksi Perintah Berguna: rebuild, akses shell container, seed database
  - **Files:** `README.Docker.md`
  - **Requires:** 4, 5, 6

- [x] 10. Perbarui `.kiro/steering/tech.md` dengan seksi perintah Docker
  - Tambahkan seksi Docker: perintah dev stack, prod stack, stop, logs per-service, dan akses shell container
  - Tambahkan perintah manual migration dan seed via `docker compose exec`
  - Tambahkan catatan kapan perlu rebuild image (perubahan `Dockerfile`, `package.json`, atau `package-lock.json`)
  - **Files:** `.kiro/steering/tech.md`
  - **Requires:** 4, 5

## Notes

- Semua task adalah perubahan infrastruktur murni; tidak ada kode aplikasi yang diubah.
- Task 1, 2, 3, 6, 7, 8 tidak memiliki dependensi dan dapat dikerjakan secara paralel.
- Task 4 dan 5 memerlukan Dockerfile selesai terlebih dahulu sebelum dapat diverifikasi.
- Setelah task 7 selesai, `backend/.env` yang dibuat dari `.env.example` perlu disesuaikan jika environment non-Docker masih digunakan (ganti `db` kembali ke `localhost`).
- Tidak ada property-based tests untuk fitur ini karena seluruh output adalah konfigurasi deklaratif (IaC). Verifikasi dilakukan via smoke tests (inspeksi file) dan integration tests manual.
