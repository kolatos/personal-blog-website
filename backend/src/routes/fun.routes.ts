import { Router } from 'express';
import { authenticateJWT } from '../middleware/authenticateJWT.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateBody } from '../middleware/validateBody.js';
import { CreateFunPostSchema, UpdateFunPostSchema } from '../schemas/fun.schema.js';
import {
  getFunPosts,
  getAllFunPosts,
  getFunPostBySlug,
  getFunPostById,
  createFunPost,
  updateFunPost,
  publishFunPost,
  unpublishFunPost,
  deleteFunPost,
} from '../controllers/fun.controller.js';

/**
 * Fun Router — di-mount di /api/fun
 *
 * Rute publik (tanpa auth):
 *   GET  /           — daftar fun post published, dipaginasi, filter type/tag
 *   GET  /:slug      — satu fun post published berdasarkan slug
 *
 * Rute admin-only:
 *   GET    /admin          — semua fun post (draft + published)
 *   GET    /admin/:id      — satu fun post berdasarkan ID (untuk edit page prefill)
 *   POST   /               — buat fun post baru
 *   PUT    /:id            — update fun post
 *   PATCH  /:id/publish    — publish fun post
 *   PATCH  /:id/unpublish  — unpublish fun post
 *   DELETE /:id            — hapus fun post
 *
 * Requirements: 4.1–4.5 (Stage 2)
 */
const router = Router();

// ─── Public routes ────────────────────────────────────────────────────────────

/**
 * GET /api/fun
 * Publik. Mengembalikan fun post published dipaginasi, publishedAt DESC.
 * Query params: type (opsional), tag (slug tag, opsional), page.
 * Requirements: 4.2 (Stage 2) — Property 3: Fun feed filter correctness
 */
router.get('/', getFunPosts);

/**
 * GET /api/fun/admin
 * Admin only. Semua fun post (draft + published).
 * NOTE: Harus didefinisikan SEBELUM /:slug agar "admin" tidak dianggap slug.
 * Requirements: 4.4 (Stage 2)
 */
router.get('/admin', authenticateJWT, requireRole('admin'), getAllFunPosts);

/**
 * GET /api/fun/admin/:id
 * Admin only. Satu fun post berdasarkan ID (untuk edit page prefill).
 * NOTE: Harus didefinisikan SEBELUM /:slug.
 * Requirements: 4.4 (Stage 2)
 */
router.get('/admin/:id', authenticateJWT, requireRole('admin'), getFunPostById);

/**
 * GET /api/fun/:slug
 * Publik. Satu fun post published. Mengembalikan 404 untuk draft.
 * Property 1: Content Draft Isolation
 * Requirements: 4.3 (Stage 2)
 */
router.get('/:slug', getFunPostBySlug);

// ─── Admin-only routes ────────────────────────────────────────────────────────

/**
 * POST /api/fun
 * Admin only. Membuat fun post baru dalam status draft.
 * Requirements: 4.1, 4.4 (Stage 2)
 */
router.post(
  '/',
  authenticateJWT,
  requireRole('admin'),
  validateBody(CreateFunPostSchema),
  createFunPost
);

/**
 * PUT /api/fun/:id
 * Admin only. Mengupdate fun post. Auto-revert Published → Draft.
 * Requirements: 4.4, 4.5 (Stage 2)
 */
router.put(
  '/:id',
  authenticateJWT,
  requireRole('admin'),
  validateBody(UpdateFunPostSchema),
  updateFunPost
);

/**
 * PATCH /api/fun/:id/publish
 * Admin only. Transisi Draft → Published.
 * Requirements: 4.5 (Stage 2)
 */
router.patch('/:id/publish', authenticateJWT, requireRole('admin'), publishFunPost);

/**
 * PATCH /api/fun/:id/unpublish
 * Admin only. Transisi Published → Draft.
 * Requirements: 4.5 (Stage 2)
 */
router.patch('/:id/unpublish', authenticateJWT, requireRole('admin'), unpublishFunPost);

/**
 * DELETE /api/fun/:id
 * Admin only. Hapus fun post secara permanen.
 * Requirements: 4.4 (Stage 2)
 */
router.delete('/:id', authenticateJWT, requireRole('admin'), deleteFunPost);

export default router;
