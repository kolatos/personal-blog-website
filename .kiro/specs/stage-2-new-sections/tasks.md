# Implementation Plan

## Overview

7 task: migrasi rute blog (Task 13), backend About (Task 14), frontend About publik + admin (Task 15), backend Projects (Task 16), frontend Projects publik + admin (Task 17), seksi Fun backend + frontend terpadu (Task 18), dan Landing Page + pembaruan dashboard admin (Task 19).

Task dinomori melanjutkan dari Stage 1 (yang berakhir di Task 12) untuk keterlacakan antar stage.

**Prerequisites**: Semua task Stage 1 selesai. Sistem komentar generik, MarkdownRenderer, shadcn/ui, dan infrastruktur tag sudah tersedia.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["13", "14", "16", "18"] },
    { "id": 1, "tasks": ["15", "17"] },
    { "id": 2, "tasks": ["19"] }
  ]
}
```

## Tasks

- [ ] 13. Migrasi rute blog
  - Rename `frontend/src/pages/public/HomePage.tsx` menjadi `BlogPage.tsx`; perbarui nama komponen di dalamnya
  - Update `App.tsx`: ubah rute `/` dari `<BlogPage>` menjadi `<LandingPage>` (buat stub `LandingPage.tsx` yang mereturn `<div>Landing — coming soon</div>` untuk sekarang); tambahkan rute `/blog` → `<BlogPage>`
  - Update `Navbar`: ubah tautan "Beranda" / "Blog" untuk menunjuk ke `/blog`
  - Update tautan "← Kembali ke Beranda" di `PostDetailPage`: ubah href dari `/` menjadi `/blog`
  - Update redirect setelah login untuk `role === 'user'` di `AuthContext`: redirect ke `/blog`
  - Component test: `Navbar` merender tautan "Blog" dengan href `/blog`
  - Verifikasi tes `PostDetailPage` yang ada lulus tanpa modifikasi (routing berbasis slug tidak berubah)
  - **Files:** `frontend/src/pages/public/BlogPage.tsx` (renamed dari `HomePage.tsx`), `frontend/src/App.tsx`, `frontend/src/components/layout/Navbar.tsx`, `frontend/src/pages/public/PostDetailPage.tsx`, `frontend/src/contexts/AuthContext.tsx`
  - **Requires:** (none)

- [ ] 14. Halaman About — backend
  - Tambahkan model `AboutSection` ke `backend/prisma/schema.prisma` sesuai definisi di design document
  - Jalankan `npx prisma migrate dev --name add_about_sections`; jalankan `npx prisma generate`
  - Buat `schemas/about.schema.ts` — Zod schema: type harus salah satu dari `['education','experience','skill','contact']`; title wajib; reorder schema memvalidasi array `{ id, order }`
  - Buat `services/about.service.ts`:
    - `getAllSections()` — diurutkan berdasarkan type lalu order
    - `createSection(data)` — validasi type; buat record
    - `updateSection(id, data)` — 404 jika tidak ditemukan
    - `deleteSection(id)` — 404 jika tidak ditemukan
    - `reorderSections(items: { id, order }[])` — batch update dalam transaksi Prisma
  - Buat `controllers/about.controller.ts` dan `routes/about.routes.ts` di-mount di `/api/about`:
    - `GET /` — publik
    - `POST /` — hanya admin + validateBody
    - `PUT /:id` — hanya admin + validateBody
    - `DELETE /:id` — hanya admin
    - `PATCH /reorder` — hanya admin + validateBody
  - Mount `/api/about` di `app.ts`
  - Integration test: `POST /api/about` dengan type tidak valid → 400
  - Integration test: buat seksi → `GET /api/about` mengembalikannya dengan urutan yang benar
  - Integration test: `PATCH /api/about/reorder` memperbarui order; GET mengembalikan urutan baru
  - Integration test: endpoint hanya-admin mengembalikan 403 untuk token non-admin
  - **Files:** `backend/prisma/schema.prisma`, `backend/src/schemas/about.schema.ts`, `backend/src/services/about.service.ts`, `backend/src/controllers/about.controller.ts`, `backend/src/routes/about.routes.ts`, `backend/src/app.ts`
  - **Requires:** (none)

- [ ] 15. Halaman About — frontend (publik + admin)
  - Instal `@dnd-kit/core` dan `@dnd-kit/sortable` di `frontend/` (`npm install @dnd-kit/core @dnd-kit/sortable`)
  - Tambahkan tipe `AboutSection` ke `frontend/src/types/index.ts`
  - Buat `api/about.ts` dengan fungsi `getAboutSections()`, `createSection()`, `updateSection()`, `deleteSection()`, `reorderSections()`
  - Buat `hooks/useAbout.ts` menggunakan React Query
  - **AboutPage publik** di `pages/public/AboutPage.tsx`:
    - Fetch semua seksi via `useAbout`; kelompokkan berdasarkan type menggunakan `Array.reduce`
    - Render `education` + `experience` via `components/about/TimelineSection.tsx`: timeline vertikal dengan garis konektor, setiap entry dalam shadcn Card, tampilkan title/subtitle/startDate–endDate (atau "Present" jika `endDate` null)/description, diurutkan startDate DESC
    - Render `skill` via `components/about/SkillsGrid.tsx`: wrapping flex grid dari shadcn Badge chips
    - Render `contact` via `components/about/ContactList.tsx`: daftar icon + link (gunakan `metadata.url` sebagai href); ikon menggunakan inline SVG saja
  - **AboutAdminPage admin** di `pages/admin/AboutAdminPage.tsx`:
    - Fetch semua seksi; kelompokkan berdasarkan type ke tabs menggunakan shadcn Tabs
    - Di setiap tab: draggable list menggunakan `@dnd-kit/sortable`; setiap baris menampilkan title, subtitle, tombol edit/delete
    - Tombol "Add Section" → shadcn Dialog dengan form (type selector, title, subtitle, description, tanggal)
    - Tombol "Edit" → Dialog yang sama dengan data pre-filled
    - Pada drag end: panggil `reorderSections()` dengan array order baru
    - Delete menggunakan shadcn AlertDialog untuk konfirmasi
  - Tambahkan rute `/about` ke `App.tsx`; tambahkan rute `/admin/about` (protected admin)
  - Update `Navbar` dengan tautan `/about`; update navigasi sidebar admin dengan tautan `/admin/about`
  - Component test: `TimelineSection` merender entry diurutkan terbaru di atas
  - Component test: `SkillsGrid` merender satu Badge per skill
  - Component test: `AboutAdminPage` — "Add Section" membuka dialog; delete menampilkan AlertDialog
  - **Files:** `frontend/src/types/index.ts`, `frontend/src/api/about.ts`, `frontend/src/hooks/useAbout.ts`, `frontend/src/components/about/TimelineSection.tsx`, `frontend/src/components/about/SkillsGrid.tsx`, `frontend/src/components/about/ContactList.tsx`, `frontend/src/pages/public/AboutPage.tsx`, `frontend/src/pages/admin/AboutAdminPage.tsx`, `frontend/src/App.tsx`, `frontend/src/components/layout/Navbar.tsx`
  - **Requires:** 14

- [ ] 16. Projects — backend
  - Tambahkan model `Project` dan `ProjectTag` ke `backend/prisma/schema.prisma`; tambahkan juga field back-relation `ProjectTag` ke model `Tag` yang ada
  - Jalankan `npx prisma migrate dev --name add_projects`; jalankan `npx prisma generate`
  - Ekstrak `generateUniqueSlug` dari `post.service.ts` ke `backend/src/lib/slugUtils.ts` dengan signature yang menerima Prisma query callback; perbarui `post.service.ts` untuk mengimpor dari sana
  - Buat `schemas/project.schema.ts` — title wajib, URL opsional dengan format URL valid
  - Buat `services/project.service.ts`:
    - `generateUniqueSlug` via slugUtils
    - `createProject(data)` — generasi slug, upsert tag, status default `draft`
    - `updateProject(id, data)` — regenerasi slug jika title berubah; jika status `published`, revert ke `draft`
    - `deleteProject(id)` — 404 jika tidak ditemukan
    - `publishProject(id)` / `unpublishProject(id)` — logika 409 duplikat transisi yang sama
    - `getPublishedProjects(page)` — hanya published, diurutkan `order ASC, createdAt DESC`
    - `getProjectBySlug(slug)` — hanya published; 404 untuk draft
    - `getAllProjects(page)` — admin, semua status, 20/halaman
  - Buat `controllers/project.controller.ts` dan `routes/project.routes.ts` di-mount di `/api/projects`
  - Update `GET /api/admin/stats` untuk menyertakan `totalProjects`
  - Mount `/api/projects` di `app.ts`
  - Integration test: create → publish → `GET /api/projects` mengembalikannya; `GET /api/projects/:slug` mengembalikan detail
  - Integration test: draft project → `GET /api/projects/:slug` → 404 untuk unauthenticated
  - Integration test: update project published → auto-revert ke draft
  - Integration test: duplicate publish → 409
  - Integration test: komentar project via `POST /api/comments` dengan `contentType: 'project'` → 201
  - **Files:** `backend/prisma/schema.prisma`, `backend/src/lib/slugUtils.ts`, `backend/src/schemas/project.schema.ts`, `backend/src/services/project.service.ts`, `backend/src/controllers/project.controller.ts`, `backend/src/routes/project.routes.ts`, `backend/src/app.ts`, `backend/src/services/post.service.ts`
  - **Requires:** (none)

- [ ] 17. Projects — frontend (publik + admin)
  - Tambahkan tipe `Project` ke `frontend/src/types/index.ts` (menyertakan `techTags`, `repoUrl`, `demoUrl`, `coverImageUrl`, `order`)
  - Buat `api/projects.ts` dengan fungsi API yang sudah di-type
  - Buat `hooks/useProjects.ts` menggunakan React Query
  - **`ProjectCard`** di `components/projects/ProjectCard.tsx`: shadcn Card dengan cover image (atau placeholder jika tidak ada), title, excerpt deskripsi, tech tag chips (`TagChip`), tombol link repo/demo
  - **`ProjectsPage`** di `pages/public/ProjectsPage.tsx`: grid responsif (1 kolom mobile, 2 kolom tablet, 3 kolom desktop), `useProjects` dengan pagination, shadcn Skeleton selama loading
  - **`ProjectDetailPage`** di `pages/public/ProjectDetailPage.tsx`: deskripsi lengkap via `MarkdownRenderer`, tech stack chips, link repo/demo, cover image, seksi komentar: `CommentList` + `CommentForm` dengan `contentType="project"` dan `contentId={project.id}`
  - **`ProjectsAdminPage`** di `pages/admin/ProjectsAdminPage.tsx`: shadcn Table semua project (endpoint admin); kolom: title, status Badge, order, tanggal update, aksi; publish/unpublish/edit/delete dengan shadcn AlertDialog pada delete; tombol "New Project" navigasi ke editor
  - **`ProjectEditorPage`** di `pages/admin/ProjectEditorPage.tsx`: form dengan title, description (split-pane: Markdown textarea + MarkdownRenderer preview), cover image URL, repo URL, demo URL, order, tech tag `TagInput`; menangani create (`/admin/projects/new`) dan edit (`/admin/projects/:id/edit`) via URL param; validasi React Hook Form + Zod
  - Tambahkan semua rute ke `App.tsx`: `/projects`, `/projects/:slug`, `/admin/projects`, `/admin/projects/new`, `/admin/projects/:id/edit`
  - Update `Navbar` dengan tautan `/projects`; update navigasi admin
  - Component test: `ProjectCard` merender title, tech tags, dan link
  - Component test: `ProjectDetailPage` merender seksi komentar dengan `contentType="project"` yang benar
  - Component test: `ProjectsAdminPage` — aksi publish memanggil API dengan id yang benar
  - **Files:** `frontend/src/types/index.ts`, `frontend/src/api/projects.ts`, `frontend/src/hooks/useProjects.ts`, `frontend/src/components/projects/ProjectCard.tsx`, `frontend/src/components/projects/ProjectList.tsx`, `frontend/src/pages/public/ProjectsPage.tsx`, `frontend/src/pages/public/ProjectDetailPage.tsx`, `frontend/src/pages/admin/ProjectsAdminPage.tsx`, `frontend/src/pages/admin/ProjectEditorPage.tsx`, `frontend/src/App.tsx`, `frontend/src/components/layout/Navbar.tsx`
  - **Requires:** 16

- [ ] 18. Seksi Fun — backend + frontend
  - **Backend**:
    - Tambahkan model `FunPost` dan `FunTag` ke `backend/prisma/schema.prisma`; tambahkan juga field back-relation `FunTag` ke model `Tag` yang ada
    - Jalankan `npx prisma migrate dev --name add_fun_posts`; jalankan `npx prisma generate`
    - Buat `schemas/fun.schema.ts` — type harus salah satu dari 6 nilai valid
    - Buat `services/fun.service.ts`: pola CRUD + publish/unpublish + slug yang sama seperti `project.service.ts` menggunakan `slugUtils`; `getFunPosts(page, type?, tag?)` memfilter berdasarkan keduanya; excerpt di-generate otomatis sebagai `content.slice(0, 500)` jika tidak disediakan
    - Buat `controllers/fun.controller.ts` dan `routes/fun.routes.ts` di-mount di `/api/fun`
    - Update `GET /api/admin/stats` untuk menyertakan `totalFunPosts`
    - Mount `/api/fun` di `app.ts`
    - Integration test: buat fun post dengan type `review` dan tag `books`; `GET /api/fun?type=review&tag=books` mengembalikannya; `GET /api/fun?type=image` mengembalikan 0 hasil
    - Integration test: filter kombinasi type + tag bekerja dengan benar (AND condition)
    - Integration test: komentar dengan `contentType: 'fun'` → 201
    - Integration test: draft fun post → 404 untuk GET publik
  - **Frontend**:
    - Tambahkan tipe `FunPost` ke `frontend/src/types/index.ts`
    - Buat `api/fun.ts` dan `hooks/useFun.ts`
    - **`FunCard`** di `components/fun/FunCard.tsx`: rendering sesuai type — `image`/`drawing`: cover image besar via `mediaUrl`, title di bawah; `music`: title + mediaUrl sebagai link; `text`/`review`/`interactive`: title + excerpt
    - **`FeedFilter`** di `components/fun/FeedFilter.tsx`: shadcn ToggleGroup untuk filter type; tag chips di bawah; filter yang dipilih ditampilkan sebagai aktif
    - **`FunPage`** di `pages/public/FunPage.tsx`: `FeedFilter` di atas, feed `FunCard` di bawah; state filter → query params ke `useFun`; shadcn Skeleton selama loading
    - **`FunDetailPage`** di `pages/public/FunDetailPage.tsx`: konten lengkap via `MarkdownRenderer`, tampilan media jika `mediaUrl` tersedia, seksi komentar (`contentType="fun"`)
    - **`FunAdminPage`** di `pages/admin/FunAdminPage.tsx`: shadcn Table dengan type Badge, status Badge, aksi edit/delete/publish
    - **`FunEditorPage`** di `pages/admin/FunEditorPage.tsx`: type selector, title, editor konten + preview, media URL, tag input
    - Tambahkan rute: `/fun`, `/fun/:slug`, `/admin/fun`, `/admin/fun/new`, `/admin/fun/:id/edit`
    - Update `Navbar` dengan tautan `/fun`; update navigasi admin
    - Component test: `FunCard` merender cover image secara menonjol untuk type `image`; menampilkan excerpt untuk type `text`
    - Component test: `FeedFilter` — memilih filter type memperbarui active state; memilih tag filter menambahkan chip aktif
    - Component test: `FunDetailPage` merender seksi komentar dengan `contentType="fun"` yang benar
  - **Files:** `backend/prisma/schema.prisma`, `backend/src/schemas/fun.schema.ts`, `backend/src/services/fun.service.ts`, `backend/src/controllers/fun.controller.ts`, `backend/src/routes/fun.routes.ts`, `frontend/src/types/index.ts`, `frontend/src/api/fun.ts`, `frontend/src/hooks/useFun.ts`, `frontend/src/components/fun/FunCard.tsx`, `frontend/src/components/fun/FunFeed.tsx`, `frontend/src/components/fun/FeedFilter.tsx`, `frontend/src/pages/public/FunPage.tsx`, `frontend/src/pages/public/FunDetailPage.tsx`, `frontend/src/pages/admin/FunAdminPage.tsx`, `frontend/src/pages/admin/FunEditorPage.tsx`, `frontend/src/App.tsx`, `frontend/src/components/layout/Navbar.tsx`
  - **Requires:** (none)

- [ ] 19. Landing page + pembaruan dashboard admin
  - Ganti stub `LandingPage.tsx` dari Task 13 dengan implementasi penuh:
    - **Seksi Hero** (statis): nama/brand, tagline, dua tombol CTA shadcn `Button` menuju `/blog` dan `/about`
    - **About teaser**: hook `useAbout`, render 3 pertama bertipe `experience` atau `skill` dalam layout horizontal kompak menggunakan shadcn Card
    - **Recent posts**: hook `usePosts` dengan `pageSize=3`; render 3 komponen `PostCard` dalam baris horizontal; tautan "Lihat semua →" ke `/blog`
    - **Featured projects**: hook `useProjects` dengan `pageSize=3`; render 3 komponen `ProjectCard`; tautan "Lihat semua →" ke `/projects`
    - **Fun highlights**: hook `useFun` dengan `pageSize=3`; render 3 komponen `FunCard`; tautan "Lihat semua →" ke `/fun`
    - **Learning CTA** (statis): shadcn Card dengan teks deskripsi + Badge "Coming soon"; tidak dapat dinavigasi
    - Setiap seksi: jika API mengembalikan array kosong, sembunyikan seksi seluruhnya (`return null` — tidak ada kotak kosong)
    - Semua fetch data berjalan paralel via React Query
  - **Finalisasi Navbar**: set tautan lengkap: Brand (`/`) → Blog (`/blog`) → About (`/about`) → Projects (`/projects`) → Fun (`/fun`) → Learning (disabled dengan Badge "Soon"); hamburger collapse untuk mobile via `useState(isOpen)` tanpa library tambahan
  - **Pembaruan dashboard admin**:
    - Tambahkan stat card `totalProjects` dan `totalFunPosts` ke `DashboardPage` menggunakan komponen `StatCard` yang sudah ada
    - Update sidebar/navigasi admin untuk menyertakan tautan ke semua halaman admin baru: About, Projects, Fun
  - Component test: `LandingPage` — setiap seksi merender dengan data mock; seksi dengan data kosong disembunyikan
  - Component test: `Navbar` merender semua tautan seksi dengan href yang benar; tautan Learning memiliki badge "Soon"
  - Integration test: `GET /api/admin/stats` mengembalikan `totalProjects` dan `totalFunPosts`
  - Component test: stat cards dashboard menyertakan hitungan Projects dan Fun
  - **Files:** `frontend/src/pages/public/LandingPage.tsx`, `frontend/src/components/layout/Navbar.tsx`, `frontend/src/pages/admin/DashboardPage.tsx`, `frontend/src/App.tsx`
  - **Requires:** 15, 17, 18


## Notes

- Task 13, 14, 16, dan 18 tidak memiliki dependensi dan dapat dikerjakan secara paralel dalam wave 0.
- Task 15 (About frontend) memerlukan Task 14 selesai terlebih dahulu.
- Task 17 (Projects frontend) memerlukan Task 16 selesai terlebih dahulu.
- Task 19 (Landing page) memerlukan Task 15, 17, dan 18 selesai sehingga semua komponen teaser tersedia.
- Migration harus dijalankan dalam urutan: `add_about_sections` → `add_projects` → `add_fun_posts`.
- Task 16 mengekstrak `generateUniqueSlug` ke `slugUtils.ts` dan memperbarui `post.service.ts` untuk mengimpor dari sana — pastikan tidak ada regresi pada fungsionalitas slug post yang ada.
- Task 18 juga menambahkan back-relation FunTag ke model `Tag` di `schema.prisma` (sama seperti Task 16 menambahkan back-relation ProjectTag).
- Stage 2 tidak memperkenalkan perubahan pada skema komentar — sistem komentar generik dari Stage 1 digunakan langsung via `contentType` dan `contentId`.
- `@dnd-kit/core` dan `@dnd-kit/sortable` hanya diinstal di `frontend/` — tidak ada dependensi backend baru.
