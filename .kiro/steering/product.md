# Product: Personal Everything Website

A full-stack personal website — part portfolio, part blog, part learning platform — where the Admin shares everything publicly: writing, projects, interests, and interactive learning modules. Registered users can engage through comments, subscriptions, and the full Learning system.

## User Roles

- **Visitor** – unauthenticated; can browse and read all published content (posts, projects, fun, about), view comments, and search
- **Registered_User** – logged-in visitor; can comment and reply on any content type, manage their profile, subscribe to blog posts, access the Learning section (module graph, progress tracking, notes, flashcards)
- **Admin** – single fixed account; full control over all content across every section, can delete any comment, manages learning paths and modules

## Sections

### Landing Page (`/`)
Branding and showcase page. Pulls live teasers from all other sections: recent blog posts, featured projects, fun highlights, about teaser, and a learning CTA. First impression of the site.

### Blog (`/blog`)
The original core section. Admin writes and publishes posts in Markdown with LaTeX and image support. Users comment and reply, subscribe to new posts via email. Posts are tagged and full-text searchable.

### About (`/about`)
CMS-managed personal profile: education timeline, work experience, skills, and contact info. Admin edits sections via the dashboard. Grouped by type, ordered by admin-set display order.

### Projects (`/projects`)
CMS-managed project showcase. Each project has a title, description (Markdown), tech tags, repo/demo links, cover image, and draft/published status. Users can comment on project entries.

### Fun (`/fun`)
A unified tagged feed for anything the admin wants to share: book reviews, movie reviews, drawings, photos, songs, interactive demos, recipes, and more. Content types are open-ended via a `type` enum. Admin-authored only. Users can comment. Filterable by type and tag.

### Learning (`/learning`)
The most complex section. Interactive, atomic, interconnected learning modules for math, programming, and other topics. Requires signup to access.

Key properties:
- **Atomic** — each module covers exactly one topic
- **Interconnected** — modules declare prerequisites; the full module graph is a DAG visualized as an interactive digraph (React Flow)
- **Interactive** — modules contain blocks: Markdown+LaTeX, fill-in-the-blank, parameter slider + live chart, code runner (Judge0)
- Admin-curated **learning paths** (ordered sequences of modules)
- Per-user **completion tracking** (module marked complete by user action)
- Per-user **text highlight + annotation** system (select text → add note → persisted with XPath anchor)
- **Flashcard** system built from notes (SM-2 spaced repetition algorithm, Anki-style review)

### Admin Dashboard (`/admin`)
Central management hub. Includes:
- Overview stats (total posts, comments, users, projects, fun posts, modules)
- Recent activity (recent posts, comments, new users)
- Management sub-pages for every section: Blog posts, About sections, Projects, Fun posts, Learning modules + paths, Users list, Comments list

## Core Features (cross-cutting)

- **Generic comment system** — comments and 1-level replies work across all content types (blog post, project, fun post, learning module). Max depth = 1 (YouTube-style); deeper nesting → @mention instead
- **Post/content status** — Draft is default; publish/unpublish transitions; drafts return 404 to visitors
- **Slug generation** — `slugify` + numeric suffix collision handling; regenerates on title change
- **Full-text search** — over published blog posts via PostgreSQL `to_tsvector`
- **JWT auth** — token blacklist for proper logout; Admin 24h, User 7d
- **Account lockout** — 5 failed logins → 15-min lockout
- **Rate limiting** — 10 req/min on auth endpoints; 20 req/min per user on code execution
- **Email subscriptions** — users subscribe to blog; publishing triggers email via Resend SDK
- **Markdown + LaTeX** — Markdown rendered server-side (`marked`) for post content returned from API; KaTeX rendered client-side for display and live preview
- **Image support** — external URL only (no upload infra); images referenced in Markdown
- **shadcn/ui** — all UI components use shadcn/ui primitives on top of Tailwind CSS

## Language Note

Project documentation and comments are written in **Bahasa Indonesia**. Code identifiers, API paths, and type names use English.
