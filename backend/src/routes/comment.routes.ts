import { Router } from 'express';
import { authenticateJWT } from '../middleware/authenticateJWT.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateBody } from '../middleware/validateBody.js';
import { CreateCommentSchema } from '../schemas/comment.schema.js';
import {
  getCommentsByPost,
  addComment,
  deleteComment,
} from '../controllers/comment.controller.js';

/**
 * Comment Router — mounted at /api/posts/:postId/comments
 *
 * Public routes (no auth required):
 *   GET  /                       — list all comments for a post
 *
 * Registered_User routes (require valid JWT with role='user'):
 *   POST /                       — add a new comment to a published post
 *
 * Owner or Admin routes (require valid JWT; ownership checked in handler):
 *   DELETE /:commentId           — delete a comment (owner or admin only)
 *
 * Requirements: 6.1–6.7
 *
 * Note: Express mergeParams must be enabled on this router so that `:postId`
 * from the parent route (/api/posts/:postId/comments) is accessible via
 * req.params.postId inside the handlers.
 */
const router = Router({ mergeParams: true });

// ─── Public routes ────────────────────────────────────────────────────────────

/**
 * GET /api/posts/:postId/comments
 * Returns all comments for the given post, ordered by created_at ASC.
 * Each comment includes authorUsername.
 *
 * Requirements: 6.1, 6.2
 */
router.get('/', getCommentsByPost);

// ─── Registered_User routes ───────────────────────────────────────────────────

/**
 * POST /api/posts/:postId/comments
 * Adds a new comment to a published post.
 *
 * Middleware chain:
 *  1. authenticateJWT  — verify token, populate req.user (Req 6.3)
 *  2. requireRole('user') — only Registered_Users can comment (Req 6.3)
 *  3. validateBody     — validate content against CreateCommentSchema (Req 6.7)
 *  4. addComment       — create the comment (Req 6.1, 6.3)
 *
 * Requirements: 6.1, 6.3, 6.7
 */
router.post(
  '/',
  authenticateJWT,
  requireRole('user'),
  validateBody(CreateCommentSchema),
  addComment
);

// ─── Owner or Admin routes ────────────────────────────────────────────────────

/**
 * DELETE /api/posts/:postId/comments/:commentId
 * Deletes a comment. Ownership/admin check is performed inside the handler.
 *
 * Middleware chain:
 *  1. authenticateJWT — verify token, populate req.user (Req 6.4, 6.5)
 *  2. deleteComment   — enforces owner-or-admin rule (Req 6.4, 6.5, 6.6)
 *
 * Requirements: 6.4, 6.5, 6.6
 */
router.delete('/:commentId', authenticateJWT, deleteComment);

export default router;
