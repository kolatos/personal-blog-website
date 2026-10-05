# Docker Setup — Personal Blog Website

Panduan ini menjelaskan cara menjalankan seluruh stack aplikasi (backend, frontend, database) menggunakan Docker dan Docker Compose.

---

## Daftar Isi

1. [Prasyarat](#prasyarat)
2. [Setup Awal](#setup-awal)
3. [Development](#development)
4. [Production](#production)
5. [Perbandingan Dev vs Prod](#perbandingan-dev-vs-prod)
6. [Perintah Berguna](#perintah-berguna)
7. [Troubleshooting](#troubleshooting)

---

## Prasyarat

Pastikan perangkat lunak berikut sudah terpasang sebelum menjalankan stack:

| Perangkat Lunak | Versi Minimum | Cara Verifikasi |
|---|---|---|
| Docker Engine | 20.10+ | `docker --version` |
| Docker Compose | v2.0+ | `docker compose version` |

> **Catatan:** Docker Desktop untuk Windows dan macOS sudah menyertakan Docker Engine dan Docker Compose secara bawaan.

---

## Setup Awal

Lakukan langkah-langkah berikut sekali sebelum pertama kali menjalankan stack.

### 1. Salin file template environment

```bash
# Salin template root (untuk Docker Compose)
cp .env.example .env

# Salin template backend
cp backend/.env.example backend/.env
```

### 2. Isi nilai konfigurasi

Buka file `backend/.env` dan ganti nilai placeholder dengan nilai aktual:

```env
# Database
DATABASE_URL="postgresql://blog_user:GANTI_PASSWORD@db:5432/blog_db?schema=public"

# PostgreSQL credentials
POSTGRES_DB="blog_db"
POSTGRES_USER="blog_user"
POSTGRES_PASSWORD="GANTI_PASSWORD"

# JWT — gunakan string acak yang panjang dan kuat
JWT_SECRET="GANTI_DENGAN_SECRET_YANG_KUAT"
JWT_EXPIRES_IN="24h"
JWT_USER_EXPIRES_IN="7d"

# Admin credentials
ADMIN_USERNAME="admin"
ADMIN_PASSWORD_HASH=""   # generate dengan: node -e "const b=require('bcrypt'); b.hash('password',12).then(console.log)"

# Server
PORT=3001
NODE_ENV=development     # ganti ke "production" untuk prod stack
```

> **Penting:**
> - `DATABASE_URL` harus menggunakan hostname `db` (bukan `localhost`) agar backend dapat terhubung ke service database di dalam Docker network.
> - Untuk menjalankan production stack, salin juga `.env.example` ke `.env` di root proyek dan sesuaikan nilainya.
> - Jangan pernah commit file `.env` — file ini sudah terdaftar di `.gitignore`.

### 3. Hasilkan hash password admin (opsional)

```bash
node -e "const b=require('bcrypt'); b.hash('password_admin_kamu', 12).then(console.log)"
```

Tempel nilai hash yang dihasilkan ke `ADMIN_PASSWORD_HASH` di `backend/.env`.

---

## Development

Mode development menggunakan hot-reload: perubahan pada source code di host akan langsung tercermin di dalam container tanpa perlu rebuild image.

### Menjalankan stack development

```bash
docker compose up -d
```

Stack akan menjalankan tiga layanan secara berurutan:
1. **db** — PostgreSQL 16, menunggu hingga healthy
2. **backend** — Node.js dengan `tsx watch` (hot-reload), dimulai setelah `db` healthy
3. **frontend** — Vite dev server dengan HMR, dimulai paralel dengan backend

### Mengakses aplikasi

| Layanan | URL |
|---|---|
| Frontend (React) | http://localhost:5173 |
| Backend API | http://localhost:3001 |
| Database (PostgreSQL) | `localhost:5432` |

### Menghentikan stack

```bash
docker compose down
```

Untuk menghentikan dan menghapus volume (data database akan hilang):

```bash
docker compose down -v
```

### Melihat log

```bash
# Semua layanan
docker compose logs -f

# Per layanan
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

---

## Production

Mode production menggunakan multi-stage build yang menghasilkan image minimal. Frontend dilayani oleh Nginx, backend menjalankan JavaScript yang sudah dikompilasi, dan ada layanan `migrate` terpisah yang memastikan skema database selalu sinkron sebelum backend dimulai.

### Menjalankan stack production

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Stack akan menjalankan layanan dalam urutan berikut:
1. **db** — PostgreSQL 16, menunggu hingga healthy (retries: 8)
2. **migrate** — menjalankan `prisma migrate deploy`, keluar setelah selesai
3. **backend** — dimulai setelah `migrate` berhasil (exit 0)
4. **frontend** — Nginx melayani static files, dimulai paralel dengan backend

### Mengakses aplikasi

| Layanan | URL |
|---|---|
| Frontend (Nginx) | http://localhost:80 |
| Backend API | http://localhost:3001 |
| Database | tidak terekspos ke host (hanya dapat diakses di dalam `blog_network`) |

### Menghentikan stack

```bash
docker compose -f docker-compose.prod.yml down
```

Untuk menghentikan dan menghapus volume (data database akan hilang):

```bash
docker compose -f docker-compose.prod.yml down -v
```

### Melihat log

```bash
# Semua layanan
docker compose -f docker-compose.prod.yml logs -f

# Per layanan
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f migrate
docker compose -f docker-compose.prod.yml logs -f db
```

---

## Perbandingan Dev vs Prod

| Aspek | Development (`docker-compose.yml`) | Production (`docker-compose.prod.yml`) |
|---|---|---|
| **Hot-reload** | ✅ Aktif (tsx watch + Vite HMR) | ❌ Tidak ada |
| **Frontend server** | Vite dev server | Nginx (static files) |
| **Port frontend** | 5173 | 80 |
| **Port backend** | 3001 | 3001 |
| **Port database (host)** | 5432 (terekspos) | Tidak terekspos |
| **Build mode** | TypeScript langsung via tsx | JavaScript hasil kompilasi (`dist/`) |
| **Migration** | Manual via `exec` | Otomatis via service `migrate` |
| **Restart policy** | Tidak dikonfigurasi | `unless-stopped` (semua layanan) |
| **Network** | Default Docker network | Named network `blog_network` (terisolasi) |
| **Image size** | Besar (termasuk devDependencies) | Kecil (hanya production dependencies) |

---

## Perintah Berguna

### Rebuild image

Jalankan rebuild ketika ada perubahan pada `Dockerfile`, `package.json`, atau `package-lock.json`:

```bash
# Development
docker compose up -d --build

# Production
docker compose -f docker-compose.prod.yml up -d --build
```

### Akses shell container

```bash
# Backend (development)
docker compose exec backend sh

# Backend (production)
docker compose -f docker-compose.prod.yml exec backend sh

# Database
docker compose exec db psql -U blog_user -d blog_db
```

### Seed database

Jalankan setelah stack berjalan dan migrasi selesai:

```bash
# Development
docker compose exec backend npx prisma db seed

# Production
docker compose -f docker-compose.prod.yml exec backend npx prisma db seed
```

### Migrasi manual

```bash
# Buat dan jalankan migrasi baru (development)
docker compose exec backend npx prisma migrate dev --name <nama_migrasi>

# Terapkan migrasi yang ada (production/manual)
docker compose exec backend npx prisma migrate deploy

# Reset database (HATI-HATI: menghapus semua data)
docker compose exec backend npx prisma migrate reset
```

### Periksa status layanan

```bash
# Development
docker compose ps

# Production
docker compose -f docker-compose.prod.yml ps
```

---

## Troubleshooting

### Backend tidak mau start — "dependency failed to start: container db is unhealthy"

Database belum selesai inisialisasi. Periksa log `db`:

```bash
docker compose logs db
```

Pastikan variabel `POSTGRES_DB`, `POSTGRES_USER`, dan `POSTGRES_PASSWORD` sudah diisi dengan benar di `backend/.env`.

### Frontend tidak dapat menjangkau backend (CORS / network error)

Pastikan `VITE_API_URL` di environment frontend menunjuk ke URL yang dapat dijangkau **dari browser host**, bukan dari dalam Docker network. Nilai default `http://localhost:3001` sudah benar untuk deployment single-host.

### Perubahan kode tidak terefleksi di container (development)

Pastikan bind mount bekerja dengan benar. Periksa apakah path source code sesuai:

```bash
docker compose exec backend ls /app/src
docker compose exec frontend ls /app/src
```

Jika direktori kosong, hentikan stack dan jalankan ulang dengan `docker compose up -d`.

### Port sudah digunakan

Jika mendapat error `port is already allocated`, pastikan tidak ada proses lain yang menggunakan port 5432, 3001, atau 5173. Hentikan proses tersebut atau ubah port mapping di Compose file.

### Melihat variabel environment yang aktif di container

```bash
docker compose exec backend env | grep -v PASSWORD | grep -v SECRET
```

> Jangan pernah cetak nilai `JWT_SECRET`, `POSTGRES_PASSWORD`, atau `DATABASE_URL` ke output log atau layar publik.
