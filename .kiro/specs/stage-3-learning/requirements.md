# Requirements Document

## Introduction

Stage 3 menambahkan sistem Learning yang paling kompleks di seluruh website. Sistem ini memungkinkan Admin membuat modul pembelajaran yang bersifat atomik (satu topik per modul), interaktif (blok konten yang dapat mengeksekusi kode, visualisasi dinamis, dan soal isian), dan saling terhubung melalui relasi prerequisit yang membentuk DAG (Directed Acyclic Graph). Registered_User yang sudah login dapat menjelajahi modul melalui visualisasi digraf interaktif (React Flow), melacak progres penyelesaian modul, menyimpan catatan personal dengan highlight teks (sistem anotasi berbasis XPath), dan membuat serta mereview flashcard menggunakan algoritma SM-2 (spaced repetition). Prerequisites: Stage 1 dan Stage 2 harus selesai — sistem komentar generik, MarkdownRenderer, shadcn/ui, dan seluruh infrastruktur routing sudah tersedia.

## Glossary

- **Module**: Unit pembelajaran atomik yang mencakup tepat satu topik; memiliki title, slug, summary, contentJson (array blok konten), dan status draft/published
- **ModulePrereq**: Join table self-referencing yang menghubungkan Module dengan prerequisitenya, membentuk DAG (Directed Acyclic Graph)
- **LearningPath**: Sekuens modul yang dikurasi oleh Admin; memberikan jalur belajar yang terstruktur kepada Registered_User
- **PathModule**: Join table yang menghubungkan LearningPath dengan Module beserta urutan tampilnya
- **UserProgress**: Record yang menyatakan seorang Registered_User telah menyelesaikan sebuah Module
- **ContentBlock**: Satu unit konten dalam Module; memiliki field `type` (markdown/fill-blank/slider-viz/code-runner) dan `data` yang spesifik per type
- **WidgetRegistry**: Objek `Record<string, ComponentType>` di frontend yang memetakan tipe blok ke komponen React yang merendernya; menambah widget baru = satu entri baru
- **DAG**: Directed Acyclic Graph — struktur graf berarah tanpa siklus; digunakan untuk merepresentasikan relasi prerequisit antar Module
- **CycleDetection**: Algoritma BFS yang dijalankan sebelum setiap penambahan edge prerequisit untuk memastikan graf tetap merupakan DAG yang valid
- **Judge0**: REST API pihak ketiga untuk eksekusi kode dalam berbagai bahasa pemrograman; diproxy melalui backend untuk menjaga API key tetap di server
- **SM2**: Algoritma spaced repetition (SuperMemo 2) yang menentukan jadwal review Flashcard berdasarkan rating pengguna
- **Flashcard**: Kartu belajar dengan sisi depan (pertanyaan) dan belakang (jawaban); dapat dibuat dari UserNote; dijadwalkan untuk review menggunakan algoritma SM-2
- **UserNote**: Catatan pribadi yang dibuat oleh Registered_User dengan cara menyeleksi teks dalam Module; menyimpan teks yang disorot dan posisi anchor via XPath
- **AnchorData**: Objek JSON yang menyimpan posisi seleksi teks dalam DOM menggunakan XPath relatif terhadap container konten; digunakan untuk me-restore highlight saat Module dibuka kembali
- **XPathAnchor**: Representasi posisi node teks dalam DOM sebagai string XPath relatif; format: `{ startXPath, startOffset, endXPath, endOffset }`

---

## Requirements

### Requirement 1: Core Data Models

**User Story:** Sebagai Developer, saya ingin model data inti untuk sistem Learning tersedia di database, sehingga semua fitur learning dapat dibangun di atas fondasi yang kokoh.

#### Acceptance Criteria

