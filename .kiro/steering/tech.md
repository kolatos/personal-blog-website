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
