# Requirements Document

## Introduction

Fitur Docker Integration bertujuan untuk mengkontainerisasi aplikasi Personal Blog Website secara penuh — mencakup backend (Node.js/Express), frontend (React/Vite), dan database (PostgreSQL) — sehingga seluruh lingkungan aplikasi dapat dijalankan secara konsisten dan portabel di mesin manapun menggunakan Docker dan Docker Compose. Fitur ini mencakup dua mode: **development** (dengan hot-reload dan volume mounting) dan **production** (dengan image yang dioptimalkan menggunakan multi-stage build). Selain itu, steering file `tech.md` diperbarui untuk mencerminkan perintah Docker dalam alur kerja proyek.

## Glossary

- **Docker_Image**: Paket yang dapat dieksekusi berisi kode aplikasi, runtime, library, dan konfigurasi untuk sebuah layanan
- **Docker_Container**: Instance yang sedang berjalan dari sebuah Docker_Image
- **Docker_Compose**: Alat untuk mendefinisikan dan menjalankan aplikasi multi-kontainer menggunakan file YAML
- **Dev_Compose**: Konfigurasi `docker-compose.yml` yang ditujukan untuk lingkungan pengembangan dengan hot-reload
- **Prod_Compose**: Konfigurasi `docker-compose.prod.yml` yang ditujukan untuk lingkungan produksi dengan image yang dioptimalkan
- **Backend_Service**: Kontainer yang menjalankan aplikasi Express/Node.js
- **Frontend_Service**: Kontainer yang menjalankan aplikasi React/Vite (dev server atau Nginx untuk produksi)
- **DB_Service**: Kontainer yang menjalankan PostgreSQL
- **Multi_Stage_Build**: Teknik Dockerfile yang menggunakan beberapa stage untuk menghasilkan image produksi yang lebih kecil
- **Volume**: Mekanisme Docker untuk mempersistensikan data kontainer atau berbagi file antara host dan kontainer
- **Named_Volume**: Volume Docker yang dikelola secara eksplisit, diidentifikasi dengan nama (bukan path host)
- **Health_Check**: Pemeriksaan berkala untuk memastikan sebuah layanan berjalan dengan benar sebelum layanan dependen dijalankan
- **Environment_File**: File `.env` yang berisi variabel konfigurasi untuk layanan dalam kontainer
- **Migration**: Proses menjalankan `prisma migrate deploy` untuk menerapkan skema database ke DB_Service

---

## Requirements

### Requirement 1: Kontainerisasi Backend

**User Story:** Sebagai Developer, saya ingin backend Express dikemas dalam Docker Image, sehingga saya dapat menjalankan backend secara konsisten di lingkungan manapun tanpa menyiapkan Node.js secara manual.

#### Acceptance Criteria

1. THE System SHALL menyediakan file `backend/Dockerfile` yang mendefinisikan Docker_Image untuk Backend_Service.
2. WHEN Backend_Service dibangun untuk lingkungan production, THE System SHALL menggunakan Multi_Stage_Build dengan stage `builder` untuk mengkompilasi TypeScript dan stage `runner` untuk menjalankan hasil kompilasi, sehingga image produksi tidak menyertakan devDependencies maupun source TypeScript.
3. THE `runner` stage pada image produksi backend SHALL menggunakan base image `node:20-alpine` dan hanya menyalin direktori `dist/` serta `node_modules` production dari stage `builder`, sehingga tidak ada source TypeScript maupun devDependencies yang tersisa di dalam image akhir.
4. WHEN Backend_Service dijalankan di lingkungan production, THE System SHALL menjalankan perintah `node dist/index.js` sebagai entry point.
5. THE Backend_Service SHALL membaca konfigurasi sensitif (DATABASE_URL, JWT_SECRET, dll.) dari Environment_File yang di-inject saat runtime; tidak ada nilai konfigurasi sensitif yang tersimpan di dalam layer image, yang dapat diverifikasi melalui `docker inspect` atau `docker history`.
6. WHEN Backend_Service dijalankan, THE `backend/Dockerfile` SHALL mendeklarasikan instruksi `EXPOSE 3001` sehingga port yang diekspos dapat diverifikasi langsung dari Dockerfile.
7. WHEN Dev_Compose atau Prod_Compose dijalankan, THE Backend_Service SHALL menggunakan kondisi `depends_on: db: condition: service_healthy` sehingga kontainer backend tidak dimulai sebelum DB_Service melaporkan status healthy.
8. THE DB_Service health check SHALL dikonfigurasi dengan interval 5 detik dan maksimal 8 kali percobaan (total timeout 40 detik); IF DB_Service tidak sehat dalam 40 detik, THEN THE Docker Compose SHALL menghentikan startup dan melaporkan error.

