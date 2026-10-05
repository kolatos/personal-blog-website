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
| Markdown render | `marked` (server-side, before response) |
| Slug generation | `slugify` + numeric suffix for uniqueness |
| Rate limiting | `express-rate-limit` |
| Security headers | `helmet`, `cors` |

Key backend libraries: `express`, `typescript`, `ts-node`, `zod`, `jsonwebtoken`, `bcrypt`, `prisma`, `@prisma/client`, `express-rate-limit`, `marked`, `slugify`, `cors`, `helmet`, `uuid`

## Frontend (`frontend/`)

| Concern | Choice |
|---|---|
| Framework | React + TypeScript (Vite) |
| Styling | Tailwind CSS |
| Routing | React Router DOM |
| HTTP client | Axios (with interceptors for 401/429 handling) |
| Server state | TanStack React Query |
| Form handling | React Hook Form + Zod (`@hookform/resolvers`) |
| Markdown preview | `react-markdown` (client-side preview only) |

## Testing

| Layer | Libraries |
|---|---|
| Backend unit + property tests | Vitest + fast-check |
| Backend integration tests | Vitest + Supertest + test PostgreSQL |
| Frontend unit tests | Vitest + React Testing Library + `@testing-library/jest-dom` |
| E2E | Playwright |

Property-based tests use **minimum 100 iterations** and are tagged with the design property they validate (e.g. `Property 1: Slug uniqueness after generation`).

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
