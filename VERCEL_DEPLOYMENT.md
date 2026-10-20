# Panduan Deploy ke Vercel

Dokumen ini menjelaskan semua environment variable yang dibutuhkan saat deploy ke Vercel dan cara mendapatkan nilainya.

---

## Struktur Deploy

Proyek ini di-deploy sebagai **dua Vercel project terpisah**:

| Project | Repo Subdirectory | Root Directory di Vercel |
|---|---|---|
| Backend | `backend/` | `backend` |
| Frontend | `frontend/` | `frontend` |

Keduanya menggunakan repo GitHub yang sama — bedanya hanya di pengaturan **Root Directory** di masing-masing Vercel project.

---

## Setup Awal: Buat Dua Vercel Project

### Project Backend
1. Buka [vercel.com/new](https://vercel.com/new) → import repo
2. Di **"Configure Project"**, set **Root Directory** = `backend`
3. Vercel akan otomatis detect Node.js
4. Tambahkan semua env var backend (lihat section di bawah)
5. Deploy → catat URL-nya (misal `https://nama-backend.vercel.app`)

### Project Frontend
1. Buka [vercel.com/new](https://vercel.com/new) → import repo yang sama
2. Set **Root Directory** = `frontend`
3. Vercel akan otomatis detect Vite
4. Tambahkan env var `VITE_API_URL` = URL backend dari langkah di atas
5. Deploy

---

## Environment Variables: Backend

Tambahkan di **Vercel → Project Backend → Settings → Environment Variables**.

### 1. `DATABASE_URL` ⚠️ Wajib

Koneksi string ke PostgreSQL. Proyek ini menggunakan **Neon**.

Cara mendapatkan:
1. Buka [neon.tech](https://neon.tech) → Login → pilih project
2. Klik **"Connection Details"** → pilih format **"Prisma"** di dropdown
3. Copy string yang muncul, bentuknya seperti:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```

> ⚠️ Pastikan mengandung `?sslmode=require` untuk koneksi ke Neon.

---

### 2. `JWT_SECRET` ⚠️ Wajib

Secret key untuk menandatangani JWT token. Harus panjang, acak, dan **tidak boleh dibagikan**.

Generate dengan perintah ini di terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

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

Harus `production` agar rate limiter aktif dan endpoint test di-disable.
```
production
```

---

### 6. `ADMIN_EMAIL` (untuk seed database)

Email akun admin yang dibuat saat `prisma db seed` dijalankan.
> Default jika tidak diset: `admin@blog.com`

---

### 7. `ADMIN_USERNAME_SEED` (untuk seed database)

Username akun admin.
> Default jika tidak diset: `admin`

---

### 8. `ADMIN_PASSWORD_SEED` ⚠️ Sangat Disarankan

Password akun admin. **Ganti dari default** — default `Admin1234!` mudah ditebak.

Pilih password kuat: minimal 12 karakter, kombinasi huruf besar/kecil, angka, simbol.

---

### 9. `RESEND_API_KEY` (opsional — fitur email subscription)

Untuk mengirim email ke subscriber saat post baru dipublish.

1. Buka [resend.com](https://resend.com) → Login → **API Keys** → **Create API Key**
2. Format: `re_xxxxxxxxxxxx`

> Jika tidak diset, fitur email akan no-op (tidak error, tapi email tidak terkirim).

---

### 10. `RESEND_FROM_EMAIL` (opsional — fitur email subscription)

Alamat email pengirim. Harus domain yang sudah diverifikasi di Resend.

> Sementara bisa pakai `onboarding@resend.dev` untuk testing (terbatas ke email sendiri).

---

## Environment Variables: Frontend

Tambahkan di **Vercel → Project Frontend → Settings → Environment Variables**.

### 1. `VITE_API_URL` ⚠️ Wajib

URL Vercel project backend, **tanpa trailing slash**.

```
https://nama-backend.vercel.app
```

URL ini didapat setelah project backend berhasil di-deploy.

---

## Urutan Deploy

1. **Siapkan database** — pastikan Neon project sudah ada, copy `DATABASE_URL`
2. **Generate `JWT_SECRET`** — jalankan perintah node di atas
3. **Deploy backend** — buat Vercel project untuk `backend/`, tambahkan semua env var, deploy
4. **Jalankan migrasi + seed** — setelah backend terdeploy, jalankan via CLI:
   ```bash
   # Dari direktori backend/
   npx prisma migrate deploy
   npx prisma db seed
   ```
   Atau via Vercel CLI:
   ```bash
   vercel env pull .env.production --cwd backend
   cd backend && npx prisma migrate deploy && npx prisma db seed
   ```
5. **Deploy frontend** — buat Vercel project untuk `frontend/`, set `VITE_API_URL` ke URL backend, deploy

---

## Checklist Environment Variables

| Variable | Project | Wajib | Nilai Contoh |
|---|---|---|---|
| `DATABASE_URL` | Backend | ✅ | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | Backend | ✅ | *(random 64-byte hex)* |
| `JWT_EXPIRES_IN` | Backend | ✅ | `24h` |
| `JWT_USER_EXPIRES_IN` | Backend | ✅ | `7d` |
| `NODE_ENV` | Backend | ✅ | `production` |
| `ADMIN_EMAIL` | Backend | ⚠️ | `kamu@gmail.com` |
| `ADMIN_USERNAME_SEED` | Backend | ⚠️ | `admin` |
| `ADMIN_PASSWORD_SEED` | Backend | ⚠️ | *(password kuat)* |
| `RESEND_API_KEY` | Backend | ❌ | `re_xxxxxxxxxxxx` |
| `RESEND_FROM_EMAIL` | Backend | ❌ | `noreply@yourdomain.com` |
| `VITE_API_URL` | Frontend | ✅ | `https://nama-backend.vercel.app` |

⚠️ = opsional secara teknis (ada default), tapi sangat disarankan diset di production.
❌ = opsional, fitur email tidak berfungsi tanpanya.

---

## Catatan Tambahan

- **Jangan commit file `.env`** ke git — sudah ada di `.gitignore`.
- Setiap ubah env var di Vercel → perlu **redeploy** agar berlaku.
- Log backend: Vercel Dashboard → Project Backend → **Logs** tab.
- Setiap push ke `main` akan trigger redeploy otomatis di kedua project.