---

### Requirement 2: Kontainerisasi Frontend

**User Story:** Sebagai Developer, saya ingin frontend React dikemas dalam Docker Image, sehingga saya dapat melayani frontend secara konsisten tanpa menyiapkan Node.js atau Nginx secara manual.

#### Acceptance Criteria

1. THE System SHALL menyediakan file `frontend/Dockerfile` yang mendefinisikan Docker_Image untuk Frontend_Service.
2. WHEN Frontend_Service dibangun untuk lingkungan production, THE System SHALL menggunakan Multi_Stage_Build dengan stage `builder` yang menjalankan `npm run build` dan stage `runner` menggunakan base image `nginx:alpine` yang hanya menyalin direktori hasil build (`dist/`) dari stage `builder`.
3. THE System SHALL menyertakan file konfigurasi Nginx (`frontend/nginx.conf`) yang mendefinisikan blok `location /` dengan direktif `try_files $uri $uri/ /index.html` sehingga semua path yang tidak cocok dengan file statis di-fallback ke `index.html` untuk mendukung client-side routing React.
4. WHEN Frontend_Service production dijalankan, THE `frontend/Dockerfile` SHALL mendeklarasikan instruksi `EXPOSE 80` dan Nginx SHALL melayani file statis pada port tersebut.
5. WHEN Frontend_Service development dijalankan, THE System SHALL menjalankan Vite dev server dan `frontend/Dockerfile` SHALL mendeklarasikan instruksi `EXPOSE 5173`.
6. THE Frontend_Service SHALL menerima URL backend API melalui build argument `VITE_API_URL` yang di-pass saat proses `docker build` atau melalui `args` di Docker Compose, sehingga nilai URL tidak di-hardcode dalam layer image dan dapat diverifikasi tidak hadir dalam output `docker history`.

---

### Requirement 3: Konfigurasi Docker Compose untuk Development

**User Story:** Sebagai Developer, saya ingin dapat menjalankan seluruh stack (backend, frontend, database) dengan satu perintah untuk lingkungan pengembangan, sehingga saya dapat memulai development dengan cepat.

#### Acceptance Criteria

1. THE System SHALL menyediakan file `docker-compose.yml` di root proyek yang mendefinisikan Dev_Compose dengan tiga layanan: `db`, `backend`, dan `frontend`.
2. WHEN Dev_Compose dijalankan, THE DB_Service SHALL menggunakan image `postgres:16-alpine` dan mempersistensikan data menggunakan Named_Volume bernama `postgres_data`.
3. WHEN Dev_Compose dijalankan, THE Backend_Service SHALL me-mount direktori `./backend/src` sebagai bind-mount Volume ke path yang sesuai di dalam kontainer sehingga perubahan kode TypeScript pada host memicu hot-reload tanpa rebuild image.
4. WHEN Dev_Compose dijalankan, THE Frontend_Service SHALL me-mount direktori `./frontend/src` sebagai bind-mount Volume ke path yang sesuai di dalam kontainer sehingga perubahan kode React pada host memicu hot-reload Vite tanpa rebuild image.
5. THE Dev_Compose SHALL mendefinisikan urutan startup menggunakan `depends_on` dengan kondisi `service_healthy` untuk memastikan DB_Service sehat sebelum Backend_Service dimulai.
6. THE Dev_Compose SHALL memuat variabel environment untuk setiap layanan dari file `.env` yang sesuai menggunakan direktif `env_file` (misalnya `./backend/.env` untuk backend).
7. WHEN Dev_Compose dijalankan, THE DB_Service SHALL mengekspos port 5432 ke host melalui mapping `5432:5432` untuk memungkinkan koneksi langsung dari alat database eksternal selama development.
8. WHEN Dev_Compose dijalankan, THE Backend_Service SHALL mengekspos port 3001 ke host melalui mapping `3001:3001` dan THE Frontend_Service SHALL mengekspos port 5173 ke host melalui mapping `5173:5173` sehingga keduanya dapat diakses langsung dari browser host.
9. THE DB_Service health check dalam Dev_Compose SHALL dikonfigurasi dengan 5 kali percobaan, interval 10 detik, dan timeout 5 detik per percobaan menggunakan perintah `pg_isready`.

