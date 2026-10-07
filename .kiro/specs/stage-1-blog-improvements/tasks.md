# Implementation Plan

## Overview

Mengimplementasikan Stage 1 Blog Improvements + UI Standardization yang mencakup 12 task: migrasi shadcn/ui (Tasks 1–3), tag post (Tasks 4, 8), perbaikan komentar admin (Task 5), sistem komentar generik dengan balasan (Tasks 6, 9), rendering KaTeX dan komponen MarkdownRenderer (Task 7), langganan email backend (Task 10), toolbar formatting Markdown (Task 12), serta UI langganan email + perluasan dashboard admin (Task 11).

Setiap task dapat diverifikasi secara independen. Kerjakan sesuai urutan wave — task di wave selanjutnya bergantung pada task di wave sebelumnya.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "4", "5", "6", "7", "10"] },
    { "id": 1, "tasks": ["2", "3", "8", "9", "12"] },
    { "id": 2, "tasks": ["11"] }
  ]
}
```

## Tasks

- [ ] 1. Instal dan konfigurasi shadcn/ui
  - Jalankan `npx shadcn@latest init` di `frontend/` dengan memilih CSS variable theme yang ada tanpa menimpa `index.css`
  - Instal komponen yang diperlukan: `npx shadcn@latest add button input textarea badge card table pagination dialog alert-dialog popover command toggle-group skeleton separator avatar toast tabs`
  - Rename file yang konflik ke `.bak.tsx` terlebih dahulu (misalnya `Button.tsx` → `Button.bak.tsx`) sebelum menjalankan perintah di atas
  - Verifikasi `npm run build` tidak menghasilkan TypeScript error
  - Verifikasi `npx vitest run` lulus (tes yang ada harus tetap lulus — komponen belum diswap)
  - **Files:** `frontend/src/components/ui/` (di-generate), `frontend/components.json`
  - **Requires:** (none)

- [ ] 2. Migrasi komponen UI inti ke shadcn
  - Baca setiap file `.bak.tsx` yang ada untuk memahami prop API saat ini sebelum mengganti
  - Perbarui semua import site di `components/`, `pages/`, `hooks/`
  - Petakan `variant="primary"` ke `variant="default"` pada shadcn Button di semua call site
  - Hapus file `.bak.tsx` setelah semua import diverifikasi
  - Jalankan `npx vitest run` — semua tes komponen yang ada harus lulus; perbaiki yang rusak akibat perbedaan API
  - **Files:** Semua file yang mengimpor Button, Input, Badge, Pagination
  - **Requires:** 1

- [ ] 3. Migrasi komponen layout dan admin ke shadcn
  - `Navbar`: ganti raw `<button>` dengan shadcn `Button` ghost variant
  - `PostTable`: ganti `<table>/<thead>/<tbody>/<tr>/<td>` dengan shadcn `Table/TableHeader/TableBody/TableRow/TableCell`
  - `StatusBadge`: ganti dengan shadcn `Badge`; pertahankan logika warna hijau/kuning via `variant` atau `className`
  - `PostEditor`: ganti raw `<textarea>` dengan shadcn `Textarea`
  - `DashboardPage`: ganti semua `window.confirm()` dengan shadcn `AlertDialog` — konfirmasi dan batal harus bekerja dengan benar
  - Jalankan ulang semua tes halaman admin; perbarui snapshot jika diperlukan
  - **Files:** `frontend/src/components/layout/Navbar.tsx`, `frontend/src/components/admin/PostTable.tsx`, `frontend/src/components/admin/StatusBadge.tsx`, `frontend/src/components/admin/PostEditor.tsx`, `frontend/src/pages/admin/DashboardPage.tsx`
  - **Requires:** 1

- [ ] 4. Tag post — backend
  - Tambahkan model `Tag` (`id` uuid, `name` varchar unique, `slug` varchar unique) dan join table `PostTag` ke `prisma/schema.prisma`
  - Jalankan `npx prisma migrate dev --name add_post_tags`; jalankan `npx prisma generate`
  - Perluas `CreatePostDto` dan `UpdatePostDto` di `backend/src/types/index.ts` dengan `tags?: string[]`
  - Update `post.service.ts`: `createPost` upsert tags dengan nama lowercase, connect via PostTag; `updatePost` disconnect semua tag lama, upsert dan reconnect daftar baru; `mapPost`/`mapPostSummary` sertakan array `tags`; semua fungsi query sertakan tags dalam Prisma `include`
  - Tambahkan route `GET /api/tags` yang mengembalikan semua tag urut alfabetis
  - Unit test: upsert tag bersifat idempotent (nama sama dua kali → satu tag, tidak ada error)
  - Unit test: nama tag dinormalisasi ke lowercase
  - Integration test: buat post dengan tags → GET post mengembalikan tags; update post menghapus tags lama dan menyetel yang baru
  - Integration test: `GET /api/tags` mengembalikan daftar yang benar
  - **Files:** `backend/prisma/schema.prisma`, `backend/src/types/index.ts`, `backend/src/services/post.service.ts`, `backend/src/routes/post.routes.ts`, `backend/src/schemas/post.schema.ts`
  - **Requires:** (none)

- [ ] 5. Perbaikan komentar admin
  - Baca `backend/src/routes/comment.routes.ts` dan hapus `requireRole('user')` dari handler POST (pertahankan `authenticateJWT`)
  - Verifikasi DELETE menggunakan `authenticateJWT` tanpa role restriction (pengecekan admin dilakukan di service layer)
  - Baca `frontend/src/pages/public/PostDetailPage.tsx` dan hapus guard `user.role === 'user'` agar CommentForm ditampilkan untuk semua pengguna terotentikasi
  - Integration test: admin JWT `POST /api/posts/:postId/comments` → 201
  - Integration test: admin JWT `DELETE /api/comments/:id` pada komentar siapapun → 204
  - **Files:** `backend/src/routes/comment.routes.ts`, `frontend/src/pages/public/PostDetailPage.tsx`
  - **Requires:** (none)

- [ ] 6. Sistem komentar generik dengan balasan — backend
  - Update model `Comment` di `prisma/schema.prisma`: tambahkan `contentType String @db.VarChar(10)`, `contentId String @db.Uuid`, `parentId String? @db.Uuid` dengan self-relation `CommentReplies` dan `onDelete: Cascade`
  - Tulis migrasi `update_comments_generic` (dua langkah: tambah kolom + copy data `post_id` ke `content_id`, kemudian drop kolom `post_id` dan FK-nya)
  - Jalankan `npx prisma migrate dev --name update_comments_generic`; jalankan `npx prisma generate`
  - Update `comment.service.ts`: `addComment` memeriksa kedalaman dan menolak dengan 400 jika terlampaui; `getComments` mengembalikan komentar level atas dengan balasan bersarang via `include: { replies: { include: { author: true } } }`; `deleteComment` tidak berubah
  - Tambahkan route generik: `GET /api/comments?contentType=&contentId=` (public), `POST /api/comments` (auth), `DELETE /api/comments/:id` (auth); pertahankan `POST /api/posts/:postId/comments` sebagai alias
  - Tambahkan Zod schema untuk body komentar baru di `schemas/comment.schema.ts`
  - Integration test: POST komentar dengan `contentType: 'post'` → 201; GET mengembalikannya bersarang
  - Integration test: POST reply ke komentar level atas → 201; GET mengembalikan reply di bawah parent
  - Integration test: POST reply ke reply → 400 `REPLY_DEPTH_EXCEEDED`
  - Integration test: DELETE komentar parent → replies terhapus cascade
  - Integration test: admin dapat DELETE komentar siapapun; user hanya dapat DELETE komentar sendiri
  - **Files:** `backend/prisma/schema.prisma`, `backend/src/services/comment.service.ts`, `backend/src/routes/comment.routes.ts`, `backend/src/schemas/comment.schema.ts`
  - **Requires:** (none)

- [ ] 7. KaTeX rendering dan komponen MarkdownRenderer
  - Jalankan `npm install remark-math rehype-katex katex` di `frontend/`
  - Tambahkan `import 'katex/dist/katex.min.css'` ke `frontend/src/main.tsx`
  - Buat `MarkdownRenderer.tsx` yang membungkus `react-markdown` dengan `remarkMath` + `rehypeKatex` dan menerapkan prose Tailwind styles yang ada; menerima prop `content: string`
  - Update `PostDetailPage`: ganti `dangerouslySetInnerHTML={{ __html: post.contentHtml }}` dengan `<MarkdownRenderer content={post.content} />` (gunakan `post.content` raw, bukan `post.contentHtml`)
  - Update live preview `PostEditor`: ganti `<ReactMarkdown>` dengan `<MarkdownRenderer>`
  - Render test: `$x^2$` → elemen `<span class="katex">` hadir dalam output
  - Render test: `$$\int_0^1 f\,dx$$` → elemen display math hadir
  - Render test: heading, code block, link masih dirender dengan benar
  - Render test: `![img](https://example.com/a.png)` merender tag `<img>`
  - **Files:** `frontend/src/main.tsx`, `frontend/src/components/shared/MarkdownRenderer.tsx`, `frontend/src/pages/public/PostDetailPage.tsx`, `frontend/src/components/admin/PostEditor.tsx`
  - **Requires:** (none)

- [ ] 8. Tag post — frontend
  - Update tipe `Post` dan `PostSummary` di `frontend/src/types/index.ts` untuk menyertakan `tags: { id: string; name: string; slug: string }[]`
  - Buat `api/tags.ts` dengan fungsi `getTags()`
  - Buat komponen `TagChip` menggunakan shadcn `Badge`
  - Update `PostCard` dan `PostDetailPage` untuk merender `TagChip` per tag
  - Buat komponen `TagInput` menggunakan shadcn `Command` + `Popover` (staleTime Infinity untuk saran, Enter menambahkan tag, `×` menghapus, `onChange(tags: string[])` dikirim ke parent)
  - Tambahkan `TagInput` ke `PostEditor` dan sambungkan ke handler submit `CreatePostPage` dan `EditPostPage`
  - Component test: `TagChip` merender nama dengan benar
  - Component test: `TagInput` — tambah tag via Enter, hapus tag via ×, dropdown autocomplete muncul dengan data mock
  - **Files:** `frontend/src/types/index.ts`, `frontend/src/api/tags.ts`, `frontend/src/components/shared/TagChip.tsx`, `frontend/src/components/shared/TagInput.tsx`, `frontend/src/components/blog/PostCard.tsx`, `frontend/src/pages/public/PostDetailPage.tsx`, `frontend/src/components/admin/PostEditor.tsx`, `frontend/src/pages/admin/CreatePostPage.tsx`, `frontend/src/pages/admin/EditPostPage.tsx`
  - **Requires:** 4, 1

- [ ] 9. Balasan komentar — frontend
  - Update tipe `Comment` di `frontend/src/types/index.ts`: tambahkan `parentId: string | null` dan `replies: Comment[]`
  - Update `api/comments.ts` untuk menggunakan endpoint generik baru (`GET /api/comments?contentType=&contentId=`, `POST /api/comments`, `DELETE /api/comments/:id`)
  - Update `CommentList`: render hanya komentar level atas di daftar utama; render `replies` masing-masing dengan indentasi di bawah (gunakan `ml-8` atau serupa); tambahkan tombol "Reply" pada semua komentar (baik level atas maupun balasan); tambahkan state `replyingTo: string | null` untuk toggle form inline pada komentar level atas
  - Logika klik "Reply": jika komentar adalah level atas (`parentId === null`) — buka CommentForm inline di bawah komentar tersebut; jika komentar adalah balasan (`parentId !== null`) — scroll ke CommentForm level atas terdekat dan isi dengan `@authorUsername` penulis balasan tersebut (tidak membuka form baru yang lebih dalam)
  - Update `CommentForm`: terima prop opsional `parentId?: string` dan `parentAuthorUsername?: string` (di-prepend sebagai `@mention`); pass `contentType`, `contentId`, `parentId` ke API call
  - Update `PostDetailPage` untuk pass `contentType="post"` dan `contentId={post.id}` ke `CommentList` dan `CommentForm`
  - Component test: komentar level atas merender dengan tombol "Reply"
  - Component test: balasan merender dengan tombol "Reply"
  - Component test: klik "Reply" pada komentar level atas membuka form inline pre-filled dengan `@username`
  - Component test: klik "Reply" pada balasan mengisi CommentForm level atas dengan `@username` penulis balasan (tidak membuka form baru)
  - Component test: reply bersarang tampil diindentasi di bawah parent
  - **Files:** `frontend/src/types/index.ts`, `frontend/src/api/comments.ts`, `frontend/src/components/blog/CommentList.tsx`, `frontend/src/components/blog/CommentForm.tsx`, `frontend/src/pages/public/PostDetailPage.tsx`
  - **Requires:** 6

- [ ] 10. Langganan email — backend
  - Tambahkan model `Subscription` (`id`, `userId @unique FK → User`, `createdAt`) ke `prisma/schema.prisma`
  - Jalankan `npx prisma migrate dev --name add_subscriptions`; jalankan `npx prisma generate`
  - Jalankan `npm install resend` di `backend/`
  - Buat `services/mail.service.ts`: Resend singleton, no-op jika `RESEND_API_KEY` tidak ada, metode `sendNewPostNotification`
  - Buat `services/subscription.service.ts`: `subscribe` throw 409 `ALREADY_SUBSCRIBED`, `unsubscribe` throw 404 `NOT_SUBSCRIBED`, `getStatus`, `getAllSubscriberEmails`
  - Update `publishPost` di `post.service.ts`: setelah update status, panggil `getAllSubscriberEmails` lalu `mailService.sendNewPostNotification` di dalam `try/catch`; kegagalan email tidak boleh menggagalkan publish
  - Buat `routes/subscription.routes.ts` di-mount di `/api/subscriptions`: `POST /` (auth), `DELETE /` (auth), `GET /status` (auth)
  - Unit test: `MailService.sendNewPostNotification` dengan mocked Resend client — dipanggil dengan email yang benar; no-op saat key tidak ada
  - Integration test: `POST /api/subscriptions` → 201; panggil kedua → 409
  - Integration test: `DELETE /api/subscriptions` → 204; panggil kedua → 404
  - Integration test: `GET /api/subscriptions/status` mengembalikan boolean yang benar sebelum dan sesudah subscribe
  - **Files:** `backend/prisma/schema.prisma`, `backend/src/services/mail.service.ts`, `backend/src/services/subscription.service.ts`, `backend/src/routes/subscription.routes.ts`, `backend/src/services/post.service.ts`
  - **Requires:** (none)

- [ ] 11. UI langganan email + dashboard admin yang diperluas — frontend
  - Buat `api/subscriptions.ts` dengan fungsi `getStatus()`, `subscribe()`, `unsubscribe()`
  - Buat hook `useSubscription` (`useQuery` + `useMutation`, invalidates on success) di `hooks/useSubscription.ts`
  - Buat komponen `SubscribeButton` (tidak merender apa pun jika tidak terotentikasi, tampilkan "Subscribe"/"Subscribed", loading state saat mutasi)
  - Mount `SubscribeButton` di `PostDetailPage` dan area header `BlogPage`/`HomePage`
  - Buat komponen `StatCard` (shadcn `Card`, props `label/value/icon/href?`) di `components/admin/StatCard.tsx`
  - Buat backend `routes/admin.routes.ts` dengan: `GET /api/admin/stats` (totalPosts/totalComments/totalUsers/recentPosts[5]/recentComments[5]/recentUsers[5]), `GET /api/admin/users` (dipaginasi dengan commentCount), `DELETE /api/admin/users/:id`, `GET /api/admin/comments` (dipaginasi, filter `?contentType=` opsional)
  - Desain ulang `DashboardPage`: baris `StatCard` + tabel recent activity
  - Buat `UsersAdminPage` di `/admin/users`: shadcn `Table` + shadcn `AlertDialog` untuk konfirmasi hapus
  - Buat `CommentsAdminPage` di `/admin/comments`: shadcn `Table` + tombol hapus
  - Update `App.tsx` dengan route baru `/admin/users` dan `/admin/comments`; update tautan navigasi admin
  - Component test: `SubscribeButton` menampilkan "Subscribe" saat belum berlangganan, "Subscribed" saat berlangganan, toggle saat diklik
  - Component test: `StatCard` merender dengan data mock
  - Integration test: `GET /api/admin/stats` mengembalikan shape yang benar
  - Integration test: `GET /api/admin/users` mengembalikan daftar dipaginasi dengan `commentCount`
  - Integration test: `DELETE /api/admin/users/:id` menghapus user dan cascade comments
  - Integration test: `GET /api/admin/comments` mengembalikan semua komentar di semua content type
  - **Files:** `frontend/src/api/subscriptions.ts`, `frontend/src/hooks/useSubscription.ts`, `frontend/src/components/shared/SubscribeButton.tsx`, `frontend/src/components/admin/StatCard.tsx`, `frontend/src/pages/admin/DashboardPage.tsx`, `frontend/src/pages/admin/UsersAdminPage.tsx`, `frontend/src/pages/admin/CommentsAdminPage.tsx`, `frontend/src/App.tsx`, `backend/src/routes/admin.routes.ts`, `backend/src/controllers/stats.controller.ts`
  - **Requires:** 10, 3

- [ ] 12. Toolbar formatting Markdown — PostEditor
  - Buat komponen `MarkdownToolbar` di `frontend/src/components/admin/MarkdownToolbar.tsx` sebagai komponen React murni tanpa dependensi library tambahan
  - Toolbar menyediakan tombol dengan ikon yang sesuai untuk: Undo (↩), Redo (↪), Bold (**B**), Italic (*I*), H1/H2/H3/H4 (tombol heading terpisah), Strikethrough (~~S~~), Unordered list, Ordered list, Task list (☐), Blockquote (>), Inline code (``), Code block ({ }), Inline math ($), Display math ($), Tabel (⊞), Link (🔗), Insert image URL (🖼)
  - Implementasikan fungsi helper murni tanpa side effect yang dapat diuji secara terpisah:
    - `wrapSelection(value, selStart, selEnd, pre, post, placeholder)` — untuk Bold, Italic, Strikethrough, Inline code, Inline math, Display math
    - `prefixLines(value, selStart, selEnd, prefix)` — untuk Unordered list, Ordered list, Task list, Blockquote (toggle: hapus jika sudah ada)
    - `setHeading(value, selStart, level)` — toggle H1–H4 dengan cycle antar level; hapus jika level sama
    - `insertTemplate(value, selStart, template)` — untuk Tabel, Link, Image, Code block
  - Setiap aksi toolbar: (1) hitung string baru menggunakan helper di atas, (2) panggil `setValue(newValue)`, (3) set kursor/seleksi yang tepat via `textarea.setSelectionRange` setelah React re-render (gunakan `useEffect` + ref)
  - Undo/Redo: simpan snapshot string sebelum setiap aksi toolbar dalam array history di `PostEditor` state; tombol Undo/Redo navigasi maju-mundur di array tersebut
  - Pasang `MarkdownToolbar` di atas textarea di dalam `PostEditor`; sambungkan dengan `content` state, `setContent`, dan `textareaRef`
  - Gunakan ikon SVG inline atau Unicode symbol yang sesuai untuk setiap tombol; tombol heading H1–H4 tampil berjajar sebagai sub-group dengan separator visual
  - Component test: Bold dengan seleksi → `**teks**`; Bold tanpa seleksi → `**teks tebal**`
  - Component test: H2 pada baris kosong → `## `; klik H2 lagi → prefix dihapus; klik H3 pada baris `## ` → diganti `### `
  - Component test: Unordered list → `- ` ditambahkan; klik lagi → dihapus (toggle)
  - Component test: Inline math tanpa seleksi → `$expr# Implementation Plan; Display math → template multiline
  - Component test: Undo setelah Bold → konten kembali ke sebelumnya; Redo → Bold kembali diterapkan
  - **Files:** `frontend/src/components/admin/MarkdownToolbar.tsx`, `frontend/src/components/admin/PostEditor.tsx`
  - **Requires:** 1


## Notes

- Task 1, 4, 5, 6, 7, 10 tidak memiliki dependensi dan dapat dikerjakan secara paralel dalam wave 0.
- Task 2 dan 3 memerlukan shadcn terinstal (Task 1) terlebih dahulu.
- Task 8 memerlukan Task 4 (backend tags) dan Task 1 (shadcn untuk TagInput).
- Task 9 memerlukan Task 6 (generic comment backend) untuk endpoint yang benar.
- Task 11 memerlukan Task 10 (subscription backend) dan Task 3 (shadcn AlertDialog di DashboardPage).
- Migration harus dijalankan dalam urutan: `add_post_tags` → `update_comments_generic` → `add_subscriptions`.
- Setelah Task 6, jalankan `npx prisma migrate dev --name update_comments_generic` dengan hati-hati karena melibatkan migrasi data dari `postId` ke `contentId`.
- Stage 1 tidak memperkenalkan halaman publik baru — semua perubahan berada di blog section yang ada dan dashboard admin.
- Tidak ada perubahan kode di luar `backend/` dan `frontend/src/` — tidak ada file infrastruktur yang dimodifikasi.