1. THE System SHALL mendukung model `Module` dengan field: `id` (uuid), `title` (varchar 200), `slug` (unik, auto-generated via `slugify` + numeric suffix), `summary` (varchar 500 — deskripsi singkat yang ditampilkan pada graph node dan path list), `contentJson` (JSON — array content block; lihat Requirement 4), `status` (`draft | published`), `publishedAt` (timestamptz, nullable), `createdAt`, `updatedAt`.
2. THE System SHALL mendukung model `ModulePrereq` sebagai join table self-referencing many-to-many pada `Module`: `moduleId` (uuid FK → Module) dan `prerequisiteId` (uuid FK → Module). Keduanya membentuk DAG. Penambahan edge yang menciptakan siklus harus ditolak.
3. THE System SHALL mendukung model `LearningPath` dengan field: `id`, `title` (varchar 200), `description` (text, opsional), `createdAt`.
4. THE System SHALL mendukung model `PathModule` sebagai join table: `pathId` (uuid FK → LearningPath), `moduleId` (uuid FK → Module), `order` (integer). Bersama-sama mendefinisikan sekuens modul yang terurut dalam sebuah path.
5. THE System SHALL mendukung model `UserProgress` dengan field: `userId` (uuid FK → User), `moduleId` (uuid FK → Module), `completedAt` (timestamptz). Composite PK pada `(userId, moduleId)`.

---

### Requirement 2: Module and Path API

**User Story:** Sebagai Registered_User dan Admin, saya ingin endpoint API yang lengkap untuk module dan learning path, sehingga frontend dapat menampilkan dan mengelola seluruh sistem learning.

#### Acceptance Criteria

1. THE endpoint `GET /api/modules` (auth required — semua registered user) SHALL mengembalikan semua published module sebagai flat array beserta prerequisite edge dan status penyelesaian per module untuk user saat ini. Shape: `{ modules: Module[], edges: { from: string, to: string }[] }`.
2. THE endpoint `GET /api/modules/:slug` (auth required) SHALL mengembalikan module lengkap termasuk `contentJson` dan status penyelesaian user saat ini. Draft module SHALL mengembalikan 404 kepada non-admin user.
3. THE endpoint `POST /api/modules`, `PUT /api/modules/:id`, `DELETE /api/modules/:id` (hanya admin) SHALL menyediakan CRUD lengkap untuk module.
4. THE endpoint `PATCH /api/modules/:id/publish` dan `PATCH /api/modules/:id/unpublish` (hanya admin) SHALL mengikuti state machine yang sama seperti post (transisi duplikat → 409).
5. THE endpoint `POST /api/modules/:id/prerequisites` (hanya admin) SHALL menerima body `{ prerequisiteId: string }` dan menambahkan prerequisite edge. IF penambahan edge tersebut akan menciptakan siklus dalam DAG, THEN THE System SHALL menolak request dengan 400 `CYCLE_DETECTED`.
6. THE endpoint `DELETE /api/modules/:id/prerequisites/:prereqId` (hanya admin) SHALL menghapus prerequisite edge.
7. THE endpoint `POST /api/modules/:id/complete` (auth required) SHALL menandai module sebagai selesai untuk user saat ini. Mengembalikan 409 jika sudah diselesaikan.
8. THE endpoint `DELETE /api/modules/:id/complete` (auth required) SHALL membatalkan penandaan penyelesaian (reset). Mengembalikan 404 jika belum diselesaikan.
9. THE endpoint `GET /api/paths` (auth required) SHALL mengembalikan semua learning path beserta ordered module list (id, title, slug, summary, dan status penyelesaian untuk user saat ini).
10. THE endpoint `POST /api/paths`, `PUT /api/paths/:id`, `DELETE /api/paths/:id` (hanya admin) SHALL menyediakan CRUD lengkap untuk learning path.
11. THE endpoint `PUT /api/paths/:id/modules` (hanya admin) SHALL menerima body `{ modules: { moduleId, order }[] }` dan mengganti seluruh ordered module list untuk path tersebut dalam satu transaksi.
12. THE komentar pada module SHALL menggunakan sistem komentar generik dengan `contentType: 'module'`.