---

### Requirement 4: Konfigurasi Docker Compose untuk Production

**User Story:** Sebagai Developer, saya ingin dapat menjalankan seluruh stack untuk lingkungan produksi dengan image yang dioptimalkan, sehingga aplikasi dapat di-deploy dengan performa dan keamanan yang lebih baik.

#### Acceptance Criteria

1. THE System SHALL menyediakan file `docker-compose.prod.yml` di root proyek yang mendefinisikan Prod_Compose dengan tiga layanan: `db`, `backend`, dan `frontend`.
2. WHEN Prod_Compose dijalankan, THE Backend_Service SHALL menggunakan target `production` dari Multi_Stage_Build pada `backend/Dockerfile` melalui direktif `build.target: production`.
3. WHEN Prod_Compose dijalankan, THE Frontend_Service SHALL menggunakan target `production` dari Multi_Stage_Build pada `frontend/Dockerfile` dan melayani file statis melalui Nginx pada port 80.
4. THE Prod_Compose SHALL menggunakan Named_Volume untuk mempersistensikan data DB_Service.
5. THE Prod_Compose SHALL TIDAK mendefinisikan mapping port untuk DB_Service sehingga port 5432 tidak dapat diakses dari luar jaringan Docker.
6. THE Prod_Compose SHALL mendefinisikan `restart: unless-stopped` pada semua layanan untuk memastikan ketersediaan layanan setelah restart host.
7. THE Prod_Compose SHALL mendefinisikan layanan `migrate` terpisah yang menjalankan `npx prisma migrate deploy`, bergantung pada DB_Service dengan kondisi `service_healthy`, dan Backend_Service SHALL bergantung pada layanan `migrate` dengan kondisi `service_completed_successfully`.
8. THE Prod_Compose SHALL memuat variabel environment untuk setiap layanan dari file `.env` yang sesuai menggunakan direktif `env_file`.

---

### Requirement 5: Inisialisasi dan Migrasi Database

**User Story:** Sebagai Developer, saya ingin database otomatis diinisialisasi dan dimigrasikan ketika stack Docker pertama kali dijalankan, sehingga saya tidak perlu menjalankan perintah migration secara manual.

#### Acceptance Criteria

1. WHEN DB_Service pertama kali dijalankan, THE DB_Service SHALL menginisialisasi database PostgreSQL dengan kredensial yang didefinisikan dalam Environment_File secara otomatis menggunakan variabel environment `POSTGRES_DB`, `POSTGRES_USER`, dan `POSTGRES_PASSWORD`.
2. WHEN Backend_Service dijalankan di lingkungan production, THE Backend_Service SHALL menjalankan `npx prisma migrate deploy` melalui layanan `migrate` terpisah terlebih dahulu sebelum Backend_Service dimulai, sehingga skema database selalu sinkron dengan kode.
3. WHEN Backend_Service dijalankan di lingkungan development, THE System SHALL menjalankan `npx prisma generate` sebagai bagian dari entrypoint atau command dev untuk memastikan Prisma Client ter-generate sebelum hot-reload dimulai.
4. THE System SHALL menyediakan dokumentasi perintah `docker compose exec backend npx prisma db seed` untuk menjalankan seed database secara manual di dalam kontainer backend yang sedang berjalan.
5. IF Migration gagal saat layanan `migrate` dijalankan, THEN THE layanan `migrate` SHALL keluar dengan exit code non-zero sehingga Docker Compose mendeteksi kegagalan dan tidak melanjutkan startup Backend_Service.
6. WHEN layanan `migrate` atau Backend_Service startup, IF DB_Service belum merespons setelah 60 detik, THEN THE layanan tersebut SHALL keluar dengan exit code non-zero dan Docker Compose SHALL melaporkan kegagalan startup.

