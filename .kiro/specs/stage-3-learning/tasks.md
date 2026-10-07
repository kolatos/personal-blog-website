# Implementation Plan

## Overview

8 task mencakup: skema DB inti + Module API backend (Task 20), digraf UI (Task 21), renderer module + sistem widget (Task 22), widget code runner + backend proxy (Task 23), admin module editor (Task 24), anotasi teks + catatan (Task 25), sistem flashcard (Task 26), dan pembaruan landing page + dashboard (Task 27).

Task dinomori melanjutkan dari Stage 2 (yang berakhir di Task 19) untuk keterlacakan antar stage.

**Prerequisites**: Semua task Stage 1 dan Stage 2 selesai. Sistem komentar generik, `MarkdownRenderer`, shadcn/ui, React Router, dan seluruh infrastruktur navigasi admin sudah tersedia.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["20"] },
    { "id": 1, "tasks": ["21", "22"] },
    { "id": 2, "tasks": ["23"] },
    { "id": 3, "tasks": ["24"] },
    { "id": 4, "tasks": ["25"] },
    { "id": 5, "tasks": ["26"] },
    { "id": 6, "tasks": ["27"] }
  ]
}
```

## Tasks

- [ ] 20. Learning — DB schema + Module and Path API (backend)
  - Objective: Semua model data inti dan endpoint API untuk sistem learning
  - Tambahkan model berikut ke `prisma/schema.prisma`: `Module`, `ModulePrereq`, `LearningPath`, `PathModule`, `UserProgress` sesuai definisi di design document
  - Jalankan `npx prisma migrate dev --name add_learning_core`; jalankan `npx prisma generate`
  - Buat `schemas/module.schema.ts` — Zod schema untuk create/update (title, summary wajib; contentJson adalah `z.array(z.object({ type: z.string(), data: z.unknown() }))`); schema prerequisit edge; schema path
  - **Cycle detection utility** di `services/module.service.ts`:
    - `detectCycle(moduleId, newPrereqId, allEdges)` — BFS/DFS dari `newPrereqId` mengikuti prerequisit edge ke depan; jika `moduleId` dapat dicapai, itu adalah siklus; pure function, dapat diuji secara terpisah
  - Buat `services/module.service.ts`:
    - `createModule(data)` — generasi slug, status `draft`
    - `updateModule(id, data)` — regenerasi slug jika title berubah; published → draft saat update
    - `deleteModule(id)`
    - `publishModule(id)` / `unpublishModule(id)` — 409 pada transisi duplikat
    - `getModulesForUser(userId)` — mengembalikan semua published module + semua edge + status penyelesaian per user
    - `getModuleBySlug(slug, userId)` — module lengkap termasuk `contentJson` + status penyelesaian; 404 untuk draft
    - `addPrerequisite(moduleId, prereqId)` — jalankan cycle detection terlebih dahulu; throw 400 `CYCLE_DETECTED` jika siklus ditemukan
    - `removePrerequisite(moduleId, prereqId)`
    - `markComplete(userId, moduleId)` — 409 jika sudah selesai
    - `unmarkComplete(userId, moduleId)` — 404 jika belum selesai
  - Buat `services/path.service.ts`:
    - `getAllPaths(userId)` — mengembalikan path beserta ordered module + status penyelesaian per module
    - `createPath(data)`, `updatePath(id, data)`, `deletePath(id)`
    - `setPathModules(pathId, modules: { moduleId, order }[])` — mengganti seluruh daftar dalam transaksi
  - Buat `controllers/module.controller.ts`, `controllers/path.controller.ts`
  - Buat `routes/module.routes.ts` di `/api/modules`, `routes/path.routes.ts` di `/api/paths`; mount di `app.ts`
  - Update `GET /api/admin/stats` untuk menyertakan `totalModules`
  - Unit test: `detectCycle` — tidak ada siklus pada chain sederhana; mendeteksi siklus langsung (A→B, tambah B→A); mendeteksi siklus tidak langsung (A→B→C, tambah C→A)
  - Integration test: buat dua module, tambah prerequisit edge → `GET /api/modules` mengembalikan edge; tambah edge balik → 400 `CYCLE_DETECTED`
  - Integration test: `POST /api/modules/:id/complete` → 201; panggil kedua → 409; `DELETE` → 204; `DELETE` lagi → 404
  - Integration test: `GET /api/paths` mengembalikan path beserta ordered module + status penyelesaian
  - Integration test: publish module → `GET /api/modules` menyertakannya; unpublish → dihapus dari daftar
  - Integration test: komentar dengan `contentType: 'module'` → 201
  - **Files:** `backend/prisma/schema.prisma`, `backend/src/schemas/module.schema.ts`, `backend/src/services/module.service.ts`, `backend/src/services/path.service.ts`, `backend/src/controllers/module.controller.ts`, `backend/src/controllers/path.controller.ts`, `backend/src/routes/module.routes.ts`, `backend/src/routes/path.routes.ts`, `backend/src/app.ts`, `backend/src/controllers/stats.controller.ts`
  - **Requires:** (none)

- [ ] 21. Learning — Digraph UI (frontend)
  - Objective: Graf module dirender dengan React Flow; path highlighting; route yang dijaga
  - Instal: `npm install reactflow` di `frontend/`
  - Instal: `npm install dagre @types/dagre` di `frontend/`
  - Tambahkan tipe `Module`, `ModuleEdge`, `LearningPath` ke `frontend/src/types/index.ts`
  - Buat `api/modules.ts` dan `api/paths.ts` dengan fungsi API yang sudah di-type
  - Buat hook `hooks/useModules.ts` dan `hooks/useProgress.ts` menggunakan React Query
  - **`ModuleNode`** custom React Flow node di `components/learning/ModuleNode.tsx`:
    - Menampilkan title dan summary module (dipotong)
    - Warna latar: gray (`bg-muted`) = belum selesai; green (`bg-green-100 dark:bg-green-900`) = selesai
    - Outline yang disorot (`ring-2 ring-primary`) ketika module node termasuk path yang dipilih
    - Mengklik node menavigasi ke `/learning/:slug` via React Router `useNavigate`
  - **`LearningPage`** di `pages/learning/LearningPage.tsx`:
    - Route dijaga: jika `!user` → `<Navigate to="/login" />`
    - Mengambil `GET /api/modules` dan `GET /api/paths`
    - Mengubah data API menjadi React Flow `nodes[]` dan `edges[]`:
      - `nodes`: satu per module, posisi di-layout otomatis menggunakan `dagre.layout()` dengan `rankdir: 'TB'`, `nodesep: 60`, `ranksep: 80`; setiap node 180×60 px
      - `edges`: satu per `ModuleEdge`, animated, arrow marker
    - Merender `<ReactFlow>` dengan `fitView`, `zoomOnScroll`, `panOnDrag`
    - Sidebar kiri: `PathSidebar` yang mendaftarkan semua path; mengklik path mengatur state `selectedPathId` → node dalam path tersebut mendapatkan ring yang disorot
    - Tampilkan loading skeleton saat data dimuat
  - **`PathSidebar`** di `components/learning/PathSidebar.tsx`:
    - Mendaftarkan path sebagai baris yang dapat diklik; path yang dipilih disorot
    - Menampilkan fraksi progres untuk path yang dipilih (misalnya "3/7 completed")
  - Update `App.tsx` dengan route `/learning` → `<LearningPage>` (dilindungi auth); update `Navbar` untuk mengaktifkan tautan Learning (hapus badge "coming soon"); update Learning CTA di `LandingPage` untuk menautkan ke `/learning`
  - Component test: diberikan 3 mock module dengan 2 edge, React Flow merender 3 node dan 2 edge
  - Component test: node module yang selesai memiliki class hijau; yang belum selesai memiliki class muted
  - Component test: memilih path hanya menyorot node module dari path tersebut
  - Component test: user yang tidak terotentikasi diarahkan ke `/login`
  - **Files:** `frontend/src/types/index.ts`, `frontend/src/api/modules.ts`, `frontend/src/api/paths.ts`, `frontend/src/hooks/useModules.ts`, `frontend/src/hooks/useProgress.ts`, `frontend/src/components/learning/ModuleNode.tsx`, `frontend/src/components/learning/PathSidebar.tsx`, `frontend/src/pages/learning/LearningPage.tsx`, `frontend/src/App.tsx`, `frontend/src/components/layout/Navbar.tsx`, `frontend/src/pages/public/LandingPage.tsx`
  - **Requires:** 20

- [ ] 22. Learning — Module renderer + initial widgets (frontend)
  - Objective: `ModuleDetailPage` merender blok via widget registry; 3 tipe widget awal; tombol complete; seksi komentar
  - Instal: `npm install mathjs recharts` di `frontend/`
  - **Widget registry** di `components/learning/widgets/registry.tsx`:
    ```tsx
    import type { ComponentType } from 'react';
    export type BlockData = Record<string, unknown>;
    export type WidgetProps = { data: BlockData };
    export const widgetRegistry: Record<string, ComponentType<WidgetProps>> = {};
    export function registerWidget(type: string, component: ComponentType<WidgetProps>) {
      widgetRegistry[type] = component;
    }
    ```
  - **`MarkdownBlock`** di `components/learning/widgets/MarkdownBlock.tsx`:
    - Merender `data.content` via `<MarkdownRenderer>` — menggunakan kembali komponen Stage 1
    - Mendaftarkan diri di `widgetRegistry` sebagai `'markdown'`
  - **`FillBlankBlock`** di `components/learning/widgets/FillBlankBlock.tsx`:
    - Mem-parse `data.template`: memisahkan pada `[___]`, merender bagian teks + `<Input>` di antaranya
    - Tombol "Check": membandingkan input (trimmed, case-insensitive) dengan `data.answer`
    - Feedback: shadcn `Badge` hijau "Correct!" atau merah `Badge` "Try again" — tidak mengungkapkan jawaban
    - Mendaftarkan sebagai `'fill-blank'`
  - **`SliderVizBlock`** di `components/learning/widgets/SliderVizBlock.tsx`:
    - Mem-parse array `data.params`; setiap param memiliki `<input type="range">` sendiri dengan label dan tampilan nilai saat ini
    - Mengevaluasi `data.equation` menggunakan `mathjs` `compile` + `evaluate` dengan nilai param saat ini — **tidak pernah `eval()`**
    - Menghitung 200 sample point x atas rentang yang sesuai (misalnya -10 hingga 10 atau dapat dikonfigurasi) dan memetakannya ke data `{ x, y }`
    - Merender via `recharts` `LineChart` → `Line` dengan computed points
    - Chart me-render ulang pada setiap perubahan slider (controlled state per nilai param)
    - Mendaftarkan sebagai `'slider-viz'`
  - **Fallback blok yang tidak dikenal**: jika tipe blok tidak ada di registry, merender `<div className="text-muted-foreground text-sm p-4 border rounded">Unknown block type: {type}</div>`
  - **`ModuleDetailPage`** di `pages/learning/ModuleDetailPage.tsx`:
    - Route: `/learning/:slug` — dilindungi auth
    - Mengambil `GET /api/modules/:slug`
    - Mengiterasi blok `module.contentJson`, mencari setiap blok di `widgetRegistry`, merender komponen
    - Tombol "Mark as Complete": jika `completedAt` ada → disabled "Completed ✓"; jika tidak → memanggil `POST /api/modules/:id/complete` saat diklik → refetch module
    - Seksi komentar di bagian bawah: `<CommentList>` + `<CommentForm>` dengan `contentType="module"` dan `contentId={module.id}`
    - `NotesPanel` yang dapat dilipat (stub untuk sekarang — implementasi penuh di Task 25)
    - Progress bar: jika user bernavigasi dari path (pass `pathId` sebagai query param), ambil module path tersebut dan tampilkan `X of Y completed` menggunakan shadcn progress indicator
  - Component test: `MarkdownBlock` dengan `data.content = "# Hello $x^2$"` → merender heading + KaTeX span
  - Component test: `FillBlankBlock` — jawaban benar → badge hijau; jawaban salah → badge merah; jawaban tidak diungkap
  - Component test: `SliderVizBlock` — mengubah nilai slider memperbarui data chart (cek prop `data` recharts)
  - Component test: tipe blok yang tidak dikenal merender fallback tanpa throw
  - Component test: `ModuleDetailPage` — tombol "Mark as Complete" memanggil API; menjadi disabled setelah berhasil
  - **Files:** `frontend/src/components/learning/widgets/registry.tsx`, `frontend/src/components/learning/widgets/MarkdownBlock.tsx`, `frontend/src/components/learning/widgets/FillBlankBlock.tsx`, `frontend/src/components/learning/widgets/SliderVizBlock.tsx`, `frontend/src/pages/learning/ModuleDetailPage.tsx`
  - **Requires:** 20

- [ ] 23. Code runner widget + backend proxy (frontend + backend)
  - Objective: Eksekusi kode di dalam module via Judge0 REST API
  - **Backend**:
    - Buat `src/lib/judge0.ts` — constants file dengan pemetaan nama bahasa ke Judge0 language ID:
      ```ts
      export const JUDGE0_LANGUAGE_IDS: Record<string, number> = {
        python: 71, typescript: 74, java: 62,
        csharp: 51, haskell: 61, rust: 73, r: 80,
      };
      ```
    - Buat `routes/run-code.routes.ts` yang di-mount di `/api/run-code`:
      - `POST /` — `authenticateJWT` + rate limiter per-user (20 req/menit dikeykan berdasarkan `req.user.id`) + handler
      - Logika handler: (1) validasi body: `{ language, sourceCode, stdin? }` via Zod; (2) cari language ID dari `JUDGE0_LANGUAGE_IDS`; bahasa tidak dikenal → 400 `UNSUPPORTED_LANGUAGE`; (3) jika `JUDGE0_API_KEY` tidak ada → 503 `CODE_EXECUTION_UNAVAILABLE`; (4) POST ke Judge0 `submissions/?base64_encoded=false&wait=false`; (5) polling `submissions/:token?base64_encoded=false` setiap 1 detik sampai status `id >= 3` (selesai) atau timeout 10 detik; (6) kembalikan `{ stdout, stderr, status: statusDescription }`
    - Mount `/api/run-code` di `app.ts`
    - Integration test: `POST /api/run-code` dengan mocked Judge0 response — mengembalikan stdout yang benar
    - Integration test: bahasa tidak didukung → 400
    - Integration test: `JUDGE0_API_KEY` tidak ada → 503
    - Integration test: request ke-21 dalam 1 menit dari user yang sama → 429
  - **Frontend**:
    - Instal: `npm install @uiw/react-codemirror @codemirror/lang-python @codemirror/lang-java @codemirror/lang-rust` (dan paket bahasa lain yang diperlukan) di `frontend/`
    - Tambahkan `api/runCode.ts` dengan fungsi `runCode({ language, sourceCode, stdin? })` yang sudah di-type
    - **`CodeRunnerBlock`** di `components/learning/widgets/CodeRunnerBlock.tsx`:
      - Merender `data.description` jika ada (via `MarkdownRenderer`)
      - Pemilih bahasa: shadcn `Select` menampilkan bahasa yang didukung; pre-selected dari `data.language`
      - Editor `@uiw/react-codemirror` pre-filled dengan `data.starterCode`; language extension berubah dengan selector
      - Tombol "Run" — disabled saat berjalan; menampilkan spinner
      - Status indicator (`Badge`): idle (muted) / running (kuning) / success (hijau) / error (merah)
      - Panel output: monospace `<pre>` menampilkan stdout; monospace `<pre>` merah menampilkan stderr jika ada
      - Mendaftarkan sebagai `'code-runner'` di widget registry
    - Component test: tombol "Run" disabled saat `isRunning` true; diaktifkan kembali setelah selesai
    - Component test: stdout ditampilkan di panel output setelah mock API response; stderr ditampilkan dengan warna merah
    - Component test: memilih bahasa berbeda memperbarui language extension editor
  - **Files:** `backend/src/lib/judge0.ts`, `backend/src/routes/run-code.routes.ts`, `backend/src/app.ts`, `frontend/src/api/runCode.ts`, `frontend/src/components/learning/widgets/CodeRunnerBlock.tsx`
  - **Requires:** 22

- [ ] 24. Admin — Learning Module Editor and Path Manager (frontend)
  - Objective: Admin dapat membuat module dengan block editor dan mengelola learning path
  - **`ModulesAdminPage`** di `pages/admin/ModulesAdminPage.tsx`:
    - Mengambil daftar module admin (semua status)
    - shadcn `Table`: title, status `Badge`, jumlah prerequisit, tanggal update, tombol aksi (edit, publish/unpublish, hapus)
    - Hapus menggunakan `AlertDialog`
    - Tombol "New Module" → `/admin/learning/modules/new`
  - **`ModuleEditorPage`** di `pages/admin/ModuleEditorPage.tsx` (menangani create dan edit):
    - `Input` title + `Input` summary
    - **Block editor**:
      - Merender blok `contentJson` saat ini sebagai draggable list via `@dnd-kit/sortable`
      - Setiap baris blok: drag handle, label type, preview singkat konten, tombol edit (membuka form inline), tombol hapus
      - Dropdown "Add Block" (`DropdownMenu`): opsi untuk setiap tipe blok
      - **Form edit inline per type**:
        - `markdown`: shadcn `Textarea` + `MarkdownRenderer` live preview berdampingan
        - `fill-blank`: `Input` template (menampilkan placeholder `[___]`) + `Input` jawaban + preview yang dirender
        - `slider-viz`: `Input` equation + daftar param dinamis (setiap param: name, min, max, step, default — tambah/hapus baris)
        - `code-runner`: `Select` bahasa + `@uiw/react-codemirror` untuk starter code + `Textarea` description
    - **Pemilih prerequisit**:
      - shadcn `Command` (dapat dicari) yang mendaftarkan semua published module
      - Prerequisit yang dipilih ditampilkan sebagai chip `Badge` dengan tombol `×` hapus
      - Saat simpan: diff daftar prereq saat ini vs. asli; panggil `POST /api/modules/:id/prerequisites` untuk penambahan dan `DELETE /api/modules/:id/prerequisites/:prereqId` untuk penghapusan
      - Error 400 `CYCLE_DETECTED` ditampilkan sebagai inline error alert
    - Tombol simpan: validasi title + summary non-kosong; panggil API create atau update; tampilkan toast saat berhasil
  - **`PathsAdminPage`** di `pages/admin/PathsAdminPage.tsx`:
    - Mendaftarkan semua path dalam shadcn `Table`; "New Path" membuka `Dialog` (title + description)
    - Mengklik path membuka side panel atau memperluas baris:
      - Draggable module list menggunakan `@dnd-kit/sortable`: setiap baris menampilkan title module + tombol hapus
      - Typeahead "Add module" (`Command`) untuk mencari dan menambahkan module ke path
      - Tombol simpan memanggil `PUT /api/paths/:id/modules` dengan seluruh daftar terurut
    - Hapus path menggunakan `AlertDialog`
  - Tambahkan route ke `App.tsx`: `/admin/learning/modules`, `/admin/learning/modules/new`, `/admin/learning/modules/:id/edit`, `/admin/learning/paths` (semua dilindungi admin)
  - Update navigasi sidebar admin untuk menyertakan tautan seksi Learning
  - Component test: block editor — menambah markdown block menambahkannya ke daftar; drag mengubah urutan; hapus menghapusnya
  - Component test: prereq selector — memilih module menambahkannya sebagai chip; menghapusnya menghilangkan chip
  - Component test: cycle error dari API merender inline error alert
  - Component test: path editor — menambah module ke sekuens memperbarui daftar; drag mengubah urutan; simpan memanggil API dengan urutan yang benar
  - **Files:** `frontend/src/pages/admin/ModulesAdminPage.tsx`, `frontend/src/pages/admin/ModuleEditorPage.tsx`, `frontend/src/pages/admin/PathsAdminPage.tsx`, `frontend/src/App.tsx`, `frontend/src/components/layout/Navbar.tsx`
  - **Requires:** 20, 22, 23

- [ ] 25. Learning — Text annotations and notes system (frontend + backend)
  - Objective: User menyeleksi teks dalam module dan melampirkan catatan personal dengan highlight yang persisten
  - **Backend**:
    - Tambahkan model `UserNote` ke `prisma/schema.prisma` sesuai definisi di design document
    - Jalankan `npx prisma migrate dev --name add_user_notes`; jalankan `npx prisma generate`
    - Buat `schemas/note.schema.ts` — Zod: `moduleId` uuid wajib, `highlightText` string non-kosong, `anchorData` object dengan field `startXPath`, `startOffset`, `endXPath`, `endOffset`, `noteContent` string
    - Buat `services/note.service.ts`: `createNote`, `getNotesByModule(userId, moduleId)`, `updateNote(id, userId, data)` (403 jika user salah), `deleteNote(id, userId)` (403 jika user salah)
    - Buat `controllers/note.controller.ts` dan `routes/note.routes.ts` di `/api/notes` (semua memerlukan auth):
      - `POST /`
      - `GET /?moduleId=`
      - `PUT /:id`
      - `DELETE /:id`
    - Mount di `app.ts`
    - Integration test: buat catatan → `GET /api/notes?moduleId=` mengembalikannya
    - Integration test: user A tidak dapat update/delete catatan user B → 403
    - Integration test: hapus module → cascade ke catatan
  - **Frontend**:
    - Buat `utils/anchorUtils.ts` dengan:
      - `serializeRange(range: Range, container: Element): AnchorData` — mengonversi DOM `Range` ke XPath-based `{ startXPath, startOffset, endXPath, endOffset }`
      - `deserializeRange(anchor: AnchorData, container: HTMLElement): Range | null` — merekonstruksi `Range` dari anchor tersimpan dalam element container yang diberikan; mengembalikan null jika node tidak ditemukan
      - `getXPath(node: Node, container: Element): string` — mengembalikan XPath dari `node` relatif terhadap `container`
      - `getNodeByXPath(xpath: string, container: Element): Node | null`
    - Buat `hooks/useTextSelection.ts`:
      - Menerima `containerRef: RefObject<HTMLElement>`
      - Mendengarkan event `mouseup` pada container
      - Jika `window.getSelection()` memiliki range yang tidak collapsed dalam container, mengatur state `selectedRange`
      - Mengekspos `selectedRange`, `clearSelection()`
    - Buat `api/notes.ts` dan `hooks/useNotes.ts` menggunakan React Query
    - **Selection popup**:
      - shadcn `Popover` yang muncul dekat seleksi ketika `selectedRange` diatur
      - Menampilkan preview teks yang diseleksi (dipotong)
      - `Textarea` untuk konten catatan opsional
      - Tombol "Save": memanggil `serializeRange` → `POST /api/notes` → saat berhasil menerapkan highlight `<mark>` dan menutup popup; invalidate query catatan
      - Tombol "Cancel": membersihkan seleksi
    - **Re-highlighting saat dimuat** (di `ModuleDetailPage`):
      - Saat data catatan dimuat: untuk setiap catatan, panggil `deserializeRange(note.anchorData, contentContainerRef.current)` → jika berhasil, bungkus node teks range dalam elemen `<mark data-note-id={note.id}>` dengan latar belakang kuning
      - Elemen `<mark>` yang ada harus dibersihkan sebelum di-re-apply (idempotent)
    - **`NotesPanel`** di `components/learning/NotesPanel.tsx` (menggantikan stub dari Task 22):
      - Collapsible sidebar/drawer (shadcn `Sheet` atau collapsible `div`)
      - Mendaftarkan semua catatan untuk module saat ini dari `useNotes`
      - Setiap catatan menampilkan `highlightText` (dipotong), `noteContent`, tombol edit (inline `Textarea`) dan hapus
      - Hapus menggunakan `AlertDialog`; edit menyimpan via `PUT /api/notes/:id`
      - Mengklik catatan: memanggil `deserializeRange` → scroll ke highlight menggunakan `element.scrollIntoView()`
    - Update `ModuleDetailPage` untuk menggunakan `NotesPanel` yang sesungguhnya dan selection popup
    - Unit test: `serializeRange` → `deserializeRange` round-trip: diberikan mock DOM tree, serialisasi dan deserialisasi menghasilkan range dengan start/end node dan offset yang sama
    - Unit test: `getXPath` mengembalikan string XPath valid yang `getNodeByXPath` dapat resolve kembali ke node yang sama
    - Component test: selection popup muncul setelah mock `mouseup` dengan seleksi; Save memanggil `POST /api/notes`; Cancel membersihkan state
    - Component test: `NotesPanel` — mengklik catatan memanggil `scrollIntoView`; hapus menampilkan AlertDialog
  - **Files:** `backend/prisma/schema.prisma`, `backend/src/schemas/note.schema.ts`, `backend/src/services/note.service.ts`, `backend/src/controllers/note.controller.ts`, `backend/src/routes/note.routes.ts`, `backend/src/app.ts`, `frontend/src/utils/anchorUtils.ts`, `frontend/src/hooks/useTextSelection.ts`, `frontend/src/api/notes.ts`, `frontend/src/hooks/useNotes.ts`, `frontend/src/components/learning/NotesPanel.tsx`, `frontend/src/pages/learning/ModuleDetailPage.tsx`
  - **Requires:** 20, 22

- [ ] 26. Learning — Flashcard system (frontend + backend)
  - Objective: User membuat flashcard dari catatan dan mereviewnya dengan SM-2 spaced repetition
  - **Backend**:
    - Tambahkan model `Flashcard` ke `prisma/schema.prisma` sesuai definisi di design document
    - Jalankan `npx prisma migrate dev --name add_flashcards`; jalankan `npx prisma generate`
    - Buat `lib/sm2.ts` (pure function, tanpa Prisma):
      ```ts
      export function applyRating(card: SM2Card, rating: 1|2|3|4): SM2Card & { nextReviewAt: Date } {
        // Mengimplementasikan algoritma SM-2 sesuai spesifikasi di Requirement 8.5
        // Mengembalikan { interval, easeFactor, repetitions, nextReviewAt } yang diperbarui
      }
      ```
    - Buat `schemas/flashcard.schema.ts` — rating: `z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4)])`
    - Buat `services/flashcard.service.ts`: `createFlashcard`, `getUserFlashcards(userId)`, `getDueFlashcards(userId)`, `reviewFlashcard(id, userId, rating)` (memanggil `applyRating`, memperbarui DB), `deleteFlashcard(id, userId)`
    - Buat `controllers/flashcard.controller.ts` dan `routes/flashcard.routes.ts` di `/api/flashcards`:
      - `POST /` (auth)
      - `GET /` (auth)
      - `GET /review` (auth)
      - `POST /:id/review` (auth)
      - `DELETE /:id` (auth)
    - Mount di `app.ts`
    - Unit test `applyRating`: rating 1 → interval reset ke 1, repetitions reset ke 0; rating 3 pada 0 reps → interval 1; rating 3 pada 2 reps → interval = round(prev * easeFactor); rating 4 → easeFactor bertambah 0.1; easeFactor tidak pernah turun di bawah 1.3
    - Integration test: buat flashcard dari catatan → `front` default ke `highlightText`; `GET /review` mengembalikannya (nextReviewAt = now); submit rating 3 → nextReviewAt maju sesuai interval hari; submit rating 1 → interval reset
  - **Frontend**:
    - Tambahkan tipe `Flashcard` ke `frontend/src/types/index.ts`
    - Buat `api/flashcards.ts` dan `hooks/useFlashcards.ts`
    - **Tombol "Create Flashcard" di `NotesPanel`**: untuk setiap catatan, tambahkan tombol "Create Flashcard" yang memanggil `POST /api/flashcards` dengan `noteId`, `front = highlightText`, `back = noteContent`; tampilkan toast saat berhasil
    - **`FlashcardsPage`** di `pages/learning/FlashcardsPage.tsx`:
      - Route: `/learning/flashcards` (dilindungi auth)
      - Mengambil `GET /api/flashcards/review`
      - Menampilkan jumlah kartu jatuh tempo: "X cards to review"
      - UI card flip:
        - Wrapper `perspective-1000` dengan inner div `transform-style-preserve-3d`
        - Sisi depan: `data.front` dirender via `MarkdownRenderer`
        - Sisi belakang: `data.back` dirender via `MarkdownRenderer` (dirotasi 180deg pada Y-axis)
        - Tombol "Reveal" → menambahkan class `rotate-y-180` ke inner div; mengungkapkan tombol rating
        - Tombol rating (1–4) berlabel "Again / Hard / Good / Easy": memanggil `POST /api/flashcards/:id/review`; maju ke kartu jatuh tempo berikutnya
      - Tautan "View source": jika `flashcard.noteId` ada, menautkan ke `/learning/:moduleSlug?noteId=:noteId` untuk scroll ke highlight
      - Ketika tidak ada kartu jatuh tempo: menampilkan pesan "All done! Next review: {date}"
    - **Due badge**: di `ModuleDetailPage` atau navigasi learning, tampilkan count badge pada tautan Flashcards jika `useFlashcards` mengembalikan kartu yang jatuh tempo
    - Tambahkan route `/learning/flashcards` ke `App.tsx`
    - Component test: `FlashcardsPage` menampilkan sisi depan saja awalnya; "Reveal" menampilkan sisi belakang dan tombol rating
    - Component test: tombol rating memanggil API dengan rating yang benar; maju ke kartu berikutnya
    - Component test: ketika daftar review kosong, pesan "All done!" ditampilkan
    - Component test: count badge menampilkan jumlah yang benar
  - **Files:** `backend/prisma/schema.prisma`, `backend/src/lib/sm2.ts`, `backend/src/schemas/flashcard.schema.ts`, `backend/src/services/flashcard.service.ts`, `backend/src/controllers/flashcard.controller.ts`, `backend/src/routes/flashcard.routes.ts`, `backend/src/app.ts`, `frontend/src/types/index.ts`, `frontend/src/api/flashcards.ts`, `frontend/src/hooks/useFlashcards.ts`, `frontend/src/components/learning/NotesPanel.tsx`, `frontend/src/pages/learning/FlashcardsPage.tsx`, `frontend/src/App.tsx`
  - **Requires:** 25

- [ ] 27. Admin dashboard + Learning navigation finalization
  - Objective: Dashboard diperbarui dengan statistik module; navigasi admin Learning lengkap; Learning CTA di landing page aktif
  - **Dashboard**:
    - `GET /api/admin/stats` sudah mengembalikan `totalModules` (ditambahkan di Task 20) — task ini menyambungkannya ke UI
    - Tambahkan stat card `totalModules` ke `DashboardPage`
    - Sidebar admin harus menyertakan seksi "Learning" dengan tautan ke: Modules (`/admin/learning/modules`), Paths (`/admin/learning/paths`)
  - **Navigasi learning di frontend**:
    - Tambahkan sub-nav learning ke `ModuleDetailPage` dan `LearningPage`: tautan ke "Module Graph" (`/learning`), "Flashcards" (`/learning/flashcards`), due badge pada tautan Flashcards
    - Route `/learning/flashcards` ditambahkan ke `App.tsx` (dilindungi auth)
  - **Learning CTA di landing page** (memperbarui stub dari Task 21):
    - Ganti "Coming soon" statis dengan: teks deskripsi + `Button` shadcn "Explore Learning" yang menautkan ke `/learning`
    - Hanya tampilkan tombol jika user terotentikasi; jika tidak, tampilkan "Sign up to access"
  - **Tautan Learning di Navbar**:
    - Pastikan badge "Soon" telah dihapus (dilakukan di Task 21 — verifikasi); pastikan tautan menautkan dengan benar ke `/learning`
  - Component test: dashboard merender stat card `totalModules` dengan nilai yang benar dari mock data
  - Component test: landing page Learning CTA menampilkan tombol "Explore Learning" untuk user terotentikasi; "Sign up to access" untuk visitor
  - Integration test: response `GET /api/admin/stats` menyertakan semua counter: `totalPosts`, `totalComments`, `totalUsers`, `totalProjects`, `totalFunPosts`, `totalModules`
  - **Files:** `frontend/src/pages/admin/DashboardPage.tsx`, `frontend/src/pages/learning/LearningPage.tsx`, `frontend/src/pages/learning/ModuleDetailPage.tsx`, `frontend/src/pages/public/LandingPage.tsx`, `frontend/src/App.tsx`, `frontend/src/components/layout/Navbar.tsx`
  - **Requires:** 20, 21, 22, 23, 24, 25, 26


## Notes

- Task 20 tidak memiliki dependensi dan merupakan fondasi untuk semua task berikutnya — berisi semua model DB dan endpoint API.
- Task 21 (Digraph UI) dan Task 22 (Module renderer + widget awal) dapat dikerjakan secara paralel setelah Task 20 selesai karena keduanya hanya bergantung pada API dari Task 20.
- Task 23 (Code runner widget) bergantung pada Task 22 karena widget registry harus sudah ada sebelum `CodeRunnerBlock` dapat mendaftarkan diri.
- Task 24 (Admin module editor) bergantung pada Task 20 untuk API, dan Task 22 + 23 agar semua tipe widget tersedia untuk form edit inline.
- Task 25 (Notes system) memerlukan Task 20 untuk model `UserNote` di backend, dan Task 22 karena implementasi penuh `NotesPanel` menggantikan stub yang dibuat di Task 22.
- Task 26 (Flashcard system) bergantung pada Task 25 karena model `Flashcard` mempunyai FK opsional ke `UserNote`, dan tombol "Create Flashcard" ada di `NotesPanel`.
- Task 27 (Dashboard finalization) bergantung pada semua task sebelumnya karena menyatukan statistik, navigasi, dan CTA.
- Migrasi harus dijalankan dalam urutan: `add_learning_core` → `add_user_notes` → `add_flashcards`.
- `@dnd-kit/core` dan `@dnd-kit/sortable` sudah diinstal di Stage 2 (Task 15) — tidak perlu diinstal ulang.
- SM-2 diimplementasikan sebagai pure function di `backend/src/lib/sm2.ts` — dapat diuji sepenuhnya tanpa database maupun Prisma.
- Cycle detection diimplementasikan sebagai pure function yang diekspor dari `module.service.ts` — unit test-nya tidak memerlukan koneksi database.
- Widget registry menggunakan pola open-closed: setiap task yang menambah widget hanya perlu membuat satu file baru + satu baris import di `ModuleDetailPage` — tidak ada perubahan pada `ModuleDetailPage` itu sendiri selain penambahan import.