---

### Requirement 3: Module Graph UI

**User Story:** Sebagai Registered_User, saya ingin melihat semua modul sebagai graf interaktif, sehingga saya dapat memahami hubungan antar modul dan merencanakan jalur belajar saya.

#### Acceptance Criteria

1. THE `LearningPage` di `/learning` SHALL di-route-guard: pengguna yang tidak terotentikasi SHALL diarahkan ke `/login`.
2. THE `LearningPage` SHALL merender semua published module sebagai digraf interaktif menggunakan React Flow. Node adalah module; edge berarah merepresentasikan relasi prerequisit (edge dari prerequisite → module).
3. THE setiap node SHALL di-style secara visual berdasarkan status penyelesaian user saat ini: belum dimulai → gray/muted; selesai → green.
4. WHEN sebuah node diklik, THE System SHALL menavigasi ke `/learning/:slug`.
5. THE sidebar `PathSidebar` SHALL menampilkan daftar semua learning path yang dikurasi admin. WHEN sebuah path diklik, THE System SHALL menyorot node module yang termasuk path tersebut dengan outline/warna yang berbeda tanpa menavigasi keluar dari halaman.
6. THE graf SHALL mendukung pan dan zoom (bawaan React Flow).
7. THE tautan Learning di Navbar (sebelumnya ditandai "coming soon") SHALL menjadi tautan aktif ke `/learning` di Stage 3. Badge "soon" SHALL dihapus.
8. THE seksi Learning CTA di landing page SHALL diperbarui untuk menautkan ke `/learning` menggantikan placeholder sebelumnya.

---

### Requirement 4: Module Content Block System

**User Story:** Sebagai Admin, saya ingin dapat membuat konten modul menggunakan berbagai jenis blok interaktif, sehingga materi pembelajaran dapat disajikan dengan cara yang lebih menarik dan efektif.

#### Acceptance Criteria

1. THE konten module SHALL disimpan sebagai `contentJson`: array terurut dari objek blok. Setiap blok memiliki string `type` dan objek `data` yang spesifik untuk type tersebut.
2. THE frontend SHALL merender blok via widget registry: objek `Record<string, React.ComponentType<{ data: unknown }>>` di `components/learning/widgets/registry.tsx`. Menambah widget type baru hanya memerlukan satu entri baru ke registry — `ModuleDetailPage` sendiri tidak boleh perlu diubah.
3. THE widget type `markdown` SHALL diimplementasikan: `data: { content: string }` — Markdown source dengan LaTeX opsional; dirender via `MarkdownRenderer` (menggunakan kembali komponen Stage 1).
4. THE widget type `fill-blank` SHALL diimplementasikan: `data: { template: string, answer: string }` — template mengandung `[___]` sebagai placeholder blank; merender template dengan `[___]` diganti `<input>` teks; tombol "Check" membandingkan input (trimmed, case-insensitive) dengan `answer`; menampilkan feedback hijau "Correct!" atau merah "Incorrect, try again"; tidak mengungkapkan jawaban pada percobaan yang salah.
5. THE widget type `slider-viz` SHALL diimplementasikan: `data: { equation: string, params: { name, min, max, step, default }[] }` — `equation` adalah string ekspresi math menggunakan nama param sebagai variabel; merender `recharts` `LineChart` menghitung `y = f(x)` atas rentang x tetap menggunakan nilai param saat ini; satu slider `<input type="range">` per param dengan label; chart update live saat slider digerak; evaluasi ekspresi HARUS menggunakan math parser yang aman (mathjs) — tidak boleh menggunakan `eval()`.
6. THE widget type `code-runner` SHALL diimplementasikan: `data: { language: string, starterCode: string, description?: string }` — merender code editor (`@uiw/react-codemirror`) pre-filled dengan `starterCode`; dropdown pemilih bahasa dibatasi pada: Python, TypeScript, Java, C#, Haskell, Rust, R; tombol "Run" mengirim kode ke `POST /api/run-code`; menampilkan stdout/stderr di output panel; status indicator: idle / running / success / error.
7. IF tipe blok tidak dikenal, THEN THE System SHALL merender fallback yang tidak crash (misalnya `<div>Unknown block type: {type}</div>`).

