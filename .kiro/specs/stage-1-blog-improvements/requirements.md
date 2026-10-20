# Requirements Document

## Introduction

Stage 1 meningkatkan bagian blog yang sudah ada dan menstandarisasi antarmuka pengguna. Fitur ini menambahkan penandaan post, rendering KaTeX/LaTeX di sisi klien, dukungan gambar melalui URL eksternal di Markdown, memperbaiki komentar admin, memperkenalkan sistem komentar generik berulir (balasan 1 level, berlaku di semua jenis konten post/project/fun/module), menambahkan langganan email via Resend SDK, dan memigrasikan semua komponen UI ke shadcn/ui. Dashboard admin diperluas dengan statistik nyata dan halaman manajemen pengguna serta komentar. Stage ini meletakkan fondasi UI dan komentar yang akan digunakan kembali di Stage 2 dan Stage 3.

## Glossary

- **Tag**: Label yang dapat dikaitkan ke sebuah Post; memiliki `name` unik dan URL-safe `slug`
- **PostTag**: Join table yang menghubungkan Post dengan Tag (many-to-many)
- **Subscription**: Record yang menyatakan seorang Registered_User berlangganan notifikasi email post baru
- **MailService**: Wrapper di atas Resend SDK yang mengirim email notifikasi; no-op jika `RESEND_API_KEY` tidak ada
- **MarkdownRenderer**: Komponen React bersama yang merender Markdown beserta LaTeX menggunakan `react-markdown` + `remark-math` + `rehype-katex`
- **TagInput**: Komponen form admin untuk menambah/menghapus tag pada sebuah Post dengan autocomplete
- **TagChip**: Komponen display-only yang menampilkan sebuah tag sebagai Badge shadcn
- **ContentType**: Enum yang menentukan jenis konten yang dimiliki sebuah Comment — `post`, `project`, `fun`, atau `module`
- **GenericComment**: Comment yang tidak terikat pada satu jenis konten, melainkan dihubungkan via `contentType` + `contentId`
- **Reply**: Comment dengan `parentId` yang menunjuk ke Comment level teratas; kedalaman maksimal 1
- **StatCard**: Komponen Card shadcn yang menampilkan satu angka statistik di dashboard admin; dapat digunakan kembali di Stage 2 dan 3
- **shadcn_ui**: Koleksi komponen UI yang dibangun di atas Tailwind CSS dan CSS variables, di-generate ke `components/ui/`

---

## Requirements

### Requirement 1: Instalasi dan Migrasi shadcn/ui

**User Story:** Sebagai Developer, saya ingin semua komponen UI menggunakan shadcn_ui, sehingga tampilan dan perilaku komponen konsisten di seluruh aplikasi dan mudah di-maintain.

#### Acceptance Criteria

1. THE System SHALL menginisialisasi shadcn_ui via `npx shadcn@latest init` di direktori `frontend/`, dikonfigurasi untuk menggunakan CSS custom property theme yang sudah ada (`--primary`, `--border`, `--muted`, `--foreground`, `--background`, `--ring`, `--destructive`).
2. THE System SHALL menginstal komponen shadcn berikut: `button`, `input`, `textarea`, `badge`, `card`, `table`, `pagination`, `dialog`, `alert-dialog`, `popover`, `command`, `toggle-group`, `skeleton`, `separator`, `avatar`, `toast`, `tabs`.
3. THE System SHALL mengganti semua komponen UI hand-rolled (`Button.tsx`, `Input.tsx`, `Badge.tsx`, `Pagination.tsx`) dengan versi shadcn yang setara, dan memperbarui semua call site untuk menggunakan API baru.
4. THE admin PostTable SHALL dimigrasikan dari markup `<table>` mentah ke komponen shadcn Table.
5. THE StatusBadge SHALL dimigrasikan untuk menggunakan shadcn Badge.
6. THE textarea di PostEditor SHALL diganti dengan shadcn Textarea.
7. THE System SHALL mengganti semua pemanggilan `window.confirm()` di dashboard admin dengan shadcn AlertDialog.
8. THE tombol aksi di Navbar SHALL menggunakan shadcn Button (ghost variant).
9. WHEN migrasi selesai, THE System SHALL memastikan `npx vitest run` di `frontend/` lulus tanpa kegagalan dan `npm run build` tidak menghasilkan TypeScript error.

