# Product: Personal Blog Website

A full-stack personal blog application where a single Admin can create and publish blog posts, and registered users can leave comments.

## User Roles

- **Visitor** – unauthenticated; can browse and read published posts, view comments, and search
- **Registered_User** – logged-in visitor; can add and delete their own comments, and manage their profile
- **Admin** – single fixed account; full control over posts (create, edit, publish, unpublish, delete) and can delete any comment

## Core Features

- Post management with Draft/Published status and Markdown rendering
- URL-friendly slugs auto-generated from post titles (unique, with numeric suffix on collision)
- Full-text search over published posts (PostgreSQL `to_tsvector`)
- Comment system scoped to published posts
- JWT-based auth with token blacklist for proper logout/invalidation
- Account lockout after 5 failed login attempts (15-minute lockout)
- IP-based rate limiting on auth endpoints (10 req/min)
- User profile management (username and password update)

## Language Note

Project documentation and comments are written in **Bahasa Indonesia**. Code identifiers, API paths, and type names use English.
