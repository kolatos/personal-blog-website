# Requirements Document

## Introduction

Stage 2 menambahkan empat seksi publik baru: About, Projects, Fun, dan Landing Page. Setiap seksi dikelola melalui CMS oleh Admin via dashboard. Sistem komentar generik dari Stage 1 digunakan kembali pada Projects dan Fun. Rute blog berpindah dari `/` ke `/blog` untuk memberi ruang bagi Landing Page. Slug generation diekstrak ke utilitas bersama yang dapat digunakan oleh semua content type. Prerequisites: Stage 1 harus selesai — sistem komentar generik, MarkdownRenderer, shadcn/ui, dan infrastruktur tag sudah tersedia.

## Glossary

- **AboutSection**: Record CMS yang mewakili satu seksi pada halaman About; memiliki type (education/experience/skill/contact), title, subtitle, description, startDate, endDate, order, dan metadata JSON
- **Project**: Entry portofolio CMS yang dikelola Admin; memiliki title, slug, description (Markdown), status draft/published, repoUrl, demoUrl, coverImageUrl, order, dan techTags
- **FunPost**: Entry konten bebas yang dikelola Admin; memiliki title, slug, content (Markdown), type (text/review/image/drawing/music/interactive), mediaUrl, status, dan tags
- **ProjectTag**: Join table yang menghubungkan Project dengan Tag (many-to-many); berbagi model Tag yang sama dengan PostTag
- **FunTag**: Join table yang menghubungkan FunPost dengan Tag (many-to-many)
- **LandingPage**: Halaman utama di `/` yang menampilkan teaser dari semua seksi website
- **BlogPage**: Halaman daftar blog yang sebelumnya berada di `/`, dipindahkan ke `/blog`
- **SlugUtils**: Utilitas bersama `backend/src/lib/slugUtils.ts` untuk generasi slug unik yang dapat digunakan oleh semua service (post, project, fun)
- **TimelineSection**: Komponen frontend yang merender seksi education/experience sebagai timeline vertikal
- **SkillsGrid**: Komponen frontend yang merender seksi skill sebagai grid chip/badge
- **ContactList**: Komponen frontend yang merender seksi contact sebagai daftar link berikon
- **FeedFilter**: Komponen frontend yang menyediakan filter type dan tag untuk halaman Fun

---

## Requirements

### Requirement 1: Migrasi Rute Blog

**User Story:** Sebagai Developer, saya ingin rute blog berpindah dari `/` ke `/blog`, sehingga halaman utama dapat digunakan untuk Landing Page.

#### Acceptance Criteria

1. THE System SHALL memindahkan halaman daftar blog dari rute `/` ke `/blog`; komponen `HomePage` SHALL diganti namanya menjadi `BlogPage`.
2. THE System SHALL memperbarui semua tautan internal yang merujuk ke `/` sebagai daftar blog: tautan "Blog" di Navbar, tautan "kembali ke blog" di PostDetailPage, dan redirect setelah login untuk role user.
3. THE rute `/` SHALL melayani komponen `LandingPage` yang baru.
4. THE System SHALL memastikan tidak ada fungsionalitas blog yang rusak akibat migrasi rute — rute `/blog`, `/posts/:slug`, dan `/search` tetap berfungsi normal.

---

### Requirement 2: Halaman About

**User Story:** Sebagai Admin, saya ingin mengelola konten halaman About melalui dashboard, sehingga saya dapat memperbarui informasi pribadi tanpa mengubah kode.

#### Acceptance Criteria

1. THE System SHALL mendukung model CMS AboutSection dengan field: `id` (uuid), `type` (enum: `education | experience | skill | contact`), `title` (varchar 200), `subtitle` (varchar 200, opsional), `description` (text, opsional), `startDate` (date, opsional), `endDate` (date, opsional — null berarti "sekarang"), `order` (integer), `metadata` (JSON, opsional).
2. THE endpoint `GET /api/about` (publik) SHALL mengembalikan semua seksi diurutkan berdasarkan type lalu order secara ascending.
3. THE endpoint `POST /api/about` (hanya admin) SHALL membuat seksi baru; type yang tidak valid SHALL mengembalikan 400.
4. THE endpoint `PUT /api/about/:id` (hanya admin) SHALL memperbarui seksi; id tidak ditemukan mengembalikan 404.
5. THE endpoint `DELETE /api/about/:id` (hanya admin) SHALL menghapus seksi; id tidak ditemukan mengembalikan 404.
6. THE endpoint `PATCH /api/about/reorder` (hanya admin) SHALL menerima `[{ id, order }]` dan memperbarui field order secara batch dalam satu transaksi Prisma.
7. THE halaman publik AboutPage di `/about` SHALL merender seksi yang dikelompokkan berdasarkan type: `education` dan `experience` sebagai TimelineSection (kronologis, terbaru di atas), `skill` sebagai SkillsGrid, `contact` sebagai ContactList.
8. THE halaman admin AboutAdminPage di `/admin/about` SHALL menampilkan daftar seksi dengan aksi edit dan hapus, mendukung drag-to-reorder per grup type menggunakan `@dnd-kit/sortable`, dan tombol "Add Section" yang membuka shadcn Dialog.
9. THE tautan `/about` SHALL ditambahkan ke Navbar. THE tautan `/admin/about` SHALL ditambahkan ke navigasi admin.

