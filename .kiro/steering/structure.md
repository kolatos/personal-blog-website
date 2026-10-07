# Project Structure

This document reflects the full target structure across all three implementation stages. Files added in Stage 1, 2, or 3 are noted inline.

```
/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # DB models (grows across stages — see below)
│   └── src/
│       ├── app.ts                 # Express setup (cors, helmet, json, mount routers, error handler)
│       ├── server.ts              # Entry point
│       ├── types/
│       │   └── index.ts           # All DTO and domain types
│       ├── schemas/               # Zod validation schemas
│       │   ├── auth.schema.ts
│       │   ├── post.schema.ts
│       │   ├── comment.schema.ts
│       │   ├── user.schema.ts
│       │   ├── about.schema.ts        # [Stage 2]
│       │   ├── project.schema.ts      # [Stage 2]
│       │   ├── fun.schema.ts          # [Stage 2]
│       │   ├── subscription.schema.ts # [Stage 1]
│       │   ├── module.schema.ts       # [Stage 3]
│       │   ├── note.schema.ts         # [Stage 3]
│       │   └── flashcard.schema.ts    # [Stage 3]
│       ├── middleware/
│       │   ├── authenticateJWT.ts
│       │   ├── requireRole.ts
│       │   ├── validateBody.ts
│       │   ├── rateLimiter.ts         # loginRateLimiter + codeRunnerRateLimiter [Stage 3]
│       │   └── accountLockout.ts
│       ├── services/
│       │   ├── auth.service.ts
│       │   ├── post.service.ts        # Extended with tag support [Stage 1]
│       │   ├── comment.service.ts     # Extended to generic contentType/contentId + replies [Stage 1]
│       │   ├── user.service.ts
│       │   ├── mail.service.ts        # Resend SDK wrapper [Stage 1]
│       │   ├── subscription.service.ts # [Stage 1]
│       │   ├── about.service.ts       # [Stage 2]
│       │   ├── project.service.ts     # [Stage 2]
│       │   ├── fun.service.ts         # [Stage 2]
│       │   ├── module.service.ts      # [Stage 3]
│       │   ├── path.service.ts        # [Stage 3]
│       │   ├── progress.service.ts    # [Stage 3]
│       │   ├── note.service.ts        # [Stage 3]
│       │   └── flashcard.service.ts   # [Stage 3]
│       ├── controllers/
│       │   ├── auth.controller.ts
│       │   ├── post.controller.ts
│       │   ├── comment.controller.ts  # Updated for generic system [Stage 1]
│       │   ├── user.controller.ts
│       │   ├── subscription.controller.ts # [Stage 1]
│       │   ├── stats.controller.ts    # Admin stats endpoint [Stage 1]
│       │   ├── about.controller.ts    # [Stage 2]
│       │   ├── project.controller.ts  # [Stage 2]
│       │   ├── fun.controller.ts      # [Stage 2]
│       │   ├── module.controller.ts   # [Stage 3]
│       │   ├── path.controller.ts     # [Stage 3]
│       │   ├── note.controller.ts     # [Stage 3]
│       │   └── flashcard.controller.ts # [Stage 3]
│       ├── routes/
│       │   ├── auth.routes.ts
│       │   ├── post.routes.ts         # + GET /api/tags [Stage 1]
│       │   ├── comment.routes.ts      # Migrated to generic /api/comments [Stage 1]
│       │   ├── user.routes.ts
│       │   ├── subscription.routes.ts # /api/subscriptions [Stage 1]
│       │   ├── admin.routes.ts        # /api/admin/stats, /api/admin/users [Stage 1+]
│       │   ├── about.routes.ts        # /api/about [Stage 2]
│       │   ├── project.routes.ts      # /api/projects [Stage 2]
│       │   ├── fun.routes.ts          # /api/fun [Stage 2]
│       │   ├── module.routes.ts       # /api/modules [Stage 3]
│       │   ├── path.routes.ts         # /api/paths [Stage 3]
│       │   ├── run-code.routes.ts     # /api/run-code — Judge0 proxy [Stage 3]
│       │   ├── note.routes.ts         # /api/notes [Stage 3]
│       │   └── flashcard.routes.ts    # /api/flashcards [Stage 3]
│       └── jobs/
│           └── cleanupBlacklist.ts
│
└── frontend/
    └── src/
        ├── api/
        │   ├── client.ts
        │   ├── auth.ts
        │   ├── posts.ts               # Extended with tag support [Stage 1]
        │   ├── comments.ts            # Updated for generic system [Stage 1]
        │   ├── users.ts
        │   ├── subscriptions.ts       # [Stage 1]
        │   ├── admin.ts               # stats, users, comments admin [Stage 1]
        │   ├── about.ts               # [Stage 2]
        │   ├── projects.ts            # [Stage 2]
        │   ├── fun.ts                 # [Stage 2]
        │   ├── modules.ts             # [Stage 3]
        │   ├── paths.ts               # [Stage 3]
        │   ├── notes.ts               # [Stage 3]
        │   └── flashcards.ts          # [Stage 3]
        ├── components/
        │   ├── ui/                    # shadcn/ui components (replaces hand-rolled) [Stage 1]
        │   │   ├── button.tsx
        │   │   ├── input.tsx
        │   │   ├── badge.tsx
        │   │   ├── card.tsx
        │   │   ├── table.tsx
        │   │   ├── pagination.tsx
        │   │   ├── dialog.tsx
        │   │   ├── alert-dialog.tsx
        │   │   ├── popover.tsx
        │   │   ├── command.tsx
        │   │   ├── toggle-group.tsx
        │   │   ├── textarea.tsx
        │   │   ├── skeleton.tsx
        │   │   ├── separator.tsx
        │   │   ├── avatar.tsx
        │   │   ├── toast.tsx
        │   │   └── tabs.tsx
        │   ├── layout/
        │   │   ├── Navbar.tsx         # Updated with all section links per stage
        │   │   ├── Footer.tsx
        │   │   ├── Layout.tsx
        │   │   └── ProtectedRoute.tsx
        │   ├── shared/                # Cross-section reusable components
        │   │   ├── MarkdownRenderer.tsx  # react-markdown + KaTeX [Stage 1]
        │   │   ├── TagInput.tsx          # Type-and-enter tag input [Stage 1]
        │   │   ├── TagChip.tsx           # Display-only tag badge [Stage 1]
        │   │   └── SubscribeButton.tsx   # Blog subscribe toggle [Stage 1]
        │   ├── blog/
        │   │   ├── PostCard.tsx       # Updated with tags [Stage 1]
        │   │   ├── PostList.tsx
        │   │   ├── CommentList.tsx    # Updated with replies [Stage 1]
        │   │   └── CommentForm.tsx    # Updated with parentId support [Stage 1]
        │   ├── admin/
        │   │   ├── PostEditor.tsx     # Updated with TagInput + shadcn [Stage 1]
        │   │   ├── PostTable.tsx      # Migrated to shadcn Table [Stage 1]
        │   │   ├── StatusBadge.tsx    # Migrated to shadcn Badge [Stage 1]
        │   │   ├── StatCard.tsx       # Dashboard stat card [Stage 1]
        │   │   ├── AboutEditor.tsx    # [Stage 2]
        │   │   ├── ProjectEditor.tsx  # [Stage 2]
        │   │   ├── FunEditor.tsx      # [Stage 2]
        │   │   ├── ModuleEditor.tsx   # Block-based editor [Stage 3]
        │   │   └── PathEditor.tsx     # Learning path editor [Stage 3]
        │   ├── about/                 # [Stage 2]
        │   │   ├── TimelineSection.tsx
        │   │   ├── SkillsGrid.tsx
        │   │   └── ContactList.tsx
        │   ├── projects/              # [Stage 2]
        │   │   ├── ProjectCard.tsx
        │   │   └── ProjectList.tsx
        │   ├── fun/                   # [Stage 2]
        │   │   ├── FunCard.tsx
        │   │   ├── FunFeed.tsx
        │   │   └── FeedFilter.tsx
        │   └── learning/              # [Stage 3]
        │       ├── ModuleGraph.tsx    # React Flow digraph
        │       ├── ModuleNode.tsx     # Custom React Flow node
        │       ├── PathSidebar.tsx
        │       ├── NotesPanel.tsx
        │       ├── FlashCard.tsx
        │       └── widgets/           # Widget registry + implementations
        │           ├── registry.tsx
        │           ├── MarkdownBlock.tsx
        │           ├── FillBlankBlock.tsx
        │           ├── SliderVizBlock.tsx
        │           └── CodeRunnerBlock.tsx
        ├── pages/
        │   ├── public/
        │   │   ├── LandingPage.tsx    # / — [Stage 2]
        │   │   ├── BlogPage.tsx       # /blog — replaces HomePage [Stage 2]
        │   │   ├── HomePage.tsx       # /blog (renamed) — kept as BlogPage
        │   │   ├── PostDetailPage.tsx # Updated with KaTeX + tags + replies [Stage 1]
        │   │   ├── SearchPage.tsx
        │   │   ├── AboutPage.tsx      # /about [Stage 2]
        │   │   ├── ProjectsPage.tsx   # /projects [Stage 2]
        │   │   ├── ProjectDetailPage.tsx # /projects/:slug [Stage 2]
        │   │   ├── FunPage.tsx        # /fun [Stage 2]
        │   │   └── FunDetailPage.tsx  # /fun/:slug [Stage 2]
        │   ├── auth/
        │   │   ├── LoginPage.tsx
        │   │   └── RegisterPage.tsx
        │   ├── admin/
        │   │   ├── DashboardPage.tsx      # Redesigned with stats [Stage 1]
        │   │   ├── CreatePostPage.tsx
        │   │   ├── EditPostPage.tsx
        │   │   ├── AboutAdminPage.tsx     # [Stage 2]
        │   │   ├── ProjectsAdminPage.tsx  # [Stage 2]
        │   │   ├── ProjectEditorPage.tsx  # [Stage 2]
        │   │   ├── FunAdminPage.tsx       # [Stage 2]
        │   │   ├── FunEditorPage.tsx      # [Stage 2]
        │   │   ├── UsersAdminPage.tsx     # [Stage 1]
        │   │   ├── CommentsAdminPage.tsx  # [Stage 1]
        │   │   ├── ModulesAdminPage.tsx   # [Stage 3]
        │   │   ├── ModuleEditorPage.tsx   # [Stage 3]
        │   │   └── PathsAdminPage.tsx     # [Stage 3]
        │   ├── user/
        │   │   └── ProfilePage.tsx
        │   └── learning/              # [Stage 3]
        │       ├── LearningPage.tsx   # /learning — module graph
        │       ├── ModuleDetailPage.tsx # /learning/:slug
        │       └── FlashcardsPage.tsx # /learning/flashcards
        ├── hooks/
        │   ├── useAuth.ts
        │   ├── usePosts.ts
        │   ├── useComments.ts
        │   ├── useProfile.ts
        │   ├── useTheme.ts
        │   ├── useSubscription.ts     # [Stage 1]
        │   ├── useAbout.ts            # [Stage 2]
        │   ├── useProjects.ts         # [Stage 2]
        │   ├── useFun.ts              # [Stage 2]
        │   ├── useModules.ts          # [Stage 3]
        │   ├── useProgress.ts         # [Stage 3]
        │   ├── useTextSelection.ts    # Selection API + anchor serialization [Stage 3]
        │   └── useFlashcards.ts       # [Stage 3]
        ├── contexts/
        │   └── AuthContext.tsx
        ├── types/
        │   └── index.ts               # Grows with each stage
        └── App.tsx                    # Routes updated per stage
```

