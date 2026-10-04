# Implementation Plan: Personal Blog Website

## Overview

Implementasi full-stack blog website dengan arsitektur layered: Express/TypeScript backend (REST API) + React/TypeScript frontend (SPA). Pendekatan incremental dimulai dari fondasi project, kemudian auth, post, comment, dan user profile — setiap layer divalidasi dengan unit test dan property-based test menggunakan fast-check sebelum lanjut ke layer berikutnya.

## Tasks

- [x] 1. Inisialisasi Project dan Konfigurasi
  - [x] 1.1 Set up backend project (Node.js + TypeScript + Express)
    - Buat struktur direktori `backend/` dengan konfigurasi `tsconfig.json`, `package.json`, dan `eslint`
    - Install dependencies: `express`, `typescript`, `ts-node`, `zod`, `jsonwebtoken`, `bcrypt`, `prisma`, `@prisma/client`, `express-rate-limit`, `marked`, `slugify`, `cors`, `helmet`, `uuid`
    - Install devDependencies: `vitest`, `supertest`, `fast-check`, `@types/*`
    - Konfigurasi `vitest.config.ts` dengan environment node
    - _Requirements: semua_

  - [x] 1.2 Set up Prisma dan skema database PostgreSQL
    - Inisialisasi Prisma (`npx prisma init`)
    - Definisikan model `User`, `Post`, `Comment`, `TokenBlacklist`, `LoginAttempts` di `prisma/schema.prisma` sesuai tabel SQL pada design document
    - Buat migration awal: `npx prisma migrate dev --name init`
    - Generate Prisma Client
    - _Requirements: 1, 2, 3, 4, 5, 6, 7, 8_

  - [x] 1.3 Set up frontend project (React + TypeScript + Tailwind CSS)
    - Buat project dengan Vite: `npm create vite@latest frontend -- --template react-ts`
    - Install dependencies: `react-router-dom`, `axios`, `@tanstack/react-query`, `react-markdown`, `zod`, `@hookform/resolvers`, `react-hook-form`
    - Install devDependencies: `tailwindcss`, `postcss`, `autoprefixer`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`
    - Konfigurasi Tailwind CSS v4: hapus `tailwind.config.js`, gunakan `@import "tailwindcss"` langsung di `src/index.css`
    - Buat struktur direktori `src/` sesuai design: `api/`, `components/`, `pages/`, `hooks/`, `contexts/`, `types/`
    - _Requirements: semua_


  - [x] 1.4 Definisikan shared TypeScript types dan interfaces
    - Buat `backend/src/types/index.ts` dengan interfaces: `JwtPayload`, `AuthTokens`, `RegisterDto`, `LoginDto`, `CreatePostDto`, `UpdatePostDto`, `LockoutStatus`
    - Buat `frontend/src/types/index.ts` dengan interfaces: `Post`, `Comment`, `User`, `AuthState`, `PaginatedResponse`, `ErrorResponse` sesuai design document
    - _Requirements: 1, 2, 3, 4, 5, 6, 8_


  - [x] 1.5 Setup tema visual dan tipografi Computer Modern
    - Unduh font CMU Serif (Computer Modern Unicode) dalam format WOFF2 dari https://checkmyworking.com/cm-web-fonts/ dan tempatkan di `frontend/public/fonts/`: `cmunrm.woff2` (regular), `cmunbx.woff2` (bold), `cmunti.woff2` (italic), `cmunbi.woff2` (bold italic)
    - Tulis `frontend/src/index.css` dengan isi lengkap sesuai design document — `@font-face` untuk Computer Modern, CSS custom property tokens untuk light mode (`:root`) dan dark mode (`.dark`), `@theme inline` mappings ke Tailwind color tokens, dan `@layer base` yang mengaplikasikan `font-family: Computer Modern` ke `body`
    - Buat `frontend/src/hooks/useTheme.ts`: baca/tulis `localStorage` key `theme`, toggle kelas `.dark` pada `document.documentElement`, export `{ theme, toggleTheme }`
    - Tambahkan script inline di `frontend/index.html` sebelum `</head>` untuk mencegah FOUC: baca `localStorage.theme` dan set kelas `.dark` pada `<html>` sebelum React mount
    - _Requirements: semua (visual design)_

- [x] 2. Backend - Middleware dan Infrastruktur

  - [x] 2.1 Implementasi Zod validation schemas dan `validateBody` middleware
    - Buat `backend/src/schemas/auth.schema.ts`: schema untuk `RegisterDto` (email valid, username 3–50 char, password min 8 char), `LoginDto`
    - Buat `backend/src/schemas/post.schema.ts`: schema untuk `CreatePostDto` (title 1–200 char, content tidak kosong), `UpdatePostDto`
    - Buat `backend/src/schemas/comment.schema.ts`: schema untuk comment content (1–2000 char)
    - Buat `backend/src/schemas/user.schema.ts`: schema untuk update username (unik, tidak kosong, max 50 char) dan update password (old + new, new 8–72 char)
    - Implementasi middleware `validateBody(schema)` di `backend/src/middleware/validateBody.ts`
    - _Requirements: 2.3, 3.5, 6.7, 7.7, 8.2, 8.4_

  - [x] 2.2 Tulis unit tests untuk validation schemas
    - Test setiap schema untuk kasus valid, boundary values (panjang min/max), dan kasus invalid
    - _Requirements: 2.3, 3.5, 6.7, 7.7_

  - [x] 2.3 Implementasi `authenticateJWT` middleware
    - Buat `backend/src/middleware/authenticateJWT.ts`
    - Verifikasi JWT dari header `Authorization: Bearer <token>`
    - Cek token di `TokenBlacklist` tabel (query via Prisma)
    - Isi `req.user` dengan decoded JWT payload
    - Kembalikan 401 jika token tidak ada, tidak valid, kedaluwarsa, atau ter-blacklist
    - _Requirements: 1.5, 7.1_

  - [x] 2.4 Implementasi `requireRole` middleware
    - Buat `backend/src/middleware/requireRole.ts` sebagai middleware factory `requireRole(role: 'admin' | 'user')`
    - Baca `req.user.role` dan bandingkan dengan role yang dibutuhkan
    - Kembalikan 403 jika role tidak sesuai atau tidak ada klaim `role`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 2.5 Implementasi rate limiter dan account lockout middleware
    - Buat `backend/src/middleware/rateLimiter.ts`: `loginRateLimiter` menggunakan `express-rate-limit` (max 10 req/IP/60 detik, kembalikan 429)
    - Buat `backend/src/middleware/accountLockout.ts`: `accountLockoutMiddleware` yang membaca tabel `login_attempts` via Prisma, cek `locked_until`, kembalikan 409 jika terkunci
    - _Requirements: 1.4, 7.5, 7.6_

  - [x] 2.6 Tulis unit tests untuk middleware auth dan rate limiter
    - Test `authenticateJWT`: token valid, token expired, token blacklisted, token missing
    - Test `requireRole`: role sesuai, role tidak sesuai, role missing
    - Test `accountLockoutMiddleware`: akun tidak terkunci, akun terkunci, lockout expired
    - _Requirements: 1.4, 1.5, 7.1–7.3, 7.5, 7.6_

- [x] 3. Backend – Auth Service dan Routes
  - [x] 3.1 Implementasi `AuthService`
    - Buat `backend/src/services/auth.service.ts` mengimplementasi interface `AuthService` dari design
    - `registerUser`: hash password dengan bcrypt (cost 12), simpan ke tabel `users`, kembalikan `UserProfile`; kembalikan 409 jika email/username duplikat
    - `loginAdmin` dan `loginUser`: verifikasi credentials, generate JWT dengan klaim `role` dan `jti`, set expiry (Admin 24 jam, User 7 hari); kembalikan pesan generik jika invalid (tidak ungkap field mana yang salah)
    - `logout`: hash token, simpan ke `token_blacklist` bersama `jti` dan `expires_at`
    - `recordFailedAttempt` dan `checkAccountLockout`: update tabel `login_attempts`, set `locked_until = NOW + 15min` setelah 5 kali gagal berturut-turut
    - _Requirements: 1.1–1.7, 2.1–2.6, 7.1_

  - [x] 3.2 Tulis property test untuk JWT blacklist (Property 9)
    - **Property 9: JWT blacklist prevents reuse after logout**
    - **Validates: Requirements 1.6**
    - Gunakan fast-check: untuk setiap JWT yang telah di-logout, verifikasi `isTokenBlacklisted` mengembalikan `true` dan request dengan token tersebut ditolak 401
    - _Requirements: 1.6_

  - [x] 3.3 Tulis unit tests untuk AuthService
    - Test registrasi: sukses, duplikat email, duplikat username, password terlalu pendek
    - Test login: kredensial valid (admin & user), kredensial invalid, akun terkunci
    - Test logout: token berhasil di-blacklist
    - Test account lockout: 5 kali gagal → terkunci, lockout expired → bisa login lagi
    - _Requirements: 1.1–1.7, 2.1–2.6_

  - [x] 3.4 Implementasi Auth Router dan Controller
    - Buat `backend/src/controllers/auth.controller.ts` dengan handler: `register`, `login`, `logout`
    - Buat `backend/src/routes/auth.routes.ts`: POST `/register` (loginRateLimiter + validateBody), POST `/login` (loginRateLimiter + accountLockoutMiddleware + validateBody), POST `/logout` (authenticateJWT)
    - Kembalikan JWT dalam response body; format error sesuai `ErrorResponse` interface
    - _Requirements: 1.1–1.7, 2.1–2.6_

  - [x] 3.5 Tulis integration tests untuk Auth routes
    - Test full flow: register → login → access protected route → logout → reuse token (expect 401)
    - Test rate limiting: 10+ requests dalam 60 detik → expect 429
    - Test account lockout: 5x login gagal → 409 → setelah 15 menit → login berhasil
    - Gunakan test PostgreSQL database via Prisma
    - _Requirements: 1.1–1.7, 2.1–2.6, 7.5, 7.6_

- [x] 4. Checkpoint — Verifikasi Auth Layer
  - Pastikan semua tests di layer auth lulus. Jalankan `npx vitest run` di direktori backend.
  - Tanyakan kepada user jika ada pertanyaan sebelum melanjutkan.

- [x] 5. Backend – Post Service dan Routes
  - [x] 5.1 Implementasi `PostService` — core CRUD dan slug generation
    - Buat `backend/src/services/post.service.ts` mengimplementasi interface `PostService`
    - `generateUniqueSlug(title)`: gunakan `slugify`, cek keunikan di DB, tambahkan suffix numerik jika collision (contoh: `judul-post-2`)
    - `createPost`: validasi judul/konten, generate slug unik, simpan dengan status `draft`
    - `updatePost`: update konten dan timestamp; jika judul berubah, regenerate slug unik; jika status `published`, otomatis revert ke `draft`
    - `deletePost`: hapus post (comments terhapus cascade via FK)
    - _Requirements: 3.1–3.7, 4.3_

  - [x] 5.2 Tulis property test untuk slug uniqueness (Property 1)
    - **Property 1: Slug uniqueness after generation**
    - **Validates: Requirements 3.1, 3.2**
    - Gunakan fast-check: untuk sembarang set judul post yang ada dan judul baru, slug yang dihasilkan tidak boleh collision dengan slug yang sudah ada
    - _Requirements: 3.1, 3.2_

  - [x] 5.3 Tulis property test untuk slug regeneration on title change (Property 2)
    - **Property 2: Slug regeneration on title change**
    - **Validates: Requirements 3.3**
    - Gunakan fast-check: untuk sembarang post dengan slug tertentu dan judul baru yang berbeda, sistem menghasilkan slug baru dari judul baru
    - _Requirements: 3.3_

  - [x] 5.4 Tulis property test untuk auto-revert to Draft on edit (Property 3)
    - **Property 3: Published post auto-reverts to Draft on edit**
    - **Validates: Requirements 3.4**
    - Gunakan fast-check: untuk sembarang post berstatus Published yang diupdate, status hasil harus `draft`
    - _Requirements: 3.4_

  - [x] 5.5 Implementasi `PostService` — publish, unpublish, dan query
    - `publishPost`: ubah status menjadi `published`, catat `published_at`; kembalikan 409 jika sudah `published`
    - `unpublishPost`: ubah status menjadi `draft`; kembalikan 409 jika sudah `draft`
    - `getPublishedPosts(page, pageSize)`: return posts berstatus `published` saja, diurutkan `published_at DESC`, 10 per halaman, sertakan `commentCount`
    - `getAllPosts(page, pageSize)`: return semua posts (draft + published), diurutkan `updated_at DESC`, 20 per halaman
    - `getPostBySlug(slug)`: return post berstatus `published`; throw 404 jika tidak ada atau berstatus `draft`
    - `searchPosts(keyword, page)`: gunakan PostgreSQL full-text search (`to_tsvector`), filter hanya `published`, ordered by `published_at DESC`
    - _Requirements: 4.1, 4.2, 4.5, 4.7, 5.1–5.7_

  - [x] 5.6 Tulis property test untuk status transition validity (Property 4)
    - **Property 4: Status transition validity**
    - **Validates: Requirements 4.6**
    - Gunakan fast-check: mencoba publish post yang sudah Published atau unpublish post yang sudah Draft selalu menghasilkan error 409 dan status tidak berubah
    - _Requirements: 4.6_

  - [x] 5.7 Tulis property test untuk public endpoint returns only Published posts (Property 6)
    - **Property 6: Public endpoint returns only Published posts**
    - **Validates: Requirements 4.7, 5.1, 5.5**
    - Gunakan fast-check: untuk sembarang halaman yang di-query di endpoint publik, semua post dalam response berstatus `published`
    - _Requirements: 4.7, 5.1, 5.5_

  - [x] 5.8 Tulis property test untuk search returns only matching Published posts (Property 13)
    - **Property 13: Search returns only matching Published posts**
    - **Validates: Requirements 5.5**
    - Gunakan fast-check: untuk sembarang keyword non-empty, setiap post di hasil pencarian berstatus `published` dan mengandung keyword di judul atau kontennya
    - _Requirements: 5.5_

  - [x] 5.9 Tulis unit tests untuk PostService
    - Test `generateUniqueSlug`: judul normal, judul dengan karakter khusus, collision handling (suffix numerik)
    - Test `createPost`: input valid, judul kosong, konten kosong
    - Test `updatePost`: tanpa perubahan judul (slug tidak berubah), dengan perubahan judul (slug regenerated), post Published → otomatis Draft
    - Test `publishPost`/`unpublishPost`: transisi valid, transisi invalid (409)
    - Test `getPublishedPosts`, `getPostBySlug`, `searchPosts`
    - _Requirements: 3.1–3.7, 4.1–4.8, 5.1–5.7_

  - [x] 5.10 Implementasi Post Router dan Controller
    - Buat `backend/src/controllers/post.controller.ts` dengan handler untuk semua operasi Post
    - Buat `backend/src/routes/post.routes.ts` dengan routes sesuai design:
      - GET `/` (publik, paginated) — `getPublishedPosts`
      - GET `/admin` (Admin only) — `getAllPosts`
      - GET `/search` (publik) — `searchPosts`; validasi keyword tidak kosong/spasi
      - GET `/:slug` (publik) — `getPostBySlug`
      - POST `/` (Admin) — `validateBody` + `createPost`
      - PUT `/:id` (Admin) — `validateBody` + `updatePost`
      - PATCH `/:id/publish` (Admin) — `publishPost`
      - PATCH `/:id/unpublish` (Admin) — `unpublishPost`
      - DELETE `/:id` (Admin) — `deletePost`
    - Render Markdown ke HTML menggunakan `marked` sebelum dikembalikan dalam response
    - _Requirements: 3.1–3.7, 4.1–4.8, 5.1–5.7_

  - [x] 5.11 Tulis integration tests untuk Post routes
    - Test CRUD lifecycle: create (Draft) → update → publish → update (auto-revert to Draft) → republish → delete
    - Test cascade delete: post dengan komentar → hapus post → verifikasi komentar juga terhapus
    - Test akses kontrol: visitor mencoba akses endpoint admin → 403
    - Test 404 untuk draft post diakses oleh visitor
    - Test pencarian: keyword valid, keyword kosong (expect error), tidak ada hasil
    - _Requirements: 3.1–3.7, 4.1–4.8, 5.1–5.7_

- [x] 6. Backend – Comment Service dan Routes
  - [x] 6.1 Implementasi `CommentService`
    - Buat `backend/src/services/comment.service.ts` mengimplementasi interface `CommentService`
    - `addComment(postId, authorId, content)`: verifikasi post berstatus `published` (throw 404 jika tidak), simpan comment baru; validasi content 1–2000 char sudah ditangani oleh Zod schema sebelumnya
    - `deleteComment(commentId, requesterId, requesterRole)`: hapus hanya jika requester adalah owner atau admin; kembalikan 403 jika bukan; kembalikan 404 jika comment tidak ditemukan
    - `getCommentsByPost(postId)`: return semua comments pada post, urut `created_at ASC`
    - _Requirements: 6.1–6.7_

  - [x] 6.2 Tulis property test untuk comment ownership enforcement (Property 7)
    - **Property 7: Comment ownership enforcement**
    - **Validates: Requirements 6.3, 6.4, 6.5**
    - Gunakan fast-check: delete comment request berhasil hanya jika requester adalah author atau admin; requester lain selalu 403
    - _Requirements: 6.3, 6.4, 6.5_

  - [x] 6.3 Tulis property test untuk comment content validation (Property 8)
    - **Property 8: Comment content validation**
    - **Validates: Requirements 6.1, 6.7**
    - Gunakan fast-check: comment disimpan jika dan hanya jika konten antara 1 dan 2000 karakter; semua submission lain ditolak dengan validation error
    - _Requirements: 6.1, 6.7_

  - [x] 6.4 Tulis unit tests untuk CommentService
    - Test `addComment`: sukses, post bukan published (404), konten kosong, konten >2000 char
    - Test `deleteComment`: owner menghapus miliknya, admin menghapus milik siapapun, user lain mencoba hapus (403), comment tidak ada (404)
    - Test `getCommentsByPost`: ada komentar (urut ascending), tidak ada komentar
    - _Requirements: 6.1–6.7_

  - [x] 6.5 Implementasi Comment Router dan Controller
    - Buat `backend/src/controllers/comment.controller.ts`
    - Buat `backend/src/routes/comment.routes.ts`: mount di `/api/posts/:postId/comments`
      - GET `/` (publik) — `getCommentsByPost`
      - POST `/` (Registered_User) — `authenticateJWT` + `requireRole('user')` + `validateBody` + `addComment`
      - DELETE `/:commentId` (Owner atau Admin) — `authenticateJWT` + `deleteComment`
    - _Requirements: 6.1–6.7_

  - [x] 6.6 Tulis integration tests untuk Comment routes
    - Test add comment: Registered_User pada Published post
    - Test add comment: visitor tanpa token → 401
    - Test delete: owner hapus miliknya → sukses; user lain hapus → 403; admin hapus milik siapapun → sukses
    - _Requirements: 6.1–6.7_

- [x] 7. Backend – User Service dan Routes
  - [x] 7.1 Implementasi `UserService`
    - Buat `backend/src/services/user.service.ts` mengimplementasi interface `UserService`
    - `getProfile(userId)`: query tabel `users`, kembalikan `UserProfile` (tanpa `password_hash`)
    - `updateUsername(userId, newUsername)`: verifikasi keunikan username baru; update DB; kembalikan profil terbaru; kembalikan 409 jika duplikat
    - `updatePassword(userId, oldPassword, newPassword)`: verifikasi `oldPassword` cocok dengan hash; pastikan `newPassword !== oldPassword`; hash password baru dengan bcrypt; update DB
    - _Requirements: 8.1–8.6_

  - [x] 7.2 Tulis property test untuk username uniqueness on update (Property 11)
    - **Property 11: Username uniqueness on update**
    - **Validates: Requirements 8.2, 8.3**
    - Gunakan fast-check: update username berhasil jika dan hanya jika username baru tidak digunakan akun lain; duplikat selalu menghasilkan 409 dan username tidak berubah
    - _Requirements: 8.2, 8.3_

  - [x] 7.3 Tulis property test untuk password change requires correct current password (Property 12)
    - **Property 12: Password change requires correct current password**
    - **Validates: Requirements 8.4, 8.5**
    - Gunakan fast-check: update password berhasil jika dan hanya jika current password yang diberikan cocok dengan hash yang tersimpan; password yang salah selalu menghasilkan error dan password tidak berubah
    - _Requirements: 8.4, 8.5_

  - [x] 7.4 Tulis unit tests untuk UserService
    - Test `getProfile`: user ada, user tidak ada (404)
    - Test `updateUsername`: username unik (sukses), username duplikat (409), username kosong
    - Test `updatePassword`: password lama benar + password baru valid, password lama salah (error), password baru sama dengan lama (error), password baru terlalu pendek
    - _Requirements: 8.1–8.6_

  - [x] 7.5 Implementasi User Router dan Controller
    - Buat `backend/src/controllers/user.controller.ts`
    - Buat `backend/src/routes/user.routes.ts`: mount di `/api/users`
      - GET `/me` (Registered_User) — `authenticateJWT` + `requireRole('user')` + `getProfile`
      - PATCH `/me/username` (Registered_User) — `authenticateJWT` + `requireRole('user')` + `validateBody` + `updateUsername`
      - PATCH `/me/password` (Registered_User) — `authenticateJWT` + `requireRole('user')` + `validateBody` + `updatePassword`
    - _Requirements: 8.1–8.6_

  - [x] 7.6 Sambungkan semua routes ke Express app
    - Buat `backend/src/app.ts`: setup Express instance dengan `cors`, `helmet`, `express.json()`
    - Mount semua routers: `/api/auth`, `/api/posts`, `/api/users`
    - Tambahkan global error handler middleware (format sesuai `ErrorResponse` interface)
    - Tambahkan handler 404 untuk routes yang tidak dikenal
    - Buat `backend/src/server.ts` sebagai entry point
    - _Requirements: 7.4, 7.7_

- [x] 8. Checkpoint — Verifikasi Backend Lengkap
  - Jalankan `npx vitest run` — semua unit tests dan property tests harus lulus.
  - Jalankan integration tests dengan test database.
  - Tanyakan kepada user jika ada pertanyaan sebelum melanjutkan ke frontend.

- [x] 9. Frontend – Infrastruktur dan Auth
  - [x] 9.1 Set up Axios instance dan API client functions
    - Buat `frontend/src/api/client.ts`: Axios instance dengan `baseURL`, interceptor 401 → clear auth → redirect `/login`, interceptor 429 → tampilkan pesan error
    - Buat `frontend/src/api/auth.ts`: fungsi `register`, `login`, `logout`
    - Buat `frontend/src/api/posts.ts`: fungsi `getPublishedPosts`, `getPostBySlug`, `searchPosts`, `getAllPosts` (admin), `createPost`, `updatePost`, `publishPost`, `unpublishPost`, `deletePost`
    - Buat `frontend/src/api/comments.ts`: fungsi `getComments`, `addComment`, `deleteComment`
    - Buat `frontend/src/api/users.ts`: fungsi `getProfile`, `updateUsername`, `updatePassword`
    - _Requirements: 1, 2, 3, 4, 5, 6, 8_

  - [x] 9.2 Implementasi `AuthContext` dan `useAuth` hook
    - Buat `frontend/src/contexts/AuthContext.tsx`: simpan `user` dan `token` di state; persist token di `localStorage`; expose `login`, `logout`, `isAuthenticated`, `isAdmin`
    - Buat `frontend/src/hooks/useAuth.ts` sebagai consumer hook dari `AuthContext`
    - Handle token expiry: jika JWT expired, clear auth state secara otomatis
    - _Requirements: 1.2, 1.7, 2.4_

  - [x] 9.3 Implementasi layout komponen dan routing
    - Buat `frontend/src/components/layout/Navbar.tsx`: navigasi publik (beranda, login, register) dan navigasi sesuai role (admin dashboard, logout, profil)
    - Buat `frontend/src/components/layout/Footer.tsx`
    - Buat `frontend/src/components/layout/Layout.tsx`: wrapper dengan Navbar dan Footer
    - Buat `frontend/src/App.tsx`: setup React Router dengan routes — publik (`/`, `/posts/:slug`, `/search`), auth (`/login`, `/register`), admin (`/admin`, `/admin/posts/new`, `/admin/posts/:id/edit`), user (`/profile`)
    - Buat `ProtectedRoute` component untuk guard route berdasarkan role
    - _Requirements: 1.2, 1.7, 2.1, 2.4_

  - [x] 9.4 Implementasi halaman Login dan Register
    - Buat `frontend/src/pages/auth/LoginPage.tsx`: form dengan validasi Zod via react-hook-form; tampilkan pesan error dari server; redirect ke dashboard jika admin atau ke beranda jika user setelah login berhasil
    - Buat `frontend/src/pages/auth/RegisterPage.tsx`: form registrasi dengan validasi client-side (password min 8 char, email format, username 3–50 char); tampilkan field-level error dari server (409)
    - _Requirements: 1.1, 1.2, 2.1–2.5_

  - [x] 9.5 Tulis unit tests untuk AuthContext dan form components
    - Test `AuthContext`: login, logout, token persistence, expiry handling
    - Test `LoginPage`: submit valid, submit invalid (validasi), error dari server
    - Test `RegisterPage`: validasi client-side, duplikat email/username error
    - _Requirements: 1.1–1.7, 2.1–2.6_

- [x] 10. Frontend – Halaman Publik (Visitor)
  - [x] 10.1 Implementasi reusable UI components
    - Buat `frontend/src/components/ui/Button.tsx`, `Input.tsx`, `Badge.tsx`, `Pagination.tsx`
    - `Pagination`: terima `currentPage`, `totalPages`, callback `onPageChange`; render navigasi halaman
    - _Requirements: 5.4_

  - [x] 10.2 Implementasi `PostCard` dan `PostList` component
    - Buat `frontend/src/components/blog/PostCard.tsx`: tampilkan judul, ringkasan (200 char pertama), tanggal publikasi, jumlah komentar; link ke halaman detail
    - Buat `frontend/src/components/blog/PostList.tsx`: render list `PostCard` dengan `Pagination`
    - _Requirements: 5.4_

  - [x] 10.3 Implementasi `HomePage`
    - Buat `frontend/src/pages/public/HomePage.tsx`
    - Gunakan React Query (`usePosts` hook) untuk fetch `getPublishedPosts` dengan pagination
    - Tampilkan `PostList` dengan 10 post per halaman, diurutkan berdasarkan `published_at DESC`
    - Tampilkan search bar yang link ke `SearchPage`
    - _Requirements: 5.1, 5.4_

  - [x] 10.4 Implementasi `PostDetailPage`
    - Buat `frontend/src/pages/public/PostDetailPage.tsx`
    - Fetch post by slug; render `contentHtml` (sudah dirender server dengan `marked`)
    - Tampilkan `CommentList` dan `CommentForm` (jika user login)
    - Tampilkan 404 component jika post tidak ditemukan atau berstatus draft
    - _Requirements: 5.2, 5.3, 6.6_

  - [x] 10.5 Implementasi `SearchPage`
    - Buat `frontend/src/pages/public/SearchPage.tsx`
    - Form pencarian dengan validasi: keyword tidak boleh kosong atau hanya spasi
    - Tampilkan hasil menggunakan `PostList`; tampilkan pesan "tidak ada hasil" jika kosong
    - _Requirements: 5.5, 5.6, 5.7_

  - [x] 10.6 Implementasi `CommentList` dan `CommentForm`
    - Buat `frontend/src/components/blog/CommentList.tsx`: tampilkan komentar urut ascending; tampilkan pesan jika belum ada komentar; tampilkan tombol hapus untuk owner dan admin
    - Buat `frontend/src/components/blog/CommentForm.tsx`: textarea dengan counter karakter (max 2000); validasi tidak boleh kosong; kirim via `addComment` API; tampilkan error validasi
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 10.7 Tulis unit tests untuk public page components
    - Test `PostCard`: render data yang benar, link navigasi
    - Test `Pagination`: render halaman yang benar, navigasi prev/next
    - Test `CommentForm`: validasi panjang, submit, tampilkan error
    - Test `SearchPage`: keyword kosong → error, pencarian valid → tampilkan hasil
    - _Requirements: 5.4, 5.5–5.7, 6.1, 6.7_

- [x] 11. Frontend – Admin Dashboard
  - [x] 11.1 Implementasi `PostEditor` component
    - Buat `frontend/src/components/admin/PostEditor.tsx`: form dengan input judul (max 200 char) dan textarea konten Markdown
    - Implementasi fitur preview Markdown menggunakan `react-markdown` yang merender konten di sebelah form
    - Validasi client-side: judul tidak boleh kosong/hanya spasi, konten tidak boleh kosong
    - _Requirements: 3.5, 3.6, 3.7_

  - [x] 11.2 Implementasi `PostTable` dan `StatusBadge` component
    - Buat `frontend/src/components/admin/StatusBadge.tsx`: badge visual untuk status `draft` (kuning) dan `published` (hijau)
    - Buat `frontend/src/components/admin/PostTable.tsx`: tabel dengan kolom judul, status, tanggal update, tombol aksi (Edit, Publish/Unpublish, Delete)
    - _Requirements: 4.5_

  - [x] 11.3 Implementasi `DashboardPage`
    - Buat `frontend/src/pages/admin/DashboardPage.tsx`
    - Fetch semua posts (draft + published) via `getAllPosts` dengan pagination (20 per halaman, urut `updated_at DESC`)
    - Render `PostTable` dengan aksi publish, unpublish, dan delete dengan konfirmasi
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [x] 11.4 Implementasi `CreatePostPage` dan `EditPostPage`
    - Buat `frontend/src/pages/admin/CreatePostPage.tsx`: render `PostEditor` kosong; kirim via `createPost` API; redirect ke dashboard setelah berhasil
    - Buat `frontend/src/pages/admin/EditPostPage.tsx`: fetch post by id, prefill `PostEditor`; kirim via `updatePost` API; tampilkan notifikasi bahwa post akan kembali ke Draft jika sedang Published; redirect ke dashboard setelah berhasil
    - _Requirements: 3.1–3.7, 4.4_

  - [x] 11.5 Tulis unit tests untuk admin components
    - Test `PostEditor`: validasi form, preview Markdown render, submit handling
    - Test `DashboardPage`: render post list, aksi publish/unpublish/delete
    - Test `CreatePostPage` / `EditPostPage`: submit valid, submit invalid, redirect
    - _Requirements: 3.1–3.7, 4.1–4.5_

- [x] 12. Frontend – Profil Pengguna
  - [x] 12.1 Implementasi `ProfilePage`
    - Buat `frontend/src/pages/user/ProfilePage.tsx`
    - Tampilkan informasi akun: username, email, tanggal bergabung (dari `getProfile` API)
    - Form update username dengan validasi (tidak kosong, max 50 char); tampilkan error 409 jika duplikat
    - Form update password (old password + new password 8–72 char); validasi bahwa new ≠ old; tampilkan error jika old password salah
    - _Requirements: 8.1–8.6_

  - [x] 12.2 Tulis unit tests untuk ProfilePage
    - Test tampilkan data profil
    - Test update username: sukses, duplikat username (error 409), username kosong
    - Test update password: sukses, old password salah, new = old (error)
    - _Requirements: 8.1–8.6_

- [x] 13. Checkpoint — Verifikasi Frontend Lengkap
  - Jalankan `npx vitest run` di direktori frontend — semua unit tests harus lulus.
  - Tanyakan kepada user jika ada pertanyaan sebelum melanjutkan ke E2E tests.

- [x] 14. Cronjob dan Property Test untuk Role Enforcement
  - [x] 14.1 Implementasi cronjob pembersihan token blacklist
    - Buat `backend/src/jobs/cleanupBlacklist.ts`: query dan hapus records dari `token_blacklist` di mana `expires_at < NOW()`
    - Jadwalkan cronjob setiap 1 jam menggunakan `node-cron` atau via `setInterval`
    - _Requirements: (design: Token Blacklist Cleanup)_

  - [x] 14.2 Tulis property test untuk role claim enforces endpoint access (Property 10)
    - **Property 10: Role claim enforces endpoint access**
    - **Validates: Requirements 7.1, 7.2, 7.3**
    - Gunakan fast-check: untuk sembarang request ke admin-only endpoint, request berhasil jika dan hanya jika JWT payload mengandung `role: "admin"`; semua nilai role lain atau missing claims menghasilkan 403
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 14.3 Tulis property test untuk post deletion cascade (Property 5)
    - **Property 5: Post deletion cascades to comments**
    - **Validates: Requirements 4.3**
    - Gunakan fast-check: untuk sembarang post dengan satu atau lebih komentar, setelah post dihapus, semua komentar yang terkait juga tidak ada di database
    - _Requirements: 4.3_

- [x] 15. E2E Tests dengan Playwright
  - [x] 15.1 Tulis E2E tests untuk Visitor flow
    - Setup Playwright project dengan konfigurasi baseURL
    - Test: browse homepage → navigasi post → baca konten → search dengan keyword → verifikasi hasil → akses slug tidak valid → tampilkan 404
    - _Requirements: 5.1–5.7_

  - [x] 15.2 Tulis E2E tests untuk Registered_User flow
    - Test: register akun baru → login → buka post → tambah komentar → verifikasi komentar tampil → hapus komentar milik sendiri → buka halaman profil → update username
    - _Requirements: 2.1–2.6, 6.1–6.7, 8.1–8.3_

  - [x] 15.3 Tulis E2E tests untuk Admin flow
    - Test: login admin → buka dashboard → buat post baru (dengan Markdown preview) → publish → edit post (verifikasi auto-revert ke Draft) → publish ulang → unpublish → hapus post
    - Test: login admin → hapus komentar user dari post manapun
    - _Requirements: 1.1–1.7, 3.1–3.7, 4.1–4.8, 6.5_

- [x] 16. Final Checkpoint — Semua Tests Harus Lulus
  - Jalankan semua unit tests, property tests, dan integration tests.
  - Pastikan tidak ada TypeScript compilation errors (`tsc --noEmit`).
  - Jalankan Playwright E2E tests.
  - Tanyakan kepada user jika ada pertanyaan.

## Notes

- Tasks bertanda `*` bersifat opsional dan dapat dilewati untuk MVP yang lebih cepat
- Setiap task mereferensikan requirements spesifik untuk traceability
- Property-based tests menggunakan fast-check dengan minimum 100 iterasi sesuai design document
- Tag property test format: `// Feature: personal-blog-website, Property {N}: {property_text}`
- Unit tests dan property tests bersifat komplementer, bukan saling menggantikan
- Cronjob pembersihan token blacklist penting untuk mencegah tabel tumbuh tak terbatas
- HTTPS hanya diperlukan di lingkungan produksi (Requirement 7.4)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["2.1", "2.3", "2.4", "2.5", "9.1"] },
    { "id": 3, "tasks": ["2.2", "2.6", "3.1", "9.2", "9.3"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4", "9.4", "10.1"] },
    { "id": 5, "tasks": ["3.5", "5.1", "9.5", "10.2"] },
    { "id": 6, "tasks": ["5.2", "5.3", "5.4", "5.5", "10.3", "10.4", "10.5"] },
    { "id": 7, "tasks": ["5.6", "5.7", "5.8", "5.9", "6.1", "10.6", "11.1", "11.2"] },
    { "id": 8, "tasks": ["5.10", "5.11", "6.2", "6.3", "6.4", "10.7", "11.3"] },
    { "id": 9, "tasks": ["6.5", "7.1", "11.4", "12.1"] },
    { "id": 10, "tasks": ["6.6", "7.2", "7.3", "7.4", "11.5", "12.2"] },
    { "id": 11, "tasks": ["7.5", "14.1"] },
    { "id": 12, "tasks": ["7.6", "14.2", "14.3"] },
    { "id": 13, "tasks": ["15.1", "15.2", "15.3"] }
  ]
}
```
