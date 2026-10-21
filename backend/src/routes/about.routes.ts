import { Router } from 'express';
import { authenticateJWT } from '../middleware/authenticateJWT.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateBody } from '../middleware/validateBody.js';
import {
  CreateAboutSectionSchema,
  UpdateAboutSectionSchema,
  ReorderAboutSectionsSchema,
} from '../schemas/about.schema.js';
import {
  getAllSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
} from '../controllers/about.controller.js';

/**
 * About Router — di-mount di /api/about
 *
 * Rute publik (tidak perlu auth):
 *   GET  /            — semua seksi diurutkan berdasarkan type lalu order
 *
 * Rute admin-only (memerlukan JWT valid dengan role='admin'):
 *   POST    /          — buat seksi baru
 *   PUT     /:id       — update seksi
 *   DELETE  /:id       — hapus seksi
 *   PATCH   /reorder   — batch update order dalam transaksi
 *
 * Requirements: 2.1–2.6
 */
const router = Router();

// ─── Rute publik ──────────────────────────────────────────────────────────────

/**
 * GET /api/about
 * Mengembalikan semua AboutSection diurutkan berdasarkan type lalu order.
 * Requirements: 2.1, 2.5
 */
router.get('/', getAllSections);

// ─── Rute admin-only ──────────────────────────────────────────────────────────

/**
 * PATCH /api/about/reorder
 * Batch update field `order` dalam satu transaksi Prisma.
 * NOTE: Harus didefinisikan SEBELUM /:id agar "reorder" tidak dianggap sebagai ID.
 * Requirements: 2.6
 */
router.patch(
  '/reorder',
  authenticateJWT,
  requireRole('admin'),
  validateBody(ReorderAboutSectionsSchema),
  reorderSections
);

/**
 * POST /api/about
 * Membuat AboutSection baru.
 * Requirements: 2.2
 */
router.post(
  '/',
  authenticateJWT,
  requireRole('admin'),
  validateBody(CreateAboutSectionSchema),
  createSection
);

/**
 * PUT /api/about/:id
 * Mengupdate AboutSection yang ada.
 * Requirements: 2.3
 */
router.put(
  '/:id',
  authenticateJWT,
  requireRole('admin'),
  validateBody(UpdateAboutSectionSchema),
  updateSection
);

/**
 * DELETE /api/about/:id
 * Menghapus AboutSection secara permanen.
 * Requirements: 2.4
 */
router.delete(
  '/:id',
  authenticateJWT,
  requireRole('admin'),
  deleteSection
);

export default router;
