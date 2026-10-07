# Tech Stack

## Backend (`backend/`)

| Concern | Choice |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express |
| ORM / DB access | Prisma |
| Database | PostgreSQL |
| Auth | JWT (`jsonwebtoken`) + bcrypt (cost 12) |
| Validation | Zod + custom `validateBody` middleware |
| Markdown render | `marked` (server-side, before API response) |
| Slug generation | `slugify` + numeric suffix for uniqueness |
| Rate limiting | `express-rate-limit` |
| Security headers | `helmet`, `cors` |
| Email | `resend` SDK — reads `RESEND_API_KEY` from env; no-ops if key absent |
| Code execution proxy | Judge0 REST API — reads `JUDGE0_API_KEY` + `JUDGE0_API_URL` from env [Stage 3] |

Key backend libraries: `express`, `typescript`, `ts-node`, `zod`, `jsonwebtoken`, `bcrypt`, `prisma`, `@prisma/client`, `express-rate-limit`, `marked`, `slugify`, `cors`, `helmet`, `uuid`, `resend`

## Frontend (`frontend/`)

| Concern | Choice |
|---|---|
| Framework | React + TypeScript (Vite) |
| Styling | Tailwind CSS |
| UI components | **shadcn/ui** (on top of Tailwind + CSS variables) [Stage 1] |
| Routing | React Router DOM |
| HTTP client | Axios (with interceptors for 401/429 handling) |
| Server state | TanStack React Query |
| Form handling | React Hook Form + Zod (`@hookform/resolvers`) |
| Markdown + LaTeX | `react-markdown` + `remark-math` + `rehype-katex` + `katex` [Stage 1] |
| Drag and drop | `@dnd-kit/core` + `@dnd-kit/sortable` (reordering in admin editors) [Stage 2] |
| Learning graph | `reactflow` — dynamic DAG from DB data [Stage 3] |
| Charts (slider viz) | `recharts` — for parameterized function visualization [Stage 3] |
| Code editor | `@uiw/react-codemirror` — syntax-highlighted code input [Stage 3] |

## shadcn/ui Component Usage

shadcn/ui is initialized via `npx shadcn@latest init`. Components are generated into `frontend/src/components/ui/`. The project already uses CSS custom properties (`--primary`, `--border`, `--muted`, `--foreground`, etc.) which are compatible with shadcn's theming system.

Components used across the project:
`button`, `input`, `textarea`, `badge`, `card`, `table`, `pagination`, `dialog`, `alert-dialog`, `popover`, `command`, `toggle-group`, `skeleton`, `separator`, `avatar`, `toast`, `tabs`

**Rule**: Never hand-roll a replacement for a component shadcn covers. Always install and use the shadcn version.

## Markdown + LaTeX Rendering

- **Server-side** (`marked`): All content stored as Markdown is rendered to HTML by the backend before being sent in API responses. The frontend receives `contentHtml` and renders it via `dangerouslySetInnerHTML` only where KaTeX is not needed (legacy path).
- **Client-side** (`MarkdownRenderer` component): A shared `components/shared/MarkdownRenderer.tsx` wraps `react-markdown` with `remark-math` + `rehype-katex` plugins. Used for:
  - Post detail page (replacing `dangerouslySetInnerHTML`)
  - All admin live previews (PostEditor, ProjectEditor, FunEditor, ModuleEditor)
  - Learning module `MarkdownBlock` widget
- KaTeX CSS must be imported once in `main.tsx`: `import 'katex/dist/katex.min.css'`

## Code Execution (Stage 3)

All code execution goes through the **Judge0 REST API**, proxied via `POST /api/run-code` on the backend (to keep the API key server-side). Supported languages: Python, TypeScript, Java, C#, Haskell, Rust, R.

The backend proxy:
- Accepts `{ language, sourceCode, stdin? }`
- Maps language name to Judge0 language ID
- Calls Judge0, polls for result, returns `{ stdout, stderr, status }`
- Rate-limited to 20 requests/min per authenticated user

## Testing

| Layer | Libraries |
|---|---|
| Backend unit + property tests | Vitest + fast-check |
| Backend integration tests | Vitest + Supertest + test PostgreSQL |
| Frontend unit tests | Vitest + React Testing Library + `@testing-library/jest-dom` |
| E2E | Playwright |

Property-based tests use **minimum 100 iterations** and are tagged with the design property they validate (e.g. `Property 1: Slug uniqueness after generation`).

## Environment Variables

### Backend (`.env`)
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
RESEND_API_KEY=...          # Stage 1 — email subscriptions
RESEND_FROM_EMAIL=...       # Stage 1 — sender address
JUDGE0_API_URL=...          # Stage 3 — code execution proxy
JUDGE0_API_KEY=...          # Stage 3 — code execution proxy
```

### Frontend (`.env`)
```
VITE_API_URL=http://localhost:3001
```

## Common Commands

```bash
# Backend
cd backend
npx prisma migrate dev --name <name>   # run a new migration
npx prisma generate                    # regenerate Prisma client after schema change
npx vitest run                         # run all backend tests (single pass)

# Frontend
cd frontend
npm run dev                            # start Vite dev server (run manually in terminal)
npx vitest run                         # run all frontend tests (single pass)

# E2E
npx playwright test                    # run Playwright E2E tests
```

> **Note:** Never run `npm run dev` or watch-mode commands via the agent — start them manually in a terminal.

## Docker

### Dev Stack

```bash
docker compose up -d                        # jalankan dev stack (detached)
docker compose up                           # jalankan dev stack (foreground)
docker compose down                         # hentikan dan hapus containers
docker compose down -v                      # hentikan dan hapus containers + volumes
```

Port dev: backend `3001`, frontend `5173`, db `5432`.

### Prod Stack

```bash
docker compose -f docker-compose.prod.yml up -d --build    # build dan jalankan prod stack
docker compose -f docker-compose.prod.yml down              # hentikan prod stack
```

Port prod: backend `3001`, frontend `80`, db tidak di-expose.

### Logs per-Service

```bash
docker compose logs backend                 # logs service backend
docker compose logs frontend                # logs service frontend
docker compose logs db                      # logs service db
docker compose logs -f backend              # ikuti (follow) logs backend
```

### Akses Shell Container

```bash
docker compose exec backend sh              # shell di container backend
docker compose exec frontend sh             # shell di container frontend
docker compose exec db sh                   # shell di container db
```

### Migrasi dan Seed Manual

```bash
docker compose exec backend npx prisma migrate deploy    # jalankan migrasi secara manual
docker compose exec backend npx prisma db seed           # seed database
docker compose exec backend npx prisma studio            # buka Prisma Studio
```

### Kapan Perlu Rebuild Image

Rebuild diperlukan ketika ada perubahan pada `Dockerfile`, `package.json`, atau `package-lock.json`. Gunakan flag `--build`:

```bash
docker compose up -d --build                                        # dev stack
docker compose -f docker-compose.prod.yml up -d --build             # prod stack
```