---

### Requirement 5: Module Detail Page

**User Story:** Sebagai Registered_User, saya ingin halaman detail modul yang lengkap dengan semua widget interaktif, progress tracker, komentar, dan panel catatan, sehingga saya dapat belajar secara menyeluruh dalam satu halaman.

#### Acceptance Criteria

1. THE `ModuleDetailPage` di `/learning/:slug` SHALL merender semua blok secara berurutan menggunakan widget registry.
2. THE progress indicator SHALL menampilkan berapa banyak module dalam path yang sedang dipilih yang telah diselesaikan (jika user bernavigasi via learning path; disembunyikan jika tidak).
3. THE tombol "Mark as Complete" SHALL memanggil `POST /api/modules/:id/complete`. Setelah berhasil, tombol berubah menjadi "Completed ✓" dan di-disable. Jika sudah diselesaikan, tombol merender sebagai "Completed ✓" saat halaman dimuat.
4. THE seksi komentar SHALL muncul di bagian bawah module, menggunakan kembali `CommentList` dan `CommentForm` dengan `contentType="module"`.
5. THE `NotesPanel` yang dapat dilipat SHALL muncul sebagai sidebar atau bottom drawer. Menampilkan semua catatan tersimpan untuk module saat ini (lihat Requirement 7). WHEN sebuah catatan diklik, THE System SHALL men-scroll ke highlight di konten module.

---

### Requirement 6: Code Execution

**User Story:** Sebagai Registered_User, saya ingin dapat menjalankan kode langsung dalam modul pembelajaran, sehingga saya dapat bereksperimen dan memahami konsep pemrograman secara langsung.

#### Acceptance Criteria

1. THE endpoint backend `POST /api/run-code` (auth required) SHALL memproxy request eksekusi kode ke Judge0 REST API.
2. THE request body SHALL berupa `{ language: string, sourceCode: string, stdin?: string }`. Backend SHALL memetakan `language` ke Judge0 language ID.
3. THE backend SHALL melakukan polling ke Judge0 untuk mendapatkan hasil (Judge0 bersifat asinkron) dan mengembalikan `{ stdout: string, stderr: string, status: string }` setelah eksekusi selesai atau timeout (maksimal 10 detik).
4. THE `POST /api/run-code` SHALL di-rate-limit ke 20 request per menit per authenticated user menggunakan `express-rate-limit` dengan key berdasarkan `req.user.id`.
5. THE Judge0 API URL dan API key SHALL dibaca dari environment variable `JUDGE0_API_URL` dan `JUDGE0_API_KEY`. IF `JUDGE0_API_KEY` tidak ada, THEN THE endpoint SHALL mengembalikan 503 `CODE_EXECUTION_UNAVAILABLE`.
6. THE bahasa yang didukung beserta Judge0 language ID-nya SHALL didefinisikan dalam constants file: Python (71), TypeScript (74), Java (62), C# (51), Haskell (61), Rust (73), R (80).

---

### Requirement 7: Text Annotations and Notes

**User Story:** Sebagai Registered_User, saya ingin dapat menyeleksi teks dalam modul dan menambahkan catatan personal, sehingga saya dapat menyimpan pemahaman dan insight saya langsung pada konten yang relevan.

#### Acceptance Criteria