---

### Requirement 2: Tag Post

**User Story:** Sebagai Admin, saya ingin dapat menambahkan tag pada post, sehingga pembaca dapat menemukan konten berdasarkan topik.

#### Acceptance Criteria

1. THE System SHALL mendukung penandaan post. Sebuah Tag memiliki `name` unik dan URL-safe `slug`.
2. THE endpoint `POST /api/posts` dan `PUT /api/posts/:id` SHALL menerima field opsional `tags: string[]` yang berisi nama-nama tag. Tag yang belum ada SHALL di-upsert (dibuat jika belum ada).
3. THE respons dari `GET /api/posts`, `GET /api/posts/:slug`, dan `GET /api/posts/search` SHALL menyertakan array `tags` pada setiap objek post.
4. THE endpoint `GET /api/tags` (publik) SHALL mengembalikan semua tag yang ada, diurutkan secara alfabetis.
5. THE editor post admin SHALL menyertakan komponen TagInput: ketik nama lalu tekan Enter untuk menambah, klik `×` untuk menghapus, saran autocomplete dari `GET /api/tags` via shadcn Command + Popover.
6. THE PostCard dan PostDetailPage SHALL menampilkan tag post sebagai komponen TagChip (shadcn Badge variant).
7. THE System SHALL menormalkan nama tag ke huruf kecil saat disimpan.

---

### Requirement 3: Rendering KaTeX dan Gambar

**User Story:** Sebagai Pembaca, saya ingin persamaan matematika dalam post ditampilkan dengan benar, sehingga konten teknis mudah dipahami.

#### Acceptance Criteria

1. THE frontend SHALL merender sintaks math LaTeX dalam konten post: math inline dibatasi oleh `$...$` dan math display oleh `$$...$$`.
2. THE System SHALL merender LaTeX di sisi klien menggunakan KaTeX via plugin `remark-math` + `rehype-katex` pada `react-markdown`. KaTeX CSS SHALL diimpor di `main.tsx`.
3. THE System SHALL membuat komponen bersama MarkdownRenderer di `components/shared/MarkdownRenderer.tsx` yang membungkus `react-markdown` dengan plugin `remark-math` dan `rehype-katex` serta menerapkan prose Tailwind styles yang ada.
4. THE PostDetailPage SHALL menggunakan MarkdownRenderer untuk merender konten post, menggantikan pendekatan `dangerouslySetInnerHTML` yang ada.
5. THE panel live preview di PostEditor SHALL menggunakan MarkdownRenderer sehingga LaTeX dan gambar ditampilkan dengan benar selama pengeditan.
6. THE gambar yang direferensikan melalui URL eksternal dalam Markdown (misalnya `![alt](https://...)`) SHALL dirender dengan benar di MarkdownRenderer maupun di output HTML backend via `marked`.
7. THE rendering Markdown yang ada (heading, code block, blockquote, list, link, bold, italic) SHALL tidak terpengaruh oleh penambahan KaTeX.

---

### Requirement 4: Komentar Admin

**User Story:** Sebagai Admin, saya ingin dapat memberikan komentar pada post yang dipublikasikan, sehingga saya dapat berinteraksi dengan konten yang saya buat.

#### Acceptance Criteria

1. THE akun Admin SHALL dapat memposting komentar pada post yang dipublikasikan mana pun.
2. THE endpoint `POST /api/posts/:postId/comments` (atau endpoint generik baru) SHALL mengizinkan semua pengguna yang terotentikasi tanpa memandang role — baik `user` maupun `admin`.
3. THE CommentForm di PostDetailPage SHALL ditampilkan untuk pengguna terotentikasi mana pun (tidak hanya `role === 'user'`).
4. THE Admin SHALL dapat menghapus komentar mana pun via `DELETE /api/comments/:id`.

---

### Requirement 5: Sistem Komentar Generik dengan Balasan

**User Story:** Sebagai Registered_User atau Admin, saya ingin dapat membalas komentar orang lain, sehingga diskusi dapat berlangsung secara terstruktur.

#### Acceptance Criteria