---

### Requirement 3: Seksi Projects

**User Story:** Sebagai Admin, saya ingin mengelola portofolio proyek melalui dashboard, sehingga pengunjung dapat melihat karya-karya saya.

#### Acceptance Criteria

1. THE System SHALL mendukung model CMS Project dengan field: `id` (uuid), `title` (varchar 200), `slug` (unik, auto-generated), `description` (text, Markdown), `status` (`draft | published`), `repoUrl` (varchar, opsional), `demoUrl` (varchar, opsional), `coverImageUrl` (varchar, opsional), `order` (integer), `techTags` (many-to-many via ProjectTag), `createdAt`, `updatedAt`.
2. THE generasi slug SHALL mengikuti pola `slugify` + suffix numerik yang sama seperti blog post. Slug SHALL di-regenerasi ketika title berubah.
3. THE endpoint `GET /api/projects` (publik, dipaginasi) SHALL mengembalikan hanya project berstatus published diurutkan berdasarkan `order ASC` lalu `createdAt DESC`. Draft project SHALL mengembalikan 404 kepada pengunjung.
4. THE endpoint `GET /api/projects/:slug` (publik) SHALL mengembalikan satu project berstatus published. Draft mengembalikan 404.
5. THE endpoint `POST /api/projects`, `PUT /api/projects/:id`, `DELETE /api/projects/:id` (hanya admin) SHALL menyediakan CRUD lengkap.
6. THE endpoint `POST /api/projects/:id/publish` dan `POST /api/projects/:id/unpublish` (hanya admin) SHALL mengikuti state machine yang sama seperti blog post; transisi duplikat SHALL mengembalikan 409.
7. THE techTags SHALL mengikuti pola upsert-by-name yang sama seperti blog post tags; ProjectTag berbagi model Tag yang sama.
8. THE komentar pada project SHALL menggunakan sistem komentar generik dengan `contentType: 'project'` dan `contentId: project.id`.
9. THE halaman publik ProjectsPage di `/projects` SHALL menampilkan grid responsif kartu project, masing-masing menampilkan cover image, title, tech tag chips, dan tombol repo/demo.
10. THE halaman ProjectDetailPage di `/projects/:slug` SHALL merender deskripsi lengkap via MarkdownRenderer, tech stack chips, link repo/demo, dan seksi komentar.
11. THE halaman admin ProjectsAdminPage di `/admin/projects` SHALL menampilkan tabel semua project (draft + published) dengan aksi publish/unpublish/edit/delete.
12. THE halaman admin ProjectEditorPage di `/admin/projects/new` dan `/admin/projects/:id/edit` SHALL menyediakan form dengan field: title, description (Markdown editor + live preview via MarkdownRenderer), cover image URL, repo URL, demo URL, tech tag input, dan order.
13. THE tautan `/projects` SHALL ditambahkan ke Navbar. THE tautan `/admin/projects` SHALL ditambahkan ke navigasi admin.

---

### Requirement 4: Seksi Fun

**User Story:** Sebagai Admin, saya ingin berbagi konten beragam (ulasan, gambar, musik, dll.) melalui feed terpadu, sehingga pengunjung dapat menjelajahi semua hal yang ingin saya bagikan di satu tempat.

#### Acceptance Criteria

1. THE System SHALL mendukung model CMS FunPost dengan field: `id` (uuid), `title` (varchar 200), `slug` (unik, auto-generated), `excerpt` (varchar 500, opsional), `content` (text, Markdown), `status` (`draft | published`), `type` (enum: `text | review | image | drawing | music | interactive`), `mediaUrl` (varchar, opsional), `tags` (many-to-many via FunTag), `createdAt`, `updatedAt`.
2. THE endpoint `GET /api/fun` (publik, dipaginasi) SHALL mengembalikan fun post berstatus published diurutkan berdasarkan `publishedAt DESC`. Mendukung query param opsional: `type` (satu nilai enum) dan `tag` (slug tag). Kedua filter dapat dikombinasikan (AND).
3. THE endpoint `GET /api/fun/:slug` (publik) SHALL mengembalikan satu fun post berstatus published. Draft mengembalikan 404.
4. THE endpoint `POST /api/fun`, `PUT /api/fun/:id`, `DELETE /api/fun/:id` (hanya admin) SHALL menyediakan CRUD lengkap.
5. THE endpoint `POST /api/fun/:id/publish` dan `POST /api/fun/:id/unpublish` (hanya admin) SHALL mengikuti state machine yang sama seperti blog post; update pada post published SHALL otomatis revert ke draft.
6. THE tags pada fun post SHALL mengikuti pola upsert-by-name. FunTag menggunakan model Tag yang sama (namespace tag terpadu).
7. THE komentar pada fun post SHALL menggunakan sistem komentar generik dengan `contentType: 'fun'` dan `contentId: funPost.id`.
8. THE halaman publik FunPage di `/fun` SHALL menampilkan feed kartu fun post dengan filter chips di atas menggunakan shadcn ToggleGroup untuk filter type dan tag chips untuk filter tag. Memilih filter memperbarui feed tanpa reload halaman penuh.
9. THE setiap kartu fun post SHALL dirender sesuai typenya: `image`/`drawing` → cover image ditampilkan secara menonjol; `music` → mediaUrl ditampilkan sebagai link; `text`/`review`/`interactive` → title dan excerpt.
10. THE halaman FunDetailPage di `/fun/:slug` SHALL merender konten lengkap via MarkdownRenderer, media opsional, dan seksi komentar.
11. THE halaman admin FunAdminPage di `/admin/fun` SHALL menampilkan tabel dengan badge type, badge status, dan aksi edit/delete/publish.
12. THE halaman admin FunEditorPage di `/admin/fun/new` dan `/admin/fun/:id/edit` SHALL menyediakan form dengan field: type selector, title, content (Markdown editor + live preview), media URL, dan tag input.
13. THE tautan `/fun` SHALL ditambahkan ke Navbar. THE tautan `/admin/fun` SHALL ditambahkan ke navigasi admin.

