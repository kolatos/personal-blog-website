import { Router } from 'express';
import { authenticateJWT } from '../middleware/authenticateJWT.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateBody } from '../middleware/validateBody.js';
import { CreatePostSchema, UpdatePostSchema } from '../schemas/post.schema.js';
import {
  getPublishedPosts,
  getAllPosts,
  searchPosts,
  getPostBySlug,
  createPost,
  updatePost,
  publishPost,
  unpublishPost,
  deletePost,
  getAdminPostById,
  getTags,
} from '../controllers/post.controller.js';

/**
 * Post Router — mounted at /api/posts
 *
 * Public routes (no auth required):
 *   GET  /           — list Published posts, paginated
 *   GET  /search     — full-text search over Published posts
 *   GET  /:slug      — single Published post by slug
 *
 * Admin-only routes (require valid JWT with role='admin'):
 *   GET    /admin          — list all posts (Draft + Published), admin dashboard
 *   POST   /               — create new post
 *   PUT    /:id            — update post content/title
 *   PATCH  /:id/publish    — publish a draft post
 *   PATCH  /:id/unpublish  — unpublish a published post
 *   DELETE /:id            — delete post (cascades to comments)
 *
 * Requirements: 3.1–3.7, 4.1–4.8, 5.1–5.7
 */
const router = Router();

// ─── Public routes ────────────────────────────────────────────────────────────

/**
 * GET /api/posts
 * Returns paginated list of Published posts.
 * Query: ?page=1&pageSize=10
 *
 * Requirements: 5.1, 5.4
 */
router.get('/', getPublishedPosts);

/**
 * GET /api/posts/search
 * Full-text search over Published posts.
 * Query: ?keyword=...&page=1
 * NOTE: Must be defined BEFORE /:slug to avoid treating "search" as a slug.
 *
 * Requirements: 5.5, 5.6, 5.7
 */
router.get('/search', searchPosts);

/**
 * GET /api/posts/admin
 * Returns all posts (Draft + Published) for the Admin dashboard.
 * Query: ?page=1&pageSize=20
 * NOTE: Must be defined BEFORE /:slug to avoid treating "admin" as a slug.
 *
 * Requirements: 4.4, 4.5
 */
router.get('/admin', authenticateJWT, requireRole('admin'), getAllPosts);

/**
 * GET /api/posts/admin/:id
 * Returns a single post by ID (for admin edit page prefill, works for draft/published).
 * NOTE: Must be defined BEFORE /:slug.
 *
 * Requirements: 3.3, 4.4
 */
router.get('/admin/:id', authenticateJWT, requireRole('admin'), getAdminPostById);

/**
 * GET /api/posts/:slug
 * Returns a single Published post by slug.
 * Returns 404 for drafts or non-existent posts.
 *
 * Requirements: 5.2, 5.3, 4.7
 */
router.get('/:slug', getPostBySlug);

// ─── Admin-only routes ────────────────────────────────────────────────────────

/**
 * POST /api/posts
 * Creates a new Draft post.
 * Requires: valid Admin JWT, valid request body.
 *
 * Requirements: 3.1, 3.2, 3.5, 3.7
 */
router.post(
  '/',
  authenticateJWT,
  requireRole('admin'),
  validateBody(CreatePostSchema),
  createPost
);

/**
 * PUT /api/posts/:id
 * Updates an existing post. Auto-reverts Published → Draft if edited.
 * Requires: valid Admin JWT, valid request body.
 *
 * Requirements: 3.3, 3.4, 3.5
 */
router.put(
  '/:id',
  authenticateJWT,
  requireRole('admin'),
  validateBody(UpdatePostSchema),
  updatePost
);

/**
 * PATCH /api/posts/:id/publish
 * Transitions a Draft post to Published, records published_at.
 * Requires: valid Admin JWT.
 *
 * Requirements: 4.1, 4.6
 */
router.patch(
  '/:id/publish',
  authenticateJWT,
  requireRole('admin'),
  publishPost
);

/**
 * PATCH /api/posts/:id/unpublish
 * Transitions a Published post back to Draft.
 * Requires: valid Admin JWT.
 *
 * Requirements: 4.2, 4.6
 */
router.patch(
  '/:id/unpublish',
  authenticateJWT,
  requireRole('admin'),
  unpublishPost
);

/**
 * DELETE /api/posts/:id
 * Permanently deletes a post and all associated comments (CASCADE).
 * Requires: valid Admin JWT.
 *
 * Requirements: 4.3, 4.8
 */
router.delete(
  '/:id',
  authenticateJWT,
  requireRole('admin'),
  deletePost
);

export default router;

// ─── Tags router ──────────────────────────────────────────────────────────────

/**
 * Tags Router — mounted at /api/tags
 *
 * Public routes:
 *   GET / — list all tags alphabetically
 *
 * Requirements: 2.4
 */
export const tagsRouter = Router();

/**
 * GET /api/tags
 * Public. Returns all tags sorted alphabetically.
 *
 * Requirements: 2.4
 */
tagsRouter.get('/', getTags);