1. THE System SHALL mendukung model `UserNote` dengan field: `id` (uuid), `userId` (uuid FK → User), `moduleId` (uuid FK → Module), `highlightText` (text — teks yang diseleksi verbatim), `anchorData` (JSON — serialized XPath range untuk re-highlighting: `{ startXPath, startOffset, endXPath, endOffset }`), `noteContent` (text — teks anotasi user, boleh string kosong), `createdAt`, `updatedAt`.
2. THE endpoint `POST /api/notes` (auth required) SHALL membuat catatan baru. Body: `{ moduleId, highlightText, anchorData, noteContent }`.
3. THE endpoint `GET /api/notes?moduleId=:id` (auth required) SHALL mengembalikan semua catatan milik user saat ini pada module yang ditentukan.
4. THE endpoint `PUT /api/notes/:id` (auth required) SHALL memperbarui `noteContent`. Mengembalikan 403 jika catatan milik user lain.
5. THE endpoint `DELETE /api/notes/:id` (auth required) SHALL menghapus catatan. Mengembalikan 403 jika catatan milik user lain.
6. THE hook `useTextSelection` SHALL mendengarkan event `mouseup` pada container konten module. WHEN user melepas mouse setelah menyeleksi teks non-kosong, THE System SHALL menampilkan shadcn `Popover` mengambang dekat seleksi yang berisi: preview teks terseleksi (dipotong jika panjang), textarea untuk konten catatan (opsional), tombol "Save Note" dan tombol "Cancel".
7. WHEN catatan disimpan, THE System SHALL menyerialkan DOM `Selection` range saat ini ke XPath-based `anchorData` dan memanggil `POST /api/notes`.
8. WHEN module dimuat, THE frontend SHALL mengambil semua catatan tersimpan untuk module tersebut dan me-re-apply highlight `<mark>` span pada text range yang sesuai menggunakan `anchorData` yang tersimpan.
9. THE `NotesPanel` SHALL menampilkan semua catatan untuk module saat ini. Setiap catatan menampilkan teks yang di-highlight, konten catatan, dan tombol edit/hapus. WHEN sebuah catatan diklik, THE System SHALL men-scroll ke highlight anchor di konten.
10. THE serialisasi dan deserialisasi XPath anchor SHALL diimplementasikan sebagai pure utility function di `utils/anchorUtils.ts`. Fungsi-fungsi ini SHALL di-unit-test untuk round-trip fidelity (serialize → deserialize → range yang sama).

---

### Requirement 8: Flashcard System

**User Story:** Sebagai Registered_User, saya ingin membuat flashcard dari catatan saya dan mereviewnya dengan sistem spaced repetition, sehingga saya dapat mengingat materi pembelajaran dalam jangka panjang secara efisien.

#### Acceptance Criteria