1. THE model Comment SHALL diperluas dengan field `contentType` (enum: `post | project | fun | module`), `contentId` (UUID), dan `parentId` (nullable UUID self-relation).
2. THE System SHALL memigrasikan komentar post yang ada: data `postId` disalin ke `contentType = 'post'` dan `contentId = postId`, kemudian kolom `postId` dihapus.
3. THE endpoint generik berikut SHALL tersedia: `GET /api/comments?contentType=&contentId=` (mengembalikan komentar level atas dengan balasan bersarang), `POST /api/comments` (body: `{ contentType, contentId, content, parentId? }`), `DELETE /api/comments/:id`.
4. THE route lama `POST /api/posts/:postId/comments` SHALL dipertahankan sebagai alias backward-compatible selama Stage 1 dan dihapus tidak lebih awal dari Stage 2.
5. IF sebuah request `POST /api/comments` menyertakan `parentId` yang `parentId`-nya sendiri tidak null, THEN THE System SHALL menolak request tersebut dengan 400 `REPLY_DEPTH_EXCEEDED`.
6. THE CommentList SHALL merender komentar level atas dengan balasan yang diindentasi di bawah setiap parent.
7. WHEN tombol "Reply" pada komentar level atas diklik, THE System SHALL membuka CommentForm inline yang telah diisi dengan `@authorUsername` dan terikat ke komentar tersebut sebagai `parentId`.
8. THE tombol "Reply" SHALL muncul pada balasan. WHEN tombol "Reply" pada sebuah balasan diklik, THE System SHALL TIDAK membuka CommentForm baru yang lebih dalam, melainkan mengisi CommentForm level atas yang ada dengan `@authorUsername` dari penulis balasan tersebut, sehingga pengguna dapat membalas via mention tanpa nesting lebih dalam.
9. WHEN sebuah komentar parent dihapus, THEN semua balasannya SHALL dihapus secara cascade.

---

### Requirement 6: Langganan Email

**User Story:** Sebagai Registered_User, saya ingin berlangganan notifikasi post baru, sehingga saya tidak melewatkan konten terbaru.

#### Acceptance Criteria

1. THE Registered_User yang terotentikasi SHALL dapat berlangganan notifikasi post baru via `POST /api/subscriptions`. Mengembalikan 409 jika sudah berlangganan.
2. THE Registered_User yang terotentikasi SHALL dapat berhenti berlangganan via `DELETE /api/subscriptions`. Mengembalikan 404 jika belum berlangganan.
3. THE endpoint `GET /api/subscriptions/status` (memerlukan auth) SHALL mengembalikan `{ subscribed: boolean }`.
4. WHEN sebuah post dipublikasikan (status bertransisi dari `draft` ke `published`), THE System SHALL mengirim notifikasi email ke semua pelanggan.
5. THE pengiriman email SHALL menggunakan Resend SDK, membaca `RESEND_API_KEY` dan `RESEND_FROM_EMAIL` dari environment variables.
6. IF `RESEND_API_KEY` tidak ada atau kosong, THEN THE MailService SHALL no-op secara graceful — penerbitan post harus tetap berhasil tanpa throw error.
7. THE komponen SubscribeButton SHALL muncul di PostDetailPage dan header daftar blog untuk pengguna terotentikasi. Komponen ini SHALL mencerminkan status langganan saat ini dan toggle saat diklik.

---

### Requirement 7: Perluasan Dashboard Admin

**User Story:** Sebagai Admin, saya ingin dashboard menampilkan statistik nyata dan memiliki halaman manajemen untuk pengguna dan komentar, sehingga saya dapat memantau dan mengelola seluruh aktivitas website.

#### Acceptance Criteria