## Prisma Schema Evolution

| Migration | Models Added/Changed |
|---|---|
| `0001_init` | `User`, `Post`, `Comment`, `TokenBlacklist`, `LoginAttempts` |
| `add_post_tags` [S1] | `Tag`, `PostTag` |
| `add_subscriptions` [S1] | `Subscription` |
| `update_comments_generic` [S1] | `Comment` — add `contentType`, `contentId`, `parentId`; migrate `postId` data; drop `postId` |
| `add_about_sections` [S2] | `AboutSection` |
| `add_projects` [S2] | `Project`, `ProjectTag` |
| `add_fun_posts` [S2] | `FunPost`, `FunTag` |
| `add_learning_core` [S3] | `Module`, `ModulePrereq`, `LearningPath`, `PathModule`, `UserProgress` |
| `add_user_notes` [S3] | `UserNote` |
| `add_flashcards` [S3] | `Flashcard` |

## Key Conventions

- **Layered architecture**: Router → Middleware → Controller → Service → Prisma. Controllers are thin; business logic lives in services.
- **Error format**: All API errors return `{ error: { code, message, fields? } }`. Use the `ErrorResponse` interface.
- **HTTP codes**: 200 GET/PUT/PATCH success, 201 create, 204 delete, 400 validation, 401 auth, 403 role, 404 not found, 409 conflict, 429 rate limit, 500 server error.
- **Content status**: Draft is default. `publish()` → Published. `unpublish()` or any `update()` on a Published item → reverts to Draft. Duplicate transitions → 409.
- **Slug**: Generated via `slugify`. Collisions get a numeric suffix (`my-post-2`). Regenerates when title changes. Used for Post, Project, FunPost, Module.
- **Auth**: JWT in `Authorization: Bearer <token>`. Admin 24h, User 7d. Logout hashes token into `token_blacklist`.
- **Generic comments**: `Comment` has `contentType` (`post | project | fun | module`) + `contentId`. Max depth 1 — `parentId` references a top-level comment only.
- **Pagination**: Public content lists = 10/page `published_at DESC`. Admin lists = 20/page `updated_at DESC`.
- **Draft visibility**: Draft content returns 404 to Visitors (never expose draft existence).
- **Markdown**: Server renders Markdown → HTML via `marked` for all content API responses. Frontend uses `MarkdownRenderer` (react-markdown + KaTeX) for live preview in editors.
- **UI components**: Always use shadcn/ui primitives from `components/ui/`. Never add new hand-rolled replacements for components shadcn covers.
- **Widget registry** (Stage 3): Module content blocks are rendered via a `Record<blockType, Component>` registry in `components/learning/widgets/registry.tsx`. Add new widget types by adding one entry to the registry — no changes to `ModuleDetailPage`.