---

### Requirement 6: Konfigurasi Environment dan Keamanan

**User Story:** Sebagai Developer, saya ingin konfigurasi sensitif dikelola dengan aman menggunakan environment variables, sehingga tidak ada kredensial yang ter-commit ke dalam repository.

#### Acceptance Criteria

1. THE System SHALL menyediakan file `backend/.env.example` dan file `.env.example` di root proyek sebagai template konfigurasi yang berisi semua variabel yang diperlukan dengan nilai placeholder non-fungsional (misalnya `JWT_SECRET=change_me_in_production`), tanpa nilai aktual yang dapat digunakan.
2. THE System SHALL memastikan semua file `.env` aktual terdaftar dalam `.gitignore` di root proyek dan di `backend/.gitignore` sehingga tidak pernah di-commit ke repository.
3. THE System SHALL mendokumentasikan langkah-langkah untuk menyalin `.env.example` menjadi `.env` dan mengisi nilai yang diperlukan sebelum menjalankan Docker Compose.
4. THE Backend_Service SHALL menerima variabel `DATABASE_URL` dengan hostname `db` (bukan `localhost`) dalam konfigurasi Docker Compose, sesuai dengan nama service DB_Service.
5. WHEN Docker_Container DB_Service dijalankan, THE DB_Service SHALL membaca `POSTGRES_DB`, `POSTGRES_USER`, dan `POSTGRES_PASSWORD` dari environment variables dan menginisialisasi database secara otomatis.
6. THE Prod_Compose SHALL mendefinisikan named network Docker yang terisolasi; port internal layanan tidak dapat diakses dari luar network tersebut kecuali port yang secara eksplisit dipublikasikan melalui direktif `ports`.
7. IF salah satu variabel environment wajib (DATABASE_URL, JWT_SECRET, POSTGRES_PASSWORD) tidak terdefinisi saat Docker Compose dijalankan, THEN THE layanan terkait SHALL gagal startup dengan pesan error yang jelas mengidentifikasi variabel yang hilang.

---

### Requirement 7: Pembaruan Steering File dan Dokumentasi

**User Story:** Sebagai Developer, saya ingin steering file `tech.md` diperbarui dengan perintah Docker, sehingga semua anggota tim mengetahui cara menjalankan dan mengelola lingkungan Docker.

#### Acceptance Criteria

1. THE System SHALL memperbarui file `.kiro/steering/tech.md` untuk menyertakan seksi perintah Docker yang mencakup: menjalankan Dev_Compose, menjalankan Prod_Compose, menghentikan layanan, melihat log per-service, dan mengakses shell kontainer.
2. THE System SHALL mendokumentasikan perintah `docker compose exec <service> <command>` untuk menjalankan seed dan migration secara manual di dalam kontainer yang sedang berjalan.
3. THE System SHALL menyertakan perintah untuk melakukan rebuild image menggunakan flag `--build` yang diperlukan ketika ada perubahan pada `Dockerfile`, `package.json`, atau `package-lock.json`.
4. THE System SHALL menyediakan file `README.Docker.md` di root proyek yang mendokumentasikan prasyarat minimum Docker Engine 20.10+ dan Docker Compose v2.0+, serta langkah-langkah setup awal.
5. THE System SHALL mendokumentasikan perbedaan antara Dev_Compose dan Prod_Compose dalam format tabel atau daftar yang mencakup: fitur hot-reload, port yang diekspos, proses migration, dan restart policy.
