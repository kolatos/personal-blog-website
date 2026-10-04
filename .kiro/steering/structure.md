# Project Structure

```
/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # DB models: User, Post, Comment, TokenBlacklist, LoginAttempts
│   └── src/
│       ├── app.ts                 # Express setup (cors, helmet, json, mount routers, error handler)
│       ├── server.ts              # Entry point
│       ├── types/
│       │   └── index.ts           # JwtPayload, AuthTokens, RegisterDto, LoginDto, CreatePostDto, etc.
│       ├── schemas/               # Zod validation schemas
│       │   ├── auth.schema.ts
│       │   ├── post.schema.ts
│       │   ├── comment.schema.ts
│       │   └── user.schema.ts
│       ├── middleware/
│       │   ├── authenticateJWT.ts # Verify Bearer token, check blacklist, populate req.user
│       │   ├── requireRole.ts     # requireRole('admin' | 'user') factory
│       │   ├── validateBody.ts    # validateBody(schema) factory using Zod
│       │   ├── rateLimiter.ts     # loginRateLimiter (10 req/IP/60s)
│       │   └── accountLockout.ts  # accountLockoutMiddleware (5 failures → 15min lock)
│       ├── services/
│       │   ├── auth.service.ts    # AuthService: register, login, logout, lockout logic
│       │   ├── post.service.ts    # PostService: CRUD, slug, publish/unpublish, search
│       │   ├── comment.service.ts # CommentService: add, delete, list
│       │   └── user.service.ts    # UserService: getProfile, updateUsername, updatePassword
│       ├── controllers/           # Express request handlers (thin, delegate to services)
│       ├── routes/                # Express routers
│       │   ├── auth.routes.ts     # /api/auth
│       │   ├── post.routes.ts     # /api/posts
│       │   ├── comment.routes.ts  # /api/posts/:postId/comments
│       │   └── user.routes.ts     # /api/users
│       └── jobs/
│           └── cleanupBlacklist.ts  # Periodic cleanup of expired token_blacklist rows
│
└── frontend/
    └── src/
        ├── api/                   # Axios instance + typed API call functions
        │   ├── client.ts          # Axios instance with 401/429 interceptors
        │   ├── auth.ts
        │   ├── posts.ts
        │   ├── comments.ts
        │   └── users.ts
        ├── components/
        │   ├── ui/                # Reusable: Button, Input, Badge, Pagination
        │   ├── layout/            # Navbar, Footer, Layout
        │   ├── blog/              # PostCard, PostList, CommentList, CommentForm
        │   └── admin/             # PostEditor, PostTable, StatusBadge
        ├── pages/
        │   ├── public/            # HomePage, PostDetailPage, SearchPage
        │   ├── auth/              # LoginPage, RegisterPage
        │   ├── admin/             # DashboardPage, CreatePostPage, EditPostPage
        │   └── user/              # ProfilePage
        ├── hooks/                 # useAuth, usePosts, useComments, useProfile
        ├── contexts/
        │   └── AuthContext.tsx    # Auth state, token persistence in localStorage
        ├── types/
        │   └── index.ts           # Post, Comment, User, AuthState, PaginatedResponse, ErrorResponse
        └── App.tsx                # React Router setup + ProtectedRoute guard
```

## Key Conventions

- **Layered architecture**: Router → Middleware → Controller → Service → Prisma (Repository). Controllers are thin; business logic lives in services.
- **Error format**: All API errors return `{ error: { code, message, fields? } }`. Use the `ErrorResponse` interface.
- **HTTP codes**: 200 GET/PUT/PATCH success, 201 create, 204 delete, 400 validation, 401 auth, 403 role, 404 not found, 409 conflict, 429 rate limit, 500 server error.
- **Post status**: Draft is the default. `publishPost()` → Published. `unpublishPost()` or any `updatePost()` on a Published post → reverts to Draft. Duplicate status transitions return 409.
- **Slug**: Generated via `slugify`. Collisions get a numeric suffix (`judul-post-2`). Slug regenerates when title changes.
- **Auth**: JWT in `Authorization: Bearer <token>`. Admin JWT expires in 24h, User JWT in 7 days. Logout hashes and stores the token in `token_blacklist`.
- **Pagination**: Public post list = 10/page ordered by `published_at DESC`. Admin post list = 20/page ordered by `updated_at DESC`.
- **Draft visibility**: Draft posts return 404 to Visitors (do not expose their existence).
- **Markdown**: Server renders Markdown → HTML via `marked` before responding. Frontend uses `react-markdown` only for live preview in the admin editor.