1. THE endpoint `GET /api/admin/stats` (hanya admin) SHALL mengembalikan: `totalPosts`, `totalComments`, `totalUsers` (masing-masing berupa number), `recentPosts` (5 terakhir), `recentComments` (5 terakhir), `recentUsers` (5 terakhir berdasarkan tanggal bergabung).
2. THE DashboardPage SHALL didesain ulang dengan: baris kartu statistik menampilkan `totalPosts`, `totalComments`, `totalUsers` menggunakan komponen StatCard (shadcn Card), tabel "Recent Posts", daftar "Recent Comments", dan daftar "Latest Users".
3. THE endpoint `GET /api/admin/users` (hanya admin) SHALL mengembalikan daftar semua pengguna yang dipaginasi, mencakup `id`, `username`, `email`, `role`, `createdAt`, dan `commentCount`.
4. THE endpoint `DELETE /api/admin/users/:id` (hanya admin) SHALL menghapus pengguna secara permanen dan cascade-menghapus komentarnya.
5. THE halaman UsersAdminPage di `/admin/users` SHALL menampilkan daftar pengguna dengan kemampuan hapus.
6. THE endpoint `GET /api/admin/comments` (hanya admin) SHALL mengembalikan daftar semua komentar yang dipaginasi di semua content type, mencakup judul konten dan username penulis.
7. THE halaman CommentsAdminPage di `/admin/comments` SHALL menampilkan semua komentar dengan kemampuan hapus.
8. THE tampilan statistik pada dashboard SHALL menggunakan komponen StatCard yang dapat digunakan kembali (`components/admin/StatCard.tsx`) yang menerima `label`, nilai numerik, dan `icon`, sehingga cukup generik untuk Stage 2 dan 3 tanpa modifikasi.

---

### Requirement 8: Toolbar Formatting Markdown

**User Story:** Sebagai Admin, saya ingin editor Markdown memiliki toolbar formatting, sehingga saya dapat memformat konten tanpa harus mengingat sintaks Markdown secara manual.

#### Acceptance Criteria

1. THE PostEditor SHALL menyertakan toolbar formatting di atas area textarea yang menyediakan tombol-tombol aksi berikut beserta ikon yang sesuai:
   - **Undo** — ikon panah melengkung ke kiri (↩)
   - **Redo** — ikon panah melengkung ke kanan (↪)
   - **Bold** — ikon huruf **B** tebal
   - **Italic** — ikon huruf *I* miring
   - **Heading** — dropdown atau tombol cycle H1/H2/H3/H4 dengan ikon **H** dan angka level
   - **Strikethrough** — ikon huruf ~~S~~ dengan garis tengah
   - **Unordered list** — ikon daftar dengan bullet (☰ atau ≡ dengan titik)
   - **Ordered list** — ikon daftar bernomor (1. 2. 3.)
   - **Task list** — ikon kotak centang (☐)
   - **Blockquote** — ikon tanda kutip ("  " atau `>`)
   - **Inline code** — ikon backtick atau `<>`
   - **Code block** — ikon blok kode atau `{ }`
   - **Inline math** — ikon `$` tunggal
   - **Display math** — ikon `$$` ganda
   - **Tabel** — ikon grid (⊞)
   - **Link** — ikon rantai atau 🔗
   - **Insert image URL** — ikon gambar (🖼 atau □ dengan segitiga)
