import { Router } from 'express';
import { authenticateJWT } from '../middleware/authenticateJWT.js';
import { validateBody } from '../middleware/validateBody.js';
import {
  CreateCommentSchema,
  CreateCommentLegacySchema,
} from '../schemas/comment.schema.js';
import {
  getComments,
  getCommentsByPost,
  addComment,
  addCommentToPost,
  deleteComment,
} from '../controllers/comment.controller.js';

/**
 * Generic Comment Router — di-mount di /api/comments
 *
 * Public routes (tanpa auth):
 *   GET  /?contentType=&contentId=       — daftar komentar level atas + balasan
 *
 * Authenticated routes (memerlukan JWT yang valid — semua role):
 *   POST /                               — tambah komentar baru (generic)
 *
 * Owner or Admin routes:
 *   DELETE /:id                          — hapus komentar (owner atau admin)
 *
 * Requirements: 6.1–6.7
 */
export const commentRouter = Router();

// ─── Public routes ────────────────────────────────────────────────────────────

/**
 * GET /api/comments?contentType=&contentId=
 * Mengembalikan komentar level atas + balasan bersarang untuk konten tertentu.
 * Requirements: 6.1, 6.2
 */
commentRouter.get('/', getComments);

// ─── Authenticated routes ─────────────────────────────────────────────────────

/**
 * POST /api/comments
 * Tambah komentar baru. Body: { contentType, contentId, content, parentId? }
 * Requirements: 6.1, 6.3, 6.7
 */
commentRouter.post(
  '/',
  authenticateJWT,
  validateBody(CreateCommentSchema),
  addComment
);

// ─── Owner or Admin routes ────────────────────────────────────────────────────

/**
 * DELETE /api/comments/:id
 * Hapus komentar. Owner atau admin saja. Cascade menghapus balasan.
 * Requirements: 6.4, 6.5, 6.6
 */
commentRouter.delete('/:id', authenticateJWT, deleteComment);

/**
 * Legacy Comment Router — di-mount di /api/posts/:postId/comments
 * Dipertahankan untuk backward-compatibility.
 *
 * Express mergeParams diaktifkan agar :postId dari parent route tersedia.
 *
 * Requirements: 6.1–6.7
 */
const legacyRouter = Router({ mergeParams: true });

/**
 * GET /api/posts/:postId/comments
 * Alias backward-compatible — mengambil komentar berdasarkan postId.
 * Requirements: 6.1, 6.2
 */
legacyRouter.get('/', getCommentsByPost);

/**
 * POST /api/posts/:postId/comments
 * Alias backward-compatible — tambah komentar ke post.
 * Body: { content, parentId? }
 * Requirements: 6.1, 6.3, 6.7
 */
legacyRouter.post(
  '/',
  authenticateJWT,
  validateBody(CreateCommentLegacySchema),
  addCommentToPost
);

/**
 * DELETE /api/posts/:postId/comments/:commentId
 * Alias backward-compatible — hapus komentar.
 * Requirements: 6.4, 6.5, 6.6
 */
legacyRouter.delete('/:commentId', authenticateJWT, deleteComment);

export default legacyRouter;
