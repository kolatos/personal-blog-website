# Panduan Deploy ke Vercel

Dokumen ini menjelaskan semua environment variable yang dibutuhkan saat deploy ke Vercel dan cara mendapatkan nilainya.

---

## Ringkasan

Proyek ini terdiri dari dua service:
- **Backend** (`backend/`) — Node.js + Express + Prisma, butuh database PostgreSQL
- **Frontend** (`frontend/`) — React + Vite

Vercel perlu tahu URL backend yang sudah di-deploy agar frontend bisa memanggilnya.

---

## Environment Variables: Backend

Tambahkan semua ini di **Vercel → Project Settings → Environment Variables** untuk service backend (atau scope ke `backend/`).

### 1. `DATABASE_URL` ⚠️ Wajib

Koneksi string ke PostgreSQL. Karena Vercel tidak menyediakan PostgreSQL, kamu perlu database eksternal.

**Rekomendasi: Neon (gratis)**

1. Buka [neon.tech](https://neon.tech) → Sign Up / Login
2. Buat project baru
3. Setelah project dibuat, klik **"Connection Details"**
4. Pilih format **"Prisma"** di dropdown
5. Copy string yang muncul, bentuknya seperti:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```
6. Paste sebagai nilai `DATABASE_URL`

> ⚠️ Pastikan format connection string mengandung `?sslmode=require` untuk koneksi ke Neon.

**Alternatif lain:** Supabase ([supabase.com](https://supabase.com)) → Project → Settings → Database → Connection String → URI mode.

---

### 2. `JWT_SECRET` ⚠️ Wajib

Secret key untuk menandatangani JWT token. Harus panjang, acak, dan **tidak boleh dibagikan**.

**Cara generate:**

Jalankan perintah ini di terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Hasilnya akan seperti:
```
a3f8c2e1b4d7....(128 karakter hex)
```

Copy output tersebut sebagai nilai `JWT_SECRET`.

---

### 3. `JWT_EXPIRES_IN`

Durasi token JWT untuk Admin.

```
24h
```

---

### 4. `JWT_USER_EXPIRES_IN`

Durasi token JWT untuk Registered User.

```
7d
```

---

### 5. `NODE_ENV` ⚠️ Wajib

Harus diset ke `production` agar rate limiter aktif dan endpoint test di-disable.

```
production
```

---

### 6. `PORT` (opsional)

Vercel biasanya menangani port otomatis. Kalau perlu, set:

```
3001
```

---

### 7. `ADMIN_EMAIL` (untuk seed database)

Email akun admin yang dibuat saat `prisma db seed` pertama kali dijalankan.

```
kamu@gmail.com
```

> Dipakai hanya saat seed, bukan saat app running. Default jika tidak diset: `admin@blog.com`

---

### 8. `ADMIN_USERNAME_SEED` (untuk seed database)

Username akun admin.

```
admin
```

> Default jika tidak diset: `admin`

---

### 9. `ADMIN_PASSWORD_SEED` ⚠️ Sangat Disarankan

Password akun admin. **Ganti dari default** — siapapun yang tahu default value bisa login sebagai admin.

Pilih password kuat (minimal 12 karakter, kombinasi huruf besar/kecil, angka, simbol).

> Default jika tidak diset: `Admin1234!` — **jangan biarkan ini di production.**

---

### 10. `RESEND_API_KEY` (untuk fitur email subscription — Stage 1)

Digunakan untuk mengirim email notifikasi ke subscriber ketika post baru dipublish.

1. Buka [resend.com](https://resend.com) → Sign Up / Login
2. Klik **"API Keys"** di sidebar
3. Klik **"Create API Key"**
4. Beri nama (misal: `kirodico-production`), pilih permission **"Full Access"**
5. Copy API key yang muncul (hanya tampil sekali!)

Format: `re_xxxxxxxxxxxx`

> Jika key ini tidak diset, fitur email akan no-op (tidak error, tapi email tidak terkirim).

---

### 11. `RESEND_FROM_EMAIL` (untuk fitur email subscription — Stage 1)

Alamat email pengirim. Harus domain yang sudah diverifikasi di Resend.

1. Di dashboard Resend, klik **"Domains"**
2. Tambahkan domain kamu dan ikuti langkah verifikasi DNS
3. Setelah terverifikasi, set value ke:
   ```
   noreply@yourdomain.com
   ```

> Kalau belum punya domain, sementara bisa pakai domain bawaan Resend untuk testing: `onboarding@resend.dev` (terbatas ke email kamu sendiri saja).

---

## Environment Variables: Frontend

Tambahkan ini untuk service frontend.

### 1. `VITE_API_URL` ⚠️ Wajib

URL backend yang sudah di-deploy. Ini yang dipakai frontend untuk memanggil API.

Setelah backend berhasil di-deploy di Vercel, kamu akan mendapat URL seperti:
```
https://kirodico-backend.vercel.app
```

Set `VITE_API_URL` ke URL tersebut (tanpa trailing slash):
```
https://kirodico-backend.vercel.app
```

> Kalau kedua service di-deploy dalam satu Vercel project dengan `vercel.json` yang sudah dikonfigurasi rewrite `/api/*`, kamu bisa set:
> ```
> VITE_API_URL=https://kirodico.vercel.app
> ```
> (pakai domain utama project karena rewrite sudah mengarahkan `/api/*` ke backend)

---

## Urutan Deploy yang Disarankan

1. **Siapkan database** — Buat project di Neon/Supabase, copy `DATABASE_URL`
2. **Generate `JWT_SECRET`** — Jalankan perintah node di atas
3. **Tentukan admin credential** — Set `ADMIN_EMAIL`, `ADMIN_USERNAME_SEED`, `ADMIN_PASSWORD_SEED`
4. **Deploy backend dulu** — Tambahkan semua env var backend, deploy, pastikan `/api/health` atau `/api/posts` bisa diakses
5. **Jalankan migrasi + seed database** — Di Vercel dashboard atau via CLI:
   ```bash
   vercel env pull .env.production
   npx prisma migrate deploy
   npx prisma db seed
   ```
   Atau gunakan Vercel Build Command: tambahkan `npx prisma migrate deploy && node dist/server.js` di build settings
6. **Deploy frontend** — Set `VITE_API_URL` ke URL backend yang sudah jadi, lalu deploy

---

## Checklist Environment Variables

| Variable | Service | Wajib | Nilai Contoh |
|---|---|---|---|
| `DATABASE_URL` | Backend | ✅ | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | Backend | ✅ | *(random 64-byte hex)* |
| `JWT_EXPIRES_IN` | Backend | ✅ | `24h` |
| `JWT_USER_EXPIRES_IN` | Backend | ✅ | `7d` |
| `NODE_ENV` | Backend | ✅ | `production` |
| `PORT` | Backend | ❌ | `3001` |
| `ADMIN_EMAIL` | Backend | ❌** | `kamu@gmail.com` |
| `ADMIN_USERNAME_SEED` | Backend | ❌** | `admin` |
| `ADMIN_PASSWORD_SEED` | Backend | ⚠️ | *(password kuat)* |
| `RESEND_API_KEY` | Backend | ❌* | `re_xxxxxxxxxxxx` |
| `RESEND_FROM_EMAIL` | Backend | ❌* | `noreply@yourdomain.com` |
| `VITE_API_URL` | Frontend | ✅ | `https://kirodico.vercel.app` |

*❌ = opsional, tapi fitur email tidak akan berfungsi tanpanya.

**❌ = opsional secara teknis (ada default), tapi **sangat disarankan diset** agar password admin bukan nilai default yang mudah ditebak.

---

## Catatan Tambahan

- **Jangan commit file `.env`** ke git. File `.gitignore` sudah mengecualikannya.
- Setiap kali mengubah environment variable di Vercel, kamu perlu **redeploy** agar perubahan berlaku.
- Untuk melihat log backend setelah deploy: Vercel Dashboard → Project → Functions → pilih function → Logs.