2. WHEN tombol Bold diklik dengan teks terseleksi, THE System SHALL membungkus teks yang terseleksi dengan `**teks**`. WHEN tidak ada teks terseleksi, THE System SHALL menyisipkan `**teks tebal**` di posisi kursor dan menyeleksi bagian "teks tebal".
3. WHEN tombol Italic diklik dengan teks terseleksi, THE System SHALL membungkus teks yang terseleksi dengan `*teks*`. WHEN tidak ada teks terseleksi, THE System SHALL menyisipkan `*teks miring*` di posisi kursor dan menyeleksi bagian "teks miring".
4. THE toolbar SHALL menyediakan empat tombol heading: H1, H2, H3, H4. WHEN tombol H`n` diklik, THE System SHALL mengganti baris saat ini dengan prefix `#`×n diikuti spasi; IF baris sudah memiliki prefix `#`×n THEN prefix tersebut SHALL dihapus (toggle). IF baris memiliki prefix heading level lain THEN level-nya SHALL diganti dengan level yang diklik.
5. WHEN tombol Strikethrough diklik dengan teks terseleksi, THE System SHALL membungkus teks dengan `~~teks~~`. WHEN tidak ada teks terseleksi, THE System SHALL menyisipkan `~~teks~~` dan menyeleksi bagian "teks".
6. WHEN tombol Unordered list diklik, THE System SHALL menambahkan prefix `- ` pada baris saat ini atau setiap baris yang terseleksi; IF baris sudah memiliki prefix tersebut THEN prefix SHALL dihapus (toggle).
7. WHEN tombol Ordered list diklik, THE System SHALL menambahkan prefix `1. ` pada baris saat ini atau setiap baris yang terseleksi; IF baris sudah memiliki prefix tersebut THEN prefix SHALL dihapus (toggle).
8. WHEN tombol Task list diklik, THE System SHALL menambahkan prefix `- [ ] ` pada baris saat ini atau setiap baris yang terseleksi; IF baris sudah memiliki prefix tersebut THEN prefix SHALL dihapus (toggle).
9. WHEN tombol Blockquote diklik, THE System SHALL menambahkan prefix `> ` pada baris saat ini atau setiap baris yang terseleksi; IF baris sudah memiliki prefix tersebut THEN prefix SHALL dihapus (toggle).
10. WHEN tombol Inline code diklik dengan teks terseleksi, THE System SHALL membungkus teks dengan backtick tunggal. WHEN tidak ada teks terseleksi, THE System SHALL menyisipkan pasangan backtick dengan kursor di tengah.
11. WHEN tombol Code block diklik dengan teks terseleksi, THE System SHALL membungkus teks dengan triple backtick dan newline. WHEN tidak ada teks terseleksi, THE System SHALL menyisipkan template fenced code block dengan kursor di baris konten.
12. WHEN tombol Inline math diklik dengan teks terseleksi, THE System SHALL membungkus teks dengan `$teks$`. WHEN tidak ada teks terseleksi, THE System SHALL menyisipkan `$expr$` dan menyeleksi bagian "expr".
13. WHEN tombol Display math diklik dengan teks terseleksi, THE System SHALL membungkus teks dengan `$$\n teks \n$$`. WHEN tidak ada teks terseleksi, THE System SHALL menyisipkan template display math dengan kursor di baris konten.
14. WHEN tombol Tabel diklik, THE System SHALL menyisipkan template tabel Markdown minimal (2 kolom, 2 baris data) beserta baris pemisah header di posisi kursor.
15. WHEN tombol Link diklik, THE System SHALL menyisipkan `[teks](url)` di posisi kursor; IF ada teks terseleksi THEN teks tersebut digunakan sebagai label link dan kursor ditempatkan di posisi "url".
16. WHEN tombol Insert image URL diklik, THE System SHALL menyisipkan `![alt](url)` di posisi kursor; IF ada teks terseleksi THEN teks tersebut digunakan sebagai alt text dan kursor ditempatkan di posisi "url".
17. WHEN tombol Undo diklik, THE System SHALL membatalkan aksi toolbar terakhir dan memulihkan konten sebelumnya. WHEN tombol Redo diklik, THE System SHALL mengulangi aksi yang telah dibatalkan.
18. THE toolbar SHALL diimplementasikan sebagai komponen React murni (`MarkdownToolbar`) yang beroperasi pada nilai string textarea melalui state React, tanpa bergantung pada library eksternal tambahan di luar dependensi yang sudah ada.

### Requirement 9: Tombol Kembali (Back Button)

**User Story:** Sebagai Pengguna, saya ingin tombol kembali yang jelas di setiap subhalaman, sehingga saya dapat dengan mudah kembali ke halaman sebelumnya tanpa bergantung pada tombol back browser.

#### Acceptance Criteria

1. THE `PostDetailPage` di `/posts/:slug` SHALL menampilkan tombol "← Kembali ke Blog" di bagian atas konten yang menavigasi ke `/` (atau ke `/blog` setelah migrasi rute di Stage 2).
2. THE halaman `LoginPage` di `/login` SHALL menampilkan tombol "← Kembali" di bagian atas form yang menavigasi ke halaman sebelumnya menggunakan `useNavigate(-1)`, atau ke `/` jika tidak ada riwayat navigasi (window.history.length <= 1).
3. THE halaman `RegisterPage` di `/register` SHALL menampilkan tombol "← Kembali" di bagian atas form yang menavigasi ke halaman sebelumnya menggunakan `useNavigate(-1)`, atau ke `/` jika tidak ada riwayat navigasi.
4. THE setiap subhalaman admin SHALL menampilkan tombol "← Kembali ke Dashboard" di bagian atas yang menavigasi ke `/admin`, mencakup: CreatePostPage, EditPostPage, UsersAdminPage, CommentsAdminPage.
5. THE tombol kembali SHALL menggunakan shadcn `Button` dengan variant `ghost` dan ikon panah kiri (←) di depan teks label.
6. THE tombol kembali SHALL ditempatkan secara konsisten di bagian kiri atas konten halaman, sebelum heading utama halaman.