---

### Requirement 5: Landing Page

**User Story:** Sebagai Pengunjung, saya ingin melihat halaman utama yang menarik yang menampilkan semua seksi website, sehingga saya dapat memahami apa yang ditawarkan website ini sebelum menjelajahi lebih lanjut.

#### Acceptance Criteria

1. THE komponen LandingPage SHALL dibuat dan dilayani di rute `/`.
2. THE landing page SHALL menyertakan seksi-seksi berikut yang masing-masing mengambil data live dari API: Hero (statis — nama, tagline, tombol CTA ke `/blog` dan `/about`), About teaser (`GET /api/about`, maksimal 3 seksi bertipe `experience` atau `skill`), Recent posts (`GET /api/posts`, 3 post terbaru), Featured projects (`GET /api/projects`, 3 project pertama), Fun highlights (`GET /api/fun`, 3 fun post terbaru), Learning CTA (statis — deskripsi dan indikator "Coming soon").
3. IF sebuah seksi tidak memiliki data (respons API kosong), THEN seksi tersebut SHALL disembunyikan seluruhnya — tidak menampilkan kotak kosong.
4. THE Navbar SHALL diperbarui dengan tautan ke semua seksi yang sudah ada: Landing (logo/brand), Blog, About, Projects, Fun. Tautan Learning SHALL hadir tetapi ditandai secara visual sebagai "coming soon" dan tidak dapat dinavigasi.
5. THE landing page SHALL menggunakan shadcn Card untuk teaser seksi dan SHALL responsif di viewport mobile, tablet, dan desktop.
6. THE endpoint `GET /api/admin/stats` SHALL diperbarui untuk menyertakan counter `totalFunPosts` dan `totalProjects`.

---

### Requirement 6: Pembaruan Dashboard Admin (Stage 2)

**User Story:** Sebagai Admin, saya ingin dashboard menampilkan statistik untuk semua seksi baru, sehingga saya dapat memantau seluruh aktivitas website dari satu tempat.

#### Acceptance Criteria

1. THE navigasi sidebar dashboard admin SHALL menyertakan tautan ke semua halaman admin baru: About, Projects, Fun.
2. THE kartu statistik di DashboardPage SHALL diperbarui untuk menampilkan `totalProjects` dan `totalFunPosts` bersama counter yang sudah ada.
3. THE endpoint `GET /api/admin/stats` SHALL mengembalikan `totalProjects` dan `totalFunPosts` dalam responsnya.

### Requirement 7: Tombol Kembali (Back Button)

**User Story:** Sebagai Pengguna, saya ingin tombol kembali yang jelas di setiap subhalaman Stage 2, sehingga saya dapat dengan mudah kembali ke halaman listing yang relevan.

#### Acceptance Criteria

1. THE `PostDetailPage` SHALL memperbarui tombol kembalinya dari Requirement 9 Stage 1 untuk menuju ke `/blog` setelah migrasi rute di Task 13.
2. THE `ProjectDetailPage` di `/projects/:slug` SHALL menampilkan tombol "← Kembali ke Projects" di bagian atas konten yang menavigasi ke `/projects`.
3. THE `FunDetailPage` di `/fun/:slug` SHALL menampilkan tombol "← Kembali ke Fun" di bagian atas konten yang menavigasi ke `/fun`.
4. THE `AboutPage` di `/about` SHALL menampilkan tombol "← Kembali" di bagian atas yang menavigasi ke `/` (Landing Page).
5. THE subhalaman admin baru SHALL menampilkan tombol "? Kembali ke Dashboard" atau "? Kembali ke [section]" yang relevan, mencakup: AboutAdminPage (`/admin`), ProjectEditorPage (`/admin/projects`), FunEditorPage (`/admin/fun`).
6. THE tombol kembali SHALL menggunakan shadcn `Button` dengan variant `ghost` dan ikon panah kiri (←), konsisten dengan konvensi yang ditetapkan di Stage 1 Requirement 9.