1. THE System SHALL mendukung model `Flashcard` dengan field: `id` (uuid), `userId` (uuid FK → User), `noteId` (uuid FK → UserNote, nullable — flashcard dapat dibuat dari catatan atau standalone), `front` (text — sisi pertanyaan), `back` (text — sisi jawaban), `nextReviewAt` (timestamptz — kapan kartu ini berikutnya jatuh tempo), `interval` (integer — hari sampai review berikutnya, field SM-2), `easeFactor` (float — SM-2 ease factor, nilai awal 2.5), `repetitions` (integer — hitungan repetisi SM-2, awal 0), `createdAt`.
2. THE endpoint `POST /api/flashcards` (auth required) SHALL membuat flashcard. Body: `{ noteId?, front, back }`. IF `noteId` disediakan, `front` default ke `highlightText` catatan dan `back` ke `noteContent` jika tidak disediakan.
3. THE endpoint `GET /api/flashcards` (auth required) SHALL mengembalikan semua flashcard milik user saat ini.
4. THE endpoint `GET /api/flashcards/review` (auth required) SHALL mengembalikan flashcard di mana `nextReviewAt <= now()`, diurutkan berdasarkan `nextReviewAt ASC`.
5. THE endpoint `POST /api/flashcards/:id/review` (auth required) SHALL menerima `{ rating: 1 | 2 | 3 | 4 }` dan menerapkan algoritma SM-2: Rating 1 (Again): reset `repetitions = 0`, `interval = 1`; Rating 2 (Hard): `interval = max(1, interval * 1.2)`, `easeFactor = max(1.3, easeFactor - 0.15)`; Rating 3 (Good): jika `repetitions == 0` → `interval = 1`; jika `repetitions == 1` → `interval = 6`; selain itu `interval = round(interval * easeFactor)`; Rating 4 (Easy): sama seperti Good tapi `easeFactor = easeFactor + 0.1`; Selalu: `repetitions += 1` (kecuali rating 1 mereset), `nextReviewAt = now + interval days`.
6. THE endpoint `DELETE /api/flashcards/:id` (auth required) SHALL menghapus flashcard.
7. THE `FlashcardsPage` di `/learning/flashcards` SHALL: menampilkan jumlah kartu yang jatuh tempo secara menonjol; menyajikan satu kartu jatuh tempo sekaligus (sisi depan saja pada awalnya); WHEN kartu diklik atau tombol "Reveal" ditekan THE System SHALL membalik kartu dengan animasi CSS 3D card-flip untuk menampilkan sisi belakang; setelah reveal, empat tombol rating muncul (1 Again / 2 Hard / 3 Good / 4 Easy); WHEN rating dikirim THE System SHALL menghapus kartu dari sesi review saat ini dan menampilkan kartu berikutnya; WHEN tidak ada kartu jatuh tempo THE System SHALL menampilkan pesan "All done for now!" beserta waktu review berikutnya; setiap kartu memiliki tautan "View source" yang menavigasi ke module dan men-scroll ke highlight anchor.
8. THE badge jumlah kartu jatuh tempo SHALL muncul di sebelah tautan "Flashcards" pada navigasi seksi Learning.

---

### Requirement 9: Admin Learning Management

**User Story:** Sebagai Admin, saya ingin mengelola modul dan learning path melalui dashboard, sehingga saya dapat mengkurasi konten pembelajaran dengan mudah.

#### Acceptance Criteria

1. THE `ModulesAdminPage` di `/admin/learning/modules` SHALL menampilkan tabel semua module (draft + published) dengan: title, status badge, jumlah prerequisit, tanggal update, dan aksi (edit, hapus, publish/unpublish).
2. THE `ModuleEditorPage` di `/admin/learning/modules/new` dan `/admin/learning/modules/:id/edit` SHALL menyediakan: field title dan summary; block editor yang menampilkan blok `contentJson` saat ini sebagai list yang dapat di-drag menggunakan `@dnd-kit/sortable`; setiap baris blok menampilkan type dan ringkasan konten dengan tombol edit (membuka form inline) dan hapus; tombol "Add Block" untuk setiap type; form edit inline per type (markdown: textarea + live preview; fill-blank: template input + answer input; slider-viz: equation input + daftar param dinamis; code-runner: language selector + starter code editor + description textarea); prerequisite multi-select menggunakan shadcn `Command` yang menampilkan semua published module.
3. WHEN menyimpan prerequisit di admin editor, THE frontend SHALL mengirim setiap edge baru via `POST /api/modules/:id/prerequisites` dan menghapus edge yang dihapus via `DELETE /api/modules/:id/prerequisites/:prereqId`. IF `CYCLE_DETECTED` 400 error terjadi, THEN THE System SHALL menampilkan pesan error inline kepada admin.
4. THE `PathsAdminPage` di `/admin/learning/paths` SHALL mengizinkan: membuat dan menghapus learning path; mengedit path: drag module ke dalam sekuens terurut menggunakan `@dnd-kit/sortable`; setiap module dalam sekuens ditampilkan dengan title dan tombol hapus.
5. THE navigasi sidebar dashboard admin SHALL menyertakan tautan ke `/admin/learning/modules` dan `/admin/learning/paths`.
6. THE endpoint `GET /api/admin/stats` SHALL diperbarui untuk menyertakan `totalModules`.
7. THE kartu statistik di dashboard SHALL menampilkan `totalModules`.
